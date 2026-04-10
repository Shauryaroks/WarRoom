from celery import Celery

# Create Celery app
celery_app = Celery(
    "worker",
    broker="redis://redis:6379/0",
    backend="redis://redis:6379/0",
)

# Simple task
@celery_app.task
def hello():
    print("Hello from Celery worker!")
    return "Hello from worker"
