from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import verify_admin_key
from app.database import get_db
from app.models import MarketNews, Team

router = APIRouter(prefix="/news", tags=["news"])


# --- GET /news ---


class NewsItem(BaseModel):
    id: str
    headline: str
    content: Optional[str]
    source_type: str
    source_ticker: Optional[str]
    sentiment_score: Optional[float]
    affected_sectors: Optional[list[str]]
    affected_tickers: Optional[list[str]]
    created_at: str
    relevance_decay: Optional[float]


class NewsResponse(BaseModel):
    items: list[NewsItem]
    has_more: bool


@router.get("", response_model=NewsResponse)
async def get_news(
    limit: int = Query(20, le=50),
    before_id: Optional[str] = None,
    source_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(MarketNews).order_by(MarketNews.created_at.desc())

    if source_type:
        stmt = stmt.where(MarketNews.source_type == source_type)

    if before_id:
        import uuid
        try:
            before_uuid = uuid.UUID(before_id)
            before_item = await db.get(MarketNews, before_uuid)
            if before_item:
                stmt = stmt.where(MarketNews.created_at < before_item.created_at)
        except ValueError:
            pass

    stmt = stmt.limit(limit + 1)  # Fetch one extra to check has_more
    result = await db.execute(stmt)
    news_items = result.scalars().all()

    has_more = len(news_items) > limit
    news_items = news_items[:limit]

    import json

    items = []
    for item in news_items:
        source_ticker = None
        if item.source_team_id:
            team = await db.get(Team, item.source_team_id)
            if team:
                source_ticker = team.ticker

        affected_sectors = None
        if item.affected_sectors:
            try:
                affected_sectors = json.loads(item.affected_sectors)
            except (json.JSONDecodeError, TypeError):
                pass

        affected_tickers = None
        if item.affected_tickers:
            try:
                affected_tickers = json.loads(item.affected_tickers)
            except (json.JSONDecodeError, TypeError):
                pass

        items.append(
            NewsItem(
                id=str(item.id),
                headline=item.headline,
                content=item.content,
                source_type=item.source_type or "SYSTEM",
                source_ticker=source_ticker,
                sentiment_score=float(item.sentiment_score) if item.sentiment_score else None,
                affected_sectors=affected_sectors,
                affected_tickers=affected_tickers,
                created_at=item.created_at.isoformat(),
                relevance_decay=float(item.relevance_decay) if item.relevance_decay else None,
            )
        )

    return NewsResponse(items=items, has_more=has_more)


# --- POST /news/inject ---


class InjectNewsRequest(BaseModel):
    headline: str = Field(..., max_length=120)
    content: Optional[str] = None
    impact_type: Optional[str] = Field(
        None, pattern="^(macro_bullish|macro_bearish|sector_specific|neutral)$"
    )
    affected_sectors: Optional[list[str]] = None
    affected_tickers: Optional[list[str]] = None
    scheduled_for: Optional[datetime] = None


class InjectNewsResponse(BaseModel):
    news_id: str
    broadcast_count: int
    scheduled: bool


@router.post("/inject", response_model=InjectNewsResponse)
async def inject_global_news(
    request: InjectNewsRequest,
    admin: bool = Depends(verify_admin_key),
    db: AsyncSession = Depends(get_db),
):
    import json

    news = MarketNews(
        headline=request.headline,
        content=request.content,
        source_type="ADMIN_INJECTED",
        source_team_id=None,
        affected_sectors=json.dumps(request.affected_sectors) if request.affected_sectors else None,
        affected_tickers=json.dumps(request.affected_tickers) if request.affected_tickers else None,
    )
    db.add(news)
    await db.commit()
    await db.refresh(news)

    # TODO: Broadcast news via WebSocket to all connected clients
    # TODO: Implement scheduled_for — queue news for future publication

    return InjectNewsResponse(
        news_id=str(news.id),
        broadcast_count=0,
        scheduled=request.scheduled_for is not None,
    )
