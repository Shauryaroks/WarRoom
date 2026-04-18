---
phase: "08-decision-levers-and-round-structure"
plan: "01"
subsystem: "backend/data-layer"
tags: [models, migration, game-phase, budget, schemas]
dependency_graph:
  requires: [archetype-model, game-state-machine]
  provides:
    [
      decision-model,
      operating-plan-model,
      game-phase-service,
      budget-service,
      decision-schemas,
    ]
  affects: [game_service, models, alembic]
tech_stack:
  added: []
  patterns:
    [
      unique-constraint-upsert,
      eager-load-archetype,
      performance-multiplier-clamp,
    ]
key_files:
  created:
    - server/alembic/versions/004_decision_levers_round_structure.py
    - server/app/schemas/__init__.py
    - server/app/schemas/decisions.py
  modified:
    - server/app/models.py
    - server/app/services/game_service.py
decisions:
  - "LeverCategory enum has 4 values (PRICING, MARKETING, SUPPLY_CHAIN, NEW_PRODUCT) — Trading uses existing panel per D-06"
  - "Budget multiplier clamped [0.7, 1.3] based on stock_price / starting_stock_price ratio"
  - "game_phase is a nullable String(20) on GameState, not a new enum — keeps flexibility per D-01"
metrics:
  completed: "2026-04-16"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 2
---

# Phase 8 Plan 01: Decision Levers Data Layer Summary

Decision and OperatingPlan models with LeverCategory enum, GameState phase extensions (game_phase, macro_brief, current_quarter_start), Alembic migration 004, game phase transition service, budget calculation from archetype starting_cash with performance multiplier, and full Pydantic schema set for API endpoints.

## Task Results

| Task | Name                                       | Commit  | Files                                             |
| ---- | ------------------------------------------ | ------- | ------------------------------------------------- |
| 1    | Models, enum, migration                    | 38ba9ef | models.py, 004_decision_levers_round_structure.py |
| 2    | Game phase service + budget calc + schemas | 4633cb7 | game_service.py, schemas/decisions.py             |

## What Was Built

### Models (server/app/models.py)

- **LeverCategory** enum: PRICING, MARKETING, SUPPLY_CHAIN, NEW_PRODUCT
- **Decision** model: team_id, round_number, lever_category, decisions_json, budget_spent, window_start/end. UniqueConstraint on (team_id, round_number, lever_category) enables upsert pattern per D-07.
- **OperatingPlan** model: team_id, round_number, content (Markdown). UniqueConstraint on (team_id, round_number).
- **GameState** extended: game_phase (war_room/live_floor/null), macro_brief, current_quarter_start.

### Migration (004_decision_levers_round_structure.py)

- Creates levercategory PostgreSQL enum type
- Creates decisions table with composite unique constraint and index
- Creates operating_plans table with unique constraint
- Adds 3 columns to game_state
- Full downgrade support

### Service Layer (game_service.py)

- **set_game_phase()**: Validates phase, requires ACTIVE status, sets game_phase + macro_brief/current_quarter_start as appropriate, commits, updates Redis cache, broadcasts game_phase_changed.
- **get_operating_budget()**: Loads team with archetype, calculates budget = starting_cash \* multiplier (clamped 0.7-1.3 from stock price performance), queries spent from Decision table, returns total/allocated/remaining/multiplier.
- Updated **\_broadcast_state_change** to include game_phase in all state change payloads.
- Updated **\_update_redis_cache** to store game:phase key.

### Pydantic Schemas (schemas/decisions.py)

- DecisionSubmitRequest, DecisionSubmitResponse
- BulkDecisionSubmitRequest, BulkDecisionSubmitResponse
- OperatingPlanSubmitRequest, OperatingPlanSubmitResponse
- BudgetResponse
- SetGamePhaseRequest, GamePhaseResponse

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED
