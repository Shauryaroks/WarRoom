"""Celery task for LLM-generated news after evaluation approval.

Per D-01: News generated after each approved evaluation.
Per D-02: Two types -- market commentary (team-specific) + world event (broader context).
Per D-03: Reuses call_openrouter with a news-specific JSON schema.
Per T-06-02: time_limit=120, failure is non-critical (does not re-raise).
"""

import asyncio
import json
import logging
import uuid
from datetime import timezone

from app.worker.celery_app import celery_app

logger = logging.getLogger(__name__)


NEWS_SCHEMA = {
    "name": "news_output",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "market_commentary": {
                "type": "object",
                "properties": {
                    "headline": {
                        "type": "string",
                        "description": "Max 120 chars, team-specific market reaction",
                    },
                    "body": {
                        "type": "string",
                        "description": "2-3 sentence market analysis",
                    },
                    "sentiment": {
                        "type": "number",
                        "description": "-1.0 to 1.0",
                    },
                },
                "required": ["headline", "body", "sentiment"],
                "additionalProperties": False,
            },
            "world_event": {
                "type": "object",
                "properties": {
                    "headline": {
                        "type": "string",
                        "description": "Max 120 chars, broader market context",
                    },
                    "body": {
                        "type": "string",
                        "description": "2-3 sentence world event description",
                    },
                    "sentiment": {
                        "type": "number",
                        "description": "-1.0 to 1.0",
                    },
                    "affected_sectors": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Industries affected by this event",
                    },
                },
                "required": ["headline", "body", "sentiment", "affected_sectors"],
                "additionalProperties": False,
            },
        },
        "required": ["market_commentary", "world_event"],
        "additionalProperties": False,
    },
}


@celery_app.task(
    name="news.generate",
    time_limit=120,
    soft_time_limit=100,
)
def generate_news(evaluation_id: str, team_id: str):
    """Generate news articles after evaluation approval. Per D-01, D-02."""
    asyncio.run(_generate(evaluation_id, team_id))


async def _generate(evaluation_id: str, team_id: str):
    """Build news prompt, call OpenRouter with NEWS_SCHEMA, save two MarketNews records.

    Per T-06-01: Truncate headlines to 120 chars, clamp sentiment via DB column.
    Per T-06-02: Failure logged but not re-raised (non-critical).
    """
    from decimal import Decimal

    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    from app.database import get_worker_session
    from app.models import Evaluation, MarketNews, Team
    from app.redis_pubsub import publish_broadcast_sync
    from app.services.llm_service import call_openrouter

    eval_uuid = uuid.UUID(evaluation_id)
    team_uuid = uuid.UUID(team_id)

    try:
        async with get_worker_session() as db:
            # Load evaluation with solution relation
            eval_result = await db.execute(
                select(Evaluation)
                .options(selectinload(Evaluation.solution))
                .where(Evaluation.id == eval_uuid)
            )
            evaluation = eval_result.scalar_one_or_none()
            if evaluation is None:
                logger.error("News generation: evaluation %s not found", evaluation_id)
                return

            # Load team
            team_result = await db.execute(select(Team).where(Team.id == team_uuid))
            team = team_result.scalar_one_or_none()
            if team is None:
                logger.error("News generation: team %s not found", team_id)
                return

            # Build news-generation prompt
            system_prompt = (
                "You are a financial news reporter for a simulated stock market game. "
                "Generate two news articles based on a strategic evaluation:\n"
                "1. Market commentary: React to the specific team's solution and its market impact.\n"
                "2. World event: Create a broader market event that affects multiple sectors.\n"
                "Both should feel like real financial news headlines."
            )

            solution_summary = ""
            if evaluation.solution and evaluation.solution.content:
                solution_summary = evaluation.solution.content[:500]

            user_content = (
                f"Team Ticker: {team.ticker}\n"
                f"Company: {team.company_display_name or team.name}\n"
                f"Stock Price: ${team.stock_price}\n"
                f"Evaluation Score: {evaluation.overall_score}\n"
                f"Evaluation Headline: {evaluation.news_headline or 'N/A'}\n"
                f"Solution Summary: {solution_summary}\n"
            )

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ]

            llm_output, _metadata = await call_openrouter(
                messages, json_schema=NEWS_SCHEMA
            )

            # Extract and validate output
            market_commentary = llm_output["market_commentary"]
            world_event = llm_output["world_event"]

            # T-06-01: Truncate headlines to 120 chars
            mc_headline = market_commentary["headline"][:120]
            we_headline = world_event["headline"][:120]

            # Save market commentary news
            news_mc = MarketNews(
                headline=mc_headline,
                content=market_commentary["body"],
                source_type="MARKET_COMMENTARY",
                source_team_id=team.id,
                sentiment_score=Decimal(str(market_commentary["sentiment"])),
                affected_tickers=json.dumps([team.ticker]),
            )
            db.add(news_mc)

            # Save world event news
            news_we = MarketNews(
                headline=we_headline,
                content=world_event["body"],
                source_type="WORLD_EVENT",
                source_team_id=None,
                sentiment_score=Decimal(str(world_event["sentiment"])),
                affected_sectors=json.dumps(world_event["affected_sectors"]),
            )
            db.add(news_we)

            await db.commit()
            await db.refresh(news_mc)
            await db.refresh(news_we)

            # Broadcast both news items via Redis pub/sub (per NEWS-03)
            publish_broadcast_sync(
                {
                    "type": "news_injected",
                    "payload": {
                        "id": str(news_mc.id),
                        "headline": news_mc.headline,
                        "content": news_mc.content,
                        "source_type": news_mc.source_type,
                        "affected_tickers": [team.ticker],
                        "created_at": news_mc.created_at.isoformat(),
                    },
                }
            )

            publish_broadcast_sync(
                {
                    "type": "news_injected",
                    "payload": {
                        "id": str(news_we.id),
                        "headline": news_we.headline,
                        "content": news_we.content,
                        "source_type": news_we.source_type,
                        "affected_sectors": world_event["affected_sectors"],
                        "created_at": news_we.created_at.isoformat(),
                    },
                }
            )

            logger.info(
                "News generated for evaluation %s (team %s): MC=%s, WE=%s",
                evaluation_id,
                team.ticker,
                news_mc.id,
                news_we.id,
            )

    except Exception as e:
        # Per D-03/T-06-02: News generation failure is non-critical -- log and move on
        logger.error(
            "News generation failed for evaluation %s: %s",
            evaluation_id,
            e,
            exc_info=True,
        )
