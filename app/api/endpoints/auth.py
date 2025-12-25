from datetime import timedelta
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, Form, HTTPException, status
from sqlalchemy.orm import Session
from jose import JWTError, jwt

from app.db import crud
from app.api import deps
from app.core import security
from app.core.config import settings
from app.core.security import create_access_token, verify_password

router = APIRouter()

class EmailPasswordForm:
    def __init__(self, email: str = Form(...), password: str = Form(...)):
        self.email = email
        self.password = password


def _ensure_github_oauth_configured():
    if not settings.GITHUB_CLIENT_ID or not settings.GITHUB_CLIENT_SECRET or not settings.GITHUB_REDIRECT_URI:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GitHub OAuth is not configured",
        )


def _extract_github_email(access_token: str) -> str:
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {access_token}",
    }

    try:
        user_response = httpx.get(
            "https://api.github.com/user",
            headers=headers,
            timeout=10,
        )
        user_response.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch GitHub profile",
        ) from exc

    user_data = user_response.json()
    email = user_data.get("email")

    if not email:
        try:
            emails_response = httpx.get(
                "https://api.github.com/user/emails",
                headers=headers,
                timeout=10,
            )
            emails_response.raise_for_status()
            emails_data = emails_response.json()
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to fetch GitHub email",
            ) from exc

        for entry in emails_data:
            if entry.get("primary") and entry.get("verified"):
                email = entry.get("email")
                break

        if not email:
            for entry in emails_data:
                if entry.get("verified"):
                    email = entry.get("email")
                    break

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GitHub account does not have a verified email address",
        )

    return email


@router.post("/register")
def register_user(
    form_data: EmailPasswordForm = Depends(),
    db: Session = Depends(deps.get_db),
):
    user = crud.get_user_by_email(db, email=form_data.email)
    if user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    crud.create_user(db=db, email=form_data.email, password=form_data.password)
    access_token = create_access_token(subject=form_data.email)
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/token")
def login_for_access_token(
    form_data: EmailPasswordForm = Depends(),
    db: Session = Depends(deps.get_db),
):
    user = crud.get_user_by_email(db, email=form_data.email)
    if not user or not user.hashed_password or not verify_password(
        form_data.password, user.hashed_password
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(subject=user.email)
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/github/login")
def github_login():
    _ensure_github_oauth_configured()

    state = create_access_token(
        subject="github_oauth", expires_delta=timedelta(minutes=10)
    )
    params = {
        "client_id": settings.GITHUB_CLIENT_ID,
        "redirect_uri": settings.GITHUB_REDIRECT_URI,
        "scope": "user:email",
        "state": state,
    }
    authorization_url = (
        "https://github.com/login/oauth/authorize?" + urlencode(params)
    )
    return {"authorization_url": authorization_url, "state": state}


@router.get("/github/callback")
def github_callback(code: str, state: str, db: Session = Depends(deps.get_db)):
    _ensure_github_oauth_configured()

    try:
        payload = jwt.decode(
            state, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        if payload.get("sub") != "github_oauth":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid OAuth state",
            )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OAuth state",
        ) from exc

    try:
        token_response = httpx.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": settings.GITHUB_REDIRECT_URI,
            },
            headers={"Accept": "application/json"},
            timeout=10,
        )
        token_response.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to exchange GitHub code",
        ) from exc

    github_access_token = token_response.json().get("access_token")
    if not github_access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid token response from GitHub",
        )

    email = _extract_github_email(github_access_token)
    user = crud.get_user_by_email(db, email=email)
    if not user:
        user = crud.create_user(db=db, email=email, password=None)

    access_token = create_access_token(subject=user.email)
    return {"access_token": access_token, "token_type": "bearer"}
