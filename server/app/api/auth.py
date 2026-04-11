from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import bcrypt
import uuid

from app.database import get_db
from app.models import Team, TeamStatus, PortfolioType

router = APIRouter(prefix="/auth", tags=["auth"])

api_key_header = APIKeyHeader(name="X-API-Key")


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


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=3, max_length=50)
    ticker: str = Field(..., min_length=3, max_length=4)
    email: EmailStr
    password: str = Field(..., min_length=8)


class RegisterResponse(BaseModel):
    team_id: str
    name: str
    ticker: str
    status: str
    message: str


@router.post("/register", response_model=RegisterResponse)
async def register_team(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(Team).where(Team.ticker == request.ticker.upper())
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ticker already exists",
        )

    stmt = select(Team).where(Team.email == request.email)
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    password_hash = bcrypt.hashpw(request.password.encode(), bcrypt.gensalt()).decode()

    team = Team(
        name=request.name,
        ticker="$" + request.ticker.upper(),
        email=request.email,
        password_hash=password_hash,
        status=TeamStatus.PENDING_APPROVAL,
    )
    db.add(team)
    await db.commit()
    await db.refresh(team)

    return RegisterResponse(
        team_id=str(team.id),
        name=team.name,
        ticker=team.ticker,
        status=team.status.value,
        message="Registration submitted. Awaiting admin approval.",
    )


class LoginResponse(BaseModel):
    team_id: str
    name: str
    ticker: str
    status: str
    api_key: str


@router.post("/login", response_model=LoginResponse)
async def login_team(
    email: str,
    password: str,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Team).where(Team.email == email)
    result = await db.execute(stmt)
    team = result.scalar_one_or_none()

    if not team or not bcrypt.checkpw(password.encode(), team.password_hash.encode()):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    return LoginResponse(
        team_id=str(team.id),
        name=team.name,
        ticker=team.ticker,
        status=team.status.value,
        api_key=str(team.api_key),
    )


class TeamStatusResponse(BaseModel):
    team_id: str
    name: str
    ticker: str
    status: str
    cash: float
    stock_price: float
    cooldown_until: Optional[str]
    portfolio_type: Optional[str]
    swot: Optional[dict]


@router.get("/me", response_model=TeamStatusResponse)
async def get_my_team(team: Team = Depends(get_current_team)):
    return TeamStatusResponse(
        team_id=str(team.id),
        name=team.name,
        ticker=team.ticker,
        status=team.status.value,
        cash=float(team.cash),
        stock_price=float(team.stock_price),
        cooldown_until=team.cooldown_until.isoformat() if team.cooldown_until else None,
        portfolio_type=team.portfolio_type.value if team.portfolio_type else None,
        swot={
            "strengths": team.swot_strengths,
            "weaknesses": team.swot_weaknesses,
            "opportunities": team.swot_opportunities,
            "threats": team.swot_threats,
        }
        if team.swot_strengths
        else None,
    )
