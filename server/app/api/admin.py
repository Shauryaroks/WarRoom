import uuid
from datetime import datetime, timezone
from typing import Optional

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Admin, Team, TeamStatus
from app.auth_utils import create_access_token, require_admin

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


# --- Pydantic Models ---


class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str


class AdminLoginResponse(BaseModel):
    token: str
    role: str


class AdminSeedRequest(BaseModel):
    email: EmailStr
    password: str


class AdminSeedResponse(BaseModel):
    message: str
    admin_id: str


class TeamListItem(BaseModel):
    id: str
    name: str
    ticker: str
    status: str
    strategist_email: str
    trader_email: str
    created_at: str


class TeamActionResponse(BaseModel):
    message: str
    team_id: str
    new_status: str


# --- Utility ---


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


# --- Endpoints ---


@router.post("/login", response_model=AdminLoginResponse)
async def admin_login(
    request: AdminLoginRequest, db: AsyncSession = Depends(get_db)
):
    """Admin login. Separate from team login per D-03."""
    result = await db.execute(select(Admin).where(Admin.email == request.email))
    admin = result.scalar_one_or_none()

    if not admin or not verify_password(request.password, admin.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(subject_id=admin.id, role="admin")

    return AdminLoginResponse(token=token, role="admin")


@router.post(
    "/seed",
    response_model=AdminSeedResponse,
    status_code=status.HTTP_201_CREATED,
)
async def seed_admin(
    request: AdminSeedRequest, db: AsyncSession = Depends(get_db)
):
    """Bootstrap initial admin account. Only works if no admins exist (T-03-02 mitigation)."""
    result = await db.execute(select(func.count()).select_from(Admin))
    count = result.scalar()

    if count and count > 0:
        raise HTTPException(status_code=409, detail="Admin already exists")

    admin = Admin(
        email=request.email,
        password_hash=hash_password(request.password),
    )

    db.add(admin)
    await db.commit()
    await db.refresh(admin)

    return AdminSeedResponse(
        message="Admin account created successfully",
        admin_id=str(admin.id),
    )


@router.get("/teams", response_model=list[TeamListItem])
async def list_teams(
    status_filter: Optional[str] = Query(None, alias="status"),
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all teams. Optionally filter by status. Requires admin."""
    query = select(Team).order_by(Team.created_at.desc())

    if status_filter:
        try:
            team_status = TeamStatus(status_filter)
            query = query.where(Team.status == team_status)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status: {status_filter}. Valid: {[s.value for s in TeamStatus]}",
            )

    result = await db.execute(query)
    teams = result.scalars().all()

    return [
        TeamListItem(
            id=str(t.id),
            name=t.name,
            ticker=t.ticker,
            status=t.status.value,
            strategist_email=t.strategist_email,
            trader_email=t.trader_email,
            created_at=t.created_at.isoformat(),
        )
        for t in teams
    ]


@router.post("/teams/{team_id}/approve", response_model=TeamActionResponse)
async def approve_team(
    team_id: uuid.UUID,
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Approve a pending team registration. Requires admin."""
    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()

    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    if team.status != TeamStatus.PENDING:
        raise HTTPException(status_code=409, detail="Team is not in pending status")

    team.status = TeamStatus.READY
    team.approved_at = datetime.now(timezone.utc)
    await db.commit()

    return TeamActionResponse(
        message=f"Team '{team.name}' approved",
        team_id=str(team.id),
        new_status=TeamStatus.READY.value,
    )


@router.post("/teams/{team_id}/reject", response_model=TeamActionResponse)
async def reject_team(
    team_id: uuid.UUID,
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Reject a pending team registration. Requires admin."""
    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()

    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    if team.status != TeamStatus.PENDING:
        raise HTTPException(status_code=409, detail="Team is not in pending status")

    team.status = TeamStatus.REJECTED
    await db.commit()

    return TeamActionResponse(
        message=f"Team '{team.name}' rejected",
        team_id=str(team.id),
        new_status=TeamStatus.REJECTED.value,
    )
