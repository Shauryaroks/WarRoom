import asyncio
import math
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models import (
    Directive,
    PriceHistory,
    Team,
    TeamStatus,
    Transaction,
    TransactionType,
)
from app.worker import celery_app


@celery_app.task(bind=True, max_retries=3)
def recalculate_price_task(self, team_id: str):
    """Recalculate stock price for a team."""
    asyncio.run(_recalculate_price_async(team_id))


async def _recalculate_price_async(team_id: str):
    async with AsyncSessionLocal() as db:
        team = await db.get(Team, uuid.UUID(team_id))
        if not team or team.status == TeamStatus.ELIMINATED:
            return

        price = await calculate_final_price(db, team)

        team.stock_price = price
        await db.commit()

        await record_price_history(db, team, price)
        await broadcast_price_update(team, price)


async def calculate_final_price(db: AsyncSession, team: Team) -> Decimal:
    """Calculate the final stock price with vibe and sentiment multipliers."""
    base_price = await calculate_base_price(db, team)
    vibe_mult = await calculate_vibe_multiplier(db, team)
    sentiment_mult = await calculate_sentiment_multiplier(db, team)

    final_price = base_price * vibe_mult * sentiment_mult
    return max(Decimal("0.01"), final_price)


async def calculate_base_price(db: AsyncSession, team: Team) -> Decimal:
    """Base price from fundamentals: (profit * 10 + cash * 0.1) * vibe_mult."""
    recent_profit = await get_recent_operating_profit(db, team.id)
    vibe_mult = await calculate_vibe_multiplier(db, team)

    profit_component = recent_profit * Decimal("10")
    cash_component = team.cash * Decimal("0.1")

    base = (profit_component + cash_component) * vibe_mult
    return max(Decimal("0.01"), base)


async def calculate_vibe_multiplier(db: AsyncSession, team: Team) -> Decimal:
    """Vibe multiplier: 0.5 + (0.5 * consistency * macro_sensitivity)."""
    stmt = (
        select(Directive)
        .where(
            Directive.team_id == team.id,
            Directive.status == "COMPLETED",
            Directive.completed_at != None,
        )
        .order_by(Directive.completed_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    directive = result.scalar_one_or_none()

    if not directive:
        return Decimal("1.0")

    consistency = Decimal(str(directive.consistency_score or 0.5))
    macro_sensitivity = Decimal(str(directive.macro_sensitivity_score or 0.5))

    vibe_value = Decimal("0.5") + (Decimal("0.5") * consistency * macro_sensitivity)
    return max(Decimal("0.5"), min(Decimal("1.5"), vibe_value))


async def calculate_sentiment_multiplier(db: AsyncSession, team: Team) -> Decimal:
    """Sentiment from trading activity, capped at +/- 20%."""
    if team.public_float == 0:
        return Decimal("1.0")

    window_start = datetime.utcnow() - timedelta(minutes=15)

    stmt = select(func.sum(Transaction.shares)).where(
        Transaction.target_team_id == team.id,
        Transaction.executed_at >= window_start,
        Transaction.transaction_type == TransactionType.BUY,
    )
    result = await db.execute(stmt)
    buy_volume = result.scalar() or 0

    stmt = select(func.sum(Transaction.shares)).where(
        Transaction.target_team_id == team.id,
        Transaction.executed_at >= window_start,
        Transaction.transaction_type.in_(
            [TransactionType.SELL, TransactionType.TREASURY_SALE]
        ),
    )
    result = await db.execute(stmt)
    sell_volume = result.scalar() or 0

    net_flow = (buy_volume - sell_volume) / team.public_float
    net_flow = max(-1.0, min(1.0, net_flow))

    sentiment_factor = math.tanh(5.0 * net_flow)
    impact = Decimal("1.0") + (Decimal(str(sentiment_factor)) * Decimal("0.20"))

    return max(Decimal("0.80"), min(Decimal("1.20"), impact))


async def get_recent_operating_profit(db: AsyncSession, team_id: uuid.UUID) -> Decimal:
    """Sum of net profit from directives in last 30 minutes."""
    cutoff = datetime.utcnow() - timedelta(minutes=30)

    stmt = select(Directive).where(
        Directive.team_id == team_id,
        Directive.status == "COMPLETED",
        Directive.completed_at >= cutoff,
    )
    result = await db.execute(stmt)
    directives = result.scalars().all()

    total = Decimal("0")
    for d in directives:
        if d.financial_impact:
            import json

            impact = json.loads(d.financial_impact)
            total += Decimal(str(impact.get("net_profit_delta", 0) or 0))

    return total


async def record_price_history(db: AsyncSession, team: Team, price: Decimal):
    """Record price calculation for historical tracking."""
    vibe_mult = await calculate_vibe_multiplier(db, team)
    sentiment_mult = await calculate_sentiment_multiplier(db, team)
    recent_profit = await get_recent_operating_profit(db, team.id)

    history = PriceHistory(
        team_id=team.id,
        price=price,
        market_cap=price * team.shares_outstanding,
        vibe_multiplier=vibe_mult,
        sentiment_multiplier=sentiment_mult,
        consistency_score=None,
        macro_sensitivity_score=None,
        profit_component=recent_profit * Decimal("10"),
        cash_component=team.cash * Decimal("0.1"),
        calculated_at=datetime.utcnow(),
    )
    db.add(history)
    await db.commit()


async def broadcast_price_update(team: Team, price: Decimal):
    """Broadcast price update via Redis Pub/Sub."""
    # TODO: Implement WebSocket broadcast through Redis pub/sub
    pass


@celery_app.task
def periodic_price_sweep():
    """Recalculate all active team prices every 30 seconds."""
    asyncio.run(_periodic_price_sweep_async())


async def _periodic_price_sweep_async():
    async with AsyncSessionLocal() as db:
        stmt = select(Team).where(
            Team.status.in_([TeamStatus.ACTIVE, TeamStatus.COOLDOWN])
        )
        result = await db.execute(stmt)
        teams = result.scalars().all()

        for team in teams:
            recalculate_price_task.delay(str(team.id))
