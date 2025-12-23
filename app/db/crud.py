from sqlalchemy.orm import Session
from app.db import models
from app.core.security import get_password_hash

def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def create_user(db: Session, username: str, password: str):
    hashed_password = get_password_hash(password)
    db_user = models.User(username=username, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_task(db: Session, task_id: str):
    return db.query(models.Task).filter(models.Task.id == task_id).first()

def get_tasks_for_user(db: Session, user_id: int):
    return db.query(models.Task).filter(models.Task.user_id == user_id).all()

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
