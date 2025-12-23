import os
import shutil
from pathlib import Path

import pytest

# Ensure required settings exist before the app is imported in tests
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("UPLOAD_DIR", "uploads")
os.environ.setdefault("CELERY_TASK_ALWAYS_EAGER", "true")
os.environ.setdefault("CELERY_TASK_EAGER_PROPAGATES", "true")
os.environ.setdefault("CELERY_BROKER_URL", "memory://")
os.environ.setdefault("CELERY_RESULT_BACKEND", "cache+memory://")
os.environ.setdefault("USE_FAKE_TRANSCRIPTION", "true")

from app.db import models  # noqa: E402
from app.db.database import engine  # noqa: E402


@pytest.fixture(autouse=True)
def reset_state():
    """Clean database schema and uploads directory between tests."""
    models.Base.metadata.drop_all(bind=engine)
    models.Base.metadata.create_all(bind=engine)
    upload_dir = Path(os.environ.get("UPLOAD_DIR", "uploads"))
    if upload_dir.exists():
        shutil.rmtree(upload_dir)
    yield
    models.Base.metadata.drop_all(bind=engine)
    if upload_dir.exists():
        shutil.rmtree(upload_dir)
