from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.api.auth import get_current_team
from app.database import get_db
from app.models import Directive, GameState, GameStatus, Team, TeamStatus

router = APIRouter(prefix="/directives", tags=["directives"])


class SubmitDirectiveRequest(BaseModel):
    directive_markdown: str = Field(..., max_length=2000)
    player_confidence_rating: Optional[float] = Field(None, ge=0.0, le=1.0)


class SubmitDirectiveResponse(BaseModel):
    submission_id: str
    status: str
    cooldown_until: str
    seconds_remaining: int
    message: str


@router.post("", response_model=SubmitDirectiveResponse, status_code=202)
async def submit_directive(
    request: SubmitDirectiveRequest,
    team: Team = Depends(get_current_team),
    db: AsyncSession = Depends(get_db),
):
    # Must be ACTIVE (or COOLDOWN that has expired)
    if team.status not in [TeamStatus.ACTIVE, TeamStatus.COOLDOWN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot submit directives in current status",
        )

    # Check game is active
    gs = await db.get(GameState, 1)
    if not gs or gs.status != GameStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Game is not active",
        )

    # Check cooldown
    now = datetime.utcnow()
    if team.status == TeamStatus.COOLDOWN and team.cooldown_until:
        if team.cooldown_until > now:
            retry_after = int((team.cooldown_until - now).total_seconds())
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Cooldown active",
                headers={"Retry-After": str(retry_after)},
            )

    # Expired cooldown — reset to ACTIVE
    if team.status == TeamStatus.COOLDOWN:
        team.status = TeamStatus.ACTIVE

    content = request.directive_markdown.strip()
    if len(content) > 2000:
        content = content[:1997] + "..."

    directive = Directive(
        team_id=team.id,
        content=content,
        confidence_rating=request.player_confidence_rating,
        status="PENDING",
    )
    db.add(directive)
    await db.commit()
    await db.refresh(directive)

    # Set cooldown
    cooldown_minutes = gs.cooldown_minutes if gs else 10

    team.status = TeamStatus.COOLDOWN
    team.cooldown_until = now + timedelta(minutes=cooldown_minutes)
    await db.commit()

    seconds_remaining = int((team.cooldown_until - now).total_seconds())

    # Dispatch to worker
    from app.worker.tasks.directive import process_directive
    process_directive.delay(str(directive.id))

    return SubmitDirectiveResponse(
        submission_id=str(directive.id),
        status="COOLDOWN",
        cooldown_until=team.cooldown_until.isoformat(),
        seconds_remaining=seconds_remaining,
        message="Directive received. The Board is reviewing.",
    )


# --- GET /directives/history ---


class DirectiveHistoryResponse(BaseModel):
    directives: list[dict]


@router.get("/history", response_model=DirectiveHistoryResponse)
async def get_directive_history(
    limit: int = 20,
    team: Team = Depends(get_current_team),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Directive)
        .where(Directive.team_id == team.id)
        .order_by(Directive.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    directives = result.scalars().all()

    return DirectiveHistoryResponse(
        directives=[
            {
                "id": str(d.id),
                "content": d.content[:200] + "..."
                if len(d.content) > 200
                else d.content,
                "status": d.status.value if hasattr(d.status, 'value') else str(d.status),
                "board_feedback": d.board_feedback,
                "created_at": d.created_at.isoformat(),
                "completed_at": d.completed_at.isoformat() if d.completed_at else None,
                "extraction_confidence": d.extraction_confidence,
            }
            for d in directives
        ]
    )


# --- GET /directives/{id} ---


class DirectiveDetailResponse(BaseModel):
    id: str
    content: str
    status: str
    board_feedback: Optional[str]
    news_headline: Optional[str]
    extraction_confidence: Optional[float]
    consistency_score: Optional[float]
    macro_sensitivity_score: Optional[float]
    aggression_score: Optional[float]
    innovation_score: Optional[float]
    vibe_multiplier: Optional[float]
    financial_impact: Optional[dict]
    created_at: str
    completed_at: Optional[str]


@router.get("/{directive_id}", response_model=DirectiveDetailResponse)
async def get_directive(
    directive_id: str,
    team: Team = Depends(get_current_team),
    db: AsyncSession = Depends(get_db),
):
    try:
        directive_uuid = uuid.UUID(directive_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid directive ID",
        )

    directive = await db.get(Directive, directive_uuid)

    if not directive:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Directive not found",
        )

    if directive.team_id != team.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this directive",
        )

    import json

    return DirectiveDetailResponse(
        id=str(directive.id),
        content=directive.content,
        status=directive.status.value if hasattr(directive.status, 'value') else str(directive.status),
        board_feedback=directive.board_feedback,
        news_headline=directive.news_headline,
        extraction_confidence=directive.extraction_confidence,
        consistency_score=directive.consistency_score,
        macro_sensitivity_score=directive.macro_sensitivity_score,
        aggression_score=directive.aggression_score,
        innovation_score=directive.innovation_score,
        vibe_multiplier=float(directive.vibe_multiplier)
        if directive.vibe_multiplier
        else None,
        financial_impact=json.loads(directive.financial_impact)
        if directive.financial_impact
        else None,
        created_at=directive.created_at.isoformat(),
        completed_at=directive.completed_at.isoformat()
        if directive.completed_at
        else None,
    )
