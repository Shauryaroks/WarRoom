# Phase 8: Decision Levers & Round Structure - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Add War Room / Live Floor game phases (admin-controlled transitions), and a 5-category decision lever submission system where teams allocate their budget across Pricing, Marketing, Supply Chain, New Product, and Trading decisions every 20 minutes during Live Floor.

</domain>

<decisions>
## Implementation Decisions

### Round Structure (War Room / Live Floor)

- **D-01:** Add two sub-states to the game: WAR_ROOM and LIVE_FLOOR. These are NOT new GameStatus enum values — they're a `game_phase` field on GameState (values: "war_room", "live_floor", null). The existing ACTIVE status remains; game_phase subdivides it. When game_phase is null or game is PAUSED/SETUP, neither mode is active.
- **D-02:** Admin has two new buttons: "Enter War Room" and "Open Live Floor" in the admin Dashboard. War Room halts trading + price ticks (similar to PAUSED but teams can still view data and submit operating plans). Live Floor enables trading + ticks + decision submission.
- **D-03:** During War Room, teams see:
  - Previous quarter performance summary (stock price change, revenue, margin, market share vs benchmark)
  - A macro brief section (admin writes this as a text field before entering War Room — it's the problem statement for the next quarter)
  - Operating plan submission form (free-text Markdown, like the existing solution submission)
- **D-04:** During Live Floor, teams submit decisions every 20 minutes across the 5 lever categories + can trade normally.

### Lever UI Design

- **D-05:** Decision levers appear as a new "DECISIONS" sidebar tab in the game view (visible to Strategist only, alongside CASELINE and SOLUTIONS). The tab shows 5 collapsible lever sections.
- **D-06:** Each lever category uses appropriate input types:
  - **Pricing**: Slider for list price change (±15%), slider for promo depth (0-40%), dropdown for channel-specific pricing (GT/MT/QCom/D2C)
  - **Marketing**: Percentage allocator across ATL/Digital/Influencer/BTL (must sum to 100%), dropdown for campaign theme (Value/Premium/Health/Patriotism/Nostalgia)
  - **Supply Chain**: Radio for inventory policy (Lean/Balanced/Stocked), checkboxes for distribution expansion (Tier-1/Tier-2/Rural), slider for capacity utilization (60-100%)
  - **New Product**: Toggle for "Launch new SKU" (yes/no), text field for SKU description if yes, dropdown for target category
  - **Trading**: This is handled by the existing trading panel — no new UI needed. It's listed as a lever category for scoring purposes.
- **D-07:** Lever form has a "SUBMIT_DECISIONS" button at the bottom. Submission is timestamped. Teams can resubmit to override previous decisions within the same 20-min window.
- **D-08:** After submission, show a confirmation with the decisions locked and a countdown to the next decision window.

### Budget Mechanics

- **D-09:** Each team has a monthly operating budget derived from: `archetype.starting_cash * budget_multiplier`. The budget_multiplier comes from last-quarter revenue performance relative to archetype benchmark. Default multiplier = 1.0x. Outperforming = 1.1-1.3x. Underperforming = 0.7-0.9x.
- **D-10:** Budget is displayed at the top of the Decisions tab: "OPERATING_BUDGET: ₹X Cr | ALLOCATED: ₹Y Cr | REMAINING: ₹Z Cr"
- **D-11:** Each lever allocation costs budget. Marketing spend is direct. Supply chain expansion costs vary by tier. New product launch has fixed R&D cost. Pricing changes don't cost budget but affect revenue.
- **D-12:** If a team tries to submit decisions exceeding budget, the form shows a red warning and blocks submission: "BUDGET_EXCEEDED — reduce allocations by ₹X Cr"

### Data Model

- **D-13:** New `Decision` table: id, team_id, round_number, lever_category (enum: PRICING/MARKETING/SUPPLY_CHAIN/NEW_PRODUCT), decisions_json (JSON with lever-specific values), budget_spent (Decimal), submitted_at, window_start, window_end.
- **D-14:** New `OperatingPlan` table: id, team_id, round_number, content (Text/Markdown), submitted_at.
- **D-15:** GameState gets new fields: `game_phase` (String, nullable), `macro_brief` (Text, nullable — admin writes before War Room), `current_quarter_start` (DateTime).

</decisions>

<canonical_refs>

## Canonical References

### Project Context

- `.planning/REQUIREMENTS.md` — LEVER-01..03, ROUND-01..03
- `.planning/CASELINE_SPEC.md` — Decision levers spec (§7), simulation structure (§6)

### Existing Code

- `server/app/models.py` — GameState, Team (add Decision, OperatingPlan)
- `server/app/services/game_service.py` — Game transitions (extend for war_room/live_floor)
- `server/app/api/admin.py` — Admin endpoints (add war room/live floor transitions, macro brief)
- `client/src/components/game/GameSidebar.tsx` — Add DECISIONS tab
- `client/src/components/game/SolutionsPanel.tsx` — Reference for submission pattern
- `client/src/stores/game-store.ts` — Extend with game_phase state

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- Game state machine (pause/resume) — extend for war_room/live_floor sub-states
- Solutions submission pattern — reuse for operating plan + decision submission
- Admin game controls — add war room/live floor buttons
- Zustand game store — extend with game_phase
- WebSocket broadcast — broadcast phase transitions

### Integration Points

- Decision data feeds into Phase 9's enhanced simulation engine (DecisionImpact component of price formula)
- Operating plans feed into LLM evaluation context
- Budget derives from archetype starting_cash (Phase 7)

</code_context>

<specifics>
## Specific Ideas

- War Room feels different from PAUSED — it's purposeful (reviewing, planning) not idle. UI should show "WAR ROOM" badge in amber, not "PAUSED" in blue.
- Decision submission should feel tactical — like placing orders on a trading terminal. Sharp edges, monospace, immediate feedback.
- Budget display should update in real-time as team adjusts sliders/allocations before submitting.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 08-decision-levers-and-round-structure_
_Context gathered: 2026-04-16_
