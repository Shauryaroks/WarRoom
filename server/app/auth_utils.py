import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, settings
from app.models import Team, Admin

security = HTTPBearer()


def create_access_token(
    subject_id: uuid.UUID,
    role: str,  # "strategist", "trader", or "admin"
    team_id: Optional[uuid.UUID] = None,
) -> str:
    if not settings.JWT_SECRET:
        raise ValueError("JWT_SECRET is not configured")
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(subject_id),
        "role": role,
        "iat": now,
        "exp": now + timedelta(hours=settings.JWT_EXPIRY_HOURS),
    }
    if team_id is not None:
        payload["team_id"] = str(team_id)
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    if not settings.JWT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="JWT_SECRET is not configured",
        )
    try:
        return jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired"
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Returns dict with keys: id, role, team_id (None for admin), entity (Team or Admin object)."""
    payload = decode_token(credentials.credentials)
    role = payload.get("role")
    subject_id = payload.get("sub")

    if not role or not subject_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing claims",
        )

    if role == "admin":
        result = await db.execute(
            select(Admin).where(Admin.id == uuid.UUID(subject_id))
        )
        admin = result.scalar_one_or_none()
        if not admin:
            raise HTTPException(status_code=401, detail="Admin not found")
        return {"id": admin.id, "role": "admin", "team_id": None, "entity": admin}
    else:
        team_id = payload.get("team_id")
        if not team_id:
            raise HTTPException(
                status_code=401, detail="Invalid token: missing team_id"
            )
        result = await db.execute(
            select(Team).where(Team.id == uuid.UUID(team_id))
        )
        team = result.scalar_one_or_none()
        if not team:
            raise HTTPException(status_code=401, detail="Team not found")
        return {
            "id": uuid.UUID(subject_id),
            "role": role,
            "team_id": team.id,
            "entity": team,
        }


async def require_admin(
    current_user: dict = Depends(get_current_user),
) -> dict:
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


async def require_team(
    current_user: dict = Depends(get_current_user),
) -> dict:
    if current_user["role"] not in ("strategist", "trader"):
        raise HTTPException(status_code=403, detail="Team access required")
    return current_user
