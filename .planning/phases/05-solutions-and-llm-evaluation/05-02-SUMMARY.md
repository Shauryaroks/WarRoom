---
phase: 05-solutions-and-llm-evaluation
plan: 02
subsystem: solutions-api
tags: [api, solutions, evaluation, admin, tests]
dependency_graph:
  requires: ["05-01"]
  provides: ["solutions-api-router", "admin-evaluation-endpoints", "caseline-assignment"]
  affects: ["frontend-solutions-panel", "admin-evaluations-page", "admin-teams-page"]
tech_stack:
  added: []
  patterns: ["FastAPI router", "Pydantic validation", "dependency injection testing", "httpx AsyncClient"]
key_files:
  created:
    - server/app/api/solutions.py
    - server/tests/test_solutions.py
    - server/tests/test_evaluation.py
  modified:
    - server/app/api/admin.py
    - server/app/main.py
    - server/tests/conftest.py
decisions:
  - "Deferred Celery import in submit endpoint to avoid circular imports in worker context"
  - "Used httpx AsyncClient + dependency overrides for endpoint testing (matching existing test patterns)"
  - "Evaluation list endpoint uses selectinload for team+solution to avoid N+1 queries"
metrics:
  duration: 349s
  completed: 2026-04-16
  tasks_completed: 2
  tasks_total: 2
  test_count: 14
  total_tests_passing: 58
---

# Phase 5 Plan 02: Solutions & Evaluation API Endpoints Summary

Solutions API router with submit/cooldown/caseline endpoints, admin evaluation approve/reject/edit flow, and caseline assignment -- all with comprehensive test coverage.

## Task Summary

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create solutions API router and extend admin endpoints | 7a86f7d | server/app/api/solutions.py, server/app/api/admin.py, server/app/main.py |
| 2 | Create tests for solutions and evaluation endpoints | 9760bc8 | server/tests/test_solutions.py, server/tests/test_evaluation.py, server/tests/conftest.py |

## What Was Built

### Solutions Router (server/app/api/solutions.py)
- **POST /api/v1/solutions/submit** -- Strategist-only solution submission with server-side validation: 1-hour window for INITIAL, 20-minute cooldown for MICROTWEAK. Dispatches Celery task for LLM evaluation.
- **GET /api/v1/solutions/my-solutions** -- Team's solutions with evaluation status via selectinload.
- **GET /api/v1/solutions/cooldown** -- Cooldown status with seconds_remaining.
- **GET /api/v1/solutions/caseline** -- Team's caseline document and company display name.

### Admin Evaluation Endpoints (server/app/api/admin.py extensions)
- **GET /api/v1/admin/evaluations** -- List evaluations with team info, optional status filter.
- **GET /api/v1/admin/evaluations/{id}** -- Single evaluation detail.
- **PUT /api/v1/admin/evaluations/{id}** -- Edit PENDING_APPROVAL evaluation fields (score, metrics, news, timeline).
- **POST /api/v1/admin/evaluations/{id}/approve** -- Approve evaluation, writes target_price to team, creates MarketNews, broadcasts via Redis.
- **POST /api/v1/admin/evaluations/{id}/reject** -- Reject evaluation with admin notes, notifies team via Redis pub/sub.
- **PUT /api/v1/admin/teams/{id}/caseline** -- Assign caseline document during SETUP phase, with optional starting_cash and initial_stock_price.

### Tests (14 new tests, 58 total passing)
- Solution submission: within window, outside window rejected, cooldown active, cooldown expired, trader blocked, cooldown set
- Evaluation: prompt building, save as PENDING_APPROVAL, approve writes target_price, double-approve fails, reject with notes, edit fields
- Cooldown and caseline endpoint tests

## Deviations from Plan

None -- plan executed exactly as written.

## Self-Check: PASSED
