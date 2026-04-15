# Stack Research

**Domain:** Real-time case competition platform with LLM-driven simulation
**Researched:** 2026-04-16
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.2.3 | Frontend framework | Already in use. Turbopack default bundler, App Router with React 19.2, `use cache` directive for explicit caching. Deployed on Vercel — zero-config deployment. |
| React | 19.2.4 | UI library | Already in use. View Transitions, `useEffectEvent`, Activity API — all useful for real-time dashboard UX. |
| FastAPI | >=0.135.3 | Backend API + WebSocket server | Already in use. Native async WebSocket support, Starlette 1.0+ under the hood. SSE support added recently for auxiliary streaming. |
| PostgreSQL | 15 | Primary database | Already in use via Docker. ACID compliance critical for share transaction integrity (30% cap enforcement). LISTEN/NOTIFY available as fallback pub/sub. |
| SQLAlchemy | >=2.0.49 | ORM | Already in use. **Use async mode** (`create_async_engine` + `AsyncSession` + `asyncpg`). Avoids blocking the event loop during DB calls which would stall WebSocket broadcasts. Sync mode would force thread pooling and add latency. |
| Alembic | >=1.18.4 | Database migrations | Already in use. Supports async engines natively. Auto-generate with bulk reflection (O(1) queries on Postgres). Min Python 3.10. |
| Redis | 7 (server), >=7.1.1 (redis-py) | Cache, pub/sub, Celery broker | Already in use. `redis.asyncio` module for async pub/sub (aioredis merged in). Critical for WebSocket broadcast across workers. |
| Celery | >=5.6.3 | Background task queue + Beat scheduler | Already in use. Beat for 60-second stock tick scheduling. Supports Python 3.9-3.13. |
| Caddy | 2 | Reverse proxy + auto-TLS | Already in use. Automatic HTTPS, WebSocket proxying out of the box, simple Caddyfile config. |
| Docker / Docker Compose | latest | Containerization | Already in use. Single `docker-compose.yml` for all backend services. |

### Frontend Libraries

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| Zustand | 5.0.12 | Client state management | Use over Jotai/Redux. Centralized store model fits this app: game state, portfolio, stock prices are interconnected global state. Minimal boilerplate, excellent devtools, built-in middleware for persistence. 150% growth in 2025 adoption. |
| lightweight-charts | 5.1.0 | Bloomberg-style candlestick charts | Already in use. TradingView's official library. Multi-pane support in v5, data conflation for performance with large datasets, 35kB bundle. No React wrapper needed — use refs. |
| Zod | 4.3.6 | Schema validation (forms + API responses) | Already in use. v4 is stable. Validate WebSocket message shapes on client, form inputs, API response parsing. Shared schemas possible with backend Pydantic models as source of truth. |
| Tailwind CSS | 4.2.2 | Styling | Already in use. v4 with PostCSS plugin. Bloomberg terminal aesthetic = dark theme with monospace fonts and data-dense layouts — Tailwind utility classes make this fast to build. |
| lucide-react | >=1.8.0 | Icons | Already in use. Consistent icon set, tree-shakeable. |

### Backend Libraries

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| asyncpg | >=0.29.0 | PostgreSQL async driver | Already in use. Required for SQLAlchemy async mode. Fastest Python Postgres driver by significant margin. |
| Pydantic | >=2.9.0 | Data validation + serialization | Already in use. FastAPI 0.135+ requires Pydantic >=2.9. Use for all request/response models, WebSocket message schemas, and settings management. |
| pydantic-settings | >=2.0.0 | Environment config | Already in use. Loads `.env` files, type-safe config. |
| PyJWT | >=2.9.0 | JWT token handling | **Use instead of python-jose.** python-jose is unmaintained since 2021 with known security vulnerabilities. FastAPI officially migrated recommendations to PyJWT. API-compatible migration. |
| bcrypt | >=4.1.0 | Password hashing | Already in use. Fast, battle-tested. Consider pwdlib with Argon2 for new projects, but bcrypt is fine for a competition app with limited users. |
| httpx | >=0.27.0 | Async HTTP client (OpenRouter API calls) | Already in use. Async-native, used for LLM API calls to OpenRouter. Prefer over `requests` in async context. |
| broadcaster | 0.3.1 | WebSocket pub/sub across workers | **Add this.** encode/broadcaster provides Redis-backed pub/sub for broadcasting WebSocket messages across multiple uvicorn workers. Low maintenance velocity but stable API — the library is thin wrapper over Redis pub/sub. Alternative: build custom Redis pub/sub (simple enough for this use case). |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| uv | Python package management | Already in docker-compose (`uv run`). Faster than pip, handles virtualenvs. |
| Ruff | Linting + formatting | Already in dev deps. Replaces flake8 + black + isort in single tool. |
| mypy | Type checking | Already in dev deps. Use with SQLAlchemy stubs. |
| pytest + pytest-asyncio | Testing | Already in dev deps. Use `asyncio_mode = "auto"` in pytest config. |
| ESLint | Frontend linting | Already configured with `eslint-config-next`. |
| TypeScript | Frontend type safety | Already in use. Strict mode recommended. |

## Key Architecture Decisions

### SQLAlchemy: Async Mode (not Sync)

**Decision:** Use `create_async_engine` + `AsyncSession` + `asyncpg` driver.

**Why:** The API server handles WebSocket connections that must remain responsive. Sync SQLAlchemy would block the event loop during every DB query, causing all WebSocket clients to stall. With 80 concurrent connections and stock ticks every 60 seconds, this would create visible lag.

**Trade-off:** Async SQLAlchemy has some limitations — lazy loading doesn't work (use `selectinload`/`joinedload` eagerly). Relationships must be loaded explicitly. This is actually a good thing — it prevents N+1 queries.

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

engine = create_async_engine("postgresql+asyncpg://user:pass@db/complex")
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
```

### WebSocket Broadcasting: Redis Pub/Sub (not in-memory)

**Decision:** Use Redis pub/sub for broadcasting stock prices, news, and game state changes to all connected WebSocket clients.

**Why:** Even with a single uvicorn worker, Redis pub/sub decouples the Celery worker (which computes stock ticks) from the API server (which holds WebSocket connections). The Celery beat task publishes price updates to Redis, and the API server's WebSocket handler subscribes and broadcasts to clients.

**Pattern:**
1. Celery Beat fires `update_stock_prices` every 60 seconds
2. Task computes new prices, writes to PostgreSQL, publishes to Redis channel
3. API server subscribes to Redis channel, broadcasts JSON to all WebSocket clients
4. Client receives JSON, updates Zustand store, lightweight-charts re-renders

**Implementation options (pick one):**
- `broadcaster` library — thin wrapper, easy integration with FastAPI
- Custom `redis.asyncio` pub/sub — more control, ~50 lines of code, no extra dependency

Recommendation: **Custom Redis pub/sub** — the broadcaster library is low-maintenance and the custom approach is simple enough that adding a dependency isn't worth it.

```python
import redis.asyncio as aioredis

async def subscribe_to_prices(ws_manager):
    r = aioredis.from_url("redis://redis:6379")
    pubsub = r.pubsub()
    await pubsub.subscribe("stock_prices")
    async for message in pubsub.listen():
        if message["type"] == "message":
            await ws_manager.broadcast(message["data"])
```

### Celery Beat: Embedded (not separate scheduler)

**Decision:** Run Celery worker with `--beat` flag in the same process (already in docker-compose: `celery -A app.worker worker --beat`).

**Why:** Single-server deployment with only one worker process. Separate beat scheduler is only needed for multi-worker deployments to avoid duplicate scheduled tasks. For 80 users on a single VPS, embedded beat is simpler and sufficient.

**Key periodic tasks:**
```python
app.conf.beat_schedule = {
    'tick-stock-prices': {
        'task': 'app.tasks.tick_stock_prices',
        'schedule': 60.0,  # every minute
    },
    'check-round-timer': {
        'task': 'app.tasks.check_round_transition',
        'schedule': 30.0,  # check every 30 seconds
    },
}
```

### State Management: Zustand (not Jotai, not Redux)

**Decision:** Zustand 5 with a centralized store pattern.

**Why:** Game state is deeply interconnected — stock prices affect portfolio values, news affects market sentiment, game phase affects what actions are available. A centralized store with slices fits better than Jotai's atomic model. Redux is overkill for this scale. Zustand's `subscribeWithSelector` middleware enables efficient WebSocket message dispatch to specific store slices.

**Store structure:**
```typescript
// Separate stores by domain, not one mega-store
const useGameStore = create<GameState>()(...)    // game phase, timer, round
const useMarketStore = create<MarketState>()(...)  // stock prices, portfolio
const useNewsStore = create<NewsState>()(...)     // news feed, crisis events
const useAuthStore = create<AuthState>()(...)     // user, team, role
```

### Charting: lightweight-charts (not Recharts, not D3)

**Decision:** TradingView lightweight-charts 5.1.0.

**Why:** Purpose-built for financial data visualization. Candlestick charts, multi-pane support (price + volume), data conflation for performance. 35kB bundle vs 200kB+ for Recharts. Bloomberg terminal aesthetic is native to this library. No React wrapper exists officially — use `useRef` + `useEffect` for lifecycle management.

**Do NOT use:**
- Recharts — general-purpose, no candlestick support, heavy bundle
- D3 — too low-level for this use case, massive development time
- Chart.js — no native candlestick support
- ApexCharts — heavier than lightweight-charts, less financial-focused

## Installation

### Backend (Python)

```bash
# In server/pyproject.toml dependencies
dependencies = [
    "fastapi[standard]>=0.135.3",
    "sqlalchemy[asyncio]>=2.0.49",
    "asyncpg>=0.29.0",
    "alembic>=1.18.4",
    "pydantic>=2.9.0",
    "pydantic-settings>=2.0.0",
    "celery[redis]>=5.6.3",
    "redis>=7.1.1",
    "httpx>=0.27.0",
    "bcrypt>=4.1.0",
    "PyJWT>=2.9.0",        # replaces python-jose
    "python-dotenv>=1.0.0",
]
```

### Frontend (Node)

```bash
# Core
npm install next@16.2.3 react@19.2.4 react-dom@19.2.4
npm install zustand@5.0.12 lightweight-charts@5.1.0 zod@4.3.6
npm install tailwindcss@4.2.2 @tailwindcss/postcss@4.2.2
npm install lucide-react@latest

# Dev
npm install -D typescript@5 @types/react@19 @types/react-dom@19
npm install -D eslint eslint-config-next@16.2.3
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Zustand 5 | Jotai | If state is highly independent atoms (forms with independent fields). Not this app — game state is interconnected. |
| Zustand 5 | Redux Toolkit | If you need time-travel debugging or have a team already proficient in Redux. Overkill here. |
| PyJWT | python-jose | Never — python-jose is unmaintained with CVEs. |
| asyncpg | psycopg3 (async) | If you need Postgres-specific features like COPY protocol. asyncpg is faster for standard ORM use. |
| Custom Redis pub/sub | broadcaster library | If you want slightly less code and don't mind a low-maintenance dependency. |
| Celery Beat (embedded) | APScheduler | If you don't need distributed task execution and only need scheduling. But Celery is already required for LLM evaluation tasks. |
| lightweight-charts | Apache ECharts | If you need more chart types beyond financial (pie, radar, etc). But this app only needs candlestick + line charts. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| python-jose | Unmaintained since 2021, known CVEs, FastAPI officially dropped recommendation | PyJWT >=2.9.0 |
| aioredis (standalone) | Merged into redis-py since v4.2, standalone package is abandoned | `redis.asyncio` from redis-py |
| SQLAlchemy sync mode | Blocks event loop, kills WebSocket responsiveness for all clients | SQLAlchemy async with asyncpg |
| Socket.IO (python-socketio) | Adds unnecessary abstraction layer, FastAPI has native WebSocket support, Socket.IO client adds bundle size | Native FastAPI WebSocket + Starlette |
| Recharts / Chart.js | No candlestick support, heavier bundles, not financial-focused | lightweight-charts 5.x |
| Redux | Too much boilerplate for 80-user competition app, slower to develop | Zustand 5 |
| Flask / Django | Not async-native, would require different WebSocket approach | FastAPI (already chosen) |
| Prisma (Python) | Immature Python client, not production-ready | SQLAlchemy 2.0 async |
| passlib | Maintenance status uncertain, bcrypt works directly | bcrypt directly, or pwdlib if you want Argon2 |

## Version Compatibility Matrix

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| FastAPI >=0.135.3 | Pydantic >=2.9.0, Starlette >=1.0.0 | FastAPI pins these — check on upgrade |
| SQLAlchemy >=2.0.49 | asyncpg >=0.29.0, Alembic >=1.18.4 | All support Python 3.10+. Alembic 1.18 requires Python >=3.10 |
| Celery >=5.6.3 | redis-py >=7.0.0, Python 3.9-3.13 | Celery and redis-py both support Redis 7.x server |
| Next.js 16.2.3 | React 19.2.4, Turbopack (default) | Tailwind 4 requires PostCSS plugin or Vite plugin |
| Zustand 5.0.12 | React >=18.0.0 | Works with React 19 out of the box |
| lightweight-charts 5.1.0 | Any framework (vanilla JS) | No framework dependency — use refs in React |
| Zod 4.3.6 | TypeScript >=5.0 | v4 accessed via `zod/v4` subpath or default import |

## Docker Image Versions

| Service | Image | Notes |
|---------|-------|-------|
| PostgreSQL | `postgres:15` | Stay on 15 unless specific 16/17 features needed. 15 is stable LTS. |
| Redis | `redis:7` | v7 supports functions, ACLs. v8 exists but 7 is battle-tested. |
| Caddy | `caddy:2` | Auto-HTTPS, WebSocket proxy native. |
| Python | `python:3.12-slim` | 3.12 is stable, 3.13 is fine too. Avoid 3.14 (beta). |

## Sources

- [FastAPI WebSocket docs](https://fastapi.tiangolo.com/advanced/websockets/) — WebSocket ConnectionManager pattern, broadcaster recommendation (Context7, HIGH confidence)
- [SQLAlchemy 2.0 async docs](https://docs.sqlalchemy.org/en/20/) — AsyncSession, create_async_engine patterns (Context7, HIGH confidence)
- [Celery Beat docs](https://docs.celeryq.dev/en/stable/userguide/periodic-tasks.html) — beat_schedule configuration (Context7, HIGH confidence)
- [FastAPI PyPI](https://pypi.org/project/fastapi/) — Latest version 0.135.3 (WebSearch, HIGH confidence)
- [Celery PyPI](https://pypi.org/project/celery/) — Latest version 5.6.3 (WebSearch, HIGH confidence)
- [SQLAlchemy downloads](https://www.sqlalchemy.org/download.html) — Latest version 2.0.49 (WebSearch, HIGH confidence)
- [Alembic PyPI](https://pypi.org/project/alembic/) — Latest version 1.18.4 (WebSearch, HIGH confidence)
- [redis-py PyPI](https://pypi.org/project/redis/) — Latest version 7.1.1 (WebSearch, HIGH confidence)
- [Zustand npm](https://www.npmjs.com/package/zustand) — Latest version 5.0.12 (WebSearch, HIGH confidence)
- [Zod npm](https://www.npmjs.com/package/zod) — Latest version 4.3.6 (WebSearch, HIGH confidence)
- [lightweight-charts GitHub](https://github.com/tradingview/lightweight-charts) — Latest version 5.1.0 (WebSearch, HIGH confidence)
- [Next.js 16.2 blog](https://nextjs.org/blog/next-16-2) — Next.js 16.2 features (WebSearch, HIGH confidence)
- [python-jose deprecation discussion](https://github.com/fastapi/fastapi/discussions/11345) — Migration to PyJWT (WebSearch, HIGH confidence)
- [FastAPI WebSocket + Redis scaling](https://medium.com/@nandagopal05/scaling-websockets-with-pub-sub-using-python-redis-fastapi-b16392ffe291) — Redis pub/sub pattern for multi-worker broadcast (WebSearch, MEDIUM confidence)

---
*Stack research for: Complex — Case Competition Platform*
*Researched: 2026-04-16*
