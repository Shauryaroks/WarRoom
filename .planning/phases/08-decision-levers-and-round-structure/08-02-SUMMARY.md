---
phase: 08-decision-levers-and-round-structure
plan: 02
subsystem: api-layer
tags: [decisions, war-room, live-floor, budget, operating-plan, api]
dependency_graph:
  requires: [08-01]
  provides: [decisions-api, game-phase-api, budget-api, operating-plan-api]
  affects: [admin.py, trading.py, game_tick.py, main.py]
tech_stack:
  added: [postgresql-upsert-on-conflict]
  patterns: [per-lever-validation, server-side-budget-calc, upsert-resubmission]
key_files:
  created:
    - server/app/api/decisions.py
    - server/app/api/game.py
  modified:
    - server/app/api/admin.py
    - server/app/api/trading.py
    - server/app/worker/tasks/game_tick.py
    - server/app/main.py
decisions:
  - Marketing budget calculation uses 30% of total budget as marketing spend rate
  - Decision window derived from current_quarter_start + 20 minutes
metrics:
  duration: 208s
  completed: 2026-04-16
---

# Phase 8 Plan 02: Decision & Round API Endpoints Summary

Full REST API layer for decision levers and round structure: admin War Room/Live Floor transitions, team decision submission with server-side budget validation, operating plan submission, and budget/phase query endpoints.

## Commits

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Admin game phase endpoints + Celery guard | b4694f6 | War Room/Live Floor admin endpoints, Celery tick guard, trading halt |
| 2 | Decision + operating plan + budget endpoints | f380669 | Decision submission with per-lever validation, budget enforcement, operating plan, game info endpoints |

## What Was Built

### Task 1: Admin Phase Transitions + Guards
- **POST /api/v1/admin/game/war-room**: Enters War Room, sets macro_brief, logs activity, broadcasts phase change
- **POST /api/v1/admin/game/live-floor**: Opens Live Floor, sets current_quarter_start, logs activity, broadcasts
- **GET /api/v1/admin/game/phase**: Read-only current phase query
- **Celery guard**: `is_game_active()` now checks `game:phase` Redis key; skips tick when `war_room`
- **Trading guard**: Buy and sell endpoints return 409 when game_phase is war_room

### Task 2: Team Decision & Budget Endpoints
- **POST /api/v1/decisions/submit**: Bulk decision submission with per-lever validation (PRICING, MARKETING, SUPPLY_CHAIN, NEW_PRODUCT), server-side budget calculation (T-08-02), budget exceeded check (D-12), upsert on conflict (D-07)
- **GET /api/v1/decisions/current**: Returns locked decisions for current team + round
- **POST /api/v1/decisions/operating-plan**: War Room only, strategist only, upsert by team+round
- **GET /api/v1/decisions/operating-plan**: Current round plan or 404
- **GET /api/v1/game/phase**: Team-facing phase query (macro_brief only during War Room)
- **GET /api/v1/game/budget**: Team budget with total/allocated/remaining

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|------------|
| T-08-01 | require_team + strategist role check on submit endpoints |
| T-08-02 | Server recalculates budget_spent from decisions_json, ignores client value |
| T-08-03 | require_admin on all admin phase endpoints |
| T-08-04 | Per-lever validation with explicit field constraints and ranges |
| T-08-05 | Upsert with ON CONFLICT prevents unbounded row creation |
| T-08-07 | max_length=50000 on Pydantic operating plan schema |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all endpoints are fully wired to database and service layer.

## Self-Check: PASSED
