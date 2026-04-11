from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_team
from app.database import get_db
from app.models import (
    CashLedger,
    StockHolding,
    Team,
    TeamStatus,
    Transaction,
    TransactionType,
)

router = APIRouter(prefix="/trading", tags=["trading"])


class BuyOrderRequest(BaseModel):
    target_ticker: str = Field(..., pattern=r"^\$[A-Z]{3,4}$")
    shares: int = Field(..., gt=0, le=100000)


class SellOrderRequest(BaseModel):
    target_ticker: str = Field(..., pattern=r"^\$[A-Z]{3,4}$")
    shares: int = Field(..., gt=0)


class OrderResponse(BaseModel):
    success: bool
    transaction_id: str
    message: str
    price_per_share: float
    total_value: float
    shares_after: int
    cash_after: float


@router.post("/buy", response_model=OrderResponse)
async def buy_stock(
    order: BuyOrderRequest,
    team: Team = Depends(get_current_team),
    db: AsyncSession = Depends(get_db),
):
    if team.status not in [TeamStatus.ACTIVE, TeamStatus.COOLDOWN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot trade in current status",
        )

    stmt = select(Team).where(Team.ticker == order.target_ticker.upper())
    result = await db.execute(stmt)
    target = result.scalar_one_or_none()

    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticker not found",
        )

    if target.id == team.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot buy own stock",
        )

    if target.status == TeamStatus.ELIMINATED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot trade eliminated stock",
        )

    if order.shares > target.public_float:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient shares available",
        )

    total_cost = Decimal(order.shares) * target.stock_price

    if team.cash < total_cost:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient cash",
        )

    stmt = select(StockHolding).where(
        and_(
            StockHolding.owner_team_id == team.id,
            StockHolding.target_team_id == target.id,
        )
    )
    result = await db.execute(stmt)
    holding = result.scalar_one_or_none()

    max_ownership = target.shares_outstanding * 0.25
    current_owned = holding.shares_owned if holding else 0

    if current_owned + order.shares > max_ownership:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SEC Anti-Trust Block: Ownership would exceed 25%",
        )

    team.cash -= total_cost
    target.public_float -= order.shares

    if holding:
        holding.shares_owned += order.shares
    else:
        holding = StockHolding(
            owner_team_id=team.id,
            target_team_id=target.id,
            shares_owned=order.shares,
        )
        db.add(holding)

    transaction = Transaction(
        buyer_team_id=team.id,
        seller_team_id=None,
        target_team_id=target.id,
        shares=order.shares,
        price_per_share=target.stock_price,
        total_value=total_cost,
        transaction_type=TransactionType.BUY,
    )
    db.add(transaction)

    await db.flush()

    await db.insert(
        CashLedger,
        {
            "team_id": team.id,
            "entry_type": "TRADE_BUY",
            "amount": -total_cost,
            "balance_after": team.cash,
            "reference_type": "transaction",
            "reference_id": transaction.id,
            "description": f"Bought {order.shares} shares of {target.ticker}",
        },
    )

    await db.commit()
    await db.refresh(team)

    return OrderResponse(
        success=True,
        transaction_id=str(transaction.id),
        message=f"Bought {order.shares} shares of {target.ticker}",
        price_per_share=float(target.stock_price),
        total_value=float(total_value),
        shares_after=holding.shares_owned if holding else order.shares,
        cash_after=float(team.cash),
    )


@router.post("/sell", response_model=OrderResponse)
async def sell_stock(
    order: SellOrderRequest,
    team: Team = Depends(get_current_team),
    db: AsyncSession = Depends(get_db),
):
    if team.status not in [TeamStatus.ACTIVE, TeamStatus.COOLDOWN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot trade in current status",
        )

    stmt = select(Team).where(Team.ticker == order.target_ticker.upper())
    result = await db.execute(stmt)
    target = result.scalar_one_or_none()

    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticker not found",
        )

    if target.status == TeamStatus.ELIMINATED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot trade eliminated stock",
        )

    stmt = select(StockHolding).where(
        and_(
            StockHolding.owner_team_id == team.id,
            StockHolding.target_team_id == target.id,
        )
    )
    result = await db.execute(stmt)
    holding = result.scalar_one_or_none()

    if not holding or holding.shares_owned < order.shares:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient shares to sell",
        )

    total_proceeds = Decimal(order.shares) * target.stock_price

    holding.shares_owned -= order.shares
    team.cash += total_proceeds
    target.public_float += order.shares

    transaction = Transaction(
        buyer_team_id=None,
        seller_team_id=team.id,
        target_team_id=target.id,
        shares=order.shares,
        price_per_share=target.stock_price,
        total_value=total_proceeds,
        transaction_type=TransactionType.SELL,
    )
    db.add(transaction)

    await db.flush()

    await db.insert(
        CashLedger,
        {
            "team_id": team.id,
            "entry_type": "TRADE_SELL",
            "amount": total_proceeds,
            "balance_after": team.cash,
            "reference_type": "transaction",
            "reference_id": transaction.id,
            "description": f"Sold {order.shares} shares of {target.ticker}",
        },
    )

    await db.commit()
    await db.refresh(team)

    return OrderResponse(
        success=True,
        transaction_id=str(transaction.id),
        message=f"Sold {order.shares} shares of {target.ticker}",
        price_per_share=float(target.stock_price),
        total_value=float(total_proceeds),
        shares_after=holding.shares_owned,
        cash_after=float(team.cash),
    )


class TreasurySaleRequest(BaseModel):
    shares: int = Field(..., gt=0)


@router.post("/treasury/sell", response_model=OrderResponse)
async def sell_treasury_stock(
    order: TreasurySaleRequest,
    team: Team = Depends(get_current_team),
    db: AsyncSession = Depends(get_db),
):
    if team.status not in [TeamStatus.ACTIVE, TeamStatus.COOLDOWN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot trade in current status",
        )

    max_sale = (team.shares_outstanding * team.dilution_cap_percent) // 100

    if order.shares > max_sale:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot sell more than {max_sale} shares (dilution cap: {team.dilution_cap_percent}%)",
        )

    if order.shares > team.treasury_shares:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient treasury shares",
        )

    total_proceeds = Decimal(order.shares) * team.stock_price

    team.treasury_shares -= order.shares
    team.public_float += order.shares
    team.cash += total_proceeds

    transaction = Transaction(
        buyer_team_id=None,
        seller_team_id=team.id,
        target_team_id=team.id,
        shares=order.shares,
        price_per_share=team.stock_price,
        total_value=total_proceeds,
        transaction_type=TransactionType.TREASURY_SALE,
    )
    db.add(transaction)

    await db.flush()

    await db.insert(
        CashLedger,
        {
            "team_id": team.id,
            "entry_type": "TREASURY_SALE",
            "amount": total_proceeds,
            "balance_after": team.cash,
            "reference_type": "transaction",
            "reference_id": transaction.id,
            "description": f"Sold {order.shares} treasury shares",
        },
    )

    await db.commit()
    await db.refresh(team)

    return OrderResponse(
        success=True,
        transaction_id=str(transaction.id),
        message=f"Sold {order.shares} treasury shares",
        price_per_share=float(team.stock_price),
        total_value=float(total_proceeds),
        shares_after=team.treasury_shares,
        cash_after=float(team.cash),
    )


class PortfolioResponse(BaseModel):
    holdings: list[dict]


@router.get("/portfolio", response_model=PortfolioResponse)
async def get_portfolio(
    team: Team = Depends(get_current_team),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(StockHolding).where(
        and_(
            StockHolding.owner_team_id == team.id,
            StockHolding.shares_owned > 0,
        )
    )
    result = await db.execute(stmt)
    holdings = result.scalars().all()

    holdings_list = []
    for h in holdings:
        target = await db.get(Team, h.target_team_id)
        holdings_list.append(
            {
                "ticker": target.ticker,
                "shares": h.shares_owned,
                "current_price": float(target.stock_price),
                "total_value": float(h.shares_owned * target.stock_price),
            }
        )

    return PortfolioResponse(holdings=holdings_list)
