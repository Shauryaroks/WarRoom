import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models import (
    CashLedger,
    StockHolding,
    Team,
    TeamStatus,
    Transaction,
    TransactionType,
)
from app.worker import celery_app


@celery_app.task
def resolve_bankruptcy_task(team_id: str):
    """Resolve bankruptcy after grace period."""
    asyncio.run(_resolve_bankruptcy_async(team_id))


async def _resolve_bankruptcy_async(team_id: str):
    async with AsyncSessionLocal() as db:
        team = await db.get(Team, uuid.UUID(team_id))
        if not team or team.status != TeamStatus.BANKRUPT:
            return

        result = await attempt_liquidation(db, team)

        if result["success"]:
            team.status = TeamStatus.ACTIVE
            team.bankrupt_resolved = True
            team.bankrupt_since = None
            await db.commit()
        else:
            await eliminate_team(db, team, "BANKRUPTCY")


async def attempt_liquidation(db: AsyncSession, team: Team) -> dict:
    """Fire-sale all external holdings at current market price."""
    stmt = (
        select(StockHolding)
        .where(
            StockHolding.owner_team_id == team.id,
            StockHolding.shares_owned > 0,
        )
        .order_by(StockHolding.shares_owned.desc())
    )
    result = await db.execute(stmt)
    holdings = result.scalars().all()

    total_proceeds = Decimal("0")
    liquidated = []

    for holding in holdings:
        if team.cash >= 0:
            break

        target = await db.get(Team, holding.target_team_id)
        if not target or target.status in [TeamStatus.BANKRUPT, TeamStatus.ELIMINATED]:
            continue

        execution_price = target.stock_price
        proceeds = Decimal(holding.shares_owned) * execution_price

        await execute_liquidation_trade(
            db, team, target, holding.shares_owned, execution_price
        )

        liquidated.append(
            {
                "ticker": target.ticker,
                "shares": holding.shares_owned,
                "price": float(execution_price),
                "proceeds": float(proceeds),
            }
        )
        total_proceeds += proceeds

        await db.refresh(team)

    return {
        "success": team.cash >= 0,
        "final_cash": team.cash,
        "liquidated_holdings": liquidated,
        "total_proceeds": total_proceeds,
    }


async def execute_liquidation_trade(
    db: AsyncSession,
    seller: Team,
    target: Team,
    shares: int,
    price: Decimal,
):
    """Execute a liquidation trade."""
    proceeds = Decimal(shares) * price

    seller.cash += proceeds
    target.public_float += shares

    stmt = select(StockHolding).where(
        StockHolding.owner_team_id == seller.id,
        StockHolding.target_team_id == target.id,
    )
    result = await db.execute(stmt)
    holding = result.scalar_one_or_none()
    if holding:
        holding.shares_owned = 0
        holding.total_cost_basis = Decimal("0")

    await db.flush()

    ledger = CashLedger(
        team_id=seller.id,
        entry_type="BANKRUPTCY_LIQUIDATION",
        amount=proceeds,
        balance_after=seller.cash,
        reference_type="ADMIN_ACTION",
        reference_id=None,
        description=f"Fire-sale liquidation: {shares} shares of {target.ticker}",
    )
    db.add(ledger)

    transaction = Transaction(
        buyer_team_id=None,
        seller_team_id=seller.id,
        target_team_id=target.id,
        shares=shares,
        price_per_share=price,
        total_value=proceeds,
        transaction_type=TransactionType.BANKRUPTCY_LIQUIDATION,
    )
    db.add(transaction)


async def eliminate_team(db: AsyncSession, team: Team, reason: str):
    """Eliminate a team and zero out their stock price."""
    team.status = TeamStatus.ELIMINATED
    team.stock_price = Decimal("0")
    team.eliminated_at = datetime.utcnow()
    team.elimination_reason = reason
    await db.commit()

    stmt = select(StockHolding).where(StockHolding.target_team_id == team.id)
    result = await db.execute(stmt)
    holdings = result.scalars().all()

    for holding in holdings:
        holding.shares_owned = 0
        holding.total_cost_basis = Decimal("0")

    await db.commit()


@celery_app.task
def periodic_bankruptcy_check():
    """Check for bankrupt teams and trigger resolution."""
    asyncio.run(_periodic_bankruptcy_check_async())


async def _periodic_bankruptcy_check_async():
    async with AsyncSessionLocal() as db:
        # Check teams already in BANKRUPT state
        stmt = select(Team).where(
            Team.status == TeamStatus.BANKRUPT,
            Team.bankrupt_since != None,
        )
        result = await db.execute(stmt)
        bankrupt_teams = result.scalars().all()

        for team in bankrupt_teams:
            if team.bankrupt_since:
                elapsed = datetime.utcnow() - team.bankrupt_since
                if elapsed > timedelta(seconds=60):
                    resolve_bankruptcy_task.delay(str(team.id))

        # Check active teams with negative cash
        stmt = select(Team).where(
            Team.status.in_([TeamStatus.ACTIVE, TeamStatus.COOLDOWN]),
            Team.cash < 0,
        )
        result = await db.execute(stmt)
        negative_cash_teams = result.scalars().all()

        for team in negative_cash_teams:
            await enter_bankruptcy(db, team)


async def enter_bankruptcy(db: AsyncSession, team: Team):
    """Transition team to BANKRUPT status."""
    team.status = TeamStatus.BANKRUPT
    team.bankrupt_since = datetime.utcnow()
    team.bankrupt_resolved = False
    await db.commit()

    resolve_bankruptcy_task.apply_async(
        args=[str(team.id)],
        countdown=60,
        task_id=f"bankruptcy_resolution_{team.id}",
    )
