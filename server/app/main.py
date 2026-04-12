from contextlib import asynccontextmanager
import json
import logging
import os
import time

from fastapi import FastAPI, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.database import AsyncSessionLocal
from app.api import auth, trading, directive, market, admin, teams, game
from app.api import news
from app.models import GameState, GameStatus
from app.websocket import manager, handle_market_ws, handle_team_ws

logger = logging.getLogger("warroom")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-5s %(message)s",
    datefmt="%H:%M:%S",
)


# Silence uvicorn access logs for health checks
class _HealthFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        # Silence health checks and Caddy root polls
        if "GET /health" in msg or 'GET / ' in msg or '"GET / HTTP' in msg:
            return False
        return True


logging.getLogger("uvicorn.access").addFilter(_HealthFilter())


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log every non-health request with method, path, status, duration, and body preview."""

    SKIP_PATHS = {"/health", "/health/db", "/health/redis", "/"}

    async def dispatch(self, request: Request, call_next):
        if request.url.path in self.SKIP_PATHS or request.method == "OPTIONS":
            return await call_next(request)

        start = time.time()

        # Read body for POST/PUT/PATCH (cache it so the route can still read it)
        body_preview = ""
        if request.method in ("POST", "PUT", "PATCH"):
            try:
                body_bytes = await request.body()
                body_str = body_bytes.decode("utf-8", errors="replace")
                # Truncate large bodies, mask passwords
                if len(body_str) > 500:
                    body_str = body_str[:500] + "...(truncated)"
                if "password" in body_str.lower():
                    try:
                        body_dict = json.loads(body_str)
                        for k in list(body_dict.keys()):
                            if "password" in k.lower():
                                body_dict[k] = "***"
                        body_str = json.dumps(body_dict)
                    except (json.JSONDecodeError, TypeError):
                        pass
                body_preview = f" body={body_str}"
            except Exception:
                body_preview = " body=(unreadable)"

        # Who is calling
        api_key = request.headers.get("X-API-Key", "")
        admin_key = "admin" if request.headers.get("X-Admin-Key") else ""
        auth_tag = (
            f" auth=admin"
            if admin_key
            else (f" key=...{api_key[-8:]}" if len(api_key) > 8 else "")
        )

        response = await call_next(request)
        duration_ms = int((time.time() - start) * 1000)

        logger.info(
            "%s %s → %d (%dms)%s%s",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            auth_tag,
            body_preview,
        )

        return response


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

app.add_middleware(RequestLoggingMiddleware)
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
