# Phase 3: Admin Portal - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the complete admin control center with 7 sidebar tabs: Dashboard, Teams, Evaluations, Markets, News, Settings, Activity Log. Admin can manage teams (approve/reject/remove), monitor all activity in real-time, review LLM evaluations (UI only — backend integration in Phase 5), broadcast messages, inject news events, and control round timing. Follows Stitch "Complex Terminal Blue" admin panel design.

</domain>

<decisions>
## Implementation Decisions

### Dashboard Layout
- **D-01:** Full admin portal with top navigation tabs + left icon sidebar (matching Stitch admin panel design).
- **D-02:** 7 sidebar tabs: Dashboard, Teams, Evaluations, Markets, News, Settings, Activity Log.
  - **Dashboard** — Game controls (start/pause/resume), timer, quarter management, overall status
  - **Teams** — Approve/reject pending teams, view all teams, remove mid-game
  - **Evaluations** — Review LLM prompts + responses, approve/edit/reject scores
  - **Markets** — Stock price overview for all companies, sparklines
  - **News** — Inject news events, view news history, broadcast messages (same channel as news)
  - **Settings** — Round timing controls (rounds are admin-controlled, not fixed intervals)
  - **Activity Log** — Real-time feed of all events (trades, submissions, approvals, state changes)

### Team Management
- **D-03:** Inline table actions — Approve/Reject/Remove buttons directly in each team row (like Stitch design). No modals.
- **D-04:** Remove behavior depends on game state:
  - **Before game starts (SETUP):** Hard remove — team fully deleted, all records purged, gone from all views.
  - **During active game (ACTIVE/PAUSED):** Soft remove — team marked BANKRUPT/ELIMINATED, gets read-only access, shares handled. Cannot trade or submit.

### News & Broadcast
- **D-05:** News and broadcast messages are the **same channel** — both appear in the team news feed. Broadcasts are just news items tagged appropriately.
- **D-06:** News injection form has 3 fields:
  - Headline (text)
  - Body (textarea)
  - Type selector: GLOBAL or LOCAL
  - If LOCAL: additional multi-select for which companies are affected
  - If GLOBAL: no company selector needed

### Evaluation Queue
- **D-07:** Claude's discretion on eval queue initial state. Recommendation: build complete UI with empty state ("No pending evaluations — submissions will appear here when teams submit solutions"). The approve/edit/reject buttons render but have no backend connection until Phase 5. This avoids mock data confusion while ensuring the layout is ready.

### UI Scale
- **D-08:** Scale up all UI elements — larger text sizes, more padding, bigger buttons and inputs. The current Stitch design looks right at 133% zoom; target making it look right at 100% zoom. Increase base font sizes, spacing, and interactive element sizes across all admin pages.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design Reference
- `assests/stitch_complex_terminal_blue/admin_panel/code.html` — Stitch admin panel HTML (GAME_CONTROL_STATION, TEAM_PERFORMANCE_LEDGER, EVALUATIONS_QUEUE)
- `assests/stitch_complex_terminal_blue/admin_panel/screen.png` — Stitch admin panel screenshot
- `assests/stitch_complex_terminal_blue/complex_terminal/DESIGN.md` — Full design system spec (Precision Brutalism, tonal layering, No-Line rule)

### Project Context
- `.planning/PROJECT.md` — Core value, constraints
- `.planning/REQUIREMENTS.md` — ADMN-01..05, NEWS-01 requirements for this phase
- `.planning/ROADMAP.md` — Phase 3 success criteria

### Phase 1/2 Output (dependencies)
- `server/app/api/admin.py` — Existing admin endpoints (login, seed, teams, approve/reject, game controls)
- `server/app/auth_utils.py` — require_admin dependency
- `server/app/services/game_service.py` — Game state management service
- `server/app/websocket.py` — ConnectionManager for broadcasts
- `server/app/redis_pubsub.py` — Redis pub/sub relay
- `client/src/app/admin/page.tsx` — Current admin page (game controls only — to be expanded)
- `client/src/stores/auth-store.ts` — Admin auth state
- `client/src/stores/game-store.ts` — Game state store
- `client/src/hooks/use-websocket.ts` — WebSocket hook
- `client/src/lib/api.ts` — API client (to extend with new admin endpoints)
- `client/src/app/globals.css` — Stitch Terminal Blue design tokens

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Admin API endpoints already exist for team management (approve/reject) and game controls (start/pause/resume)
- WebSocket broadcast infrastructure working — can broadcast news and admin messages
- Zustand stores pattern established (auth-store, game-store) — add admin-store
- API client pattern in api.ts — extend for news injection, team management, etc.
- Stitch admin panel HTML provides exact layout reference

### Established Patterns
- Admin endpoints at `/api/v1/admin/*` with `require_admin` dependency
- WebSocket messages as JSON with `type` field
- Zustand stores without persist middleware for ephemeral state
- Terminal-style labels (FIELD_01 // NAME format) from Stitch restyle

### Integration Points
- Admin portal replaces current single-page `/admin` with multi-tab layout
- New admin routes: `/admin/teams`, `/admin/evaluations`, `/admin/markets`, `/admin/news`, `/admin/settings`, `/admin/activity`
- New backend endpoints needed: news injection (`POST /api/v1/admin/news/inject`), broadcast, team removal, activity log
- WebSocket events for real-time admin dashboard updates

</code_context>

<specifics>
## Specific Ideas

- Sidebar icons should match Stitch terminal style — use lucide-react icons with the terminal aesthetic
- The activity log should auto-scroll to latest events, similar to a terminal output feed
- Team management table should show: Team Name, Ticker, Status, Valuation (placeholder until Phase 4), Submissions count, Actions
- Markets tab can show placeholder sparklines until the simulation engine (Phase 4) provides real data
- News tab combines injection form + news history in one view
- Settings tab for round timing: admin manually advances quarters, sets round duration

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-admin-portal*
*Context gathered: 2026-04-16*
