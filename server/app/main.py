from contextlib import asynccontextmanager
import os

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base, AsyncSessionLocal
from app.api import auth, trading, directive, market, admin
from app.worker.celery_app import celery_app
from app.models import GameSettings
from app.websocket import manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        settings = await db.get(GameSettings, 1)
        if not settings:
            settings = GameSettings(
                id=1,
                game_active=False,
                current_purge_count=0,
                cooldown_minutes=10,
            )
            db.add(settings)
            await db.commit()

    yield


app = FastAPI(
    title="WarRoom API",
    description="Business Simulation Game Backend",
    version="0.1.0",
    lifespan=lifespan,
)

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


@app.get("/")
async def root():
    return {"message": "WarRoom API is running", "version": "0.1.0"}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/health/db")
async def health_db():
    try:
        async with AsyncSessionLocal() as db:
            await db.execute("SELECT 1")
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


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, team_id: str = None):
    from datetime import datetime, timezone
    import json

    await manager.connect(websocket, team_id)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            if message.get("type") == "ping":
                await manager.send_personal_message(
                    {
                        "type": "pong",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                    websocket,
                )
            elif message.get("type") == "subscribe":
                channel = message.get("channel")
                if channel:
                    await manager.connect(websocket, channel.replace("team:", ""))

    except WebSocketDisconnect:
        await manager.disconnect(websocket, team_id)
    except Exception:
        await manager.disconnect(websocket, team_id)
    except Exception:
        await manager.disconnect(websocket, team_id)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
