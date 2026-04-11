from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import bcrypt
import uuid

from app.database import get_db, settings as app_settings
from app.models import Team, TeamStatus

router = APIRouter(prefix="/auth", tags=["auth"])

api_key_header = APIKeyHeader(name="X-API-Key")


async def verify_admin_key(
    x_admin_key: Optional[str] = Header(None, alias="X-Admin-Key"),
) -> bool:
    """Dependency that verifies admin key from X-Admin-Key header. Raises 403 if invalid."""
    if not x_admin_key or x_admin_key != app_settings.ADMIN_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing admin key",
        )
    return True


async def get_current_team(
    api_key: str = Depends(api_key_header),
    db: AsyncSession = Depends(get_db),
) -> Team:
    stmt = select(Team).where(Team.api_key == api_key)
    result = await db.execute(stmt)
    team = result.scalar_one_or_none()

    if not team:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )

    if team.status == TeamStatus.REJECTED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your registration was rejected",
        )

    return team


# --- Registration ---


class RegisterRequest(BaseModel):
    team_name: str = Field(..., min_length=3, max_length=50)
    ticker: str = Field(..., min_length=3, max_length=4, pattern=r"^[A-Z]{3,4}$")
    email: EmailStr
    password: str = Field(..., min_length=8)


class RegisterResponse(BaseModel):
    message: str
    registration_id: str


@router.post("/register", response_model=RegisterResponse, status_code=202)
async def register_team(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check ticker uniqueness
    stmt = select(Team).where(Team.ticker == "$" + request.ticker.upper())
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ticker already exists",
        )

    # Check team name uniqueness
    stmt = select(Team).where(Team.name == request.team_name)
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Team name already exists",
        )

    password_hash = bcrypt.hashpw(request.password.encode(), bcrypt.gensalt()).decode()

    team = Team(
        name=request.team_name,
        ticker="$" + request.ticker.upper(),
        email=request.email,
        password_hash=password_hash,
        status=TeamStatus.PENDING,
    )
    db.add(team)
    await db.commit()
    await db.refresh(team)

    return RegisterResponse(
        message="Registration pending admin approval",
        registration_id=str(team.id),
    )


# --- Login ---


class LoginRequest(BaseModel):
    ticker: str
    password: str


class LoginResponse(BaseModel):
    api_key: str
    team_name: str
    ticker: str
    status: str
    ws_endpoint: str


@router.post("/login", response_model=LoginResponse)
async def login_team(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    # Normalize ticker: accept with or without $ prefix
    ticker = request.ticker.upper()
    if not ticker.startswith("$"):
        ticker = "$" + ticker

    stmt = select(Team).where(Team.ticker == ticker)
    result = await db.execute(stmt)
    team = result.scalar_one_or_none()

    if not team or not bcrypt.checkpw(
        request.password.encode(), team.password_hash.encode()
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid ticker or password",
        )

    return LoginResponse(
        api_key=str(team.api_key),
        team_name=team.name,
        ticker=team.ticker,
        status=team.status.value,
        ws_endpoint=f"/ws/team/{team.api_key}",
    )
