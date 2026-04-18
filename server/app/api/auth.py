import re
import uuid
from typing import Literal

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Team, TeamStatus
from app.auth_utils import create_access_token, get_current_user

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


# --- Pydantic Models ---


class RegisterRequest(BaseModel):
    team_name: str
    ticker: str
    email: EmailStr
    password: str

    @field_validator("team_name")
    @classmethod
    def validate_team_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3 or len(v) > 50:
            raise ValueError("Team name must be 3-50 characters")
        return v

    @field_validator("ticker")
    @classmethod
    def validate_ticker(cls, v: str) -> str:
        v = v.strip().upper()
        if not re.match(r"^[A-Z]{3,5}$", v):
            raise ValueError("Ticker must be 3-5 uppercase letters")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class RegisterResponse(BaseModel):
    message: str
    team_id: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    role: Literal["strategist", "trader"]


class LoginResponse(BaseModel):
    token: str
    team_id: str
    team_name: str
    ticker: str
    role: str


class MeResponse(BaseModel):
    team_id: str
    team_name: str
    ticker: str
    role: str
    status: str
    bcg_classification: str | None = None


# --- Utility ---


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


# --- Endpoints ---


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new team. Creates both strategist and trader sub-accounts (D-02)."""

    # Check ticker uniqueness
    result = await db.execute(select(Team).where(Team.ticker == request.ticker))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Ticker already taken")

    # Check email uniqueness across both strategist and trader emails
    result = await db.execute(
        select(Team).where(
            or_(
                Team.strategist_email == request.email,
                Team.trader_email == request.email,
            )
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    # Hash password (same for both sub-accounts initially)
    password_hash = hash_password(request.password)

    # Create team with dual credentials (D-01)
    team = Team(
        name=request.team_name,
        ticker=request.ticker,
        strategist_email=request.email,
        strategist_password_hash=password_hash,
        trader_email=request.email,
        trader_password_hash=password_hash,
        status=TeamStatus.PENDING,
    )

    db.add(team)
    await db.commit()
    await db.refresh(team)

    return RegisterResponse(
        message="Team registered successfully. Awaiting admin approval.",
        team_id=str(team.id),
    )


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Team login with role selection. Returns JWT with team_id and role claims."""

    # Look up team by email matching the requested role
    if request.role == "strategist":
        result = await db.execute(
            select(Team).where(Team.strategist_email == request.email)
        )
    else:
        result = await db.execute(
            select(Team).where(Team.trader_email == request.email)
        )

    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Verify password against role-specific hash
    if request.role == "strategist":
        password_valid = verify_password(
            request.password, team.strategist_password_hash
        )
    else:
        password_valid = verify_password(request.password, team.trader_password_hash)

    if not password_valid:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Check team approval status
    if team.status == TeamStatus.PENDING:
        raise HTTPException(status_code=403, detail="Team not yet approved by admin")
    if team.status == TeamStatus.REJECTED:
        raise HTTPException(status_code=403, detail="Team registration was rejected")

    # Create JWT
    token = create_access_token(
        subject_id=team.id,
        role=request.role,
        team_id=team.id,
    )

    return LoginResponse(
        token=token,
        team_id=str(team.id),
        team_name=team.name,
        ticker=team.ticker,
        role=request.role,
    )


@router.get("/me", response_model=MeResponse)
async def me(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user info."""
    entity = current_user["entity"]

    if current_user["role"] == "admin":
        return MeResponse(
            team_id="",
            team_name="Admin",
            ticker="",
            role="admin",
            status="active",
        )

    return MeResponse(
        team_id=str(entity.id),
        team_name=entity.name,
        ticker=entity.ticker,
        role=current_user["role"],
        status=entity.status.value,
        bcg_classification=entity.bcg_classification,
    )
