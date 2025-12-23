from fastapi import FastAPI
from app.api.endpoints import auth, transcribe
from app.db import models
from app.db.database import engine

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Whisper REST API")

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(transcribe.router, prefix="/api", tags=["transcribe"])

@app.get("/")
def read_root():
    return {"message": "Welcome to Whisper REST API"}
