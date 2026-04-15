# Roadmap: Complex

## Overview

This roadmap delivers a real-time case competition platform in 6 phases, progressing from infrastructure and auth through the simulation engine, LLM-powered evaluation, and ending with advanced game mechanics. Each phase delivers a complete, verifiable capability. The core value -- the simulation loop where teams submit solutions, the LLM evaluates them with admin oversight, and the market reacts in real-time -- is assembled across Phases 3-5 and fully integrated by Phase 6.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation, Auth, and Base UI** - Dockerized backend, database schema, Redis pub/sub relay, team auth with role separation, Bloomberg dark theme scaffold (completed 2026-04-15)
- [ ] **Phase 2: Game State and Lobby** - Game lifecycle state machine, lobby system, server-authoritative timer, WebSocket-driven state broadcast
- [ ] **Phase 3: Simulation Engine and Trading** - Stock price ticks, candlestick charts, buy/sell trading with atomic validation, portfolio tracking
- [ ] **Phase 4: Solutions and LLM Evaluation** - Solution submission, LLM evaluation via OpenRouter, human-in-the-loop admin approval gate
- [ ] **Phase 5: News and Admin Dashboard** - News feed (admin-injected + LLM-generated), admin live dashboard, approval queue, broadcast messages
- [ ] **Phase 6: Crisis Events, Elimination, and Polish** - Crisis event injection with market pause, elimination mechanics, leaderboard, responsive two-device layout

## Phase Details

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
**Plans**: TBD
**UI hint**: yes

### Phase 3: Simulation Engine and Trading
**Goal**: The market runs in real-time with stock prices ticking every minute, teams can trade shares in each other's companies, and everyone sees live candlestick charts
**Depends on**: Phase 2
**Requirements**: SIM-01, SIM-02, SIM-03, SIM-04, TRAD-01, TRAD-02, TRAD-03, TRAD-04, TRAD-05, UI-02
**Success Criteria** (what must be TRUE):
  1. Stock prices for all active companies update every 1 minute via the simulation formula (random walk + LLM quality adjustment) and are broadcast to all clients via WebSocket
  2. Each 20-minute real-time window transitions to a new simulated quarter, and caselines evolve based on approved evaluations
  3. A Trader sub-account can buy and sell shares in other companies at the current price, with the 30% external shareholding cap enforced atomically (concurrent orders cannot exceed the cap)
  4. Each team can view a portfolio showing their holdings, P&L, and total net worth
  5. A real-time candlestick chart per company renders price history using lightweight-charts and updates live as new ticks arrive
**Plans**: TBD
**UI hint**: yes

### Phase 4: Solutions and LLM Evaluation
**Goal**: Teams submit strategic solutions that are evaluated by an LLM, with admin review and approval before scores impact the simulation
**Depends on**: Phase 3
**Requirements**: SOLN-01, SOLN-02, SOLN-03, SOLN-04, EVAL-01, EVAL-02, EVAL-03, EVAL-04, EVAL-05
**Success Criteria** (what must be TRUE):
  1. A Strategist can submit a solution (Word or Markdown) during the initial 1-hour window, representing a 3-month strategic roadmap
  2. After the initial submission, the team can submit microtweaks with a 20-minute cooldown that is tracked and auto-clears
  3. The LLM evaluates submissions via OpenRouter, considering other companies' actions, news context, and the company's past actions, producing a quality score and narrative assessment
  4. LLM evaluations enter a PENDING_APPROVAL state -- the admin can review, edit scores and narrative, and approve or reject before any impact takes effect
  5. Only admin-approved evaluations affect stock prices and caseline evolution
**Plans**: TBD

### Phase 5: News and Admin Dashboard
**Goal**: Admins have full situational awareness and control through a live dashboard, and teams receive real-time news that shapes trading decisions
**Depends on**: Phase 4
**Requirements**: NEWS-01, NEWS-02, NEWS-03, ADMN-01, ADMN-02, ADMN-03, ADMN-05
**Success Criteria** (what must be TRUE):
  1. Admin can inject news events that appear in all teams' news feeds in real-time via WebSocket
  2. The LLM generates contextual news based on game state and team actions, appearing in the feed alongside admin-injected news
  3. The admin dashboard shows all teams' stock prices, submission statuses, and scores updating in real-time
  4. The admin can approve, edit, or reject LLM evaluations from an approval queue in the dashboard
  5. The admin can broadcast text messages to all teams and approve or remove teams from the competition
**Plans**: TBD
**UI hint**: yes

### Phase 6: Crisis Events, Elimination, and Polish
**Goal**: The full competition loop works end-to-end -- admin can inject crises that pause the market, eliminate underperformers, and the UI is polished for a two-device competition experience
**Depends on**: Phase 5
**Requirements**: NEWS-04, ADMN-04, ELIM-01, ELIM-02, ELIM-03, UI-03, UI-04
**Success Criteria** (what must be TRUE):
  1. Admin can inject a crisis event that pauses the market, presents teams with a crisis scenario, gives them a time-boxed response window, and resumes the market afterward
  2. Admin can eliminate low-performing companies after each round, and eliminated teams' shares are handled (refund or marked worthless)
  3. Eliminated teams can no longer trade or submit solutions but retain read-only access
  4. A leaderboard shows company rankings by stock price, updating in real-time
  5. The layout supports two-device concurrent play per team (Strategist on one screen, Trader on another) with responsive design
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation, Auth, and Base UI | 6/6 | Complete    | 2026-04-15 |
| 2. Game State and Lobby | 0/TBD | Not started | - |
| 3. Simulation Engine and Trading | 0/TBD | Not started | - |
| 4. Solutions and LLM Evaluation | 0/TBD | Not started | - |
| 5. News and Admin Dashboard | 0/TBD | Not started | - |
| 6. Crisis Events, Elimination, and Polish | 0/TBD | Not started | - |
