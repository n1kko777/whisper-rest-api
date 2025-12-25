import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.db import crud, models
from app.api import deps
from app.core.config import settings
from app.worker.tasks import transcribe_task, health_check

router = APIRouter()

@router.post("/transcribe")
def create_transcription_task(
    language: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    task_id = str(uuid.uuid4())
    
    # Save the uploaded file temporarily
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / f"{task_id}_{file.filename}"
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    crud.create_task(db, task_id, current_user.id)
    
    try:
        transcribe_task.delay(task_id, language, str(file_path))
    except Exception as exc:
        crud.update_task_status(db, task_id, models.TaskStatus.FAILURE, result=str(exc))
        file_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not enqueue transcription task",
        ) from exc

    return {"task_id": task_id}


@router.get("/status/{task_id}")
def get_transcription_status(
    task_id: str,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    task = crud.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    
    if task.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this task")

    return {"id": task.id, "status": task.status, "result": task.result}

@router.get("/tasks")
def list_user_tasks(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    tasks = crud.get_tasks_for_user(db, current_user.id)
    return [
        {
            "id": task.id,
            "status": task.status,
            "result": task.result,
            "created_at": task.created_at,
        }
        for task in tasks
    ]


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user_task(
    task_id: str,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    task = crud.get_task(db, task_id)
    if not task:
        # Treat deletes as idempotent so removing an already-missing task still succeeds
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    if task.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this task")

    crud.delete_task(db, task_id, current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.post("/health-check")
def run_health_check():
    task = health_check.delay()
    return {"task_id": task.id}
