import os
from celery import Celery
from celery.schedules import crontab

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "warroom",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=[
        "app.worker.tasks.directive",
        "app.worker.tasks.pricing",
        "app.worker.tasks.bankruptcy",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,
    task_soft_time_limit=270,
    worker_prefetch_multiplier=10,
    worker_max_tasks_per_child=1000,
    broker_connection_retry_on_startup=True,
)

celery_app.conf.beat_schedule = {
    "recalculate-prices-every-30-seconds": {
        "task": "app.worker.tasks.pricing.periodic_price_sweep",
        "schedule": 30.0,
    },
    "check-bankruptcies-every-10-seconds": {
        "task": "app.worker.tasks.bankruptcy.periodic_bankruptcy_check",
        "schedule": 10.0,
    },
}
