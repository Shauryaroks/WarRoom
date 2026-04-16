---
phase: 04-simulation-engine-and-trading
plan: 01
subsystem: simulation-engine
tags: [simulation, price-tick, celery, admin-api]
dependency_graph:
  requires: []
  provides: [simulation_service, price_tick_task, admin_set_score]
  affects: [game_tick, admin_api, team_model]
tech_stack:
  added: []
  patterns: [price-interpolation, bounded-gaussian-noise, celery-async-bridge, batch-query]
key_files:
  created:
    - server/app/services/simulation_service.py
    - server/alembic/versions/003_add_target_price_ticks_to_target.py
    - server/tests/test_simulation.py
  modified:
    - server/app/models.py
    - server/app/worker/tasks/game_tick.py
    - server/app/api/admin.py
decisions:
  - "Price interpolation uses linear step + clamped Gaussian noise (volatility_pct/2 stddev)"
  - "Teams without target_price skip price ticks (no random walk per D-01)"
  - "target_price and ticks_to_target cleared when ticks exhausted"
  - "Prices serialized as strings in broadcast to avoid JS float precision (Pitfall 5)"
metrics:
  duration: 277s
  completed: 2026-04-16T07:21:19Z
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 3
---

# Phase 4 Plan 1: Simulation Engine Backend Summary

Price tick Celery task with interpolation-based price calculation, PriceHistory persistence, Redis broadcast, and admin quality score endpoint.

## One-liner

60-second price tick engine with bounded-noise interpolation toward admin-set target prices, PriceHistory writes, and Redis pub/sub broadcast.

## What was built

### simulation_service.py
- `interpolate_price()`: Pure function -- linear step toward target + Gaussian noise clamped to configurable volatility band (default 4%). Floor at $0.01.
- `calculate_all_prices()`: Batch-queries all ACTIVE teams, interpolates prices for teams with targets, writes PriceHistory rows, returns broadcast-ready dicts with string-serialized decimals.
- `set_team_score()`: Converts quality score (0.0-1.0) to target_price using formula `current * (1 + (score - 0.5) * 0.4)`, sets 20-tick trajectory.
- `get_current_quarter()`: Maps elapsed seconds to quarter number (1200s = 1 quarter).

### game_tick.py (expanded)
- `game_tick()` now calls `_execute_tick()` via `asyncio.run()` when game is ACTIVE.
- `_execute_tick()` uses `get_worker_session()` for async DB access, calls `calculate_all_prices()`, commits, then publishes `price_update` message via `publish_broadcast_sync()`.
- Follows anti-pattern guard: Redis publish happens AFTER db.commit().

### Admin set-score endpoint
- `POST /api/v1/admin/teams/{team_id}/set-score` with `SetScoreRequest(quality_score: float)`.
- Pydantic `Field(ge=0.0, le=1.0)` validates input range (T-04-02).
- `Depends(require_admin)` enforces admin-only access (T-04-01).

### Team model changes
- Added `target_price` (Numeric(10,2), nullable) and `ticks_to_target` (Integer, nullable).
- Alembic migration 003 created.
- Game restart resets both columns to None.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| d5e166b | test | Failing tests for simulation service (TDD RED) |
| 65e9fa4 | feat | Implement simulation service + model columns + migration |
| 1a16d26 | feat | Expand game_tick and add admin set-score endpoint |

## Test Results

12 simulation tests + 4 game_tick tests + 10 admin tests + 10 game_service tests + 8 trading tests = 44 total, all passing.

| Test | Status |
|------|--------|
| test_interpolation_moves_toward_target | PASS |
| test_returns_target_when_ticks_zero | PASS |
| test_floor_at_one_cent | PASS |
| test_noise_bounded_within_volatility_band | PASS |
| test_returns_decimal_rounded_to_two_places | PASS |
| test_quarter_1_at_start | PASS |
| test_quarter_2_at_1200_seconds | PASS |
| test_set_team_score_stores_target_price | PASS |
| test_no_active_teams_returns_empty | PASS |

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

1. **Noise model**: Gaussian with stddev = volatility_pct/2, clamped to [-volatility_pct, +volatility_pct]. This gives a bell-curve centered on the interpolation step with hard bounds.
2. **Target clearing**: When `ticks_to_target` reaches 0, both `target_price` and `ticks_to_target` are set to None rather than leaving stale values.
3. **Skip teams without targets**: Per D-01, teams without a target_price get no price movement at all -- no PriceHistory row written, no broadcast entry. This is intentional (market doesn't start until first evaluation).

## Known Stubs

None -- all functions are fully implemented with real logic.
