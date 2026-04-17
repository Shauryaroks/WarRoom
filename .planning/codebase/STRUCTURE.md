# Codebase Structure

**Analysis Date:** 2026-04-17

## Directory Layout

```
/home/shaurya/Projects/complex/
├── client/                    # Next.js frontend (Vercel)
│   ├── src/
│   │   ├── app/               # Next.js App Router pages
│   │   ├── components/        # React components
│   │   ├── stores/            # Zustand state stores
│   │   ├── hooks/             # Custom React hooks
│   │   └── lib/               # Utilities, schemas, API client
│   ├── package.json
│   ├── tsconfig.json
│   └── next.config.js
├── server/                    # FastAPI backend (Dockerized)
│   ├── app/
│   │   ├── api/               # API route handlers
│   │   ├── services/          # Business logic
│   │   ├── worker/            # Celery tasks
│   │   ├── models.py          # SQLAlchemy ORM models
│   │   ├── main.py            # FastAPI app entry point
│   │   ├── database.py       # DB connection, settings
│   │   ├── auth_utils.py     # JWT functions, dependencies
│   │   ├── websocket.py      # WebSocket connection manager
│   │   └── redis_pubsub.py   # Redis pub/sub relay
│   ├── alembic/               # Database migrations
│   │   └── versions/
│   │       ├── 001_initial_schema.py
│   │       ├── 002_add_crisis_event.py
│   │       ├── 003_add_archetype.py
│   │       ├── 004_decision_levers_round_structure.py
│   │       └── 005_fundamentals_and_shocks.py
│   ├── tests/                # pytest test suite
│   ├── pyproject.toml        # Python dependencies
│   └── Dockerfile
├── docker-compose.yml         # Backend services (PostgreSQL, Redis, Caddy)
├── docker-compose.override.yml
├── Caddyfile                 # Reverse proxy config
└── .planning/                # GSD planning artifacts
    └── codebase/              # Codebase map documents
```

## Directory Purposes

### `server/app/api/`

**Purpose:** HTTP endpoint handlers organized by domain

**Files:**

| File | Purpose |
|------|---------|
| `auth.py` | Team registration, login, current user info |
| `admin.py` | Admin-only: game control, team management, evaluations, archetypes |
| `teams.py` | Team listing (admin), team details (team) |
| `trading.py` | Execute trades, portfolio queries |
| `market.py` | Market news, price history |
| `solutions.py` | Submit solutions for LLM evaluation |
| `decisions.py` | Decision lever submissions in WAR_ROOM |
| `game.py` | Team-facing game phase, budget |

**Pattern:** `APIRouter(prefix="/api/v1/...")` per file, included in `main.py`

### `server/app/services/`

**Purpose:** Business logic, database operations, external API calls

**Files:**

| File | Purpose |
|------|---------|
| `game_service.py` | Game state machine (SETUP→ACTIVE→PAUSED→FINISHED), Redis cache |
| `trading_service.py` | Execute trades with 30% cap enforcement |
| `simulation_service.py` | Stock price calculation, fundamentals engine |
| `evaluation_service.py` | Approve/reject evaluations |
| `llm_service.py` | OpenRouter API client |

**Pattern:** Async functions receiving `AsyncSession`, return domain objects/dicts

### `server/app/worker/`

**Purpose:** Celery background tasks

**Files:**

| File | Purpose |
|------|---------|
| `celery_app.py` | Celery app configuration |
| `tasks/game_tick.py` | 60-second price tick scheduler |
| `tasks/evaluate_solution.py` | Async LLM evaluation |
| `tasks/generate_news.py` | Post-approval news generation |

### `server/app/`

**Purpose:** Core application modules

| File | Purpose |
|------|---------|
| `main.py` | FastAPI app, router registration, lifespan |
| `models.py` | SQLAlchemy ORM models (26 tables) |
| `database.py` | Async engine, sessionmaker, settings |
| `auth_utils.py` | JWT create/decode, dependencies (get_current_user, require_admin, require_team) |
| `websocket.py` | ConnectionManager for real-time |
| `redis_pubsub.py` | Redis pub/sub publish functions |
| `schemas/decisions.py` | Pydantic models for API responses |

### `server/alembic/versions/`

**Purpose:** Database migrations (chronological)

| Migration | Purpose |
|-----------|---------|
| `001_initial_schema.py` | Core tables: teams, admins, transactions, price_history |
| `002_add_crisis_event.py` | CrisisEvent table |
| `003_add_archetype.py` | Archetype table |
| `004_decision_levers_round_structure.py` | Decision, OperatingPlan tables, game_phase field |
| `005_fundamentals_and_shocks.py` | FundamentalEvaluation, PendingShock tables, fundamentals on Team |

### `client/src/app/`

**Purpose:** Next.js App Router pages

**Files:**

| Path | Purpose |
|------|---------|
| `page.tsx` | Landing page |
| `auth/login/page.tsx` | Team login |
| `auth/register/page.tsx` | Team registration |
| `lobby/page.tsx` | Pre-game lobby |
| `game/page.tsx` | Main game dashboard |
| `leaderboard/page.tsx` | Rankings |
| `admin/layout.tsx` | Admin panel layout |
| `admin/page.tsx` | Admin dashboard |
| `admin/teams/page.tsx` | Team management |
| `admin/evaluations/page.tsx` | Evaluation review |
| `admin/news/page.tsx` | News injection |
| `admin/activity/page.tsx` | Activity log |
| `admin/markets/page.tsx` | Market overview |
| `admin/settings/page.tsx` | Game settings |

### `client/src/components/`

**Purpose:** React components organized by feature

**Subdirectories:**
- `game/` - TradingPanel, DecisionsPanel, PortfolioTable, CandlestickChart, etc.
- `admin/` - team-table, activity-feed, news-form, admin-sidebar, etc.
- `lobby/` - team-list, connection-indicator
- `ui/` - Reusable UI primitives (button, input, card, badge, etc.)

### `client/src/stores/`

**Purpose:** Zustand state management

| Store | Purpose |
|------|---------|
| `auth-store.ts` | JWT token, user info, login/logout |
| `game-store.ts` | Game status, phase, round |
| `market-store.ts` | Stock prices, market news |
| `trading-store.ts` | Trade form state, execution |
| `decisions-store.ts` | Decision lever form state |
| `solutions-store.ts` | Solution submissions |
| `admin-store.ts` | Admin panel state |

### `client/src/lib/`

**Purpose:** Utilities and schemas

| File | Purpose |
|------|---------|
| `api.ts` | fetch wrappers for API calls |
| `schemas.ts` | Zod validation schemas |
| `types.ts` | TypeScript type definitions |
| `utils.ts` | Helper functions |

### `server/tests/`

**Purpose:** pytest test suite

| File | Scope |
|------|-------|
| `test_trading.py` | Trade execution, 30% cap |
| `test_simulation.py` | Price calculation |
| `test_game_tick.py` | Tick scheduling |
| `test_game_service.py` | Game state transitions |
| `test_evaluation.py` | Evaluation workflow |
| `test_solutions.py` | Solution submission |
| `test_admin.py` | Admin endpoints |

## Key File Locations

### Entry Points

| Component | Location |
|-----------|----------|
| FastAPI app | `server/app/main.py` |
| Next.js app | `client/src/app/layout.tsx` |
| Celery worker | `server/app/worker/celery_app.py` |

### Configuration

| File | Purpose |
|------|---------|
| `server/.env` | Database URL, Redis URL, JWT secret, OpenRouter API key |
| `server/pyproject.toml` | Python dependencies |
| `client/package.json` | Node dependencies |
| `docker-compose.yml` | Backend services (PostgreSQL, Redis, Caddy) |
| `Caddyfile` | Reverse proxy config |

### Database

| File | Purpose |
|------|---------|
| `server/app/models.py` | All 26 SQLAlchemy models |
| `server/alembic/versions/*.py` | Migrations |
| `server/app/database.py` | AsyncSessionLocal, settings |

### Real-time

| File | Purpose |
|------|---------|
| `server/app/websocket.py` | ConnectionManager (in-process broadcast) |
| `server/app/redis_pubsub.py` | Redis pub/sub publish/subscribe |
| `client/src/hooks/use-websocket.ts` | WebSocket connection hook |

## Naming Conventions

### Backend (Python)

| Pattern | Example |
|---------|---------|
| API routes | `server/app/api/*.py` |
| Services | `server/app/services/*_service.py` |
| Celery tasks | `server/app/worker/tasks/*.py` |
| Router prefix | `/api/v1/{domain}` |
| Models | `PascalCase` (Team, GameState) |
| Database columns | `snake_case` (created_at, team_id) |

### Frontend (TypeScript/React)

| Pattern | Example |
|---------|---------|
| Pages | `client/src/app/{route}/page.tsx` |
| Components | `client/src/components/{feature}/{Name}.tsx` |
| Stores | `client/src/stores/{name}-store.ts` |
| Hooks | `client/src/hooks/{name}.ts` |
| API client | `client/src/lib/api.ts` |

## Where to Add New Code

### New Feature (Backend)

1. Add model to `server/app/models.py`
2. Create service in `server/app/services/` or add to existing
3. Add API endpoint in `server/app/api/{domain}.py`
4. Add migration in `server/alembic/versions/` with sequential number

### New Feature (Frontend)

1. Add component in `client/src/components/{feature}/`
2. Add store slice to `client/src/stores/` or extend existing
3. Add API call to `client/src/lib/api.ts`
4. Add page in `client/src/app/{route}/page.tsx`

### New Celery Task

1. Add task function in `server/app/worker/tasks/`
2. Import in `server/app/worker/celery_app.py`

### New Database Table

1. Add model to `server/app/models.py`
2. Create migration in `server/alembic/versions/` with sequential number

## Special Directories

| Directory | Purpose | Generated | Committed |
|-----------|---------|-----------|-----------|
| `client/.next/` | Next.js build output | Yes | No |
| `server/.venv/` | Python virtualenv | Yes | No |
| `server/__pycache__/` | Python bytecode | Yes | No |
| `server/tests/__pycache__/` | Test bytecode | Yes | No |

---

*Structure analysis: 2026-04-17*