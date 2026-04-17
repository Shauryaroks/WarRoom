import os
from celery import Celery

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

celery_app = Celery(
    "complex",
    broker=REDIS_URL,
    backend=REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=60,  # 60s hard limit (reduced from 300s per PITFALLS.md)
    task_soft_time_limit=45,
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=100,  # restart worker after 100 tasks to prevent memory leaks
    broker_connection_retry_on_startup=True,
)

# Beat schedule -- game tick every 60 seconds (stock ticks in Phase 3)
celery_app.conf.beat_schedule = {
    "game-tick-every-60s": {
        "task": "game.tick",
        "schedule": 60.0,  # Every 60 seconds (1-minute stock ticks in Phase 3)
    },
}

# Explicit imports — avoids autodiscover walking a package __init__.py that risks
# circular imports. Each submodule registers its @task decorators on import.
celery_app.conf.imports = (
    "app.worker.tasks.game_tick",
    "app.worker.tasks.evaluate_solution",
    "app.worker.tasks.generate_news",
)
