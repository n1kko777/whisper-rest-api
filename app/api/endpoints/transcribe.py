import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.orm import Session

from app.db import crud, models
from app.api import deps
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
    upload_dir = Path("uploads")
    upload_dir.mkdir(exist_ok=True)
    file_path = upload_dir / f"{task_id}_{file.filename}"
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    crud.create_task(db, task_id, current_user.id)
    
    transcribe_task.delay(task_id, language)

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

    return {"status": task.status, "result": task.result}

@router.post("/health-check")
def run_health_check():
    task = health_check.delay()
    return {"task_id": task.id}
