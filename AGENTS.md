<!-- GSD:project-start source:PROJECT.md -->

## Project

**WarRoom Backend Production Readiness**

**Core Value:** WarRoom is a real-time multiplayer business simulation game. The backend currently works but is missing critical production features from its specification, particularly around real-time WebSocket broadcasts, accurate market data aggregation (OHLCV), and comprehensive admin metrics.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- TypeScript 5.x - Frontend Next.js client
- Python 3.13 - Backend FastAPI server

## Runtime

- Node.js (via Bun) - Client runtime (`bun.lock` present)
- Python 3.13 - Server runtime (`.python-version` present)
- Bun/npm - Client (`package-lock.json` and `bun.lock` present)
- uv - Server (`uv.lock` and `pyproject.toml` present)

## Frameworks

- Next.js 16.2.3 (React 19.2.4) - Frontend framework (`client/package.json`)
- FastAPI 0.135.3+ - Backend API framework (`server/pyproject.toml`)
- SQLAlchemy 2.0+ (asyncio) - ORM (`server/app/database.py`)
- Alembic 1.13+ - Database migrations (`server/alembic.ini`)
- Pydantic 2.0+ - Data validation and settings (`server/app/database.py`)
- Celery 5.6.3+ - Background task queue using Redis (`server/app/worker/celery_app.py`)
- Pytest (pytest-asyncio) - Server testing framework
- TailwindCSS 4.2.2 - Utility-first CSS framework (`client/postcss.config.mjs`)
- Ruff & Mypy - Python linting and type checking
- ESLint 9 - TypeScript linting

## Key Dependencies

- `asyncpg` - Async PostgreSQL driver
- `websockets` - Server-side real-time communication
- `redis` - Async Redis client
- `bcrypt` - Password hashing
- `httpx` - Async HTTP client for external API requests
- `zod` - Client-side schema validation
- `lucide-react` - UI Icons

## Configuration

- Managed via `.env` files and `pydantic-settings` (`server/app/database.py`)
- Key configs required: `DATABASE_URL`, `REDIS_URL`, `OPENROUTER_API_KEY`, `ADMIN_API_KEY`
- `client/next.config.ts` - Next.js configuration
- `server/pyproject.toml` - Python project configuration
- `server/Dockerfile` - Server containerization

## Platform Requirements

- Bun/Node.js
- Python 3.13+
- PostgreSQL
- Redis
- Docker-based deployments (implied by `server/Dockerfile`)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- Frontend: Next.js App Router conventions (`page.tsx`, `layout.tsx`). React components use `PascalCase.tsx` (e.g., `TopNav.tsx`, `MetricsBar.tsx`). Barrel files use `index.ts`.
- Backend: Python modules use `snake_case.py` (e.g., `market.py`, `auth.py`, `directive.py`).
- Frontend: `camelCase` for utilities and hooks (e.g., `handleLogin`, `useAuth`). `PascalCase` for React components.
- Backend: `snake_case` (e.g., `get_market_tickers`, `verify_admin_key`).
- Frontend: `camelCase` (e.g., `tickerInput`, `pendingApproval`).
- Backend: `snake_case` (e.g., `team_data`, `api_key`).
- Frontend: `PascalCase` for TypeScript interfaces and types. Zod schemas follow the pattern `[TypeName]Schema` (e.g., `TeamStatusSchema`).
- Backend: `PascalCase` for Pydantic models and SQLAlchemy ORM models (e.g., `TickerSnapshot`, `GameState`).

## Code Style

- Frontend: Tailwind CSS utility classes are heavily utilized for styling. No `prettierrc` was found, relying on default formatting.
- Backend: Relies on `ruff` (found in `pyproject.toml` dev dependencies) for fast linting and formatting.
- Frontend: Uses `eslint-config-next` with standard rules configured in `eslint.config.mjs`.
- Backend: `ruff` is specified in dependencies, using its default rule set.

## Import Organization

- Frontend uses `@/*` mapping to `./src/*` configured via `tsconfig.json`.

## Error Handling

- Frontend: Wraps API calls in standard `try...catch` blocks. The central `api.ts` fetch wrapper checks `!response.ok` and extracts the server's error message (preferring `detail` or `message`). UI components capture errors in local state (e.g., `setErrorMsg(error.message)`) to display to users.
- Backend: Relies heavily on FastAPI's `HTTPException`. Endpoints explicitly raise exceptions such as `raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")` when validation or logic fails.

## Logging

- Frontend uses standard `console.error` and `console.log`.
- Backend uses Python's standard `logging` library (named logger: `warroom`).
- Backend utilizes a custom `RequestLoggingMiddleware` in `server/app/main.py` that logs method, path, status, and duration for every request, while filtering out frequent health-check noise.

## Comments

- Minimal inline comments. Comments are typically used to visually separate sections in large files (e.g., `# --- Registration ---`) or to explain a specific business rule.
- Not heavily used in the frontend.
- Python uses docstrings for critical dependencies or middleware (e.g., `"""Dependency that verifies admin key..."""`).

## Function Design

- Frontend uses destructured props for components.
- Backend heavily utilizes FastAPI's Dependency Injection system (`Depends(get_db)`, `Header(...)`) for parameters.

## Module Design

- Frontend: Default exports for Next.js pages (`export default function LoginPage()`). Named exports for utilities, schemas, and components (`export const api`, `export const TeamStatusSchema`).
- Backend: Routers are instantiated locally and imported by the main app (e.g., `router = APIRouter(...)`).
- Extensively used in the frontend `components/` directory (e.g., `client/src/components/admin/index.ts`) for cleanly grouping and re-exporting component modules.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## Pattern Overview

- Decoupled frontend (Next.js/React) and backend (FastAPI/Python) communicating via REST and WebSockets.
- Real-time data pushing from server to client via WebSocket connections.
- Heavy computational or external IO tasks (LLM integration) offloaded to Celery workers using Redis as a message broker.
- Asynchronous database access using SQLAlchemy with asyncpg.

## Layers

- Purpose: Render game state and admin dashboards, capture user interactions.
- Location: `client/src/components/` and `client/src/app/`
- Contains: React components, Next.js page layouts, CSS.
- Depends on: Context Layer, API Client (`client/src/lib/api.ts`).
- Purpose: Manage local caching of remote data and WebSocket connections.
- Location: `client/src/contexts/`
- Contains: React Context Providers (`WebSocketContext.tsx`, `AuthContext.tsx`).
- Depends on: WebSockets, API Client.
- Used by: UI Components.
- Purpose: Handle HTTP requests, validate inputs, enforce business logic.
- Location: `server/app/api/`
- Contains: FastAPI routers (`auth.py`, `trading.py`, `directive.py`).
- Depends on: Data Access Layer, WebSocket Manager.
- Used by: Frontend HTTP Client.
- Purpose: Maintain active WebSocket connections and route real-time events.
- Location: `server/app/websocket.py`
- Contains: Singleton `ConnectionManager`.
- Depends on: FastAPI WebSocket primitives.
- Used by: API Handlers (and ideally Workers) to push updates.
- Purpose: Process long-running tasks asynchronously (e.g., LLM calls, periodic price sweeps).
- Location: `server/app/worker/tasks/`
- Contains: Celery tasks (`directive.py`, `pricing.py`).
- Depends on: Redis (broker), Data Access Layer.
- Purpose: Abstract database queries and schema definitions.
- Location: `server/app/models.py` and `server/app/database.py`
- Contains: SQLAlchemy ORM models and AsyncSession generation.

## Data Flow

## Key Abstractions

- Purpose: Centralizes tracking of all active WebSocket connections across different namespaces (Market-wide vs Team-specific) to easily push targeted JSON payloads.
- Examples: `server/app/websocket.py`
- Pattern: In-memory Singleton.
- Purpose: Provides a single source of truth for all real-time data streaming from the backend, hiding connection lifecycles and parsing logic from view components.
- Examples: `client/src/contexts/WebSocketContext.tsx`
- Pattern: React Context Provider.

## Entry Points

- Location: `client/src/app/layout.tsx` & `page.tsx`
- Triggers: User HTTP navigation.
- Responsibilities: Bootstraps the Next.js shell, mounts global Contexts (Auth, Game, WebSocket).
- Location: `server/app/main.py`
- Triggers: Uvicorn ASGI server start.
- Responsibilities: Initializes FastAPI, configures CORS/Logging, mounts API sub-routers, establishes WebSocket endpoints.
- Location: `server/app/worker/celery_app.py`
- Triggers: `celery worker` process launch.
- Responsibilities: Connects to Redis, registers task definitions, sets up periodic beat schedules.

## Error Handling

- Backend: Let specific HTTP Exceptions bubble up to FastAPI's default exception handler. Use structured Pydantic models to validate inputs before business logic runs.
- Frontend: Wrap API calls in try-catch and manage local `isLoading` and error states in Context or local component state.

## Cross-Cutting Concerns

- Handled via static tokens passed in headers. `X-API-Key` for players and `X-Admin-Key` for administrators. Validated via FastAPI Dependencies (`Depends(get_current_team)`).
- Managed by FastAPI Dependency Injection (`get_db` yielding an `AsyncSession`) ensuring proper commit/rollback at the request boundary. Workers use explicit context managers (`get_worker_session()`).
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.

<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.

<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.

<!-- GSD:profile-end -->
