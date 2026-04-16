# Phase 5: Solutions and LLM Evaluation - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the solution submission system (Markdown editor for strategists), LLM evaluation pipeline via OpenRouter (prompt with full context, scoring metrics + price timeline + news article output), human-in-the-loop admin approval flow (one-at-a-time review, edit, approve/reject), and admin portfolio/caseline assignment to teams before game start.

</domain>

<decisions>
## Implementation Decisions

### Solution Submission
- **D-01:** Markdown editor built into the Solutions tab of the game sidebar. No file upload — teams type directly in the terminal-style editor.
- **D-02:** Initial submission during the 1-hour window is the full strategic roadmap.
- **D-03:** Microtweaks use the same editor, labeled "MICROTWEAK". Content is additive — appended to the original solution context. 20-minute cooldown between microtweaks.
- **D-04:** Cooldown status tracked server-side and auto-cleared when expired.

### LLM Evaluation
- **D-05:** LLM receives full context when evaluating:
  - The team's submitted solution/microtweak
  - The team's caseline (company profile, sector, starting conditions)
  - Other teams' actions (summary of competitor submissions and scores)
  - Current news/events (active news items, crisis events in play)
- **D-06:** LLM outputs three things:
  1. **Scoring metrics** — placeholder fields for now (will be refined later with proper rubrics). Produces numeric values.
  2. **Price timeline** — projected stock prices over the next 3 simulated months (reflected in ~1 hour of real time). This feeds into the simulation engine's interpolation.
  3. **News article** — a narrative assessment presented as a news article in the team feed. Better UX than a raw narrative — feels like market news.
- **D-07:** OpenRouter API for LLM calls. Model configurable via environment variable.

### Approval Flow
- **D-08:** One-at-a-time review — admin opens each evaluation in the Evaluations tab, sees the LLM's scoring metrics + generated news article + price timeline, can edit any of them, then approves or rejects.
- **D-09:** On approve: impact queued until the next price tick (60-second cycle). Gives admin time to review and approve multiple evaluations before they collectively take effect.
- **D-10:** On reject: evaluation marked as rejected, no impact on simulation. Team is notified they can resubmit.
- **D-11:** Approved evaluation's price timeline replaces the team's current target_price/ticks_to_target in the simulation engine. News article publishes to all teams' news feeds.

### Portfolio / Caseline Assignment
- **D-12:** Admin assigns a caseline DOCUMENT (Markdown/text) to each team before the game starts (during SETUP phase). The caseline document contains everything: company name, sector, starting cash, initial stock price, scenario description, challenges.
- **D-13:** Assignment UI lives in the admin Teams tab — admin clicks a team, pastes/writes the caseline document in a Markdown editor, saves.
- **D-14:** The system extracts key fields from the caseline (or admin fills them separately): company display name, starting cash amount, initial stock price. These populate the Team model fields.
- **D-15:** Teams see their caseline in the Caseline tab of the game sidebar when the game starts.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Core value, constraints, game flow
- `.planning/REQUIREMENTS.md` — SOLN-01..04, EVAL-01..05 requirements
- `.planning/ROADMAP.md` — Phase 5 success criteria

### Prior Phase Output
- `server/app/models.py` — Team model (target_price, ticks_to_target), Directive model pattern in git history
- `server/app/services/simulation_service.py` — Price interpolation, set_team_score (Phase 4 — to be connected)
- `server/app/api/admin.py` — Admin endpoints including set-score (mock → replace with real)
- `server/app/worker/tasks/game_tick.py` — Price tick task that reads target prices
- `server/app/redis_pubsub.py` — Redis pub/sub for broadcasting news articles
- `client/src/components/game/SolutionsPanel.tsx` — Placeholder Solutions tab (Phase 4)
- `client/src/app/admin/evaluations/page.tsx` — Empty state eval queue UI (Phase 3)
- `client/src/app/admin/teams/page.tsx` — Teams management (add caseline assignment here)
- `client/src/stores/market-store.ts` — Market data store
- `client/src/stores/trading-store.ts` — Trading store

### Design Reference
- `assests/stitch_complex_terminal_blue/game_strategist_view/code.html` — Strategist view with code editor
- `assests/stitch_complex_terminal_blue/admin_panel/code.html` — Evaluations queue with APPROVE/EDIT/REJECT

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Celery task pattern (game_tick) — use for async LLM evaluation calls
- Redis pub/sub relay — broadcast approved news articles to all teams
- Admin Evaluations tab UI shell — fill with real data
- Solutions tab placeholder in game sidebar — replace with Markdown editor
- Admin Teams tab — extend with caseline assignment

### Established Patterns
- PENDING_APPROVAL status pattern (discussed in roadmap, not yet implemented — Phase 5 creates it)
- WebSocket message types for real-time updates
- Zustand stores for frontend state
- API client extension pattern

### Integration Points
- Solution submission → Celery task for LLM evaluation → PENDING_APPROVAL in DB
- Admin approves → price timeline written to Team model → simulation engine picks up on next tick
- News article from LLM → MarketNews table → WebSocket broadcast → team news feeds
- Caseline assignment → Team model fields populated → Caseline tab shows content

</code_context>

<specifics>
## Specific Ideas

- The Markdown editor should match the Stitch terminal aesthetic — dark background, monospace hints, minimal toolbar
- LLM prompt should be structured with clear sections: [COMPANY PROFILE], [SOLUTION], [COMPETITOR ACTIONS], [MARKET NEWS], [SCORING CRITERIA]
- News articles from LLM evaluation should be tagged with the team's ticker and sector
- Caseline editor in admin Teams tab should be a full-height Markdown textarea, not a small input
- Price timeline from LLM should be an array of price points that the simulation engine interpolates between

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-solutions-and-llm-evaluation*
*Context gathered: 2026-04-16*
