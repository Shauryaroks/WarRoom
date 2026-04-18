"""Solutions API router: submission, cooldown, caseline endpoints.

Per SOLN-01: Strategist submits initial solution within 1-hour window.
Per SOLN-03: Microtweak submission with 20-minute cooldown.
Per SOLN-04: Cooldown tracked on Team.cooldown_until, auto-expires.
Per T-05-05: Role check -- only strategists can submit.
Per T-05-06: Server-side elapsed_seconds check (authoritative timer).
Per T-05-07: Pydantic max_length=50000 limits content size.
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth_utils import require_team
from app.database import get_db
from app.models import (
    Archetype,
    Evaluation,
    GameStatus,
    Solution,
    SolutionType,
    Team,
    TeamStatus,
)
from app.services.game_service import get_game_state_readonly

router = APIRouter(prefix="/api/v1/solutions", tags=["solutions"])


# --- Pydantic Models ---


class SubmitSolutionRequest(BaseModel):
    content: str = Field(min_length=10, max_length=50000)
    solution_type: str = Field(pattern=r"^(INITIAL|MICROTWEAK|CRISIS_RESPONSE)$")


class SolutionResponse(BaseModel):
    id: str
    content: str
    solution_type: str
    created_at: str
    evaluation_status: str | None


class CooldownResponse(BaseModel):
    cooldown_active: bool
    cooldown_until: str | None
    seconds_remaining: int


class CaselineResponse(BaseModel):
    caseline_document: str | None
    company_display_name: str | None
    archetype_name: str | None = None
    archetype_slug: str | None = None
    sector: str | None = None
    benchmark_bands: str | None = None


# --- Endpoints ---


@router.post("/submit", response_model=SolutionResponse)
async def submit_solution(
    request: SubmitSolutionRequest,
    current_user: dict = Depends(require_team),
    db: AsyncSession = Depends(get_db),
):
    """Submit a solution. Only strategists can submit (T-05-05).

    INITIAL: must be within 1-hour window (SOLN-01, T-05-06).
    MICROTWEAK: must not be in cooldown (SOLN-03, T-05-06).
    On MICROTWEAK: sets cooldown_until = now + 20min (SOLN-04).
    Dispatches Celery task for LLM evaluation (EVAL-01).
    """
    # T-05-05: Only strategists can submit
    if current_user["role"] != "strategist":
        raise HTTPException(
            status_code=403, detail="Only strategists can submit solutions"
        )

    # Validate game is ACTIVE (crisis responses allowed during PAUSED)
    game_state = await get_game_state_readonly(db)
    sol_type = SolutionType(request.solution_type)

    if sol_type == SolutionType.CRISIS_RESPONSE:
        # Crisis responses allowed during PAUSED state (D-04 step 5)
        if game_state.status not in (GameStatus.ACTIVE, GameStatus.PAUSED):
            raise HTTPException(status_code=409, detail="Game is not active or paused")
    else:
        if game_state.status != GameStatus.ACTIVE:
            raise HTTPException(status_code=409, detail="Game is not active")

    now = datetime.now(timezone.utc)

    # Reload team from DB to get current state
    team_result = await db.execute(
        select(Team).where(Team.id == current_user["team_id"])
    )
    team = team_result.scalar_one()

    # ELIM-03: Eliminated teams cannot submit solutions
    if team.status == TeamStatus.ELIMINATED:
        raise HTTPException(
            status_code=403, detail="Eliminated teams cannot submit solutions"
        )

    # Initial submissions no longer time-boxed — admins may accept them at any
    # point during the game. Cooldowns on MICROTWEAK remain enforced below.
    if sol_type == SolutionType.MICROTWEAK:
        # SOLN-03: Check cooldown
        if team.cooldown_until is not None and team.cooldown_until > now:
            remaining = int((team.cooldown_until - now).total_seconds())
            raise HTTPException(
                status_code=409,
                detail=f"Cooldown active. {remaining} seconds remaining.",
            )
    # CRISIS_RESPONSE: bypasses cooldown check (D-04 step 5)

    # Create Solution record
    solution = Solution(
        team_id=team.id,
        content=request.content,
        solution_type=sol_type,
    )
    db.add(solution)

    # SOLN-04: Set cooldown on MICROTWEAK
    if sol_type == SolutionType.MICROTWEAK:
        team.cooldown_until = now + timedelta(minutes=20)

    await db.commit()
    await db.refresh(solution)

    # Dispatch Celery task for LLM evaluation
    from app.worker.tasks.evaluate_solution import evaluate_solution

    evaluate_solution.delay(str(solution.id))

    return SolutionResponse(
        id=str(solution.id),
        content=solution.content,
        solution_type=solution.solution_type.value,
        created_at=solution.created_at.isoformat(),
        evaluation_status=None,  # Just created, no evaluation yet
    )


@router.get("/my-solutions", response_model=list[SolutionResponse])
async def get_my_solutions(
    current_user: dict = Depends(require_team),
    db: AsyncSession = Depends(get_db),
):
    """Get team's solutions with evaluation status."""
    result = await db.execute(
        select(Solution)
        .options(selectinload(Solution.evaluation))
        .where(Solution.team_id == current_user["team_id"])
        .order_by(Solution.created_at.desc())
    )
    solutions = result.scalars().all()

    return [
        SolutionResponse(
            id=str(s.id),
            content=s.content,
            solution_type=s.solution_type.value,
            created_at=s.created_at.isoformat(),
            evaluation_status=s.evaluation.status.value if s.evaluation else None,
        )
        for s in solutions
    ]


@router.get("/cooldown", response_model=CooldownResponse)
async def get_cooldown_status(
    current_user: dict = Depends(require_team),
    db: AsyncSession = Depends(get_db),
):
    """Get cooldown status for team (SOLN-04)."""
    team_result = await db.execute(
        select(Team).where(Team.id == current_user["team_id"])
    )
    team = team_result.scalar_one()

    now = datetime.now(timezone.utc)
    if team.cooldown_until is not None and team.cooldown_until > now:
        return CooldownResponse(
            cooldown_active=True,
            cooldown_until=team.cooldown_until.isoformat(),
            seconds_remaining=int((team.cooldown_until - now).total_seconds()),
        )

    return CooldownResponse(
        cooldown_active=False,
        cooldown_until=None,
        seconds_remaining=0,
    )


@router.get("/caseline", response_model=CaselineResponse)
async def get_caseline(
    current_user: dict = Depends(require_team),
    db: AsyncSession = Depends(get_db),
):
    """Get team's caseline document with archetype info (D-15, D-09)."""
    team_result = await db.execute(
        select(Team)
        .options(selectinload(Team.archetype))
        .where(Team.id == current_user["team_id"])
    )
    team = team_result.scalar_one()

    archetype_name = None
    archetype_slug = None
    sector = None
    benchmark_bands = None

    if team.archetype is not None:
        archetype_name = team.archetype.name
        archetype_slug = team.archetype.slug
        sector = team.archetype.sector
        benchmark_bands = team.archetype.benchmark_bands

    return CaselineResponse(
        caseline_document=team.caseline_document,
        company_display_name=team.company_display_name,
        archetype_name=archetype_name,
        archetype_slug=archetype_slug,
        sector=sector,
        benchmark_bands=benchmark_bands,
    )
