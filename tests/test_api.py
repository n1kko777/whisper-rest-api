from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
BASE_DIR = Path(__file__).resolve().parent.parent
TEST_AUDIO = BASE_DIR / "test.wav"


def register(email: str, password: str):
    return client.post(
        "/api/auth/register",
        data={"email": email, "password": password},
    )


def login(email: str, password: str):
    return client.post(
        "/api/auth/token",
        data={"email": email, "password": password},
    )


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Welcome to Whisper REST API"}


def test_register_and_login_flow():
    register_response = register("alice@example.com", "secret")
    assert register_response.status_code == 200
    assert "access_token" in register_response.json()

    login_response = login("alice@example.com", "secret")
    assert login_response.status_code == 200
    assert "access_token" in login_response.json()


def test_register_duplicate_email_is_rejected():
    first = register("bob@example.com", "secret")
    assert first.status_code == 200

    duplicate = register("bob@example.com", "another-secret")
    assert duplicate.status_code == 400
    assert duplicate.json()["detail"] == "Email already registered"


def test_transcribe_requires_authentication():
    with TEST_AUDIO.open("rb") as audio:
        response = client.post(
            "/api/transcribe",
            data={"language": "auto"},
            files={"file": ("test.wav", audio, "audio/wav")},
        )
    assert response.status_code == 401


def test_transcription_flow_updates_status_and_result():
    register_response = register("carol@example.com", "secret")
    token = register_response.json()["access_token"]

    with TEST_AUDIO.open("rb") as audio:
        transcribe_response = client.post(
            "/api/transcribe",
            data={"language": "auto"},
            files={"file": ("test.wav", audio, "audio/wav")},
            headers=auth_headers(token),
        )

    assert transcribe_response.status_code == 200
    task_id = transcribe_response.json()["task_id"]

    status_response = client.get(f"/api/status/{task_id}", headers=auth_headers(token))
    assert status_response.status_code == 200

    payload = status_response.json()
    assert payload["id"] == task_id
    assert payload["status"] == "SUCCESS"
    assert payload["result"]


def test_cannot_read_other_users_task():
    alice = register("alice@example.com", "secret").json()["access_token"]
    bob = register("bob@example.com", "secret").json()["access_token"]

    with TEST_AUDIO.open("rb") as audio:
        transcribe_response = client.post(
            "/api/transcribe",
            data={"language": "auto"},
            files={"file": ("test.wav", audio, "audio/wav")},
            headers=auth_headers(alice),
        )

    task_id = transcribe_response.json()["task_id"]

    forbidden = client.get(f"/api/status/{task_id}", headers=auth_headers(bob))
    assert forbidden.status_code == 403
