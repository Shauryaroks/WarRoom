"""Team-facing game info endpoints.

Provides game phase and budget information to team clients.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import require_team
from app.database import get_db
from app.schemas.decisions import BudgetResponse, GamePhaseResponse
from app.services.game_service import get_game_state_readonly, get_operating_budget

router = APIRouter(prefix="/api/v1/game", tags=["game"])


@router.get("/phase", response_model=GamePhaseResponse)
async def get_game_phase(
    current_user: dict = Depends(require_team),
    db: AsyncSession = Depends(get_db),
):
    """Get current game phase (team-facing)."""
    state = await get_game_state_readonly(db)
    return GamePhaseResponse(
        game_phase=state.game_phase,
        macro_brief=state.macro_brief
        if getattr(state, "game_phase", None) == "war_room"
        else None,
        current_round=state.current_round,
    )


@router.get("/budget", response_model=BudgetResponse)
async def get_budget(
    current_user: dict = Depends(require_team),
    db: AsyncSession = Depends(get_db),
):
    """Get team operating budget with allocated/remaining (D-10)."""
    try:
        budget = await get_operating_budget(db, current_user["team_id"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return BudgetResponse(**budget)
