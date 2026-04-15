import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.api import admin, auth, teams

logger = logging.getLogger("complex")


# --- Lifespan ---


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: future Redis pub/sub subscription goes here
    logger.info("Complex API starting up")
    yield
    # Shutdown: cleanup
    logger.info("Complex API shutting down")


# --- App ---

app = FastAPI(
    title="Complex API",
    description="Case Competition Platform Backend",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware (T-03-05: accept risk for competition app)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Vercel frontend -- restrict in production
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


# --- Health Check ---


@app.get("/health")
async def health():
    return {"status": "ok"}
