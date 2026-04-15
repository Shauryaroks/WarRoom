from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Team, TeamStatus
from app.auth_utils import get_current_user

router = APIRouter(prefix="/api/v1/teams", tags=["teams"])


class ApprovedTeamItem(BaseModel):
    id: str
    name: str
    ticker: str


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
        )
        for t in teams
    ]
