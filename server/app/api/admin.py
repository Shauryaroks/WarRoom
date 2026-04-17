import json
import uuid
from datetime import datetime, timezone
from typing import Optional

import bcrypt
from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

import redis.asyncio as aioredis

from app.database import get_db, settings
from decimal import Decimal

from app.models import (
    ActivityEvent,
    Admin,
    Archetype,
    CashLedger,
    CrisisEvent,
    Directive,
    Evaluation,
    EvaluationStatus,
    GameState,
    GameStatus,
    MarketNews,
    PriceHistory,
    Solution,
    StockHolding,
    Team,
    TeamStatus,
    Transaction,
)
from app.auth_utils import create_access_token, require_admin
from app.redis_pubsub import publish_broadcast, publish_to_team
from app.services.evaluation_service import (
    approve_evaluation as _approve_evaluation,
    reject_evaluation as _reject_evaluation,
)
from app.schemas.decisions import GamePhaseResponse, SetGamePhaseRequest
from app.services.game_service import (
    REDIS_GAME_STATUS_KEY,
    calculate_elapsed_seconds,
    get_game_state,
    get_game_state_readonly,
    set_game_phase,
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
    archetype_id: str | None = None
    archetype_name: str | None = None
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


class SetScoreRequest(BaseModel):
    quality_score: float = Field(ge=0.0, le=1.0)


class SetScoreResponse(BaseModel):
    message: str
    team_id: str
    target_price: str
    ticks_remaining: int


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


class EvaluationListItem(BaseModel):
    id: str
    team_id: str
    team_name: str
    team_ticker: str
    solution_type: str
    status: str
    overall_score: float | None
    scoring_metrics: str | None
    news_headline: str | None
    news_body: str | None
    news_sentiment: float | None
    price_timeline: str | None
    llm_model: str | None
    admin_notes: str | None
    created_at: str


class EvaluationEditRequest(BaseModel):
    overall_score: float | None = Field(None, ge=0.0, le=1.0)
    scoring_metrics: str | None = None
    news_headline: str | None = Field(None, max_length=120)
    news_body: str | None = None
    news_sentiment: float | None = Field(None, ge=-1.0, le=1.0)
    price_timeline: str | None = None


class EvaluationActionResponse(BaseModel):
    message: str
    evaluation_id: str


class CaselineAssignRequest(BaseModel):
    caseline_document: str = Field(min_length=1, max_length=100000)
    company_display_name: str | None = Field(None, max_length=100)
    starting_cash: float | None = None
    initial_stock_price: float | None = None


class CaselineAssignResponse(BaseModel):
    message: str
    team_id: str


class CrisisInjectRequest(BaseModel):
    scenario: str = Field(min_length=10, max_length=5000)
    timer_seconds: int = Field(gt=0, le=3600)


class CrisisInjectResponse(BaseModel):
    message: str
    crisis_id: str


class EliminateTeamResponse(BaseModel):
    message: str
    team_id: str
    rank: int


# --- Utility ---


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


# --- Endpoints ---


@router.post("/login", response_model=AdminLoginResponse)
async def admin_login(request: AdminLoginRequest, db: AsyncSession = Depends(get_db)):
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
async def seed_admin(request: AdminSeedRequest, db: AsyncSession = Depends(get_db)):
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
    from sqlalchemy.orm import selectinload

    query = (
        select(Team)
        .options(selectinload(Team.archetype))
        .order_by(Team.created_at.desc())
    )

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
            archetype_id=str(t.archetype_id) if t.archetype_id else None,
            archetype_name=t.archetype.name if t.archetype else None,
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

    db.add(
        ActivityEvent(
            event_type="TEAM_APPROVED",
            actor="admin",
            description=f"Team '{team.name}' approved",
        )
    )
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

    db.add(
        ActivityEvent(
            event_type="TEAM_REJECTED",
            actor="admin",
            description=f"Team '{team.name}' rejected",
        )
    )
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
        raise HTTPException(
            status_code=409, detail="Cannot remove teams from a finished game"
        )

    team_name = team.name

    if game_state.status == GameStatus.SETUP:
        # Hard delete: remove related records first to avoid FK violations
        await db.execute(delete(Directive).where(Directive.team_id == team_id))
        await db.execute(
            delete(StockHolding).where(StockHolding.owner_team_id == team_id)
        )
        await db.execute(
            delete(StockHolding).where(StockHolding.target_team_id == team_id)
        )
        await db.execute(
            delete(Transaction).where(Transaction.buyer_team_id == team_id)
        )
        await db.execute(
            delete(Transaction).where(Transaction.seller_team_id == team_id)
        )
        await db.execute(
            delete(Transaction).where(Transaction.target_team_id == team_id)
        )
        await db.execute(delete(CashLedger).where(CashLedger.team_id == team_id))
        await db.execute(delete(PriceHistory).where(PriceHistory.team_id == team_id))
        await db.delete(team)
        remove_type = "hard"
    else:
        # Soft remove: mark as BANKRUPT
        team.status = TeamStatus.BANKRUPT
        team.bankrupt_since = datetime.now(timezone.utc)
        remove_type = "soft"

    db.add(
        ActivityEvent(
            event_type="TEAM_REMOVED",
            actor="admin",
            description=f"Team '{team_name}' removed ({remove_type} delete)",
            metadata_json=json.dumps(
                {"team_id": str(team_id), "remove_type": remove_type}
            ),
        )
    )
    await db.commit()

    await publish_broadcast(
        {
            "type": "team_removed",
            "payload": {"team_id": str(team_id), "remove_type": remove_type},
        }
    )

    return TeamRemoveResponse(
        message=f"Team '{team_name}' {'permanently removed' if remove_type == 'hard' else 'marked as bankrupt'}",
        team_id=str(team_id),
        remove_type=remove_type,
    )


# --- Team Score (per D-05: pluggable score input for Phase 4) ---


@router.post(
    "/teams/{team_id}/set-score",
    response_model=SetScoreResponse,
)
async def set_team_score(
    team_id: uuid.UUID,
    request: SetScoreRequest,
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """DEPRECATED (Phase 9 D-28). v1 quality_score pipeline replaced by fundamental_evaluations."""
    raise HTTPException(
        status_code=410,
        detail="v1 quality_score pipeline replaced by fundamental_evaluations (Phase 9)",
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
        affected_tickers=json.dumps(request.affected_tickers)
        if request.affected_tickers
        else None,
    )
    db.add(news)

    db.add(
        ActivityEvent(
            event_type="NEWS_INJECTED",
            actor="admin",
            description=f"News injected: {request.headline}",
        )
    )
    await db.commit()
    await db.refresh(news)

    await publish_broadcast(
        {
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
        }
    )

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

    db.add(
        ActivityEvent(
            event_type="BROADCAST_SENT",
            actor="admin",
            description=f"Broadcast: {request.message[:80]}",
        )
    )
    await db.commit()
    await db.refresh(news)

    await publish_broadcast(
        {
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
        }
    )

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

    db.add(
        ActivityEvent(
            event_type="GAME_STARTED",
            actor="admin",
            description="Game started",
        )
    )
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

    db.add(
        ActivityEvent(
            event_type="GAME_PAUSED",
            actor="admin",
            description="Game paused",
        )
    )
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
    """Resume the game (PAUSED -> ACTIVE). Resolves any active crisis. Requires admin."""
    try:
        state = await transition_state(db, GameStatus.ACTIVE)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    # D-05: Resolve any active crisis on resume
    crisis_result = await db.execute(
        select(CrisisEvent).where(CrisisEvent.status == "ACTIVE")
    )
    active_crisis = crisis_result.scalar_one_or_none()
    if active_crisis:
        active_crisis.status = "RESOLVED"
        active_crisis.resolved_at = datetime.now(timezone.utc)
        await publish_broadcast(
            {
                "type": "crisis_resolved",
                "payload": {"crisis_id": str(active_crisis.id)},
            }
        )

    db.add(
        ActivityEvent(
            event_type="GAME_RESUMED",
            actor="admin",
            description="Game resumed",
        )
    )
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

    db.add(
        ActivityEvent(
            event_type="ROUND_ADVANCED",
            actor="admin",
            description=f"Advanced to Q{state.current_round}",
        )
    )
    await db.commit()
    await db.refresh(state)

    await publish_broadcast(
        {
            "type": "round_advanced",
            "payload": {"current_round": state.current_round},
        }
    )

    return RoundAdvanceResponse(
        message=f"Advanced to round {state.current_round}",
        current_round=state.current_round,
    )


# --- War Room / Live Floor Phase Transitions (Phase 8, D-02) ---


@router.post("/game/war-room", response_model=GamePhaseResponse)
async def enter_war_room(
    macro_brief: str | None = Body(None, embed=True),
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Enter War Room: halts trading and ticks, teams submit operating plans (D-02)."""
    game_state = await get_game_state_readonly(db)
    if game_state.status != GameStatus.ACTIVE:
        raise HTTPException(
            status_code=409, detail="Game must be ACTIVE to enter War Room"
        )

    try:
        state = await set_game_phase(db, "war_room", macro_brief=macro_brief)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    db.add(
        ActivityEvent(
            event_type="WAR_ROOM_ENTERED",
            actor="admin",
            description="Admin entered War Room",
        )
    )
    await db.commit()

    return GamePhaseResponse(
        game_phase=state.game_phase,
        macro_brief=state.macro_brief,
        current_round=state.current_round,
    )


@router.post("/game/live-floor", response_model=GamePhaseResponse)
async def open_live_floor(
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Open Live Floor: enables trading and ticks, teams submit decisions (D-02)."""
    game_state = await get_game_state_readonly(db)
    if game_state.status != GameStatus.ACTIVE:
        raise HTTPException(
            status_code=409, detail="Game must be ACTIVE to open Live Floor"
        )

    try:
        state = await set_game_phase(db, "live_floor")
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    db.add(
        ActivityEvent(
            event_type="LIVE_FLOOR_OPENED",
            actor="admin",
            description="Admin opened Live Floor",
        )
    )
    await db.commit()

    return GamePhaseResponse(
        game_phase=state.game_phase,
        macro_brief=state.macro_brief,
        current_round=state.current_round,
    )


@router.get("/game/phase", response_model=GamePhaseResponse)
async def get_game_phase(
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get current game phase (read-only)."""
    state = await get_game_state_readonly(db)
    return GamePhaseResponse(
        game_phase=state.game_phase,
        macro_brief=state.macro_brief,
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
            Team.status.in_(
                [
                    TeamStatus.ACTIVE,
                    TeamStatus.COOLDOWN,
                    TeamStatus.BANKRUPT,
                    TeamStatus.ELIMINATED,
                    TeamStatus.READY,
                ]
            )
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
        team.fundamental_market_share = None
        team.fundamental_margin = None
        team.fundamental_growth = None
        team.fundamental_ops_efficiency = None
        team.drift_target_pct = None
        team.drift_floor_pct = None
        team.ramp_started_at = None
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
    db.add(
        ActivityEvent(
            event_type="GAME_RESTARTED",
            actor="admin",
            description="Game restarted by admin",
        )
    )

    await db.commit()
    await db.refresh(state)

    # 5. Update Redis cache
    r = aioredis.from_url(settings.REDIS_URL)
    try:
        await r.set(REDIS_GAME_STATUS_KEY, GameStatus.SETUP.value)
    finally:
        await r.aclose()

    # 6. Broadcast state change
    await publish_broadcast(
        {
            "type": "game_state_changed",
            "payload": {
                "status": GameStatus.SETUP.value,
                "elapsed_seconds": 0,
                "current_round": 0,
            },
        }
    )

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
        select(ActivityEvent).order_by(ActivityEvent.created_at.desc()).limit(200)
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
        select(MarketNews).order_by(MarketNews.created_at.desc()).limit(100)
    )
    news_items = result.scalars().all()

    return [
        NewsHistoryItem(
            id=str(n.id),
            headline=n.headline,
            content=n.content,
            source_type=n.source_type,
            affected_tickers=json.loads(n.affected_tickers)
            if n.affected_tickers
            else [],
            created_at=n.created_at.isoformat(),
        )
        for n in news_items
    ]


# --- Evaluation Endpoints (per EVAL-03, EVAL-04, EVAL-05) ---


def _evaluation_to_list_item(evaluation: Evaluation, team: Team) -> EvaluationListItem:
    """Convert Evaluation + Team to EvaluationListItem response."""
    return EvaluationListItem(
        id=str(evaluation.id),
        team_id=str(evaluation.team_id),
        team_name=team.name,
        team_ticker=team.ticker,
        solution_type=evaluation.solution.solution_type.value
        if evaluation.solution
        else "UNKNOWN",
        status=evaluation.status.value,
        overall_score=evaluation.overall_score,
        scoring_metrics=evaluation.scoring_metrics,
        news_headline=evaluation.news_headline,
        news_body=evaluation.news_body,
        news_sentiment=float(evaluation.news_sentiment)
        if evaluation.news_sentiment is not None
        else None,
        price_timeline=evaluation.price_timeline,
        llm_model=evaluation.llm_model,
        admin_notes=evaluation.admin_notes,
        created_at=evaluation.created_at.isoformat(),
    )


@router.get("/evaluations", response_model=list[EvaluationListItem])
async def list_evaluations(
    status_filter: Optional[str] = Query(None, alias="status"),
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List evaluations with team info. Optionally filter by status (EVAL-03)."""
    from sqlalchemy.orm import selectinload

    query = (
        select(Evaluation)
        .options(selectinload(Evaluation.team), selectinload(Evaluation.solution))
        .order_by(Evaluation.created_at.desc())
    )

    if status_filter:
        try:
            eval_status = EvaluationStatus(status_filter)
            query = query.where(Evaluation.status == eval_status)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status: {status_filter}. Valid: {[s.value for s in EvaluationStatus]}",
            )

    result = await db.execute(query)
    evaluations = result.scalars().all()

    return [_evaluation_to_list_item(e, e.team) for e in evaluations]


@router.get("/evaluations/{evaluation_id}", response_model=EvaluationListItem)
async def get_evaluation(
    evaluation_id: uuid.UUID,
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get single evaluation detail."""
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(Evaluation)
        .options(selectinload(Evaluation.team), selectinload(Evaluation.solution))
        .where(Evaluation.id == evaluation_id)
    )
    evaluation = result.scalar_one_or_none()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    return _evaluation_to_list_item(evaluation, evaluation.team)


@router.put("/evaluations/{evaluation_id}", response_model=EvaluationActionResponse)
async def edit_evaluation(
    evaluation_id: uuid.UUID,
    request: EvaluationEditRequest,
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Edit evaluation fields before approval (EVAL-04). Only PENDING_APPROVAL (T-05-08)."""
    result = await db.execute(select(Evaluation).where(Evaluation.id == evaluation_id))
    evaluation = result.scalar_one_or_none()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    if evaluation.status != EvaluationStatus.PENDING_APPROVAL:
        raise HTTPException(
            status_code=409,
            detail=f"Can only edit PENDING_APPROVAL evaluations, current: {evaluation.status.value}",
        )

    # Update only non-None fields
    if request.overall_score is not None:
        evaluation.overall_score = request.overall_score
    if request.scoring_metrics is not None:
        evaluation.scoring_metrics = request.scoring_metrics
    if request.news_headline is not None:
        evaluation.news_headline = request.news_headline
    if request.news_body is not None:
        evaluation.news_body = request.news_body
    if request.news_sentiment is not None:
        from decimal import Decimal

        evaluation.news_sentiment = Decimal(str(request.news_sentiment))
    if request.price_timeline is not None:
        evaluation.price_timeline = request.price_timeline

    await db.commit()

    return EvaluationActionResponse(
        message="Evaluation updated",
        evaluation_id=str(evaluation.id),
    )


@router.post(
    "/evaluations/{evaluation_id}/approve", response_model=EvaluationActionResponse
)
async def approve_evaluation_endpoint(
    evaluation_id: uuid.UUID,
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Approve evaluation: writes target_price, creates news (EVAL-05)."""
    try:
        result = await _approve_evaluation(db, evaluation_id)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    db.add(
        ActivityEvent(
            event_type="EVALUATION_APPROVED",
            actor="admin",
            description=f"Evaluation approved for {result['ticker']} (target: ${result['target_price']})",
            metadata_json=json.dumps(result),
        )
    )
    await db.commit()

    # D-01: Dispatch news generation after approval
    from app.worker.tasks.generate_news import generate_news

    generate_news.delay(str(evaluation_id), result["team_id"])

    # Broadcast news to all teams
    await publish_broadcast(
        {
            "type": "evaluation_approved",
            "payload": {
                "evaluation_id": str(evaluation_id),
                "team_id": result["team_id"],
                "ticker": result["ticker"],
                "target_price": result["target_price"],
                "news_id": result["news_id"],
            },
        }
    )

    return EvaluationActionResponse(
        message=f"Evaluation approved. Target price: ${result['target_price']}",
        evaluation_id=str(evaluation_id),
    )


class RejectEvaluationRequest(BaseModel):
    admin_notes: str = ""


@router.post(
    "/evaluations/{evaluation_id}/reject", response_model=EvaluationActionResponse
)
async def reject_evaluation_endpoint(
    evaluation_id: uuid.UUID,
    request: RejectEvaluationRequest = RejectEvaluationRequest(),
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Reject evaluation with optional notes (EVAL-05, D-10)."""
    try:
        result = await _reject_evaluation(db, evaluation_id, request.admin_notes)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    db.add(
        ActivityEvent(
            event_type="EVALUATION_REJECTED",
            actor="admin",
            description=f"Evaluation rejected for team {result['team_id']}",
            metadata_json=json.dumps(result),
        )
    )
    await db.commit()

    # D-10: Notify team of rejection
    await publish_to_team(
        uuid.UUID(result["team_id"]),
        {
            "type": "evaluation_rejected",
            "payload": {
                "evaluation_id": result["evaluation_id"],
                "admin_notes": request.admin_notes,
            },
        },
    )

    return EvaluationActionResponse(
        message="Evaluation rejected",
        evaluation_id=result["evaluation_id"],
    )


# --- Caseline Assignment (per D-12, D-13, D-14) ---


@router.put("/teams/{team_id}/caseline", response_model=CaselineAssignResponse)
async def assign_caseline(
    team_id: uuid.UUID,
    request: CaselineAssignRequest,
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Assign caseline document to team. Only during SETUP (D-12, T-05-09)."""
    # T-05-09: Only allow in SETUP
    game_state = await get_game_state_readonly(db)
    if game_state.status != GameStatus.SETUP:
        raise HTTPException(
            status_code=409,
            detail="Caseline assignment only allowed during SETUP phase",
        )

    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    team.caseline_document = request.caseline_document
    if request.company_display_name is not None:
        team.company_display_name = request.company_display_name

    # D-14: Update financial fields if provided
    if request.starting_cash is not None:
        from decimal import Decimal

        team.cash = Decimal(str(request.starting_cash))
    if request.initial_stock_price is not None:
        from decimal import Decimal

        team.stock_price = Decimal(str(request.initial_stock_price))

    db.add(
        ActivityEvent(
            event_type="CASELINE_ASSIGNED",
            actor="admin",
            description=f"Caseline assigned to team '{team.name}'",
            metadata_json=json.dumps({"team_id": str(team_id)}),
        )
    )
    await db.commit()

    return CaselineAssignResponse(
        message=f"Caseline assigned to '{team.name}'",
        team_id=str(team_id),
    )


# --- Crisis Events (per D-04, D-05) ---


@router.post("/crisis/inject", response_model=CrisisInjectResponse)
async def inject_crisis(
    request: CrisisInjectRequest,
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Inject a crisis event. Auto-pauses game and broadcasts crisis_started.

    T-06-05: require_admin + Pydantic validation on scenario/timer.
    T-06-09: Only one active crisis at a time.
    """
    # T-06-09: Reject if an active crisis already exists
    existing = await db.execute(
        select(CrisisEvent).where(CrisisEvent.status == "ACTIVE")
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="A crisis is already active. Resolve it before injecting another.",
        )

    crisis = CrisisEvent(
        scenario=request.scenario,
        timer_seconds=request.timer_seconds,
        status="ACTIVE",
    )
    db.add(crisis)

    # D-04 step 2: Auto-pause game
    try:
        await transition_state(db, GameStatus.PAUSED)
    except ValueError:
        pass  # Already paused is fine

    db.add(
        ActivityEvent(
            event_type="CRISIS_INJECTED",
            actor="admin",
            description=f"Crisis injected: {request.scenario[:80]}",
            metadata_json=json.dumps(
                {
                    "crisis_id": str(crisis.id),
                    "timer_seconds": request.timer_seconds,
                }
            ),
        )
    )
    await db.commit()
    await db.refresh(crisis)

    await publish_broadcast(
        {
            "type": "crisis_started",
            "payload": {
                "crisis_id": str(crisis.id),
                "scenario": crisis.scenario,
                "timer_seconds": crisis.timer_seconds,
                "started_at": crisis.created_at.isoformat(),
            },
        }
    )

    return CrisisInjectResponse(
        message="Crisis injected and game paused",
        crisis_id=str(crisis.id),
    )


# --- Team Elimination (per D-07, D-08, D-09) ---


@router.post("/teams/{team_id}/eliminate", response_model=EliminateTeamResponse)
async def eliminate_team(
    team_id: uuid.UUID,
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Eliminate a team: stock_price=0, status=ELIMINATED, broadcast sent.

    T-06-04: require_admin enforces admin-only access.
    T-06-06: SELECT FOR UPDATE prevents race conditions.
    """
    result = await db.execute(select(Team).where(Team.id == team_id).with_for_update())
    team = result.scalar_one_or_none()

    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    if team.status not in (TeamStatus.ACTIVE, TeamStatus.COOLDOWN):
        raise HTTPException(
            status_code=409,
            detail=f"Team cannot be eliminated from status {team.status.value}. Must be ACTIVE or COOLDOWN.",
        )

    # Compute rank: count of active/cooldown teams with higher stock price + 1
    rank_result = await db.execute(
        select(func.count())
        .select_from(Team)
        .where(
            Team.status.in_([TeamStatus.ACTIVE, TeamStatus.COOLDOWN]),
            Team.stock_price > team.stock_price,
            Team.id != team_id,
        )
    )
    rank = (rank_result.scalar() or 0) + 1

    # D-07: Shares become worthless
    team.stock_price = Decimal("0")
    team.drift_target_pct = None
    team.drift_floor_pct = None
    team.ramp_started_at = None
    team.status = TeamStatus.ELIMINATED
    team.eliminated_at = datetime.now(timezone.utc)
    team.rank_at_elimination = rank

    db.add(
        ActivityEvent(
            event_type="TEAM_ELIMINATED",
            actor="admin",
            description=f"Team '{team.name}' eliminated at rank #{rank}",
            metadata_json=json.dumps(
                {
                    "team_id": str(team_id),
                    "ticker": team.ticker,
                    "rank": rank,
                }
            ),
        )
    )
    await db.commit()

    await publish_broadcast(
        {
            "type": "team_eliminated",
            "payload": {
                "team_id": str(team_id),
                "ticker": team.ticker,
                "rank": rank,
            },
        }
    )

    return EliminateTeamResponse(
        message=f"Team '{team.name}' eliminated at rank #{rank}",
        team_id=str(team_id),
        rank=rank,
    )


# --- Archetype Management (Phase 7: D-01 through D-08) ---


class ArchetypeCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    slug: str = Field(min_length=1, max_length=50, pattern=r"^[a-z0-9-]+$")
    description: str | None = None
    sector: str = Field(default="FOODS", pattern=r"^(FOODS|BEVERAGES)$")
    dossier_content: str = Field(min_length=1)
    benchmark_bands: str  # JSON string
    starting_cash: float
    starting_stock_price: float
    starting_shares: int = 1000000
    swot_strengths: str | None = None
    swot_weaknesses: str | None = None
    swot_opportunities: str | None = None
    swot_threats: str | None = None
    real_world_inspiration: str | None = Field(None, max_length=200)


class ArchetypeUpdateRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = None
    sector: str | None = Field(None, pattern=r"^(FOODS|BEVERAGES)$")
    dossier_content: str | None = Field(None, min_length=1)
    benchmark_bands: str | None = None
    starting_cash: float | None = None
    starting_stock_price: float | None = None
    starting_shares: int | None = None
    swot_strengths: str | None = None
    swot_weaknesses: str | None = None
    swot_opportunities: str | None = None
    swot_threats: str | None = None
    real_world_inspiration: str | None = Field(None, max_length=200)


class ArchetypeResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: str | None
    sector: str
    dossier_content: str
    benchmark_bands: str
    starting_cash: str
    starting_stock_price: str
    starting_shares: int
    swot_strengths: str | None
    swot_weaknesses: str | None
    swot_opportunities: str | None
    swot_threats: str | None
    real_world_inspiration: str | None
    is_preset: bool
    created_at: str


class ArchetypeAssignRequest(BaseModel):
    archetype_id: str


class ArchetypeAssignResponse(BaseModel):
    message: str
    team_id: str
    archetype_name: str


def _archetype_to_response(a: Archetype) -> ArchetypeResponse:
    return ArchetypeResponse(
        id=str(a.id),
        name=a.name,
        slug=a.slug,
        description=a.description,
        sector=a.sector,
        dossier_content=a.dossier_content,
        benchmark_bands=a.benchmark_bands,
        starting_cash=str(a.starting_cash),
        starting_stock_price=str(a.starting_stock_price),
        starting_shares=a.starting_shares,
        swot_strengths=a.swot_strengths,
        swot_weaknesses=a.swot_weaknesses,
        swot_opportunities=a.swot_opportunities,
        swot_threats=a.swot_threats,
        real_world_inspiration=a.real_world_inspiration,
        is_preset=a.is_preset,
        created_at=a.created_at.isoformat(),
    )


def _validate_benchmark_bands(bands_str: str) -> None:
    """Validate benchmark_bands JSON structure (T-07-04)."""
    try:
        bands = json.loads(bands_str)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=422, detail="benchmark_bands must be valid JSON"
        )

    required_keys = {"market_share", "margin", "growth", "ops_efficiency"}
    if set(bands.keys()) != required_keys:
        raise HTTPException(
            status_code=422,
            detail=f"benchmark_bands must have exactly these keys: {sorted(required_keys)}",
        )

    for key in required_keys:
        val = bands[key]
        if not isinstance(val, list) or len(val) != 2:
            raise HTTPException(
                status_code=422,
                detail=f"benchmark_bands.{key} must be a 2-element array [min, max]",
            )
        if not all(isinstance(v, (int, float)) for v in val):
            raise HTTPException(
                status_code=422,
                detail=f"benchmark_bands.{key} values must be numeric",
            )


@router.get("/archetypes", response_model=list[ArchetypeResponse])
async def list_archetypes(
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all archetypes. Requires admin."""
    result = await db.execute(select(Archetype).order_by(Archetype.created_at.desc()))
    archetypes = result.scalars().all()
    return [_archetype_to_response(a) for a in archetypes]


@router.post(
    "/archetypes",
    response_model=ArchetypeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_archetype(
    request: ArchetypeCreateRequest,
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a custom archetype (D-07). Requires admin."""
    _validate_benchmark_bands(request.benchmark_bands)

    # Check duplicate slug (409)
    existing = await db.execute(select(Archetype).where(Archetype.slug == request.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=f"Archetype with slug '{request.slug}' already exists",
        )

    archetype = Archetype(
        name=request.name,
        slug=request.slug,
        description=request.description,
        sector=request.sector,
        dossier_content=request.dossier_content,
        benchmark_bands=request.benchmark_bands,
        starting_cash=Decimal(str(request.starting_cash)),
        starting_stock_price=Decimal(str(request.starting_stock_price)),
        starting_shares=request.starting_shares,
        swot_strengths=request.swot_strengths,
        swot_weaknesses=request.swot_weaknesses,
        swot_opportunities=request.swot_opportunities,
        swot_threats=request.swot_threats,
        real_world_inspiration=request.real_world_inspiration,
        is_preset=False,
    )
    db.add(archetype)
    await db.commit()
    await db.refresh(archetype)

    return _archetype_to_response(archetype)


@router.get("/archetypes/{archetype_id}", response_model=ArchetypeResponse)
async def get_archetype(
    archetype_id: uuid.UUID,
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get a single archetype. Requires admin."""
    result = await db.execute(select(Archetype).where(Archetype.id == archetype_id))
    archetype = result.scalar_one_or_none()
    if not archetype:
        raise HTTPException(status_code=404, detail="Archetype not found")
    return _archetype_to_response(archetype)


@router.put("/archetypes/{archetype_id}", response_model=ArchetypeResponse)
async def update_archetype(
    archetype_id: uuid.UUID,
    request: ArchetypeUpdateRequest,
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update an archetype. Requires admin."""
    result = await db.execute(select(Archetype).where(Archetype.id == archetype_id))
    archetype = result.scalar_one_or_none()
    if not archetype:
        raise HTTPException(status_code=404, detail="Archetype not found")

    if request.benchmark_bands is not None:
        _validate_benchmark_bands(request.benchmark_bands)

    # Apply non-None fields
    if request.name is not None:
        archetype.name = request.name
    if request.description is not None:
        archetype.description = request.description
    if request.sector is not None:
        archetype.sector = request.sector
    if request.dossier_content is not None:
        archetype.dossier_content = request.dossier_content
    if request.benchmark_bands is not None:
        archetype.benchmark_bands = request.benchmark_bands
    if request.starting_cash is not None:
        archetype.starting_cash = Decimal(str(request.starting_cash))
    if request.starting_stock_price is not None:
        archetype.starting_stock_price = Decimal(str(request.starting_stock_price))
    if request.starting_shares is not None:
        archetype.starting_shares = request.starting_shares
    if request.swot_strengths is not None:
        archetype.swot_strengths = request.swot_strengths
    if request.swot_weaknesses is not None:
        archetype.swot_weaknesses = request.swot_weaknesses
    if request.swot_opportunities is not None:
        archetype.swot_opportunities = request.swot_opportunities
    if request.swot_threats is not None:
        archetype.swot_threats = request.swot_threats
    if request.real_world_inspiration is not None:
        archetype.real_world_inspiration = request.real_world_inspiration

    await db.commit()
    await db.refresh(archetype)

    return _archetype_to_response(archetype)


@router.delete("/archetypes/{archetype_id}", status_code=204)
async def delete_archetype(
    archetype_id: uuid.UUID,
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete an archetype. Cannot delete presets or archetypes with assigned teams (T-07-06)."""
    result = await db.execute(select(Archetype).where(Archetype.id == archetype_id))
    archetype = result.scalar_one_or_none()
    if not archetype:
        raise HTTPException(status_code=404, detail="Archetype not found")

    if archetype.is_preset:
        raise HTTPException(status_code=409, detail="Cannot delete preset archetypes")

    # Check if any teams are assigned
    team_count_result = await db.execute(
        select(func.count()).select_from(Team).where(Team.archetype_id == archetype_id)
    )
    if (team_count_result.scalar() or 0) > 0:
        raise HTTPException(
            status_code=409, detail="Cannot delete archetype with assigned teams"
        )

    await db.delete(archetype)
    await db.commit()


@router.post(
    "/teams/{team_id}/assign-archetype",
    response_model=ArchetypeAssignResponse,
)
async def assign_archetype(
    team_id: uuid.UUID,
    request: ArchetypeAssignRequest,
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Assign archetype to team. Only during SETUP (D-08, T-07-02)."""
    # D-08: SETUP-only guard
    game_state = await get_game_state_readonly(db)
    if game_state.status != GameStatus.SETUP:
        raise HTTPException(
            status_code=409,
            detail="Archetype assignment only allowed during SETUP phase",
        )

    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    archetype_result = await db.execute(
        select(Archetype).where(Archetype.id == uuid.UUID(request.archetype_id))
    )
    archetype = archetype_result.scalar_one_or_none()
    if not archetype:
        raise HTTPException(status_code=404, detail="Archetype not found")

    # D-02: Populate team fields from archetype
    team.archetype_id = archetype.id
    team.caseline_document = archetype.dossier_content
    team.company_display_name = archetype.name
    team.cash = archetype.starting_cash
    team.stock_price = archetype.starting_stock_price
    team.shares_outstanding = archetype.starting_shares
    team.swot_strengths = archetype.swot_strengths
    team.swot_weaknesses = archetype.swot_weaknesses
    team.swot_opportunities = archetype.swot_opportunities
    team.swot_threats = archetype.swot_threats

    # Phase 9 D-03/D-04: Populate fundamentals at archetype benchmark band midpoints.
    _bands = json.loads(archetype.benchmark_bands)
    team.fundamental_market_share = Decimal(
        str((_bands["market_share"][0] + _bands["market_share"][1]) / 2)
    )
    team.fundamental_margin = Decimal(
        str((_bands["margin"][0] + _bands["margin"][1]) / 2)
    )
    team.fundamental_growth = Decimal(
        str((_bands["growth"][0] + _bands["growth"][1]) / 2)
    )
    team.fundamental_ops_efficiency = Decimal(
        str((_bands["ops_efficiency"][0] + _bands["ops_efficiency"][1]) / 2)
    )

    db.add(
        ActivityEvent(
            event_type="ARCHETYPE_ASSIGNED",
            actor="admin",
            description=f"Archetype '{archetype.name}' assigned to team '{team.name}'",
            metadata_json=json.dumps(
                {
                    "team_id": str(team_id),
                    "archetype_id": str(archetype.id),
                    "archetype_slug": archetype.slug,
                }
            ),
        )
    )
    await db.commit()

    return ArchetypeAssignResponse(
        message=f"Archetype '{archetype.name}' assigned to '{team.name}'",
        team_id=str(team_id),
        archetype_name=archetype.name,
    )


# --- Archetype Seed (D-04, PORT-01) ---


_PRESET_ARCHETYPES = [
    {
        "name": "Legacy Giant",
        "slug": "legacy-giant",
        "description": "A decades-old FMCG conglomerate with unrivaled distribution reach and deep brand trust, but struggling to innovate in a rapidly evolving market.",
        "sector": "FOODS",
        "benchmark_bands": json.dumps(
            {
                "market_share": [20, 25],
                "margin": [10, 14],
                "growth": [4, 8],
                "ops_efficiency": [70, 85],
            }
        ),
        "starting_cash": Decimal("4000000000"),
        "starting_stock_price": Decimal("100"),
        "starting_shares": 1000000,
        "swot_strengths": "Massive pan-India distribution network covering 7M+ retail outlets. Iconic brand portfolio with 40+ years of consumer trust. Deep pockets for sustained price wars. Strong relationships with organized and unorganized retail channels.",
        "swot_weaknesses": "Slow product innovation cycle (18-24 months to launch). Aging brand perception among Gen Z and millennials. Margin squeeze from rising raw material costs and competitive pricing. Legacy IT infrastructure limiting data-driven decision making.",
        "swot_opportunities": "Premiumization wave in Indian snacks (growing 22% YoY). Health and wellness segment expanding rapidly. Quick commerce and D2C channels for direct consumer engagement. Export potential to South Asian and Middle Eastern markets.",
        "swot_threats": "D2C brands capturing urban premium segment with agile launches. Private label growth in modern trade (15% and rising). Input cost volatility (palm oil, wheat, packaging). Regulatory shifts on packaging and labeling requirements.",
        "real_world_inspiration": "Inspired by Parle Products / Britannia Industries",
        "dossier_content": """# Legacy Giant

## Company Overview

Legacy Giant is a multi-decade FMCG powerhouse that built its empire on affordable, mass-market snack foods distributed across every corner of India. With a portfolio spanning biscuits, namkeens, chips, and packaged sweets, the company reaches over 7 million retail outlets through a distribution network that is the envy of the industry.

The company's brands are household names -- products that have been part of Indian family kitchens for generations. This deep brand equity translates into consistent demand even during economic downturns. However, the company has been slow to respond to changing consumer preferences, particularly the shift toward healthier, premium options.

Revenue stands at approximately Rs 15,000 Cr annually, making Legacy Giant one of the top 5 packaged food companies in India by revenue. The company employs over 8,000 people across 12 manufacturing facilities.

## Balance Sheet Summary

| Metric | Value |
|--------|-------|
| Annual Revenue | Rs 15,000 Cr |
| EBITDA | Rs 1,800 Cr (12%) |
| Net Margin | 8.2% |
| Cash Reserves | Rs 400 Cr |
| Total Debt | Rs 600 Cr |
| Debt-to-Equity | 0.15 |

## Cost Structure

| Category | % of Revenue |
|----------|-------------|
| COGS (raw materials, packaging) | 58% |
| SGA (sales, distribution, advertising) | 22% |
| R&D and Innovation | 2% |
| Distribution and Logistics | 12% |
| Admin and Overheads | 6% |

## Market Position

Legacy Giant commands 20-25% market share in the packaged snacks category nationally. Growth has been steady but modest at 4-8% annually, tracking slightly above GDP growth. The company's competitive moat is its unparalleled distribution reach -- no competitor can match its ability to place products in remote rural outlets within 48 hours of production.

## Strategic Context

To win, Legacy Giant must leverage its distribution advantage while accelerating innovation. The company needs to launch premium sub-brands to capture the health-conscious urban consumer without cannibalizing its mass-market base. Margin improvement through operational efficiency and selective price increases will be critical. The key question: can a legacy giant move fast enough to stay relevant?
""",
    },
    {
        "name": "D2C Challenger",
        "slug": "d2c-challenger",
        "description": "A venture-backed digital-native snack brand with explosive growth, strong online presence, but burning cash and limited offline reach.",
        "sector": "FOODS",
        "benchmark_bands": json.dumps(
            {
                "market_share": [1, 3],
                "margin": [-5, 10],
                "growth": [60, 100],
                "ops_efficiency": [40, 60],
            }
        ),
        "starting_cash": Decimal("250000000"),
        "starting_stock_price": Decimal("100"),
        "starting_shares": 1000000,
        "swot_strengths": "Digital-first brand with strong social media engagement (2M+ followers). Unit economics trending positive with 45% gross margins on hero SKUs. Agile product development (6-week concept-to-shelf). Data-driven marketing with precise CAC/LTV tracking.",
        "swot_weaknesses": "Cash burn rate of Rs 8 Cr/month with 31-month runway. Limited offline retail presence (only 2,000 stores). High customer acquisition cost (Rs 380/customer). Dependency on third-party logistics increasing delivery costs.",
        "swot_opportunities": "Online grocery market growing at 45% CAGR. Health-conscious consumers willing to pay 2-3x premium. Quick commerce platforms (Blinkit, Zepto) as efficient distribution. Strategic co-branding opportunities with fitness and wellness brands.",
        "swot_threats": "Legacy brands launching D2C verticals with deeper pockets. Customer acquisition costs inflating 15% quarterly. Potential funding winter reducing runway options. Platform dependency risk (Amazon, Flipkart policy changes).",
        "real_world_inspiration": "Inspired by Open Secret / Yoga Bar",
        "dossier_content": """# D2C Challenger

## Company Overview

D2C Challenger is a venture-backed, digital-native snack food company that has captured the imagination of urban India's health-conscious millennials. Founded just 4 years ago, the company has grown from a single protein bar SKU to a portfolio of 28 products spanning healthy chips, granola bars, nut mixes, and protein snacks.

The brand's strength lies in its community-driven approach. With over 2 million social media followers and a highly engaged customer base, D2C Challenger has built brand loyalty through transparency -- sharing ingredient sourcing stories, nutritional breakdowns, and manufacturing processes openly. The company's subscription model accounts for 35% of revenue, providing predictable recurring income.

However, profitability remains elusive. The company has raised Rs 120 Cr across three funding rounds and is burning approximately Rs 8 Cr per month. Revenue is Rs 85 Cr annually and growing at 80% YoY, but EBITDA margins are negative as the company invests heavily in customer acquisition and geographic expansion.

## Balance Sheet Summary

| Metric | Value |
|--------|-------|
| Annual Revenue | Rs 85 Cr |
| EBITDA | Rs -15 Cr (-18%) |
| Net Margin | -22% |
| Cash Reserves | Rs 25 Cr |
| Total Debt | Rs 10 Cr (venture debt) |
| Burn Rate | Rs 8 Cr/month |

## Cost Structure

| Category | % of Revenue |
|----------|-------------|
| COGS (premium ingredients, packaging) | 55% |
| Digital Marketing and CAC | 28% |
| R&D and Product Development | 5% |
| Fulfillment and Logistics | 18% |
| Technology Platform | 8% |
| Admin | 8% |

## Market Position

D2C Challenger holds 1-3% of the national packaged snacks market but commands 12% of the online-only healthy snacks segment. Growth is explosive at 60-100% annually, driven by the online grocery boom and increasing health consciousness. The company's competitive moat is its brand authenticity and first-mover advantage in the premium health snacks D2C space.

## Strategic Context

D2C Challenger's path to victory requires achieving profitability before cash runs out. The company must optimize unit economics by reducing CAC, expanding into offline retail strategically (modern trade first), and achieving scale economies in manufacturing. The key question: can a digital darling build real-world distribution before the money runs out?
""",
    },
    {
        "name": "Regional Leader",
        "slug": "regional-leader",
        "description": "A highly efficient regional snack brand with cult following in its home market, strong margins, but limited national presence.",
        "sector": "FOODS",
        "benchmark_bands": json.dumps(
            {
                "market_share": [12, 16],
                "margin": [14, 18],
                "growth": [10, 15],
                "ops_efficiency": [80, 92],
            }
        ),
        "starting_cash": Decimal("1500000000"),
        "starting_stock_price": Decimal("100"),
        "starting_shares": 1000000,
        "swot_strengths": "Best-in-class supply chain efficiency with 92% capacity utilization. Deep regional brand loyalty with 85% unaided recall in home state. Lean operations with industry-leading EBITDA margins (16%). Own manufacturing with zero outsourcing dependency.",
        "swot_weaknesses": "Limited to 5-state geographic footprint covering 15% of India's population. Basic branding and packaging compared to national players. No digital marketing capability or e-commerce presence. Dependent on traditional trade (kirana stores) for 90% of sales.",
        "swot_opportunities": "National expansion into adjacent states with similar taste profiles. Modern trade chains (Reliance Retail, DMart) seeking regional brands. Quick commerce as a capital-light national distribution channel. Export opportunities to Indian diaspora markets.",
        "swot_threats": "National players entering regional strongholds with aggressive pricing. Rising raw material costs (potatoes, edible oil) squeezing margins. Talent acquisition challenges in Tier-2 headquarters location. Modern trade bargaining power reducing margins on new channels.",
        "real_world_inspiration": "Inspired by Balaji Wafers / Haldiram's (early stage)",
        "dossier_content": """# Regional Leader

## Company Overview

Regional Leader is the dominant snack food company in its home region, a 5-state territory in Western India where the brand outsells national competitors by a 3:1 ratio. Built over 20 years by a founder who started with a single potato chip fryer, the company now operates 4 state-of-the-art manufacturing plants running at 92% capacity utilization.

The company's secret sauce is operational efficiency. By controlling the entire supply chain -- from potato sourcing (through contract farming) to manufacturing to last-mile delivery via its own fleet of 200+ trucks -- Regional Leader achieves margins that national players can only dream of. Every rupee is optimized, from batch scheduling to route planning.

Revenue is approximately Rs 2,800 Cr annually with a loyal customer base that treats the brand as a local champion. The company employs 3,500 people and is the largest private employer in its headquarters district.

## Balance Sheet Summary

| Metric | Value |
|--------|-------|
| Annual Revenue | Rs 2,800 Cr |
| EBITDA | Rs 448 Cr (16%) |
| Net Margin | 11.5% |
| Cash Reserves | Rs 150 Cr |
| Total Debt | Rs 200 Cr |
| Debt-to-Equity | 0.22 |

## Cost Structure

| Category | % of Revenue |
|----------|-------------|
| COGS (raw materials, own sourcing) | 52% |
| Manufacturing (own plants) | 14% |
| Distribution (own fleet) | 10% |
| SGA and Trade Promotions | 12% |
| R&D | 1% |
| Admin | 5% |

## Market Position

Regional Leader commands 12-16% market share in its home region (equivalent to #1 or #2 position). Growth is moderate at 10-15% annually, driven by deepening penetration in existing markets and cautious expansion into adjacent states. The competitive moat is operational excellence -- competitors cannot match the cost efficiency of the integrated supply chain.

## Strategic Context

Regional Leader's path to victory lies in smart national expansion without sacrificing the operational efficiency that defines the brand. The company must decide between organic expansion (slow but capital-efficient) and inorganic growth (faster but risky). Building a modern trade and e-commerce strategy is essential to reach consumers beyond the traditional kirana network. The key question: can a regional champion scale nationally without losing its soul?
""",
    },
    {
        "name": "Premium Niche",
        "slug": "premium-niche",
        "description": "A premium-positioned snack brand targeting health-conscious urban consumers with high margins but a small addressable market.",
        "sector": "FOODS",
        "benchmark_bands": json.dumps(
            {
                "market_share": [2, 5],
                "margin": [22, 30],
                "growth": [20, 35],
                "ops_efficiency": [55, 70],
            }
        ),
        "starting_cash": Decimal("800000000"),
        "starting_stock_price": Decimal("100"),
        "starting_shares": 1000000,
        "swot_strengths": "Premium brand positioning commanding 2-3x price premium over mass market. High gross margins (55%) enabling investment in quality and innovation. Strong presence in premium modern trade (Natures Basket, Foodhall, Organic stores). Celebrity and influencer endorsement portfolio driving aspirational appeal.",
        "swot_weaknesses": "Small total addressable market (urban SEC A/B, top 8 cities). High product development costs limiting SKU expansion speed. Premium positioning creates price ceiling sensitivity during inflation. Limited shelf space in general trade due to higher price points.",
        "swot_opportunities": "Health and wellness trend accelerating post-COVID (35% growth in premium segment). Export markets in US/UK/UAE with large Indian diaspora. Corporate gifting and institutional sales channels. Premium quick commerce (Zepto Cafe, Swiggy Instamart) as discovery channel.",
        "swot_threats": "Premium fatigue during economic slowdowns. Legacy brands launching premium sub-brands with massive distribution. Imitation products at lower price points confusing consumers. Raw material cost inflation harder to pass through at premium price points.",
        "real_world_inspiration": "Inspired by Too Yumm / Raw Pressery",
        "dossier_content": """# Premium Niche

## Company Overview

Premium Niche is a lifestyle snack brand that has carved out a lucrative position at the intersection of health, taste, and aspiration. Founded 8 years ago by a team of food scientists and brand strategists, the company produces baked (not fried) snacks, cold-pressed juices, artisanal trail mixes, and superfood-infused chips that retail at 2-3x the price of conventional alternatives.

The brand is a fixture in premium retail -- from Natures Basket to Foodhall to boutique organic stores -- and has cultivated an image of scientific rigor meets indulgence. Every product comes with detailed nutritional information, sourcing transparency, and third-party health certifications. Celebrity partnerships and wellness influencer collaborations have made the brand aspirational.

Revenue is Rs 450 Cr annually with impressive 26% EBITDA margins, making it one of the most profitable companies per unit in the Indian snacks industry. The company operates a single advanced manufacturing facility with dedicated lines for baked products and cold-pressed beverages.

## Balance Sheet Summary

| Metric | Value |
|--------|-------|
| Annual Revenue | Rs 450 Cr |
| EBITDA | Rs 117 Cr (26%) |
| Net Margin | 18% |
| Cash Reserves | Rs 80 Cr |
| Total Debt | Rs 50 Cr |
| Debt-to-Equity | 0.12 |

## Cost Structure

| Category | % of Revenue |
|----------|-------------|
| COGS (premium ingredients, certifications) | 45% |
| Brand Building and Marketing | 15% |
| R&D and Product Innovation | 6% |
| Premium Distribution | 8% |
| Packaging (premium materials) | 5% |
| Admin | 5% |

## Market Position

Premium Niche holds 2-5% of the overall packaged snacks market but commands 18% of the premium/health segment in its target cities. Growth is strong at 20-35% annually, fueled by the wellness megatrend and expanding urban affluence. The competitive moat is brand perception -- consumers associate the brand with quality, health, and sophistication that mass-market brands cannot replicate quickly.

## Strategic Context

Premium Niche's path to victory requires expanding the addressable market without diluting brand equity. The company must navigate the tension between growth (which demands broader distribution and potentially lower price points) and premium positioning (which demands exclusivity and higher margins). Geographic expansion into Tier-2 premium retail and international markets offers growth without brand dilution. The key question: can a premium brand scale without becoming ordinary?
""",
    },
]


@router.post("/archetypes/seed")
async def seed_archetypes(
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Seed the 4 pre-built archetypes. Idempotent by slug (T-07-05)."""
    created = []
    skipped = []

    for preset in _PRESET_ARCHETYPES:
        existing = await db.execute(
            select(Archetype).where(Archetype.slug == preset["slug"])
        )
        if existing.scalar_one_or_none():
            skipped.append(preset["slug"])
            continue

        archetype = Archetype(
            name=preset["name"],
            slug=preset["slug"],
            description=preset["description"],
            sector=preset["sector"],
            dossier_content=preset["dossier_content"],
            benchmark_bands=preset["benchmark_bands"],
            starting_cash=preset["starting_cash"],
            starting_stock_price=preset["starting_stock_price"],
            starting_shares=preset["starting_shares"],
            swot_strengths=preset["swot_strengths"],
            swot_weaknesses=preset["swot_weaknesses"],
            swot_opportunities=preset["swot_opportunities"],
            swot_threats=preset["swot_threats"],
            real_world_inspiration=preset["real_world_inspiration"],
            is_preset=True,
        )
        db.add(archetype)
        created.append(preset["slug"])

    await db.commit()

    return {
        "message": f"Seeded {len(created)} archetypes",
        "created": created,
        "skipped": skipped,
    }


# ---------------------------------------------------------------------------
# Phase 9: Fundamentals Queue endpoints
# ---------------------------------------------------------------------------


class FundamentalEvalListItem(BaseModel):
    id: str
    team_id: str
    ticker: str
    team_name: str
    round_number: int
    status: str
    proposed_deltas: dict
    admin_edits: Optional[dict] = None
    narrative: Optional[str] = None
    created_at: Optional[str] = None
    approved_at: Optional[str] = None
    rejected_at: Optional[str] = None


class FundamentalApproveResponse(BaseModel):
    evaluation_id: str
    team_id: str
    ticker: str
    drift_target_pct: str
    drift_floor_pct: str
    narrative: Optional[str]


class FundamentalRejectRequest(BaseModel):
    admin_notes: str = ""


class FundamentalComputeRequest(BaseModel):
    round_number: int = Field(ge=0, description="Quarter round number (>= 0)")


@router.get("/fundamentals-queue", response_model=list[FundamentalEvalListItem])
async def list_fundamentals_queue(
    _admin: dict = Depends(require_admin),
    status_filter: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """List all fundamental evaluations. Default: PENDING_APPROVAL."""
    from app.models import FundamentalEvaluation, FundamentalEvalStatus

    query = select(FundamentalEvaluation, Team).join(
        Team, FundamentalEvaluation.team_id == Team.id
    )

    if status_filter:
        try:
            query = query.where(
                FundamentalEvaluation.status == FundamentalEvalStatus(status_filter)
            )
        except ValueError:
            raise HTTPException(
                status_code=422, detail=f"Invalid status: {status_filter}"
            )
    else:
        query = query.where(
            FundamentalEvaluation.status == FundamentalEvalStatus.PENDING_APPROVAL
        )

    query = query.order_by(FundamentalEvaluation.created_at.desc())

    result = await db.execute(query)
    rows = result.all()

    items = []
    for ev, team in rows:
        items.append(
            FundamentalEvalListItem(
                id=str(ev.id),
                team_id=str(ev.team_id),
                ticker=team.ticker,
                team_name=team.name,
                round_number=ev.round_number,
                status=ev.status.value,
                proposed_deltas=json.loads(ev.proposed_deltas)
                if ev.proposed_deltas
                else {},
                admin_edits=json.loads(ev.admin_edits) if ev.admin_edits else None,
                narrative=ev.narrative,
                created_at=ev.created_at.isoformat() if ev.created_at else None,
                approved_at=ev.approved_at.isoformat() if ev.approved_at else None,
                rejected_at=ev.rejected_at.isoformat() if ev.rejected_at else None,
            )
        )
    return items


@router.post(
    "/fundamentals-queue/{evaluation_id}/approve",
    response_model=FundamentalApproveResponse,
)
async def approve_fundamental_eval(
    evaluation_id: uuid.UUID,
    admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.services.fundamental_service import apply_fundamental_deltas

    try:
        result = await apply_fundamental_deltas(db, evaluation_id, admin["id"])
    except ValueError as e:
        msg = str(e)
        status_code = 404 if "not found" in msg.lower() else 409
        raise HTTPException(status_code=status_code, detail=msg)

    db.add(
        ActivityEvent(
            event_type="FUNDAMENTAL_APPROVED",
            actor="admin",
            description=f"Fundamentals approved for {result['ticker']} (drift target: {result['drift_target_pct']})",
            metadata_json=json.dumps(result),
        )
    )
    await db.commit()

    await publish_broadcast(
        {
            "type": "fundamentals_updated",
            "payload": {
                "evaluation_id": result["evaluation_id"],
                "team_id": result["team_id"],
                "ticker": result["ticker"],
                "drift_target_pct": result["drift_target_pct"],
            },
        }
    )

    return FundamentalApproveResponse(
        evaluation_id=result["evaluation_id"],
        team_id=result["team_id"],
        ticker=result["ticker"],
        drift_target_pct=result["drift_target_pct"],
        drift_floor_pct=result["drift_floor_pct"],
        narrative=result.get("narrative"),
    )


@router.post("/fundamentals-queue/{evaluation_id}/reject")
async def reject_fundamental_eval(
    evaluation_id: uuid.UUID,
    request: FundamentalRejectRequest,
    admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.services.fundamental_service import reject_fundamental_evaluation

    try:
        result = await reject_fundamental_evaluation(
            db, evaluation_id, admin["id"], request.admin_notes
        )
    except ValueError as e:
        msg = str(e)
        status_code = 404 if "not found" in msg.lower() else 409
        raise HTTPException(status_code=status_code, detail=msg)

    await db.commit()
    return result


@router.post("/fundamentals-queue/compute")
async def compute_fundamentals_endpoint(
    request: FundamentalComputeRequest,
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Trigger LLM fundamental eval fan-out for all ACTIVE teams at the given round."""
    from app.services.fundamental_service import trigger_compute_for_round

    summary = await trigger_compute_for_round(db, request.round_number)

    db.add(
        ActivityEvent(
            event_type="FUNDAMENTALS_COMPUTED",
            actor="admin",
            description=f"Round {request.round_number}: {len(summary['created'])} created, {len(summary['skipped'])} skipped, {len(summary['failed'])} failed",
            metadata_json=json.dumps(summary),
        )
    )
    await db.commit()

    return summary
