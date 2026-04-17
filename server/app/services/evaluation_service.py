"""Evaluation service: prompt building, evaluation lifecycle, approval logic.

Orchestrates the full evaluation flow:
  submit -> build_prompt -> LLM call -> save_evaluation (PENDING_APPROVAL)
  -> approve_evaluation (writes target_price, publishes news)
  -> or reject_evaluation (marks REJECTED)

Per D-05: Full context prompt with company profile, solution, competitors, news.
Per D-11: Approved evaluation writes target_price/ticks_to_target to Team.
Per T-05-04: approve_evaluation checks PENDING_APPROVAL to prevent double-approval.
"""

import json
import logging
import uuid
from decimal import Decimal
from datetime import datetime, timezone

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Evaluation,
    EvaluationStatus,
    MarketNews,
    Solution,
    SolutionType,
    Team,
    TeamStatus,
    utc_now,
)

logger = logging.getLogger(__name__)


async def build_prompt(db: AsyncSession, solution_id: uuid.UUID) -> list[dict]:
    """Build the full LLM evaluation prompt with context per D-05.

    Sections: [COMPANY PROFILE], [STRATEGIC SOLUTION] or [STRATEGY MICROTWEAK],
    [COMPETITOR ACTIONS], [MARKET NEWS], [SCORING CRITERIA].

    Args:
        db: Async database session.
        solution_id: UUID of the solution to evaluate.

    Returns:
        Messages list for OpenRouter API call.

    Raises:
        ValueError: If solution not found.
    """
    # Load solution with team
    result = await db.execute(
        select(Solution)
        .options(selectinload(Solution.team))
        .where(Solution.id == solution_id)
    )
    solution = result.scalar_one_or_none()
    if solution is None:
        raise ValueError(f"Solution {solution_id} not found")

    team = solution.team

    # Load competitor summaries: active teams with their latest approved evaluation
    competitor_result = await db.execute(
        select(Team).where(
            Team.status == TeamStatus.ACTIVE,
            Team.id != team.id,
        )
    )
    competitors = competitor_result.scalars().all()

    competitor_summaries = []
    for comp in competitors:
        # Get latest approved evaluation for this competitor
        eval_result = await db.execute(
            select(Evaluation)
            .where(
                Evaluation.team_id == comp.id,
                Evaluation.status == EvaluationStatus.APPROVED,
            )
            .order_by(desc(Evaluation.created_at))
            .limit(1)
        )
        latest_eval = eval_result.scalar_one_or_none()

        summary = f"- {comp.ticker}"
        if latest_eval:
            summary += f" (score: {latest_eval.overall_score:.2f})"
            if latest_eval.news_headline:
                summary += f" - Latest: {latest_eval.news_headline}"
        competitor_summaries.append(summary)

    # Load recent market news (last 10)
    news_result = await db.execute(
        select(MarketNews).order_by(desc(MarketNews.created_at)).limit(10)
    )
    recent_news = news_result.scalars().all()

    # Build sections
    company_profile = f"""[COMPANY PROFILE]
Company: {team.company_display_name or team.name}
Ticker: {team.ticker}
Current Stock Price: ${team.stock_price}
Cash: ${team.cash}
Market Cap: ${team.stock_price * team.shares_outstanding}
"""
    if team.caseline_document:
        company_profile += f"\nCaseline:\n{team.caseline_document}\n"

    # Solution section
    if solution.solution_type == SolutionType.MICROTWEAK:
        solution_section = f"[STRATEGY MICROTWEAK]\n{solution.content}"
    else:
        solution_section = f"[STRATEGIC SOLUTION]\n{solution.content}"

    # Competitor section
    if competitor_summaries:
        competitor_section = "[COMPETITOR ACTIONS]\n" + "\n".join(competitor_summaries)
    else:
        competitor_section = "[COMPETITOR ACTIONS]\nNo competitor data available."

    # News section
    if recent_news:
        news_items = [f"- {n.headline}" for n in recent_news]
        news_section = "[MARKET NEWS]\n" + "\n".join(news_items)
    else:
        news_section = "[MARKET NEWS]\nNo recent news."

    scoring_section = """[SCORING CRITERIA]
Evaluate the strategic solution on these dimensions (0.0 to 1.0):
- strategic_quality: How well does the solution address the company's challenges?
- feasibility: How realistic and implementable is the solution?
- innovation: How creative and differentiated is the approach?
- market_awareness: How well does it account for competitors and market conditions?
- overall_score: Holistic assessment (not necessarily an average)

Also provide:
- price_timeline: 3-month projected price trajectory as percentage changes
- news_article: A market news article summarizing the evaluation (headline max 120 chars, body, sentiment -1.0 to 1.0)"""

    system_prompt = (
        "You are an expert business analyst evaluating strategic solutions "
        "for a simulated case competition. Evaluate the submitted solution "
        "in the context of the company profile, competitor actions, and "
        "current market conditions. Provide scoring metrics, a price "
        "trajectory, and a news article. Be fair but rigorous."
    )

    user_content = "\n\n".join(
        [
            company_profile,
            solution_section,
            competitor_section,
            news_section,
            scoring_section,
        ]
    )

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]


async def save_evaluation(
    db: AsyncSession,
    solution_id: uuid.UUID,
    llm_output: dict,
    metadata: dict,
) -> Evaluation:
    """Save LLM evaluation output as PENDING_APPROVAL record.

    Args:
        db: Async database session.
        solution_id: UUID of the evaluated solution.
        llm_output: Parsed LLM output conforming to EVALUATION_SCHEMA.
        metadata: Dict with model, latency_ms, etc.

    Returns:
        The created Evaluation record.
    """
    # Load solution to get team_id
    result = await db.execute(select(Solution).where(Solution.id == solution_id))
    solution = result.scalar_one_or_none()
    if solution is None:
        raise ValueError(f"Solution {solution_id} not found")

    scoring = llm_output["scoring_metrics"]
    news = llm_output["news_article"]

    evaluation = Evaluation(
        solution_id=solution.id,
        team_id=solution.team_id,
        status=EvaluationStatus.PENDING_APPROVAL,
        scoring_metrics=json.dumps(scoring),
        overall_score=scoring["overall_score"],
        price_timeline=json.dumps(llm_output["price_timeline"]),
        news_headline=news["headline"][:120],
        news_body=news["body"],
        news_sentiment=Decimal(str(news["sentiment"])),
        llm_model=metadata.get("model"),
        llm_latency_ms=metadata.get("latency_ms"),
    )
    db.add(evaluation)
    await db.flush()

    return evaluation


async def approve_evaluation(db: AsyncSession, evaluation_id: uuid.UUID) -> dict:
    """Approve an evaluation: write target_price to Team, publish news.

    Per D-11: Converts price_timeline to target_price/ticks_to_target.
    Per T-05-04: Checks PENDING_APPROVAL to prevent double-approval.

    Args:
        db: Async database session.
        evaluation_id: UUID of the evaluation to approve.

    Returns:
        Dict with team_id, target_price, news_id, ticker.

    Raises:
        ValueError: If evaluation not found or not in PENDING_APPROVAL status.
    """
    result = await db.execute(select(Evaluation).where(Evaluation.id == evaluation_id))
    evaluation = result.scalar_one_or_none()
    if evaluation is None:
        raise ValueError(f"Evaluation {evaluation_id} not found")
    if evaluation.status != EvaluationStatus.PENDING_APPROVAL:
        raise ValueError(
            f"Evaluation {evaluation_id} is {evaluation.status.value}, "
            f"expected PENDING_APPROVAL"
        )

    # Load team
    team_result = await db.execute(select(Team).where(Team.id == evaluation.team_id))
    team = team_result.scalar_one()

    # Phase 9 D-28: Approve no longer writes target_price; price is driven by
    # fundamental_evaluations pipeline. Solution quality narrative/news only.
    # Keep the timeline parsing for reporting but DO NOT mutate team price fields.
    timeline = json.loads(evaluation.price_timeline)
    final_change_pct = sum(entry["price_change_pct"] for entry in timeline)
    target_price = round(team.stock_price * Decimal(str(1 + final_change_pct / 100)), 2)

    # Create MarketNews from LLM output
    news = MarketNews(
        headline=evaluation.news_headline,
        content=evaluation.news_body,
        source_type="LLM_EVALUATION",
        source_team_id=team.id,
        sentiment_score=evaluation.news_sentiment,
        affected_tickers=json.dumps([team.ticker]),
    )
    db.add(news)
    await db.flush()

    # Mark evaluation as approved
    evaluation.status = EvaluationStatus.APPROVED
    evaluation.approved_at = datetime.now(timezone.utc)

    return {
        "team_id": str(team.id),
        "target_price": str(target_price),
        "news_id": str(news.id),
        "ticker": team.ticker,
    }


async def reject_evaluation(
    db: AsyncSession,
    evaluation_id: uuid.UUID,
    admin_notes: str = "",
) -> dict:
    """Reject an evaluation.

    Args:
        db: Async database session.
        evaluation_id: UUID of the evaluation to reject.
        admin_notes: Optional admin notes for the rejection.

    Returns:
        Dict with evaluation_id, team_id.

    Raises:
        ValueError: If evaluation not found or not in PENDING_APPROVAL status.
    """
    result = await db.execute(select(Evaluation).where(Evaluation.id == evaluation_id))
    evaluation = result.scalar_one_or_none()
    if evaluation is None:
        raise ValueError(f"Evaluation {evaluation_id} not found")
    if evaluation.status != EvaluationStatus.PENDING_APPROVAL:
        raise ValueError(
            f"Evaluation {evaluation_id} is {evaluation.status.value}, "
            f"expected PENDING_APPROVAL"
        )

    evaluation.status = EvaluationStatus.REJECTED
    evaluation.rejected_at = datetime.now(timezone.utc)
    evaluation.admin_notes = admin_notes

    return {
        "evaluation_id": str(evaluation.id),
        "team_id": str(evaluation.team_id),
    }
