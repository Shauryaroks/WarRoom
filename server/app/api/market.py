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


class LeaderboardEntry(BaseModel):
    rank: int
    team_id: str
    name: str
    ticker: str
    stock_price: str
    change_pct: str
    status: str


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


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
async def get_leaderboard(
    db: AsyncSession = Depends(get_db),
) -> list[LeaderboardEntry]:
    """Get leaderboard: teams ranked by stock_price descending (D-11).

    Public endpoint -- no auth required. Includes active, cooldown, and eliminated teams.
    Eliminated teams appear at bottom with stock_price=0.
    """
    from sqlalchemy import case

    result = await db.execute(
        select(Team)
        .where(Team.status.in_([TeamStatus.READY, TeamStatus.ACTIVE, TeamStatus.COOLDOWN, TeamStatus.BANKRUPT, TeamStatus.ELIMINATED]))
        .order_by(
            # Active/cooldown teams first, eliminated last
            case(
                (Team.status == TeamStatus.ELIMINATED, 1),
                else_=0,
            ),
            Team.stock_price.desc(),
        )
    )
    teams = result.scalars().all()

    entries = []
    for rank_idx, team in enumerate(teams, start=1):
        # Compute change_pct from latest two PriceHistory entries
        change_pct = "0.00"
        price_result = await db.execute(
            select(PriceHistory)
            .where(PriceHistory.team_id == team.id)
            .order_by(PriceHistory.calculated_at.desc())
            .limit(2)
        )
        recent_prices = price_result.scalars().all()
        if len(recent_prices) >= 2:
            current_p = recent_prices[0].price
            previous_p = recent_prices[1].price
            if previous_p and previous_p > 0:
                pct = ((current_p - previous_p) / previous_p) * 100
                change_pct = f"{pct:.2f}"

        entries.append(LeaderboardEntry(
            rank=rank_idx,
            team_id=str(team.id),
            name=team.name,
            ticker=team.ticker,
            stock_price=str(team.stock_price),
            change_pct=change_pct,
            status=team.status.value,
        ))

    return entries
