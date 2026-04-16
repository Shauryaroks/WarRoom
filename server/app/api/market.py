"""Market data API endpoints: company listings and price history.

Provides market overview and chart backfill data for all active teams.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import require_team
from app.database import get_db
from app.models import PriceHistory, Team, TeamStatus

router = APIRouter(prefix="/api/v1/market", tags=["market"])


# --- Pydantic Models ---


class CompanyInfo(BaseModel):
    team_id: str
    name: str
    ticker: str
    stock_price: str
    market_cap: str
    status: str


class PricePoint(BaseModel):
    price: str
    market_cap: str
    calculated_at: str


# --- Endpoints ---


@router.get("/companies")
async def get_all_companies(
    current_user: dict = Depends(require_team),
    db: AsyncSession = Depends(get_db),
) -> list[CompanyInfo]:
    """Get all active companies with current prices."""
    result = await db.execute(
        select(Team).where(
            Team.status.in_([TeamStatus.ACTIVE, TeamStatus.READY, TeamStatus.COOLDOWN])
        )
    )
    teams = result.scalars().all()

    return [
        CompanyInfo(
            team_id=str(t.id),
            name=t.name,
            ticker=t.ticker,
            stock_price=str(t.stock_price),
            market_cap=str(t.stock_price * t.shares_outstanding),
            status=t.status.value,
        )
        for t in teams
    ]


@router.get("/prices/{team_id}")
async def get_price_history(
    team_id: str,
    current_user: dict = Depends(require_team),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=100, ge=1, le=1000),
) -> list[PricePoint]:
    """Get price history for a team (for chart backfill).

    Returns most recent prices first, limited by query param.
    """
    import uuid

    try:
        tid = uuid.UUID(team_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid team_id format")

    result = await db.execute(
        select(PriceHistory)
        .where(PriceHistory.team_id == tid)
        .order_by(PriceHistory.calculated_at.desc())
        .limit(limit)
    )
    prices = result.scalars().all()

    return [
        PricePoint(
            price=str(p.price),
            market_cap=str(p.market_cap),
            calculated_at=p.calculated_at.isoformat(),
        )
        for p in prices
    ]
