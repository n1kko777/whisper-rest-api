from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def ensure_created_at_column():
    """Ensure tasks table has a created_at column for ordering."""
    inspector = inspect(engine)
    if not inspector.has_table("tasks"):
        return

    column_names = {column["name"] for column in inspector.get_columns("tasks")}
    if "created_at" in column_names:
        return

    ddl = (
        "ALTER TABLE tasks ADD COLUMN created_at DATETIME DEFAULT (CURRENT_TIMESTAMP)"
        if engine.dialect.name == "sqlite"
        else "ALTER TABLE tasks ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()"
    )

    with engine.begin() as connection:
        connection.execute(text(ddl))
