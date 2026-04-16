---
phase: quick
plan: 03
subsystem: frontend-pages
tags: [restyle, stitch, admin, lobby, game, terminal-ui]
dependency_graph:
  requires: [quick-01]
  provides: [admin-stitch-layout, lobby-stitch-layout, game-shell-stitch-layout]
  affects: [client/src/app/admin/page.tsx, client/src/app/lobby/page.tsx, client/src/app/game/page.tsx, client/src/components/lobby/team-list.tsx, client/src/components/lobby/connection-indicator.tsx]
tech_stack:
  added: []
  patterns: [stitch-terminal-blue, mono-font-labels, grid-layout, square-dot-indicators]
key_files:
  created: []
  modified:
    - client/src/app/admin/page.tsx
    - client/src/app/lobby/page.tsx
    - client/src/app/game/page.tsx
    - client/src/components/lobby/team-list.tsx
    - client/src/components/lobby/connection-indicator.tsx
decisions:
  - Used Stitch color palette directly (#2196f3, #40e56c, #9ecaff, #FF1744, #131313, #1c1b1b, #0e0e0e) instead of CSS variables for page-specific styling
  - Broadcast textarea disabled with COMING_SOON label as placeholder for future feature
  - Network latency hardcoded to 14MS as decorative element matching Stitch reference
metrics:
  duration: 227s
  completed: 2026-04-16T05:19:46Z
  tasks_completed: 3
  tasks_total: 3
  files_modified: 5
---

# Quick Plan 03: Restyle Admin, Lobby, and Game Pages Summary

Restyled three core operational pages (admin, lobby, game) plus two lobby components to match Stitch "Complex Terminal Blue" design, preserving all existing business logic, WebSocket integration, auth guards, and API calls.

## Task Completion

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Restyle admin page to Stitch GAME_CONTROL_STATION design | 554e79e | START/PAUSE/RESUME 3-col grid, broadcast textarea, large timer, status monitor |
| 2 | Restyle lobby page and components to Stitch terminal design | 3bf0561 | Hero section, team count/latency cards, roster table, connection indicator |
| 3 | Restyle game shell page to Stitch terminal layout | 5ed493b | Terminal header with team/ticker, LIVE indicator, module placeholders |

## Changes Made

### Admin Page (client/src/app/admin/page.tsx)
- Fixed top header with COMPLEX/ADMIN branding and UTC time
- GAME_CONTROL_STATION panel with START/PAUSE/RESUME buttons in 3-column grid
- Broadcast message textarea (disabled, COMING_SOON placeholder)
- GAME_STATE_MONITOR panel with status badge, large timer (6xl), quarter display
- Status colors: green (ACTIVE), blue (PAUSED), red (FINISHED), gray (SETUP)
- All handlers (handleStart, handlePause, handleResume), WebSocket, auth guards preserved

### Lobby Page (client/src/app/lobby/page.tsx)
- Fixed header with team name, ticker, and LOGOUT button
- Hero section: COMPLEX title (7xl italic), ticker badge, animated pulse indicator
- Stats cards: Total Approved Teams (count) and Network Latency (14MS decorative)
- Full-width Verified Competition Roster table via TeamList component
- All WebSocket message handling, team loading, game_started redirect preserved

### Team List (client/src/components/lobby/team-list.tsx)
- Converted from row-based animation layout to Stitch-styled table
- Columns: Rank (zero-padded), Team Entity Name, Ticker ID, Auth Status
- Added optional `currentTicker` prop for highlighting current team row
- Empty state: NO_TEAMS_REGISTERED in mono uppercase

### Connection Indicator (client/src/components/lobby/connection-indicator.tsx)
- Simplified to inline square dot indicator (not rounded)
- Green (#40e56c) for connected, red (#FF1744) for disconnected
- Text: "Connection stable" / "Disconnected"

### Game Page (client/src/app/game/page.tsx)
- Terminal header: team/ticker info columns, LIVE // Q{n} badge with animated ping
- Elapsed timer and status badge in header bar
- Pause overlay restyled with blue accent (#9ecaff) instead of amber
- Module placeholder cards: STRATEGY_EDITOR (active blue), MARKET_CHARTS, INTEL_STREAM (gray)
- All WebSocket, auth guards, SETUP redirect preserved

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

| File | Location | Stub | Reason |
|------|----------|------|--------|
| client/src/app/admin/page.tsx | Broadcast textarea | Disabled with COMING_SOON | Broadcast feature not yet implemented, placeholder per plan |
| client/src/app/lobby/page.tsx | Network Latency card | Hardcoded 14MS | Decorative element matching Stitch reference, real latency tracking not in scope |
| client/src/app/game/page.tsx | Main content | Module placeholders | Trading interface planned for Phase 3 |

## Build Status

Pre-existing type error in `use-websocket.ts` (line 27: `useRef` requires argument in strict mode). This error exists on the base commit and is unrelated to this plan's changes. No regressions introduced.

## Self-Check: PASSED
