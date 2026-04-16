---
phase: 03-admin-portal
plan: "02"
subsystem: admin-portal
tags: [admin, layout, sidebar, navigation, zustand, api-client]
dependency_graph:
  requires: [auth-store, game-store, api-client, types]
  provides: [admin-layout, admin-sidebar, admin-topnav, admin-store, admin-api-methods]
  affects: [admin-page, admin-login]
tech_stack:
  added: [lucide-react-icons]
  patterns: [zustand-ephemeral-store, next-layout-route-protection, sidebar-nav-with-active-state]
key_files:
  created:
    - client/src/stores/admin-store.ts
    - client/src/components/admin/admin-sidebar.tsx
    - client/src/components/admin/admin-topnav.tsx
    - client/src/app/admin/layout.tsx
    - client/src/app/admin/teams/page.tsx
    - client/src/app/admin/evaluations/page.tsx
    - client/src/app/admin/markets/page.tsx
    - client/src/app/admin/news/page.tsx
    - client/src/app/admin/settings/page.tsx
    - client/src/app/admin/activity/page.tsx
  modified:
    - client/src/lib/types.ts
    - client/src/lib/api.ts
    - client/src/app/admin/page.tsx
decisions:
  - "Admin layout uses pathname check to skip shell on /admin/login"
  - "Sidebar uses exact match for /admin dashboard, startsWith for other tabs"
  - "Admin store is ephemeral (no persist middleware) — reloads on page visit"
  - "D-08 scale applied: text-[13px] labels, py-5 buttons, text-7xl timer, size-22 icons"
metrics:
  duration: "196s"
  completed: "2026-04-16T05:59:26Z"
---

# Phase 3 Plan 02: Admin Portal Shell Summary

Admin layout with 7-tab sidebar navigation, topnav with UTC clock, Zustand admin store, and 9 new API client methods for team/news/activity/round management.

## Completed Tasks

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Admin store, types, and API client extensions | 37e58de | admin-store.ts, types.ts, api.ts |
| 2 | Admin layout shell with sidebar and topnav | 4e73b48 | layout.tsx, admin-sidebar.tsx, admin-topnav.tsx, page.tsx, 6 placeholder pages |

## Implementation Details

### Task 1: Admin store, types, and API client extensions
- Added 7 new TypeScript interfaces: AdminTeam, NewsItem, ActivityEvent, TeamRemoveResponse, NewsInjectResponse, BroadcastResponse, RoundAdvanceResponse
- Created Zustand admin-store (ephemeral, no persist) with teams/news/activityLog state and granular setters (updateTeamStatus, removeTeam, addNews, addActivity with 200-item cap)
- Extended ApiClient with 9 methods: getTeams, approveTeam, rejectTeam, removeTeam, injectNews, getNewsHistory, broadcast, getActivityLog, advanceRound

### Task 2: Admin layout shell with sidebar and topnav
- Created AdminSidebar: 80px fixed left sidebar, 7 nav items with lucide-react icons, active state with #2196f3 accent and left border, logout button at bottom
- Created AdminTopNav: fixed h-14 top bar with COMPLEX brand, ADMIN label with underline, live UTC clock, green status dot
- Created AdminLayout: wraps all /admin routes with sidebar+topnav, skips shell for /admin/login
- Refactored admin/page.tsx: removed header and outer wrapper (now in layout), kept game controls, applied D-08 scale (larger text, padding, timer)
- Created 6 placeholder pages for remaining tabs

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- TypeScript compilation: PASS (only pre-existing errors in .next/types/validator.ts and use-websocket.ts, unrelated to this plan)
- All 7 sidebar nav links point to correct routes
- /admin/login pathname check skips layout shell
- All acceptance criteria met

## Self-Check: PASSED

All 10 created files verified on disk. Both commit hashes (37e58de, 4e73b48) found in git log.
