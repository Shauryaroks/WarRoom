import json
import uuid
from datetime import datetime, timezone
from typing import Optional

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

import redis.asyncio as aioredis

from app.database import get_db, settings
from app.models import (
    ActivityEvent,
    Admin,
    CashLedger,
    Directive,
    GameState,
    GameStatus,
    MarketNews,
    PriceHistory,
    StockHolding,
    Team,
    TeamStatus,
    Transaction,
)
from app.auth_utils import create_access_token, require_admin
from app.redis_pubsub import publish_broadcast
from app.services.game_service import (
    REDIS_GAME_STATUS_KEY,
    calculate_elapsed_seconds,
    get_game_state,
    get_game_state_readonly,
    transition_state,
)

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


# --- Pydantic Models ---


class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str


class AdminLoginResponse(BaseModel):
    token: str
    role: str


class AdminSeedRequest(BaseModel):
    email: EmailStr
    password: str


class AdminSeedResponse(BaseModel):
    message: str
    admin_id: str


class TeamListItem(BaseModel):
    id: str
    name: str
    ticker: str
    status: str
    strategist_email: str
    trader_email: str
    created_at: str


class TeamActionResponse(BaseModel):
    message: str
    team_id: str
    new_status: str


class GameStateResponse(BaseModel):
    status: str
    elapsed_seconds: int
    current_round: int


class NewsInjectRequest(BaseModel):
    headline: str
    body: str
    news_type: str  # "GLOBAL" or "LOCAL"
    affected_tickers: list[str] = []


class NewsInjectResponse(BaseModel):
    message: str
    news_id: str


class BroadcastRequest(BaseModel):
    message: str


class BroadcastResponse(BaseModel):
    message: str
    news_id: str


class TeamRemoveResponse(BaseModel):
    message: str
    team_id: str
    remove_type: str  # "hard" or "soft"


class ActivityEventItem(BaseModel):
    id: str
    event_type: str
    actor: str
    description: str
    metadata_json: str | None
    created_at: str


class RoundAdvanceResponse(BaseModel):
    message: str
    current_round: int


class NewsHistoryItem(BaseModel):
    id: str
    headline: str
    content: str | None
    source_type: str
    affected_tickers: list[str]
    created_at: str


# --- Utility ---


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


# --- Endpoints ---


@router.post("/login", response_model=AdminLoginResponse)
async def admin_login(
    request: AdminLoginRequest, db: AsyncSession = Depends(get_db)
):
    """Admin login. Separate from team login per D-03."""
    result = await db.execute(select(Admin).where(Admin.email == request.email))
    admin = result.scalar_one_or_none()

    if not admin or not verify_password(request.password, admin.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(subject_id=admin.id, role="admin")

    return AdminLoginResponse(token=token, role="admin")


@router.post(
    "/seed",
    response_model=AdminSeedResponse,
    status_code=status.HTTP_201_CREATED,
)
async def seed_admin(
    request: AdminSeedRequest, db: AsyncSession = Depends(get_db)
):
    """Bootstrap initial admin account. Only works if no admins exist (T-03-02 mitigation)."""
    result = await db.execute(select(func.count()).select_from(Admin))
    count = result.scalar()

    if count and count > 0:
        raise HTTPException(status_code=409, detail="Admin already exists")

    admin = Admin(
        email=request.email,
        password_hash=hash_password(request.password),
    )

    db.add(admin)
    await db.commit()
    await db.refresh(admin)

    return AdminSeedResponse(
        message="Admin account created successfully",
        admin_id=str(admin.id),
    )


@router.get("/teams", response_model=list[TeamListItem])
async def list_teams(
    status_filter: Optional[str] = Query(None, alias="status"),
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all teams. Optionally filter by status. Requires admin."""
    query = select(Team).order_by(Team.created_at.desc())

    if status_filter:
        try:
            team_status = TeamStatus(status_filter)
            query = query.where(Team.status == team_status)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status: {status_filter}. Valid: {[s.value for s in TeamStatus]}",
            )

    result = await db.execute(query)
    teams = result.scalars().all()

    return [
        TeamListItem(
            id=str(t.id),
            name=t.name,
            ticker=t.ticker,
            status=t.status.value,
            strategist_email=t.strategist_email,
            trader_email=t.trader_email,
            created_at=t.created_at.isoformat(),
        )
        for t in teams
    ]


@router.post("/teams/{team_id}/approve", response_model=TeamActionResponse)
async def approve_team(
    team_id: uuid.UUID,
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Approve a pending team registration. Requires admin."""
    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()

    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    if team.status != TeamStatus.PENDING:
        raise HTTPException(status_code=409, detail="Team is not in pending status")

    team.status = TeamStatus.READY
    team.approved_at = datetime.now(timezone.utc)

    db.add(ActivityEvent(
        event_type="TEAM_APPROVED",
        actor="admin",
        description=f"Team '{team.name}' approved",
    ))
    await db.commit()

    return TeamActionResponse(
        message=f"Team '{team.name}' approved",
        team_id=str(team.id),
        new_status=TeamStatus.READY.value,
    )


@router.post("/teams/{team_id}/reject", response_model=TeamActionResponse)
async def reject_team(
    team_id: uuid.UUID,
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Reject a pending team registration. Requires admin."""
    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()

    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    if team.status != TeamStatus.PENDING:
        raise HTTPException(status_code=409, detail="Team is not in pending status")

    team.status = TeamStatus.REJECTED

    db.add(ActivityEvent(
        event_type="TEAM_REJECTED",
        actor="admin",
        description=f"Team '{team.name}' rejected",
    ))
    await db.commit()

    return TeamActionResponse(
        message=f"Team '{team.name}' rejected",
        team_id=str(team.id),
        new_status=TeamStatus.REJECTED.value,
    )


# --- Team Removal (per D-04) ---


@router.post("/teams/{team_id}/remove", response_model=TeamRemoveResponse)
async def remove_team(
    team_id: uuid.UUID,
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Remove a team. Hard delete in SETUP, soft bankrupt in ACTIVE/PAUSED."""
    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()

    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    game_state = await get_game_state_readonly(db)

    if game_state.status == GameStatus.FINISHED:
        raise HTTPException(status_code=409, detail="Cannot remove teams from a finished game")

    team_name = team.name

    if game_state.status == GameStatus.SETUP:
        # Hard delete: remove related records first to avoid FK violations
        await db.execute(delete(Directive).where(Directive.team_id == team_id))
        await db.execute(delete(StockHolding).where(StockHolding.owner_team_id == team_id))
        await db.execute(delete(StockHolding).where(StockHolding.target_team_id == team_id))
        await db.execute(delete(Transaction).where(Transaction.buyer_team_id == team_id))
        await db.execute(delete(Transaction).where(Transaction.seller_team_id == team_id))
        await db.execute(delete(Transaction).where(Transaction.target_team_id == team_id))
        await db.execute(delete(CashLedger).where(CashLedger.team_id == team_id))
        await db.execute(delete(PriceHistory).where(PriceHistory.team_id == team_id))
        await db.delete(team)
        remove_type = "hard"
    else:
        # Soft remove: mark as BANKRUPT
        team.status = TeamStatus.BANKRUPT
        team.bankrupt_since = datetime.now(timezone.utc)
        remove_type = "soft"

    db.add(ActivityEvent(
        event_type="TEAM_REMOVED",
        actor="admin",
        description=f"Team '{team_name}' removed ({remove_type} delete)",
        metadata_json=json.dumps({"team_id": str(team_id), "remove_type": remove_type}),
    ))
    await db.commit()

    await publish_broadcast({
        "type": "team_removed",
        "payload": {"team_id": str(team_id), "remove_type": remove_type},
    })

    return TeamRemoveResponse(
        message=f"Team '{team_name}' {'permanently removed' if remove_type == 'hard' else 'marked as bankrupt'}",
        team_id=str(team_id),
        remove_type=remove_type,
    )


# --- News Injection (per D-06, NEWS-01) ---


@router.post("/news/inject", response_model=NewsInjectResponse)
async def inject_news(
    request: NewsInjectRequest,
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Inject a news event. Creates MarketNews record and broadcasts via WebSocket."""
    news = MarketNews(
        headline=request.headline,
        content=request.body,
        source_type="ADMIN_INJECTED",
        affected_tickers=json.dumps(request.affected_tickers) if request.affected_tickers else None,
    )
    db.add(news)

    db.add(ActivityEvent(
        event_type="NEWS_INJECTED",
        actor="admin",
        description=f"News injected: {request.headline}",
    ))
    await db.commit()
    await db.refresh(news)

    await publish_broadcast({
        "type": "news_injected",
        "payload": {
            "id": str(news.id),
            "headline": news.headline,
            "content": news.content,
            "source_type": "ADMIN_INJECTED",
            "news_type": request.news_type,
            "affected_tickers": request.affected_tickers,
            "created_at": news.created_at.isoformat(),
        },
    })

    return NewsInjectResponse(message="News injected", news_id=str(news.id))


# --- Broadcast (per D-05: broadcasts ARE news items) ---


@router.post("/broadcast", response_model=BroadcastResponse)
async def broadcast_message(
    request: BroadcastRequest,
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Broadcast a message to all teams. Creates MarketNews with ADMIN_BROADCAST source."""
    news = MarketNews(
        headline=request.message,
        content=None,
        source_type="ADMIN_BROADCAST",
    )
    db.add(news)

    db.add(ActivityEvent(
        event_type="BROADCAST_SENT",
        actor="admin",
        description=f"Broadcast: {request.message[:80]}",
    ))
    await db.commit()
    await db.refresh(news)

    await publish_broadcast({
        "type": "news_injected",
        "payload": {
            "id": str(news.id),
            "headline": news.headline,
            "content": None,
            "source_type": "ADMIN_BROADCAST",
            "news_type": "GLOBAL",
            "affected_tickers": [],
            "created_at": news.created_at.isoformat(),
        },
    })

    return BroadcastResponse(message="Broadcast sent", news_id=str(news.id))


# --- Game Control Endpoints (per D-02: admin-only) ---


@router.post("/game/start", response_model=GameStateResponse)
async def start_game(
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Start the game (SETUP -> ACTIVE). Requires admin."""
    try:
        state = await transition_state(db, GameStatus.ACTIVE)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    db.add(ActivityEvent(
        event_type="GAME_STARTED",
        actor="admin",
        description="Game started",
    ))
    await db.commit()

    return GameStateResponse(
        status=state.status.value,
        elapsed_seconds=calculate_elapsed_seconds(state),
        current_round=state.current_round,
    )


@router.post("/game/pause", response_model=GameStateResponse)
async def pause_game(
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Pause the game (ACTIVE -> PAUSED). Requires admin."""
    try:
        state = await transition_state(db, GameStatus.PAUSED)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    db.add(ActivityEvent(
        event_type="GAME_PAUSED",
        actor="admin",
        description="Game paused",
    ))
    await db.commit()

    return GameStateResponse(
        status=state.status.value,
        elapsed_seconds=calculate_elapsed_seconds(state),
        current_round=state.current_round,
    )


@router.post("/game/resume", response_model=GameStateResponse)
async def resume_game(
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Resume the game (PAUSED -> ACTIVE). Requires admin."""
    try:
        state = await transition_state(db, GameStatus.ACTIVE)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    db.add(ActivityEvent(
        event_type="GAME_RESUMED",
        actor="admin",
        description="Game resumed",
    ))
    await db.commit()

    return GameStateResponse(
        status=state.status.value,
        elapsed_seconds=calculate_elapsed_seconds(state),
        current_round=state.current_round,
    )


@router.get("/game/state", response_model=GameStateResponse)
async def get_game_state_endpoint(
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get current game state. Requires admin."""
    state = await get_game_state_readonly(db)

    return GameStateResponse(
        status=state.status.value,
        elapsed_seconds=calculate_elapsed_seconds(state),
        current_round=state.current_round,
    )


# --- Round Advancement ---


@router.post("/game/advance-round", response_model=RoundAdvanceResponse)
async def advance_round(
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Advance to the next round. Increments GameState.current_round."""
    state = await get_game_state(db)
    state.current_round += 1

    db.add(ActivityEvent(
        event_type="ROUND_ADVANCED",
        actor="admin",
        description=f"Advanced to Q{state.current_round}",
    ))
    await db.commit()
    await db.refresh(state)

    await publish_broadcast({
        "type": "round_advanced",
        "payload": {"current_round": state.current_round},
    })

    return RoundAdvanceResponse(
        message=f"Advanced to round {state.current_round}",
        current_round=state.current_round,
    )


# --- Game Restart (destructive reset) ---


class GameRestartResponse(BaseModel):
    message: str
    status: str
    current_round: int


@router.post("/game/restart", response_model=GameRestartResponse)
async def restart_game(
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Restart the game: reset GameState to SETUP and clear all game data.

    Preserves: Team registrations (reset to READY), Admin accounts.
    Deletes: StockPrice/PriceHistory, Transactions, StockHoldings,
             Directives, MarketNews, ActivityEvents, CashLedger.
    """
    # 1. Clear game data (order matters for FK constraints)
    await db.execute(delete(Transaction))
    await db.execute(delete(StockHolding))
    await db.execute(delete(CashLedger))
    await db.execute(delete(PriceHistory))
    await db.execute(delete(Directive))
    await db.execute(delete(MarketNews))
    await db.execute(delete(ActivityEvent))

    # 2. Reset teams to READY status (preserve registrations)
    result = await db.execute(
        select(Team).where(
            Team.status.in_([
                TeamStatus.ACTIVE,
                TeamStatus.COOLDOWN,
                TeamStatus.BANKRUPT,
                TeamStatus.ELIMINATED,
                TeamStatus.READY,
            ])
        )
    )
    teams = result.scalars().all()
    for team in teams:
        team.status = TeamStatus.READY
        team.cash = team.cash.__class__("1000000")
        team.stock_price = team.stock_price.__class__("100")
        team.shares_outstanding = 1000000
        team.public_float = 100000
        team.treasury_shares = 900000
        team.cooldown_until = None
        team.bankrupt_since = None
        team.bankrupt_resolved = False
        team.eliminated_at = None
        team.elimination_reason = None
        team.rank_at_elimination = None

    # 3. Reset GameState to SETUP
    state = await get_game_state(db)
    state.status = GameStatus.SETUP
    state.started_at = None
    state.paused_at = None
    state.resumed_at = None
    state.finished_at = None
    state.pause_offset = 0
    state.current_round = 0
    state.last_purge_at = None
    state.next_purge_at = None
    state.teams_remaining = None
    state.llm_queue_depth = 0
    state.total_llm_cost = state.total_llm_cost.__class__("0")
    state.aggregate_market_cap_at_purge = None

    # 4. Log the restart (after clearing old events)
    db.add(ActivityEvent(
        event_type="GAME_RESTARTED",
        actor="admin",
        description="Game restarted by admin",
    ))

    await db.commit()
    await db.refresh(state)

    # 5. Update Redis cache
    r = aioredis.from_url(settings.REDIS_URL)
    try:
        await r.set(REDIS_GAME_STATUS_KEY, GameStatus.SETUP.value)
    finally:
        await r.aclose()

    # 6. Broadcast state change
    await publish_broadcast({
        "type": "game_state_changed",
        "payload": {
            "status": GameStatus.SETUP.value,
            "elapsed_seconds": 0,
            "current_round": 0,
        },
    })

    return GameRestartResponse(
        message="Game restarted successfully",
        status=GameStatus.SETUP.value,
        current_round=0,
    )


# --- Activity Log ---


@router.get("/activity", response_model=list[ActivityEventItem])
async def get_activity_log(
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get recent activity events. Returns last 200 events."""
    result = await db.execute(
        select(ActivityEvent)
        .order_by(ActivityEvent.created_at.desc())
        .limit(200)
    )
    events = result.scalars().all()

    return [
        ActivityEventItem(
            id=str(e.id),
            event_type=e.event_type,
            actor=e.actor,
            description=e.description,
            metadata_json=e.metadata_json,
            created_at=e.created_at.isoformat(),
        )
        for e in events
    ]


# --- News History ---


@router.get("/news/history", response_model=list[NewsHistoryItem])
async def get_news_history(
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get recent news items. Returns last 100 news entries."""
    result = await db.execute(
        select(MarketNews)
        .order_by(MarketNews.created_at.desc())
        .limit(100)
    )
    news_items = result.scalars().all()

    return [
        NewsHistoryItem(
            id=str(n.id),
            headline=n.headline,
            content=n.content,
            source_type=n.source_type,
            affected_tickers=json.loads(n.affected_tickers) if n.affected_tickers else [],
            created_at=n.created_at.isoformat(),
        )
        for n in news_items
    ]
