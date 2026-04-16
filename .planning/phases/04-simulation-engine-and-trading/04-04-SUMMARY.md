---
phase: 04-simulation-engine-and-trading
plan: 04
subsystem: frontend-chart
tags: [lightweight-charts, candlestick, trading-ui, zustand]
dependency_graph:
  requires: [04-01]
  provides: [CandlestickChart, CompanyTabs, PriceOverlay, market-store]
  affects: [game-view-layout, trading-ui]
tech_stack:
  added: [lightweight-charts@5.1.0]
  patterns: [imperative-chart-via-refs, resize-observer, zustand-market-store]
key_files:
  created:
    - client/src/components/game/CandlestickChart.tsx
    - client/src/components/game/CompanyTabs.tsx
    - client/src/components/game/PriceOverlay.tsx
    - client/src/stores/market-store.ts
  modified:
    - client/src/lib/types.ts
    - client/src/components/game/index.ts
    - client/src/components/game/LeftSidebar.tsx
    - client/package.json
    - client/package-lock.json
decisions:
  - "Created market-store as blocking dependency (04-03 runs in parallel)"
  - "Used ResizeObserver instead of window resize event for responsive chart"
  - "O(1) streaming via series.update() with company-switch detection via first candle time"
metrics:
  duration: 305s
  completed: 2026-04-16
  tasks_completed: 2
  tasks_total: 2
  files_changed: 9
---

# Phase 04 Plan 04: Candlestick Chart Components Summary

Candlestick chart with lightweight-charts 5.1 via imperative refs, company selector tabs, and price overlay with session high/low -- Bloomberg dark terminal aesthetic.

## Task Results

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | CandlestickChart with lightweight-charts 5.1 | caad260 | CandlestickChart.tsx, types.ts, market-store.ts, package.json, LeftSidebar.tsx |
| 2 | CompanyTabs and PriceOverlay | ff1061c | CompanyTabs.tsx, PriceOverlay.tsx, index.ts |

## Implementation Details

### CandlestickChart.tsx
- Uses `createChart` + `addSeries(CandlestickSeries)` per lightweight-charts v5 API
- Chart created once in mount useEffect, data updates in separate useEffect
- O(1) streaming: detects single-candle updates vs company switches via `prevFirstTimeRef`
- `series.update(lastCandle)` for streaming, `series.setData()` + `fitContent()` for full reloads
- ResizeObserver on container div for responsive sizing
- Cleanup: `chart.remove()` + `observer.disconnect()` in useEffect return
- Colors: `#40e56c` (success/up), `#FF1744` (destructive/down), `#0e0e0e` background

### CompanyTabs.tsx
- Reads companies from `useMarketStore` -- no props needed
- Horizontal scrollable tab bar with ticker, mini price, change % per company
- Active: `bg-[#2196f3]/10 text-[#2196f3] border-b-2 border-[#2196f3]`
- Inactive: `text-[#89919d] hover:bg-[#2a2a2a]`
- 36px height, JetBrains Mono via `font-mono`

### PriceOverlay.tsx
- Reads selectedCompanyId, currentPrices, candles from `useMarketStore`
- Shows: ticker/USD label, current price (large), change %, session high/low
- Session high/low calculated via useMemo over all candles
- `drop-shadow` for readability over chart background
- Graceful `--` placeholders when no data available

### market-store.ts (Rule 3 deviation)
- Created as blocking dependency since 04-03 runs in parallel
- Zustand store with: companies, selectedCompanyId, candles, currentPrices
- Actions: selectCompany, setCompanies, setCandles, addCandle, updateCurrentPrice
- Auto-selects first company when companies are set and none selected

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created market-store.ts**
- **Found during:** Task 1
- **Issue:** Plan references `useMarketStore` from `client/src/stores/market-store.ts` (expected from plan 04-03), but 04-03 runs in parallel and hasn't created it yet
- **Fix:** Created minimal market-store with CandleData, CompanyInfo types and Zustand store matching the interface spec from the plan
- **Files created:** client/src/stores/market-store.ts
- **Commit:** caad260

**2. [Rule 1 - Bug] Fixed LeftSidebar CandlestickChart prop mismatch**
- **Found during:** Task 1
- **Issue:** LeftSidebar.tsx used old `ticker` prop on CandlestickChart; new component uses `data` prop
- **Fix:** Changed to `data={[]}` -- sidebar mini-charts will be wired to market-store when game layout is finalized
- **Files modified:** client/src/components/game/LeftSidebar.tsx
- **Commit:** caad260

**3. [Rule 3 - Blocking] Installed lightweight-charts package**
- **Found during:** Task 1
- **Issue:** lightweight-charts was specified in CLAUDE.md tech stack but not yet installed in package.json
- **Fix:** `npm install lightweight-charts@5.1.0`
- **Files modified:** client/package.json, client/package-lock.json
- **Commit:** caad260

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| `data={[]}` in LeftSidebar mini-charts | client/src/components/game/LeftSidebar.tsx | 212, 287 | Sidebar mini-charts need market-store wiring; will be resolved when game layout plan integrates all components |

## Verification

- TypeScript compiles with no errors in plan files
- All acceptance criteria grep checks pass (7/7 for Task 1, 6/6 for Task 2)
- All three components exported from game/index.ts
