<!-- generated-by: gsd-doc-writer -->
# Backend FastAPI Server Overview

The backend is built with FastAPI and runs the entire simulation engine, including team validation, real-time market updates, LLM evaluation pipelines, and portfolio management.

## Key Directories

- `server/app/api/`: FastAPI route handlers for REST endpoints and WebSockets.
- `server/app/models.py`: SQLAlchemy ORM definitions for PostgreSQL.
- `server/app/schemas/`: Pydantic models for request/response validation.
- `server/app/services/`: Core business logic and database interactions.
- `server/app/worker/`: Celery tasks and background processes.
- `server/app/websocket.py`: WebSocket connection management.
- `server/app/redis_pubsub.py`: Redis-backed pub/sub for cross-worker WebSocket broadcast.

## Architecture Highlights

The server uses an asynchronous architecture (FastAPI, SQLAlchemy async mode with asyncpg) to handle up to 80 concurrent WebSocket connections without blocking the main event loop. Background tasks, including scheduled market ticks and LLM evaluations, are managed by Celery and Redis.
