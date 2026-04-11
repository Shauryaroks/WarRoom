from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_team
from app.database import get_db
from app.models import (
    GameState,
    MarketNews,
    PriceHistory,
    StockHolding,
    Team,
    TeamStatus,
    Transaction,
)

router = APIRouter(prefix="/market", tags=["market"])


# --- GET /market/tickers ---


class TickerSnapshot(BaseModel):
    ticker: str
    name: str
    price: float
    change_24h: Optional[float]
    change_absolute: Optional[float]
    volume_24h: int
    market_cap: float
    status: str


class TickersResponse(BaseModel):
    timestamp: str
    tickers: list[TickerSnapshot]


@router.get("/tickers", response_model=TickersResponse)
async def get_market_tickers(db: AsyncSession = Depends(get_db)):
    stmt = select(Team).where(
        Team.status.in_([TeamStatus.ACTIVE, TeamStatus.COOLDOWN, TeamStatus.BANKRUPT])
    )
    result = await db.execute(stmt)
    teams = result.scalars().all()

    tickers = []
    for team in teams:
        # Get last 2 price history entries for change calculation
        stmt = (
            select(PriceHistory)
            .where(PriceHistory.team_id == team.id)
            .order_by(PriceHistory.calculated_at.desc())
            .limit(2)
        )
        result = await db.execute(stmt)
        price_history = result.scalars().all()

        change_24h = None
        change_absolute = None
        if len(price_history) >= 2:
            old_price = price_history[1].price
            new_price = price_history[0].price
            if old_price > 0:
                change_24h = float((new_price - old_price) / old_price * 100)
                change_absolute = float(new_price - old_price)

        tickers.append(
            TickerSnapshot(
                ticker=team.ticker,
                name=team.name,
                price=float(team.stock_price),
                change_24h=change_24h,
                change_absolute=change_absolute,
                volume_24h=team.public_float,
                market_cap=float(team.shares_outstanding) * float(team.stock_price),
                status=team.status.value,
            )
        )

    return TickersResponse(
        timestamp=datetime.utcnow().isoformat(),
        tickers=tickers,
    )


# --- GET /market/history/{ticker} ---


class PricePoint(BaseModel):
    timestamp: str
    open: float
    high: float
    low: float
    close: float
    volume: int


class PriceHistoryResponse(BaseModel):
    ticker: str
    interval: str
    data_points: list[PricePoint]


@router.get("/history/{ticker}", response_model=PriceHistoryResponse)
async def get_price_history(
    ticker: str,
    interval: str = Query("5m", pattern=r"^(1m|5m|15m|1h)$"),
    limit: int = Query(100, le=500),
    db: AsyncSession = Depends(get_db),
):
    # Normalize ticker
    if not ticker.startswith("$"):
        ticker = "$" + ticker.upper()
    else:
        ticker = ticker.upper()

    stmt = select(Team).where(Team.ticker == ticker)
    result = await db.execute(stmt)
    target = result.scalar_one_or_none()

    if not target:
        raise HTTPException(status_code=404, detail="Ticker not found")

    stmt = (
        select(PriceHistory)
        .where(PriceHistory.team_id == target.id)
        .order_by(PriceHistory.calculated_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    history = result.scalars().all()

    # TODO: Aggregate price history into proper OHLCV candlesticks based on interval.
    # Currently returns raw price points as close-only candles.
    data_points = []
    for h in reversed(history):  # oldest first
        price = float(h.price)
        data_points.append(
            PricePoint(
                timestamp=h.calculated_at.isoformat(),
                open=price,
                high=price,
                low=price,
                close=price,
                volume=0,
            )
        )

    return PriceHistoryResponse(
        ticker=ticker,
        interval=interval,
        data_points=data_points,
    )


# --- GET /market/sectors ---


class SectorInfo(BaseModel):
    name: str
    avg_change_percent: float
    total_market_cap: float
    team_count: int
    color: str


class SectorsResponse(BaseModel):
    sectors: list[SectorInfo]


@router.get("/sectors", response_model=SectorsResponse)
async def get_sector_heatmap(db: AsyncSession = Depends(get_db)):
    # TODO: Implement real sector grouping based on portfolio type.
    # Currently returns a placeholder with all teams grouped as one sector.
    stmt = select(Team).where(
        Team.status.in_([TeamStatus.ACTIVE, TeamStatus.COOLDOWN])
    )
    result = await db.execute(stmt)
    teams = result.scalars().all()

    total_cap = sum(float(t.stock_price * t.shares_outstanding) for t in teams)

    return SectorsResponse(
        sectors=[
            SectorInfo(
                name="ALL",
                avg_change_percent=0.0,
                total_market_cap=total_cap,
                team_count=len(teams),
                color="#00ff00",
            )
        ]
    )


# --- GET /market/ticker/{ticker} (detail) ---


class TeamDetailResponse(BaseModel):
    team_id: str
    name: str
    ticker: str
    status: str
    cash: float
    stock_price: float
    shares_outstanding: int
    public_float: int
    treasury_shares: int
    dilution_cap_percent: int
    market_cap: float
    liquidity: float
    strategic_score: Optional[float]
    swot: Optional[dict]


@router.get("/ticker/{ticker}", response_model=TeamDetailResponse)
async def get_ticker_detail(ticker: str, db: AsyncSession = Depends(get_db)):
    if not ticker.startswith("$"):
        ticker = "$" + ticker.upper()
    else:
        ticker = ticker.upper()

    stmt = select(Team).where(Team.ticker == ticker)
    result = await db.execute(stmt)
    team = result.scalar_one_or_none()

    if not team:
        raise HTTPException(status_code=404, detail="Ticker not found")

    market_cap = float(team.shares_outstanding) * float(team.stock_price)

    stmt = (
        select(func.sum(StockHolding.shares_owned * Team.stock_price))
        .join(Team, StockHolding.target_team_id == Team.id)
        .where(StockHolding.owner_team_id == team.id)
    )
    result = await db.execute(stmt)
    stock_value = result.scalar() or 0

    liquidity = float(team.cash) + (float(stock_value) * 0.5)
    strategic_score = (0.5 * market_cap) + (0.5 * liquidity)

    return TeamDetailResponse(
        team_id=str(team.id),
        name=team.name,
        ticker=team.ticker,
        status=team.status.value,
        cash=float(team.cash),
        stock_price=float(team.stock_price),
        shares_outstanding=team.shares_outstanding,
        public_float=team.public_float,
        treasury_shares=team.treasury_shares,
        dilution_cap_percent=team.dilution_cap_percent,
        market_cap=market_cap,
        liquidity=liquidity,
        strategic_score=strategic_score,
        swot={
            "strengths": team.swot_strengths,
            "weaknesses": team.swot_weaknesses,
            "opportunities": team.swot_opportunities,
            "threats": team.swot_threats,
        }
        if team.swot_strengths
        else None,
    )
