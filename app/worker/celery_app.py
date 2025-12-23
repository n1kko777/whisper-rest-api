import os
from celery import Celery

broker_url = os.environ.get("CELERY_BROKER_URL", "redis://redis:6379/0")
result_backend = os.environ.get("CELERY_RESULT_BACKEND", broker_url)

celery_app = Celery(
    "worker",
    broker=broker_url,
    backend=result_backend,
    include=["app.worker.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_always_eager=os.environ.get("CELERY_TASK_ALWAYS_EAGER", "false").lower() == "true",
    task_eager_propagates=os.environ.get("CELERY_TASK_EAGER_PROPAGATES", "true").lower() == "true",
)
