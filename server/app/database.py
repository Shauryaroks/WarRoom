from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/complex"
    REDIS_URL: str = "redis://localhost:6379/0"
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    ADMIN_API_KEY: str = "admin-secret-key"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()


class Base(DeclarativeBase):
    pass


engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_size=20,
    max_overflow=0,
    connect_args={"prepared_statement_cache_size": 0},
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


@asynccontextmanager
async def get_db_session():
    async with AsyncSessionLocal() as session:
        yield session
        await session.commit()


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@asynccontextmanager
async def get_worker_session():
    """
    Create a fresh engine + session for Celery worker tasks.
    Avoids asyncpg connection pool conflicts in forked processes.
    Each call creates and disposes its own engine.
    """
    worker_engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
        pool_size=5,
        max_overflow=0,
        connect_args={"prepared_statement_cache_size": 0},
    )
    worker_session = async_sessionmaker(
        worker_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with worker_session() as session:
        try:
            yield session
        finally:
            await worker_engine.dispose()
