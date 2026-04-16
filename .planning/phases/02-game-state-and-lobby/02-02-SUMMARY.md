---
phase: 02-game-state-and-lobby
plan: 02
subsystem: frontend-game-lifecycle
tags: [zustand, websocket, game-state, admin-controls, lobby-redirect]
dependency_graph:
  requires: [02-01]
  provides: [game-store, game-page, admin-controls]
  affects: [lobby-page, types, api-client]
tech_stack:
  added: []
  patterns: [zustand-store-no-persist, server-authoritative-timer, websocket-state-sync]
key_files:
  created:
    - client/src/stores/game-store.ts
    - client/src/app/game/page.tsx
    - client/src/app/admin/page.tsx
  modified:
    - client/src/lib/types.ts
    - client/src/lib/api.ts
    - client/src/app/lobby/page.tsx
decisions:
  - "Game store uses no persist middleware -- state is transient and always received from server"
  - "Timer display is purely server-authoritative per D-07 -- formatElapsed only formats, never computes"
  - "Lobby redirect is instant on game_started per D-08 -- removed setTimeout delay"
metrics:
  duration: 141s
  completed: 2026-04-16T04:09:08Z
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 3
---

# Phase 2 Plan 02: Frontend Game Lifecycle Summary

Zustand game store with server-authoritative timer display, instant lobby-to-game redirect on WebSocket event, and admin start/pause/resume controls with real-time state sync.

## What Was Built

### Game Store (client/src/stores/game-store.ts)
- Zustand store exposing `status`, `elapsedSeconds`, `currentRound`
- `setGameState(payload)` maps snake_case server payload to camelCase store state
- `reset()` returns to SETUP defaults
- No persist middleware -- game state is transient, always from server

### Game Types and API Methods
- Added `GameStatus`, `GameStatePayload`, `GameStateResponse` to types.ts
- Added `startGame()`, `pauseGame()`, `resumeGame()`, `getGameState()` to ApiClient

### Lobby Redirect (client/src/app/lobby/page.tsx)
- Changed event listener from `game_starting` to `game_started` (D-08)
- Removed `setTimeout` delay -- instant `router.push("/game")`
- Also handles `game_state_changed` to update store while in lobby

### Game Page (client/src/app/game/page.tsx)
- Header bar: team name, ticker, quarter display (Q{N}), elapsed timer (HH:MM:SS), status badge
- Status badge color-coded: green=ACTIVE, amber=PAUSED, red=FINISHED
- Full-screen pause overlay when status is PAUSED
- WebSocket handler updates game store on `game_state_changed` and `game_started`
- Auth guard: redirects to /auth/login if unauthenticated, /lobby if SETUP
- Placeholder main content area for Phase 3 trading interface

### Admin Page (client/src/app/admin/page.tsx)
- Game control panel with large elapsed timer display
- Status badge and quarter display
- Conditional buttons: Start (SETUP), Pause (ACTIVE), Resume (PAUSED), Finished label (FINISHED)
- Loading state on buttons during API calls
- Error display for failed transitions (409 conflicts)
- Loads initial state via `api.getGameState()` on mount
- WebSocket handler for real-time state sync
- Auth guard: redirects to /admin/login if not admin role (T-02-07 mitigation)
- Bloomberg dark theme: monospace fonts, sharp borders, data-dense layout

## Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Game types, API methods, and Zustand game store | e1a68dd | types.ts, api.ts, game-store.ts |
| 2 | Lobby redirect, game page, and admin game controls | 1499497 | lobby/page.tsx, game/page.tsx, admin/page.tsx |

## Deviations from Plan

None -- plan executed exactly as written.

## Checkpoint: Task 3 (human-verify)

**Status:** Deferred to orchestrator.

Task 3 is a `checkpoint:human-verify` gate for end-to-end game lifecycle verification (admin starts game, lobby redirects, pause/resume, timer drift check). This checkpoint is deferred because this plan runs in a parallel worktree. The orchestrator will handle verification after merge.

## Known Stubs

| File | Line | Description | Resolution |
|------|------|-------------|------------|
| client/src/app/game/page.tsx | main content | Placeholder text "Trading interface will appear here" | Phase 3 will populate with charts, order book, and portfolio |

## Pre-existing Issues

- `client/src/hooks/use-websocket.ts` lines 27-28: React 19 `useRef` requires initial value argument. Not introduced by this plan -- out of scope.

## Self-Check: PASSED

All 6 files verified on disk. Both commit hashes (e1a68dd, 1499497) found in git log.
