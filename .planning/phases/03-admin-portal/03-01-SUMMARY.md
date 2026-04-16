---
phase: 03-admin-portal
plan: 01
subsystem: backend-admin-api
tags: [admin, api, endpoints, activity-log, news-injection]
dependency_graph:
  requires: []
  provides: [admin-remove-endpoint, admin-news-inject, admin-broadcast, admin-advance-round, admin-activity-log, admin-news-history, activity-event-model]
  affects: [server/app/api/admin.py, server/app/models.py]
tech_stack:
  added: []
  patterns: [activity-event-logging, hard-soft-team-removal, news-as-broadcast]
key_files:
  created:
    - server/alembic/versions/002_add_activity_event.py
    - server/tests/test_admin.py
  modified:
    - server/app/models.py
    - server/app/api/admin.py
decisions:
  - "ActivityEvent model uses dedicated table (not aggregated from existing tables) for simpler querying"
  - "Broadcasts use same news_injected WebSocket type as news injection per D-05"
  - "Hard delete in SETUP explicitly deletes related records to avoid FK violations"
metrics:
  duration: 270s
  completed: 2026-04-16
  tasks: 3/3
  files_created: 2
  files_modified: 2
---

# Phase 3 Plan 1: Admin Backend Endpoints Summary

Added 6 new admin API endpoints with ActivityEvent model, migration, and activity logging on all admin actions.

## One-liner

Six admin endpoints (team removal with hard/soft logic, news injection, broadcast, round advance, activity log, news history) plus ActivityEvent model with comprehensive test coverage.

## Completed Tasks

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | ActivityEvent model and migration | bae5b3f | server/app/models.py, server/alembic/versions/002_add_activity_event.py |
| 2 | New admin API endpoints | a087755 | server/app/api/admin.py |
| 3 | Admin endpoint tests | b7ebe4e | server/tests/test_admin.py |

## Implementation Details

### Task 1: ActivityEvent Model
- Added `ActivityEvent` model to `models.py` with fields: `id`, `event_type`, `actor`, `description`, `metadata_json`, `created_at`
- Created manual migration `002_add_activity_event.py` with `down_revision = "001_initial"`
- Added index on `created_at` for efficient query ordering

### Task 2: Admin Endpoints
- **POST /teams/{team_id}/remove** -- Hard delete in SETUP (explicitly deletes Directives, StockHoldings, Transactions, CashLedger, PriceHistory first), soft BANKRUPT in ACTIVE/PAUSED, 409 in FINISHED
- **POST /news/inject** -- Creates MarketNews with source_type=ADMIN_INJECTED, broadcasts via Redis pub/sub
- **POST /broadcast** -- Creates MarketNews with source_type=ADMIN_BROADCAST, uses same "news_injected" WebSocket type per D-05
- **POST /game/advance-round** -- Increments GameState.current_round using FOR UPDATE lock
- **GET /activity** -- Returns last 200 ActivityEvent records
- **GET /news/history** -- Returns last 100 MarketNews records with parsed affected_tickers
- Added ActivityEvent logging to existing approve/reject/start/pause/resume endpoints

### Task 3: Tests
- 10 tests covering all new endpoints plus auth guards
- Uses httpx AsyncClient with FastAPI dependency overrides
- All tests pass

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

1. **ActivityEvent as dedicated table** -- Simpler to query and paginate than aggregating across multiple tables. Added index on created_at for efficient ordering.
2. **Broadcast uses news_injected type** -- Per D-05, broadcasts ARE news items. Both use the same WebSocket message type so teams receive broadcasts in their news feed.
3. **Explicit cascade delete for hard removal** -- Rather than relying on DB cascade config, explicitly delete all related records before team deletion to prevent FK violations in any configuration.

## Verification Results

- All 6 new endpoints registered and functional
- ActivityEvent model imports correctly
- 10/10 tests pass (`uv run python -m pytest tests/test_admin.py -x`)
- All endpoints use `Depends(require_admin)` (verified by auth guard test)
