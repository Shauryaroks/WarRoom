"""Initialize database using SQLAlchemy create_all (bypasses Alembic)."""

import asyncio
from app.database import engine, Base
from app.models import *  # noqa: F401, F403


async def init():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Tables created via create_all")


asyncio.run(init())
