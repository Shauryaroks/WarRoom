import json
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import verify_admin_key
from app.database import get_db
from app.models import (
    CashLedger,
    Directive,
    GameState,
    MarketNews,
    StockHolding,
    Team,
    TeamStatus,
    Transaction,
)

router = APIRouter(prefix="/admin", tags=["admin"])


# --- GET /admin/metrics ---


@router.get("/metrics")
async def get_admin_metrics(
    admin: bool = Depends(verify_admin_key),
    db: AsyncSession = Depends(get_db),
):
    """Real-time system metrics for admin dashboard."""
    # Team counts by status
    all_teams_stmt = select(Team)
    all_teams_result = await db.execute(all_teams_stmt)
    all_teams = all_teams_result.scalars().all()

    teams_by_status = {}
    for t in all_teams:
        status_val = t.status.value
        teams_by_status[status_val] = teams_by_status.get(status_val, 0) + 1

    active_teams = [
        t for t in all_teams if t.status in [TeamStatus.ACTIVE, TeamStatus.COOLDOWN]
    ]

    aggregate_liquidity = 0.0
    total_market_cap = 0.0
    for t in active_teams:
        cap = float(t.stock_price * t.shares_outstanding)
        total_market_cap += cap
        aggregate_liquidity += float(t.cash)

    avg_market_cap = total_market_cap / len(active_teams) if active_teams else 0.0

    gs = await db.get(GameState, 1)

    # Calculate market cap change since last purge
    market_cap_change = 0.0
    if gs and gs.aggregate_market_cap_at_purge and gs.aggregate_market_cap_at_purge > 0:
        change = total_market_cap - float(gs.aggregate_market_cap_at_purge)
        market_cap_change = (change / float(gs.aggregate_market_cap_at_purge)) * 100

    return {
        "active_teams": len(active_teams),
        "total_teams": len(all_teams),
        "teams_by_status": teams_by_status,
        "aggregate_liquidity": aggregate_liquidity,
        "avg_market_cap": avg_market_cap,
        "market_cap_change_24h": market_cap_change,
        "llm_queue_depth": gs.llm_queue_depth if gs else 0,
        "session_cost_usd": float(gs.total_llm_cost) if gs else 0.0,
    }


# --- GET /admin/llm-stats ---


@router.get("/llm-stats")
async def get_llm_stats(
    admin: bool = Depends(verify_admin_key),
    db: AsyncSession = Depends(get_db),
):
    """LLM performance and cost breakdown."""
    total_directives = await db.scalar(select(func.count(Directive.id)))
    completed = await db.scalar(
        select(func.count(Directive.id)).where(Directive.status == "COMPLETED")
    )
    failed = await db.scalar(
        select(func.count(Directive.id)).where(Directive.status == "FAILED")
    )

    # Average latency from completed directives with latency data
    avg_lat = await db.scalar(
        select(func.avg(Directive.latency_ms)).where(
            Directive.latency_ms != None,
            Directive.status == "COMPLETED",
        )
    )

    # Total cost from directive-level tracking
    total_directive_cost = await db.scalar(
        select(func.sum(Directive.estimated_cost)).where(
            Directive.estimated_cost != None
        )
    )

    gs = await db.get(GameState, 1)

    gs_cost = float(gs.total_llm_cost) if gs else 0.0
    total_cost = (
        gs_cost
        if gs_cost > 0
        else (float(total_directive_cost) if total_directive_cost else 0.0)
    )
    avg_latency = int(avg_lat) if avg_lat else 0

    return {
        "total_requests": total_directives or 0,
        "total_cost_usd": total_cost,
        "avg_latency_ms": avg_latency,
        "error_rate": float(failed / total_directives) if total_directives else 0.0,
        "by_model": [
            {
                "model": gs.llm_model
                if gs
                else "nvidia/nemotron-3-super-120b-a12b:free",
                "requests": total_directives or 0,
                "cost_usd": total_cost,
                "avg_latency_ms": avg_latency,
            }
        ],
    }


# --- GET /admin/market-stats ---


@router.get("/market-stats")
async def get_market_stats(
    admin: bool = Depends(verify_admin_key),
    db: AsyncSession = Depends(get_db),
):
    """Trading and market health metrics."""
    total_trades = await db.scalar(select(func.count(Transaction.id))) or 0

    one_hour_ago = datetime.utcnow() - timedelta(hours=1)
    trades_last_hour = (
        await db.scalar(
            select(func.count(Transaction.id)).where(
                Transaction.executed_at >= one_hour_ago
            )
        )
        or 0
    )

    gs = await db.get(GameState, 1)

    # Volume by ticker since last purge (or all time if no purge)
    vol_cutoff = gs.last_purge_at if gs and gs.last_purge_at else None

    vol_stmt = select(
        Team.ticker,
        func.sum(Transaction.shares),
    ).join(Team, Transaction.target_team_id == Team.id)

    if vol_cutoff:
        vol_stmt = vol_stmt.where(Transaction.executed_at >= vol_cutoff)

    vol_stmt = vol_stmt.group_by(Team.ticker)

    vol_result = await db.execute(vol_stmt)
    volume_by_ticker = {row[0]: row[1] for row in vol_result.all()}

    return {
        "total_trades": total_trades,
        "trades_last_hour": trades_last_hour,
        "volume_by_ticker": volume_by_ticker,
        "anomaly_alerts": [],
    }


# --- GET /admin/teams ---


@router.get("/teams")
async def list_all_teams(
    admin: bool = Depends(verify_admin_key),
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Team).order_by(desc(Team.cash))

    if status:
        try:
            status_enum = TeamStatus(status)
            stmt = stmt.where(Team.status == status_enum)
        except ValueError:
            pass

    result = await db.execute(stmt)
    teams = result.scalars().all()

    return {
        "teams": [
            {
                "id": str(t.id),
                "name": t.name,
                "ticker": t.ticker,
                "status": t.status.value,
                "cash": float(t.cash),
                "stock_price": float(t.stock_price),
                "market_cap": float(t.shares_outstanding) * float(t.stock_price),
                "portfolio_type": t.portfolio_type,
                "email": t.email,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in teams
        ]
    }


# --- GET /admin/teams/pending ---


@router.get("/teams/pending")
async def list_pending_teams(
    admin: bool = Depends(verify_admin_key),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Team).where(Team.status == TeamStatus.PENDING).order_by(Team.created_at)
    )
    result = await db.execute(stmt)
    teams = result.scalars().all()

    return {
        "teams": [
            {
                "id": str(t.id),
                "name": t.name,
                "ticker": t.ticker,
                "email": t.email,
                "created_at": t.created_at.isoformat(),
            }
            for t in teams
        ]
    }


# --- Admin settings ---


class UpdateSettingsRequest(BaseModel):
    cooldown_minutes: Optional[int] = None
    tam_per_cycle: Optional[Decimal] = None
    starting_cash: Optional[Decimal] = None
    starting_price: Optional[Decimal] = None
    starting_shares: Optional[int] = None
    llm_model: Optional[str] = None
    next_purge_at: Optional[str] = None  # ISO datetime string
    purge_min_teams: Optional[int] = None
    sentiment_map: Optional[dict] = None  # {"macro_bullish": 0.6, ...}


@router.post("/settings")
async def update_settings(
    request: UpdateSettingsRequest,
    admin: bool = Depends(verify_admin_key),
    db: AsyncSession = Depends(get_db),
):
    gs = await db.get(GameState, 1)
    if not gs:
        gs = GameState(id=1)
        db.add(gs)

    if request.cooldown_minutes is not None:
        gs.cooldown_minutes = request.cooldown_minutes
    if request.tam_per_cycle is not None:
        gs.tam_per_cycle = request.tam_per_cycle
    if request.starting_cash is not None:
        gs.starting_cash = request.starting_cash
    if request.starting_price is not None:
        gs.starting_price = request.starting_price
    if request.starting_shares is not None:
        gs.starting_shares = request.starting_shares
    if request.llm_model is not None:
        gs.llm_model = request.llm_model
    if request.next_purge_at is not None:
        gs.next_purge_at = (
            datetime.fromisoformat(request.next_purge_at)
            if request.next_purge_at
            else None
        )
    if request.purge_min_teams is not None:
        gs.purge_min_teams = request.purge_min_teams
    if request.sentiment_map is not None:
        gs.sentiment_map = json.dumps(request.sentiment_map)

    await db.commit()

    return {"message": "Settings updated"}


@router.get("/settings")
async def get_settings(
    admin: bool = Depends(verify_admin_key),
    db: AsyncSession = Depends(get_db),
):
    gs = await db.get(GameState, 1)
    if not gs:
        gs = GameState(id=1)

    return {
        "status": gs.status.value,
        "current_round": gs.current_round,
        "cooldown_minutes": gs.cooldown_minutes,
        "tam_per_cycle": float(gs.tam_per_cycle),
        "starting_cash": float(gs.starting_cash),
        "starting_price": float(gs.starting_price),
        "starting_shares": gs.starting_shares,
        "llm_model": gs.llm_model,
        "next_purge_at": gs.next_purge_at.isoformat() if gs.next_purge_at else None,
        "purge_min_teams": gs.purge_min_teams,
        "sentiment_map": json.loads(gs.sentiment_map) if gs.sentiment_map else None,
    }


# --- POST /admin/teams/{team_id}/reset ---


@router.post("/teams/{team_id}/reset")
async def reset_team(
    team_id: str,
    admin: bool = Depends(verify_admin_key),
    db: AsyncSession = Depends(get_db),
):
    import uuid

    try:
        team_uuid = uuid.UUID(team_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid team ID")

    team = await db.get(Team, team_uuid)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    gs = await db.get(GameState, 1)

    team.status = TeamStatus.ACTIVE
    team.cash = gs.starting_cash if gs else Decimal("1000000")
    team.stock_price = gs.starting_price if gs else Decimal("100")
    team.public_float = team.shares_outstanding // 10
    team.treasury_shares = team.shares_outstanding - team.public_float
    team.dilution_cap_percent = 10
    team.cooldown_until = None
    team.bankrupt_since = None
    team.bankrupt_resolved = False
    team.eliminated_at = None
    team.elimination_reason = None
    team.rank_at_elimination = None

    stmt = select(StockHolding).where(StockHolding.owner_team_id == team.id)
    result = await db.execute(stmt)
    holdings = result.scalars().all()

    for holding in holdings:
        holding.shares_owned = 0
        holding.total_cost_basis = Decimal("0")

    await db.commit()

    return {"message": "Team reset", "team_id": str(team.id)}


# --- POST /admin/news/seed ---


class SeedNewsRequest(BaseModel):
    count: int = Field(10, ge=1, le=20)


@router.post("/news/seed")
async def seed_initial_news(
    request: SeedNewsRequest,
    admin: bool = Depends(verify_admin_key),
    db: AsyncSession = Depends(get_db),
):
    existing_count = await db.scalar(
        select(func.count(MarketNews.id)).where(MarketNews.source_type == "GLOBAL")
    )

    if existing_count > 0:
        return {"message": "Global news already exists", "count": existing_count}

    headlines = [
        "Market opens with strong consumer confidence",
        "Tech sector leads gains in early trading",
        "Central bank maintains current interest rates",
        "Global supply chains show signs of improvement",
        "New regulatory framework announced for industry",
        "Major merger talks emerge in the sector",
        "Commodity prices stabilize after recent volatility",
        "Employment data exceeds expectations",
        "Inflation readings come in below forecasts",
        "Market sentiment turns bullish on earnings reports",
    ]

    for headline in headlines[: request.count]:
        news = MarketNews(
            headline=headline,
            source_type="GLOBAL",
            source_team_id=None,
        )
        db.add(news)

    await db.commit()

    return {"message": f"Seeded {min(request.count, len(headlines))} global news items"}
