---
phase: 08-decision-levers-and-round-structure
plan: 04
subsystem: admin-phase-controls
tags: [war-room, live-floor, admin-ui, game-phase, websocket]
dependency_graph:
  requires: [08-03]
  provides: [admin-war-room-button, admin-live-floor-button, phase-badge]
  affects: [admin/page.tsx, api.ts]
tech_stack:
  added: []
  patterns: [modal-form-before-action, phase-badge-display, ws-phase-sync]
key_files:
  created: []
  modified:
    - client/src/app/admin/page.tsx
    - client/src/lib/api.ts
decisions:
  - Macro brief modal uses inline textarea rather than separate page for quick admin flow
  - Phase badge shown in both PHASE_CONTROL section and GAME_STATE_MONITOR status row
  - War Room button disabled when already in war_room; Live Floor button disabled when already in live_floor
metrics:
  duration: 223s
  completed: "2026-04-16T18:21:52Z"
  tasks_completed: 1
  tasks_total: 2
---

# Phase 8 Plan 04: Admin War Room/Live Floor Controls Summary

Admin controls for War Room and Live Floor phase transitions with macro brief modal and real-time phase badge display.

## Completed Tasks

| Task | Name                                                                     | Commit  | Files                                                |
| ---- | ------------------------------------------------------------------------ | ------- | ---------------------------------------------------- |
| 1    | Admin War Room/Live Floor buttons + game page wiring + WebSocket handler | d27b94c | client/src/app/admin/page.tsx, client/src/lib/api.ts |

## Task Details

### Task 1: Admin War Room/Live Floor buttons + game page wiring + WebSocket handler

Added to admin dashboard (client/src/app/admin/page.tsx):

- "ENTER WAR ROOM" button (amber border, monospace) that opens a modal for macro brief text entry before POSTing to /api/v1/admin/game/war-room
- "OPEN LIVE FLOOR" button (green border, monospace) that POSTs to /api/v1/admin/game/live-floor
- Phase badge (WAR ROOM in amber, LIVE FLOOR in green) shown next to game status and in phase control section
- Both buttons disabled when game is already in that phase
- Phase controls section only visible when game status is ACTIVE
- WebSocket handler for game_phase_changed updates local phase state in real-time
- Game phase fetched on admin mount via api.getGamePhase()

Added to API client (client/src/lib/api.ts):

- enterWarRoom(macroBrief: string) method
- openLiveFloor() method

Game page wiring (WarRoomPanel, DecisionsPanel, WebSocket handler) was already completed in 08-03. No additional changes needed.

### Task 2: End-to-end Phase 8 verification -- DEFERRED TO ORCHESTRATOR

This is a checkpoint:human-verify task requiring manual end-to-end testing of the full Phase 8 flow (start game, enter war room, submit operating plan, open live floor, submit decisions, verify budget validation, etc.). Deferred to orchestrator for human verification.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree based on ancient commit**

- **Found during:** Pre-execution analysis
- **Issue:** Worktree base commit 4d3098ba lacked all Phase 3-8 infrastructure (Zustand stores, game components)
- **Fix:** Merged code-revamp-lowkey branch into worktree to get current codebase
- **Files modified:** (merge commit)

**2. [Rule 3 - Blocking] Missing API client methods**

- **Found during:** Task 1
- **Issue:** enterWarRoom() and openLiveFloor() not in API client despite backend endpoints existing
- **Fix:** Added both methods to ApiClient class
- **Files modified:** client/src/lib/api.ts

## Known Stubs

None -- all functionality is wired to real API endpoints.

## Self-Check: PASSED
