from contextlib import asynccontextmanager
import json
import logging
import os
import time

from fastapi import FastAPI, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

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
        if "GET /health" in msg or "GET / " in msg or '"GET / HTTP' in msg:
            return False
        return True


logging.getLogger("uvicorn.access").addFilter(_HealthFilter())


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log every non-health request and its response in structured JSON format."""

    SKIP_PATHS = {"/health", "/health/db", "/health/redis", "/"}

    async def dispatch(self, request: Request, call_next):
        if request.url.path in self.SKIP_PATHS or request.method == "OPTIONS":
            return await call_next(request)

        start = time.time()
        
        # --- 1. Parse Request Body ---
        req_body_dict = None
        req_body_str = None
        if request.method in ("POST", "PUT", "PATCH"):
            try:
                body_bytes = await request.body()
                req_body_str = body_bytes.decode("utf-8", errors="replace")
                
                if req_body_str:
                    try:
                        req_body_dict = json.loads(req_body_str)
                        # Mask password
                        for k in list(req_body_dict.keys()):
                            if "password" in k.lower():
                                req_body_dict[k] = "***"
                    except json.JSONDecodeError:
                        if len(req_body_str) > 500:
                            req_body_str = req_body_str[:500] + "...(truncated)"
            except Exception:
                req_body_str = "(unreadable)"

        # --- 2. Extract Auth ---
        api_key = request.headers.get("X-API-Key", "")
        admin_key = "admin" if request.headers.get("X-Admin-Key") else ""
        auth_tag = "admin" if admin_key else (f"...{api_key[-8:]}" if len(api_key) > 8 else "anonymous")

        # --- 3. Call Next ---
        response = await call_next(request)
        
        # --- 4. Parse Response Body ---
        res_body_dict = None
        res_body_str = None
        
        # Only attempt to read body if it's application/json to avoid breaking streams/SSE
        content_type = response.headers.get("content-type", "")
        if "application/json" in content_type:
            try:
                response_body_chunks = []
                async for chunk in response.body_iterator:
                    response_body_chunks.append(chunk)
                response_body = b"".join(response_body_chunks)
                
                # Reconstruct response so client still gets it
                response = Response(
                    content=response_body,
                    status_code=response.status_code,
                    headers=dict(response.headers),
                    media_type=response.media_type
                )
                
                res_body_str = response_body.decode("utf-8", errors="replace")
                if res_body_str:
                    try:
                        res_body_dict = json.loads(res_body_str)
                        # Optionally mask tokens in response
                        for k in list(res_body_dict.keys()):
                            if "api_key" in k.lower() or "token" in k.lower():
                                res_body_dict[k] = "***"
                    except json.JSONDecodeError:
                        if len(res_body_str) > 500:
                            res_body_str = res_body_str[:500] + "...(truncated)"
            except Exception:
                res_body_str = "(unreadable)"

        duration_ms = int((time.time() - start) * 1000)

        # --- 5. Log Structured JSON ---
        log_data = {
            "event": "api_request",
            "method": request.method,
            "path": request.url.path,
            "query": str(request.query_params),
            "status": response.status_code,
            "duration_ms": duration_ms,
            "auth": auth_tag,
            "client_ip": request.client.host if request.client else None,
        }
        
        if req_body_dict is not None:
            log_data["request_body"] = req_body_dict
        elif req_body_str:
            log_data["request_body_raw"] = req_body_str
            
        if res_body_dict is not None:
            log_data["response_body"] = res_body_dict
        elif res_body_str:
            log_data["response_body_raw"] = res_body_str

        logger.info(json.dumps(log_data))

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
