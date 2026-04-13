# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WarRoom is a real-time multiplayer business simulation game. Teams register, receive company profiles, submit strategic directives evaluated by an LLM, trade stocks, and survive periodic purges. Monorepo with a Next.js frontend (`client/`) and FastAPI backend (`server/`).

## Commands

### Frontend (`client/`)

```bash
cd client && bun install        # Install dependencies
npm run dev                     # Dev server on :3000
npm run build                   # Production build
npm run lint                    # ESLint
```

### Backend (`server/`)

```bash
cd server && uv sync                          # Install dependencies
uv run uvicorn app.main:app --host 0.0.0.0 --port 80  # Start API server
uv run celery -A app.worker worker --beat --loglevel=info  # Celery worker + beat
uv run alembic upgrade head                   # Run migrations
uv run pytest                                 # Run tests
uv run pytest tests/test_foo.py::test_bar     # Single test
uv run ruff check                             # Lint
uv run ruff format                            # Format
uv run mypy                                   # Type check
```

### Docker (full stack)

```bash
docker compose up -d            # Start all services (db, redis, api, worker, caddy)
docker compose build api worker # Rebuild after code changes
```

## Architecture

**Frontend**: Next.js 16 (App Router) + React 19 + TailwindCSS 4 + Zod 4. Uses `@/*` path alias mapped to `./src/*`.

**Backend**: FastAPI + SQLAlchemy 2 async + asyncpg (PostgreSQL 15) + Celery (Redis broker). All routes are async.

**Real-time**: WebSocket via a singleton `ConnectionManager` in `server/app/websocket.py`. Frontend connects through `WebSocketContext`.

**Background jobs**: Celery beat runs `periodic_price_sweep` (30s) and `periodic_bankruptcy_check` (10s). LLM directive processing is also a Celery task.

### Key data flow

1. Client authenticates via `/api/v1/auth/` → receives `api_key` (stored in localStorage)
2. Authenticated requests use `X-API-Key` header; admin endpoints use `X-Admin-Key`
3. Game actions (trades, directives) go through REST; real-time updates push via WebSocket
4. Celery workers handle LLM calls (directive evaluation), price recalculation, bankruptcy checks, and news generation

### API routers (`server/app/api/`)

`auth.py`, `game.py`, `teams.py`, `trading.py`, `directive.py`, `market.py`, `news.py`, `admin.py` — all mounted under `/api/v1/`

### Frontend contexts (`client/src/contexts/`)

`AuthContext` (login state + API key), `GameContext` (game state), `WebSocketContext` (real-time connection) — all mounted in root `layout.tsx`

### Frontend API client

`client/src/lib/api.ts` — centralized `authFetch()` wrapper. `client/src/lib/models.ts` — Zod schemas and TypeScript types.

## Configuration

Backend config via `server/.env` with pydantic-settings (`server/app/database.py`):

- `DATABASE_URL` — PostgreSQL connection string (uses `postgresql+asyncpg://`)
- `REDIS_URL` — Redis connection
- `ADMIN_API_KEY` — admin auth token
- `OPENROUTER_API_KEY` / `OPENROUTER_BASE_URL` — LLM API

Frontend config via `client/.env` with `NEXT_PUBLIC_*` prefix:

- `NEXT_PUBLIC_API_URL` — backend base URL

## Important Notes

- **Next.js 16 has breaking changes** from earlier versions. Read guides in `node_modules/next/dist/docs/` before writing frontend code. Heed deprecation notices.
- Database models are in `server/app/models.py`. Migrations in `server/alembic/versions/`.
- Backend auth uses FastAPI `Depends()` — see `verify_api_key` and `verify_admin_key` patterns.
- Frontend uses `@/` import alias (mapped to `src/`).
- Deployment: frontend on Vercel, backend via Docker + SSH (GitHub Actions).
