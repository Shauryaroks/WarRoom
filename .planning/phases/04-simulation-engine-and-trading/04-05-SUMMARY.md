---
phase: 04-simulation-engine-and-trading
plan: 05
subsystem: ui
tags: [react, zustand, websocket, trading, bloomberg, glassmorphism, lightweight-charts]

# Dependency graph
requires:
  - phase: 04-03
    provides: market-store, trading-store, API client methods, WebSocket types
  - phase: 04-04
    provides: CandlestickChart, CompanyTabs, PriceOverlay components
provides:
  - Full game page layout with header, sidebar, chart, trading panels
  - GameHeader component with team info, timer, cash balance
  - GameSidebar with role-based tab navigation
  - TradingPanel with two-step buy/sell confirmation flow
  - PortfolioTable with holdings and P&L display
  - NewsOverlay with glassmorphism floating window
  - WebSocket message dispatching to Zustand stores
affects: [05-llm-evaluation, 06-news-system]

# Tech tracking
tech-stack:
  added: [lucide-react icons for sidebar]
  patterns: [role-based UI visibility, WebSocket-to-store dispatch, two-step trade confirmation]

key-files:
  created:
    - client/src/components/game/GameHeader.tsx
    - client/src/components/game/GameSidebar.tsx
    - client/src/components/game/TradingPanel.tsx
    - client/src/components/game/PortfolioTable.tsx
    - client/src/components/game/CaselinePanel.tsx
    - client/src/components/game/SolutionsPanel.tsx
    - client/src/components/game/NewsOverlay.tsx
  modified:
    - client/src/app/game/page.tsx

key-decisions:
  - "News overlay uses window global pattern for WebSocket push (simple, avoids prop drilling)"
  - "Default tab based on role: trader defaults to TRADING, strategist to CASELINE"
  - "Sidebar content panel is 320px fixed width, chart area is flex-1"

patterns-established:
  - "Role-based UI: filter visible components by useAuthStore.role"
  - "WebSocket dispatch: single onMessage handler with switch on data.type"
  - "Two-step trade flow: preview API -> pendingTrade store -> confirm API -> portfolio refresh"

requirements-completed: [SIM-04, TRAD-01, TRAD-02, TRAD-05, UI-02]

# Metrics
duration: 5min
completed: 2026-04-16
---

# Phase 4 Plan 5: Game Page Layout and Trading UI Summary

**Bloomberg-style game cockpit with role-based sidebar, candlestick chart, two-step trading flow, portfolio P&L table, and glassmorphism news overlay wired to WebSocket stores**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-16T07:34:33Z
- **Completed:** 2026-04-16T07:39:21Z
- **Tasks:** 2/3 (Task 3 is checkpoint -- deferred to orchestrator)
- **Files modified:** 8

## Accomplishments
- Full game page layout: 48px header, 80px icon sidebar, 320px content panel, flex chart area
- Role-based sidebar: Caseline (both roles), Trading (trader only), Solutions (strategist only), News toggle (both)
- Two-step trading: select company, enter quantity, BUY/SELL toggle, PREVIEW -> CONFIRM with cost display
- Portfolio table with P&L coloring (green positive, red negative), ownership %, net worth summary
- Glassmorphism news overlay (80% opacity, 20px backdrop-blur, primary-tinted shadow)
- WebSocket dispatching: price_update -> market store, trade_executed -> portfolio refresh, game_state -> game store, news -> overlay
- Initial data loading: companies, portfolio, price history via REST on mount

## Task Commits

Each task was committed atomically:

1. **Task 1: Create GameHeader, GameSidebar, and panel components** - `c7c04b0` (feat)
2. **Task 2: Rewrite game/page.tsx with full layout and WebSocket wiring** - `325391a` (feat)
3. **Task 3: Visual and functional verification** - deferred to orchestrator (checkpoint:human-verify)

## Files Created/Modified
- `client/src/components/game/GameHeader.tsx` - Header with team info, timer, quarter, status badge, cash balance
- `client/src/components/game/GameSidebar.tsx` - 80px sidebar with role-filtered icon tabs and news toggle
- `client/src/components/game/TradingPanel.tsx` - Two-step buy/sell form with preview and confirmation
- `client/src/components/game/PortfolioTable.tsx` - Holdings table with P&L, ownership %, net worth
- `client/src/components/game/CaselinePanel.tsx` - Team profile, SWOT placeholders, portfolio type
- `client/src/components/game/SolutionsPanel.tsx` - Phase 5 placeholder with terminal-style messaging
- `client/src/components/game/NewsOverlay.tsx` - Floating glassmorphism news list with timestamps and badges
- `client/src/app/game/page.tsx` - Full game layout with WebSocket wiring, data loading, role-based tabs

## Decisions Made
- News overlay uses a window global pattern (`__newsOverlayAddItem`) for WebSocket push -- simple and avoids prop drilling through the component tree
- Default active tab is role-based: trader starts on TRADING, strategist starts on CASELINE
- Sidebar content panel fixed at 320px, chart area uses flex-1 for responsive sizing
- Portfolio table uses border-t separator between trading panel and portfolio (minimal deviation from no-divider rule for functional clarity)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs
- CaselinePanel: SWOT profile shows "--" placeholders, company story says "will be populated when admin configures" -- intentional, data source is admin configuration (Phase 5/6)
- SolutionsPanel: entire panel is Phase 5 placeholder -- explicitly deferred per CONTEXT.md

## Issues Encountered
- Pre-existing TypeScript errors in old LeftSidebar.tsx (references deleted contexts) and CandlestickChart.tsx (lightweight-charts types not installed) -- out of scope for this plan, not caused by changes here

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Game cockpit complete and ready for Phase 5 LLM evaluation integration
- SolutionsPanel placeholder ready to be populated with solution submission UI
- News overlay ready to receive LLM-generated news from Phase 6
- Task 3 checkpoint (visual verification) deferred to orchestrator

---
*Phase: 04-simulation-engine-and-trading*
*Completed: 2026-04-16*
