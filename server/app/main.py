from contextlib import asynccontextmanager
import os

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from app.database import AsyncSessionLocal
from app.api import auth, trading, directive, market, admin, teams, game
from app.api import news
from app.models import GameState, GameStatus
from app.websocket import manager, handle_market_ws, handle_team_ws


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Tables are managed by Alembic migrations (alembic upgrade head runs before app starts).
    # Seed default GameState if it doesn't exist.
    async with AsyncSessionLocal() as db:
        gs = await db.get(GameState, 1)
        if not gs:
            gs = GameState(
                id=1,
                status=GameStatus.SETUP,
                current_round=0,
                cooldown_minutes=10,
            )
            db.add(gs)
            await db.commit()

    yield


app = FastAPI(
    title="WarRoom API",
    description="Business Simulation Game Backend",
    version="0.1.0",
    lifespan=lifespan,
)

#TODO add middleware properly

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(trading.router, prefix="/api/v1")
app.include_router(directive.router, prefix="/api/v1")
app.include_router(market.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(teams.router, prefix="/api/v1")
app.include_router(game.router, prefix="/api/v1")
app.include_router(news.router, prefix="/api/v1")


@app.get("/")
async def root():
    return {"message": "WarRoom API is running", "version": "0.1.0"}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/health/db")
async def health_db():
    try:
        from sqlalchemy import text

        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "database": "disconnected", "error": str(e)}


@app.get("/health/redis")
async def health_redis():
    try:
        import redis.asyncio as aioredis

        r = await aioredis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"))
        await r.ping()
        return {"status": "ok", "redis": "connected"}
    except Exception as e:
        return {"status": "error", "redis": "disconnected", "error": str(e)}


@app.websocket("/ws/market")
async def ws_market(websocket: WebSocket):
    await handle_market_ws(websocket)


@app.websocket("/ws/team/{api_key}")
async def ws_team(websocket: WebSocket, api_key: str):
    await handle_team_ws(websocket, api_key)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
