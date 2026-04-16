"""Periodic game tick task with state guard.

Per D-09: Redis key check for ~1ms latency vs ~5ms DB query.
Per GAME-04: Pause stops all simulation ticks.

Phase 2: Guard + logging skeleton.
Phase 3: Stock price calculation, broadcast.
"""

import logging

import redis

from app.worker.celery_app import celery_app

logger = logging.getLogger(__name__)

REDIS_GAME_STATUS_KEY = "game:status"


def is_game_active() -> bool:
    """Check Redis for current game status. Returns True only if ACTIVE.

    Uses sync redis since Celery workers run in sync context.
    Per D-09: Redis key check for ~1ms latency vs ~5ms DB query.
    """
    r = redis.from_url(celery_app.conf.broker_url)
    try:
        status = r.get(REDIS_GAME_STATUS_KEY)
        if status is None:
            return False
        if isinstance(status, bytes):
            status = status.decode()
        return status == "ACTIVE"
    finally:
        r.close()


@celery_app.task(name="game.tick")
def game_tick():
    """Periodic tick task. Guarded by game state check (GAME-04).

    Returns early with no side effects when game is not ACTIVE.
    Phase 3 will add: stock price updates, broadcast.
    """
    if not is_game_active():
        return  # Silent return -- game not active, no work to do

    logger.info("game.tick executed (game is ACTIVE)")
    # Phase 3 will add: stock price calculation, broadcast
