import asyncio
import logging
import os
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.api import admin, auth, decisions, game, market, solutions, teams, trading
from app.auth_utils import decode_token
from app.redis_pubsub import start_redis_relay
from app.services.game_service import warm_redis_cache
from app.websocket import manager

logger = logging.getLogger("complex")


# --- Lifespan ---


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm Redis cache from DB on startup (Pitfall 4: prevents stale state after crash)
    await warm_redis_cache()
    # Startup: start Redis pub/sub relay as background task
    relay_task = asyncio.create_task(start_redis_relay())
    logger.info("Redis pub/sub relay task started")
    yield
    # Shutdown: cancel relay
    relay_task.cancel()
    try:
        await relay_task
    except asyncio.CancelledError:
        pass
    logger.info("Redis pub/sub relay task stopped")


# --- App ---

app = FastAPI(
    title="Complex API",
    description="Case Competition Platform Backend",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow ALL origins. `allow_origin_regex=".*"` is used instead of
# `allow_origins=["*"]` because the latter is rejected by browsers when
# `allow_credentials=True`. The regex path echoes each request's Origin back,
# which browsers accept with credentials.
_origins_env = os.getenv("CORS_ALLOW_ORIGINS")
if _origins_env and _origins_env.strip() and _origins_env.strip() != "*":
    # Explicit list via env — honour it
    _allowed_origins = [o.strip() for o in _origins_env.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    # Default (or CORS_ALLOW_ORIGINS="*"): allow all origins via regex
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=".*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


# --- Request Logging Middleware ---


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Skip health check logging to reduce noise
        if request.url.path == "/health":
            return await call_next(request)

        start = time.time()
        response = await call_next(request)
        duration_ms = (time.time() - start) * 1000

        logger.info(
            "%s %s %d %.1fms",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
        return response


app.add_middleware(RequestLoggingMiddleware)


# --- Routers ---

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(teams.router)
app.include_router(trading.router)
app.include_router(market.router)
app.include_router(solutions.router)
app.include_router(decisions.router)
app.include_router(game.router)


# --- WebSocket Endpoint ---


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()

    # Step 1: Authenticate -- expect first message to be {"type": "auth", "token": "..."}
    try:
        auth_msg = await asyncio.wait_for(ws.receive_json(), timeout=10.0)
    except (asyncio.TimeoutError, Exception):
        await ws.close(code=4001, reason="Authentication timeout")
        return

    if auth_msg.get("type") != "auth" or "token" not in auth_msg:
        await ws.close(code=4002, reason="Expected auth message")
        return

    try:
        payload = decode_token(auth_msg["token"])
    except HTTPException:
        await ws.close(code=4003, reason="Invalid token")
        return

    role = payload.get("role", "")
    team_id = None
    if role in ("strategist", "trader"):
        team_id_str = payload.get("team_id")
        if team_id_str:
            team_id = uuid.UUID(team_id_str)

    # Step 2: Register connection
    manager.add(ws, team_id, role)

    # Step 3: Send welcome message
    await ws.send_json({
        "type": "connected",
        "payload": {
            "role": role,
            "team_id": str(team_id) if team_id else None,
            "connections": manager.connection_count,
        }
    })

    # Step 4: Listen for messages + ping/pong heartbeat
    try:
        while True:
            try:
                data = await asyncio.wait_for(ws.receive_json(), timeout=30.0)
                # Handle client messages (ping, sync_request, etc.)
                if data.get("type") == "ping":
                    await ws.send_json({"type": "pong"})
            except asyncio.TimeoutError:
                # Send server-initiated ping to keep connection alive through Caddy
                try:
                    await ws.send_json({"type": "ping"})
                except Exception:
                    break
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error("WebSocket error: %s", e)
    finally:
        manager.remove(ws)


# --- Health Check ---


@app.get("/health")
async def health():
    return {"status": "ok", "ws_connections": manager.connection_count}
