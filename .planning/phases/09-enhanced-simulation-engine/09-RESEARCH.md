# Phase 9: Enhanced Simulation Engine - Research

**Researched:** 2026-04-17
**Domain:** Backend — Async SQLAlchemy + Celery price tick rewrite, LLM fundamental evaluation pipeline, Alembic migration, WebSocket event extension, minor frontend surface
**Confidence:** HIGH (codebase-verified); MEDIUM for LLM schema shape (context-specific)

## Summary

Phase 9 is a backend-heavy rewrite of the per-tick stock price engine. It replaces the v1 `interpolate_price(target_price, ticks_to_target)` linear walk with a deterministic per-tick formula driven by four weighted archetype-relative z-scores, event shocks, last-tick sentiment, and bounded Gaussian noise. The LLM no longer outputs `target_price` — instead it proposes quarter-end fundamental deltas that mirror the existing Phase 5 `Evaluation` PENDING_APPROVAL → admin-edit → APPROVED pipeline 1:1, using a new `FundamentalEvaluation` table.

The codebase is exceptionally well-positioned for this phase: the Celery beat → game-state-guarded → `calculate_all_prices` → `db.commit()` → `publish_broadcast_sync("price_update")` pipeline in `server/app/worker/tasks/game_tick.py` is stable and doesn't need restructuring — only the `calculate_all_prices` body (currently in `simulation_service.py`) gets rewritten. `llm_service.call_openrouter(json_schema=...)` already accepts custom schemas and is used by both `evaluate_solution` and `generate_news` tasks, so plumbing a `FUNDAMENTAL_SCHEMA` is mechanical. The Phase 8 `set_game_phase("war_room"|"live_floor")` transition in `game_service.py` is the exact hook point for firing `compute_fundamentals.delay(round_number)` on Live Floor → War Room.

**Primary recommendation:** Structure the phase around four backend task clusters (migration + model, per-tick formula rewrite, fundamental evaluation Celery pipeline mirroring Phase 5, shock enqueue/consume) plus two thin frontend surfaces (Caseline fundamentals strip with z-score coloring; admin Fundamentals tab that copies `evaluations/page.tsx` structure). Nearly every pattern required by this phase already exists in the repo — the planner should explicitly call out "mirror existing file X" in each task.

## User Constraints (from CONTEXT.md)

### Locked Decisions

All 32 decisions (D-01 through D-32) in `09-CONTEXT.md` are locked. Research does NOT explore alternatives; it documents how to implement them. Key anchors the planner must honor verbatim:

- **D-01/D-02:** Hybrid LLM + admin approval. Pattern mirrors Phase 5 `evaluation_service.py` 1:1. Staging table = `FundamentalEvaluation` with PENDING_APPROVAL status.
- **D-03/D-04:** Starting fundamentals = archetype band midpoint. New Team columns: `fundamental_market_share`, `fundamental_margin`, `fundamental_growth`, `fundamental_ops_efficiency` (Decimal(10,4), nullable). Populated at archetype assignment time.
- **D-05/D-06:** Per-tick rewrite is a full replacement. Drop `Team.target_price`, `Team.ticks_to_target`, delete `interpolate_price()`. Formula: `new_price = prev * (1 + drift_now + sentiment + shock + noise)`.
- **D-07:** z-score = signed distance from band midpoint. 0 at midpoint, ±1 at band edges, linear extrapolation, clamped ±2.
- **D-10/D-11:** Benchmark DB keys stay `market_share/margin/growth/ops_efficiency`. UI relabels `margin`→"Profitability", `growth`→"Brand Health". Weights 35/30/20/15 map to MS/margin/ops_efficiency/growth.
- **D-13/D-14:** Sentiment = signed INR trade volume in last 60s / team market_cap × 0.02, clamped ±0.3%/tick. No rolling window.
- **D-16/D-17/D-18/D-19:** Shocks from admin crisis + LLM-tagged news (`is_event`, `severity`, `direction`). Single-tick jumps. New `PendingShock` table, FIFO per team per tick.
- **D-20/D-21:** 5-tick linear ramp. `ramp_fraction = min(1.0, ticks_since_ramp_start / 5)`. New approval mid-ramp: reset `ramp_started_at`, re-snapshot target, current drift becomes new floor.
- **D-22/D-23/D-24:** LLM fan-out on War Room entry via Celery. Per-tick: one batched SELECT for ACTIVE teams, pure Python compute, `db.add_all` batch insert. Target <50ms for 40 teams.
- **D-25/D-26:** Six new admin endpoints + new "Fundamentals" tab (between Evaluations and Markets in sidebar).
- **D-27:** Weights hardcoded as Python constants in `simulation_service.py`. No Settings UI.
- **D-28:** `set_team_score()` deprecated with 410 Gone. Phase 5 `Evaluation` stays but quality_score no longer sets target_price.
- **D-29:** `price_tick` Celery task keeps scheduling + broadcast wiring. Only the compute body changes.
- **D-30/D-31/D-32:** Schema delta (new columns, dropped columns, two new tables) fully specified in CONTEXT.md §D-30/31/32.

### Claude's Discretion

- Exact noise distribution/bounds (D-06 coefficient `0.15` tunable if tests show drift too hot/tame).
- `SELECT FOR UPDATE` vs optimistic locking for fundamentals update.
- Cache archetype.benchmark_bands in Redis vs per-tick read (40-row read is cheap).
- z-score clamp values (±2) — adjust if tests show overflow.

### Deferred Ideas (OUT OF SCOPE)

- Admin-configurable weights (Phase 11+ Settings UI).
- True Brand Health / NPS signal (Phase 11 dashboard).
- Rolling-window sentiment + time decay (revisit if competition feedback flags jitter).
- Short-selling impact on sentiment beyond signed SELL volume (Phase 10 adds shorts).
- M&A / distress triggers (Phase 12).

## Phase Requirements

| ID      | Description                                                                                       | Research Support                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| SIM-05  | Price formula uses 4 weighted fundamentals (MS 35%, Profitability 30%, Ops 20%, Brand Health 15%) | D-06/D-10/D-11 alias-relabel; implementation in Architecture Pattern 2                                |
| SIM-06  | Each fundamental scored relative to archetype benchmark band (not absolute)                       | D-07 z-score formula; `_validate_benchmark_bands` at admin.py:1427 already validates the bands shape  |
| SIM-07  | Event shocks ±3% to ±15% discrete price jumps                                                     | D-16/D-17/D-18/D-19 — new `PendingShock` table, admin crisis + `is_event` news                        |
| SIM-08  | Sentiment flow from net trading pressure                                                          | D-13/D-14 — last-60s signed INR volume / market_cap × 0.02, clamped ±0.3%                             |
| SIM-09  | Decision impact phases in over 3-5 minutes (smoothing)                                            | D-20/D-21 — 5-tick linear ramp, `ramp_started_at` + `drift_target_pct` Team columns                   |
| ARCH-03 | Archetype-relative scoring: team's z-score against archetype's fair-expectations band             | D-07 implementation; Phase 7 `benchmark_bands` JSON is already stored on `archetypes.benchmark_bands` |

## Project Constraints (from CLAUDE.md)

- **GSD workflow enforcement:** All file edits must go through `/gsd-execute-phase`, `/gsd-quick`, or `/gsd-debug`. Plans should not instruct direct edits outside GSD.
- **Async SQLAlchemy only:** Never block the event loop. Tick loop must use AsyncSession. Verified — existing code honors this (`worker/tasks/game_tick.py` uses `get_worker_session`).
- **Decimal arithmetic for money/price:** Prices are `Numeric(10,2)`, cash is `Numeric(15,2)`. Use `Decimal` end-to-end; floats only for internal noise/ratio math (current `interpolate_price` follows this).
- **broadcaster lib recommendation:** CLAUDE.md recommends `broadcaster`; codebase currently rolls its own via `redis.asyncio` pub/sub in `app/redis_pubsub.py`. Don't migrate in Phase 9 — out of scope.
- **PyJWT (not python-jose), redis.asyncio (not aioredis), SQLAlchemy async (not sync):** All already adhered to. No drift risk.
- **Bloomberg terminal aesthetic + "Complex Terminal Blue":** Primary `#2196F3`, accent `#9ecaff`, backgrounds `#131313/#1c1b1b/#201f1f`, 0px border-radius, `font-mono`, UPPERCASE labels. The caseline panel and evaluations page already demonstrate the pattern — new UI must match exactly.

## Architectural Responsibility Map

| Capability                                                                 | Primary Tier                            | Secondary Tier                              | Rationale                                                                                                             |
| -------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Price compute per tick                                                     | Celery worker (sync entry / async body) | —                                           | Tick is triggered by Celery Beat; must not block FastAPI event loop                                                   |
| Batched DB read for ACTIVE teams per tick                                  | PostgreSQL (async SQLAlchemy)           | —                                           | Single `SELECT ... WHERE status=ACTIVE` with eager-loaded archetype                                                   |
| Sentiment aggregate query                                                  | PostgreSQL                              | —                                           | `SELECT SUM(CASE WHEN tx_type=BUY THEN total_value ELSE -total_value END) ... WHERE executed_at > now()-60s` per team |
| Archetype benchmark bands (read)                                           | PostgreSQL                              | Redis cache (optional)                      | Bands are immutable during a game; cache once per tick or on archetype change                                         |
| LLM fundamental eval call                                                  | Celery worker (one subtask per team)    | OpenRouter API                              | Fan-out at War Room entry; `httpx.AsyncClient(timeout=90.0)` already in `llm_service.call_openrouter`                 |
| FundamentalEvaluation lifecycle (PENDING_APPROVAL → APPROVED)              | PostgreSQL + FastAPI admin API          | —                                           | Mirrors Phase 5 Evaluation — same DB state machine                                                                    |
| Admin Fundamentals Queue UI                                                | Next.js client (admin)                  | —                                           | Mirrors `/admin/evaluations/page.tsx` pattern                                                                         |
| Caseline fundamentals strip (z-score display)                              | Next.js client (game view, Strategist)  | REST `/api/v1/teams/:id/fundamentals` (new) | Strategist-only read endpoint; caseline panel extends                                                                 |
| Shock enqueue (admin crisis)                                               | FastAPI admin API                       | Celery tick consumer                        | Crisis endpoint writes `PendingShock` row + broadcasts                                                                |
| Shock enqueue (LLM news)                                                   | Celery news task                        | —                                           | `generate_news` extended to write `PendingShock` when `is_event=true`                                                 |
| WebSocket events (`price_update`, `shock_applied`, `fundamentals_updated`) | Redis pub/sub                           | Next.js WebSocket hook                      | Broadcast AFTER `db.commit()` (existing pattern in tick, evaluation, news tasks)                                      |
| Alembic migration (005)                                                    | Alembic                                 | —                                           | Standard pattern; enum types, JSON Text columns, nullable columns for safe rollback                                   |

## Standard Stack

### Core (already in use — do NOT re-add)

| Library                 | Version              | Purpose                                                       | Why Standard                                                                                   |
| ----------------------- | -------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| FastAPI                 | >=0.135.3            | Admin API endpoints                                           | Already in use; native async; Pydantic 2 response models                                       |
| SQLAlchemy              | >=2.0.49 async       | ORM for new Team columns, FundamentalEvaluation, PendingShock | `AsyncSession` + `asyncpg` — required by CLAUDE.md; existing tick loop uses it                 |
| asyncpg                 | >=0.29.0             | PostgreSQL async driver                                       | Already in use                                                                                 |
| Alembic                 | >=1.18.4             | Schema migration (new `005_fundamentals` revision)            | Existing patterns in `versions/003_add_archetype.py`, `004_decision_levers_round_structure.py` |
| Celery                  | >=5.6.3              | Fan-out `compute_fundamentals` subtasks                       | Existing tasks at `server/app/worker/tasks/*.py`; Beat already scheduled for `game.tick`       |
| Redis                   | 7 / redis-py >=7.1.1 | pub/sub for new WS event types                                | Existing `app/redis_pubsub.py` patterns                                                        |
| httpx                   | >=0.27.0             | OpenRouter API client                                         | Already wrapped in `call_openrouter`                                                           |
| Pydantic                | >=2.9.0              | Request/response schemas for new endpoints                    | Existing style in `admin.py` and `schemas/decisions.py`                                        |
| pytest + pytest-asyncio | >=8.0.0 / >=0.23.0   | Unit + integration tests                                      | `asyncio_mode = "auto"` in `pyproject.toml`; existing fixtures in `tests/conftest.py`          |

### Frontend (already in use)

| Library            | Version | Purpose                                                                                         | Why Standard                                                                  |
| ------------------ | ------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Next.js            | 16.2.3  | Admin page at `/admin/fundamentals` (new route)                                                 | Existing `/admin/evaluations/page.tsx` is the template                        |
| Zustand            | 5.0.12  | Could extend `market-store.ts` for shock events — NOT required if state lives in component      | Existing `handlePriceUpdate` already consumes tick messages                   |
| Zod                | 4.3.6   | Validate WS message shapes — optional but useful for `shock_applied` and `fundamentals_updated` | Already in project; not currently validating WS on client                     |
| lightweight-charts | 5.1.0   | Existing candle chart surfaces shocks naturally as visible jumps                                | No changes needed — shocks produce single-tick price deltas the chart renders |

### New Libraries

None. All functionality can be built on existing dependencies.

### Alternatives Considered

| Instead of                     | Could Use                                                                      | Tradeoff                                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| New `PendingShock` table       | JSON column on `teams` (queued_shocks)                                         | Table is cleaner for audit trail + source_ref_id FK; CONTEXT.md D-19 locks the table                                                              |
| Fan-out via Celery `group()`   | Plain loop enqueueing individual `compute_fundamentals_for_team.delay()` calls | `group()` gives result aggregation, but we don't need it — admin approves each independently. Plain loop is simpler and matches existing pattern. |
| Per-tick SELECT per team       | Single batched SELECT with eager-loaded archetype                              | Batched is strictly faster; existing `calculate_all_prices` already does this                                                                     |
| Custom JSON schema enforcement | Pydantic validation of LLM output after parse                                  | JSON schema on OpenRouter side enforces strictness; Pydantic re-validates. Use both (existing pattern in `generate_news.py`)                      |

**Installation:** No `pip install` needed. All dependencies present in `server/pyproject.toml`.

**Version verification (performed 2026-04-17):** All pinned versions align with CLAUDE.md-declared stack. No upgrades required for this phase. `[VERIFIED: server/pyproject.toml L7-L21]`

## Architecture Patterns

### System Architecture Diagram — Per-Tick Price Flow (v2)

```
                              Celery Beat (60s schedule)
                                         │
                                         ▼
                                   game.tick task
                                         │
                           (is_game_active? + phase != war_room)
                                         │
                                         ▼
                           async _execute_tick() [rewritten]
                                         │
                        ┌────────────────┼────────────────┐
                        ▼                ▼                ▼
            SELECT teams WHERE   SELECT sentiment    SELECT pending
            status=ACTIVE +      per team (last 60s  shocks (one per
            archetype eager      signed INR volume)  team, FIFO)
            loaded (1 query)     GROUP BY team_id
                        │                │                │
                        └────────────────┼────────────────┘
                                         ▼
                         Python-only per-team compute:
                         drift_target = clamp(0.15 * Σ w_i * z_i, ±5%)
                         drift_now    = ramp_fraction * drift_target
                         new_price    = prev * (1 + drift_now +
                                              sentiment + shock + noise)
                                         │
                                         ▼
                         db.add_all([PriceHistory × N teams])
                         UPDATE teams SET stock_price = new_price
                         DELETE consumed pending_shocks
                                         │
                                         ▼
                               await db.commit()
                                         │
                                         ▼
                         publish_broadcast_sync("price_update"…)
                         publish_broadcast_sync("shock_applied"…) if any shock fired
                                         │
                                         ▼
                         Redis pub/sub → FastAPI relay → WebSocket clients
                         (React market-store.handlePriceUpdate)
```

### System Architecture Diagram — Quarter Boundary LLM Fan-Out

```
Admin clicks "Enter War Room"
            │
            ▼
POST /api/v1/admin/game/war-room (admin.py:710)
            │
            ▼
set_game_phase(db, "war_room", macro_brief=…)  [Phase 8 — EXTEND]
            │
            ├─► Celery dispatch (NEW): for each ACTIVE team:
            │       compute_fundamentals_for_team.delay(round_number, team_id)
            │
            ▼
compute_fundamentals_for_team task (NEW, in worker/tasks/)
            │
            ▼
Load context: Team, Archetype.benchmark_bands, latest Decision rows (all 4 levers
for this round), latest OperatingPlan, last FundamentalEvaluation (narrative carryover),
team fundamentals now
            │
            ▼
call_openrouter(messages, json_schema=FUNDAMENTAL_DELTA_SCHEMA)
            │
            ▼
save_fundamental_evaluation(db, team_id, round_number, proposed_deltas, narrative)
→ INSERT fundamental_evaluations (status=PENDING_APPROVAL)
            │
            ▼
db.commit() → publish_broadcast_sync("fundamental_evaluation_pending", {team_id, eval_id})
            │
            ▼
Admin reviews in /admin/fundamentals (NEW — mirrors /admin/evaluations)
            │
            ├─► PUT  /api/v1/admin/fundamentals-queue/:id   (edit proposed_deltas)
            ├─► POST /api/v1/admin/fundamentals-queue/:id/approve
            │       └─► apply_fundamental_deltas(db, eval_id)
            │           │
            │           ▼
            │   UPDATE teams SET fundamental_* = prev + delta,
            │                     ramp_started_at = now(),
            │                     drift_target_pct = recompute(weighted_z)
            │           → publish_broadcast("fundamentals_updated", {team_id, z_scores})
            │
            └─► POST /api/v1/admin/fundamentals-queue/:id/reject
                    └─► mark REJECTED, no deltas applied
```

### Recommended Project Structure

```
server/app/
├── services/
│   ├── simulation_service.py         # REWRITE: compute_price, weighted_z_score, calculate_all_prices
│   ├── fundamental_service.py        # NEW: build_fundamental_prompt, save_fundamental_evaluation,
│   │                                 #      apply_fundamental_deltas, reject_fundamental_evaluation,
│   │                                 #      override_fundamentals
│   ├── evaluation_service.py         # TOUCH: approve_evaluation — remove target_price/ticks_to_target writes
│   ├── game_service.py               # TOUCH: set_game_phase — enqueue compute_fundamentals on war_room entry
│   └── llm_service.py                # NO CHANGE (accepts json_schema already)
├── worker/tasks/
│   ├── game_tick.py                  # NO CHANGE (only calls calculate_all_prices, body changes elsewhere)
│   ├── compute_fundamentals.py       # NEW: fan-out + per-team compute_fundamentals_for_team
│   ├── generate_news.py              # TOUCH: extend NEWS_SCHEMA with is_event/severity/direction;
│   │                                 #        write PendingShock on is_event=true
│   └── evaluate_solution.py          # NO CHANGE (Phase 5 evaluation continues unchanged)
├── models.py                         # TOUCH: add FundamentalEvaluation, PendingShock, enums;
│                                     # add columns to Team; drop target_price/ticks_to_target
├── api/
│   ├── admin.py                      # EXTEND: 6 new endpoints (D-25); 410 Gone on set_team_score
│   └── teams.py                      # EXTEND: GET /api/v1/teams/me/fundamentals (Strategist read)
├── schemas/
│   └── fundamentals.py               # NEW: Pydantic request/response models
└── redis_pubsub.py                   # NO CHANGE (reuse publish_broadcast_sync)

server/alembic/versions/
└── 005_fundamentals_and_shocks.py    # NEW migration: add columns, add tables, drop columns, add enums

server/tests/
├── test_simulation.py                # REWRITE: replace interpolate_price tests; add z_score, compute_price, sentiment, shock, ramp tests
├── test_fundamental_service.py       # NEW: build_fundamental_prompt, apply_fundamental_deltas, ramp reset
├── test_admin_fundamentals.py        # NEW: queue endpoints, approval flow
└── test_shock_enqueue.py             # NEW: crisis → PendingShock, news is_event → PendingShock

client/src/
├── app/admin/
│   ├── fundamentals/
│   │   └── page.tsx                  # NEW — clone of admin/evaluations/page.tsx
│   └── page.tsx                      # TOUCH: add override-fundamentals modal (optional)
├── components/admin/
│   └── admin-sidebar.tsx             # TOUCH: add "FUNDAMENTALS" nav item between EVALS and MARKETS
├── components/game/
│   └── CaselinePanel.tsx             # TOUCH: add fundamentals strip (MS/Prof/Ops/Brand) with z-score coloring
├── lib/
│   └── types.ts                      # ADD: FundamentalEvaluation, PendingShockEvent, ShockAppliedPayload,
│                                     #      FundamentalsUpdatedPayload, TeamFundamentalsResponse types
└── stores/
    └── market-store.ts               # OPTIONAL extension for shock_applied handler (can live in component state)
```

### Pattern 1: Phase 5 Evaluation → FundamentalEvaluation 1:1 Mirror

The single most important pattern: `FundamentalEvaluation` is a parallel lifecycle to `Evaluation`. Every function, endpoint, UI behavior has a direct analog. `[VERIFIED: server/app/services/evaluation_service.py, server/app/api/admin.py:948-1148, client/src/app/admin/evaluations/page.tsx]`

| Phase 5 Evaluation                                                                                                                                                                          | Phase 9 FundamentalEvaluation                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Evaluation` model with `EvaluationStatus` enum (PROCESSING/PENDING_APPROVAL/APPROVED/REJECTED/FAILED)                                                                                      | `FundamentalEvaluation` model with new `FundamentalEvalStatus` enum (same values, separate enum)                                                                                            |
| `evaluation_service.build_prompt(db, solution_id)` returns messages list                                                                                                                    | `fundamental_service.build_fundamental_prompt(db, team_id, round_number)` returns messages list                                                                                             |
| `evaluate_solution` Celery task: `asyncio.run(_evaluate(solution_id))` with 120s time_limit                                                                                                 | `compute_fundamentals_for_team` Celery task: `asyncio.run(_compute(team_id, round_number))` with 120s time_limit                                                                            |
| Task calls `call_openrouter(messages, json_schema=None)` (default EVALUATION_SCHEMA)                                                                                                        | Task calls `call_openrouter(messages, json_schema=FUNDAMENTAL_DELTA_SCHEMA)`                                                                                                                |
| On success: `save_evaluation` writes PENDING_APPROVAL, commit, then `publish_broadcast_sync("evaluation_pending")`                                                                          | On success: `save_fundamental_evaluation`, commit, then `publish_broadcast_sync("fundamental_evaluation_pending")`                                                                          |
| On failure: create FAILED Evaluation, publish `evaluation_failed` to team, raise for retry                                                                                                  | On failure: create FAILED FundamentalEvaluation, publish to team, raise for retry                                                                                                           |
| `GET /api/v1/admin/evaluations` with `status` filter                                                                                                                                        | `GET /api/v1/admin/fundamentals-queue` with `status` filter                                                                                                                                 |
| `PUT /api/v1/admin/evaluations/:id` edits before approval (409 if not PENDING_APPROVAL)                                                                                                     | `PATCH /api/v1/admin/fundamentals-queue/:id` edits `proposed_deltas`/`admin_edits`                                                                                                          |
| `POST /api/v1/admin/evaluations/:id/approve` → `approve_evaluation` writes target_price, publishes news, dispatches `generate_news`                                                         | `POST /api/v1/admin/fundamentals-queue/:id/approve` → `apply_fundamental_deltas` updates Team fundamentals + sets `ramp_started_at` + `drift_target_pct`, broadcasts `fundamentals_updated` |
| `POST /api/v1/admin/evaluations/:id/reject` with optional `admin_notes`                                                                                                                     | `POST /api/v1/admin/fundamentals-queue/:id/reject` with optional `admin_notes`                                                                                                              |
| `_approve_evaluation` raises `ValueError` if status != PENDING_APPROVAL; endpoint converts to 409                                                                                           | Same — mirror the ValueError → 409 mapping                                                                                                                                                  |
| Admin page `/admin/evaluations/page.tsx`: filter bar, card list, expandable edit, APPROVE/REJECT buttons, toast notifications, `useWebSocket` hook for auto-refresh on `evaluation_pending` | `/admin/fundamentals/page.tsx`: same structure, listens for `fundamental_evaluation_pending`                                                                                                |

**Example — mirroring `approve_evaluation` in `fundamental_service.apply_fundamental_deltas`:**

```python
# Source: mirrors server/app/services/evaluation_service.py:214-282 (VERIFIED)
async def apply_fundamental_deltas(
    db: AsyncSession, evaluation_id: uuid.UUID
) -> dict:
    """Approve a fundamental evaluation: apply deltas, reset ramp, broadcast."""
    result = await db.execute(
        select(FundamentalEvaluation).where(FundamentalEvaluation.id == evaluation_id)
    )
    evaluation = result.scalar_one_or_none()
    if evaluation is None:
        raise ValueError(f"FundamentalEvaluation {evaluation_id} not found")
    if evaluation.status != FundamentalEvalStatus.PENDING_APPROVAL:
        raise ValueError(
            f"FundamentalEvaluation {evaluation_id} is {evaluation.status.value}, "
            f"expected PENDING_APPROVAL"
        )

    team_result = await db.execute(select(Team).where(Team.id == evaluation.team_id))
    team = team_result.scalar_one()

    # Prefer admin_edits if present, else proposed_deltas
    deltas = json.loads(evaluation.admin_edits or evaluation.proposed_deltas)

    # Apply deltas with null-safe midpoint fallback (per D-03)
    team.fundamental_market_share = (team.fundamental_market_share or _midpoint(team, "market_share")) + Decimal(str(deltas["market_share_delta"]))
    team.fundamental_margin        = (team.fundamental_margin or _midpoint(team, "margin")) + Decimal(str(deltas["margin_delta"]))
    team.fundamental_growth        = (team.fundamental_growth or _midpoint(team, "growth")) + Decimal(str(deltas["growth_delta"]))
    team.fundamental_ops_efficiency = (team.fundamental_ops_efficiency or _midpoint(team, "ops_efficiency")) + Decimal(str(deltas["ops_efficiency_delta"]))

    # Per D-21: reset ramp; drift_target snapshotted from fresh fundamentals
    # Existing drift_now becomes the new ramp floor (handled in compute_price)
    team.drift_target_pct = compute_drift_target(team)  # in simulation_service
    team.ramp_started_at  = datetime.now(timezone.utc)

    evaluation.status = FundamentalEvalStatus.APPROVED
    evaluation.approved_at = datetime.now(timezone.utc)
    # approved_by_admin_id set by caller using the require_admin dict

    return {
        "team_id": str(team.id),
        "ticker": team.ticker,
        "new_drift_target_pct": str(team.drift_target_pct),
    }
```

### Pattern 2: Per-Tick Compute — Pure-Python Hot Path

```python
# Source: replaces server/app/services/simulation_service.py calculate_all_prices (VERIFIED existing pattern)
# Dependencies: asyncio, Decimal, random.gauss
WEIGHTS = {
    "market_share":  Decimal("0.35"),
    "margin":        Decimal("0.30"),
    "ops_efficiency": Decimal("0.20"),
    "growth":        Decimal("0.15"),
}
DRIFT_COEF   = Decimal("0.15")   # D-06 tunable
DRIFT_CAP    = Decimal("0.05")   # ±5%/tick
NOISE_SIGMA  = 0.02              # float for random.gauss
NOISE_BOUND  = Decimal("0.04")   # ±4%
SENTIMENT_COEF  = Decimal("0.02")
SENTIMENT_CAP   = Decimal("0.003")  # ±0.3%/tick
RAMP_TICKS   = 5
Z_CLAMP      = Decimal("2")

def z_score(value: Decimal, band_min: Decimal, band_max: Decimal) -> Decimal:
    """Signed distance from band midpoint. 0 at midpoint, ±1 at edges, clamped ±2."""
    midpoint = (band_min + band_max) / Decimal("2")
    half_width = (band_max - band_min) / Decimal("2")
    if half_width == 0:
        return Decimal("0")
    z = (value - midpoint) / half_width
    return max(-Z_CLAMP, min(Z_CLAMP, z))

def compute_drift_target(team: Team, bands: dict) -> Decimal:
    weighted_z = (
        WEIGHTS["market_share"]   * z_score(team.fundamental_market_share, *bands["market_share"])
        + WEIGHTS["margin"]        * z_score(team.fundamental_margin,        *bands["margin"])
        + WEIGHTS["ops_efficiency"] * z_score(team.fundamental_ops_efficiency, *bands["ops_efficiency"])
        + WEIGHTS["growth"]        * z_score(team.fundamental_growth,        *bands["growth"])
    )
    drift = DRIFT_COEF * weighted_z
    return max(-DRIFT_CAP, min(DRIFT_CAP, drift))

def compute_price(team: Team, bands: dict, sentiment: Decimal, shock: Decimal, now: datetime) -> Decimal:
    if team.ramp_started_at is None or team.drift_target_pct is None:
        drift_now = Decimal("0")
    else:
        ticks_since = int((now - team.ramp_started_at).total_seconds() // 60)
        ramp_fraction = min(Decimal("1.0"), Decimal(ticks_since) / Decimal(RAMP_TICKS))
        drift_now = ramp_fraction * team.drift_target_pct

    noise_raw = Decimal(str(random.gauss(0, NOISE_SIGMA)))
    noise = max(-NOISE_BOUND, min(NOISE_BOUND, noise_raw))

    multiplier = Decimal("1") + drift_now + sentiment + shock + noise
    new_price = team.stock_price * multiplier
    return max(Decimal("0.01"), new_price.quantize(Decimal("0.01")))
```

### Pattern 3: Batched Per-Tick SELECT with Eager Archetype

```python
# Source: extends existing calculate_all_prices pattern at simulation_service.py:126 (VERIFIED)
from sqlalchemy import select, func, case
from sqlalchemy.orm import selectinload

result = await db.execute(
    select(Team)
    .options(selectinload(Team.archetype))         # avoid N+1 on bands
    .where(Team.status == TeamStatus.ACTIVE)
)
teams = result.scalars().all()
```

### Pattern 4: Last-60s Signed INR Volume Aggregate

```python
# Source: new SQL for this phase. Uses Transaction model at models.py:451-487 (VERIFIED)
# Transaction uses: transaction_type (enum), shares (int), price_per_share (Decimal),
# target_team_id (UUID), executed_at (DateTime tz). No "quantity" column — it's "shares".
from datetime import timedelta
from sqlalchemy import select, func, case

cutoff = datetime.now(timezone.utc) - timedelta(seconds=60)
signed_value = case(
    (Transaction.transaction_type == TransactionType.BUY,
     Transaction.shares * Transaction.price_per_share),
    (Transaction.transaction_type == TransactionType.SELL,
     -(Transaction.shares * Transaction.price_per_share)),
    else_=0,
)
stmt = (
    select(Transaction.target_team_id, func.coalesce(func.sum(signed_value), 0).label("net_inr"))
    .where(Transaction.executed_at >= cutoff)
    .where(Transaction.transaction_type.in_([TransactionType.BUY, TransactionType.SELL]))
    .group_by(Transaction.target_team_id)
)
rows = await db.execute(stmt)
sentiment_by_team = {row.target_team_id: Decimal(str(row.net_inr)) for row in rows}

# Per-team: sentiment_raw = net_inr / market_cap; then clamp(sentiment_raw * 0.02, ±0.003)
```

**Important:** Existing TransactionType includes `TREASURY_SALE` and `BANKRUPTCY_LIQUIDATION` — the `.in_([BUY, SELL])` filter excludes those from sentiment, matching D-13 intent.

### Pattern 5: Shock Consumption — FIFO Per Tick

```python
# Source: new pattern for this phase
from sqlalchemy import select, delete

# One shock per team per tick (D-19 FIFO)
stmt = (
    select(PendingShock)
    .where(PendingShock.applied_at.is_(None))
    .order_by(PendingShock.team_id, PendingShock.enqueued_at)
    .distinct(PendingShock.team_id)  # Postgres DISTINCT ON
)
# Note: SQLAlchemy Core distinct on specific columns — use .distinct(PendingShock.team_id)
# Alternative with window function if distinct-on is flaky with asyncpg:
#   use ROW_NUMBER() OVER (PARTITION BY team_id ORDER BY enqueued_at) = 1
shocks = (await db.execute(stmt)).scalars().all()

shock_by_team: dict[uuid.UUID, Decimal] = {}
applied_ids: list[uuid.UUID] = []
for s in shocks:
    shock_by_team[s.team_id] = s.magnitude_pct / Decimal("100")  # Stored as "8" for 8%, converted to 0.08
    applied_ids.append(s.id)

# Mark consumed AFTER compute succeeds, within same tx
if applied_ids:
    await db.execute(
        # UPDATE pending_shocks SET applied_at = now() WHERE id IN (...)
        # (Retain for audit trail rather than delete; D-19 notes applied_at nullable)
        sa.update(PendingShock).where(PendingShock.id.in_(applied_ids)).values(applied_at=now)
    )
```

Postgres-specific trick: `DISTINCT ON (team_id)` is the idiomatic "first row per group" query on PostgreSQL and is supported by asyncpg. `[CITED: https://www.postgresql.org/docs/15/sql-select.html#SQL-DISTINCT]` Fallback to window function if tests reveal issues.

### Pattern 6: Alembic Migration (005_fundamentals_and_shocks)

```python
# Source: follows server/alembic/versions/003_add_archetype.py + 004_decision_levers_round_structure.py (VERIFIED)
"""Add fundamentals, FundamentalEvaluation, PendingShock; drop target_price/ticks_to_target

Revision ID: 005_fundamentals
Revises: 004_decision_levers
Create Date: 2026-04-XX
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "005_fundamentals"
down_revision = "004_decision_levers"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # --- Enums ---
    fundstatus = sa.Enum(
        "PROCESSING", "PENDING_APPROVAL", "APPROVED", "REJECTED", "FAILED",
        name="fundamentalevalstatus",
    )
    fundstatus.create(op.get_bind(), checkfirst=True)

    shocksource = sa.Enum("CRISIS", "LLM_EVENT", name="shocksource")
    shocksource.create(op.get_bind(), checkfirst=True)

    # --- Team column additions (nullable; existing rows tolerate null) ---
    op.add_column("teams", sa.Column("fundamental_market_share", sa.Numeric(10, 4), nullable=True))
    op.add_column("teams", sa.Column("fundamental_margin", sa.Numeric(10, 4), nullable=True))
    op.add_column("teams", sa.Column("fundamental_growth", sa.Numeric(10, 4), nullable=True))
    op.add_column("teams", sa.Column("fundamental_ops_efficiency", sa.Numeric(10, 4), nullable=True))
    op.add_column("teams", sa.Column("drift_target_pct", sa.Numeric(8, 6), nullable=True))
    op.add_column("teams", sa.Column("ramp_started_at", sa.DateTime(timezone=True), nullable=True))

    # --- Team column drops (v1 fields) ---
    op.drop_column("teams", "target_price")
    op.drop_column("teams", "ticks_to_target")

    # --- fundamental_evaluations table ---
    op.create_table(
        "fundamental_evaluations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("team_id", UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=False),
        sa.Column("round_number", sa.Integer(), nullable=False),
        sa.Column("proposed_deltas", sa.Text(), nullable=False),  # JSON
        sa.Column("admin_edits", sa.Text(), nullable=True),       # JSON, null until edited
        sa.Column("narrative", sa.Text(), nullable=True),
        sa.Column("status", fundstatus, nullable=False, server_default="PROCESSING"),
        sa.Column("llm_model", sa.String(100), nullable=True),
        sa.Column("llm_latency_ms", sa.Integer(), nullable=True),
        sa.Column("raw_response", sa.Text(), nullable=True),
        sa.Column("admin_notes", sa.Text(), nullable=True),
        sa.Column("approved_by_admin_id", UUID(as_uuid=True), sa.ForeignKey("admins.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejected_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("team_id", "round_number", name="uq_fundeval_team_round"),
    )
    op.create_index("ix_fundeval_status", "fundamental_evaluations", ["status"])

    # --- pending_shocks table ---
    op.create_table(
        "pending_shocks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("team_id", UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=False),
        sa.Column("magnitude_pct", sa.Numeric(6, 3), nullable=False),  # Signed, e.g. -15.000, +8.000
        sa.Column("source", shocksource, nullable=False),
        sa.Column("source_ref_id", UUID(as_uuid=True), nullable=True),  # crisis_event.id or market_news.id
        sa.Column("enqueued_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("applied_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_pending_shocks_team_unapplied", "pending_shocks", ["team_id", "applied_at"])


def downgrade() -> None:
    op.drop_index("ix_pending_shocks_team_unapplied", table_name="pending_shocks")
    op.drop_table("pending_shocks")
    op.drop_index("ix_fundeval_status", table_name="fundamental_evaluations")
    op.drop_table("fundamental_evaluations")
    op.add_column("teams", sa.Column("target_price", sa.Numeric(10, 2), nullable=True))
    op.add_column("teams", sa.Column("ticks_to_target", sa.Integer(), nullable=True))
    op.drop_column("teams", "ramp_started_at")
    op.drop_column("teams", "drift_target_pct")
    op.drop_column("teams", "fundamental_ops_efficiency")
    op.drop_column("teams", "fundamental_growth")
    op.drop_column("teams", "fundamental_margin")
    op.drop_column("teams", "fundamental_market_share")
    sa.Enum(name="shocksource").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="fundamentalevalstatus").drop(op.get_bind(), checkfirst=True)
```

### Pattern 7: LLM Fundamental Delta Schema

```python
# Source: mirrors NEWS_SCHEMA pattern at server/app/worker/tasks/generate_news.py:20-73 (VERIFIED)
FUNDAMENTAL_DELTA_SCHEMA = {
    "name": "fundamental_delta_output",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "market_share_delta": {
                "type": "number",
                "description": "Change in market share (percentage points). E.g., +1.2 = +1.2pp, -0.5 = -0.5pp",
            },
            "margin_delta":       {"type": "number", "description": "Change in profitability margin (percentage points)"},
            "growth_delta":       {"type": "number", "description": "Change in brand-health proxy growth rate (percentage points)"},
            "ops_efficiency_delta":{"type": "number", "description": "Change in operational efficiency score (percentage points)"},
            "narrative": {
                "type": "string",
                "description": "2-3 sentence rationale for the proposed deltas, grounded in team's decisions and operating plan",
            },
        },
        "required": ["market_share_delta", "margin_delta", "growth_delta", "ops_efficiency_delta", "narrative"],
        "additionalProperties": False,
    },
}
```

### Pattern 8: Extended News Schema — is_event / severity / direction

```python
# Source: extends NEWS_SCHEMA at server/app/worker/tasks/generate_news.py:20 (VERIFIED target location)
# Add to market_commentary and/or world_event nested objects:
"is_event": {"type": "boolean", "description": "true if this news constitutes a price-shocking event"},
"severity": {"type": "string", "enum": ["MINOR", "MAJOR", "CATASTROPHIC"], "description": "only meaningful when is_event=true"},
"direction": {"type": "string", "enum": ["POSITIVE", "NEGATIVE"], "description": "only meaningful when is_event=true"},
"affected_tickers": {"type": "array", "items": {"type": "string"}, "description": "tickers that should receive the shock"},
```

**Magnitude mapping in worker task after LLM returns:**

```python
SEVERITY_MAG = {"MINOR": Decimal("3"), "MAJOR": Decimal("8"), "CATASTROPHIC": Decimal("15")}
DIRECTION_SIGN = {"POSITIVE": Decimal("1"), "NEGATIVE": Decimal("-1")}
if payload["is_event"]:
    magnitude = SEVERITY_MAG[payload["severity"]] * DIRECTION_SIGN[payload["direction"]]
    for ticker in payload["affected_tickers"]:
        team = (await db.execute(select(Team).where(Team.ticker == ticker))).scalar_one_or_none()
        if team:
            db.add(PendingShock(team_id=team.id, magnitude_pct=magnitude, source=ShockSource.LLM_EVENT, source_ref_id=news_item.id))
```

### Pattern 9: Crisis Injection → Shock Enqueue (extension of admin.py:1203)

The existing `inject_crisis` endpoint at `server/app/api/admin.py:1203` accepts `scenario` + `timer_seconds` but doesn't currently target specific teams. For Phase 9, CONTEXT.md D-16/D-17 requires: admin specifies target team(s) + direction + severity, and we write `PendingShock` rows at injection time.

**Two options for planner:**

1. **Extend `CrisisInjectRequest`** with `affected_team_ids: list[str]`, `severity: SeverityEnum`, `direction: DirectionEnum`. Backward compatibility: if absent, no shock is enqueued (existing auto-pause behavior preserved).
2. **Separate endpoint** `POST /api/v1/admin/crisis/shock` that takes team_ids + severity + direction and writes `PendingShock` rows. Existing `crisis/inject` stays as "pure narrative" crisis.

Recommendation: option 1 — fewer endpoints, CONTEXT.md D-16 treats admin crisis as "always fires on the team(s) named by admin." The request body grows but the semantics are cleaner.

### Anti-Patterns to Avoid

- **Computing sentiment or shocks inside the per-team Python loop with per-team SQL queries.** Batch both queries ONCE per tick before the Python loop. Otherwise we hit N+1 and blow past the 50ms target for 40 teams. `[VERIFIED: existing calculate_all_prices does this correctly for teams; extend pattern to sentiment + shocks]`
- **Publishing WebSocket before `db.commit()`.** Existing tasks enforce this order — see the note at `worker/tasks/game_tick.py:73` ("publish Redis AFTER db.commit()"). Do the same for `shock_applied` and `fundamentals_updated`. `[VERIFIED: server/app/worker/tasks/game_tick.py:73]`
- **Using `float` for price math.** All price/market_cap/cash are `Numeric` in DB; convert `random.gauss` output immediately via `Decimal(str(...))`. Existing `interpolate_price` does this. `[VERIFIED: server/app/services/simulation_service.py:51-53]`
- **Relying on `init_db.py create_all` to add new Team columns.** `server/init_db.py` calls `Base.metadata.create_all` — this is "create tables that don't exist," NOT migrate. New columns on `teams` (which already exists) will be ignored. **Every dev environment must run `alembic upgrade head` or drop the DB.** Flag this explicitly in the phase plan — it caused confusion on earlier phases per STATE.md and CONTEXT.md §code_context.
- **Letting rejected FundamentalEvaluations partially apply.** Mirror `_approve_evaluation`'s pattern: only APPROVED status ever writes to Team.
- **Mixing `approved_by_admin_id` lookup in the service function.** Admin ID comes from the `require_admin` dep on the endpoint — pass it as a parameter to `apply_fundamental_deltas`, don't query for it inside the service.
- **Forgetting to carry the `drift_now` floor on ramp reset (D-21).** If ramp is at 0.6 and a new approval arrives, new_drift_now at fraction=0 would be 0 — creating a visible snap-down. Instead: store the current `drift_now` (computed from prior fractional ramp) as `drift_floor_pct`, then `drift_now = max(drift_floor, ramp_fraction * drift_target)`. This requires one additional Team column OR derivation logic — flag to planner for decision.

## Don't Hand-Roll

| Problem                           | Don't Build                                        | Use Instead                                                                                                                                       | Why                                                                                                                                                                                                 |
| --------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LLM structured JSON output        | Custom regex/json.loads with manual key validation | `llm_service.call_openrouter(json_schema=FUNDAMENTAL_DELTA_SCHEMA)`                                                                               | Already wraps OpenRouter's `response_format={"type": "json_schema", …}`, enforces strict mode, handles parse errors, tracks latency/tokens. `[VERIFIED: server/app/services/llm_service.py:99-186]` |
| WebSocket broadcast from Celery   | Direct WebSocket writes from worker                | `publish_broadcast_sync(dict)` in `app/redis_pubsub.py`                                                                                           | Celery workers are sync; `publish_broadcast_sync` bridges to Redis pub/sub relay that fans out to all connected clients. `[VERIFIED: server/app/redis_pubsub.py:37-44]`                             |
| Retry logic for LLM calls         | Custom retry loop with backoff                     | Celery `max_retries=2, default_retry_delay=10` + `task.retry()`                                                                                   | Pattern demonstrated in `evaluate_solution` task. `[VERIFIED: server/app/worker/tasks/evaluate_solution.py:17-23]`                                                                                  |
| Async DB session in worker        | `AsyncSessionLocal()` directly                     | `get_worker_session()` context manager                                                                                                            | Avoids asyncpg pool conflicts in forked Celery workers by creating fresh engine per task. `[VERIFIED: server/app/database.py:62-86]`                                                                |
| Benchmark bands parsing           | Per-use `json.loads` + ad-hoc key checks           | Reuse `_validate_benchmark_bands` logic at `admin.py:1427` for writes; extract shared helper `parse_benchmark_bands(bands_str) -> dict` for reads | Keys are already locked: `market_share/margin/growth/ops_efficiency`. Shared helper prevents drift. `[VERIFIED: server/app/api/admin.py:1427-1452]`                                                 |
| Pydantic models for new endpoints | Inline dict schemas                                | Separate `schemas/fundamentals.py` module                                                                                                         | Mirror pattern of `schemas/decisions.py` (Phase 8). Keeps `admin.py` readable.                                                                                                                      |
| Admin page layout/wiring          | New UI framework                                   | Clone `client/src/app/admin/evaluations/page.tsx`                                                                                                 | Full pattern: filter bar, cards, expand-to-edit, `useWebSocket` refresh, toast. ~600 LOC already solving this exact UX. `[VERIFIED: client/src/app/admin/evaluations/page.tsx:1-625]`               |

**Key insight:** This phase is largely a mechanical clone of Phase 5's evaluation pipeline plus a fresh per-tick formula. The value is in the formula and the data-model surgery — not in novel architecture. Plans should be aggressive about calling out "mirror file X" to minimize invention.

## Runtime State Inventory

This is a rename/refactor phase (dropping `target_price`/`ticks_to_target`; adding/renaming fundamentals; altering LLM contract). Audit:

| Category            | Items Found                                                                                                                                                                       | Action Required                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stored data         | `teams.target_price` column (existing rows have values after Phase 4+); `teams.ticks_to_target` column; Phase 5 `evaluations.price_timeline` JSON rows referenced in approve path | **Data migration:** migration 005 drops columns; prior values lost but that's intended (D-28 says v1 is removed, not gated). Existing APPROVED evaluations remain but their target_price no longer affects price (D-28 handles this — approve_evaluation body updated to not write target_price). Existing PENDING_APPROVAL evaluations: admin can still approve them; the approved_evaluation function is edited to skip the target_price assignment. No migration of evaluation rows needed. |
| Live service config | No external services store this renaming. OpenRouter API key unchanged. Celery Beat schedule (`game-tick-every-60s`) unchanged.                                                   | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| OS-registered state | No systemd/pm2/Task Scheduler registrations reference price formula internals. Docker container names unchanged.                                                                  | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Secrets/env vars    | `OPENROUTER_API_KEY`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` — none reference v1 names.                                                                                        | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Build artifacts     | No Python package artifacts (`.egg-info`) or npm lockfile needs regeneration from this phase alone. Migration runs at container startup or manually via `alembic upgrade head`.   | `alembic upgrade head` in dev, staging, prod. Document in phase summary.                                                                                                                                                                                                                                                                                                                                                                                                                       |

**Canonical question answered:** After every file in the repo is updated, what runtime systems still have the old string/state?

- Existing PostgreSQL `teams` rows with populated `target_price`/`ticks_to_target` — migration drops columns.
- In-flight PENDING_APPROVAL evaluations (Phase 5) — admin approves them normally; approve path no longer writes target_price per D-28.
- Redis: caches only `game:status` and `game:phase` — not team-level data. No action.
- Celery result backend: stores task outcomes, not team state. No action.
- Browser localStorage via Zustand persistence: `auth-store` and `admin-store` don't persist price fields. No action.

**Critical dev-mode footgun:** `server/init_db.py` uses `Base.metadata.create_all` which does NOT add columns to existing tables. Any developer who has a dev DB from Phase 8 MUST run `alembic upgrade 005_fundamentals` OR drop the `complex` database and re-run `init_db.py` (which would then pick up the new model definitions). CONTEXT.md §code_context already flags this; the phase plan must reiterate.

## Common Pitfalls

### Pitfall 1: Ramp Reset Snap-Back (D-21)

**What goes wrong:** Admin approves a new FundamentalEvaluation mid-ramp. Naïve implementation resets `ramp_started_at` to now and `ramp_fraction` becomes 0, so `drift_now = 0`, which undoes 3 minutes of price drift in one tick. Price chart snaps.
**Why it happens:** Formula literal interpretation of "reset ramp" without preserving current drift.
**How to avoid:** D-21 mandates "drift_now at the moment of reset becomes the new ramp floor." Implementation: persist `drift_floor_pct` on Team (or compute in-memory from prior `ramp_started_at` + prior `drift_target_pct`, then overwrite). Simpler: add a `drift_floor_pct` Decimal column to the migration, write it during `apply_fundamental_deltas`, and use `drift_now = max(drift_floor_pct, ramp_fraction * drift_target_pct)`.
**Warning signs:** A single-tick price drop >1% immediately after admin approval, with no shock or sentiment to explain it.

### Pitfall 2: PostgreSQL `DISTINCT ON` + asyncpg Edge Cases

**What goes wrong:** SQLAlchemy 2.0's `.distinct(column)` generates `SELECT DISTINCT ON (column)` — fine in PostgreSQL but requires that the `ORDER BY` clause begins with the distinct-on columns. If Python re-orders via `.order_by(enqueued_at.asc())` alone, Postgres errors out.
**Why it happens:** `DISTINCT ON` is a Postgres extension with specific ordering semantics.
**How to avoid:** Always write `.order_by(team_id, enqueued_at)` and `.distinct(team_id)` together. OR use a window-function subquery: `ROW_NUMBER() OVER (PARTITION BY team_id ORDER BY enqueued_at) = 1`.
**Warning signs:** `InvalidColumnReference: SELECT DISTINCT ON expressions must match initial ORDER BY expressions`.
`[CITED: https://www.postgresql.org/docs/15/sql-select.html#SQL-DISTINCT]`

### Pitfall 3: Empty `benchmark_bands` on Legacy Teams

**What goes wrong:** Any Team that was created before archetype assignment becomes mandatory has `archetype_id = NULL`. `compute_price` tries to read `team.archetype.benchmark_bands` and crashes with AttributeError.
**Why it happens:** `Team.archetype_id` is `nullable=True` (per Phase 7 migration). Teams in PENDING/READY states may not yet have archetypes.
**How to avoid:** Filter the tick SELECT to `status=ACTIVE AND archetype_id IS NOT NULL`, OR in the per-team compute, skip teams without archetype (price stays flat, no PriceHistory row) — matches CONTEXT.md §code_context.risks: "failure mode is team without archetype. Fallback: skip fundamental computation; price stays flat."
**Warning signs:** `AttributeError: 'NoneType' object has no attribute 'benchmark_bands'` at tick time.

### Pitfall 4: Null-Safe Fundamentals on First Compute

**What goes wrong:** After migration, existing Team rows have NULL `fundamental_*` columns until archetype assignment populates them. Until then, `z_score(None, min, max)` explodes.
**Why it happens:** Migration adds columns as nullable (safe rollback). Archetype assignment writes midpoints, but there's a window of time where a team is ACTIVE without fundamentals.
**How to avoid:** In `compute_price`, treat any NULL fundamental as "skip this team." OR update the Phase 7 archetype-assign endpoint to populate fundamentals immediately (D-03 says "at archetype assignment time"). Plan must include a backfill script or one-off SQL to populate existing ACTIVE teams before the new tick loop runs.
**Warning signs:** `TypeError: unsupported operand type(s) for -: 'NoneType' and 'Decimal'` at tick time.

### Pitfall 5: `approve_evaluation` Still Writes target_price

**What goes wrong:** Phase 5 `approve_evaluation` at `evaluation_service.py:214-282` writes `team.target_price = …` and `team.ticks_to_target = 20`. After migration, these columns don't exist → SQLAlchemy raises. OR (if columns are kept temporarily) — ghost writes that do nothing.
**Why it happens:** D-28 says Phase 5 Evaluation stays but no longer sets target_price. Requires code surgery on existing approve path.
**How to avoid:** Edit `approve_evaluation` body to remove the target_price/ticks_to_target write lines (lines 251-259 in current `evaluation_service.py`). Keep the news publication + MarketNews insert. Tests covering `test_approve_writes_target_price` in `tests/test_evaluation.py:224` must be updated to assert news created but NOT target_price written (which no longer exists).
**Warning signs:** Existing Phase 5 tests fail after migration with `AttributeError: target_price` or `Column "target_price" does not exist`.

### Pitfall 6: Sentiment Query Missing Teams with Zero Volume

**What goes wrong:** The `GROUP BY target_team_id` aggregate only returns rows for teams with at least one trade in last 60s. The Python loop then misses them and `sentiment` defaults to... what?
**Why it happens:** Aggregate queries naturally skip groups with no rows.
**How to avoid:** `sentiment_by_team = {row.target_team_id: ... for row in rows}` then `sentiment = sentiment_by_team.get(team.id, Decimal("0"))` in the per-team loop. Default zero = no sentiment contribution when no trades, which is correct.
**Warning signs:** `KeyError` at tick time, OR silent no-op if dict .get default is wrong.

### Pitfall 7: `distinct` with multi-column ORDER BY semantics

(See Pitfall 2) — worth repeating separately because the plan will have tests that catch this only on the multi-shock case.

### Pitfall 8: LLM Hallucinates Wrong Delta Signs

**What goes wrong:** LLM returns `market_share_delta: -3.2` when team had a great quarter, because the team is D2C Challenger (low-baseline archetype) and LLM interpreted "challenger" as declining.
**Why it happens:** Deltas are relative to current fundamentals, but LLM must be prompted to think in "did they improve their position within their archetype's band."
**How to avoid:** Craft the system prompt to explicitly state: "Output deltas RELATIVE TO the team's current fundamentals, not absolute. A 'good quarter for a D2C Challenger' means positive deltas even if their absolute market share is 2% and the Legacy Giant is at 22%." Include archetype benchmark_bands in the prompt context so LLM sees the frame of reference. Admin approval catches remaining mistakes per D-02.
**Warning signs:** Persistent pattern of low-archetype teams receiving negative deltas even after "good" decision rounds.

### Pitfall 9: Shock Direction Misalignment

**What goes wrong:** LLM returns `is_event=true, severity=MAJOR, direction=POSITIVE` for a news item that is clearly negative (e.g., "factory fire"). Price jumps up.
**Why it happens:** LLM tone detection imperfect.
**How to avoid:** (a) Admin approval of news isn't required today, but phase 9 should log `ActivityEvent` on every shock enqueue so admin can see and reverse via crisis inject if needed. (b) Add sentiment_score cross-check: if `news.sentiment_score < 0` and `direction=POSITIVE`, flag in admin dashboard. Out of scope for Phase 9 unless plan adds it.
**Warning signs:** Team complaints about "why did we jump +8% when we just had bad news."

### Pitfall 10: Celery Fan-Out Stampede at Quarter Transition

**What goes wrong:** 40 simultaneous `compute_fundamentals_for_team.delay()` calls hit OpenRouter within milliseconds. Free-tier rate limit (typical: 20 req/min) trips. 20 tasks FAIL, admin gets 20 empty queue items.
**Why it happens:** No throttling on fan-out.
**How to avoid:** Use Celery `rate_limit` on `compute_fundamentals_for_team` task (e.g., `rate_limit="20/m"`) — Celery will queue and release at the throttled rate. OR use `task.apply_async(countdown=random.uniform(0, 30))` to spread over 30 seconds. OR move to a paid tier model.
`[CITED: https://docs.celeryq.dev/en/stable/userguide/tasks.html#Task.rate_limit]`
**Warning signs:** Burst of `429 Too Many Requests` HTTPStatusError in Celery logs, half the teams in FAILED state after War Room transition.

## Code Examples

### Example 1: End-to-End Per-Tick Rewrite Skeleton

```python
# Source: complete replacement for server/app/services/simulation_service.py (VERIFIED existing location)
import json, random, logging, uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from sqlalchemy import select, func, case, update
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import (
    PriceHistory, Team, TeamStatus, Transaction, TransactionType, PendingShock
)

logger = logging.getLogger(__name__)

# Constants (D-06, D-27 — hardcoded per phase decision)
WEIGHTS = {"market_share": Decimal("0.35"), "margin": Decimal("0.30"),
           "ops_efficiency": Decimal("0.20"), "growth": Decimal("0.15")}
DRIFT_COEF  = Decimal("0.15")
DRIFT_CAP   = Decimal("0.05")
NOISE_SIGMA = 0.02
NOISE_BOUND = Decimal("0.04")
SENTIMENT_COEF = Decimal("0.02")
SENTIMENT_CAP  = Decimal("0.003")
RAMP_TICKS  = 5
Z_CLAMP     = Decimal("2")


def z_score(value: Decimal, band_min: Decimal, band_max: Decimal) -> Decimal:
    midpoint = (band_min + band_max) / Decimal("2")
    half_width = (band_max - band_min) / Decimal("2")
    if half_width == 0:
        return Decimal("0")
    z = (value - midpoint) / half_width
    return max(-Z_CLAMP, min(Z_CLAMP, z))


def compute_weighted_z(team: Team, bands: dict) -> Decimal:
    if any(getattr(team, f"fundamental_{k}") is None for k in bands):
        return Decimal("0")  # skip until archetype-assign populates
    return (
        WEIGHTS["market_share"]   * z_score(team.fundamental_market_share,   *[Decimal(str(v)) for v in bands["market_share"]])
        + WEIGHTS["margin"]        * z_score(team.fundamental_margin,        *[Decimal(str(v)) for v in bands["margin"]])
        + WEIGHTS["ops_efficiency"] * z_score(team.fundamental_ops_efficiency,*[Decimal(str(v)) for v in bands["ops_efficiency"]])
        + WEIGHTS["growth"]        * z_score(team.fundamental_growth,        *[Decimal(str(v)) for v in bands["growth"]])
    )


def compute_drift_target(team: Team, bands: dict) -> Decimal:
    drift = DRIFT_COEF * compute_weighted_z(team, bands)
    return max(-DRIFT_CAP, min(DRIFT_CAP, drift))


def compute_ramp_fraction(team: Team, now: datetime) -> Decimal:
    if team.ramp_started_at is None:
        return Decimal("0")
    ticks_since = int((now - team.ramp_started_at).total_seconds() // 60)
    return min(Decimal("1.0"), Decimal(ticks_since) / Decimal(RAMP_TICKS))


async def calculate_all_prices(db: AsyncSession) -> tuple[list[dict], list[dict]]:
    """Replaces v1 calculate_all_prices. Returns (price_updates, shock_events)."""
    now = datetime.now(timezone.utc)

    # 1) Batch SELECT teams with archetype eager-loaded (D-23)
    teams = (await db.execute(
        select(Team)
        .options(selectinload(Team.archetype))
        .where(Team.status == TeamStatus.ACTIVE)
        .where(Team.archetype_id.is_not(None))
    )).scalars().all()

    if not teams:
        return [], []

    # 2) Batch sentiment aggregate (D-13/D-14)
    cutoff = now - timedelta(seconds=60)
    signed_value = case(
        (Transaction.transaction_type == TransactionType.BUY,
         Transaction.shares * Transaction.price_per_share),
        (Transaction.transaction_type == TransactionType.SELL,
         -(Transaction.shares * Transaction.price_per_share)),
        else_=0,
    )
    sent_rows = await db.execute(
        select(Transaction.target_team_id,
               func.coalesce(func.sum(signed_value), 0).label("net_inr"))
        .where(Transaction.executed_at >= cutoff)
        .where(Transaction.transaction_type.in_([TransactionType.BUY, TransactionType.SELL]))
        .group_by(Transaction.target_team_id)
    )
    sentiment_by_team = {r.target_team_id: Decimal(str(r.net_inr)) for r in sent_rows}

    # 3) Pending shocks (D-19, one per team FIFO via DISTINCT ON)
    shock_rows = await db.execute(
        select(PendingShock)
        .where(PendingShock.applied_at.is_(None))
        .order_by(PendingShock.team_id, PendingShock.enqueued_at)
        .distinct(PendingShock.team_id)
    )
    shock_by_team: dict[uuid.UUID, tuple[PendingShock, Decimal]] = {}
    for s in shock_rows.scalars().all():
        shock_by_team[s.team_id] = (s, s.magnitude_pct / Decimal("100"))

    # 4) Per-team Python compute
    price_updates: list[dict] = []
    shock_events: list[dict] = []
    applied_shock_ids: list[uuid.UUID] = []

    for team in teams:
        bands = json.loads(team.archetype.benchmark_bands)

        # sentiment
        net_inr = sentiment_by_team.get(team.id, Decimal("0"))
        market_cap = team.stock_price * Decimal(team.shares_outstanding)
        if market_cap > 0:
            sentiment_raw = net_inr / market_cap
            sentiment = max(-SENTIMENT_CAP, min(SENTIMENT_CAP, sentiment_raw * SENTIMENT_COEF))
        else:
            sentiment = Decimal("0")

        # shock
        shock_pair = shock_by_team.get(team.id)
        if shock_pair is not None:
            shock_obj, shock = shock_pair
            applied_shock_ids.append(shock_obj.id)
            shock_events.append({
                "team_id": str(team.id),
                "ticker": team.ticker,
                "magnitude_pct": str(shock_obj.magnitude_pct),
                "source": shock_obj.source.value,
            })
        else:
            shock = Decimal("0")

        # ramp + drift
        ramp_frac = compute_ramp_fraction(team, now)
        drift_target = team.drift_target_pct if team.drift_target_pct is not None else Decimal("0")
        drift_now = ramp_frac * drift_target

        # noise
        noise_raw = Decimal(str(random.gauss(0, NOISE_SIGMA)))
        noise = max(-NOISE_BOUND, min(NOISE_BOUND, noise_raw))

        multiplier = Decimal("1") + drift_now + sentiment + shock + noise
        new_price = max(Decimal("0.01"), (team.stock_price * multiplier).quantize(Decimal("0.01")))
        old_price = team.stock_price
        team.stock_price = new_price

        db.add(PriceHistory(
            team_id=team.id,
            price=new_price,
            market_cap=new_price * team.shares_outstanding,
            calculated_at=now,
        ))

        change_pct = ((new_price - old_price) / old_price * 100) if old_price > 0 else Decimal("0")
        price_updates.append({
            "team_id": str(team.id),
            "ticker": team.ticker,
            "price": str(new_price),
            "change_pct": f"{change_pct:+.2f}",
            "market_cap": str(new_price * team.shares_outstanding),
            "timestamp": now.isoformat(),
        })

    # 5) Mark consumed shocks
    if applied_shock_ids:
        await db.execute(
            update(PendingShock)
            .where(PendingShock.id.in_(applied_shock_ids))
            .values(applied_at=now)
        )

    return price_updates, shock_events
```

### Example 2: Tick Task — Minimal Diff from Current `game_tick.py`

```python
# Source: current server/app/worker/tasks/game_tick.py:66-88 (VERIFIED) — only _execute_tick body changes
async def _execute_tick():
    from app.database import get_worker_session
    from app.services.simulation_service import calculate_all_prices
    from app.redis_pubsub import publish_broadcast_sync

    async with get_worker_session() as db:
        price_updates, shock_events = await calculate_all_prices(db)   # CHANGE: tuple return
        await db.commit()

    if price_updates:
        publish_broadcast_sync({"type": "price_update", "payload": {"prices": price_updates}})
        logger.info("Price tick: %d teams updated", len(price_updates))
    if shock_events:                                                    # NEW
        publish_broadcast_sync({"type": "shock_applied", "payload": {"shocks": shock_events}})
        logger.info("Shocks applied: %d", len(shock_events))
```

### Example 3: Admin Fundamentals Queue Page (high-level skeleton, clone of evaluations page)

```typescript
// Source: clone of client/src/app/admin/evaluations/page.tsx (VERIFIED 625 LOC reference)
// Changes from evaluations page:
//   - api.getFundamentalsQueue() instead of api.getEvaluations()
//   - Edit form: 4 delta inputs (market_share_delta, margin_delta, ops_efficiency_delta, growth_delta) + narrative text
//   - Display: team ticker, round_number, current fundamentals + proposed deltas = projected values + current/projected z-scores
//   - WS message type: "fundamental_evaluation_pending" instead of "evaluation_pending"
//   - Approve: api.approveFundamental(id) — toast "Fundamentals applied — ramp started"
//   - Reject: api.rejectFundamental(id, notes) — no price impact
//   - FILTER_OPTIONS same: ALL / PENDING_APPROVAL / APPROVED / REJECTED / PROCESSING / FAILED
//   - STATUS_COLORS same palette
```

### Example 4: Caseline Panel — Fundamentals Strip (insert between ARCHETYPE IDENTITY and CASELINE DOCUMENT)

```tsx
// Source: extends client/src/components/game/CaselinePanel.tsx (VERIFIED reference file)
// Load via new GET /api/v1/teams/me/fundamentals (or extend getCaseline response)
{
  fundamentals && (
    <div className="space-y-3">
      <div className="text-[9px] text-[#89919d] uppercase font-bold tracking-widest">
        FUNDAMENTALS
      </div>
      <div className="grid grid-cols-2 gap-1">
        {[
          {
            label: "MKT SHARE",
            value: fundamentals.market_share,
            z: fundamentals.z_market_share,
            band: bands.market_share,
          },
          {
            label: "PROFITABILITY",
            value: fundamentals.margin,
            z: fundamentals.z_margin,
            band: bands.margin,
          },
          {
            label: "OPS EFF",
            value: fundamentals.ops_efficiency,
            z: fundamentals.z_ops_efficiency,
            band: bands.ops_efficiency,
          },
          {
            label: "BRAND HEALTH",
            value: fundamentals.growth,
            z: fundamentals.z_growth,
            band: bands.growth,
          },
        ].map(({ label, value, z, band }) => {
          const inBand = Math.abs(z) <= 1;
          const color = inBand ? "#02c953" : z > 0 ? "#9ecaff" : "#FF1744";
          return (
            <div key={label} className="bg-[#201f1f] p-2">
              <div className="text-[9px] text-[#89919d] uppercase font-bold tracking-widest mb-1">
                {label}
              </div>
              <div className="flex justify-between items-baseline">
                <span className="font-mono text-xs" style={{ color }}>
                  {Number(value).toFixed(2)}
                </span>
                <span className="font-mono text-[10px] text-[#89919d]">
                  z {Number(z).toFixed(2)}
                </span>
              </div>
              <div className="text-[9px] text-[#404752] font-mono mt-1">
                band {band[0]}-{band[1]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

## State of the Art

| Old Approach (v1)                                                                                                                                                   | Current Approach (v2, Phase 9)                                                                                                                                                       | When Changed  | Impact                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LLM evaluates solution → returns `price_timeline` → admin approves → writes `target_price` and `ticks_to_target=20` → per-tick linear interpolation + bounded noise | LLM evaluates at quarter boundary → returns fundamental deltas → admin approves → writes fundamentals + resets ramp → per-tick formula: weighted z-score + sentiment + shock + noise | Phase 9 (now) | v1 pipeline replaced. `interpolate_price` deleted. `set_team_score` admin endpoint returns 410 Gone. Phase 5 `Evaluation` stays (quality_score becomes LLM-narrative input, not price driver). |
| Random walk + quality_score (Phase 4)                                                                                                                               | Fundamental-driven (Phase 9)                                                                                                                                                         | Phase 9       | Price is no longer "random walk toward admin-set target" — it's "continuously pressured by how well the team is doing in its archetype's band"                                                 |
| No event shocks — only narrative news                                                                                                                               | Explicit shock mechanism: admin crisis + LLM-tagged news, enqueued via PendingShock table, single-tick jumps                                                                         | Phase 9       | Volatility surface more realistic — crises and major announcements cause visible discontinuities in the candle chart                                                                           |
| Sentiment absent                                                                                                                                                    | Last-60s signed INR volume / market_cap, clamped ±0.3%/tick                                                                                                                          | Phase 9       | Trading pressure now visibly influences price (though small per-tick, cumulative over a window)                                                                                                |

**Deprecated / outdated (post-Phase-9):**

- `Team.target_price`, `Team.ticks_to_target` — dropped
- `interpolate_price(current, target, ticks_remaining)` — deleted
- `set_team_score(db, team_id, quality_score)` — deleted from `simulation_service.py`
- `POST /api/v1/admin/teams/:id/score` — returns 410 Gone with body: `{"detail": "v1 quality_score flow replaced by fundamental evaluation and override endpoints"}`
- `approve_evaluation` body — target_price/ticks_to_target writes removed (news creation preserved)

## Assumptions Log

| #   | Claim                                                                                                                                                                                             | Section                             | Risk if Wrong                                                                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `teams.stock_price * Decimal(shares_outstanding)` is the correct market cap for sentiment normalization                                                                                           | Pattern 4, Example 1                | If "market cap" in CONTEXT.md D-14 means "public float × price", sentiment normalization differs by ~10× for teams with 900k treasury shares. Clamp still bounds it, so impact is capped — but mathematical meaning shifts. Confirm with user.                  |
| A2  | Magnitude storage format: `PendingShock.magnitude_pct` stores signed percentage as Decimal (e.g., `-15.000` for -15%, `+3.000` for +3%)                                                           | Pattern 5, Pattern 8, Migration 005 | If stored as fraction (e.g., `-0.15`), Example 1's `/ Decimal("100")` is wrong. Consistent treatment required across enqueue + consume.                                                                                                                         |
| A3  | LLM news schema changes (`is_event`, `severity`, `direction`, `affected_tickers`) belong at the top level of the news output, not nested inside `market_commentary` or `world_event`              | Pattern 8                           | If LLM is expected to tag each sub-article separately, schema shape differs. Current NEWS_SCHEMA at `generate_news.py:20` has two nested objects — Phase 9 plan must specify shape.                                                                             |
| A4  | "Admin crisis fires on the team(s) named by admin" means the admin endpoint request body must be extended with `affected_team_ids`, `severity`, `direction`                                       | Pattern 9                           | If admin crisis is meant to continue firing on all active teams (existing no-target behavior), only the LLM news shock path is new. Check CONTEXT.md D-16 intent — decision is ambiguous between "admin named team(s)" and extending the existing crisis model. |
| A5  | `drift_floor_pct` column is needed to implement D-21 snap-free ramp reset                                                                                                                         | Pitfall 1                           | If computed in-memory from prior state (without a persistent column), implementation is stateless but requires admin-approval transaction to read + compute before overwriting. Either approach works; picking one affects migration 005 shape.                 |
| A6  | Fundamentals are expressed in the same units as benchmark bands (percentages stored as numbers — e.g., 15.5 for 15.5% market share)                                                               | Example 1 z_score, Pattern 1 deltas | If stored as fractions (0.155), every math line mis-scales. Existing `benchmark_bands` stores `[20, 25]` meaning "20% to 25%" per Phase 7 D-03 — so fundamentals are percentages too. Verify by inspecting the seed archetypes.                                 |
| A7  | The existing admin `/admin/crisis/inject` endpoint at `admin.py:1203` can be extended (backward-compatible) with optional fields, OR the Phase 9 plan creates a separate `/crisis/shock` endpoint | Pattern 9                           | Impacts whether planner adds one or two endpoints. Recommendation: extend (fewer endpoints, cleaner semantics).                                                                                                                                                 |

**If an assumption fires wrong:** the planner should add a clarifying question for the discuss-phase or CONTEXT.md supplement before committing to that design decision.

## Open Questions (RESOLVED)

> All six open questions from discovery were resolved during /gsd-discuss-phase and plan authoring. The original questions are retained below for traceability; each is annotated with its **RESOLVED** outcome and the plan that implements it.

1. **Drift floor representation (D-21 snap-free reset)**
   - **RESOLVED:** Persistent `drift_floor_pct` nullable Decimal column added to `teams` via Migration 005 (Plan 09-01). On approval/override, `fundamental_service.apply_fundamental_deltas` / `override_fundamentals` writes `drift_floor_pct = current drift_now` atomically with `ramp_started_at` reset (Plan 09-03). `compute_price` reads it via `drift_now = max(drift_floor_pct, ramp_fraction * drift_target)` (Plan 09-02).
   - What we know: D-21 requires "drift_now at moment of reset becomes new ramp floor."
   - What's unclear: Persistent `drift_floor_pct` column vs. derive from prior ramp state vs. smooth-transition math without an explicit floor.
   - Recommendation: Add `drift_floor_pct` to the migration as a nullable Decimal column. It's cheap, explicit, and the approval path writes it atomically alongside `ramp_started_at`.

2. **Sentiment normalizer base: market cap with treasury shares or public float?**
   - **RESOLVED:** Sentiment normalizer base = `public_float` = `shares_outstanding * 0.30`. Implemented in Plan 02 via `PUBLIC_FLOAT_RATIO = Decimal("0.30")` constant in `simulation_service.py`; `compute_sentiment_for_all_teams` divides signed INR volume by `stock_price * shares_outstanding * PUBLIC_FLOAT_RATIO`.
   - What we know: D-14 says "normalized by team market cap."
   - What's unclear: "Market cap" in finance typically = `stock_price * shares_outstanding`. For this game, teams have 1M shares_outstanding with 900k treasury + 100k public float. Using full shares_outstanding makes sentiment denominator 10× bigger → sentiment 10× smaller → likely too faint.
   - Recommendation: Use `stock_price * public_float` as the normalizer. Matches real-world trading-impact intuition (only float trades). Flag explicitly in plan so user can confirm.

3. **LLM news `is_event` fields: top-level or nested?**
   - **RESOLVED:** Placed on BOTH nested objects (`market_commentary` and `world_event`) — a market_commentary shocks a single team via ticker match; a world_event shocks sector-wide teams via `affected_tickers` array. Implemented in Plan 04 Task 1 (NEWS_SCHEMA extension) and Plan 04 Task 2 (`_enqueue_shocks_from_news` walks both nested paths).
   - What we know: Current NEWS_SCHEMA has two nested objects (market_commentary, world_event).
   - What's unclear: Whether an event can only originate from a market_commentary (team-specific) or from a world_event (sector-wide affecting multiple teams).
   - Recommendation: Put `is_event`, `severity`, `direction`, `affected_tickers` on BOTH nested objects, OR add a third top-level field `event_details`. Planner to decide and document.

4. **Admin crisis endpoint extension vs new endpoint**
   - **RESOLVED:** Extend existing `CrisisInjectRequest` with optional `affected_team_ids: list[str] | None`, `severity: SeverityEnum | None`, `direction: DirectionEnum | None`. Implemented in Plan 04 Task 3 — when all three present, enqueue PendingShock rows; when absent, keep v1 narrative-only pause behavior (backwards compatible).
   - What we know: D-16 says admin crisis fires on specified teams with severity/direction.
   - What's unclear: Existing `CrisisInjectRequest` has only `scenario` and `timer_seconds`.
   - Recommendation: Extend `CrisisInjectRequest` with optional `affected_team_ids: list[str] | None`, `severity: SeverityEnum | None`, `direction: DirectionEnum | None`. When present → enqueue `PendingShock` rows. When absent → current behavior (auto-pause, narrative-only).

5. **When does archetype-assign populate `fundamental_*` columns?**
   - **RESOLVED:** Migration 005 performs a one-shot backfill UPDATE: `UPDATE teams SET fundamental_market_share = midpoint(bands.market_share), fundamental_margin = midpoint(bands.margin), fundamental_growth = midpoint(bands.growth), fundamental_ops_efficiency = midpoint(bands.ops_efficiency) FROM archetypes WHERE teams.archetype_id = archetypes.id AND teams.fundamental_market_share IS NULL`. Implemented in Plan 09-01 Task 1; verified by Plan 09-01 Task 3 `test_migration_005` round-trip test; archetype-assign endpoint (Plan 09-01 Task 2) writes the midpoint for new assigns.
   - What we know: D-03 says "at archetype assignment time."
   - What's unclear: Do existing teams from previous dev sessions get backfilled? The phase is greenfield for fundamentals, but there may already be archetype-assigned teams in dev DBs.
   - Recommendation: Migration 005 includes a `one-shot UPDATE teams SET fundamental_* = midpoint FROM archetypes WHERE teams.archetype_id = archetypes.id AND fundamental_market_share IS NULL` to backfill. Write tests that verify post-migration state.

6. **Should `fundamentals_updated` WS event include the full fundamentals + z-scores or just team_id signal?**
   - **RESOLVED:** Full payload. `fundamentals_updated` carries `{team_id, ticker, fundamentals, drift_target_pct, drift_floor_pct}`. Implemented in Plan 09-05 Task 2 (admin approve + override endpoints publish the full payload after commit). Frontend (Plan 09-06 Task 3) CaselinePanel re-fetches via `getMyFundamentals` on receipt — the signal still forces a REST re-fetch so z-scores are computed server-side with the latest ramp_fraction, but the payload contains enough for the admin queue to update inline without an extra fetch.
   - What we know: Admin tab shows z-scores live. Strategist caseline panel shows fundamentals live.
   - What's unclear: Include data in payload vs. send signal and have clients re-fetch via REST.
   - Recommendation: Include full payload (team_id, fundamentals, z-scores, drift_target_pct). Mirrors `price_update` message which includes price — not a signal. Prevents N+1 fetches from admin tab.

## Environment Availability

| Dependency                                               | Required By                  | Available                                                 | Version | Fallback                                                                               |
| -------------------------------------------------------- | ---------------------------- | --------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------- |
| Python 3.11-3.13                                         | Backend                      | ✓ (per pyproject.toml `requires-python = ">=3.11,<3.14"`) | —       | —                                                                                      |
| PostgreSQL 15                                            | DB migrations + new tables   | Presumed ✓ (Docker compose service)                       | 15      | —                                                                                      |
| Redis 7                                                  | Celery broker + pub/sub      | Presumed ✓                                                | 7       | —                                                                                      |
| Celery worker + Beat processes                           | Periodic tasks + LLM fan-out | Presumed ✓ (already running for Phases 4-8)               | 5.6.3+  | —                                                                                      |
| OpenRouter API + API key (`OPENROUTER_API_KEY`)          | LLM fundamental eval         | Presumed ✓ (used by Phase 5 `evaluate_solution`)          | —       | **Rate limit concern:** see Pitfall 10. Recommend `rate_limit="20/m"` on new task.     |
| `nvidia/nemotron-3-super-120b-a12b:free` model (default) | Fundamental evaluation       | ✓ (per `llm_service.py:129`)                              | —       | Can override per-call via `model=` param                                               |
| Alembic CLI (`alembic upgrade head`)                     | Schema migration             | ✓ (migrations 001-004 applied)                            | 1.18.4+ | `init_db.py create_all` does NOT migrate existing tables — must run Alembic explicitly |
| Context7 MCP (documentation lookups)                     | Not required                 | —                                                         | —       | CLI fallback via `npx ctx7@latest` documented                                          |

**Missing dependencies with no fallback:** None — phase is entirely within existing stack.

**Missing dependencies with fallback:** None identified.

**Operational note:** Every environment (dev, staging, prod) needs `alembic upgrade 005_fundamentals` after deploy. Dev environments using `init_db.py` require DB wipe + re-init OR explicit Alembic run. STATE.md and CONTEXT.md both flag this.

## Validation Architecture

### Test Framework

| Property           | Value                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| Framework          | pytest 8.0+ with pytest-asyncio 0.23+ (`asyncio_mode = "auto"`)                                           |
| Config file        | `server/pyproject.toml` `[tool.pytest.ini_options]`                                                       |
| Test directory     | `server/tests/` (see `server/tests/test_simulation.py`, `test_evaluation.py` for reference)               |
| Fixtures           | `server/tests/conftest.py` — `mock_db`, `mock_redis`, `mock_team`, `mock_evaluation`, `game_state_active` |
| Quick run command  | `cd server && uv run pytest tests/test_simulation.py -x`                                                  |
| Full suite command | `cd server && uv run pytest -x`                                                                           |
| Frontend           | No existing frontend test suite in the project. Visual verification via admin UI.                         |

### Phase Requirements → Test Map

| Req ID     | Behavior                                                                                                      | Test Type       | Automated Command                                                                 | File Exists?                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| SIM-05     | Weighted z-score with 35/30/20/15 weights returns correct drift_target                                        | unit            | `uv run pytest tests/test_simulation.py::TestComputeDriftTarget -x`               | ❌ Wave 0 (test_simulation.py exists but test class is new)             |
| SIM-05     | `compute_price` produces `new_price = prev * (1 + drift + sentiment + shock + noise)`                         | unit            | `uv run pytest tests/test_simulation.py::TestComputePrice -x`                     | ❌ Wave 0                                                               |
| SIM-06     | `z_score(midpoint)` returns 0; `z_score(band_max)` returns +1; `z_score(band_min)` returns -1                 | unit (property) | `uv run pytest tests/test_simulation.py::TestZScore -x`                           | ❌ Wave 0                                                               |
| SIM-06     | `z_score` clamps at ±2 for extreme values                                                                     | unit            | same                                                                              | ❌ Wave 0                                                               |
| SIM-07     | `PendingShock` with magnitude +8 produces multiplier of +0.08 in next tick                                    | integration     | `uv run pytest tests/test_simulation.py::TestShockApplication -x`                 | ❌ Wave 0                                                               |
| SIM-07     | FIFO consumption: two shocks queued per team → only first applied per tick                                    | integration     | same                                                                              | ❌ Wave 0                                                               |
| SIM-07     | Admin crisis `inject_crisis` with `affected_team_ids` + severity + direction writes PendingShock              | integration     | `uv run pytest tests/test_admin_fundamentals.py::TestCrisisShockEnqueue -x`       | ❌ Wave 0                                                               |
| SIM-07     | LLM news with `is_event=true, severity=MAJOR, direction=NEGATIVE` enqueues -8% shock                          | integration     | `uv run pytest tests/test_shock_enqueue.py -x`                                    | ❌ Wave 0                                                               |
| SIM-08     | Signed INR volume aggregate: 2 BUY txns + 1 SELL txn in last 60s computes correctly                           | integration     | `uv run pytest tests/test_simulation.py::TestSentimentQuery -x`                   | ❌ Wave 0                                                               |
| SIM-08     | Sentiment normalization clamps to ±0.3%/tick even with extreme volume                                         | unit            | same                                                                              | ❌ Wave 0                                                               |
| SIM-08     | Sentiment sign preserved: net buying → positive, net selling → negative                                       | unit (property) | same                                                                              | ❌ Wave 0                                                               |
| SIM-09     | `compute_ramp_fraction` monotonic non-decreasing over time, capped at 1.0 at tick 5+                          | unit (property) | `uv run pytest tests/test_simulation.py::TestRamp -x`                             | ❌ Wave 0                                                               |
| SIM-09     | Ramp fraction 0.0 immediately after `ramp_started_at` set                                                     | unit            | same                                                                              | ❌ Wave 0                                                               |
| SIM-09     | New approval mid-ramp: `drift_now` does not decrease (snap-free per D-21)                                     | integration     | `uv run pytest tests/test_fundamental_service.py::TestRampReset -x`               | ❌ Wave 0                                                               |
| ARCH-03    | Team with `fundamental_market_share` at band midpoint → z_market_share = 0                                    | unit            | `uv run pytest tests/test_simulation.py::TestArchetypeRelative -x`                | ❌ Wave 0                                                               |
| ARCH-03    | Same absolute MS value gives different z-scores for different archetypes                                      | unit            | same                                                                              | ❌ Wave 0                                                               |
| D-01/D-02  | `build_fundamental_prompt` includes Decision rows, OperatingPlan, archetype bands, current fundamentals       | unit            | `uv run pytest tests/test_fundamental_service.py::TestBuildPrompt -x`             | ❌ Wave 0                                                               |
| D-01/D-02  | `save_fundamental_evaluation` creates PENDING_APPROVAL record                                                 | unit            | `uv run pytest tests/test_fundamental_service.py::TestSaveEvaluation -x`          | ❌ Wave 0                                                               |
| D-02       | `apply_fundamental_deltas` updates team fundamentals, sets `ramp_started_at`, computes new `drift_target_pct` | integration     | `uv run pytest tests/test_fundamental_service.py::TestApplyDeltas -x`             | ❌ Wave 0                                                               |
| D-02       | Admin edits `proposed_deltas` via PATCH → approval uses `admin_edits` over `proposed_deltas`                  | integration     | `uv run pytest tests/test_admin_fundamentals.py::TestEditThenApprove -x`          | ❌ Wave 0                                                               |
| D-02       | Reject does not modify team fundamentals                                                                      | integration     | `uv run pytest tests/test_admin_fundamentals.py::TestReject -x`                   | ❌ Wave 0                                                               |
| D-28       | `POST /api/v1/admin/teams/:id/score` returns 410 Gone                                                         | integration     | `uv run pytest tests/test_admin.py::TestSetScoreDeprecated -x`                    | ❌ Wave 0                                                               |
| D-28       | `approve_evaluation` (Phase 5) no longer writes target_price (column doesn't exist)                           | integration     | `uv run pytest tests/test_evaluation.py::TestApproveEvaluation -x`                | ✅ existing test file; **needs update** — existing assertions will fail |
| D-29       | `game.tick` task still schedules, still broadcasts `price_update`, skips when `game:phase=war_room`           | integration     | `uv run pytest tests/test_game_tick.py -x`                                        | ✅ existing test file; likely no change needed                          |
| end-to-end | War Room transition enqueues `compute_fundamentals_for_team` for each ACTIVE team                             | integration     | `uv run pytest tests/test_fundamental_service.py::TestQuarterTransitionFanOut -x` | ❌ Wave 0                                                               |
| end-to-end | Full tick cycle with fundamentals + sentiment + shock + noise produces a PriceHistory row and a WS broadcast  | integration     | `uv run pytest tests/test_simulation.py::TestFullTickCycle -x`                    | ❌ Wave 0                                                               |

### Property Tests to Include

- **z-score symmetry:** `z(midpoint + delta) == -z(midpoint - delta)` for delta within band.
- **Ramp monotonicity:** for fixed `ramp_started_at`, `compute_ramp_fraction(t1) <= compute_ramp_fraction(t2)` whenever t1 < t2.
- **Sentiment sign preservation:** `sentiment(net_inr > 0) > 0` and `sentiment(net_inr < 0) < 0` before clamping.
- **Shock determinism:** given same PendingShock row, `compute_price` multiplier delta equals `magnitude_pct / 100` within noise bounds.
- **Price floor invariant:** `compute_price` never returns less than `Decimal("0.01")` regardless of inputs.

### Sampling Rate

- **Per task commit:** `cd server && uv run pytest tests/test_simulation.py tests/test_fundamental_service.py -x` (~5-10s)
- **Per wave merge:** `cd server && uv run pytest -x` (full backend suite)
- **Phase gate:** Full backend suite green + manual smoke: admin approves fundamental eval → caseline fundamentals tile updates → next tick shows price drift.

### Wave 0 Gaps

- [ ] `server/tests/test_fundamental_service.py` — new file covering prompt building, save, apply deltas, ramp reset
- [ ] `server/tests/test_admin_fundamentals.py` — new file covering queue endpoints (list/get/edit/approve/reject/override)
- [ ] `server/tests/test_shock_enqueue.py` — new file covering crisis + LLM news → PendingShock insertion
- [ ] `server/tests/test_simulation.py` — existing file, test classes to add: `TestZScore`, `TestComputeDriftTarget`, `TestComputePrice`, `TestSentimentQuery`, `TestShockApplication`, `TestRamp`, `TestArchetypeRelative`, `TestFullTickCycle`. Remove: `TestInterpolatePrice`, `TestSetTeamScore`.
- [ ] `server/tests/test_evaluation.py` — existing file, update `TestApproveEvaluation::test_approve_writes_target_price` to new behavior (news only, no target_price).
- [ ] `server/tests/conftest.py` — add fixture `mock_archetype_with_bands`, `mock_team_with_fundamentals`, `mock_fundamental_evaluation`.
- [ ] Framework install: none required — pytest-asyncio already in dev deps.

## Security Domain

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                                                                                                                                                                                                                |
| --------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2 Authentication     | yes     | Reuse `require_admin` dep for all new admin endpoints; JWT in `Authorization: Bearer` header (`server/app/auth_utils.py`)                                                                                                                                       |
| V3 Session Management | no      | No new session behavior; admin token unchanged                                                                                                                                                                                                                  |
| V4 Access Control     | yes     | Admin-only endpoints use `_admin: dict = Depends(require_admin)` on every route — matches existing Phase 5 approval routes. Team-scoped fundamental read (`GET /api/v1/teams/me/fundamentals`) uses `require_team_member` / per-team JWT                        |
| V5 Input Validation   | yes     | Pydantic field constraints: `round_number: int = Field(ge=0)`, deltas `float = Field(ge=-100, le=100)`, magnitude `Decimal` constrained at 3/8/15 server-side (don't trust LLM literal). Reuse existing `_validate_benchmark_bands` for anything touching bands |
| V6 Cryptography       | no      | No new cryptographic primitives                                                                                                                                                                                                                                 |
| V7 Error Handling     | yes     | LLM failure must not leak team business logic to other teams. Mirror `evaluate_solution` pattern: FAILED status on exception, publish to _source team only_ via `publish_to_team_sync`                                                                          |
| V10 Malicious Code    | yes     | LLM output is parsed as JSON with strict schema; no exec/eval on LLM text. Narrative field is stored as Text, rendered as plain text (React auto-escapes).                                                                                                      |
| V13 API & Web Service | yes     | All mutations (approve, reject, override) require POST/PATCH, not GET. CSRF concerns: admin sends JWT Bearer, not cookies — so classic CSRF doesn't apply.                                                                                                      |

### Known Threat Patterns for this stack

| Pattern                                                                                            | STRIDE                            | Standard Mitigation                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LLM prompt injection (team operating plan could attempt to embed "produce positive deltas")        | Tampering, Elevation of Privilege | System prompt explicitly instructs LLM to treat operating plan content as untrusted data, not instructions. Admin approval layer catches successful injections (D-02).                                                |
| SQL injection via dynamic SQL in sentiment aggregate                                               | Tampering                         | SQLAlchemy Core/ORM binds parameters — no string concat with user input. Verified in Pattern 4 above.                                                                                                                 |
| Race condition: two admins approve same FundamentalEvaluation simultaneously → double-apply deltas | Tampering                         | Check `status == PENDING_APPROVAL` before apply; raise `ValueError` and return 409 Conflict on mismatch. Mirrors `approve_evaluation` at `evaluation_service.py:238-242`.                                             |
| Race condition: fundamental approval runs concurrently with tick loop reading team fundamentals    | Tampering                         | `selectinload(Team.archetype)` + no inter-tick locking means the tick gets a snapshot per-tick. Admin approval commits atomically. Eventual consistency is acceptable — next tick picks up new values.                |
| Admin issues override while tick is mid-compute                                                    | Tampering                         | Same as above — tick snapshots at SELECT time.                                                                                                                                                                        |
| Shock enqueue from compromised LLM news output (false news flagged as event)                       | Spoofing                          | Admin sees all shock events via `shock_applied` WS + `ActivityEvent` log. Can reverse with counter-crisis. Not Phase 9 scope to auto-detect.                                                                          |
| PendingShock DoS: attacker triggers many crisis events                                             | Denial of Service                 | `require_admin` on crisis endpoint; admin-only workflow. Rate limiting not required for this surface.                                                                                                                 |
| Leaking team A's fundamentals to team B                                                            | Information Disclosure            | `GET /api/v1/teams/me/fundamentals` scoped to JWT's team_id. No public fundamentals endpoint. Admin endpoint behind `require_admin`.                                                                                  |
| LLM call leaks secret in prompt context                                                            | Information Disclosure            | Prompt includes only: team public data (caseline, archetype bands, current fundamentals, decision rows, operating plan). No API keys, no other teams' private data. Verify in `build_fundamental_prompt` code review. |

## Sources

### Primary (HIGH confidence)

- `server/app/services/evaluation_service.py` — Phase 5 approval pipeline, the 1:1 mirror template for Phase 9. `[VERIFIED: codebase]`
- `server/app/services/simulation_service.py` — current `interpolate_price`, `calculate_all_prices`, `set_team_score`. `[VERIFIED: codebase]`
- `server/app/services/llm_service.py` — `call_openrouter(json_schema=…)` signature. `[VERIFIED: codebase]`
- `server/app/worker/tasks/game_tick.py` — Celery tick entry and `_execute_tick` flow. `[VERIFIED: codebase]`
- `server/app/worker/tasks/evaluate_solution.py` — Celery task pattern with retry + FAILED record. `[VERIFIED: codebase]`
- `server/app/worker/tasks/generate_news.py` — NEWS_SCHEMA pattern, ready to extend with `is_event`. `[VERIFIED: codebase]`
- `server/app/worker/celery_app.py` — Beat schedule and task time limits. `[VERIFIED: codebase]`
- `server/app/services/game_service.py` — War Room / Live Floor transitions, `set_game_phase`, Redis cache pattern. `[VERIFIED: codebase]`
- `server/app/models.py` — Team, Transaction, Evaluation, Archetype, CrisisEvent models. `[VERIFIED: codebase]`
- `server/app/api/admin.py` — existing admin endpoints (evaluations, archetype, crisis), `_validate_benchmark_bands`. `[VERIFIED: codebase]`
- `server/app/redis_pubsub.py` — `publish_broadcast_sync` and `publish_to_team_sync`. `[VERIFIED: codebase]`
- `server/alembic/versions/003_add_archetype.py`, `004_decision_levers_round_structure.py` — migration pattern. `[VERIFIED: codebase]`
- `server/tests/conftest.py`, `tests/test_simulation.py`, `tests/test_evaluation.py`, `tests/test_game_tick.py` — existing pytest structure. `[VERIFIED: codebase]`
- `server/init_db.py` — confirmed `create_all` does not migrate existing tables. `[VERIFIED: codebase]`
- `server/pyproject.toml` — pinned Python 3.11-3.13 and all dependencies. `[VERIFIED: codebase]`
- `client/src/app/admin/evaluations/page.tsx` — UI pattern for admin queue (625 LOC). `[VERIFIED: codebase]`
- `client/src/components/game/CaselinePanel.tsx` — Strategist panel extension target. `[VERIFIED: codebase]`
- `client/src/components/admin/admin-sidebar.tsx` — sidebar nav items. `[VERIFIED: codebase]`
- `client/src/stores/market-store.ts` — price update consumer. `[VERIFIED: codebase]`
- `client/src/lib/types.ts` — existing TS types including `PriceUpdateMessage`. `[VERIFIED: codebase]`
- `.planning/phases/09-enhanced-simulation-engine/09-CONTEXT.md` — 32 locked decisions. `[VERIFIED: codebase]`
- `.planning/phases/07-archetypes-and-sample-portfolios/07-CONTEXT.md` — archetype schema. `[VERIFIED: codebase]`
- `.planning/phases/08-decision-levers-and-round-structure/08-CONTEXT.md` — Decision/OperatingPlan models. `[VERIFIED: codebase]`
- `CLAUDE.md` — project stack and constraints. `[VERIFIED: codebase]`

### Secondary (MEDIUM confidence)

- `[CITED: https://www.postgresql.org/docs/15/sql-select.html#SQL-DISTINCT]` — `DISTINCT ON` semantics for FIFO shock query.
- `[CITED: https://docs.celeryq.dev/en/stable/userguide/tasks.html#Task.rate_limit]` — Celery `rate_limit` for LLM fan-out throttling.
- `[CITED: https://platform.openai.com/docs/guides/structured-outputs]` — JSON schema `strict: true` guarantees conformance (OpenRouter proxies this for upstream models; some free models may emit looser JSON).

### Tertiary (LOW confidence)

- Quarter-boundary LLM cost estimate: 40 teams × 20 quarters × 1 call = 800 calls/competition. At typical OpenRouter prices for nemotron-3-super (free tier) or comparable paid (~$0.002/call), well under $5/competition. `[ASSUMED]` — depends on model choice and actual token volumes.
- Tick latency target <50ms for 40 teams: based on existing Phase 4 tick performance (~10-20ms for pure batch + interpolate). New formula adds constant work per team (sentiment lookup is a dict `.get`, z-score is 4 arithmetic ops). Estimate is conservative. `[ASSUMED]` — measure after implementation.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all dependencies in `pyproject.toml` verified; no new libraries required.
- Architecture patterns: HIGH — Phase 5 pipeline is fully mirrored; existing patterns verified line-by-line.
- Per-tick formula implementation: HIGH — straightforward translation of CONTEXT.md D-06/07 math to Python.
- LLM schema shape: MEDIUM — schema structure is locked by CONTEXT.md but exact key names/nesting for `is_event` fields open (see Assumption A3).
- Alembic migration shape: HIGH — directly follows patterns 003/004, no unusual SQL needed.
- Admin UI cloning: HIGH — 625 LOC reference file exists.
- Caseline panel insertion: HIGH — clear anchor in existing file.
- Sentiment normalizer base (market_cap vs public_float): MEDIUM — Assumption A1 requires user confirmation.
- Testing: HIGH — pytest infra exists, fixtures exist; Wave 0 gaps identified.
- Security: HIGH — all endpoints inherit existing `require_admin`/`require_team_member` patterns.

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (30 days — codebase moves slowly on core simulation; revisit if Phase 8 ships updates to `set_game_phase` or `game_service`)

---

_Researched for Phase 9: Enhanced Simulation Engine. Downstream consumers (planner, plan-checker, execute-phase) must read `09-CONTEXT.md` first, then this file. Assumptions A1-A7 require discussion before plan finalization._
