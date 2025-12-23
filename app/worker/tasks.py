import os
from pathlib import Path

from app.worker.celery_app import celery_app
from app.db.database import SessionLocal
from app.db import crud, models

USE_FAKE_TRANSCRIPTION = os.environ.get("USE_FAKE_TRANSCRIPTION", "false").lower() == "true"
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "tiny")


def _transcribe_audio(file_path: Path, language: str) -> str:
    """Transcribe audio with Whisper or fall back to a lightweight stub in tests."""
    if USE_FAKE_TRANSCRIPTION:
        return f"Transcription placeholder for {file_path.name}"

    import whisper  # Imported lazily to avoid heavy startup when faked

    model = whisper.load_model(WHISPER_MODEL)
    options = {} if language == "auto" else {"language": language}
    result = model.transcribe(str(file_path), **options)
    text = result.get("text", "").strip()
    if not text:
        raise RuntimeError("Transcription failed: empty result")
    return text


@celery_app.task(name="transcribe_task")
def transcribe_task(task_id: str, language: str, file_path: str):
    db = SessionLocal()
    path = Path(file_path)
    try:
        crud.update_task_status(db, task_id, models.TaskStatus.PROCESSING)
        if not path.exists():
            raise FileNotFoundError(f"Uploaded file not found at {file_path}")

        transcription = _transcribe_audio(path, language)
        crud.update_task_status(db, task_id, models.TaskStatus.SUCCESS, result=transcription)
        return transcription
    except Exception as e:
        crud.update_task_status(db, task_id, models.TaskStatus.FAILURE, result=str(e))
        raise
    finally:
        if path.exists():
            path.unlink(missing_ok=True)
        db.close()


@celery_app.task(name="health_check")
def health_check():
    return "Celery is healthy"
