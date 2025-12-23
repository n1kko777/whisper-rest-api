from app.worker.celery_app import celery_app
from app.db.database import SessionLocal
from app.db import crud, models

@celery_app.task(name="transcribe_task")
def transcribe_task(task_id: str, language: str):
    db = SessionLocal()
    try:
        crud.update_task_status(db, task_id, models.TaskStatus.PROCESSING)
        # Simulate work
        import time
        time.sleep(5)
        crud.update_task_status(db, task_id, models.TaskStatus.SUCCESS, result="Simplified task executed without file_path")
        return "Simplified task executed without file_path"
    except Exception as e:
        crud.update_task_status(db, task_id, models.TaskStatus.FAILURE, result=str(e))
    finally:
        db.close()

@celery_app.task(name="health_check")
def health_check():
    return "Celery is healthy"