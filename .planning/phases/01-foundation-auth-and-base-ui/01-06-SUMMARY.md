---
phase: 01-foundation-auth-and-base-ui
plan: 06
subsystem: frontend-auth-lobby
tags: [zustand, websocket, lobby, auth-persistence, protected-routes]
dependency_graph:
  requires: [01-04]
  provides: [auth-store, websocket-hook, lobby-page]
  affects: [client/src/app/auth/login/page.tsx, client/src/app/admin/login/page.tsx]
tech_stack:
  added: [zustand-persist-middleware]
  patterns: [zustand-store, websocket-hook, protected-route-redirect]
key_files:
  created:
    - client/src/stores/auth-store.ts
    - client/src/hooks/use-websocket.ts
    - client/src/components/lobby/team-list.tsx
    - client/src/components/lobby/connection-indicator.tsx
  modified:
    - client/src/app/lobby/page.tsx
    - client/src/app/auth/login/page.tsx
    - client/src/app/admin/login/page.tsx
decisions:
  - "Used Zustand persist middleware with localStorage for session persistence across refresh"
  - "WebSocket auth via first-message JWT handshake (not query param) for security"
  - "Exponential backoff with jitter for reconnection (max 30s delay, 10 attempts)"
  - "Client-side ping every 25s to keep connection alive within 30s server timeout"
metrics:
  duration: 194s
  completed: 2026-04-16
  tasks_completed: 2
  tasks_total: 3
  files_created: 4
  files_modified: 3
requirements_completed: [AUTH-06, UI-01]
---

# Phase 01 Plan 06: Zustand Auth Store, WebSocket Hook, and Lobby Page Summary

Zustand auth store with persist middleware for cross-refresh session persistence, WebSocket hook with JWT auth handshake and exponential backoff reconnection, and lobby page per UI-SPEC with team identity, pulsing WAITING badge, approved teams list (API + WebSocket driven), and connection indicator.

## Task Completion

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Create Zustand auth store and WebSocket hook | 7bf9c75 | Complete |
| 2 | Build lobby page and integrate auth store into auth pages | 377c42d | Complete |
| 3 | Verify end-to-end auth flow and lobby UI | -- | Deferred to orchestrator (checkpoint:human-verify in worktree) |

## Key Implementation Details

### Zustand Auth Store (`auth-store.ts`)
- Persists token, teamId, teamName, ticker, role, isAuthenticated to localStorage under key `complex-auth`
- `login()` action stores full team response from API
- `adminLogin()` action stores token with role="admin"
- `logout()` clears all state and removes token from localStorage
- Dual storage: Zustand persist + explicit localStorage.setItem for API client compatibility

### WebSocket Hook (`use-websocket.ts`)
- Connects to `WS_BASE/ws` with JWT auth as first message (`{type: "auth", token}`)
- Exponential backoff: 1s base, 2x multiplier, 30s max, random jitter, 10 max attempts
- Auth error codes 4001-4003 prevent reconnection (invalid token, not approved, etc.)
- Client-side ping every 25s, responds to server-initiated pings with pong
- `onMessage` callback ref pattern avoids stale closures

### Lobby Page
- Protected route: redirects to `/auth/login` if not authenticated
- Team identity from Zustand store (teamName + ticker)
- Pulsing amber WAITING badge with CSS animate-pulse
- Teams list populated on mount via `api.getApprovedTeams()` + WebSocket `team_approved` events
- Duplicate prevention on team list updates
- Game starting handler: redirects to `/game` after 1s delay
- Logout button top-right, clears store and redirects

### Auth Page Integration
- Login page: uses `useAuthStore.login(response)` instead of direct localStorage
- Login page: redirects to `/lobby` if already authenticated on mount
- Admin login page: uses `useAuthStore.getState().adminLogin(response.token)`

## Deviations from Plan

None -- plan executed exactly as written.

## Checkpoint: Task 3 (Human Verification)

**Status:** Deferred to orchestrator for post-merge verification.

Task 3 is a `checkpoint:human-verify` requiring full end-to-end testing (backend + frontend running together). Since this plan executes in a worktree, the checkpoint is deferred. The orchestrator will handle verification after merge.

**Verification steps documented in plan:** Register team, approve via admin API, login, verify lobby renders with team identity + connection indicator + teams list, verify session persistence across refresh, verify logout flow.

## Self-Check: PASSED
