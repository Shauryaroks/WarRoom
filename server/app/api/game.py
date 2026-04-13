from datetime import datetime, timezone
from typing import Optional
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, and_, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import verify_admin_key, get_current_team
from app.database import get_db
from app.models import (
    Directive,
    GameState,
    GameStatus,
    StockHolding,
    Team,
    TeamStatus,
)

from app.websocket import manager

router = APIRouter(prefix="/game", tags=["game"])


def _build_game_state_payload(gs):
    """Build a game_state dict for WebSocket broadcast."""
    now = datetime.utcnow()
    return {
        "status": gs.status.value,
        "server_time": now.isoformat(),
        "started_at": gs.started_at.isoformat() if gs.started_at else None,
        "elapsed_seconds": int((now - gs.started_at).total_seconds())
        if gs.started_at
        else None,
        "next_purge_at": gs.next_purge_at.isoformat()
        if getattr(gs, "next_purge_at", None)
        else None,
        "current_round": gs.current_round,
        "teams_remaining": gs.teams_remaining,
        "total_llm_cost_usd": float(gs.total_llm_cost or 0),
        "llm_queue_depth": gs.llm_queue_depth or 0,
    }


class GameStateResponse(BaseModel):
    status: str
    server_time: str
    started_at: Optional[str]
    elapsed_seconds: Optional[int]
    next_purge_at: Optional[str]
    current_round: int
    teams_remaining: int
    total_llm_cost_usd: float
    llm_queue_depth: int


@router.get("/state", response_model=GameStateResponse)
async def get_game_state(
    db: AsyncSession = Depends(get_db),
):
    gs = await db.get(GameState, 1)

    if not gs:
        gs = GameState(id=1)
        db.add(gs)
        await db.commit()

    stmt = select(func.count(Team.id)).where(
        Team.status.in_([TeamStatus.ACTIVE, TeamStatus.COOLDOWN])
    )
    result = await db.execute(stmt)
    teams_remaining = result.scalar() or 0

    now = datetime.utcnow()
    elapsed_seconds = None
    if gs.started_at:
        elapsed_seconds = int((now - gs.started_at).total_seconds())

    next_purge = gs.next_purge_at.isoformat() if gs.next_purge_at else None

    return GameStateResponse(
        status=gs.status.value,
        server_time=now.isoformat(),
        started_at=gs.started_at.isoformat() if gs.started_at else None,
        elapsed_seconds=elapsed_seconds,
        next_purge_at=next_purge,
        current_round=gs.current_round,
        teams_remaining=teams_remaining,
        total_llm_cost_usd=float(gs.total_llm_cost or 0),
        llm_queue_depth=gs.llm_queue_depth or 0,
    )


class StartGameRequest(BaseModel):
    scheduled_duration_hours: int = 6
    initial_news_items: Optional[list[str]] = None
    scheduled_news_items: Optional[list[dict]] = None


class GameControlResponse(BaseModel):
    message: str
    teams_activated: int


@router.post("/start", response_model=GameControlResponse)
async def start_game(
    request: StartGameRequest = None,
    admin: bool = Depends(verify_admin_key),
    db: AsyncSession = Depends(get_db),
):
    if request is None:
        request = StartGameRequest()

    gs = await db.get(GameState, 1)

    if not gs:
        gs = GameState(id=1)
        db.add(gs)

    if gs.status == GameStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Game already started",
        )

    if gs.status == GameStatus.FINISHED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Game already finished",
        )

    gs.status = GameStatus.ACTIVE
    gs.started_at = datetime.utcnow()
    gs.current_round = 0

    # Activate all PENDING teams that have been approved (have a portfolio assigned)
    stmt = select(Team).where(
        Team.status.in_([TeamStatus.PENDING, TeamStatus.READY]),
        Team.portfolio_type != None,
    )
    result = await db.execute(stmt)
    pending_teams = result.scalars().all()

    for team in pending_teams:
        team.status = TeamStatus.ACTIVE
        team.cash = gs.starting_cash or Decimal("1000000")
        team.stock_price = gs.starting_price or Decimal("100")
        team.shares_outstanding = gs.starting_shares or 1000000
        team.public_float = team.shares_outstanding // 10
        team.treasury_shares = team.shares_outstanding - team.public_float

    if request.initial_news_items:
        from app.models import MarketNews

        for headline in request.initial_news_items:
            news = MarketNews(
                headline=headline[:120],
                source_type="GLOBAL",
                source_team_id=None,
            )
            db.add(news)
    else:
        from app.models import MarketNews

        default_headlines = [
            "Markets open with cautious optimism as new trading session begins",
            "Analysts predict volatile conditions ahead for all sectors",
            "Central bank signals steady monetary policy for the quarter",
            "Global supply chain disruptions continue to impact valuations",
        ]
        for headline in default_headlines:
            news = MarketNews(
                headline=headline[:120],
                source_type="GLOBAL",
                source_team_id=None,
            )
            db.add(news)

    # Schedule future news items
    from app.worker.tasks.news import inject_scheduled_news
    from datetime import timedelta

    if request.scheduled_news_items:
        for i, item in enumerate(request.scheduled_news_items):
            delay_minutes = item.get("delay_minutes", (i + 1) * 5)
            eta = datetime.utcnow() + timedelta(minutes=delay_minutes)
            inject_scheduled_news.apply_async(
                kwargs={
                    "headline": item.get("headline", "Scheduled market update"),
                    "content": item.get("content"),
                    "source_type": item.get("source_type", "GLOBAL"),
                    "sentiment_score": item.get("sentiment_score"),
                    "affected_sectors": item.get("affected_sectors"),
                    "affected_tickers": item.get("affected_tickers"),
                },
                eta=eta,
            )
    else:
        default_future_headlines = [
            "Investor confidence rises on strong economic indicators",
            "Regulatory changes expected to reshape competitive landscape",
            "Technology sector leads early gains in mid-day trades",
            "Commodity prices stabilize after weeks of fluctuation",
            "Merger and acquisition activity expected to accelerate",
            "Market liquidity reaches new highs as participants increase",
        ]
        for i, headline in enumerate(default_future_headlines):
            eta = datetime.utcnow() + timedelta(minutes=(i + 1) * 15)
            inject_scheduled_news.apply_async(
                kwargs={
                    "headline": headline,
                    "content": None,
                    "source_type": "GLOBAL",
                    "sentiment_score": None,
                    "affected_sectors": None,
                    "affected_tickers": None,
                },
                eta=eta,
            )

    await db.commit()
    await db.refresh(gs)

    await manager.broadcast_system_event(
        "GAME_STARTED",
        {
            "game_state": _build_game_state_payload(gs),
        },
    )

    return GameControlResponse(
        message="Game started",
        teams_activated=len(pending_teams),
    )


@router.post("/stop", response_model=GameControlResponse)
async def stop_game(
    admin: bool = Depends(verify_admin_key),
    db: AsyncSession = Depends(get_db),
):
    gs = await db.get(GameState, 1)

    if gs:
        gs.status = GameStatus.SETUP

    await db.commit()

    return GameControlResponse(
        message="Game stopped",
        teams_activated=0,
    )


@router.post("/pause", response_model=dict)
async def pause_game(
    admin: bool = Depends(verify_admin_key),
    db: AsyncSession = Depends(get_db),
):
    gs = await db.get(GameState, 1)

    if not gs or gs.status != GameStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Game is not active",
        )

    gs.status = GameStatus.PAUSED
    gs.paused_at = datetime.utcnow()

    await db.commit()
    await db.refresh(gs)

    await manager.broadcast_system_event(
        "GAME_PAUSED",
        {
            "game_state": _build_game_state_payload(gs),
        },
    )

    return {
        "paused_at": gs.paused_at.isoformat(),
        "will_resume_at": None,
    }


@router.post("/resume", response_model=dict)
async def resume_game(
    admin: bool = Depends(verify_admin_key),
    db: AsyncSession = Depends(get_db),
):
    gs = await db.get(GameState, 1)

    if not gs or gs.status != GameStatus.PAUSED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Game is not paused",
        )

    gs.status = GameStatus.ACTIVE
    gs.resumed_at = datetime.utcnow()
    gs.paused_at = None

    await db.commit()
    await db.refresh(gs)

    await manager.broadcast_system_event(
        "GAME_RESUMED",
        {
            "game_state": _build_game_state_payload(gs),
        },
    )

    return {"message": "Game resumed"}


@router.post("/end", response_model=dict)
async def end_game(
    admin: bool = Depends(verify_admin_key),
    db: AsyncSession = Depends(get_db),
):
    gs = await db.get(GameState, 1)

    if gs:
        gs.status = GameStatus.FINISHED
        gs.finished_at = datetime.utcnow()

    await db.commit()

    if gs:
        await db.refresh(gs)
        await manager.broadcast_system_event(
            "GAME_ENDED",
            {
                "game_state": _build_game_state_payload(gs),
            },
        )

    return {"message": "Game ended, scores locked"}


# --- Purge ---


class PurgeRequest(BaseModel):
    confirmation: str = Field(..., pattern=r"^PURGE$")
    force: bool = False


class PurgeResponse(BaseModel):
    purge_id: str
    status: str
    eliminated_teams: list[str]
    surviving_teams: int
    new_treasury_limits: float


async def _calculate_raw_scores(db: AsyncSession, team: Team) -> tuple[float, float]:
    """Calculate raw market cap and liquidity for a team.
    Returns (market_cap, liquidity).
    Liquidity = Cash + (Portfolio Value * 0.5)
    """
    market_cap = float(team.stock_price * team.shares_outstanding)

    # Calculate portfolio value
    stmt = select(StockHolding).where(
        and_(
            StockHolding.owner_team_id == team.id,
            StockHolding.shares_owned > 0,
        )
    )
    result = await db.execute(stmt)
    holdings = result.scalars().all()

    portfolio_value = 0.0
    for h in holdings:
        target = await db.get(Team, h.target_team_id)
        if target and target.status != TeamStatus.ELIMINATED:
            portfolio_value += float(h.shares_owned * target.stock_price)

    liquidity = float(team.cash) + (portfolio_value * 0.5)
    return market_cap, liquidity


@router.post("/purge", response_model=PurgeResponse)
async def initiate_market_purge(
    request: PurgeRequest,
    admin: bool = Depends(verify_admin_key),
    db: AsyncSession = Depends(get_db),
):
    import uuid

    gs = await db.get(GameState, 1)
    if not gs:
        gs = GameState(id=1)
        db.add(gs)
        await db.commit()
        gs = await db.get(GameState, 1)

    # Get active teams
    stmt = select(Team).where(Team.status.in_([TeamStatus.ACTIVE, TeamStatus.COOLDOWN]))
    result = await db.execute(stmt)
    active_teams = result.scalars().all()

    min_teams = gs.purge_min_teams if gs else 6
    if len(active_teams) <= min_teams and not request.force:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot purge to fewer than 3 teams without force flag",
        )

    # Check for pending directives
    pending_directives = select(func.count(Directive.id)).where(
        Directive.status == "PROCESSING"
    )
    pd_result = await db.execute(pending_directives)
    pending_count = pd_result.scalar() or 0

    if pending_count > 0 and not request.force:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{pending_count} directives still processing",
        )

    # Calculate raw scores for all teams
    team_data = []  # (team, market_cap, liquidity)
    for team in active_teams:
        mc, liq = await _calculate_raw_scores(db, team)
        team_data.append((team, mc, liq))

    # Record aggregate market cap at purge time
    total_mc = sum(mc for _, mc, _ in team_data)
    gs.aggregate_market_cap_at_purge = Decimal(str(total_mc))

    # Use pure market cap for purges
    scored_teams = []
    for team, mc, liq in team_data:
        scored_teams.append((team, mc))

    # Sort by market cap descending (highest = best)
    scored_teams.sort(key=lambda x: x[1], reverse=True)

    num_to_eliminate = len(scored_teams) // 2
    eliminated_ids = []

    # Eliminate bottom half
    for i in range(len(scored_teams) - num_to_eliminate, len(scored_teams)):
        team, score = scored_teams[i]
        team.status = TeamStatus.ELIMINATED
        team.eliminated_at = datetime.utcnow()
        team.elimination_reason = "PURGE_BOTTOM_HALF"
        team.rank_at_elimination = i + 1
        team.stock_price = Decimal("0")
        eliminated_ids.append(team.ticker)

        # Zero out holdings of eliminated team
        holdings_stmt = select(StockHolding).where(
            StockHolding.target_team_id == team.id
        )
        holdings_result = await db.execute(holdings_stmt)
        affected_holdings = holdings_result.scalars().all()
        for h in affected_holdings:
            h.shares_owned = 0

    gs.current_round += 1
    gs.last_purge_at = datetime.utcnow()

    survivor_count = len(scored_teams) - num_to_eliminate

    # TODO: Make treasury limit progression configurable
    new_treasury_limit = 10.0
    if gs.current_round == 1:
        new_treasury_limit = 20.0
    elif gs.current_round >= 2:
        new_treasury_limit = 30.0

    # Update survivors' treasury limits
    surviving_stmt = select(Team).where(
        Team.status.in_([TeamStatus.ACTIVE, TeamStatus.COOLDOWN])
    )
    surviving_result = await db.execute(surviving_stmt)
    survivors = surviving_result.scalars().all()

    for team in survivors:
        team.dilution_cap_percent = int(new_treasury_limit)

    gs.teams_remaining = survivor_count

    await db.commit()
    await db.refresh(gs)

    game_state_payload = _build_game_state_payload(gs)
    # Override teams_remaining with the freshly computed count
    game_state_payload["teams_remaining"] = survivor_count

    await manager.broadcast_system_event(
        "PURGE_COMPLETE",
        {
            "event_type": "PURGE_COMPLETE",
            "message": f"Market Purge Complete. {survivor_count} teams remain.",
            "eliminated_tickers": eliminated_ids,
            "survivor_count": survivor_count,
            "new_treasury_limits": new_treasury_limit,
            "game_state": game_state_payload,
        },
    )

    return PurgeResponse(
        purge_id=str(uuid.uuid4()),
        status="COMPLETED",
        eliminated_teams=eliminated_ids,
        surviving_teams=survivor_count,
        new_treasury_limits=new_treasury_limit,
    )
