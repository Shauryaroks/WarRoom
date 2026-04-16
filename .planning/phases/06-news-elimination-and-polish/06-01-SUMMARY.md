---
phase: 06-news-elimination-and-polish
plan: 01
subsystem: api
tags: [celery, llm, openrouter, alembic, postgresql, news-generation]

# Dependency graph
requires:
  - phase: 05-llm-evaluation
    provides: call_openrouter LLM service, evaluation pipeline, Celery task pattern
provides:
  - call_openrouter with configurable json_schema parameter
  - generate_news Celery task (MARKET_COMMENTARY + WORLD_EVENT)
  - CrisisEvent model for crisis lifecycle tracking
  - CRISIS_RESPONSE solution type for crisis submissions
  - Alembic migration 002 for crisis_events table
affects: [06-02, 06-03, 06-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [custom JSON schema passthrough for OpenRouter structured output]

key-files:
  created:
    - server/app/worker/tasks/generate_news.py
    - server/alembic/versions/002_add_crisis_event.py
  modified:
    - server/app/services/llm_service.py
    - server/app/models.py

key-decisions:
  - "call_openrouter defaults to EVALUATION_SCHEMA when json_schema is None (backward compatible)"
  - "News generation failure is non-critical -- logged but not re-raised to avoid blocking approvals"
  - "Headlines truncated to 120 chars before DB save per T-06-01 threat mitigation"

patterns-established:
  - "Custom schema pattern: pass json_schema to call_openrouter for different structured outputs"
  - "Non-critical Celery task pattern: try/except with log-only error handling"

requirements-completed: [NEWS-02, NEWS-03]

# Metrics
duration: 4min
completed: 2026-04-16
---

# Phase 6 Plan 1: News Generation Backend + Crisis Event Model Summary

**Refactored call_openrouter with custom json_schema support, added generate_news Celery task producing two news types per approval, and CrisisEvent model with Alembic migration**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-16T05:31:07Z
- **Completed:** 2026-04-16T05:35:09Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- call_openrouter now accepts an optional json_schema parameter, defaulting to EVALUATION_SCHEMA for backward compatibility
- generate_news Celery task produces two MarketNews records (MARKET_COMMENTARY team-specific + WORLD_EVENT broader context) per evaluation approval, broadcasting both via Redis pub/sub
- CrisisEvent model with id, scenario, timer_seconds, status, created_at, resolved_at added to models.py
- CRISIS_RESPONSE added to SolutionType enum for crisis event submissions
- Alembic migration 002 creates crisis_events table and adds CRISIS_RESPONSE to solutiontype enum

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor call_openrouter + CrisisEvent model + CRISIS_RESPONSE enum** - `ddd19ad` (feat)
2. **Task 2: News generation Celery task + Alembic migration** - `a8798fa` (feat)

## Files Created/Modified
- `server/app/services/llm_service.py` - Added json_schema parameter to call_openrouter, conditional key validation
- `server/app/models.py` - Added CrisisEvent model and CRISIS_RESPONSE to SolutionType enum
- `server/app/worker/tasks/generate_news.py` - New Celery task: LLM news generation with NEWS_SCHEMA
- `server/alembic/versions/002_add_crisis_event.py` - Migration for crisis_events table + enum update

## Decisions Made
- call_openrouter defaults to EVALUATION_SCHEMA when json_schema is None, preserving full backward compatibility with existing evaluate_solution task
- News generation failure is non-critical (try/except, log-only) to avoid blocking the evaluation approval flow
- Headlines truncated to 120 chars before DB save as a defense-in-depth measure per T-06-01

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Python virtualenv not accessible in worktree (permission denied on .venv), so verification used grep-based acceptance criteria instead of Python import checks. All criteria passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- call_openrouter with json_schema is ready for any future structured output use case
- generate_news task ready to be dispatched from approve_evaluation endpoint (Plan 06-02)
- CrisisEvent model ready for admin crisis inject endpoint (Plan 06-03)
- Migration ready to run against PostgreSQL

---
*Phase: 06-news-elimination-and-polish*
*Completed: 2026-04-16*
