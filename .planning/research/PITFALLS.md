# Pitfalls Research

**Domain:** Real-time case competition platform with LLM integration, simulated stock trading, WebSocket-driven UI
**Researched:** 2026-04-16
**Confidence:** HIGH (based on codebase analysis + domain research)

## Critical Pitfalls

### Pitfall 1: Trading Race Conditions — No Row Locking on Share Cap Enforcement

**What goes wrong:**
Two teams submit simultaneous buy orders for the same target stock. Both read `current_owned = 50` shares, both check against the 25% ownership cap, both pass validation, both execute. The target company now has more shares sold than allowed. In the existing codebase, `_execute_buy` in `trading.py` does a `SELECT` on `StockHolding` without `FOR UPDATE` or `FOR NO KEY UPDATE`. The entire buy flow (read holdings, check cap, check cash, update) runs without any row-level locking. With 40 teams trading concurrently, this is not a theoretical risk -- it will happen.

**Why it happens:**
Async SQLAlchemy makes it easy to forget that `await db.execute(select(...))` followed by a later `db.add()` / `await db.commit()` is NOT atomic. The read and the write are separate database operations with no lock held between them. Default PostgreSQL isolation level (READ COMMITTED) allows another transaction to insert/update between the read and the write.

**How to avoid:**

1. Use `SELECT ... FOR NO KEY UPDATE` on both the buyer's `StockHolding` row and the target `Team` row before validating. In SQLAlchemy: `select(StockHolding).where(...).with_for_update(key_share=True)`.
2. Wrap the entire buy/sell flow in an explicit transaction with proper commit/rollback.
3. Add a database-level CHECK constraint or trigger on `StockHolding` that enforces the ownership cap as a hard constraint, so even if application logic fails, the DB rejects the violation.
4. Consider a Redis-based distributed lock per `(buyer_id, target_id)` pair for the hot path, falling back to DB locks as the safety net.

**Warning signs:**

- Holdings that exceed the 25% (or 30%) ownership cap in production data
- `IntegrityError` or deadlock exceptions in trading logs
- Teams complaining about inconsistent portfolio values
- Cash going negative despite balance checks

**Phase to address:**
Phase 1 (Core Infrastructure). This must be fixed before any trading feature goes live. A single competition event with broken trading invalidates the entire platform.

---

### Pitfall 2: Celery Workers Running asyncio.run() Inside Sync Tasks — Event Loop Conflicts

**What goes wrong:**
Every Celery task in the codebase (`process_directive`, `recalculate_price_task`, `periodic_price_sweep`, etc.) uses the pattern `asyncio.run(_async_function())`. This creates and destroys a new event loop on every single task invocation. Under load (price sweep every 30s for 40 teams = 40 tasks in rapid succession, plus directive evaluations), this causes: (a) event loop creation overhead, (b) each `asyncio.run()` creates a fresh asyncpg connection pool via `get_worker_session()` which creates a new engine, opening and closing DB connections constantly, (c) potential for `RuntimeError: This event loop is already running` if any Celery signal handler or middleware tries to use asyncio.

**Why it happens:**
Celery is fundamentally synchronous. The project needs async DB access (asyncpg) and async HTTP (httpx for OpenRouter). The path of least resistance is `asyncio.run()` per task, but this is an architectural mismatch that degrades under load.

**How to avoid:**

1. Use a persistent event loop per worker process. Set up an event loop at worker process init time using `@worker_process_init.connect` signal, and run all async tasks on that loop.
2. Alternatively, maintain a single `create_async_engine` per worker process (not per task invocation as `get_worker_session()` currently does). Engine creation is expensive. Use a module-level engine initialized once.
3. For the price sweep specifically: instead of spawning 40 individual `recalculate_price_task.delay()` calls (each creating its own engine), do all 40 price calculations in a single task with a single DB session.
4. Consider replacing Celery with `asyncio` background tasks managed by FastAPI's lifespan for the periodic tick work, since the app runs on a single server anyway. Use Celery only for LLM calls that genuinely need retry/timeout isolation.

**Warning signs:**

- Celery worker memory growing over time (engine/connection pool leaks)
- `asyncpg.exceptions.TooManyConnectionsError` in worker logs
- Price updates becoming delayed or skipped under load
- Worker processes being killed by OOM on the 8GB VPS

**Phase to address:**
Phase 1 (Core Infrastructure). The Celery-async bridge is foundational. Getting this wrong means every background task is unreliable.

---

### Pitfall 3: WebSocket Burst Sync Doing N+1 Queries Per Connection

**What goes wrong:**
When a client connects (or sends `sync_request`), `_build_market_burst()` runs: 1 query for news, 1 query for teams, then for EACH team it runs a query for `PriceHistory` (the last 2 entries). For 40 teams, that is 42 queries per connection. `_build_team_dossier()` does similar N+1 patterns for holdings. When 80 clients connect simultaneously (game start), that is 80 \* 42 = 3,360 queries hitting PostgreSQL in seconds. On an 8GB/4vCPU VPS with `pool_size=20`, this will exhaust the connection pool and cause timeouts.

**Why it happens:**
The burst sync is designed to give each client a complete snapshot on connect, which is correct behavior. But the implementation loads data row-by-row in Python loops instead of using JOINs or batch queries. SQLAlchemy's lazy loading patterns make this easy to write but deadly at scale.

**How to avoid:**

1. Batch the PriceHistory query: use a single query with a window function (`ROW_NUMBER() OVER (PARTITION BY team_id ORDER BY calculated_at DESC)`) to get the last 2 prices for ALL teams in one query.
2. Cache the market burst payload in Redis with a 5-10 second TTL. All 80 clients connecting within the same window get the same cached snapshot. Invalidate on price updates.
3. Stagger reconnections: when the game starts, don't broadcast to all clients simultaneously. Add a small random delay (0-2s) per client.
4. For team dossiers, use `selectinload()` or `joinedload()` on the SQLAlchemy relationships instead of individual `await db.get()` calls inside loops.

**Warning signs:**

- Slow WebSocket connections (>2s to receive initial data)
- PostgreSQL `idle in transaction` connections piling up
- `asyncpg.exceptions.ConnectionDoesNotExistError` during game start
- Database CPU spikes correlated with WebSocket reconnection waves

**Phase to address:**
Phase 2 (Game Engine). Must be optimized before load testing with 40+ teams. The N+1 pattern works fine with 5 teams in development.

---

### Pitfall 4: LLM Evaluation Has No Human-in-the-Loop Gate Despite Project Requirement

**What goes wrong:**
The PROJECT.md explicitly requires "Human-in-the-loop: admin validates/edits LLM scoring before it takes effect." But the current `process_directive` task in `directive.py` immediately calls `apply_financial_impact()` after the LLM returns its evaluation. There is no admin review step. The LLM's financial impact (up to +/- $500K cash delta per directive) is applied directly to team finances. If the LLM scores a garbage directive highly (hallucination), or scores a legitimate directive at 0 (bad day), there is no safety net. With 40 teams submitting directives, the admin cannot possibly review every one, but the system should at least support flagging/holding high-impact evaluations.

**Why it happens:**
The human-in-the-loop flow is architecturally complex: it requires a queue of pending evaluations, an admin UI to review/approve/modify, and a mechanism to "hold" the financial impact until approval. It is natural to skip this during initial development and wire up the direct path.

**How to avoid:**

1. Add a `PENDING_APPROVAL` status to `DirectiveStatus` enum. After LLM evaluation, set status to `PENDING_APPROVAL` instead of `COMPLETED`.
2. Store the LLM's proposed scores and financial impact in the directive row but do NOT call `apply_financial_impact()` yet.
3. Build an admin endpoint (`POST /admin/directives/{id}/approve`) that applies the impact and transitions to `COMPLETED`.
4. Add an admin endpoint to modify scores before approving.
5. Consider auto-approval rules: if extraction_confidence > 0.8 and cash_delta is within a "boring" range (say +/- $50K), auto-approve. Only flag outliers for manual review.
6. Add a WebSocket notification to the admin channel when directives are awaiting review.

**Warning signs:**

- Wild stock price swings from a single team's directive
- Teams gaming the system with nonsensical directives that the LLM scores favorably
- Admin complaints about having no oversight during the competition
- Post-competition disputes about fairness

**Phase to address:**
Phase 2 (Game Engine) or Phase 3 (LLM Integration), depending on phase structure. Must be in place before any real competition event.

---

### Pitfall 5: Game State Transitions Are Not Idempotent and Lack Guard Against Celery Tasks Running During Paused State

**What goes wrong:**
When admin pauses the game, `gs.status = GameStatus.PAUSED` is set in the database. But the Celery beat schedule continues firing `periodic_price_sweep` every 30 seconds and `periodic_bankruptcy_check` every 10 seconds regardless. These tasks do not check game state before executing. Prices keep ticking, bankruptcies keep being evaluated, all while the game is "paused." Additionally, the `stop_game` endpoint resets state to `SETUP` without cleaning up active teams, pending directives, or scheduled Celery tasks (`inject_scheduled_news` with ETAs).

**Why it happens:**
Celery beat schedules are static -- they fire on a timer, not based on application state. The game state is in PostgreSQL, but Celery beat does not consult it. This is a classic distributed state problem.

**How to avoid:**

1. Every periodic Celery task must check game state as its first action: `gs = await db.get(GameState, 1); if gs.status != GameStatus.ACTIVE: return`.
2. When pausing, write `PAUSED` to a Redis key that Celery tasks can check cheaply (avoid hitting PostgreSQL on every tick).
3. When stopping/resetting, revoke all pending scheduled tasks using `celery_app.control.revoke()` or use `celery_app.control.purge()`.
4. Make game transitions idempotent: starting an already-active game returns the current state, pausing an already-paused game is a no-op (not an error).
5. Add a `pause_offset` accumulator so that when the game resumes, elapsed time calculations account for total paused duration.

**Warning signs:**

- Stock prices changing while game is paused (visible on admin dashboard)
- Teams getting eliminated during a crisis event pause
- Duplicate "GAME_STARTED" events in WebSocket logs
- Time-based calculations (simulation window, round duration) being wrong after resume

**Phase to address:**
Phase 2 (Game Engine). Pause/resume is a core admin tool during competition events.

---

### Pitfall 6: No Reconnection Protocol or State Recovery for WebSocket Clients

**What goes wrong:**
When a client's WebSocket disconnects (network hiccup, laptop sleep, browser tab crash), they lose all real-time state. The current implementation handles `WebSocketDisconnect` by just removing the connection from the set. When the client reconnects, `burst_sync` gives them a snapshot, but they have no way to know what events they missed between disconnect and reconnect. A team could miss a crisis announcement, a purge event, or a critical news item during the gap. In a physical competition with co-located teams, this means confusion and disputes.

**Why it happens:**
WebSocket reconnection with gap recovery requires maintaining a sequence number and an event buffer. The codebase has `_next_seq()` (sequence IDs on messages) but no mechanism for clients to say "I last received sequence 47, send me everything after that."

**How to avoid:**

1. Maintain a bounded event buffer (last 100 events) in Redis, keyed by event type (market, team).
2. Client sends `{"type": "sync_request", "last_seq": 47}` on reconnect.
3. Server replays events from `last_seq + 1` to current, then switches to live streaming.
4. For critical events (GAME_STARTED, GAME_PAUSED, PURGE_COMPLETE), store them in the DB as system events so they survive server restarts too.
5. Client-side: implement exponential backoff reconnection with jitter (not aggressive retry loops).

**Warning signs:**

- Teams reporting "the game started but we didn't see it"
- Inconsistent state between two devices of the same team
- Spike in WebSocket connections after network blip (reconnection storm)
- Admin dashboard showing different state than team views

**Phase to address:**
Phase 3 (Polish/Reliability). Basic functionality works without this, but competition reliability requires it.

---

### Pitfall 7: Caddy WebSocket Proxy Dropping Long-Lived Connections

**What goes wrong:**
The Caddyfile is minimal: `reverse_proxy api:80`. Caddy's default HTTP timeout settings may close idle WebSocket connections. If a team's strategist tab is idle for several minutes (reading, thinking), the WebSocket is dropped. Caddy v2 supports WebSocket proxying, but without explicit timeout configuration, connections can be killed by read/write deadlines. The commit history shows multiple fixes for this: "ci: caddy v2 websockets fix", "changes in caddyfile to accomodate websockets headers added", "fix: ws error handling", "fix: handle ws properly on backend", "fix: handle ws properly on frontend" -- five commits fighting this issue.

**Why it happens:**
Caddy's default `read_timeout` and `write_timeout` apply to the entire connection lifecycle, not per-message. For HTTP requests this is fine. For WebSockets that should live for hours, the defaults silently kill connections.

**How to avoid:**

1. Configure Caddy with explicit long timeouts for the WebSocket routes:
   ```
   reverse_proxy api:80 {
       transport http {
           read_timeout 0
           write_timeout 0
       }
   }
   ```
2. Implement ping/pong heartbeats every 15-30 seconds from the server. This keeps the connection alive through any proxy and detects dead clients.
3. The current code has client ping handling but no server-initiated pings. Add a background task per connection that sends pings.
4. If Vercel is the frontend host, note that Vercel does NOT support WebSocket connections from Next.js API routes in production. WebSocket connections must go directly to the backend (via Caddy), not through Vercel.

**Warning signs:**

- WebSocket disconnections after exactly 30s, 60s, or 120s of idle time (timeout signature)
- Clusters of disconnections at the same timestamp
- Repeated `fix: ws` commits in git history (already happening)
- Teams seeing "connection lost" during quiet periods of the game

**Phase to address:**
Phase 1 (Core Infrastructure). This is already a recurring pain point based on commit history.

---

### Pitfall 8: Price Calculation Circular Dependencies and Double-Counting

**What goes wrong:**
The pricing formula in `pricing.py` has a subtle issue: `calculate_base_price()` calls `calculate_vibe_multiplier()`, then `calculate_final_price()` calls `calculate_vibe_multiplier()` AGAIN and multiplies it into the result. The vibe multiplier is applied twice: once inside `base_price` and once as a separate factor. This means the vibe score has a squared effect on price. Additionally, `record_price_history()` re-calculates both `vibe_multiplier` and `sentiment_multiplier` again (3rd and 4th calls), which could return different values if data changed between `calculate_final_price()` and `record_price_history()` (a TOCTOU bug).

**Why it happens:**
The pricing functions were likely built incrementally -- base price first, then multipliers were added. The double-application of vibe is a composition bug that is hard to spot without tracing through the full call chain.

**How to avoid:**

1. Make `calculate_base_price()` a pure fundamentals calculation (no multipliers). Apply all multipliers in `calculate_final_price()` only.
2. Compute ALL price components once and pass them through as a dataclass/dict, not re-query them at each step.
3. Write unit tests that assert `final_price = base * vibe * sentiment` and catch double-counting.
4. The price history should record the values used for the actual price calculation, not re-query them.

**Warning signs:**

- Stock prices that are extremely sensitive to vibe scores (small changes in consistency_score cause large price swings)
- Prices diverging wildly from expected ranges after just a few directive cycles
- Price history records showing different multipliers than what was actually used for pricing

**Phase to address:**
Phase 2 (Game Engine / Simulation). This is a correctness bug, not a scalability issue. Must be caught before the first real competition.

---

## Technical Debt Patterns

| Shortcut                                          | Immediate Benefit                                   | Long-term Cost                                                                 | When Acceptable                                              |
| ------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `asyncio.run()` per Celery task                   | Quick async-in-sync bridge                          | Connection pool churn, memory growth, event loop overhead                      | Never in production -- must fix before competition           |
| No DB migrations for schema changes               | Faster iteration                                    | Data loss on schema change, no rollback path                                   | Development only, already using Alembic correctly            |
| Hardcoded admin API key (`admin-secret-key`)      | Fast development                                    | Trivially guessable auth for entire admin surface                              | Only during local development                                |
| `datetime.utcnow()` everywhere                    | Works in single-timezone                            | No timezone awareness, breaks if server TZ changes, deprecated in Python 3.12+ | Acceptable if all infra is UTC and team is aware             |
| `except Exception: pass` on WebSocket broadcasts  | Prevents broadcast failures from crashing main flow | Silent data loss, teams miss events, debugging blindness                       | Acceptable only if paired with logging (currently it is not) |
| JSON-serializing financial impact as string in DB | Avoids JSONB column setup                           | Cannot query financial impacts efficiently, parsing overhead                   | Acceptable for this scale (40 teams)                         |

## Integration Gotchas

| Integration                 | Common Mistake                                                                 | Correct Approach                                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenRouter API              | No timeout on LLM calls, blocking the Celery worker for minutes                | Set `timeout=30.0` (already done). Also set Celery `task_time_limit` (done at 300s). But 300s is too long -- a hung LLM call blocks a worker for 5 minutes. Reduce to 60s.             |
| Vercel + FastAPI WebSocket  | Assuming Vercel can proxy WebSocket connections to backend                     | Vercel does NOT proxy WebSockets. Frontend must connect directly to the backend WebSocket endpoint (e.g., `wss://api-complex.helixtiet.in/ws/market`), not through a Vercel API route. |
| Redis as Celery broker      | Using same Redis instance for broker AND cache/pub-sub without key namespacing | Use separate Redis databases (db=0 for Celery, db=1 for caching, db=2 for pub-sub) or at minimum use key prefixes. A Celery `purge()` should not wipe cached market data.              |
| asyncpg in forked processes | Sharing a connection pool across fork boundaries (Celery prefork)              | `get_worker_session()` correctly creates a new engine per task, but this is expensive. Better: use `solo` pool or create one engine per worker process, not per task.                  |
| Alembic with async engine   | Running `alembic upgrade head` with the async driver URL                       | Alembic migrations should use the sync `psycopg2` driver, not `asyncpg`. The alembic env.py needs a sync engine URL variant.                                                           |

## Performance Traps

| Trap                                                                       | Symptoms                                                                            | Prevention                                                                                                                                                                                 | When It Breaks                                                        |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Broadcasting to all WebSocket clients sequentially                         | Broadcast latency grows linearly with client count                                  | Use `asyncio.gather()` for concurrent sends (already partially done but verify)                                                                                                            | At 40+ clients, last client gets data 1-2s late                       |
| PriceHistory table growing unbounded                                       | Queries slow down as game progresses, especially the "last 2 prices" query per team | Add index on `(team_id, calculated_at DESC)`. Partition or truncate after each competition. At 40 teams _ 2 ticks/min _ 120 min = 9,600 rows per game -- manageable but index is essential | At 5,000+ rows without index                                          |
| Full dossier rebuild on every sync_request                                 | Database hammered when clients reconnect in bursts                                  | Cache dossier per team in Redis (10s TTL), serve from cache                                                                                                                                | When 80 clients reconnect simultaneously (e.g., after a network blip) |
| Loading all holdings with individual `db.get(Team, target_id)` per holding | N+1 query per holding per team per sync                                             | Use a single JOIN query or batch-load all target teams                                                                                                                                     | When a team has holdings in 10+ companies                             |

## Security Mistakes

| Mistake                                                                        | Risk                                                                                                                                                                                | Prevention                                                                                                                                                                           |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Admin API key in environment variable with default fallback `admin-secret-key` | Anyone can control the game, start/stop/purge, eliminate teams                                                                                                                      | Remove the default. Fail loudly if `ADMIN_API_KEY` is not set. Use a strong random key.                                                                                              |
| No rate limiting on trading endpoint                                           | A single team can spam buy/sell requests, potentially exploiting race conditions or overwhelming the server                                                                         | Add per-team rate limiting (e.g., max 10 orders per minute) via Redis counter                                                                                                        |
| LLM prompt injection partially handled but exploitable                         | The `INJECTION_PATTERNS` regex catches obvious patterns but misses Unicode homoglyphs, encoded payloads, or novel injection techniques                                              | The current approach (zero consistency_score + warning) is good. Add a hard block: if injection detected, reject the directive entirely rather than processing it with zeroed scores |
| No authentication on WebSocket endpoints                                       | The market WebSocket (`/ws/market`) requires no auth. Anyone can connect and receive all market data. Team WebSocket uses `api_key` in the URL path, which is logged in access logs | Add JWT or session-based auth to market WebSocket. Move team API key from URL path to the first message after connection (authentication handshake)                                  |
| `team.api_key` used for both API auth and WebSocket identification             | If the API key leaks (URL logs, browser history), the team's entire session is compromised                                                                                          | Use separate short-lived WebSocket tokens generated at login, not the persistent API key                                                                                             |

## UX Pitfalls

| Pitfall                                             | User Impact                                                                                                                    | Better Approach                                                                                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No optimistic UI on trade execution                 | Team clicks "Buy", waits 1-3s for round-trip, clicks again thinking it failed, gets double order                               | Show immediate "Order Pending" state, disable the button, confirm/reject when server responds                                                                         |
| LLM evaluation latency with no progress indicator   | Team submits directive, sees nothing for 10-30 seconds, wonders if it worked                                                   | Show "Evaluating your directive..." with a spinner. Send WebSocket progress events: SUBMITTED -> PROCESSING -> COMPLETED                                              |
| Crisis event pause with no countdown or explanation | Admin pauses game, teams see "PAUSED" but do not know why, how long, or what they should do                                    | Include a message with the pause event: "Crisis event: [description]. You have [X] minutes to respond."                                                               |
| Eliminated teams get no closure                     | Team is eliminated in a purge, their WebSocket still works, they see data but cannot act. No clear "you are eliminated" screen | Detect elimination via WebSocket event, show a dedicated "Eliminated" overlay with final rank and stats                                                               |
| Purge eliminates bottom half by market cap only     | Teams that made great strategic decisions but had bad trading luck get eliminated. Feels unfair                                | Consider a composite score (market cap + directive quality + cash reserves) or at minimum show teams their rank leading up to a purge so they can trade strategically |

## "Looks Done But Isn't" Checklist

- [ ] **Trading:** Validates ownership cap in application code but has no DB constraint -- verify with concurrent load test (2+ simultaneous orders for same stock)
- [ ] **Game Pause:** Sets `PAUSED` in DB but does not stop Celery periodic tasks -- verify prices stop updating when game is paused
- [ ] **Purge:** Eliminates teams and zeros holdings of eliminated teams, but does not refund the cash that buyers paid for those now-worthless shares -- verify buyers are not silently robbed
- [ ] **WebSocket Auth:** Team WebSocket uses API key in URL path -- verify API keys are not appearing in Caddy access logs or browser history
- [ ] **LLM Fallback:** `_neutral_result()` returns zero financial impact, which is correct, but the directive is marked `COMPLETED` even though it was not really evaluated -- verify admin can distinguish "LLM succeeded" from "LLM failed, neutral fallback used"
- [ ] **Price Seeding:** `start_game` creates 20 fake historical price points with `random.uniform()` -- verify these do not appear as "real" data in analytics or create misleading chart patterns
- [ ] **Cooldown:** `start_directive_cooldown` sets `TeamStatus.COOLDOWN` but nothing checks `cooldown_until` to automatically restore `ACTIVE` status -- verify cooldown actually expires
- [ ] **Cash Ledger:** `apply_financial_impact` records a ledger entry but trading does not -- verify cash ledger is complete for audit

## Recovery Strategies

| Pitfall                                            | Recovery Cost | Recovery Steps                                                                                                                                                     |
| -------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Trading race condition (oversold shares)           | MEDIUM        | Pause game, run audit query for cap violations, manually adjust holdings and refund excess, resume. Add DB constraint to prevent recurrence.                       |
| Celery worker OOM                                  | LOW           | Restart worker container (`docker restart celery_worker`). Fix root cause (engine leak) before next run.                                                           |
| WebSocket storm after reconnection                 | LOW           | Clients will eventually reconnect. Add Redis-cached burst sync to prevent DB overload on mass reconnect.                                                           |
| LLM evaluation applied incorrect scores            | HIGH          | No undo mechanism exists. Must manually reverse financial impact via DB update, recalculate affected prices, notify team. Build admin "revert directive" endpoint. |
| Price double-counting vibe multiplier              | MEDIUM        | Fix the formula, recalculate all current prices in a single sweep, broadcast corrected prices. Historical price data remains wrong -- document the correction.     |
| Game state stuck in PAUSED (admin lost connection) | LOW           | Any admin can call `/game/resume`. Add a secondary admin auth method (e.g., CLI script) as backup.                                                                 |

## Pitfall-to-Phase Mapping

| Pitfall                                           | Prevention Phase             | Verification                                                                         |
| ------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------ |
| Trading race conditions (no row locking)          | Phase 1: Core Infrastructure | Load test: 10 concurrent buy orders for same stock, verify cap never exceeded        |
| Celery asyncio.run() per task                     | Phase 1: Core Infrastructure | Monitor worker memory over 30-minute run, verify stable (no growth)                  |
| WebSocket burst sync N+1 queries                  | Phase 2: Game Engine         | Profile DB queries during 40-client simultaneous connect, verify < 10 queries total  |
| No human-in-the-loop gate                         | Phase 2: Game Engine         | Submit directive, verify it enters PENDING_APPROVAL, verify admin can approve/modify |
| Game pause does not stop Celery tasks             | Phase 2: Game Engine         | Pause game, wait 60s, verify no new PriceHistory rows created during pause           |
| No WebSocket reconnection protocol                | Phase 3: Polish              | Disconnect client, wait 30s, reconnect, verify missed events are replayed            |
| Caddy WebSocket timeout                           | Phase 1: Core Infrastructure | Connect WebSocket, leave idle 5 minutes, verify connection survives                  |
| Price formula double-counting                     | Phase 2: Game Engine         | Unit test: `final = base * vibe * sentiment`, assert no double-application           |
| Cooldown never expires                            | Phase 2: Game Engine         | Submit directive, wait cooldown period, verify team auto-returns to ACTIVE           |
| Purge does not refund buyers of eliminated stocks | Phase 2: Game Engine         | Purge a team, verify holders get cash refund or explicit "shares worthless" event    |

## Sources

- Codebase analysis: `server/app/api/trading.py`, `server/app/websocket.py`, `server/app/worker/tasks/pricing.py`, `server/app/worker/tasks/directive.py`, `server/app/api/game.py`, `server/app/database.py`
- [Preventing Postgres SQL Race Conditions with SELECT FOR UPDATE](https://on-systems.tech/blog/128-preventing-read-committed-sql-concurrency-errors/)
- [The SELECT FOR UPDATE Trap Everyone Falls Into](https://medium.com/fresha-data-engineering/the-select-for-update-trap-everyone-falls-into-8643089f94c7)
- [Fixing Race Conditions in PostgreSQL for Financial Systems](https://thedanieldallas.com/thoughts/postgresql-race-conditions)
- [Celery and asyncio: A Guide to Bridging the Synchronous World](https://blog.vishakhhegde.info/p/celery-and-asyncio-a-guide-to-bridging)
- [The Problems with Python's Celery](https://hatchet.run/blog/problems-with-celery)
- [FastAPI WebSocket Connection Management](https://medium.com/@hexshift/managing-connection-state-across-multiple-websocket-clients-in-fastapi-7be820ff0bfe)
- [WebSocket/SSE Notifications with FastAPI - Connection Management, Rooms, Reconnection](https://blog.greeden.me/en/2025/10/28/weaponizing-real-time-websocket-sse-notifications-with-fastapi-connection-management-rooms-reconnection-scale-out-and-observability/)
- Git commit history analysis (5 WebSocket-related fix commits)

---

_Pitfalls research for: Complex Case Competition Platform_
_Researched: 2026-04-16_
