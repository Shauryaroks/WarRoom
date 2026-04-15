# Phase 2: Game State and Lobby - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the game lifecycle state machine (start/pause/resume/end), server-authoritative timer with pause offset handling, lobby-to-game transition via WebSocket, and Celery task guards that respect game state. Admin is the sole controller of game state transitions.

</domain>

<decisions>
## Implementation Decisions

### Game State Machine
- **D-01:** Game state (SETUP/ACTIVE/PAUSED/FINISHED) stored in PostgreSQL as source of truth, cached in Redis for fast reads by Celery tasks and WebSocket broadcasts. State changes write to DB first, then update Redis cache.
- **D-02:** Admin-only controls — only admin can start, pause, resume, and end the game. No automatic state transitions (no auto-pause at round end, no auto-resume).
- **D-03:** Existing `GameStatus` enum in models.py (SETUP, ACTIVE, PAUSED, FINISHED) is sufficient — no new states needed.

### Timer Behavior
- **D-04:** Global elapsed timer — one timer counting total elapsed game time. Not per-round.
- **D-05:** Timer pauses when game is PAUSED, resumes from where it left off. Elapsed time = total active time (excludes paused durations). Server tracks `started_at`, `paused_at`, and `total_paused_duration`.
- **D-06:** Frontend displays elapsed game time + current simulated quarter. Quarter transitions are manually triggered by admin (not automatic every 20 minutes). Timer shows "0000" until admin sets the quarter.
- **D-07:** Timer is server-authoritative — clients receive elapsed time via WebSocket tick (every second or on state change), never compute locally.

### Lobby-to-Game Transition
- **D-08:** Instant redirect — when admin starts the game, WebSocket broadcasts `game_started` event, all lobby clients immediately redirect to `/game`. No countdown.

### Celery Task Guards
- **D-09:** Claude's discretion on guard method (Redis key check vs DB query). Recommendation: Redis key check for speed (~1ms vs ~5ms), since Redis cache is updated on every state change anyway.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Core value, constraints, game flow
- `.planning/REQUIREMENTS.md` — GAME-01..04 requirements for this phase
- `.planning/ROADMAP.md` — Phase 2 success criteria and requirement mappings

### Phase 1 Output (dependencies)
- `server/app/models.py` — GameStatus enum, Team model, existing schema
- `server/app/websocket.py` — ConnectionManager for broadcasting state changes
- `server/app/redis_pubsub.py` — Redis pub/sub relay for Celery-to-WebSocket bridge
- `server/app/main.py` — FastAPI app with WebSocket endpoint, lifespan
- `server/app/auth_utils.py` — JWT auth, require_admin dependency
- `server/app/worker/celery_app.py` — Celery config, Beat scheduler
- `client/src/app/lobby/page.tsx` — Existing lobby page to extend
- `client/src/hooks/use-websocket.ts` — WebSocket hook for receiving state broadcasts
- `client/src/stores/auth-store.ts` — Zustand auth store

### Research
- `.planning/research/PITFALLS.md` — Celery tasks ignoring game pause (critical pitfall)
- `.planning/research/ARCHITECTURE.md` — Worker-to-WebSocket communication pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ConnectionManager.broadcast()` — broadcast game state changes to all WebSocket clients
- `publish_broadcast_sync()` in redis_pubsub.py — publish from Celery tasks to Redis channel
- `require_admin` dependency in auth_utils.py — protect admin-only game control endpoints
- Lobby page already has team list, connection indicator, and WebSocket integration

### Established Patterns
- Admin endpoints at `/admin/*` with `require_admin` dependency
- WebSocket messages as JSON with `type` field for routing
- Zustand stores with persist middleware for client state
- Redis pub/sub relay pattern: Celery worker → Redis channel → FastAPI subscriber → WebSocket broadcast

### Integration Points
- New admin endpoints for game control (/admin/game/start, /pause, /resume)
- Game state broadcasts via existing WebSocket infrastructure
- Celery Beat tasks need game state guard (check Redis before executing)
- Lobby page needs to listen for `game_started` event and redirect
- New game store (Zustand) for tracking game state on client

</code_context>

<specifics>
## Specific Ideas

- Quarter display shows "0000" by default — admin manually advances quarters via a control in the admin panel
- Game state changes should be near-instant (<1 second) for all connected clients
- Pausing the game must stop ALL background simulation work — no price ticks, no bankruptcy checks, no news generation during pause

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-game-state-and-lobby*
*Context gathered: 2026-04-16*
