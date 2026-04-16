---
phase: 06-news-elimination-and-polish
plan: 02
subsystem: api
tags: [fastapi, crisis-events, elimination, leaderboard, celery, websocket]

requires:
  - phase: 06-01
    provides: CrisisEvent model, SolutionType.CRISIS_RESPONSE enum, generate_news Celery task
provides:
  - Crisis inject endpoint with auto-pause and broadcast
  - Team elimination endpoint with stock_price=0 and broadcast
  - Leaderboard endpoint sorted by stock_price
  - News generation dispatch on evaluation approval
  - Elimination guards on trading and solutions endpoints
  - Crisis response solution type with cooldown bypass
affects: [06-03, 06-04]

tech-stack:
  added: []
  patterns:
    - "Crisis flow: inject -> auto-pause -> crisis_started broadcast -> resume -> RESOLVED"
    - "Elimination guard pattern: check TeamStatus.ELIMINATED before allowing actions"
    - "Leaderboard ranking: ORDER BY stock_price DESC with eliminated teams at bottom"

key-files:
  created: []
  modified:
    - server/app/api/admin.py
    - server/app/api/market.py
    - server/app/api/trading.py
    - server/app/api/solutions.py

key-decisions:
  - "T-06-09: Only one active crisis at a time -- reject inject if active crisis exists"
  - "Crisis responses allowed during PAUSED game state (D-04 step 5)"
  - "Leaderboard is a public endpoint (no auth required) per D-11"

patterns-established:
  - "Crisis inject auto-pauses via transition_state(PAUSED), resume resolves active crisis"
  - "Elimination uses SELECT FOR UPDATE to prevent race conditions on rank computation"

requirements-completed: [NEWS-04, ELIM-01, ELIM-02, ELIM-03, UI-04]

duration: 5min
completed: 2026-04-16
---

# Phase 6 Plan 2: Admin Crisis/Elimination/Leaderboard Endpoints Summary

**Crisis inject with auto-pause, team elimination with stock_price=0 broadcast, leaderboard ranking, elimination guards on trading/solutions, and news generation dispatch on evaluation approval**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-16T06:18:10Z
- **Completed:** 2026-04-16T06:23:12Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Crisis inject endpoint creates CrisisEvent, auto-pauses game, broadcasts crisis_started; resume resolves it
- Eliminate team endpoint sets stock_price=0, status=ELIMINATED, computes rank, broadcasts team_eliminated
- Leaderboard endpoint returns teams sorted by stock_price with change_pct from PriceHistory
- Evaluation approval dispatches generate_news Celery task for LLM news generation
- Trading endpoints reject eliminated teams (403) and eliminated company stock (409)
- Solutions endpoint rejects eliminated teams (403), supports CRISIS_RESPONSE type with cooldown bypass

## Task Commits

Each task was committed atomically:

1. **Task 1: Admin crisis/elimination/leaderboard endpoints + approval news dispatch** - `e65baa9` (feat)
2. **Task 2: Backend guards -- eliminated teams blocked from trading and submissions** - `39de542` (feat)

## Files Created/Modified
- `server/app/api/admin.py` - Added inject_crisis, eliminate_team endpoints; extended resume_game for crisis resolve; wired generate_news.delay into approve_evaluation
- `server/app/api/market.py` - Added get_leaderboard endpoint with LeaderboardEntry model
- `server/app/api/trading.py` - Added elimination guards on buy/sell endpoints
- `server/app/api/solutions.py` - Added elimination guard on submit, CRISIS_RESPONSE solution type with cooldown bypass

## Decisions Made
- T-06-09: Only one active crisis at a time -- reject if active crisis exists (409)
- Crisis responses allowed during PAUSED game state since D-04 step 5 requires teams to submit during crisis
- Leaderboard is public (no auth) per D-11 for spectator/audience visibility
- Elimination rank computed as count of teams with higher stock_price + 1 at time of elimination

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All backend endpoints for crisis, elimination, and leaderboard are ready
- Frontend components (06-03, 06-04) can now integrate with these endpoints
- generate_news.delay wired -- news will be generated on evaluation approval

---
*Phase: 06-news-elimination-and-polish*
*Completed: 2026-04-16*
