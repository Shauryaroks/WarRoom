---
phase: 01-foundation-auth-and-base-ui
plan: 03
subsystem: auth
tags: [jwt, pyjwt, bcrypt, fastapi, rest-api, rbac]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Team/Admin SQLAlchemy models, database.py with Settings (JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRY_HOURS)"
provides:
  - "JWT auth utilities (create_access_token, decode_token, get_current_user, require_admin, require_team)"
  - "Team registration endpoint (POST /api/v1/auth/register) creating dual sub-accounts"
  - "Team login endpoint (POST /api/v1/auth/login) with role selection"
  - "Admin login endpoint (POST /api/v1/admin/login)"
  - "Admin team management (approve/reject)"
  - "Admin seed endpoint for bootstrap"
  - "FastAPI app with CORS, lifespan, request logging, routers mounted"
affects: [01-04, 02-websocket, 03-game-engine, admin-panel]

# Tech tracking
tech-stack:
  added: [PyJWT, bcrypt, email-validator]
  patterns: [FastAPI dependency injection for auth, HTTPBearer token extraction, role-based JWT claims]

key-files:
  created:
    - server/app/auth_utils.py
    - server/app/api/auth.py
    - server/app/api/admin.py
    - server/app/api/teams.py
    - server/app/main.py
    - server/app/__init__.py
    - server/app/api/__init__.py
  modified: []

key-decisions:
  - "JWT subject_id is always team.id for both strategist and trader roles (simplifies token validation)"
  - "Admin seed endpoint restricted to zero-admin state (T-03-02 mitigation)"
  - "Same email used for both strategist and trader sub-accounts initially (can be changed later)"

patterns-established:
  - "Auth dependency injection: Depends(get_current_user) for any auth, Depends(require_admin) for admin-only, Depends(require_team) for team-only"
  - "Router prefix pattern: each router owns its /api/v1/{resource} prefix"
  - "Pydantic request/response models co-located with router file"
  - "Request logging middleware with health check filtering"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06]

# Metrics
duration: 4min
completed: 2026-04-16
---

# Phase 1 Plan 3: Auth API Summary

**JWT auth API with team registration (dual sub-accounts), role-based login, admin management, and FastAPI app wiring using PyJWT**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-15T23:12:02Z
- **Completed:** 2026-04-15T23:16:28Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- JWT auth utilities with create/decode/verify and FastAPI dependency injection for role-based access control
- Team registration creating both strategist and trader sub-accounts from single form submission
- Team login with role selection, approval status check, and role-specific JWT
- Admin login, team approval/rejection, admin seed bootstrap, and approved teams list
- FastAPI app with CORS middleware, lifespan context, request logging, and all routers mounted

## Task Commits

Each task was committed atomically:

1. **Task 1: Create JWT utility module and auth API endpoints** - `dac2489` (feat)
2. **Task 2: Admin auth, team management endpoints, and FastAPI app wiring** - `a08a017` (feat)

## Files Created/Modified
- `server/app/auth_utils.py` - JWT creation, verification, FastAPI dependencies (get_current_user, require_admin, require_team)
- `server/app/api/auth.py` - POST /register, POST /login, GET /me endpoints with Pydantic validation
- `server/app/api/admin.py` - POST /login, POST /seed, GET /teams, POST /teams/{id}/approve, POST /teams/{id}/reject
- `server/app/api/teams.py` - GET /approved (list ready/active teams for lobby)
- `server/app/main.py` - FastAPI app with CORS, lifespan, request logging middleware, routers
- `server/app/__init__.py` - Package init
- `server/app/api/__init__.py` - API package init

## Decisions Made
- JWT subject_id is team.id for both strategist and trader (not a separate user ID) -- simplifies token validation since we don't have a separate User table
- Admin seed endpoint only works when zero admins exist, preventing privilege escalation (T-03-02)
- Same email/password for both strategist and trader initially -- teams can change later
- CORS allow_origins=["*"] accepted risk for competition app (T-03-05)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added JWT_SECRET validation**
- **Found during:** Task 1 (auth_utils.py creation)
- **Issue:** Plan code didn't validate JWT_SECRET is set; empty string would silently create weak tokens
- **Fix:** Added check in create_access_token and decode_token that raises if JWT_SECRET is empty
- **Files modified:** server/app/auth_utils.py
- **Verification:** Functions raise ValueError/HTTPException when JWT_SECRET is empty
- **Committed in:** dac2489 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added missing claims validation in get_current_user**
- **Found during:** Task 1 (auth_utils.py creation)
- **Issue:** Plan code didn't validate that role and sub claims exist in decoded token
- **Fix:** Added null check for role and subject_id with proper 401 response
- **Files modified:** server/app/auth_utils.py
- **Verification:** get_current_user raises 401 if token has missing claims
- **Committed in:** dac2489 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 missing critical)
**Impact on plan:** Both auto-fixes necessary for security. No scope creep.

## Issues Encountered
- Python environment: system Python 3.14 had no pip and uv had dependency resolution conflict (redis 7.x vs kombu). Created temporary venv with Python 3.12 via uv for import verification. Pre-existing issue, not caused by this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Auth foundation complete for frontend integration (Plan 04 can wire login/register pages)
- JWT tokens ready for WebSocket auth in Phase 2
- Admin endpoints ready for admin panel UI

---
*Phase: 01-foundation-auth-and-base-ui*
*Completed: 2026-04-16*
