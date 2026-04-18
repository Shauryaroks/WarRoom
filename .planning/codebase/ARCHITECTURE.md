# Architecture

**Analysis Date:** 2026-04-17

## Pattern Overview

**Overall:** FastAPI + PostgreSQL + Redis + Celery with Next.js frontend. Real-time WebSocket bidirectional communication between server processes and clients via Redis pub/sub relay.

**Key Characteristics:**

- Async SQLAlchemy with asyncpg driver (non-blocking webhooks)
- JWT authentication with dual-role team accounts (strategist/trader)
- Centralized game state machine in PostgreSQL, cached in Redis
- Redis-backed pub/sub for distributed WebSocket broadcast across uvicorn workers

## Layers

### API Layer (`server/app/api/`)

**Purpose:** HTTP/REST endpoints organized by domain

**Contents:**

- `auth.py` - Team registration, login (202 ACCEPTED after registration)
- `admin.py` - Admin-only controls: game state, teams, evaluations, archetypes, crisis injection
- `teams.py` - Team listing (admin), team info (team)
- `trading.py` - Buy/sell shares, portfolio queries
- `market.py` - Market news, price history
- `solutions.py` - Solution submission for LLM evaluation
- `decisions.py` - Decision lever submissions (WAR_ROOM phase)
- `game.py` - Team-facing game phase, budget queries

**Used by:** Next.js client via fetch/axios

### Service Layer (`server/app/services/`)

**Purpose:** Business logic, database operations, external API calls

**Contents:**

- `game_service.py` - Game state machine, Redis caching, phase transitions, operating budget
- `trading_service.py` - Share transaction execution with 30% cap enforcement
- `simulation_service.py` - Stock price calculation per tick, fundamentals engine
- `evaluation_service.py` - LLM evaluation orchestration, approval workflow
- `llm_service.py` - OpenRouter API client for evaluation

**Depends on:** SQLAlchemy models, Redis, httpx

### Model Layer (`server/app/models.py`)

**Purpose:** SQLAlchemy ORM definitions for PostgreSQL

**Key Models:**

- `Team` - Team entity with dual credentials, financial state, fundamentals
- `Admin` - Admin accounts (separate from teams)
- `GameState` - Singleton game status, timing, round tracking
- `Directive` - LLM-evaluated team strategic proposals
- `Solution` - Team solution submissions
- `Evaluation` - LLM evaluation results with admin approval
- `StockHolding` - Inter-team share ownership
- `Transaction` - Share trade records
- `PriceHistory` - Time-series stock prices
- `MarketNews` - News events (global/team-action/admin-injected)
- `ActivityEvent` - Audit log for game events
- `Decision` - Decision lever submissions per round (Phase 8)
- `Archetype` - Team archetypes for SETUP (Phase 7)
- `FundamentalEvaluation` - LLM-generated quarterly fundamentals (Phase 9)
- `PendingShock` - Queued price shocks from crisis/events

### WebSocket Layer (`server/app/websocket.py`, `redis_pubsub.py`)

**Purpose:** Real-time bidirectional communication

**Pattern:**

- ConnectionManager tracks connections per team_id
- Redis pub/sub relay in API process subscribes to Redis channels
- Incoming Redis messages broadcast to WebSocket clients
- Server-initiated messages publish to Redis, relay broadcasts

### Worker Layer (`server/app/worker/`)

**Purpose:** Celery background tasks

**Tasks:**

- `game_tick.py` - 60-second stock price tick scheduler
- `evaluate_solution.py` - Async LLM evaluation task
- `generate_news.py` - Post-approval news generation

### Client Layer (`client/src/`)

**Purpose:** Next.js frontend

**Key Components:**

- `stores/*.ts` - Zustand state management (auth, game, market, trading, decisions, solutions, admin)
- `hooks/use-websocket.ts` - WebSocket connection hook
- `lib/api.ts` - API client functions
- `lib/schemas.ts` - Zod validation schemas
- `components/game/*` - Game UI components (TradingPanel, DecisionsPanel, PortfolioTable, etc.)
- `components/admin/*` - Admin panel components
- `app/*/page.tsx` - Route pages

## Data Flow

### Team Registration Flow

1. Team submits registration via POST `/api/v1/auth/register`
2. Backend creates Team with PENDING status (both strategist/trader credentials)
3. Returns 202 ACCEPTED - team awaits admin approval
4. Admin approves via POST `/api/v1/admin/teams/{team_id}/approve`
5. Team can now login via POST `/api/v1/auth/login`

### Game Lifecycle Flow

1. Admin seeds initial admin via POST `/api/v1/admin/seed`
2. Game starts in SETUP - teams register and receive archetype assignments
3. Admin starts game via POST `/api/v1/admin/game/start` → ACTIVE
4. War Room phase (`/game/war-room`) - teams submit operating plans
5. Live Floor phase (`/game/live-floor`) - real-time trading, ticks active
6. Admin can inject crisis (`/crisis/inject`) → auto-pauses
7. Admin resumes to continue
8. Admin advances rounds incrementally (`/game/advance-round`)
9. Game ends via FINISHED terminal state

### LLM Evaluation Flow

1. Team submits solution via POST `/api/v1/solutions`
2. Evaluation status = PROCESSING
3. Celery task calls OpenRouter API
4. Evaluation status → PENDING_APPROVAL
5. Admin reviews/edits/approves or rejects
6. If approved: writes target_price, broadcasts to teams
7. If rejected: team notified

### Stock Trading Flow

1. Trader submits buy/sell via POST `/api/v1/trading/execute`
2. TradingService validates 30% cap, sufficient cash/shares
3. Creates Transaction record atomically
4. Updates StockHolding, cash, shares outstanding
5. Broadcasting via Redis pub/sub
6. WebSocket clients receive updated prices

### Real-time Tick Flow

1. Celery Beat triggers `game_tick` every 60 seconds
2. SimulationService calculates new price for each team
3. PriceHistory record written
4. Redis updated with latest prices
5. Publish to Redis channel
6. Redis relay broadcasts to all connected WebSocket clients

## Key Abstractions

### GameState Singleton

**Purpose:** Single source of truth for competition state

**Implementation:** `GameState` model with `id=1`, accessed via:

- `get_game_state(db)` - with FOR UPDATE lock for writes
- `get_game_state_readonly(db)` - for reads
- Cached in Redis via key `game:status`

**State Machine:** SETUP → ACTIVE ↔ PAUSED → FINISHED

### Dual-Credential Team

**Purpose:** Separate strategist/trader access per D-01

**Implementation:** Team model fields:

- `strategist_email`, `strategist_password_hash`
- `trader_email`, `trader_password_hash`

**JWT Claims:** `role` = "strategist" or "trader", `team_id` = team UUID

### Redis Pub/Sub Relay

**Purpose:** Broadcast messages across multiple uvicorn workers

**Implementation:** `start_redis_relay()` runs as background task:

- Subscribes to Redis channels `broadcast`, `team:{team_id}`
- On message: relay to connected WebSocket client
- Server-initiated via `publish_broadcast()`, `publish_to_team()`

### Fundamentals Engine (Phase 9)

**Purpose:** 4-input pricing model replacing v1 target_price

**Inputs:** market_share, margin, growth, ops_efficiency

**Implementation:** `simulation_service.py` calculates price based on fundamentals + sentiment + crisis shocks

## Entry Points

### FastAPI App (`server/app/main.py`)

**Location:** `server/app/main.py`

**Triggers:**

- HTTP request to any `/api/v1/*` endpoint
- WebSocket connection to `/ws`
- Health check GET `/health`

**Responsibilities:**

- Router registration
- CORS middleware
- Lifespan management (Redis relay startup/shutdown)

### Celery App (`server/app/worker/celery_app.py`)

**Location:** `server/app/worker/celery_app.py`

**Triggers:**

- Beat schedule (every 60 seconds for ticks)
- Task dispatch from API endpoints

**Responsibilities:**

- Background price calculation
- Async LLM evaluation

## Error Handling

**Strategy:** HTTPException for API errors, try/catch in services

**Patterns:**

- 401 Unauthorized - invalid/missing JWT
- 403 Forbidden - role-based access denied
- 404 Not Found - entity not found
- 409 Conflict - business rule violation
- 500 Internal Server Error - unhandled exceptions

**WebSocket:** Graceful disconnect on error, logged to stderr

## Cross-Cutting Concerns

**Logging:** Python `logging` module, configured in main.py

**Validation:** Pydantic models in `server/app/schemas/`, Zod in client

**Authentication:** JWT via PyJWT, role claims in token payload

**Database:** Async SQLAlchemy Session via dependency injection

**Redis:** Used for: pub/sub, caching game status, distributed lock

---

_Architecture analysis: 2026-04-17_
