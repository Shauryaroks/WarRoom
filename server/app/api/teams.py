from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Team, TeamStatus
from app.auth_utils import get_current_user
from app.services.game_service import get_game_state_readonly, calculate_elapsed_seconds

router = APIRouter(prefix="/api/v1/teams", tags=["teams"])


class ApprovedTeamItem(BaseModel):
    id: str
    name: str
    ticker: str
    bcg_classification: str | None = None


@router.get("/approved", response_model=list[ApprovedTeamItem])
async def list_approved_teams(
    _user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all approved/active teams. Requires any authenticated user."""
    result = await db.execute(
        select(Team)
        .where(Team.status.in_([TeamStatus.READY, TeamStatus.ACTIVE]))
        .order_by(Team.name)
    )
    teams = result.scalars().all()

    return [
        ApprovedTeamItem(
            id=str(t.id),
            name=t.name,
            ticker=t.ticker,
            bcg_classification=t.bcg_classification,
        )
        for t in teams
    ]


class PublicGameStateResponse(BaseModel):
    status: str
    elapsed_seconds: int
    current_round: int


@router.get("/game-state", response_model=PublicGameStateResponse)
async def public_game_state(
    _user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get game state. Accessible to any authenticated user (not just admin)."""
    state = await get_game_state_readonly(db)
    if not state:
        return PublicGameStateResponse(
            status="SETUP", elapsed_seconds=0, current_round=0
        )
    elapsed = calculate_elapsed_seconds(state)
    return PublicGameStateResponse(
        status=state.status.value,
        elapsed_seconds=elapsed,
        current_round=state.current_round or 0,
    )
