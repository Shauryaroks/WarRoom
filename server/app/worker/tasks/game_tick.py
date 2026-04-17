"""Periodic game tick task with state guard and price simulation.

Per D-09: Redis key check for ~1ms latency vs ~5ms DB query.
Per GAME-04: Pause stops all simulation ticks.
Per SIM-01: Price tick every 60s calculates prices, writes PriceHistory, broadcasts.
"""

import asyncio
import logging

import redis

from app.worker.celery_app import celery_app

logger = logging.getLogger(__name__)

REDIS_GAME_STATUS_KEY = "game:status"


def is_game_active() -> bool:
    """Check Redis for current game status and phase. Returns True only if ACTIVE
    and not in War Room.

    Uses sync redis since Celery workers run in sync context.
    Per D-09: Redis key check for ~1ms latency vs ~5ms DB query.
    Per Phase 8 D-02: War Room halts ticks (trading + price simulation).
    """
    r = redis.from_url(celery_app.conf.broker_url)
    try:
        status = r.get(REDIS_GAME_STATUS_KEY)
        if status is None:
            return False
        if isinstance(status, bytes):
            status = status.decode()
        if status != "ACTIVE":
            return False

        # Phase 8: Check game phase -- war_room halts ticks
        phase = r.get("game:phase")
        if phase is not None:
            if isinstance(phase, bytes):
                phase = phase.decode()
            if phase == "war_room":
                logger.debug("Tick skipped: game phase is war_room")
                return False

        return True
    finally:
        r.close()


@celery_app.task(name="game.tick", bind=True)
def game_tick(self):
    """Periodic tick task. Guarded by game state check (GAME-04).

    Returns early with no side effects when game is not ACTIVE.
    When active: calculates prices for all teams, writes PriceHistory,
    broadcasts price_update via Redis pub/sub.
    """
    import structlog

    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(task_id=self.request.id)

    if not is_game_active():
        return  # Silent return -- game not active, no work to do

    r = redis.from_url(celery_app.conf.broker_url)
    try:
        round_number = r.get("game:round_number")
        if round_number:
            structlog.contextvars.bind_contextvars(round_number=int(round_number))

        tick_count = r.incr("game:tick_count")
    finally:
        r.close()

    asyncio.run(_execute_tick(tick_count))


async def _execute_tick(tick_count: int):
    """Execute the price tick: calculate prices, commit, then broadcast.

    Per RESEARCH anti-patterns: publish Redis AFTER db.commit() to avoid
    broadcasting data from a rolled-back transaction.
    """
    import structlog

    logger = structlog.get_logger(__name__)
    from app.database import get_worker_session
    from app.services.simulation_service import calculate_all_prices
    from app.redis_pubsub import publish_broadcast_sync

    logger.debug("Executing game tick", tick_count=tick_count)

    try:
        async with get_worker_session() as db:
            price_updates = await calculate_all_prices(db)
            await db.commit()

        # Publish AFTER commit (per RESEARCH anti-patterns)
        if price_updates:
            publish_broadcast_sync(
                {
                    "type": "price_update",
                    "payload": {"prices": price_updates},
                }
            )
            if tick_count % 10 == 0:
                logger.info("Price tick: %d teams updated", len(price_updates))
            else:
                logger.debug("Price tick: %d teams updated", len(price_updates))
        else:
            logger.debug("Price tick: no active teams with targets")
    except Exception:
        logger.exception("Game tick failed")
        raise
