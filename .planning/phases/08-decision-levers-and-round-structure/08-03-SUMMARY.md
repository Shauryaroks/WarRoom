---
phase: 08-decision-levers-and-round-structure
plan: 03
subsystem: frontend-decisions
tags: [decisions, war-room, live-floor, budget, lever-ui, frontend]
dependency_graph:
  requires: [08-02]
  provides: [decisions-panel, war-room-panel, decisions-store, game-phase-ws]
  affects: [game-store.ts, GameSidebar.tsx, game/page.tsx, types.ts, api.ts]
tech_stack:
  added: []
  patterns: [collapsible-lever-sections, real-time-budget-bar, locked-decisions-view]
key_files:
  created:
    - client/src/components/game/DecisionsPanel.tsx
    - client/src/components/game/WarRoomPanel.tsx
    - client/src/stores/decisions-store.ts
  modified:
    - client/src/lib/types.ts
    - client/src/lib/api.ts
    - client/src/stores/game-store.ts
    - client/src/components/game/GameSidebar.tsx
    - client/src/components/game/index.ts
    - client/src/app/game/page.tsx
decisions:
  - Marketing budget cost uses 30% of total budget rate matching server calculation
  - War Room phase overrides sidebar content entirely rather than adding a new tab
  - Submitted decisions show locked view with option to modify and resubmit
metrics:
  duration: 305s
  completed: 2026-04-16
---

# Phase 8 Plan 03: Frontend Decision Levers & War Room UI Summary

Five-category decision lever panel with Bloomberg-style budget bar, collapsible lever sections (sliders, dropdowns, checkboxes, toggles), War Room panel with macro brief and operating plan, game_phase WebSocket handling.

## Commits

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Types, API client, stores | 3579d86 | Phase 8 types, API methods, game store gamePhase, decisions-store |
| 2 | DecisionsPanel, WarRoomPanel, Sidebar update | 22ded33 | DecisionsPanel with 5 lever sections, WarRoomPanel, DECISIONS tab, WS handler |

## What Was Built

### Task 1: Types, API Client, Stores
- **Phase 8 types**: GamePhase, LeverCategory, PricingDecision, MarketingDecision, SupplyChainDecision, NewProductDecision, BulkDecisionSubmitRequest, DecisionResponse, BudgetResponse, GamePhaseResponse, OperatingPlanResponse, GamePhaseChangedPayload
- **API client methods**: submitDecisions, getCurrentDecisions, submitOperatingPlan, getOperatingPlan, getGamePhase, getBudget
- **Game store extensions**: gamePhase (GamePhase), macroBrief (string | null), setGamePhase action, reset includes new fields
- **Decisions store**: budget, currentDecisions, isSubmitting, lastSubmittedAt with setters and reset

### Task 2: DecisionsPanel, WarRoomPanel, Sidebar
- **DECISIONS tab** in GameSidebar: visible to strategist only, Sliders icon, placed after SOLUTIONS
- **DecisionsPanel**: 5 collapsible lever sections
  - PRICING: slider for list price change (-15 to +15%), slider for promo depth (0-40%), dropdown for channel pricing (GT/MT/QCom/D2C)
  - MARKETING: 4 number inputs for ATL/Digital/Influencer/BTL percentages with sum-to-100 validation, dropdown for campaign theme
  - SUPPLY_CHAIN: radio buttons for inventory policy (Lean/Balanced/Stocked), checkboxes for distribution expansion with per-tier costs, slider for capacity utilization (60-100%)
  - NEW_PRODUCT: toggle for launch SKU with conditional text input and dropdown, Rs 10 Cr R&D cost
  - TRADING: info card pointing to TRADING panel
- **Budget bar**: OPERATING_BUDGET / ALLOCATED / REMAINING with green/red color coding, BUDGET_EXCEEDED warning blocks submit
- **Locked decisions view**: after submission shows read-only summary with DECISIONS_LOCKED badge and MODIFY_DECISIONS button
- **WarRoomPanel**: amber WAR ROOM badge, performance review section (round number, placeholder for Phase 9 metrics), macro brief display from game store, operating plan textarea with submit for strategist
- **WebSocket**: game_phase_changed handler updates gamePhase and macroBrief in game store
- **Game page**: War Room phase overrides sidebar content with WarRoomPanel; DECISIONS tab renders DecisionsPanel during Live Floor

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

- WarRoomPanel performance review section shows current round only; detailed metrics (revenue, margin, market share vs benchmark) deferred to Phase 9 as noted in plan D-03

## Self-Check: PASSED
