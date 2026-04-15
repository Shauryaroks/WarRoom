# Architecture Research

**Domain:** Real-time business simulation platform with LLM integration
**Researched:** 2026-04-16
**Confidence:** HIGH (based on existing codebase analysis + domain patterns)

## System Overview

```
                        ┌──────────────────────────────────────────────┐
                        │              VERCEL (CDN Edge)               │
                        │  ┌────────────────────────────────────────┐  │
                        │  │         Next.js Frontend (SSR)         │  │
                        │  │  /auth  /lobby  /game  /admin          │  │
                        │  └───────────┬───────────────┬────────────┘  │
                        └──────────────┼───────────────┼───────────────┘
                              REST API │          WebSocket
                                       │               │
┌──────────────────────────────────────┼───────────────┼───────────────────────────┐
│                          VPS (8GB / 4vCPU)           │                           │
│                                      │               │                           │
│   ┌──────────────────────────────────┼───────────────┼───────────────────────┐   │
│   │                           Caddy (L7 Proxy)                               │   │
│   │              TLS termination + reverse proxy + WS upgrade                │   │
│   └──────────────────────────────────┬───────────────┬───────────────────────┘   │
│                                      │               │                           │
│   ┌──────────────────────────────────┴───────────────┴───────────────────────┐   │
│   │                         FastAPI (Uvicorn)                                │   │
│   │                                                                          │   │
│   │  REST Routers:                    WebSocket Endpoints:                   │   │
│   │  /api/v1/auth                     /ws/market    (public broadcast)       │   │
│   │  /api/v1/teams                    /ws/team/{key} (private per-team)      │   │
│   │  /api/v1/trading                                                         │   │
│   │  /api/v1/directive                ConnectionManager (in-process)         │   │
│   │  /api/v1/market                   - burst_sync on connect                │   │
│   │  /api/v1/game                     - ping/pong heartbeat                  │   │
│   │  /api/v1/admin                    - sync_request recovery                │   │
│   │  /api/v1/news                                                            │   │
│   └─────────┬──────────────────────────────┬─────────────────────────────────┘   │
│             │                              │                                     │
│             │  async SQLAlchemy            │  Celery .delay()                    │
│             │                              │                                     │
│   ┌─────────┴──────────┐    ┌──────────────┴──────────────────────────────┐      │
│   │   PostgreSQL 15    │    │         Celery Worker + Beat                │      │
│   │                    │    │                                              │      │
│   │  teams             │    │  Periodic Tasks (Beat):                     │      │
│   │  directives        │    │    pricing sweep  (every 30s)               │      │
│   │  stock_holdings    │    │    bankruptcy check (every 10s)             │      │
│   │  transactions      │    │                                              │      │
│   │  cash_ledger       │    │  Async Tasks:                               │      │
│   │  price_history     │    │    process_directive (LLM eval)             │      │
│   │  market_news       │    │    start_directive_cooldown                 │      │
│   │  game_state        │    │    inject_scheduled_news                    │      │
│   └────────────────────┘    └─────────────┬───────────────────────────────┘      │
│                                           │                                      │
│                              ┌────────────┴────────────┐                         │
│                              │       Redis 7           │                         │
│                              │  - Celery broker/backend│                         │
│                              │  - Beat schedule store  │                         │
│                              └─────────────────────────┘                         │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                    HTTPS (outbound)
                                           │
                              ┌────────────┴────────────┐
                              │    OpenRouter API       │
                              │  LLM evaluation calls   │
                              │  (from worker only)     │
                              └─────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| **Next.js Frontend** | UI rendering, auth state, WebSocket consumers, REST calls | Vercel-hosted, React contexts for Auth/Game/WebSocket state |
| **Caddy** | TLS termination, reverse proxy, WebSocket upgrade | Docker container, auto-HTTPS via Let's Encrypt |
| **FastAPI API** | REST endpoints, WebSocket connection management, request validation | Single Uvicorn process, async SQLAlchemy, in-process ConnectionManager |
| **Celery Worker** | Background task execution: LLM calls, price recalculation, bankruptcy detection | Separate Docker container, same codebase, `asyncio.run()` bridge |
| **Celery Beat** | Periodic task scheduling (price sweeps, bankruptcy checks) | Co-located with worker via `--beat` flag |
| **PostgreSQL** | Persistent state: teams, directives, transactions, price history, game state | Docker volume, pool_size=20, asyncpg driver |
| **Redis** | Celery message broker and result backend | Docker container, single DB (db 0) |
| **OpenRouter** | LLM inference for directive evaluation | External API, called from worker tasks only |

## Recommended Project Structure

```
server/
├── alembic/                    # Database migrations
│   └── versions/               # Sequential migration files
├── app/
│   ├── main.py                 # FastAPI app, middleware, WS routes, lifespan
│   ├── database.py             # Engine, sessions, worker session factory
│   ├── models.py               # SQLAlchemy ORM models (all in one file)
│   ├── websocket.py            # ConnectionManager, burst_sync builders, WS handlers
│   ├── api/                    # REST route modules
│   │   ├── auth.py             # Registration, login, API key auth, admin auth
│   │   ├── teams.py            # Team CRUD, dossier endpoint
│   │   ├── trading.py          # Buy/sell stocks, portfolio queries
│   │   ├── directive.py        # Submit directives, triggers Celery task
│   │   ├── market.py           # Market data queries (prices, history)
│   │   ├── game.py             # Game lifecycle: start/pause/resume/end/purge
│   │   ├── admin.py            # Admin-only operations
│   │   └── news.py             # News injection, news feed queries
│   └── worker/
│       ├── celery_app.py       # Celery config, beat schedule
│       └── tasks/
│           ├── pricing.py      # Stock price recalculation (periodic + on-demand)
│           ├── directive.py    # LLM evaluation pipeline, financial impact
│           ├── bankruptcy.py   # Bankruptcy detection (periodic)
│           └── news.py         # Scheduled news injection
├── Dockerfile
└── pyproject.toml

client/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── auth/               # Login, register
│   │   ├── lobby/              # Pre-game waiting room
│   │   ├── game/               # Main game view (Bloomberg terminal UI)
│   │   └── admin/              # Admin dashboard (teams, metrics, market)
│   ├── components/
│   │   ├── game/               # CandlestickChart, DirectiveEditor, Sidebars
│   │   └── admin/              # TeamTable, NewsInjection, MetricsBar
│   ├── contexts/               # React contexts
│   │   ├── AuthContext.tsx      # JWT/API key management
│   │   ├── GameContext.tsx      # Cooldown timers, game phase
│   │   └── WebSocketContext.tsx # Dual WS connections, state hydration
│   └── lib/
│       ├── api.ts              # REST API client
│       └── models.ts           # TypeScript interfaces
├── next.config.ts
└── package.json
```

### Structure Rationale

- **`models.py` (single file):** At ~40 teams and 8 tables, keeping all models in one file avoids circular import issues with SQLAlchemy relationships. Split only if it exceeds ~500 lines.
- **`websocket.py` (singleton manager):** The ConnectionManager is an in-process singleton. This is correct for a single-process deployment. It holds live WebSocket references that cannot be serialized to Redis.
- **`worker/tasks/` (split by domain):** Each task module owns one domain (pricing, directives, bankruptcy, news). This prevents a god-module and makes it clear which Celery tasks exist.
- **`contexts/` (three contexts):** Auth, Game, and WebSocket are orthogonal concerns. WebSocket depends on Auth (needs API key) but not vice versa. Game holds UI state (cooldowns) that WebSocket updates.

## Architectural Patterns

### Pattern 1: In-Process WebSocket Manager with Burst Sync

**What:** A singleton `ConnectionManager` lives in the FastAPI process. It maintains sets of WebSocket connections (market feed + per-team feeds). On connect, it sends a `burst_sync` -- a full snapshot of current state built from the database. Subsequent updates are pushed as incremental messages.

**When to use:** Single-server deployments with <200 concurrent connections. No need for Redis pub/sub when there is only one API process.

**Trade-offs:**
- Pro: Simple, no external pub/sub layer, direct `await ws.send_text()`
- Pro: Burst sync eliminates stale-state bugs on reconnect
- Con: Cannot horizontally scale the API process (all WS connections must be on the same process)
- Con: Worker tasks cannot push to WebSocket directly -- they must import the manager singleton (fragile coupling)

**Current implementation note:** The worker tasks currently import `from app.websocket import manager` and call `await manager.broadcast_price_update(...)` directly. This works because the Celery worker creates a fresh event loop via `asyncio.run()`, but the `manager` instance in the worker process is a *different* instance than the one in the API process. **This means worker-initiated broadcasts silently fail -- they push to an empty connection set.** Only API-process-initiated pushes reach clients.

**Fix required:** Worker tasks should publish to Redis pub/sub, and the API process should subscribe and relay to WebSocket clients. Alternatively, worker tasks should call the API via HTTP to trigger broadcasts.

### Pattern 2: Celery Beat for Simulation Ticks

**What:** Celery Beat fires periodic tasks (price sweep every 30s, bankruptcy check every 10s) that drive the simulation forward. Each tick queries the database, computes new state, writes it back, and (attempts to) broadcast via WebSocket.

**When to use:** When you need reliable periodic execution that survives API restarts. Celery Beat persists its schedule in Redis.

**Trade-offs:**
- Pro: Decoupled from the API process lifecycle -- ticks continue even if the API crashes
- Pro: Built-in retry, time limits, and task tracking
- Con: Celery workers run in a separate process/container, so they cannot access in-process state (like WebSocket connections)
- Con: `asyncio.run()` bridge in sync Celery tasks creates a new event loop per task invocation -- this works but is not elegant

### Pattern 3: LLM-in-the-Loop with Clamped Output

**What:** Directive evaluation sends team context + directive content to an LLM via OpenRouter. The LLM returns structured JSON (scores + financial impact). The system validates, clamps, and applies the result. Prompt injection is detected and penalized.

**When to use:** When LLM output directly affects game state (financial changes, scores). Never trust raw LLM output for numerical values.

**Trade-offs:**
- Pro: Rich, contextual evaluation that considers market state, competitors, and team history
- Pro: Clamping prevents catastrophic LLM hallucinations (max $500k cash swing per directive)
- Con: LLM latency (5-30s per call) means directive results are async
- Con: Cost accumulates with many teams submitting frequently

**Current gap:** The PROJECT.md specifies human-in-the-loop (admin validates/edits LLM scoring before it takes effect). The current implementation applies LLM results immediately without admin approval. This is a significant missing feature.

### Pattern 4: API Key Authentication (Not JWT)

**What:** Teams authenticate via email/password to get an `api_key` (UUID). All subsequent requests use `X-API-Key` header. Admin uses a separate `X-Admin-Key` header with a static secret.

**When to use:** Competition/event settings where sessions are short-lived and token refresh complexity is unnecessary.

**Trade-offs:**
- Pro: Simple, stateless, no token expiry management
- Pro: API key doubles as WebSocket auth (`/ws/team/{api_key}`)
- Con: API key in URL path for WebSocket is visible in logs/proxies
- Con: No role differentiation within a team (Strategist vs Trader sub-accounts not yet implemented)

## Data Flow

### Core Game Loop

```
[Team submits directive via REST]
    |
    v
POST /api/v1/directive
    |
    v
[Validate team status, check cooldown]
    |
    v
[Create Directive row (status=PENDING)]
    |
    v
[Celery: process_directive.delay(directive_id)]
    |
    v
[Worker picks up task]
    |
    v
[Build per-team context: news, competitors, holdings, history]
    |
    v
[Call OpenRouter LLM with system prompt + directive content]
    |
    v
[Validate + clamp LLM response]
    |
    v
[Apply financial impact to team.cash]
    |
    v
[Generate MarketNews from directive headline]
    |
    v
[Directive status -> COMPLETED]
    |
    v
[Broadcast: directive_complete to team WS, news to market WS]  <-- BROKEN (see Pattern 1)
```

### Price Update Tick (Every 30 seconds)

```
[Celery Beat fires periodic_price_sweep]
    |
    v
[Query all ACTIVE/COOLDOWN teams]
    |
    v
[For each team: recalculate_price_task.delay(team_id)]
    |
    v
[calculate_final_price = base_price * vibe_mult * sentiment_mult]
    |
    |-- base_price = (recent_profit * 10 + cash * 0.1) * vibe_mult
    |-- vibe_mult = 0.5 + (0.5 * consistency * macro_sensitivity)  [from last directive]
    |-- sentiment_mult = tanh(5 * net_buy_sell_flow) * 0.20 + 1.0  [from recent trades]
    |
    v
[Update team.stock_price, insert PriceHistory row]
    |
    v
[Broadcast price_update to /ws/market]  <-- BROKEN (see Pattern 1)
```

### WebSocket State Hydration

```
[Client connects to /ws/market]
    |
    v
[Server accepts, sends burst_sync:]
    {
      "type": "connection_established",
      "payload": {
        "burst_sync": {
          "news": [...last 20 items],
          "tickers": [...all active teams with prices],
          "game_state": {status, elapsed, round, ...}
        }
      }
    }
    |
    v
[Client processes burst_sync to hydrate UI state]
    |
    v
[Server pushes incremental: price_update, news, system_event]
    |
    v
[On disconnect + reconnect: burst_sync replays full state]
```

### Admin Game Lifecycle

```
SETUP ──[POST /game/start]──> ACTIVE ──[POST /game/pause]──> PAUSED
                                  ^                              |
                                  └──[POST /game/resume]─────────┘
                                  |
                          [POST /game/purge]
                                  |
                                  v
                          Eliminate bottom 50%
                          Increase treasury limits
                          Broadcast PURGE_COMPLETE
                                  |
                          [POST /game/end]──> FINISHED
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1 event, ~80 users | Current architecture is sufficient. Single Uvicorn process, single Celery worker. Monitor: WebSocket memory, Celery task queue depth, PostgreSQL connection count. |
| Multiple concurrent events | Add `event_id` FK to all tables. Namespace WebSocket rooms by event. Consider separate DB per event or schema-based isolation. |
| 200+ concurrent WS | Move ConnectionManager to Redis pub/sub. Run multiple Uvicorn workers behind a load balancer. Each worker subscribes to Redis channels and relays to its local WS connections. |

### Scaling Priorities

1. **First bottleneck: Worker-to-WebSocket communication.** The current architecture has a broken broadcast path from Celery workers to WebSocket clients. At any scale, this must be fixed. Options: (a) Redis pub/sub relay, (b) HTTP callback from worker to API, (c) SSE polling fallback.

2. **Second bottleneck: Database connections under price sweep.** Every 30s, all teams get a `recalculate_price_task.delay()`. With 40 teams, that is 40 concurrent tasks, each creating a fresh async engine (via `get_worker_session`). Pool size is 5 per engine, so 40 engines * 5 = 200 potential connections. PostgreSQL default max is 100. The worker session factory should share a single engine across tasks, not create one per task.

3. **Third bottleneck: LLM call latency.** If 10 teams submit directives simultaneously, that is 10 sequential LLM calls (Celery worker prefetch=10 but likely single worker). Each takes 5-30s. Queue depth grows. Consider: increase worker concurrency, or batch LLM calls.

## Anti-Patterns

### Anti-Pattern 1: Importing In-Process Singletons from Worker Tasks

**What people do:** `from app.websocket import manager` inside Celery tasks, then call `await manager.broadcast_price_update(...)`.

**Why it's wrong:** The Celery worker runs in a separate process. The `manager` it imports is a freshly constructed `ConnectionManager` with zero connections. Broadcasts go nowhere. This is the current state of the codebase.

**Do this instead:** Use Redis pub/sub as an intermediary. Worker publishes `{"channel": "market", "type": "price_update", ...}` to Redis. A background task in the FastAPI process subscribes to the channel and calls `manager.broadcast_*()` with the actual WebSocket connections.

```python
# In worker task:
import redis
r = redis.Redis.from_url(REDIS_URL)
r.publish("ws:market", json.dumps({"type": "price_update", "payload": {...}}))

# In FastAPI lifespan (background task):
async def ws_relay():
    r = redis.asyncio.from_url(REDIS_URL)
    pubsub = r.pubsub()
    await pubsub.subscribe("ws:market", "ws:team:*")
    async for message in pubsub.listen():
        if message["type"] == "message":
            data = json.loads(message["data"])
            channel = message["channel"].decode()
            if channel == "ws:market":
                await manager.broadcast_to_market(data)
            elif channel.startswith("ws:team:"):
                team_key = channel.split(":")[-1]
                await manager.send_to_team(team_key, data)
```

### Anti-Pattern 2: Creating a New Engine Per Worker Task

**What people do:** `get_worker_session()` creates `create_async_engine(...)` on every call.

**Why it's wrong:** 40 price recalculation tasks = 40 engines = 200 potential DB connections. Engines are expensive to create and should be shared.

**Do this instead:** Create a module-level worker engine (lazy-initialized) and reuse it across tasks. Dispose it only when the worker process shuts down.

```python
_worker_engine = None

def _get_worker_engine():
    global _worker_engine
    if _worker_engine is None:
        _worker_engine = create_async_engine(settings.DATABASE_URL, pool_size=10)
    return _worker_engine
```

### Anti-Pattern 3: Mixing Async and Sync in Celery

**What people do:** Define sync Celery tasks that call `asyncio.run(_async_impl())`.

**Why it's wrong:** Each `asyncio.run()` creates and destroys an event loop. This is wasteful and prevents sharing async resources (like a single aiohttp session or DB engine) across tasks.

**Do this instead:** Use an async-compatible Celery setup. Either: (a) use `celery-pool-asyncio` for native async tasks, or (b) maintain a single long-lived event loop in the worker thread via `loop.run_until_complete()`. For this project's scale, the `asyncio.run()` approach works but is suboptimal.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **OpenRouter** | HTTP POST from Celery worker, structured JSON response | 30s timeout, retry once at temperature=0 on failure, neutral fallback on double-failure. Model configurable via GameState table. |
| **Vercel** | Hosts Next.js frontend, no direct backend integration | Frontend calls API via `NEXT_PUBLIC_API_URL` env var. WebSocket URL derived from API URL. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Frontend <-> API | REST (HTTPS) + WebSocket (WSS) | Caddy terminates TLS. CORS allows all origins (fine for competition). |
| API <-> Worker | Celery task queue (Redis) | API dispatches tasks via `.delay()`. Worker processes async. No direct return -- results written to DB. |
| Worker <-> API (push) | **BROKEN** -- should be Redis pub/sub | Worker needs to notify API of state changes for WebSocket broadcast. Currently imports singleton (no-op in worker process). |
| API <-> PostgreSQL | Async SQLAlchemy (asyncpg) | Pool size 20, no overflow. All mutations use proper transactions. |
| Worker <-> PostgreSQL | Async SQLAlchemy (asyncpg) via `get_worker_session()` | Creates fresh engine per task (anti-pattern, see above). |
| API <-> Redis | Direct (health checks only) | Celery handles its own Redis connection. API only touches Redis for health endpoint. |

## Build Order (Dependency Graph)

The components have clear dependency ordering for a rebuild/revamp:

```
Phase 1: Foundation (no dependencies)
├── Database schema + migrations (Alembic)
├── SQLAlchemy models
├── Database connection management
└── Settings / env configuration

Phase 2: Auth + Core API (depends on Phase 1)
├── Auth system (register, login, API key generation)
├── Admin authentication
├── Team CRUD endpoints
└── Game state management (start/pause/resume/end)

Phase 3: Simulation Engine (depends on Phase 2)
├── Redis pub/sub relay (fix worker->WS communication FIRST)
├── WebSocket ConnectionManager + burst_sync
├── Celery worker setup
├── Price calculation tasks (periodic)
├── Bankruptcy detection (periodic)
└── Trading endpoints (buy/sell with validation)

Phase 4: LLM Integration (depends on Phase 3)
├── Directive submission endpoint
├── LLM evaluation pipeline (OpenRouter)
├── Prompt construction with team context
├── Response validation + clamping
├── Financial impact application
├── News generation from directives
└── Human-in-the-loop approval flow (MISSING, required by spec)

Phase 5: Frontend (can partially parallel with Phase 3+)
├── Auth pages (login/register)
├── Lobby (waiting room)
├── Game view (Bloomberg terminal UI)
│   ├── Candlestick charts
│   ├── News feed
│   ├── Directive editor
│   ├── Trading panel
│   └── Portfolio view
├── Admin dashboard
│   ├── Team management
│   ├── Game controls
│   ├── News injection
│   └── Metrics/monitoring
└── Sub-account role enforcement (Strategist vs Trader)

Phase 6: Game Mechanics (depends on Phase 3 + 4)
├── Purge/elimination system
├── Crisis event injection
├── Scheduled news system
├── Cooldown management
└── End-game scoring
```

**Key dependency insight:** Phase 3 (simulation engine) must fix the worker-to-WebSocket communication before anything else in that phase. Without it, price updates, directive results, and news broadcasts never reach clients. This is the single most critical architectural fix.

## Sources

- Codebase analysis: `server/app/main.py`, `server/app/websocket.py`, `server/app/worker/`, `server/app/models.py`, `server/app/database.py`, `docker-compose.yml`, `Caddyfile`
- SQLAlchemy async documentation (asyncpg driver patterns)
- Celery documentation (Beat scheduling, task design)
- FastAPI WebSocket documentation (connection lifecycle)

---
*Architecture research for: Complex -- Case Competition Platform*
*Researched: 2026-04-16*
