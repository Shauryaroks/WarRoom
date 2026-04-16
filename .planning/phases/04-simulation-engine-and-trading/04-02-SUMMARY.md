---
phase: "04-simulation-engine-and-trading"
plan: "02"
subsystem: "trading-backend"
tags: [trading, atomicity, select-for-update, portfolio, market-data]
dependency_graph:
  requires: [server/app/models.py, server/app/auth_utils.py, server/app/database.py, server/app/redis_pubsub.py]
  provides: [server/app/services/trading_service.py, server/app/api/trading.py, server/app/api/market.py]
  affects: [server/app/main.py]
tech_stack:
  added: []
  patterns: [SELECT FOR UPDATE row locking, proportional cost basis adjustment, Decimal-as-string serialization]
key_files:
  created:
    - server/app/services/trading_service.py
    - server/app/api/trading.py
    - server/app/api/market.py
    - server/tests/test_trading.py
  modified:
    - server/app/main.py
decisions:
  - "Used MagicMock(spec=Model) for test fixtures instead of __new__ to avoid SQLAlchemy instrumented attribute issues"
  - "Broadcast trade events via Redis publish_broadcast after DB commit, not inside transaction"
  - "Cost basis adjusted proportionally on partial sell: remaining_basis = total_basis * (remaining/original)"
metrics:
  duration: "4m 8s"
  completed: "2026-04-16T07:20:28Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 1
  tests_added: 8
  tests_passing: 44
---

# Phase 4 Plan 2: Trading Backend with Atomic Buy/Sell Summary

Atomic buy/sell trading service with SELECT FOR UPDATE row-level locking for 30% external shareholding cap enforcement, plus REST endpoints for trading and market data.

## What Was Built

### Trading Service (server/app/services/trading_service.py)
- `execute_buy`: Locks target team, ALL holdings for target, and buyer team rows via SELECT FOR UPDATE. Validates 30% cap (total_external + new_shares <= 30% of public_float), checks cash sufficiency, creates StockHolding/Transaction/CashLedger atomically. Caller commits.
- `execute_sell`: Locks target team, seller's holding, and seller team rows. Adjusts cost basis proportionally on partial sell. Deletes holding if shares reach 0.
- `preview_trade`: Read-only preview returning cost, available cash, shares remaining before 30% cap. No locks.
- `get_portfolio`: Returns holdings with P&L (market_value - cost_basis), percentage change, ownership percentage, net worth.

### Trading API (server/app/api/trading.py)
- `POST /api/v1/trading/preview` - Any team member can preview
- `POST /api/v1/trading/buy` - Trader-only (403 for strategist, T-04-06)
- `POST /api/v1/trading/sell` - Trader-only (403 for strategist)
- `GET /api/v1/trading/portfolio` - Any team member can view
- All prices serialized as strings (Decimal precision per Pitfall 5)
- Trade events broadcast via Redis after DB commit

### Market API (server/app/api/market.py)
- `GET /api/v1/market/companies` - All active/ready/cooldown teams with current prices
- `GET /api/v1/market/prices/{team_id}` - Price history for chart backfill (limit param, default 100)

### Tests (server/tests/test_trading.py)
- 8 unit tests covering: buy creates records, self-trade rejection, 30% cap enforcement, insufficient cash, sell reduces shares, insufficient shares, preview returns data, portfolio P&L calculation

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|------------|
| T-04-05 | buyer_team_id != target_team_id validation in execute_buy and execute_sell |
| T-04-06 | `current_user["role"] != "trader"` check raises 403 on buy/sell endpoints |
| T-04-07 | Pydantic `Field(gt=0)` on shares in TradeRequest and TradePreviewRequest |
| T-04-08 | SELECT FOR UPDATE on ALL StockHolding rows for target team before summing |
| T-04-09 | SELECT FOR UPDATE on buyer Team row, cash >= total_cost check within lock |
| T-04-10 | Portfolio uses team_id from JWT (current_user), not from request body |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SQLAlchemy __new__ incompatible with instrumented attributes in tests**
- **Found during:** Task 1 RED/GREEN phase
- **Issue:** Using `Team.__new__(Team)` to create test fixtures caused `AttributeError: 'NoneType' object has no attribute 'set'` because SQLAlchemy's descriptor protocol requires proper initialization
- **Fix:** Switched to `MagicMock(spec=Team)` for all test fixtures
- **Files modified:** server/tests/test_trading.py
- **Commit:** 977b8eb

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 (RED) | cb914c8 | Failing tests for trading service (8 tests) |
| 1 (GREEN) | 977b8eb | Trading service implementation with all tests passing |
| 2 | 3d79d27 | Trading and market API routers registered in main.py |

## TDD Gate Compliance

- RED gate: cb914c8 (test commit, all 8 tests fail with ModuleNotFoundError)
- GREEN gate: 977b8eb (feat commit, all 8 tests pass)
- REFACTOR gate: not needed (code clean on first pass)

## Known Stubs

None. All functions are fully implemented with real logic.

## Self-Check: PASSED

- [x] server/app/services/trading_service.py exists
- [x] server/app/api/trading.py exists
- [x] server/app/api/market.py exists
- [x] server/tests/test_trading.py exists
- [x] Commits cb914c8, 977b8eb, 3d79d27 exist in git log
- [x] 44 tests passing
