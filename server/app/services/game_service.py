"""Game lifecycle state machine service.

Manages game state transitions (SETUP -> ACTIVE -> PAUSED -> FINISHED),
server-authoritative timer with drift-free pause/resume, Redis cache,
and WebSocket broadcast notifications.

Per D-01: State stored in PostgreSQL (source of truth), cached in Redis.
Per D-02: Admin-only controls (enforced at endpoint level via require_admin).
Per D-03: Uses existing GameStatus enum (SETUP, ACTIVE, PAUSED, FINISHED).
"""

import logging
from datetime import datetime, timezone

import redis.asyncio as aioredis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal, settings
from app.models import GameState, GameStatus
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
    """Update Redis cache with current game status."""
    r = aioredis.from_url(settings.REDIS_URL)
    try:
        await r.set(REDIS_GAME_STATUS_KEY, state.status.value)
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
