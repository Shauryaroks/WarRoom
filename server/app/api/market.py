from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_team
from app.database import get_db
from app.models import (
    CashLedger,
    GameSettings,
    MarketNews,
    PriceHistory,
    StockHolding,
    Team,
    TeamStatus,
    Transaction,
)

router = APIRouter(prefix="/market", tags=["market"])


class TickerInfo(BaseModel):
    ticker: str
    name: str
    price: float
    change_24h: Optional[float]
    market_cap: float
    status: str
    volume: int


class MarketOverviewResponse(BaseModel):
    active_teams: int
    total_market_cap: float
    news_count: int
    tickers: list[TickerInfo]


@router.get("/overview", response_model=MarketOverviewResponse)
async def get_market_overview(db: AsyncSession = Depends(get_db)):
    stmt = select(Team).where(
        Team.status.in_([TeamStatus.ACTIVE, TeamStatus.COOLDOWN, TeamStatus.BANKRUPT])
    )
    result = await db.execute(stmt)
    teams = result.scalars().all()

    stmt = select(func.count(MarketNews.id))
    result = await db.execute(stmt)
    news_count = result.scalar() or 0

    total_market_cap = sum(
        float(t.shares_outstanding) * float(t.stock_price) for t in teams
    )

    tickers = []
    for team in teams:
        stmt = (
            select(PriceHistory)
            .where(PriceHistory.team_id == team.id)
            .order_by(PriceHistory.calculated_at.desc())
            .limit(2)
        )
        result = await db.execute(stmt)
        price_history = result.scalars().all()

        change_24h = None
        if len(price_history) >= 2:
            old_price = price_history[1].price
            new_price = price_history[0].price
            if old_price > 0:
                change_24h = float((new_price - old_price) / old_price * 100)

        tickers.append(
            TickerInfo(
                ticker=team.ticker,
                name=team.name,
                price=float(team.stock_price),
                change_24h=change_24h,
                market_cap=float(team.shares_outstanding) * float(team.stock_price),
                status=team.status.value,
                volume=team.public_float,
            )
        )

    return MarketOverviewResponse(
        active_teams=len(teams),
        total_market_cap=total_market_cap,
        news_count=news_count,
        tickers=tickers,
    )


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
async def get_ticker(ticker: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Team).where(Team.ticker == ticker.upper())
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
        strategic_score=None,
        swot={
            "strengths": team.swot_strengths,
            "weaknesses": team.swot_weaknesses,
            "opportunities": team.swot_opportunities,
            "threats": team.swot_threats,
        }
        if team.swot_strengths
        else None,
    )


class NewsItem(BaseModel):
    id: str
    headline: str
    source_ticker: Optional[str]
    is_global: bool
    priority: int
    created_at: str


class NewsResponse(BaseModel):
    news: list[NewsItem]
    total: int


@router.get("/news", response_model=NewsResponse)
async def get_news(
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(MarketNews)
        .order_by(MarketNews.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    news_items = result.scalars().all()

    stmt = select(func.count(MarketNews.id))
    result = await db.execute(stmt)
    total = result.scalar() or 0

    news_list = []
    for item in news_items:
        source_ticker = None
        if item.source_team_id:
            team = await db.get(Team, item.source_team_id)
            if team:
                source_ticker = team.ticker

        news_list.append(
            NewsItem(
                id=str(item.id),
                headline=item.headline,
                source_ticker=source_ticker,
                is_global=item.is_global,
                priority=item.priority,
                created_at=item.created_at.isoformat(),
            )
        )

    return NewsResponse(news=news_list, total=total)


class PriceHistoryResponse(BaseModel):
    prices: list[dict]


@router.get("/ticker/{ticker}/history", response_model=PriceHistoryResponse)
async def get_price_history(
    ticker: str,
    limit: int = Query(100, le=500),
    team: Team = Depends(get_current_team),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Team).where(Team.ticker == ticker.upper())
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

    return PriceHistoryResponse(
        prices=[
            {
                "timestamp": h.calculated_at.isoformat(),
                "price": float(h.price),
                "vibe_multiplier": float(h.vibe_multiplier)
                if h.vibe_multiplier
                else None,
                "sentiment_multiplier": float(h.sentiment_multiplier)
                if h.sentiment_multiplier
                else None,
            }
            for h in history
        ]
    )


class GameStatusResponse(BaseModel):
    game_active: bool
    current_purge_count: int
    cooldown_minutes: int
    teams_remaining: int


@router.get("/status", response_model=GameStatusResponse)
async def get_game_status(db: AsyncSession = Depends(get_db)):
    settings = await db.get(GameSettings, 1)

    stmt = select(func.count(Team.id)).where(
        Team.status.in_([TeamStatus.ACTIVE, TeamStatus.COOLDOWN, TeamStatus.BANKRUPT])
    )
    result = await db.execute(stmt)
    teams_remaining = result.scalar() or 0

    return GameStatusResponse(
        game_active=settings.game_active if settings else False,
        current_purge_count=settings.current_purge_count if settings else 0,
        cooldown_minutes=settings.cooldown_minutes if settings else 10,
        teams_remaining=teams_remaining,
    )
