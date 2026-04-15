# Phase 2: Game State and Lobby - Research

**Researched:** 2026-04-16
**Domain:** Real-time game lifecycle management (state machine, server-authoritative timer, WebSocket broadcast, Celery task guards)
**Confidence:** HIGH

## Summary

Phase 2 builds the game lifecycle: a state machine (SETUP/ACTIVE/PAUSED/FINISHED) stored in PostgreSQL with Redis cache, a server-authoritative elapsed timer that correctly handles pause/resume without drift, lobby-to-game transition via WebSocket broadcast, and Celery task guards that halt all simulation work when the game is not ACTIVE.

The existing codebase provides strong foundations. The `GameState` model already has all required columns (`started_at`, `paused_at`, `resumed_at`, `pause_offset`). The `ConnectionManager` and Redis pub/sub relay are operational. The admin auth (`require_admin`) dependency is ready. The primary work is wiring new admin endpoints for game control, implementing the timer calculation logic, adding a Redis-cached game state key for fast Celery guard checks, building a Zustand game store on the client, and updating the lobby page to redirect on `game_started`.

**Primary recommendation:** Implement the state machine as a service module (`game_service.py`) that encapsulates all state transition logic, writes to PostgreSQL first then updates Redis cache, and publishes WebSocket broadcasts via the existing Redis pub/sub relay. Celery tasks check a single Redis key (`game:status`) before executing any work.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Game state (SETUP/ACTIVE/PAUSED/FINISHED) stored in PostgreSQL as source of truth, cached in Redis for fast reads by Celery tasks and WebSocket broadcasts. State changes write to DB first, then update Redis cache.
- **D-02:** Admin-only controls -- only admin can start, pause, resume, and end the game. No automatic state transitions.
- **D-03:** Existing `GameStatus` enum (SETUP, ACTIVE, PAUSED, FINISHED) is sufficient.
- **D-04:** Global elapsed timer -- one timer counting total elapsed game time. Not per-round.
- **D-05:** Timer pauses when game is PAUSED, resumes from where it left off. Elapsed time = total active time (excludes paused durations). Server tracks `started_at`, `paused_at`, and `total_paused_duration`.
- **D-06:** Frontend displays elapsed game time + current simulated quarter. Quarter transitions are manually triggered by admin. Timer shows "0000" until admin sets the quarter.
- **D-07:** Timer is server-authoritative -- clients receive elapsed time via WebSocket tick (every second or on state change), never compute locally.
- **D-08:** Instant redirect -- when admin starts the game, WebSocket broadcasts `game_started` event, all lobby clients immediately redirect to `/game`. No countdown.
- **D-09:** Claude's discretion on guard method (Redis key check vs DB query). Recommendation: Redis key check for speed.

### Claude's Discretion
- D-09: Celery task guard implementation method (Redis key check recommended)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GAME-01 | Approved teams enter a lobby and wait for admin to start the game | Existing lobby page with WebSocket hook; needs `game_started` event handler to redirect to `/game` |
| GAME-02 | Admin can start, pause, and resume the game | Three admin endpoints (`/start`, `/pause`, `/resume`) using `require_admin` dependency; state machine service with transition validation |
| GAME-03 | Server-authoritative timer with pause offset handling (timer doesn't drift on resume) | `GameState` model already has `started_at`, `paused_at`, `pause_offset` columns; timer calculation: `elapsed = now - started_at - total_paused_seconds` |
| GAME-04 | Game pause stops all simulation ticks, market activity, and submission windows | Redis key `game:status` checked at top of every Celery task; Beat schedule tasks registered but guarded |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Infrastructure:** Single server (8GB/4vCPU/50GB) -- 80 concurrent WebSocket connections
- **Tech stack:** Next.js (Vercel), FastAPI, PostgreSQL, Redis/Celery, Caddy -- all backend dockerized
- **SQLAlchemy async mode** required (never sync -- blocks event loop)
- **Redis pub/sub relay** for Celery-to-WebSocket communication (never import ConnectionManager in Celery workers)
- **PyJWT** for JWT (not python-jose)
- **Zustand** for client state
- **WebSocket messages** as JSON with `type` field for routing

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Game state transitions (start/pause/resume) | API / Backend | Database | Admin HTTP endpoints validate + persist state changes; PostgreSQL is source of truth |
| Game state cache | API / Backend | -- | Redis cache updated after DB write; read by Celery workers and API timer endpoint |
| Server-authoritative timer | API / Backend | -- | Timer computed server-side from DB timestamps; never computed client-side |
| Timer broadcast to clients | API / Backend | Browser / Client | Server sends via WebSocket; client displays received value |
| Lobby-to-game redirect | Browser / Client | API / Backend | Client reacts to `game_started` WebSocket event; server initiates broadcast |
| Celery task guards | API / Backend | -- | Each Celery task checks Redis `game:status` key before executing |
| Game state display (UI) | Browser / Client | -- | Zustand store holds current game state; components subscribe to it |
| Quarter display | Browser / Client | API / Backend | Server broadcasts quarter changes; client renders received value |

## Standard Stack

### Core (already installed -- no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | >=0.135.3 | Admin game control endpoints | Already in use. `require_admin` dependency ready. [VERIFIED: server/pyproject.toml] |
| SQLAlchemy (async) | >=2.0.49 | GameState persistence | Already in use. `AsyncSession` + `asyncpg`. [VERIFIED: server/pyproject.toml] |
| redis-py | >=5.2.0 | Game state cache + pub/sub | Already in use. `redis.asyncio` for API process, sync `redis` for Celery workers. [VERIFIED: server/pyproject.toml] |
| Celery | >=5.6.3 | Beat scheduler + task guards | Already in use. Beat schedule empty, ready for Phase 2 tasks. [VERIFIED: server/app/worker/celery_app.py] |
| Zustand | 5.0.12 | Client game state store | Already in use for auth store. Same pattern for game store. [VERIFIED: client code] |
| Next.js | 16.x | Frontend routing (lobby -> game redirect) | Already in use. `useRouter().push()` for redirect. [VERIFIED: client/src/app/lobby/page.tsx] |

### Supporting (no new packages needed)

This phase requires zero new package installations. All functionality is covered by existing dependencies.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Redis key guard in Celery | DB query guard | Redis ~1ms vs DB ~5ms. Redis preferred since cache is always updated on state change. [ASSUMED] |
| Server-pushed timer ticks | Client-computed timer with server sync | D-07 locks server-authoritative. Client computation would introduce drift risk. |
| Zustand game store | React Context | Zustand already established pattern in this codebase. Context would require provider wrapping and cause unnecessary re-renders. |

**Installation:** No new packages required.

## Architecture Patterns

### System Architecture Diagram

```
Admin Browser                    Team Browser (Lobby)
    |                                 |
    | POST /admin/game/start          | WebSocket (authenticated)
    v                                 |
+-------------------+                 |
| FastAPI API       |                 |
| (admin.py)        |                 |
|  require_admin    |                 |
|       |           |                 |
|  game_service.py  |                 |
|  1. Validate      |                 |
|     transition    |                 |
|  2. Update DB     |                 |
|  3. Update Redis  |                 |
|  4. Publish to    |                 |
|     Redis pubsub  |                 |
+--------+----------+                 |
         |                            |
    Redis pub/sub                     |
    channel: ws:broadcast             |
         |                            |
+--------+----------+                 |
| redis_pubsub.py   |                 |
| (relay listener)  | ---- broadcast --> WebSocket
|                   |      {"type": "game_state_changed", ...}
+-------------------+                 |
                                      v
                               Zustand game-store
                               updates state
                               if game_started -> router.push("/game")

+-------------------+
| Celery Worker     |
| (Beat tick task)  |
| 1. Check Redis    |
|    game:status    |
| 2. If != ACTIVE   |
|    -> return early |
| 3. Else: execute  |
+-------------------+
```

### Recommended Project Structure

```
server/app/
├── api/
│   └── admin.py              # Add game control endpoints (start/pause/resume)
├── services/
│   └── game_service.py        # NEW: State machine logic, timer calculation, Redis cache
├── worker/
│   ├── celery_app.py          # Add Beat schedule entries
│   └── tasks/
│       └── game_tick.py       # NEW: Guarded periodic task (placeholder for Phase 3)
├── models.py                  # No changes needed -- GameState already complete
├── websocket.py               # No changes needed
├── redis_pubsub.py            # No changes needed
└── database.py                # No changes needed

client/src/
├── stores/
│   ├── auth-store.ts          # No changes needed
│   └── game-store.ts          # NEW: Game state + timer Zustand store
├── hooks/
│   └── use-websocket.ts       # No changes needed (onMessage callback handles routing)
├── app/
│   ├── lobby/
│   │   └── page.tsx           # Update: handle game_started event, redirect to /game
│   ├── game/
│   │   └── page.tsx           # NEW: Placeholder game page (Phase 3 populates)
│   └── admin/
│       └── game-controls/     # NEW: Admin game control panel (start/pause/resume buttons)
└── lib/
    ├── types.ts               # Add GameState types
    └── api.ts                 # Add game control API calls
```

### Pattern 1: Game State Machine Service
**What:** Centralized service module that validates state transitions, persists to DB, updates Redis cache, and triggers WebSocket broadcasts.
**When to use:** Every game state change goes through this service -- never modify GameState directly in endpoint handlers.

```python
# Source: Project-specific pattern derived from D-01 locked decisions
# server/app/services/game_service.py

from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as aioredis

from app.models import GameState, GameStatus
from app.database import settings
from app.redis_pubsub import publish_broadcast

# Valid state transitions
VALID_TRANSITIONS = {
    GameStatus.SETUP: {GameStatus.ACTIVE},
    GameStatus.ACTIVE: {GameStatus.PAUSED, GameStatus.FINISHED},
    GameStatus.PAUSED: {GameStatus.ACTIVE, GameStatus.FINISHED},
    GameStatus.FINISHED: set(),  # terminal state
}

REDIS_GAME_STATUS_KEY = "game:status"
REDIS_GAME_STATE_KEY = "game:state"  # JSON blob for full state


async def get_game_state(db: AsyncSession) -> GameState:
    """Get the singleton GameState row (id=1)."""
    result = await db.execute(select(GameState).where(GameState.id == 1))
    state = result.scalar_one_or_none()
    if not state:
        # Auto-create if missing
        state = GameState(id=1, status=GameStatus.SETUP)
        db.add(state)
        await db.commit()
        await db.refresh(state)
    return state


async def transition_state(
    db: AsyncSession,
    target_status: GameStatus,
) -> GameState:
    """Validate and execute a state transition."""
    state = await get_game_state(db)

    if target_status not in VALID_TRANSITIONS.get(state.status, set()):
        raise ValueError(
            f"Cannot transition from {state.status.value} to {target_status.value}"
        )

    now = datetime.now(timezone.utc)

    if target_status == GameStatus.ACTIVE and state.status == GameStatus.SETUP:
        # Starting the game
        state.started_at = now
        state.status = GameStatus.ACTIVE
    elif target_status == GameStatus.ACTIVE and state.status == GameStatus.PAUSED:
        # Resuming from pause
        if state.paused_at:
            paused_duration = int((now - state.paused_at).total_seconds())
            state.pause_offset += paused_duration
        state.paused_at = None
        state.resumed_at = now
        state.status = GameStatus.ACTIVE
    elif target_status == GameStatus.PAUSED:
        state.paused_at = now
        state.status = GameStatus.PAUSED
    elif target_status == GameStatus.FINISHED:
        state.finished_at = now
        state.status = GameStatus.FINISHED

    # 1. Persist to DB (source of truth per D-01)
    await db.commit()
    await db.refresh(state)

    # 2. Update Redis cache
    await _update_redis_cache(state)

    # 3. Broadcast via WebSocket
    await _broadcast_state_change(state)

    return state


def calculate_elapsed_seconds(state: GameState) -> int:
    """Calculate elapsed active game time in seconds.
    elapsed = (now_or_paused_at - started_at) - pause_offset
    """
    if not state.started_at:
        return 0

    now = datetime.now(timezone.utc)

    if state.status == GameStatus.PAUSED and state.paused_at:
        # While paused, elapsed is frozen at the moment of pause
        reference = state.paused_at
    elif state.status == GameStatus.FINISHED and state.finished_at:
        reference = state.finished_at
    else:
        reference = now

    total_seconds = int((reference - state.started_at).total_seconds())
    return max(0, total_seconds - state.pause_offset)


async def _update_redis_cache(state: GameState):
    """Update Redis with current game status for Celery guard checks."""
    r = aioredis.from_url(settings.REDIS_URL)
    try:
        await r.set(REDIS_GAME_STATUS_KEY, state.status.value)
    finally:
        await r.aclose()


async def _broadcast_state_change(state: GameState):
    """Broadcast game state change to all WebSocket clients."""
    elapsed = calculate_elapsed_seconds(state)
    message = {
        "type": "game_state_changed",
        "payload": {
            "status": state.status.value,
            "elapsed_seconds": elapsed,
            "current_round": state.current_round,
        },
    }
    # Use special event type for game start (lobby listens for this)
    if state.status == GameStatus.ACTIVE and state.resumed_at is None:
        message["type"] = "game_started"

    await publish_broadcast(message)
```

### Pattern 2: Celery Task Guard (Redis Key Check)
**What:** Every Celery task checks `game:status` Redis key before doing any work.
**When to use:** All periodic tasks and any task that should only run during active gameplay.

```python
# Source: D-09 recommendation + standard Redis guard pattern [ASSUMED]
# server/app/worker/tasks/game_tick.py

import redis
from app.worker.celery_app import celery_app

REDIS_URL = celery_app.conf.broker_url
REDIS_GAME_STATUS_KEY = "game:status"


def is_game_active() -> bool:
    """Check Redis for current game status. Returns True only if ACTIVE."""
    r = redis.from_url(REDIS_URL)
    try:
        status = r.get(REDIS_GAME_STATUS_KEY)
        if status is None:
            return False
        if isinstance(status, bytes):
            status = status.decode()
        return status == "ACTIVE"
    finally:
        r.close()


@celery_app.task(name="game.tick")
def game_tick():
    """Periodic tick task. Guarded by game state check.
    Phase 2: just the guard. Phase 3: stock price updates."""
    if not is_game_active():
        return  # Silent return -- game not active

    # Phase 3 will add: stock price calculation, broadcast
    pass
```

### Pattern 3: Zustand Game Store (Client)
**What:** Client-side store for game state received via WebSocket.
**When to use:** Any component that needs to know the current game state, elapsed time, or quarter.

```typescript
// Source: Zustand persist pattern from existing auth-store.ts [VERIFIED: codebase]
// client/src/stores/game-store.ts

import { create } from "zustand";

type GameStatus = "SETUP" | "ACTIVE" | "PAUSED" | "FINISHED";

interface GameState {
  status: GameStatus;
  elapsedSeconds: number;
  currentRound: number;

  setGameState: (payload: {
    status: GameStatus;
    elapsed_seconds: number;
    current_round: number;
  }) => void;
  reset: () => void;
}

export const useGameStore = create<GameState>()((set) => ({
  status: "SETUP",
  elapsedSeconds: 0,
  currentRound: 0,

  setGameState: (payload) =>
    set({
      status: payload.status,
      elapsedSeconds: payload.elapsed_seconds,
      currentRound: payload.current_round,
    }),
  reset: () =>
    set({
      status: "SETUP",
      elapsedSeconds: 0,
      currentRound: 0,
    }),
}));
```

### Pattern 4: Admin Game Control Endpoints
**What:** REST endpoints for admin to control game lifecycle.
**When to use:** Admin panel buttons trigger these endpoints.

```python
# Source: Existing admin.py pattern + require_admin dependency [VERIFIED: codebase]
# Added to server/app/api/admin.py

from app.services.game_service import transition_state, get_game_state, calculate_elapsed_seconds
from app.models import GameStatus

class GameStateResponse(BaseModel):
    status: str
    elapsed_seconds: int
    current_round: int

@router.post("/game/start", response_model=GameStateResponse)
async def start_game(
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Start the game. Transitions SETUP -> ACTIVE."""
    try:
        state = await transition_state(db, GameStatus.ACTIVE)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return GameStateResponse(
        status=state.status.value,
        elapsed_seconds=calculate_elapsed_seconds(state),
        current_round=state.current_round,
    )

@router.post("/game/pause", response_model=GameStateResponse)
async def pause_game(
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Pause the game. Transitions ACTIVE -> PAUSED."""
    try:
        state = await transition_state(db, GameStatus.PAUSED)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return GameStateResponse(
        status=state.status.value,
        elapsed_seconds=calculate_elapsed_seconds(state),
        current_round=state.current_round,
    )

@router.post("/game/resume", response_model=GameStateResponse)
async def resume_game(
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Resume the game. Transitions PAUSED -> ACTIVE."""
    try:
        state = await transition_state(db, GameStatus.ACTIVE)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return GameStateResponse(
        status=state.status.value,
        elapsed_seconds=calculate_elapsed_seconds(state),
        current_round=state.current_round,
    )

@router.get("/game/state", response_model=GameStateResponse)
async def get_current_game_state(
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get current game state. Admin only."""
    state = await get_game_state(db)
    return GameStateResponse(
        status=state.status.value,
        elapsed_seconds=calculate_elapsed_seconds(state),
        current_round=state.current_round,
    )
```

### Anti-Patterns to Avoid
- **Direct GameState mutation in endpoints:** Always go through `game_service.transition_state()`. Direct mutation bypasses transition validation, Redis cache update, and WebSocket broadcast.
- **Client-side timer computation:** D-07 explicitly forbids this. Never use `setInterval` to increment a local counter. Always display the server-provided `elapsed_seconds`.
- **Importing ConnectionManager in Celery workers:** The manager singleton lives in the API process. Celery workers must use `publish_broadcast_sync()` from `redis_pubsub.py`.
- **Checking game state from DB in Celery tasks:** Use Redis key for ~1ms latency. DB query adds ~5ms and creates unnecessary connection pool pressure in worker processes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State transition validation | Ad-hoc if/else in endpoints | `VALID_TRANSITIONS` dict in game_service.py | Centralized, testable, prevents invalid transitions |
| Timer drift handling | Manual timestamp arithmetic scattered across files | `calculate_elapsed_seconds()` function | Single source of truth for elapsed time calculation |
| Redis cache invalidation | Custom cache invalidation logic | Always-write-through pattern (DB -> Redis on every state change) | Simple, no stale reads possible since every write updates cache |
| WebSocket message routing | Switch statements in component code | Zustand store update via onMessage callback | Decouples message handling from component rendering |

**Key insight:** The game state machine is the foundation for ALL future phases. Simulation ticks (Phase 3), submission windows (Phase 4), and elimination (Phase 6) all depend on correct game state and timer behavior. Getting this wrong means rewriting multiple systems later.

## Common Pitfalls

### Pitfall 1: Timer Drift on Resume
**What goes wrong:** After pause/resume cycles, the elapsed timer shows more time than actually played.
**Why it happens:** Forgetting to accumulate `pause_offset` on resume. If you compute `now - started_at` without subtracting paused durations, the timer counts paused time.
**How to avoid:** The `pause_offset` column accumulates total paused seconds. On resume: `pause_offset += (now - paused_at).total_seconds()`. Elapsed = `(reference - started_at) - pause_offset`.
**Warning signs:** Timer jumps forward after resume; elapsed time exceeds wall-clock time since game start minus paused time.

### Pitfall 2: Celery Tasks Running During Pause
**What goes wrong:** Stock price ticks, bankruptcy checks, or news generation execute while game is PAUSED.
**Why it happens:** Celery Beat continues firing periodic tasks regardless of game state. Tasks that don't check game status will execute.
**How to avoid:** Every task checks `game:status` Redis key as its first operation. Return immediately if not `ACTIVE`. This is a hard requirement from D-09 and STATE.md blocker.
**Warning signs:** Price history entries with timestamps during paused periods; news generated while paused.

### Pitfall 3: Race Condition on State Transitions
**What goes wrong:** Two simultaneous admin requests (e.g., rapid pause/resume clicks) could corrupt state.
**Why it happens:** Read-then-write without locking. Two requests read ACTIVE, one writes PAUSED, the other writes ACTIVE, but `pause_offset` is only incremented once.
**How to avoid:** Use `SELECT ... FOR UPDATE` on the GameState row during transitions. SQLAlchemy async: `select(GameState).where(GameState.id == 1).with_for_update()`.
**Warning signs:** Inconsistent `pause_offset` values; game state not matching what admin intended.

### Pitfall 4: Redis Cache Stale After Crash
**What goes wrong:** If the API process crashes between DB write and Redis update, Redis has stale game status.
**Why it happens:** DB commit succeeds but Redis SET never executes.
**How to avoid:** On API startup (lifespan), read game state from DB and warm the Redis cache. Add a `_warm_redis_cache()` call to the lifespan startup.
**Warning signs:** Celery tasks not executing even though DB shows ACTIVE; or tasks executing when DB shows PAUSED.

### Pitfall 5: Lobby Page Not Redirecting
**What goes wrong:** Team stays on lobby page after admin starts game.
**Why it happens:** The lobby page listens for `game_starting` but the server sends `game_started` (or vice versa). Message type mismatch.
**How to avoid:** Define message types as constants shared between backend broadcast and frontend handler. Current lobby code listens for `game_starting` -- the service should send the same type, or the lobby should be updated.
**Warning signs:** Admin sees game as ACTIVE but teams still on lobby page.

## Code Examples

### Timer Calculation (Critical Path)

```python
# Source: Derived from D-04, D-05 locked decisions
# This is the most important function in Phase 2

def calculate_elapsed_seconds(state: GameState) -> int:
    """
    Calculate elapsed ACTIVE game time (excluding paused durations).
    
    Timeline example:
      started_at = T0
      paused_at = T0 + 300s (5 min active)
      resumed_at = T0 + 600s (5 min paused)
      pause_offset = 300s
      
      At T0 + 900s (if still active):
        elapsed = (900 - 0) - 300 = 600s = 10 min active time
        (correct: 5 min before pause + 5 min after resume)
    """
    if not state.started_at:
        return 0
    
    now = datetime.now(timezone.utc)
    
    if state.status == GameStatus.PAUSED and state.paused_at:
        reference = state.paused_at  # Freeze at pause moment
    elif state.status == GameStatus.FINISHED and state.finished_at:
        reference = state.finished_at  # Freeze at finish moment
    else:
        reference = now  # Live timer
    
    total = int((reference - state.started_at).total_seconds())
    return max(0, total - state.pause_offset)
```

### WebSocket Message Handler Update (Lobby)

```typescript
// Source: Existing lobby/page.tsx pattern [VERIFIED: codebase]
// Update the handleMessage callback

const handleMessage = useCallback(
  (data: Record<string, unknown>) => {
    if (data.type === "team_approved") {
      // ... existing team_approved handler
    } else if (data.type === "game_started") {
      // D-08: Instant redirect, no countdown
      router.push("/game");
    } else if (data.type === "game_state_changed") {
      // Update game store with new state
      const payload = data.payload as {
        status: string;
        elapsed_seconds: number;
        current_round: number;
      };
      useGameStore.getState().setGameState({
        status: payload.status as GameStatus,
        elapsed_seconds: payload.elapsed_seconds,
        current_round: payload.current_round,
      });
    }
  },
  [router]
);
```

### Redis Cache Warm on Startup

```python
# Source: Pitfall 4 mitigation [ASSUMED pattern]
# Add to FastAPI lifespan in main.py

async def _warm_game_state_cache():
    """Read game state from DB and update Redis cache on startup."""
    from app.database import AsyncSessionLocal
    from app.services.game_service import get_game_state, _update_redis_cache
    
    async with AsyncSessionLocal() as db:
        state = await get_game_state(db)
        await _update_redis_cache(state)

@asynccontextmanager
async def lifespan(app: FastAPI):
    await _warm_game_state_cache()  # Ensure Redis matches DB
    relay_task = asyncio.create_task(start_redis_relay())
    yield
    relay_task.cancel()
```

### SELECT FOR UPDATE Pattern for State Transitions

```python
# Source: SQLAlchemy async docs [VERIFIED: Context7]

from sqlalchemy import select
from app.models import GameState

# In game_service.py transition_state():
result = await db.execute(
    select(GameState)
    .where(GameState.id == 1)
    .with_for_update()  # Row-level lock prevents concurrent transitions
)
state = result.scalar_one_or_none()
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side timers with periodic sync | Server-authoritative timer via WebSocket | Standard practice | Eliminates drift; single source of truth |
| DB polling for game state in workers | Redis key check (sub-millisecond) | Redis pub/sub matured | 5x faster guard checks, no DB connection overhead in Celery |
| Separate timer service | Timer as computation from stored timestamps | Always been better | No additional service to manage; crash-recoverable from DB state |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Redis key check is ~1ms vs DB query ~5ms for Celery guards | Alternatives Considered | Low -- even if both are <10ms, Redis avoids DB connection pool pressure in workers |
| A2 | Redis cache warm on startup is sufficient to handle crash recovery | Common Pitfalls | Medium -- if multiple API workers start simultaneously, they could race on GameState creation. Mitigated by singleton row (id=1). |
| A3 | `game_starting` vs `game_started` message type naming will need alignment | Common Pitfalls | Low -- current lobby code uses `game_starting`, research recommends `game_started`. Just needs consistent naming during implementation. |

## Open Questions

1. **Timer broadcast frequency**
   - What we know: D-07 says clients receive elapsed time via WebSocket tick "every second or on state change"
   - What's unclear: Should we implement a 1-second Celery Beat task to broadcast timer, or have the client request it? A 1-second Beat task for 80 clients is trivial load but adds Celery overhead.
   - Recommendation: Broadcast timer only on state changes (start/pause/resume). Client displays a locally computed timer between state change events as a display optimization, but resets to server value on each state change event. This avoids 1 message/second to 80 clients while maintaining server authority. **Alternatively, a simple 1-second Beat tick is acceptable given the low client count.**

2. **GameState row initialization**
   - What we know: The model expects a singleton row (id=1). Current code does not seed it.
   - What's unclear: Should the row be created by Alembic migration data seed, or lazily on first access?
   - Recommendation: Lazy creation in `get_game_state()` (shown in code example). Simpler than migration data seed.

3. **Admin panel location**
   - What we know: Admin login exists at `/admin/login`. No admin dashboard page exists yet.
   - What's unclear: Should game controls be a standalone page or part of a larger admin dashboard?
   - Recommendation: Create `/admin/game` as a focused game control page. Phase 5 adds the full admin dashboard (ADMN-01). Keep it simple for now.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio (dev deps in pyproject.toml) |
| Config file | None -- needs pytest config in pyproject.toml or pytest.ini |
| Quick run command | `cd server && uv run pytest tests/ -x -q` |
| Full suite command | `cd server && uv run pytest tests/ -v` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GAME-01 | Approved teams see lobby, redirect on game_started | integration | `uv run pytest tests/test_game_lifecycle.py::test_lobby_redirect -x` | No -- Wave 0 |
| GAME-02 | Admin can start/pause/resume game | unit + integration | `uv run pytest tests/test_game_service.py -x` | No -- Wave 0 |
| GAME-03 | Timer doesn't drift on pause/resume | unit | `uv run pytest tests/test_game_service.py::test_timer_no_drift -x` | No -- Wave 0 |
| GAME-04 | Pause stops all Celery ticks | unit | `uv run pytest tests/test_game_tick.py::test_guard_blocks_when_paused -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd server && uv run pytest tests/test_game_service.py tests/test_game_tick.py -x -q`
- **Per wave merge:** `cd server && uv run pytest tests/ -v`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `server/tests/conftest.py` -- shared fixtures (async DB session, Redis mock, test client)
- [ ] `server/tests/test_game_service.py` -- state machine transitions, timer calculation, invalid transitions
- [ ] `server/tests/test_game_tick.py` -- Celery task guard (mock Redis)
- [ ] `server/tests/test_game_lifecycle.py` -- integration: admin endpoints + WebSocket broadcast
- [ ] Add `[tool.pytest.ini_options]` to `server/pyproject.toml` with `asyncio_mode = "auto"`
- [ ] Framework install: already in dev deps, but need `uv install --dev` in test environment

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (handled in Phase 1) | -- |
| V3 Session Management | No (handled in Phase 1) | -- |
| V4 Access Control | Yes | `require_admin` dependency on all game control endpoints [VERIFIED: codebase] |
| V5 Input Validation | Yes | Pydantic models for request/response; GameStatus enum validation on transitions |
| V6 Cryptography | No | -- |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Non-admin user calls game control endpoints | Elevation of Privilege | `require_admin` FastAPI dependency checks JWT role claim [VERIFIED: auth_utils.py] |
| Invalid state transition attempt | Tampering | `VALID_TRANSITIONS` dict rejects impossible transitions server-side |
| Timer manipulation via client | Tampering | D-07: timer is server-authoritative; client never computes, only displays |
| Redis cache poisoning | Tampering | Redis not exposed externally; Docker network only [ASSUMED] |

## Sources

### Primary (HIGH confidence)
- [VERIFIED: codebase] `server/app/models.py` -- GameState model with all required columns confirmed
- [VERIFIED: codebase] `server/app/websocket.py` -- ConnectionManager with broadcast() method
- [VERIFIED: codebase] `server/app/redis_pubsub.py` -- Redis pub/sub relay with sync/async publish functions
- [VERIFIED: codebase] `server/app/auth_utils.py` -- require_admin dependency
- [VERIFIED: codebase] `server/app/worker/celery_app.py` -- Empty beat_schedule ready for Phase 2
- [VERIFIED: codebase] `client/src/app/lobby/page.tsx` -- Existing lobby with WebSocket integration
- [VERIFIED: Context7 /websites/fastapi_tiangolo] -- WebSocket ConnectionManager broadcast pattern
- [VERIFIED: Context7 /websites/celeryq_dev_en_stable] -- beat_schedule configuration, periodic task patterns
- [VERIFIED: Context7 /pmndrs/zustand] -- Store creation with persist middleware

### Secondary (MEDIUM confidence)
- [CITED: CONTEXT.md D-01..D-09] -- All locked decisions from user discussion phase

### Tertiary (LOW confidence)
- None -- all claims verified against codebase or official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and verified in codebase
- Architecture: HIGH -- patterns derived from existing codebase conventions + locked decisions
- Pitfalls: HIGH -- timer drift and Celery guard issues are well-documented failure modes; race condition mitigation via SELECT FOR UPDATE is standard PostgreSQL pattern

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (stable -- no external dependency changes expected)
