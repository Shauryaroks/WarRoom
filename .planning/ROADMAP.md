# Roadmap: Complex

## Milestones

- v1.0 MVP - Phases 1-6 (shipped 2026-04-16)
- v2.0 Final Integration - Phases 7-12 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-6) - SHIPPED 2026-04-16</summary>

- [x] **Phase 1: Foundation, Auth, and Base UI** - Dockerized backend, database schema, Redis pub/sub relay, team auth with role separation, Bloomberg dark theme scaffold (completed 2026-04-15)
- [x] **Phase 2: Game State and Lobby** - Game lifecycle state machine, lobby system, server-authoritative timer, WebSocket-driven state broadcast (completed 2026-04-16)
- [x] **Phase 3: Admin Portal** - Team management (approve/reject/remove), live dashboard, evaluation approval queue, broadcast messages, news injection, crisis event controls (completed 2026-04-16)
- [x] **Phase 4: Simulation Engine and Trading** - Stock price ticks, candlestick charts, buy/sell trading with atomic validation, portfolio tracking (completed 2026-04-16)
- [x] **Phase 5: Solutions and LLM Evaluation** - Solution submission, LLM evaluation via OpenRouter, human-in-the-loop admin approval gate (completed 2026-04-16)
- [x] **Phase 6: News, Elimination, and Polish** - LLM-generated news, crisis event execution with market pause, elimination mechanics, leaderboard, responsive two-device layout (completed 2026-04-16)

### Phase 1: Foundation, Auth, and Base UI
**Goal**: Teams can register, log in with role-appropriate credentials, and see a Bloomberg-styled interface, all running on a fully dockerized backend with working WebSocket infrastructure
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, UI-01
**Success Criteria** (what must be TRUE):
  1. All backend services start with a single `docker compose up` and remain healthy (FastAPI, PostgreSQL, Redis, Celery, Caddy)
  2. A team can register with team name, ticker, email, and password, and an admin can approve or reject that registration
  3. Each team has Strategist and Trader sub-accounts that can log in separately and see role-appropriate UI (Strategist sees solution submission area + view-only market; Trader sees trading panel + news)
  4. Sessions persist across browser refresh without requiring re-login
  5. The Celery worker can publish a message to Redis pub/sub and the FastAPI process relays it to a connected WebSocket client (the relay pipeline works end-to-end)
**Plans**: 6 plans

Plans:
- [x] 01-01-PLAN.md -- Backend infrastructure: models, migrations, Docker Compose, Caddy, Celery
- [x] 01-02-PLAN.md -- Frontend scaffold: Next.js, shadcn, Bloomberg dark theme, fonts
- [x] 01-03-PLAN.md -- Auth API: JWT auth, registration, login, admin endpoints
- [x] 01-04-PLAN.md -- Auth UI: Register, Login, Admin Login pages with Zod validation
- [x] 01-05-PLAN.md -- WebSocket infrastructure: ConnectionManager, Redis pub/sub relay
- [x] 01-06-PLAN.md -- Lobby UI, Zustand auth store, WebSocket client, session persistence

**UI hint**: yes

### Phase 2: Game State and Lobby
**Goal**: Approved teams wait in a lobby and the admin controls the game lifecycle with real-time state broadcast to all clients
**Depends on**: Phase 1
**Requirements**: GAME-01, GAME-02, GAME-03, GAME-04
**Success Criteria** (what must be TRUE):
  1. Approved teams see a lobby screen and receive a real-time notification when the admin starts the game
  2. Admin can start, pause, and resume the game, and all connected clients reflect the current state within 1 second
  3. The game timer is server-authoritative -- pausing and resuming does not cause timer drift (elapsed time excludes paused duration)
  4. When the game is paused, all simulation ticks (Celery periodic tasks) stop executing and no new price updates or state changes occur
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md -- Backend game lifecycle: state machine service, admin endpoints, Celery task guard, tests
- [x] 02-02-PLAN.md -- Frontend game lifecycle: game store, lobby redirect, admin controls, game page

**UI hint**: yes

### Phase 3: Admin Portal
**Goal**: Admin has a complete control center -- manage teams, monitor all activity in real-time, review LLM evaluations, broadcast messages, inject news and crisis events
**Depends on**: Phase 2
**Requirements**: ADMN-01, ADMN-02, ADMN-03, ADMN-04, ADMN-05, NEWS-01
**Success Criteria** (what must be TRUE):
  1. Admin can approve, reject, and remove teams from a team management table with real-time status
  2. Admin dashboard shows all teams' stock prices, submission statuses, and scores updating in real-time
  3. Admin can broadcast text messages to all teams via WebSocket
  4. Admin can inject news events that appear in all teams' news feeds in real-time
  5. Admin has an evaluation approval queue UI (approve/edit/reject) -- backend integration completes in Phase 5
**Plans**: 5 plans

Plans:
- [x] 03-01-PLAN.md -- Backend endpoints: team removal, news injection, broadcast, activity log, round advance
- [x] 03-02-PLAN.md -- Admin layout shell: sidebar navigation, topnav, admin store, API client
- [x] 03-03-PLAN.md -- Dashboard and Teams tabs: team overview, inline management actions
- [x] 03-04-PLAN.md -- News and Evaluations tabs: injection form, broadcast, eval empty state
- [x] 03-05-PLAN.md -- Markets, Settings, Activity tabs: stock overview, round controls, event feed

**UI hint**: yes

### Phase 4: Simulation Engine and Trading
**Goal**: The market runs in real-time with stock prices ticking every minute, teams can trade shares in each other's companies, and everyone sees live candlestick charts
**Depends on**: Phase 2
**Requirements**: SIM-01, SIM-02, SIM-03, SIM-04, TRAD-01, TRAD-02, TRAD-03, TRAD-04, TRAD-05, UI-02
**Success Criteria** (what must be TRUE):
  1. Stock prices for all active companies update every 1 minute via the simulation formula (random walk + LLM quality adjustment) and are broadcast to all clients via WebSocket
  2. Each 20-minute real-time window transitions to a new simulated quarter, and caselines evolve based on approved evaluations
  3. A Trader sub-account can buy and sell shares in other companies at the current price, with the 30% external shareholding cap enforced atomically (concurrent orders cannot exceed the cap)
  4. Each team can view a portfolio showing their holdings, P&L, and total net worth
  5. A real-time candlestick chart per company renders price history using lightweight-charts and updates live as new ticks arrive
**Plans**: 5 plans

Plans:
- [x] 04-01-PLAN.md -- Simulation engine: price tick task, interpolation, admin set-score, tests
- [x] 04-02-PLAN.md -- Trading backend: atomic buy/sell with 30% cap, portfolio, market API
- [x] 04-03-PLAN.md -- Frontend data layer: types, API client, market and trading stores
- [x] 04-04-PLAN.md -- Candlestick chart: lightweight-charts component, company tabs, price overlay
- [x] 04-05-PLAN.md -- Game page layout: header, sidebar, panels, WebSocket wiring, verification

**UI hint**: yes

### Phase 5: Solutions and LLM Evaluation
**Goal**: Teams submit strategic solutions that are evaluated by an LLM, with admin review and approval before scores impact the simulation
**Depends on**: Phase 4
**Requirements**: SOLN-01, SOLN-02, SOLN-03, SOLN-04, EVAL-01, EVAL-02, EVAL-03, EVAL-04, EVAL-05
**Success Criteria** (what must be TRUE):
  1. A Strategist can submit a solution (Word or Markdown) during the initial 1-hour window, representing a 3-month strategic roadmap
  2. After the initial submission, the team can submit microtweaks with a 20-minute cooldown that is tracked and auto-clears
  3. The LLM evaluates submissions via OpenRouter, considering other companies' actions, news context, and the company's past actions, producing a quality score and narrative assessment
  4. LLM evaluations enter a PENDING_APPROVAL state -- the admin can review, edit scores and narrative, and approve or reject before any impact takes effect
  5. Only admin-approved evaluations affect stock prices and caseline evolution
**Plans**: 4 plans

Plans:
- [x] 05-01-PLAN.md -- Backend models, LLM service, evaluation service, Celery task
- [x] 05-02-PLAN.md -- Backend API endpoints (solutions + admin evaluation + caseline) and tests
- [x] 05-03-PLAN.md -- Frontend types, API, solutions store, SolutionsPanel, CaselinePanel
- [x] 05-04-PLAN.md -- Admin evaluations queue, caseline assignment, end-to-end verification

**UI hint**: yes

### Phase 6: News, Elimination, and Polish
**Goal**: The full competition loop works end-to-end -- LLM-generated news, crisis events that pause the market, elimination mechanics, and polished two-device experience
**Depends on**: Phase 5
**Requirements**: NEWS-02, NEWS-03, NEWS-04, ELIM-01, ELIM-02, ELIM-03, UI-03, UI-04
**Success Criteria** (what must be TRUE):
  1. LLM generates contextual news based on game state and team actions, appearing in the news feed
  2. Admin can inject a crisis event that pauses the market, presents teams with a crisis scenario, gives them a time-boxed response window, and resumes the market afterward
  3. Admin can eliminate low-performing companies after each round, and eliminated teams' shares are handled (refund or marked worthless)
  4. Eliminated teams can no longer trade or submit solutions but retain read-only access
  5. A leaderboard shows company rankings by stock price, updating in real-time
  6. The layout supports two-device concurrent play per team (Strategist on one screen, Trader on another) with responsive design
**Plans**: 4 plans

Plans:
- [x] 06-01-PLAN.md -- LLM service refactor, news generation Celery task, CrisisEvent model, migration
- [x] 06-02-PLAN.md -- Admin crisis/elimination/leaderboard endpoints, backend guards, approval-to-news wiring
- [x] 06-03-PLAN.md -- Frontend crisis overlay, elimination state, leaderboard widget and page, WebSocket wiring
- [x] 06-04-PLAN.md -- Two-device responsive layout polish

**UI hint**: yes

</details>

### v2.0 Final Integration (In Progress)

**Milestone Goal:** Align platform with the Bharat Bites & Brews FMCG Stock Wars competition model -- decision levers, archetype-relative scoring, enhanced price formula, short selling, round structure, press releases, enhanced dashboard, final scoring, and sample portfolios.

**Phase Numbering:**
- Integer phases (7, 8, ...): Planned milestone work
- Decimal phases (7.1, 7.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 7: Archetypes & Sample Portfolios** - Admin assigns archetypes with benchmark bands; 4 pre-built dossiers seed the competition (completed 2026-04-16)
- [ ] **Phase 8: Decision Levers & Round Structure** - Teams submit 5-category decisions every 20 min; admin controls War Room / Live Floor phases
- [ ] **Phase 9: Enhanced Simulation Engine** - New price formula with 4 weighted fundamentals, archetype-relative scoring, event shocks, sentiment flow, smoothing
- [ ] **Phase 10: Enhanced Trading** - Short selling with margin, position limits, circuit breakers, separate trading P&L tracking
- [ ] **Phase 11: Press Releases & Enhanced Dashboard** - Team press releases feed into news; live operational and market-wide dashboard tiles
- [ ] **Phase 12: Final Scoring & Endgame** - Final score computation, strategy memo submission, distress triggers for underperformers

## Phase Details

### Phase 7: Archetypes & Sample Portfolios
**Goal**: Every team has an assigned archetype that defines its competitive identity -- benchmark bands, balance sheet, SWOT profile -- and 4 ready-to-use dossiers let admin seed a competition in minutes
**Depends on**: Phase 6 (v1 complete)
**Requirements**: ARCH-01, ARCH-02, PORT-01
**Success Criteria** (what must be TRUE):
  1. Admin can create an archetype with benchmark bands for all 4 fundamentals (Market Share, Profitability, Ops Efficiency, Brand Health) and assign it to a team
  2. 4 pre-built archetype dossiers (Legacy Giant, D2C Challenger, Regional Leader, Premium Niche) are available with balance sheets, SWOT analyses, cost structures, and benchmark bands
  3. Each team's game view shows its archetype identity and key benchmark ranges
  4. Admin can view and edit archetype assignments from the admin portal
**Plans**: 2 plans

Plans:
- [x] 07-01-PLAN.md -- Backend: Archetype model, migration, admin CRUD/assign/seed endpoints, caseline response update
- [x] 07-02-PLAN.md -- Frontend: types, API client, admin Teams dropdown, Settings archetype form, game CaselinePanel badge

**UI hint**: yes

### Phase 8: Decision Levers & Round Structure
**Goal**: The game has structured rhythm -- admin controls War Room and Live Floor phases within each round, and teams submit strategic decisions across 5 lever categories every 20-minute cycle
**Depends on**: Phase 7
**Requirements**: LEVER-01, LEVER-02, LEVER-03, ROUND-01, ROUND-02, ROUND-03
**Success Criteria** (what must be TRUE):
  1. Admin can transition the game between War Room (trading halted, teams review macro brief and submit operating plans) and Live Floor (market ticks, trading open, news streams)
  2. During Live Floor, teams can submit decisions across 5 lever categories (Pricing, Marketing, Supply Chain, New Product, Trading) with a 20-minute submission cycle
  3. Each lever presents configurable options appropriate to its category (e.g., price change +/-15%, promo depth 0-40%, channel allocation, campaign theme)
  4. Decision budgets scale with the team's archetype and last-quarter revenue -- teams cannot overspend their budget
  5. During War Room, teams see a performance review of the previous quarter and can submit an operating plan before the next Live Floor begins
**Plans**: TBD
**UI hint**: yes

### Phase 9: Enhanced Simulation Engine
**Goal**: Stock prices reflect team quality through a rigorous formula -- 4 weighted fundamentals scored relative to each team's archetype benchmark, event shocks, sentiment from trading pressure, and smooth phase-in of decision impacts
**Depends on**: Phase 8
**Requirements**: SIM-05, SIM-06, SIM-07, SIM-08, SIM-09, ARCH-03
**Success Criteria** (what must be TRUE):
  1. Stock prices are computed using the 4-fundamental weighted formula (Market Share 35%, Profitability 30%, Ops Efficiency 20%, Brand Health 15%) plus event shock, sentiment flow, and noise components
  2. Each team's fundamental scores are measured relative to its archetype's benchmark band (z-score), not as absolute values -- a Regional Leader with 8% market share can score higher than a Legacy Giant with 15%
  3. Event shocks from admin-injected crises or news produce discrete price jumps of +/-3% to +/-15%
  4. Net trading pressure (heavy shorting or longing) feeds into the sentiment component, causing prices to drift in the direction of consensus
  5. Decision impacts phase in over 3-5 minutes with smoothing -- submitting a lever change does not cause an instant price snap
**Plans**: TBD

### Phase 10: Enhanced Trading
**Goal**: Teams can short sell stocks with margin requirements, face position limits and circuit breakers, and their trading P&L is tracked separately for final scoring
**Depends on**: Phase 9
**Requirements**: TRAD-06, TRAD-07, TRAD-08, TRAD-09
**Success Criteria** (what must be TRUE):
  1. A Trader can open a short position on another company's stock, with a 30% margin requirement held against the position value
  2. Position limits prevent any team from holding more than 15% of its own market cap in a single stock (long or short)
  3. Trading P&L (realized + unrealized) is tracked separately from operating P&L and displayed in the team's portfolio view
  4. Circuit breakers halt trading on any stock that moves +/-25% within a single quarter, with a visual indicator on the affected stock
**Plans**: TBD
**UI hint**: yes

### Phase 11: Press Releases & Enhanced Dashboard
**Goal**: Teams communicate strategy through press releases that become public market intelligence, and both teams and admin see rich operational and market-wide dashboard tiles
**Depends on**: Phase 9
**Requirements**: PRESS-01, PRESS-02, DASH-01, DASH-02, DASH-03
**Success Criteria** (what must be TRUE):
  1. A team can publish a press release through a dedicated press channel, and the LLM incorporates it into the live news feed as analyst commentary
  2. Press releases are visible to all teams as public analyst commentary (no private press)
  3. Each team sees live operational tiles: revenue QTD, EBITDA margin %, market share %, NPS/brand sentiment
  4. A market-wide dashboard shows BCX composite index, sector indices, biggest movers, and short interest leaderboard
  5. Team-private tiles (cash position, inventory turnover, trading P&L) are visible only to the owning team and judges
**Plans**: TBD
**UI hint**: yes

### Phase 12: Final Scoring & Endgame
**Goal**: The competition reaches a definitive conclusion -- final scores computed from stock performance, trading P&L, and strategy memo, with distress triggers forcing consequences on underperformers
**Depends on**: Phase 10, Phase 11
**Requirements**: SCORE-01, SCORE-02, SCORE-03
**Success Criteria** (what must be TRUE):
  1. Final score is computed as 50% stock price performance + 25% trading portfolio P&L + 25% strategy memo score, displayed on a final leaderboard
  2. Teams can submit a final strategy memo (1000 words max) that is evaluated by both LLM and human judges
  3. Teams that miss their archetype benchmark for 3 consecutive quarters trigger a distress event -- forced divestment or dilution that impacts their stock price and standings
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 7 -> 8 -> 9 -> 10 -> 11 -> 12

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation, Auth, and Base UI | v1.0 | 6/6 | Complete | 2026-04-15 |
| 2. Game State and Lobby | v1.0 | 2/2 | Complete | 2026-04-16 |
| 3. Admin Portal | v1.0 | 5/5 | Complete | 2026-04-16 |
| 4. Simulation Engine and Trading | v1.0 | 5/5 | Complete | 2026-04-16 |
| 5. Solutions and LLM Evaluation | v1.0 | 4/4 | Complete | 2026-04-16 |
| 6. News, Elimination, and Polish | v1.0 | 4/4 | Complete | 2026-04-16 |
| 7. Archetypes & Sample Portfolios | v2.0 | 2/2 | Complete    | 2026-04-16 |
| 8. Decision Levers & Round Structure | v2.0 | 0/0 | Not started | - |
| 9. Enhanced Simulation Engine | v2.0 | 0/0 | Not started | - |
| 10. Enhanced Trading | v2.0 | 0/0 | Not started | - |
| 11. Press Releases & Enhanced Dashboard | v2.0 | 0/0 | Not started | - |
| 12. Final Scoring & Endgame | v2.0 | 0/0 | Not started | - |
