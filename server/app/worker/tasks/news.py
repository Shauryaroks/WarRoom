import asyncio
import json
from decimal import Decimal
from celery import shared_task
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db, SessionLocal
from app.models import MarketNews
from app.websocket import manager

@shared_task(name="app.worker.tasks.news.inject_scheduled_news")
def inject_scheduled_news(
    headline: str,
    content: str | None,
    source_type: str,
    sentiment_score: float | None,
    affected_sectors: list[str] | None,
    affected_tickers: list[str] | None,
):
    import uuid
    async def _inject():
        async with SessionLocal() as db:
            news = MarketNews(
                headline=headline[:120],
                content=content,
                source_type=source_type,
                source_team_id=None,
                sentiment_score=Decimal(str(sentiment_score)) if sentiment_score is not None else None,
                affected_sectors=json.dumps(affected_sectors) if affected_sectors else None,
                affected_tickers=json.dumps(affected_tickers) if affected_tickers else None,
            )
            db.add(news)
            await db.commit()
            await db.refresh(news)

            news_broadcast = {
                "id": str(news.id),
                "headline": news.headline,
                "content": news.content,
                "source_type": news.source_type,
                "source_ticker": None,
                "sentiment_score": float(news.sentiment_score) if news.sentiment_score else None,
                "affected_sectors": json.loads(news.affected_sectors) if news.affected_sectors else None,
                "affected_tickers": json.loads(news.affected_tickers) if news.affected_tickers else None,
                "created_at": news.created_at.isoformat(),
                "relevance_decay": 1.0,
            }
            await manager.broadcast_news(news_broadcast)

    asyncio.run(_inject())
