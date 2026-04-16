# Phase 6: News, Elimination, and Polish - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete the competition loop: LLM-generated news after each approved evaluation, crisis events with full flow (inject → pause → respond → evaluate → resume), elimination mechanics (shares go worthless, read-only access), real-time leaderboard (in-game widget + dedicated page), and two-device responsive polish.

</domain>

<decisions>
## Implementation Decisions

### LLM-Generated News
- **D-01:** News generated after each approved evaluation — when admin approves an LLM evaluation, the system also generates related news. No periodic/ambient news generation.
- **D-02:** Two types of generated news:
  - **Market commentary** (team-specific): "APEX stock surges after bold restructuring plan" — reactive to the team's solution and price impact.
  - **World events** (broader context): "Global supply chain disruption affects tech sector" — LLM creates broader market context that affects multiple teams.
- **D-03:** Reuse the existing LLM service (Phase 5) with a news-generation prompt. Output published via the existing news WebSocket broadcast.

### Crisis Events
- **D-04:** Full crisis flow:
  1. Admin injects crisis (scenario description + warning timer duration)
  2. Market auto-pauses (triggers existing game pause)
  3. All teams see crisis scenario in a prominent overlay
  4. Warning timer counts down (visible to all, but admin controls actual resume)
  5. Teams submit crisis response (via the Solutions tab as a special submission)
  6. Crisis responses evaluated by LLM
  7. Admin manually resumes market when ready
- **D-05:** Timer is a WARNING only — admin controls the actual pause/resume. Timer does NOT auto-resume. It's a visual indicator for teams.
- **D-06:** Crisis scenario appears as an urgent full-screen overlay on all game views, red-themed, with the crisis description and countdown timer.

### Elimination
- **D-07:** When admin eliminates a team, their shares become **worthless** ($0). Holders lose their investment. No refund.
- **D-08:** Eliminated teams get **read-only game view** — same game page but all actions disabled (trading panel greyed out, solutions editor disabled). Can still watch charts, news, leaderboard.
- **D-09:** Eliminated team's stock is removed from trading — other teams can no longer buy/sell their shares.

### Leaderboard
- **D-10:** Leaderboard shows in **both** locations:
  - Compact widget in the game view (visible without navigation)
  - Full dedicated page at `/leaderboard`
- **D-11:** Rankings by stock price, updating in real-time via WebSocket. Shows: rank, team name, ticker, stock price, change %, status (active/eliminated).

### Two-Device Polish
- **D-12:** Claude's discretion — assess what's needed for two-device concurrent play. Strategist and Trader already have separate logins and role-based views. Verify responsive layout works on different screen sizes, fix any issues.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Core value, constraints
- `.planning/REQUIREMENTS.md` — NEWS-02..04, ELIM-01..03, UI-03..04 requirements
- `.planning/ROADMAP.md` — Phase 6 success criteria

### Prior Phase Output
- `server/app/services/llm_service.py` — LLM service (reuse for news generation)
- `server/app/services/evaluation_service.py` — Evaluation pipeline (hook news gen after approve)
- `server/app/services/game_service.py` — Game pause/resume (reuse for crisis auto-pause)
- `server/app/api/admin.py` — Admin endpoints (extend for crisis, elimination)
- `server/app/models.py` — Team ELIMINATED/BANKRUPT status, MarketNews, GameState
- `server/app/redis_pubsub.py` — WebSocket broadcast for news + leaderboard updates
- `client/src/components/game/NewsOverlay.tsx` — Floating news overlay (extend for crisis)
- `client/src/components/game/GameSidebar.tsx` — Role-based sidebar
- `client/src/app/game/page.tsx` — Game page layout
- `client/src/stores/market-store.ts` — Market data (add leaderboard data)
- `client/src/app/globals.css` — Stitch Terminal Blue tokens

### Design Reference
- `assests/stitch_complex_terminal_blue/game_strategist_view/code.html` — Game layout reference
- `assests/stitch_complex_terminal_blue/complex_terminal/DESIGN.md` — Glassmorphism for overlays

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- LLM service with OpenRouter structured output — add news-generation prompt
- Evaluation approve flow — hook news generation after approval
- Game pause/resume — reuse for crisis auto-pause
- News broadcast via Redis pub/sub — already working
- News overlay component — extend for crisis scenario display
- Team status model — ELIMINATED, BANKRUPT states already exist
- Admin soft-remove (bankrupt) — reuse pattern for elimination

### Established Patterns
- Celery tasks for async LLM work
- WebSocket message types for real-time updates
- Zustand stores for frontend state
- Stitch Terminal Blue design system

### Integration Points
- Approved evaluation → trigger news generation Celery task
- Crisis inject endpoint → auto-pause game → broadcast crisis overlay
- Elimination → mark shares worthless → broadcast leaderboard update
- Leaderboard data from existing team stock_price fields

</code_context>

<specifics>
## Specific Ideas

- Crisis overlay should be dramatic — red-themed, full viewport, can't be dismissed until admin resumes
- Leaderboard widget in game view should be compact (rank, ticker, price) — full page shows more detail
- News generation prompt should reference the specific evaluation that triggered it
- Eliminated teams should see a "ELIMINATED" banner across the top of their game view

</specifics>

<deferred>
## Deferred Ideas

None — this is the final phase

</deferred>

---

*Phase: 06-news-elimination-and-polish*
*Context gathered: 2026-04-16*
