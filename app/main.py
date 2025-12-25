from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import auth, transcribe
from app.db.database import init_db

# Ensure tables exist when the API process starts
init_db()

app = FastAPI(title="Whisper REST API")

# Allow frontend dev server to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://192.168.0.17:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(transcribe.router, prefix="/api", tags=["transcribe"])

@app.get("/")
def read_root():
    return {"message": "Welcome to Whisper REST API"}
