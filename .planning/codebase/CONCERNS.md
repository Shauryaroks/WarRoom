# Codebase Concerns

**Analysis Date:** 2026-04-17

## Severity Legend
- **HIGH**: Immediate production risk, requires urgent fix
- **MEDIUM**: Will cause issues under load or specific triggers
- **LOW**: Technical debt, should be addressed in future sprints

---

## HIGH Severity

### H-01: No JWT Secret Validation on Startup
**Issue:** The application can start without `JWT_SECRET` configured. `auth_utils.py` raises `ValueError` at runtime when attempting to create/decode tokens.

**Files:** `server/app/auth_utils.py`, `server/app/database.py`

**Impact:** Production deployments could start with empty JWT_SECRET, making all authentication fail at runtime rather than failing safe on startup.

**Fix approach:** Add startup validator in `server/app/main.py` that checks `settings.JWT_SECRET` exists and is >=32 characters before accepting traffic. Consider adding health check endpoint that verifies JWT_SECRET is configured.

---

### H-02: Shared Password for Dual Credentials
**Issue:** Registration creates both strategist and trader sub-accounts with the same password hash (`server/app/api/auth.py` lines 117-118). If one sub-account is compromised, the other is immediately compromised too.

**Files:** `server/app/api/auth.py` (lines 117-118)

**Impact:** Single password breach gives full account access. Violates principle of least privilege for trader/strategist separation.

**Fix approach:** Require separate passwords during registration, or implement account-specific password fields. Update registration UI to accept two passwords.

---

### H-03: Missing Transaction Race Condition Guard on Sell
**Issue:** `execute_sell()` locks the seller's holding and the target team, but does NOT lock other holdings for the target when calculating external cap. Concurrent sells from multiple teams could briefly exceed the 30% cap (though it would be corrected on next buy attempt).

**Files:** `server/app/services/trading_service.py` (lines 207-229)

**Impact:** Under high concurrency, two teams could sell simultaneously, potentially allowing a third buyer to exceed the 30% cap before the check catches it.

**Fix approach:** Lock all target holdings with FOR UPDATE when executing a sell, similar to how buy locks all holdings.

---

## MEDIUM Severity

### M-01: WebSocket In-Memory State Not Distributed
**Issue:** `server/app/websocket.py` uses module-level `ConnectionManager` singleton. Each API worker process has its own independent in-memory connection list. Redis pub/sub handles broadcasts, but per-team messages (`send_to_team`) may not reach all connected clients if they're connected to different workers.

**Files:** `server/app/websocket.py`, `server/app/redis_pubsub.py`

**Impact:** With multiple API workers (expected in production), team-specific notifications may only go to clients connected to the worker that published the message.

**Fix approach:** Either: (1) Use Redis pub/sub for all messages including team-specific, or (2) Implement sticky sessions at load balancer, or (3) Use `broadcaster` library for worker-aware pub/sub.

---

### M-02: Celery Beat Runs Embedded (Single Point of Failure)
**Issue:** `docker-compose.yml` runs `--beat` in the same worker container. If that container restarts, beat could miss a tick or double-schedule.

**Files:** `docker-compose.yml` (line 43)

**Impact:** Price ticks could be missed or duplicated during worker restarts/redeploys. Single container handles both task workers and the scheduler.

**Fix approach:** Consider running beat in a separate container, or implement idempotency checks in `game_tick` task to handle duplicate executions gracefully.

---

### M-03: No Rate Limiting on Trading Endpoints
**Issue:** Trading endpoints (`/api/v1/trading/buy`, `/api/v1/trading/sell`) have no rate limiting. A compromised trader account could spam trades.

**Files:** `server/app/api/trading.py`

**Impact:** DoS via rapid trade execution. Could exhaust database connections or trigger excessive WebSocket broadcasts.

**Fix approach:** Add FastAPI rate limiting (e.g., slowapi) with per-team limits. Consider adding a cooldown between trades.

---

### M-04: LLM Service Timeout May Be Too Long
**Issue:** `llm_service.py` uses 90-second timeout (line 149). OpenRouter free tier models can take very long, blocking the evaluation queue.

**Files:** `server/app/services/llm_service.py` (line 149)

**Impact:** Long-running LLM calls could queue up, causing evaluation delays for other teams. Free tier has rate limits that compound with long wait times.

**Fix approach:** Reduce timeout to 60s, implement retry with exponential backoff, or use dedicated evaluation queue per team.

---

### M-05: No Input Sanitization on Caseline Document
**Issue:** Teams submit `caseline_document` as freeform text (stored in `Team.caseline_document`). No XSS/script injection protection in display.

**Files:** `server/app/models.py` (line 248), client components

**Impact:** Stored XSS if admin views team caseline in admin dashboard without sanitization.

**Fix approach:** Sanitize on display using DOMPurify or similar, or store as JSON with strict schema.

---

## LOW Severity

### L-01: Game State Cache Not Invalidated on API Crash
**Issue:** Redis key `game:status` is set but has no TTL. If API crashes and restarts, stale status could persist indefinitely.

**Files:** `server/app/services/game_service.py` (line 163)

**Impact:** After API crash, `warm_redis_cache()` should restore correct state, but there's a window where Redis could have stale data.

**Fix approach:** Add TTL to Redis keys (e.g., 5 minutes) as safety net. Current implementation is acceptable given `warm_redis_cache()` runs on startup.

---

### L-02: Missing Index on Transaction.executed_at
**Issue:** `compute_sentiment()` queries transactions by `executed_at` range (last 60 seconds). No index exists on this column.

**Files:** `server/app/services/simulation_service.py` (lines 130-138), `server/app/models.py`

**Impact:** As transaction history grows, sentiment calculation becomes slower per tick.

**Fix approach:** Add index on `Transaction.executed_at` if performance degrades.

---

### L-03: Password Validation Too Simple
**Issue:** Registration only requires 8+ character password. No complexity requirements (numbers, special chars, case).

**Files:** `server/app/api/auth.py` (lines 43-48)

**Impact:** Weak passwords more susceptible to brute force.

**Fix approach:** Add complexity requirements, or implement 2FA.

---

### L-04: No Structured Logging
**Issue:** Uses Python standard logging inconsistently. Some places use `logger.info()`, others print to stdout.

**Files:** Multiple files

**Impact:** Difficult to aggregate logs in production. No correlation IDs for tracing requests.

**Fix approach:** Implement structured logging with correlation IDs (e.g., structlog).

---

### L-05: Error Responses May Leak Information
**Issue:** Some error handlers return raw exception messages to clients (e.g., `detail=str(e)`).

**Files:** `server/app/api/trading.py` (lines 105, 188, 260, 273)

**Impact:** Internal implementation details leaked in error responses.

**Fix approach:** Map exceptions to user-friendly messages. Don't propagate raw error details.

---

### L-06: Database Connection Pool Too Small for Load
**Issue:** `pool_size=20` in `database.py`. With 80 concurrent WebSocket connections + API calls + background tasks, pool may exhaust under load.

**Files:** `server/app/database.py` (line 33)

**Impact:** Under load spikes (e.g., after game pause), requests fail with connection errors.

**Fix approach:** Increase `pool_size` to 50+, monitor with Prometheus/Grafana.

---

## Known Issues (Pre-Existing)

### K-01: No Test Coverage on Critical Paths
**Issue:** Limited test files found in `server/tests/`. Critical services (trading, simulation) have minimal test coverage.

**Impact:** regressions in core mechanics won't be caught.

**Fix approach:** Add integration tests for trading atomicity, simulation price calculations.

---

### K-02: No Health Check for Redis Connection
**Issue:** API health check (`/health`) doesn't verify Redis connectivity. Redis could be down but API reports healthy.

**Files:** `server/app/main.py`

**Impact:** API reports healthy but real-time features (price ticks, WebSocket broadcasts) fail silently.

**Fix approach:** Add Redis ping to health endpoint.

---

### K-03: Caddy Config Not Version Controlled
**Issue:** `Caddyfile` exists but not checked in. Docker compose mounts it from filesystem.

**Files:** `Caddyfile` (referenced in docker-compose.yml line 67)

**Impact:** Can't track Caddy config history. Difficult to reproduce deployments.

**Fix approach:** Add Caddyfile to repository.

---

## Security Considerations

### S-01: JWT Algorithm Not Restricted
**Issue:** Uses `settings.JWT_ALGORITHM` (defaults to HS256). If secret is compromised, attacker could craft tokens with less secure algorithms.

**Files:** `server/app/auth_utils.py` (line 33)

**Fix approach:** Hardcode algorithm as HS256, don't allow configuration.

### S-02: No HTTPS Enforcement in Development
**Issue:** Caddy auto-configures HTTPS but development runs on HTTP. No HSTS headers.

**Files:** `Caddyfile` configuration

**Fix approach:** Ensure production Caddyfile has `strict` mode enabled.

---

## Performance Bottlenecks

### P-01: Simulation Tick Calculates All Teams Sequentially
**Issue:** `calculate_all_prices()` loops through all ACTIVE teams sequentially. Each iteration has awaited calls for sentiment and shock.

**Files:** `server/app/services/simulation_service.py` (lines 195-264)

**Impact:** With 40 teams, tick takes longer than necessary. Could miss the 60-second window.

**Fix approach:** Batch queries, use asyncio.gather for independent operations.

### P-02: Portfolio Query N+1 Problem
**Issue:** `get_portfolio()` uses joinedload but iterates over holdings individually for calculations.

**Files:** `server/app/services/trading_service.py` (lines 311-352)

**Impact:** Acceptable for single portfolio query, but problematic under concurrent access.

**Fix approach:** Current implementation acceptable given small dataset.

---

*Concerns audit: 2026-04-17*