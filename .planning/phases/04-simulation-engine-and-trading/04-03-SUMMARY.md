---
phase: 04-simulation-engine-and-trading
plan: 03
subsystem: frontend-data-layer
tags: [zustand, typescript, market, trading, candle-aggregation]
dependency_graph:
  requires: [04-01, 04-02]
  provides: [useMarketStore, useTradingStore, market-types, trading-api-methods]
  affects: [client/src/lib/types.ts, client/src/lib/api.ts]
tech_stack:
  added: []
  patterns: [zustand-ephemeral-store, 5-min-candle-aggregation, trade-confirmation-flow]
key_files:
  created:
    - client/src/stores/market-store.ts
    - client/src/stores/trading-store.ts
  modified:
    - client/src/lib/types.ts
    - client/src/lib/api.ts
decisions:
  - "Stores are ephemeral (no persist middleware) since market/trading data is session-scoped"
  - "Candle aggregation uses 300-second buckets client-side per D-10"
  - "PendingTrade type extracted as named interface for reuse"
metrics:
  duration: 137s
  completed: 2026-04-16
---

# Phase 4 Plan 3: Frontend Data Layer (Market & Trading) Summary

TypeScript types for all market/trading WebSocket and REST shapes, Zustand stores for market data with 5-minute OHLC candle aggregation, trading state with portfolio and confirmation flow, and API client methods for all trading/market endpoints.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add market/trading TypeScript types and API client methods | 401b33a | types.ts, api.ts |
| 2 | Create market-store and trading-store with candle aggregation | 9f77cdc | market-store.ts, trading-store.ts |

## Implementation Details

### Types (types.ts)
- **WebSocket messages:** PriceUpdateMessage (price_update), TradeExecutedMessage (trade_executed)
- **Candle data:** CandleData with Unix-second time for lightweight-charts compatibility
- **REST types:** CompanyInfo, PriceHistoryPoint, TradePreviewRequest, TradePreview, TradeRequest, TradeResult, HoldingDetail, PortfolioResponse

### API Client (api.ts)
- getCompanies(), getPriceHistory(teamId, limit)
- previewTrade(data), buyShares(data), sellShares(data), getPortfolio()

### Market Store (market-store.ts)
- Companies list and selected company tracking
- Raw price ticks per team with handlePriceUpdate from WebSocket
- aggregateToCandles: groups ticks into 300-second (5-min) OHLC buckets per D-10
- loadPriceHistory for REST backfill on initial load / reconnect
- Current prices (latest tick per team)

### Trading Store (trading-store.ts)
- Portfolio state: cash, holdings, totalHoldingsValue, netWorth
- Trade confirmation flow per D-06: pendingTrade holds preview data before CONFIRM
- Loading states: isLoadingPortfolio, isExecutingTrade
- Trade error tracking for UI display
- updateCashBalance for optimistic post-trade updates

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED
