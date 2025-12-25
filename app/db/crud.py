from typing import Optional

from sqlalchemy.orm import Session

from app.db import models
from app.core.security import get_password_hash


def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()


def create_user(db: Session, email: str, password: Optional[str]):
    hashed_password = get_password_hash(password) if password else None
    db_user = models.User(email=email, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_task(db: Session, task_id: str):
    return db.query(models.Task).filter(models.Task.id == task_id).first()

def get_tasks_for_user(db: Session, user_id: int):
    return (
        db.query(models.Task)
        .filter(models.Task.user_id == user_id)
        .order_by(models.Task.created_at.desc())
        .all()
    )

def create_task(db: Session, task_id: str, user_id: int):
    db_task = models.Task(id=task_id, user_id=user_id)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

def update_task_status(db: Session, task_id: str, status: models.TaskStatus, result: str = None):
    db_task = get_task(db, task_id)
    if db_task:
        db_task.status = status
        db_task.result = result
        db.commit()
        db.refresh(db_task)
    return db_task

def delete_task(db: Session, task_id: str, user_id: int):
    task = (
        db.query(models.Task)
        .filter(models.Task.id == task_id, models.Task.user_id == user_id)
        .first()
    )
    if not task:
        return False

    db.delete(task)
    db.commit()
    return True
