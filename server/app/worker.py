import os
from celery import Celery

# Get URL from environment, fallback to a local default if missing
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "worker",
    broker=REDIS_URL,
    backend=REDIS_URL,
)

@celery_app.task
def hello():
    print("Hello from Celery worker!")
    return "Hello from worker"
