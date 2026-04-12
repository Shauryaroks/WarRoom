import asyncio
import json
import os
import time
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

import httpx
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models import (
    CashLedger,
    Directive,
    GameState,
    MarketNews,
    StockHolding,
    Team,
    TeamStatus,
)
from app.worker import celery_app

GROK_API_KEY = os.getenv("GROK_API_KEY", "")
GROK_BASE_URL = os.getenv("GROK_BASE_URL", "https://api.x.ai/v1")


@celery_app.task(bind=True, max_retries=3)
def process_directive(self, directive_id: str):
    """Process a directive through the LLM Board."""
    asyncio.run(_process_directive_async(self, directive_id))


async def _process_directive_async(task_self, directive_id: str):
    async with AsyncSessionLocal() as db:
        directive = await db.get(Directive, uuid.UUID(directive_id))
        if not directive:
            return

        team = await db.get(Team, directive.team_id)
        if not team or team.status not in [TeamStatus.ACTIVE, TeamStatus.COOLDOWN]:
            return

        directive.status = "PROCESSING"
        await db.commit()

        try:
            start_time = time.time()
            result = await evaluate_directive(db, team, directive)
            elapsed_ms = int((time.time() - start_time) * 1000)

            # Track latency and cost only for real LLM calls
            used_llm = bool(os.getenv("GROK_API_KEY", ""))
            directive.latency_ms = elapsed_ms
            if used_llm:
                directive.estimated_cost = Decimal("0.006")
                gs = await db.get(GameState, 1)
                if gs:
                    gs.total_llm_cost = (gs.total_llm_cost or Decimal("0")) + Decimal("0.006")

            directive.extraction_confidence = result.get("extraction_confidence", 0.5)
            directive.consistency_score = result.get("consistency_score", 0.5)
            directive.macro_sensitivity_score = result.get(
                "macro_sensitivity_score", 0.5
            )
            directive.aggression_score = result.get("aggression_score", 0.5)
            directive.innovation_score = result.get("innovation_score", 0.5)
            directive.vibe_multiplier = Decimal(str(result.get("vibe_multiplier", 1.0)))
            directive.board_feedback = result.get("board_feedback", "")
            directive.news_headline = result.get("news_headline", "")
            directive.financial_impact = json.dumps(result.get("financial_impact", {}))

            confidence = directive.extraction_confidence or 0.5
            if confidence >= 0.8:
                directive.execution_penalty = 1.0
            elif confidence >= 0.6:
                directive.execution_penalty = 0.8
            elif confidence >= 0.4:
                directive.execution_penalty = 0.5
            else:
                directive.execution_penalty = 0.0

            await apply_financial_impact(db, team, directive)

            directive.status = "COMPLETED"
            directive.completed_at = datetime.utcnow()

            await db.commit()
            await db.refresh(directive)
            await db.refresh(team)

            await generate_public_news(db, directive, team)

        except Exception as e:
            directive.status = "FAILED"
            directive.board_feedback = f"Processing failed: {str(e)}"
            await db.commit()
            raise task_self.retry(exc=e)


async def evaluate_directive(
    db: AsyncSession, team: Team, directive: Directive
) -> dict[str, Any]:
    """Call LLM to evaluate the directive."""

    # Gather news context (last 20 items)
    news_stmt = select(MarketNews).order_by(MarketNews.created_at.desc()).limit(20)
    news_result = await db.execute(news_stmt)
    recent_news = news_result.scalars().all()

    now = datetime.utcnow()
    news_lines = []
    for n in recent_news:
        age_min = int((now - n.created_at).total_seconds() / 60)
        news_lines.append(f"[T-{age_min}] {n.headline}")
    news_context = "\n".join(news_lines) if news_lines else "No recent news."

    # Gather competitor prices (top 10 by market cap)
    competitors_stmt = (
        select(Team)
        .where(Team.status.in_([TeamStatus.ACTIVE, TeamStatus.COOLDOWN]))
        .where(Team.id != team.id)
        .order_by((Team.stock_price * Team.shares_outstanding).desc())
        .limit(10)
    )
    competitors_result = await db.execute(competitors_stmt)
    competitors = competitors_result.scalars().all()

    comp_lines = []
    for c in competitors:
        comp_lines.append(f"  {c.ticker}: ${c.stock_price}")
    comp_context = "\n".join(comp_lines) if comp_lines else "No competitors."

    # Gather team's current holdings
    holdings_stmt = select(StockHolding).where(
        StockHolding.owner_team_id == team.id,
        StockHolding.shares_owned > 0,
    )
    holdings_result = await db.execute(holdings_stmt)
    holdings = holdings_result.scalars().all()

    hold_lines = []
    for h in holdings:
        target = await db.get(Team, h.target_team_id)
        if target:
            hold_lines.append(f"  {target.ticker}: {h.shares_owned} shares @ ${target.stock_price}")
    holdings_context = "\n".join(hold_lines) if hold_lines else "No external holdings."

    system_prompt = f"""You are the Board of Directors for {team.name} (ticker: {team.ticker}).

The company's strategic profile:
- Strengths: {team.swot_strengths or "None defined"}
- Weaknesses: {team.swot_weaknesses or "None defined"}
- Opportunities: {team.swot_opportunities or "None defined"}
- Threats: {team.swot_threats or "None defined"}

Current financial state:
- Cash: ${team.cash:,.2f}
- Stock Price: ${team.stock_price}
- Public Float: {team.public_float:,} shares

Recent Market News:
{news_context}

Competitor Prices (Top 10 by Market Cap):
{comp_context}

Current Holdings:
{holdings_context}

Evaluate the following strategic directive. Return JSON with:
- extraction_confidence (0.0-1.0): How clear is the strategy?
- consistency_score (0.0-1.0): Does this align with SWOT profile?
- macro_sensitivity_score (0.0-1.0): Does this respond to market news?
- aggression_score (0.0-1.0): How bold is this strategy?
- innovation_score (0.0-1.0): How novel is this approach?
- vibe_multiplier: Derived from consistency and macro sensitivity
- board_feedback: Narrative critique (1-2 sentences)
- news_headline: Public headline summarizing this action (brief, 1 sentence)
- financial_impact: {{
    "cash_delta": number,
    "revenue_delta": number,
    "net_profit_delta": number,
    "marketing_cost": number,
    "rd_spend": number
}}
"""

    user_prompt = directive.content

    if not GROK_API_KEY:
        # No API key configured — return deterministic stub
        return {
            "extraction_confidence": 0.8,
            "consistency_score": 0.7,
            "macro_sensitivity_score": 0.6,
            "aggression_score": 0.6,
            "innovation_score": 0.5,
            "vibe_multiplier": 0.5 + (0.5 * 0.7 * 0.6),
            "board_feedback": "Directive received and logged.",
            "news_headline": f"{team.ticker} submits strategic directive.",
            "financial_impact": {
                "revenue_delta": 0,
                "cost_delta": 0,
                "marketing_spend": 0,
                "rd_spend": 0,
                "net_profit_delta": 0,
            },
        }

    gs = await db.get(GameState, 1)
    model = gs.llm_model if gs else "grok-3-mini"
    max_tokens = gs.llm_max_tokens if gs else 2000
    temperature = gs.llm_temperature if gs else 0.7

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{GROK_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {GROK_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "response_format": {"type": "json_object"},
                "max_tokens": max_tokens,
                "temperature": temperature,
            },
            timeout=30.0,
        )
        result = response.json()
        content = result["choices"][0]["message"]["content"]
        return json.loads(content)


async def apply_financial_impact(db: AsyncSession, team: Team, directive: Directive):
    """Apply financial changes from directive evaluation."""
    if directive.execution_penalty == 0:
        return

    impact = json.loads(directive.financial_impact or "{}")
    penalty = directive.execution_penalty

    # Prefer cash_delta if present (new spec), otherwise compute from components
    if "cash_delta" in impact and impact["cash_delta"]:
        cash_change = (impact["cash_delta"] or 0) * penalty
    else:
        net_profit = (impact.get("net_profit_delta", 0) or 0) * penalty
        marketing = (impact.get("marketing_cost", 0) or impact.get("marketing_spend", 0) or 0) * penalty
        rd = (impact.get("rd_spend", 0) or 0) * penalty
        cash_change = net_profit - marketing - rd

    team.cash += Decimal(str(cash_change))

    await db.flush()

    ledger = CashLedger(
        team_id=team.id,
        entry_type="DIRECTIVE_REVENUE" if cash_change >= 0 else "DIRECTIVE_COST",
        amount=Decimal(str(cash_change)),
        balance_after=team.cash,
        reference_type="DIRECTIVE",
        reference_id=directive.id,
        description=f"Directive profit/loss: ${cash_change:,.2f}",
    )
    db.add(ledger)


async def generate_public_news(db: AsyncSession, directive: Directive, team: Team):
    """Generate public news headline for the directive."""
    if not directive.news_headline:
        return

    news = MarketNews(
        headline=directive.news_headline,
        source_type="TEAM_ACTION",
        source_team_id=team.id,
    )
    db.add(news)
    await db.commit()
    # TODO: Broadcast news via Redis pub/sub (worker runs in separate process from FastAPI)


@celery_app.task
def start_directive_cooldown(team_id: str):
    """Start cooldown timer for a team after directive submission."""
    asyncio.run(_start_directive_cooldown_async(team_id))


async def _start_directive_cooldown_async(team_id: str):
    async with AsyncSessionLocal() as db:
        team = await db.get(Team, uuid.UUID(team_id))
        if not team:
            return

        gs = await db.get(GameState, 1)
        cooldown_minutes = gs.cooldown_minutes if gs else 10

        team.status = TeamStatus.COOLDOWN
        team.cooldown_until = datetime.utcnow() + timedelta(minutes=cooldown_minutes)
        await db.commit()
