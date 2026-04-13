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

router = APIRouter(prefix="/orders", tags=["orders"])


class OrderRequest(BaseModel):
    action: str = Field(..., pattern=r"^(buy|sell)$")
    target_ticker: str = Field(..., pattern=r"^\$[A-Z]{3,4}$")
    shares: int = Field(..., gt=0, le=100000)
    order_type: str = Field(default="MARKET", pattern=r"^(MARKET|LIMIT)$")


class OrderResponse(BaseModel):
    order_id: str
    status: str
    filled_shares: int
    remaining_shares: int
    execution_price: float
    total_value: float
    updated_cash: float
    updated_holdings: list


class OrdersListResponse(BaseModel):
    orders: list
    total_count: int


@router.post("", response_model=OrderResponse)
async def submit_order(
    order: OrderRequest,
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
            detail="TARGET_NOT_TRADABLE",
        )

    if target.status == TeamStatus.ELIMINATED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="TARGET_NOT_TRADABLE",
        )

    if order.action == "buy":
        return await _execute_buy(order, team, target, db)
    elif order.action == "sell":
        return await _execute_sell(order, team, target, db)


async def _execute_buy(order: OrderRequest, team: Team, target: Team, db: AsyncSession):
    if target.id == team.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot buy own stock",
        )

    if order.shares > target.public_float:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="FLOAT_EXHAUSTED",
        )

    max_per_txn = target.public_float // 10  # 10% of float
    if order.shares > max_per_txn and max_per_txn > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"VOLUME_CAP_EXCEEDED: max {max_per_txn} shares per transaction (10% of float)",
        )

    total_cost = Decimal(order.shares) * target.stock_price

    if team.cash < total_cost:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="INSUFFICIENT_CASH",
        )

    stmt = select(StockHolding).where(
        and_(
            StockHolding.owner_team_id == team.id,
            StockHolding.target_team_id == target.id,
        )
    )
    result = await db.execute(stmt)
    holding = result.scalar_one_or_none()

    max_ownership = int(target.shares_outstanding * 0.25)
    current_owned = holding.shares_owned if holding else 0

    if current_owned + order.shares > max_ownership:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OWNERSHIP_LIMIT_EXCEEDED",
        )

    team.cash -= total_cost
    target.public_float -= order.shares

    if holding:
        holding.shares_owned += order.shares
        holding.total_cost_basis += total_cost
    else:
        holding = StockHolding(
            owner_team_id=team.id,
            target_team_id=target.id,
            shares_owned=order.shares,
            total_cost_basis=total_cost,
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

    ledger = CashLedger(
        team_id=team.id,
        entry_type="TRADE_PAYMENT",
        amount=-total_cost,
        balance_after=team.cash,
        reference_type="ORDER",
        reference_id=transaction.id,
        description=f"Bought {order.shares} shares of {target.ticker}",
    )
    db.add(ledger)

    await db.commit()
    await db.refresh(team)

    from app.websocket import manager

    holdings_list = await _get_holdings(team, db)

    await manager.send_trade_confirmation(
        str(team.api_key),
        {
            "order_id": str(transaction.id),
            "side": "BUY",
            "target_ticker": target.ticker,
            "shares": order.shares,
            "execution_price": float(target.stock_price),
            "total_value": float(total_cost),
        },
    )

    # Push updated financials + portfolio to frontend via WS
    market_cap = float(team.stock_price * team.shares_outstanding)
    total_pv = sum(h["total_value"] for h in holdings_list)
    await manager.send_portfolio_update(
        str(team.api_key),
        {
            "cash": float(team.cash),
            "stock_price": float(team.stock_price),
            "market_cap": market_cap,
            "liquidity": float(team.cash) + total_pv * 0.5,
            "treasury_sale_limit_remaining": float(team.dilution_cap_percent),
        },
        {
            "holdings": [
                {
                    **h,
                    "cost_basis": 0,
                    "unrealized_pnl": 0,
                    "ownership_percentage": 0,
                    "current_price": h["current_price"],
                    "current_value": h["total_value"],
                }
                for h in holdings_list
            ],
            "total_portfolio_value": total_pv,
            "total_unrealized_pnl": 0,
        },
    )

    return OrderResponse(
        order_id=str(transaction.id),
        status="FILLED",
        filled_shares=order.shares,
        remaining_shares=0,
        execution_price=float(target.stock_price),
        total_value=float(total_cost),
        updated_cash=float(team.cash),
        updated_holdings=holdings_list,
    )


async def _execute_sell(
    order: OrderRequest, team: Team, target: Team, db: AsyncSession
):
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
            detail="INSUFFICIENT_SHARES",
        )

    total_proceeds = Decimal(order.shares) * target.stock_price

    # Reduce cost basis proportionally
    if holding.shares_owned > 0 and holding.total_cost_basis:
        cost_per_share = holding.total_cost_basis / holding.shares_owned
        holding.total_cost_basis -= cost_per_share * order.shares

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

    ledger = CashLedger(
        team_id=team.id,
        entry_type="TRADE_PROCEEDS",
        amount=total_proceeds,
        balance_after=team.cash,
        reference_type="ORDER",
        reference_id=transaction.id,
        description=f"Sold {order.shares} shares of {target.ticker}",
    )
    db.add(ledger)

    await db.commit()
    await db.refresh(team)

    from app.websocket import manager

    holdings_list = await _get_holdings(team, db)

    await manager.send_trade_confirmation(
        str(team.api_key),
        {
            "order_id": str(transaction.id),
            "side": "SELL",
            "target_ticker": target.ticker,
            "shares": order.shares,
            "execution_price": float(target.stock_price),
            "total_value": float(total_proceeds),
        },
    )

    # Push updated financials + portfolio to frontend via WS
    market_cap = float(team.stock_price * team.shares_outstanding)
    total_pv = sum(h["total_value"] for h in holdings_list)
    await manager.send_portfolio_update(
        str(team.api_key),
        {
            "cash": float(team.cash),
            "stock_price": float(team.stock_price),
            "market_cap": market_cap,
            "liquidity": float(team.cash) + total_pv * 0.5,
            "treasury_sale_limit_remaining": float(team.dilution_cap_percent),
        },
        {
            "holdings": [
                {
                    **h,
                    "cost_basis": 0,
                    "unrealized_pnl": 0,
                    "ownership_percentage": 0,
                    "current_price": h["current_price"],
                    "current_value": h["total_value"],
                }
                for h in holdings_list
            ],
            "total_portfolio_value": total_pv,
            "total_unrealized_pnl": 0,
        },
    )

    return OrderResponse(
        order_id=str(transaction.id),
        status="FILLED",
        filled_shares=order.shares,
        remaining_shares=0,
        execution_price=float(target.stock_price),
        total_value=float(total_proceeds),
        updated_cash=float(team.cash),
        updated_holdings=holdings_list,
    )


async def _get_holdings(team: Team, db: AsyncSession):
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
    return holdings_list


@router.get("", response_model=OrdersListResponse)
async def list_orders(
    status_filter: str = "ALL",
    limit: int = 20,
    team: Team = Depends(get_current_team),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Transaction)
        .where(
            (Transaction.buyer_team_id == team.id)
            | (Transaction.seller_team_id == team.id)
        )
        .order_by(Transaction.executed_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    transactions = result.scalars().all()

    orders_list = []
    for t in transactions:
        target = await db.get(Team, t.target_team_id)
        orders_list.append(
            {
                "id": str(t.id),
                "side": "BUY" if t.buyer_team_id == team.id else "SELL",
                "target_ticker": target.ticker if target else str(t.target_team_id),
                "shares": t.shares,
                "price_per_share": float(t.price_per_share)
                if t.price_per_share
                else None,
                "status": "FILLED",
                "total_value": float(t.total_value) if t.total_value else None,
                "created_at": t.executed_at.isoformat() if t.executed_at else None,
                "executed_at": t.executed_at.isoformat() if t.executed_at else None,
            }
        )

    return OrdersListResponse(orders=orders_list, total_count=len(orders_list))


@router.delete("/{order_id}")
async def cancel_order(
    order_id: str,
    team: Team = Depends(get_current_team),
    db: AsyncSession = Depends(get_db),
):
    # TODO: Implement order cancellation when limit orders are supported.
    # Currently all orders are MARKET and execute instantly, so there's nothing to cancel.
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Cannot cancel: order already filled (all market orders execute instantly)",
    )


class TreasurySaleRequest(BaseModel):
    shares: int = Field(..., gt=0)


@router.post("/treasury/sell", response_model=OrderResponse)
async def sell_treasury_stock(
    request: TreasurySaleRequest,
    team: Team = Depends(get_current_team),
    db: AsyncSession = Depends(get_db),
):
    if team.status not in [TeamStatus.ACTIVE, TeamStatus.COOLDOWN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot trade in current status",
        )

    max_per_txn = (team.shares_outstanding * 5) // 100  # 5% per transaction
    if request.shares > max_per_txn:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"TREASURY_TXN_CAP_EXCEEDED: max {max_per_txn} shares per transaction (5% of outstanding)",
        )

    max_sale = (team.shares_outstanding * team.dilution_cap_percent) // 100

    if request.shares > max_sale:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="TREASURY_CAP_EXCEEDED",
        )

    if request.shares > team.treasury_shares:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient treasury shares",
        )

    total_proceeds = Decimal(request.shares) * team.stock_price

    team.treasury_shares -= request.shares
    team.public_float += request.shares
    team.cash += total_proceeds

    transaction = Transaction(
        buyer_team_id=None,
        seller_team_id=team.id,
        target_team_id=team.id,
        shares=request.shares,
        price_per_share=team.stock_price,
        total_value=total_proceeds,
        transaction_type=TransactionType.TREASURY_SALE,
    )
    db.add(transaction)

    await db.flush()

    ledger = CashLedger(
        team_id=team.id,
        entry_type="TREASURY_SALE",
        amount=total_proceeds,
        balance_after=team.cash,
        reference_type="ORDER",
        reference_id=transaction.id,
        description=f"Sold {request.shares} treasury shares",
    )
    db.add(ledger)

    await db.commit()
    await db.refresh(team)

    return OrderResponse(
        order_id=str(transaction.id),
        status="FILLED",
        filled_shares=request.shares,
        remaining_shares=0,
        execution_price=float(team.stock_price),
        total_value=float(total_proceeds),
        updated_cash=float(team.cash),
        updated_holdings=[],
    )
