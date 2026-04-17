"""Trading API endpoints: preview, buy, sell, portfolio.

Role enforcement: only traders can execute buy/sell.
Any team member can preview trades and view portfolio.
Trade events are broadcast via Redis after DB commit.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import select

from app.auth_utils import require_team
from app.database import get_db
from app.models import Team, TeamStatus, StockHolding
from app.services.game_service import get_game_state_readonly
from app.redis_pubsub import publish_broadcast
from app.services.trading_service import (
    execute_buy,
    execute_sell,
    get_portfolio,
    preview_trade,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/trading", tags=["trading"])


# --- Pydantic Models ---


class TradeRequest(BaseModel):
    target_team_id: str
    shares: int = Field(gt=0)


class TradePreviewRequest(BaseModel):
    target_team_id: str
    shares: int = Field(gt=0)
    trade_type: str = Field(pattern="^(BUY|SELL)$")


class TradePreview(BaseModel):
    target_ticker: str
    shares: int
    price_per_share: str
    total_cost: str
    available_cash: str
    shares_available: int
    current_holding: int


class TradeResult(BaseModel):
    transaction_id: str
    message: str
    new_cash_balance: str
    shares_owned: int


class HoldingDetail(BaseModel):
    target_team_id: str
    ticker: str
    shares_owned: int
    avg_buy_price: str
    current_price: str
    market_value: str
    pnl: str
    pnl_pct: str
    ownership_pct: str


class PortfolioResponse(BaseModel):
    cash: str
    holdings: list[HoldingDetail]
    total_holdings_value: str
    net_worth: str


# --- Endpoints ---


@router.post("/preview")
async def preview(
    req: TradePreviewRequest,
    current_user: dict = Depends(require_team),
    db: AsyncSession = Depends(get_db),
) -> TradePreview:
    """Preview a trade without executing. Any team member can preview."""
    try:
        import uuid

        result = await preview_trade(
            db,
            current_user["team_id"],
            uuid.UUID(req.target_team_id),
            req.shares,
            req.trade_type,
        )
        return TradePreview(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/buy")
async def buy_shares(
    req: TradeRequest,
    current_user: dict = Depends(require_team),
    db: AsyncSession = Depends(get_db),
) -> TradeResult:
    """Execute a buy order with atomic 30% cap enforcement.

    Only traders can execute trades (T-04-06).
    """
    if current_user["role"] != "trader":
        raise HTTPException(
            status_code=403, detail="Only traders can execute trades"
        )

    # Phase 8 D-02: Trading halted during War Room
    game_state = await get_game_state_readonly(db)
    if getattr(game_state, "game_phase", None) == "war_room":
        raise HTTPException(
            status_code=409, detail="Trading is halted during War Room"
        )

    # ELIM-03: Eliminated teams cannot trade
    buyer_team = await db.scalar(
        select(Team).where(Team.id == current_user["team_id"])
    )
    if buyer_team and buyer_team.status == TeamStatus.ELIMINATED:
        raise HTTPException(status_code=403, detail="Eliminated teams cannot trade")

    try:
        import uuid

        target_id = uuid.UUID(req.target_team_id)

        # D-09: Cannot buy eliminated team's stock
        target_team = await db.scalar(
            select(Team).where(Team.id == target_id)
        )
        if target_team and target_team.status == TeamStatus.ELIMINATED:
            raise HTTPException(status_code=409, detail="Cannot trade eliminated company stock")

        txn = await execute_buy(
            db, current_user["team_id"], target_id, req.shares
        )
        await db.commit()

        # Get updated holding count for response
        holding = await db.scalar(
            select(StockHolding).where(
                StockHolding.owner_team_id == current_user["team_id"],
                StockHolding.target_team_id == target_id,
            )
        )
        shares_owned = holding.shares_owned if holding else 0

        # Get updated cash balance
        buyer = await db.scalar(
            select(Team).where(Team.id == current_user["team_id"])
        )

        # Broadcast trade event AFTER commit (anti-pattern avoidance)
        await publish_broadcast({
            "type": "trade_executed",
            "payload": {
                "buyer_team_id": str(current_user["team_id"]),
                "target_ticker": str(txn.target_team_id),
                "shares": txn.shares,
                "price_per_share": str(txn.price_per_share),
                "total_value": str(txn.total_value),
                "transaction_type": "BUY",
            },
        })

        return TradeResult(
            transaction_id=str(txn.id),
            message=f"Bought {req.shares} shares",
            new_cash_balance=str(buyer.cash),
            shares_owned=shares_owned,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/sell")
async def sell_shares(
    req: TradeRequest,
    current_user: dict = Depends(require_team),
    db: AsyncSession = Depends(get_db),
) -> TradeResult:
    """Execute a sell order. Only traders can execute trades."""
    if current_user["role"] != "trader":
        raise HTTPException(
            status_code=403, detail="Only traders can execute trades"
        )

    # Phase 8 D-02: Trading halted during War Room
    game_state_sell = await get_game_state_readonly(db)
    if getattr(game_state_sell, "game_phase", None) == "war_room":
        raise HTTPException(
            status_code=409, detail="Trading is halted during War Room"
        )

    # ELIM-03: Eliminated teams cannot trade
    seller_team = await db.scalar(
        select(Team).where(Team.id == current_user["team_id"])
    )
    if seller_team and seller_team.status == TeamStatus.ELIMINATED:
        raise HTTPException(status_code=403, detail="Eliminated teams cannot trade")

    try:
        import uuid

        target_id = uuid.UUID(req.target_team_id)
        txn = await execute_sell(
            db, current_user["team_id"], target_id, req.shares
        )
        await db.commit()

        # Get updated holding count for response
        holding = await db.scalar(
            select(StockHolding).where(
                StockHolding.owner_team_id == current_user["team_id"],
                StockHolding.target_team_id == target_id,
            )
        )
        shares_owned = holding.shares_owned if holding else 0

        # Get updated cash balance
        seller = await db.scalar(
            select(Team).where(Team.id == current_user["team_id"])
        )

        # Broadcast trade event AFTER commit
        await publish_broadcast({
            "type": "trade_executed",
            "payload": {
                "seller_team_id": str(current_user["team_id"]),
                "target_ticker": str(txn.target_team_id),
                "shares": txn.shares,
                "price_per_share": str(txn.price_per_share),
                "total_value": str(txn.total_value),
                "transaction_type": "SELL",
            },
        })

        return TradeResult(
            transaction_id=str(txn.id),
            message=f"Sold {req.shares} shares",
            new_cash_balance=str(seller.cash),
            shares_owned=shares_owned,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/portfolio")
async def portfolio(
    current_user: dict = Depends(require_team),
    db: AsyncSession = Depends(get_db),
) -> PortfolioResponse:
    """Get current team's holdings, P&L, and net worth. Any team role can view."""
    try:
        result = await get_portfolio(db, current_user["team_id"])
        return PortfolioResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
