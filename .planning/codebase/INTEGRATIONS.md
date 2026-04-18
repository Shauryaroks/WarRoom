# External Integrations

**Analysis Date:** 2026-04-17

## APIs & External Services

### OpenRouter (LLM Evaluation)

- **Service:** OpenRouter AI API
- **Purpose:** Solution evaluation via LLM with structured JSON output
- **Location:** `server/app/services/llm_service.py`
- **SDK/Client:** `httpx` (async HTTP client)
- **Env Vars:**
  - `OPENROUTER_API_KEY` - API key for authentication
  - `OPENROUTER_BASE_URL` - Defaults to `https://openrouter.ai/api/v1`
- **Model:** `nvidia/nemotron-3-super-120b-a12b:free` (configurable)
- **Timeout:** 90 seconds per call (prevents hanging connections)
- **Response Format:** JSON schema with `scoring_metrics`, `price_timeline`, `news_article`

---

## Data Storage

### PostgreSQL

- **Type/Provider:** PostgreSQL 15 (Docker)
- **Connection:** `postgresql+asyncpg://postgres:postgres@db:5432/complex`
- **Client:** `asyncpg` via SQLAlchemy async
- **ORM:** `sqlalchemy.ext.asyncio.AsyncSession`
- **Session Management:**
  - API: `AsyncSessionLocal` (pool_size=20)
  - Worker: `get_worker_session()` (creates fresh engine per task, pool_size=5)
- **Location:** `server/app/database.py`

### Redis

- **Type/Provider:** Redis 7 (Docker)
- **Connection:** `redis://redis:6379/0`
- **Uses:**
  - Celery broker and result backend
  - WebSocket pub/sub for multi-worker broadcasting
  - Cache (implicitly via Celery)
- **Location:** `server/app/redis_pubsub.py`

### File Storage

- **Approach:** Local filesystem only (no S3/Cloud storage)
- **Volume:** `db_data` for PostgreSQL persistence

---

## WebSocket Integration

### Architecture

**Pattern:** FastAPI WebSocket + Redis pub/sub for multi-worker broadcast

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Client A   │     │  Client B   │     │  Client N   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                    │                    │
       ▼                    ▼                    ▼
┌──────────────────────────────────────────────────────────┐
│              FastAPI WebSocket Endpoint                    │
│         /app/websocket.manager (ConnectionManager)         │
└──────────────────────────────────────────────────────────┘
       │                                  ▲
       │         Redis pub/sub relay        │
       │    (start_redis_relay)         │
       ▼                                  │
┌──────────────────────────────────────────────────────────┐
│           Redis (ws:broadcast, ws:team:*)              │
└──────────────────────────────────────────────────────────┘
       ▲
       │     Celery worker publishes
       │
┌──────┴───────────────────────────────────────────────┐
│  Celery Tasks (game_tick, evaluate_solution, etc.)  │
│  use publish_broadcast_sync() / publish_to_team_sync│
└──────────────────────────────────────────────────────┘
```

### Connection Manager (`server/app/websocket.py`)

- **Singleton:** `manager = ConnectionManager()`
- **Features:**
  - `add(ws, team_id, role)` - Register connection with team metadata
  - `remove(ws)` - Clean disconnect
  - `broadcast(message)` - Send to ALL connected clients
  - `send_to_team(team_id, message)` - Team-specific broadcast
  - Tracks connection count for monitoring

### Redis Pub/Sub (`server/app/redis_pubsub.py`)

**Channels:**

- `ws:broadcast` - Global broadcasts
- `ws:team:{team_id}` - Team-specific messages

**Publisher API (for Celery workers):**

```python
publish_broadcast_sync(message: dict)      # Synchronous for Celery
publish_to_team_sync(team_id, message: dict)  # Synchronous for Celery
```

**Subscriber (FastAPI lifespan):**

```python
async def start_redis_relay()  # Runs as background task
```

### WebSocket Endpoint (`server/app/main.py`)

```python
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    # Authenticate via token query param
    # Register with manager.add(ws, team_id, role)
    # Listen loop: receive and broadcast
    # On disconnect: manager.remove(ws)
```

---

## Celery Tasks

### Task Architecture

**Location:** `server/app/worker/tasks/`

### Task: `solution.evaluate` (`evaluate_solution.py`)

- **Queue:** Default
- **Time Limit:** 120 seconds (overrides global 60s for LLM latency)
- **Flow:**
  1. Build evaluation prompt from Solution
  2. Call OpenRouter LLM via `call_openrouter()`
  3. Save Evaluation to DB (status: PENDING_APPROVAL)
  4. Commit DB
  5. Broadcast via Redis: `evaluation_pending` event
  6. On failure: Create FAILED evaluation, notify team

### Task: `game.tick` (`game_tick.py`)

- **Schedule:** Every 60 seconds (beat schedule)
- **Flow:**
  1. Advance game simulation clock
  2. Calculate new stock prices
  3. Update DB and Redis
  4. Broadcast price updates via Redis

### Task: `generate_news` (`generate_news.py`)

- **Purpose:** Generate market news events
- **Trigger:** Called by simulation service

---

## Authentication & Identity

### JWT Implementation

- **Location:** `server/app/auth_utils.py`, `server/app/api/auth.py`
- **Library:** `PyJWT` (>=2.9.0)
- **Algorithm:** HS256 (default)
- **Env Vars:**
  - `JWT_SECRET` - Secret key for signing
  - `JWT_EXPIRY_HOURS` - Token validity (default: 24)

### Password Hashing

- **Library:** `bcrypt` (>=4.1.0)
- **Location:** Used in team/admin registration

---

## Environment Configuration

### Required Env Vars (`server/.env`)

| Variable              | Description         | Example                        |
| --------------------- | ------------------- | ------------------------------ |
| `DATABASE_URL`        | Postgres connection | `postgresql+asyncpg://...`     |
| `REDIS_URL`           | Redis connection    | `redis://redis:6379/0`         |
| `OPENROUTER_API_KEY`  | LLM API key         | `sk-or-...`                    |
| `OPENROUTER_BASE_URL` | LLM base URL        | `https://openrouter.ai/api/v1` |
| `JWT_SECRET`          | JWT signing secret  | (random string)                |

### Settings Class

**Location:** `server/app/database.py`

```python
class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str
    OPENROUTER_API_KEY: str
    OPENROUTER_BASE_URL: str
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 24
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
```

---

## Caddy Reverse Proxy

### Configuration (`Caddyfile`)

```
:80 {
    reverse_proxy api:80 {
        flush_interval -1
    }
}
```

### Features:

- WebSocket proxying (native Caddy support)
- Auto-TLS on port 443
- Port mapping: 8080:80, 443:443

---

## Monitoring & Observability

### Health Checks

| Service | Check                 | Interval |
| ------- | --------------------- | -------- |
| db      | `pg_isready`          | 10s      |
| redis   | `redis-cli ping`      | 10s      |
| api     | `GET /health`         | 30s      |
| worker  | `celery inspect ping` | 30s      |

---

## Test Infrastructure

### Test Framework

- **Runner:** pytest
- **Async Support:** pytest-asyncio (`asyncio_mode = "auto"`)
- **Location:** `server/tests/`

---

_Integration audit: 2026-04-17_
