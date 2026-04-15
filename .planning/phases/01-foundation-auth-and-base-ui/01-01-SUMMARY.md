---
phase: 01-foundation-auth-and-base-ui
plan: 01
subsystem: backend-infrastructure
tags: [docker, database, celery, caddy, models, alembic]
dependency_graph:
  requires: []
  provides: [database-schema, docker-services, celery-worker, jwt-config]
  affects: [01-02, 01-03, 01-04, 01-05, 01-06]
tech_stack:
  added: [PyJWT]
  patterns: [async-sqlalchemy, pydantic-v2-settings, celery-beat-embedded]
key_files:
  created:
    - server/alembic/versions/001_initial_schema.py
    - server/.env.example
  modified:
    - server/app/models.py
    - server/app/database.py
    - server/pyproject.toml
    - server/app/worker/celery_app.py
    - docker-compose.yml
    - Caddyfile
    - .gitignore
decisions:
  - "Removed ADMIN_API_KEY from Settings, replaced by Admin model + JWT auth (D-03, D-04)"
  - "Used DateTime(timezone=True) for all timestamp columns to enforce timezone awareness"
  - "Added .env.example exception to .gitignore which had **/.env* wildcard"
metrics:
  duration: 384s
  completed: "2026-04-15T23:07:11Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 8
---

# Phase 1 Plan 1: Backend Infrastructure and Schema Evolution Summary

**One-liner:** Dual-credential team model with Admin table, JWT config, Docker Compose healthchecks, Caddy WebSocket zero-timeout, and Celery worker hardening.

## Task Completion

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Evolve models, database config, and create initial migration | 580df8f | Done |
| 2 | Docker Compose, Caddyfile, Celery worker setup | 7f50d9b | Done |

## Key Changes

### Task 1: Models, Database, Migration
- **Team model** evolved per D-01: replaced single `email`/`password_hash`/`api_key` with dual `strategist_email`/`strategist_password_hash` and `trader_email`/`trader_password_hash` fields
- **Admin model** added per D-03: separate entity with `email`, `password_hash`, `created_at`
- **JWT config** added to Settings per D-04: `JWT_SECRET`, `JWT_ALGORITHM`, `JWT_EXPIRY_HOURS`; removed `ADMIN_API_KEY`
- **PENDING_APPROVAL** added to `DirectiveStatus` enum for human-in-the-loop flow
- **pause_offset** added to `GameState` for tracking total paused time
- All `datetime.utcnow()` replaced with `datetime.now(timezone.utc)` (Python 3.12+ deprecation)
- All `DateTime` columns upgraded to `DateTime(timezone=True)` for timezone awareness
- Settings migrated from `class Config` to `model_config = SettingsConfigDict(...)` (Pydantic v2)
- Single clean Alembic migration created per D-08, old migrations deleted
- Dependencies updated: PyJWT>=2.9.0, redis>=7.1.1, sqlalchemy>=2.0.49, alembic>=1.18.4, pydantic>=2.9.0

### Task 2: Docker, Caddy, Celery
- Docker Compose: healthchecks on db (pg_isready), redis (redis-cli ping), worker (celery inspect ping)
- Dependency conditions: api and worker wait for `service_healthy` on db and redis
- Caddyfile: `read_timeout 0` + `write_timeout 0` in transport block for WebSocket persistence (Pitfall 7)
- Celery: task_time_limit reduced 300s to 60s, worker_max_tasks_per_child reduced 1000 to 100
- Beat schedule cleared for Phase 1 (tasks added in later phases)
- Auto-discovery configured for `app.worker.tasks` package

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] .gitignore excluded .env.example**
- **Found during:** Task 1
- **Issue:** Root `.gitignore` had `**/.env*` which caught `.env.example`
- **Fix:** Added `!**/.env.example` exception to `.gitignore`
- **Files modified:** `.gitignore`
- **Commit:** 580df8f (amended into Task 1)

## Decisions Made

1. Removed `ADMIN_API_KEY` hardcoded default from Settings -- replaced by Admin model with hashed passwords + JWT auth per D-03/D-04 (threat T-01-02 mitigated)
2. Used `DateTime(timezone=True)` for all timestamp columns to enforce timezone awareness at the database level
3. Added `.env.example` exception to `.gitignore` since the root gitignore had a broad `**/.env*` pattern

## Threat Flags

None -- all changes align with the plan's threat model. T-01-01 (no real secrets in .env.example) and T-01-02 (ADMIN_API_KEY removed) are both addressed.

## Known Stubs

None -- all files are fully implemented for Phase 1 scope.

## Self-Check: PASSED

All files verified present. All commits verified in git log.
