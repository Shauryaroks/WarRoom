"""Game lifecycle state machine service.

Manages game state transitions (SETUP -> ACTIVE -> PAUSED -> FINISHED),
server-authoritative timer with drift-free pause/resume, Redis cache,
and WebSocket broadcast notifications.

Per D-01: State stored in PostgreSQL (source of truth), cached in Redis.
Per D-02: Admin-only controls (enforced at endpoint level via require_admin).
Per D-03: Uses existing GameStatus enum (SETUP, ACTIVE, PAUSED, FINISHED).

Phase 8 extensions: War Room / Live Floor game phase sub-states,
operating budget calculation for decision levers.
"""

import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import redis.asyncio as aioredis
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import AsyncSessionLocal, settings
from app.models import Decision, GameState, GameStatus, Team
from app.redis_pubsub import publish_broadcast

logger = logging.getLogger(__name__)

# Redis key for game status cache (read by Celery guard)
REDIS_GAME_STATUS_KEY = "game:status"

# Valid state transitions per D-03
VALID_TRANSITIONS: dict[GameStatus, set[GameStatus]] = {
    GameStatus.SETUP: {GameStatus.ACTIVE},
    GameStatus.ACTIVE: {GameStatus.PAUSED, GameStatus.FINISHED},
    GameStatus.PAUSED: {GameStatus.ACTIVE, GameStatus.FINISHED},
    GameStatus.FINISHED: set(),  # Terminal state
}


async def get_game_state(db: AsyncSession) -> GameState:
    """Get the singleton GameState row with FOR UPDATE lock.

    Per Pitfall 3 from RESEARCH.md: SELECT FOR UPDATE prevents race conditions
    on concurrent state transitions.
    """
    result = await db.execute(
        select(GameState).where(GameState.id == 1).with_for_update()
    )
    state = result.scalar_one_or_none()

    if state is None:
        state = GameState(id=1, status=GameStatus.SETUP)
        db.add(state)
        await db.commit()
        await db.refresh(state)

    return state


async def get_game_state_readonly(db: AsyncSession) -> GameState:
    """Get the singleton GameState row without locking (for read-only access)."""
    result = await db.execute(select(GameState).where(GameState.id == 1))
    state = result.scalar_one_or_none()

    if state is None:
        state = GameState(id=1, status=GameStatus.SETUP)
        db.add(state)
        await db.commit()
        await db.refresh(state)

    return state


async def transition_state(
    db: AsyncSession, target_status: GameStatus
) -> GameState:
    """Execute a state transition with validation, persistence, and broadcast.

    Order per D-01: DB write first, then Redis update, then WebSocket broadcast.
    Raises ValueError if transition is invalid.
    """
    state = await get_game_state(db)
    now = datetime.now(timezone.utc)

    # Validate transition
    valid_targets = VALID_TRANSITIONS.get(state.status, set())
    if target_status not in valid_targets:
        raise ValueError(
            f"Invalid transition: {state.status.value} -> {target_status.value}"
        )

    # Track whether this is the initial start (for game_started event per D-08)
    is_initial_start = (
        state.status == GameStatus.SETUP and target_status == GameStatus.ACTIVE
    )

    # Apply transition
    if state.status == GameStatus.SETUP and target_status == GameStatus.ACTIVE:
        state.started_at = now
        state.status = GameStatus.ACTIVE

    elif state.status == GameStatus.PAUSED and target_status == GameStatus.ACTIVE:
        # Accumulate paused duration into pause_offset
        if state.paused_at is not None:
            paused_duration = int((now - state.paused_at).total_seconds())
            state.pause_offset += paused_duration
        state.paused_at = None
        state.resumed_at = now
        state.status = GameStatus.ACTIVE

    elif state.status == GameStatus.ACTIVE and target_status == GameStatus.PAUSED:
        state.paused_at = now
        state.status = GameStatus.PAUSED

    elif target_status == GameStatus.FINISHED:
        state.finished_at = now
        state.status = GameStatus.FINISHED

    # DB write first (source of truth per D-01)
    await db.commit()
    await db.refresh(state)

    # Redis cache update
    await _update_redis_cache(state)

    # WebSocket broadcast
    await _broadcast_state_change(state, is_initial_start)

    return state


def calculate_elapsed_seconds(state: GameState) -> int:
    """Calculate elapsed game time excluding paused duration.

    Per D-04: Global elapsed timer.
    Per D-05: Excludes paused durations.
    Per D-07: Server-authoritative.
    """
    if state.started_at is None:
        return 0

    now = datetime.now(timezone.utc)

    # Determine reference time based on state
    if state.status == GameStatus.PAUSED and state.paused_at is not None:
        reference = state.paused_at  # Freeze timer at pause point
    elif state.status == GameStatus.FINISHED and state.finished_at is not None:
        reference = state.finished_at  # Freeze timer at finish point
    else:
        reference = now  # Live timer

    elapsed = int((reference - state.started_at).total_seconds()) - state.pause_offset
    return max(0, elapsed)


async def _update_redis_cache(state: GameState) -> None:
    """Update Redis cache with current game status and phase."""
    r = aioredis.from_url(settings.REDIS_URL)
    try:
        await r.set(REDIS_GAME_STATUS_KEY, state.status.value)
        await r.set("game:phase", getattr(state, "game_phase", None) or "")
    finally:
        await r.aclose()


async def _broadcast_state_change(
    state: GameState, is_initial_start: bool = False
) -> None:
    """Broadcast game state change to all WebSocket clients.

    Per D-08: Use type="game_started" on SETUP->ACTIVE transition
    (lobby listens for this to trigger instant redirect).
    All other transitions use type="game_state_changed".
    """
    elapsed = calculate_elapsed_seconds(state)

    if is_initial_start:
        msg_type = "game_started"
    else:
        msg_type = "game_state_changed"

    message = {
        "type": msg_type,
        "payload": {
            "status": state.status.value,
            "elapsed_seconds": elapsed,
            "current_round": state.current_round,
            "game_phase": getattr(state, "game_phase", None),
        },
    }

    await publish_broadcast(message)
    logger.info(
        "Broadcast %s: status=%s elapsed=%ds round=%d",
        msg_type,
        state.status.value,
        elapsed,
        state.current_round,
    )


async def warm_redis_cache() -> None:
    """Warm Redis cache from DB on API startup.

    Per Pitfall 4 from RESEARCH.md: prevents stale Redis after API crash.
    """
    async with AsyncSessionLocal() as session:
        state = await get_game_state_readonly(session)
        await _update_redis_cache(state)
        logger.info(
            "Redis cache warmed: game status=%s", state.status.value
        )


# ---------------------------------------------------------------------------
# Phase 8: War Room / Live Floor phase transitions (per D-01, D-02)
# ---------------------------------------------------------------------------

VALID_GAME_PHASES = {"war_room", "live_floor"}


async def set_game_phase(
    db: AsyncSession,
    phase: str | None,
    macro_brief: str | None = None,
) -> GameState:
    """Set the game sub-phase (war_room / live_floor / None).

    Per D-01: game_phase subdivides ACTIVE status.
    Per D-02: Admin triggers via dashboard buttons.
    Requires game status == ACTIVE.
    """
    if phase is not None and phase not in VALID_GAME_PHASES:
        raise ValueError(
            f"Invalid game phase: {phase!r}. Must be one of {VALID_GAME_PHASES} or None."
        )

    state = await get_game_state(db)

    if state.status != GameStatus.ACTIVE:
        raise ValueError(
            f"Cannot set game phase when game status is {state.status.value}. "
            "Game must be ACTIVE."
        )

    now = datetime.now(timezone.utc)

    if phase == "war_room":
        state.game_phase = "war_room"
        if macro_brief is not None:
            state.macro_brief = macro_brief
    elif phase == "live_floor":
        state.game_phase = "live_floor"
        state.current_quarter_start = now
    else:
        # Clear sub-state
        state.game_phase = None

    await db.commit()
    await db.refresh(state)

    # Update caches and broadcast
    await _update_redis_cache(state)

    await publish_broadcast(
        {
            "type": "game_phase_changed",
            "payload": {
                "game_phase": state.game_phase,
                "macro_brief": state.macro_brief,
                "current_round": state.current_round,
            },
        }
    )

    logger.info(
        "Game phase changed to %s (round=%d)",
        state.game_phase,
        state.current_round,
    )

    return state


# ---------------------------------------------------------------------------
# Phase 8: Operating budget calculation (per D-09)
# ---------------------------------------------------------------------------


async def get_operating_budget(
    db: AsyncSession, team_id: uuid.UUID
) -> dict:
    """Calculate operating budget for a team based on archetype and performance.

    Per D-09: budget = archetype.starting_cash * performance multiplier.
    Multiplier derived from stock price vs archetype starting price, clamped [0.7, 1.3].
    """
    # Load team with archetype eager-loaded
    result = await db.execute(
        select(Team)
        .options(selectinload(Team.archetype))
        .where(Team.id == team_id)
    )
    team = result.scalar_one_or_none()
    if team is None:
        raise ValueError("Team not found")

    archetype = team.archetype
    if archetype is None:
        raise ValueError("Team has no archetype assigned")

    base_budget = archetype.starting_cash

    # Get current round from game state
    gs_result = await db.execute(select(GameState).where(GameState.id == 1))
    game_state = gs_result.scalar_one_or_none()
    current_round = game_state.current_round if game_state else 0

    # Calculate performance multiplier
    if current_round == 0:
        multiplier = 1.0
    else:
        starting_price = float(archetype.starting_stock_price)
        current_price = float(team.stock_price)
        if starting_price > 0:
            multiplier = max(0.7, min(1.3, current_price / starting_price))
        else:
            multiplier = 1.0

    budget = base_budget * Decimal(str(multiplier))

    # Query total budget_spent for this team + current round
    spent_result = await db.execute(
        select(func.coalesce(func.sum(Decision.budget_spent), Decimal("0")))
        .where(Decision.team_id == team_id)
        .where(Decision.round_number == current_round)
    )
    total_spent = spent_result.scalar_one()

    remaining = budget - total_spent

    return {
        "total_budget": str(budget.quantize(Decimal("0.01"))),
        "allocated": str(total_spent.quantize(Decimal("0.01"))),
        "remaining": str(remaining.quantize(Decimal("0.01"))),
        "multiplier": round(multiplier, 4),
    }
