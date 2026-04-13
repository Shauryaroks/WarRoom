# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WarRoom is a real-time multiplayer business simulation game. Teams register, receive company profiles (SWOT), submit strategic directives evaluated by an LLM, trade stocks, and survive periodic purges. Monorepo with a Next.js frontend (`client/`) and FastAPI backend (`server/`).

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

**Real-time**: WebSocket via a singleton `ConnectionManager` in `server/app/websocket.py`. Two endpoints: `/ws/market` (public feed) and `/ws/team/{api_key}` (private team feed). Frontend connects through `WebSocketContext`.

**Background jobs**: Celery beat runs `periodic_price_sweep` (30s) and `periodic_bankruptcy_check` (10s). LLM directive processing is also a Celery task.

### Key data flow
1. Client authenticates via `/api/v1/auth/` → receives `api_key` (stored in localStorage as `complex_api_key`)
2. Authenticated requests use `X-API-Key` header; admin endpoints use `X-Admin-Key`
3. Game actions (trades, directives) go through REST; real-time updates push via WebSocket
4. Celery workers handle LLM calls (directive evaluation), price recalculation, bankruptcy checks, and news generation

### State machines

**Team status**: `PENDING` → `READY` (admin approved) → `ACTIVE` ↔ `COOLDOWN` (post-directive) → `BANKRUPT` (cash < 0) → `ELIMINATED` or `REJECTED`. Cooldown enforced via `cooldown_until` timestamp; directive submission blocked until expired (returns 429 with Retry-After).

**Game status**: `SETUP` → `ACTIVE` → `PAUSED` → `FINISHED`. Single `GameState` row with id=1 (always query `await db.get(GameState, 1)`).

### API routers (`server/app/api/`)
`auth.py`, `game.py`, `teams.py`, `trading.py`, `directive.py`, `market.py`, `news.py`, `admin.py` — all mounted under `/api/v1/`

### Frontend contexts (`client/src/contexts/`)
- `AuthContext` — login state + API key persistence. **Mounted in root `layout.tsx`.**
- `GameContext` — UI state (selected ticker, modals, cooldown countdown). **Not in root layout** — must be wrapped where needed.
- `WebSocketContext` — real-time connection, reconnection with sequence-ID-based resync, burst sync on connect. **Not in root layout** — must be wrapped where needed.

### Frontend API client
`client/src/lib/api.ts` — centralized `authFetch()` wrapper that adds `X-API-Key` from localStorage. `client/src/lib/models.ts` — Zod schemas and TypeScript types for all API responses.

## Non-obvious patterns

- **Ticker normalization**: Tickers are stored uppercase with `$` prefix (e.g., `$ACME`). API normalizes input but frontend `OrderRequest` enforces `^\$[A-Z]{3,4}$`.
- **Worker session isolation**: `get_worker_session()` creates a fresh SQLAlchemy engine per Celery task to avoid forked-process asyncpg pool conflicts. Do not reuse the main app's session factory in workers.
- **Sequence-ID resync**: WebSocket messages carry incrementing `sequence_id`. On reconnect, clients send `sync_request` with their last ID to recover missed messages without full burst resync.
- **Vibe multiplier drives price**: The LLM-scored `vibe_multiplier` (0.5–2.0) from the latest directive is the primary non-fundamental stock price driver. Strategy quality directly impacts price.
- **Price history is immutable audit**: Every 30s price sweep records all calculation components in `PriceHistory`, even if price unchanged.
- **LLM injection detection**: Directive processor regex-scans content for prompt injection patterns before sending to LLM.
- **Decimal→float in JSON**: WebSocket and API use custom `_json_default` serializer for UUID/Decimal/datetime. Frontend Zod schemas expect `number`, not string.
- **Celery async bridge**: Celery tasks wrap async DB work in `asyncio.run()` to bridge sync task decorator to async SQLAlchemy.

## Configuration

Backend config via `server/.env` with pydantic-settings (`server/app/database.py`):
- `DATABASE_URL` — PostgreSQL connection string (uses `postgresql+asyncpg://`)
- `REDIS_URL` — Redis connection
- `ADMIN_API_KEY` — admin auth token
- `OPENROUTER_API_KEY` / `OPENROUTER_BASE_URL` — LLM API

Frontend config via `client/.env` with `NEXT_PUBLIC_*` prefix:
- `NEXT_PUBLIC_API_URL` — backend base URL
- `NEXT_PUBLIC_ADMIN_API_KEY` — optional, enables admin pages

## Important Notes

- **Next.js 16 has breaking changes** from earlier versions. Read guides in `node_modules/next/dist/docs/` before writing frontend code. Heed deprecation notices.
- Database models are in `server/app/models.py`. Migrations in `server/alembic/versions/` (idempotent pattern using `inspector.has_table()`).
- Backend auth uses FastAPI `Depends()` — see `verify_api_key` / `verify_admin_key` and `get_current_team()` patterns.
- Deployment: frontend on Vercel, backend via Docker + SSH (GitHub Actions). Caddy handles TLS + WebSocket proxying.
- `DEV_GUIDE.md` has detailed backend reference (state machines, price formula, bankruptcy pipeline, endpoint catalog).
