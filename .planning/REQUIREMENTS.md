# Requirements: Complex

**Defined:** 2026-04-16
**Core Value:** The simulation engine -- teams submit solutions, the LLM evaluates them with admin oversight, and the market reacts in real-time.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [ ] **AUTH-01**: Team can register with team name, ticker symbol, email, and password
- [ ] **AUTH-02**: Admin can approve or reject team registrations before they enter lobby
- [ ] **AUTH-03**: Each team has two sub-accounts: Strategist and Trader with separate login credentials
- [ ] **AUTH-04**: Strategist has solution submission access + view-only market access
- [ ] **AUTH-05**: Trader has full market access (buy/sell) + news view
- [ ] **AUTH-06**: User session persists across browser refresh

### Game State

- [ ] **GAME-01**: Approved teams enter a lobby and wait for admin to start the game
- [ ] **GAME-02**: Admin can start, pause, and resume the game
- [ ] **GAME-03**: Server-authoritative timer with pause offset handling (timer doesn't drift on resume)
- [ ] **GAME-04**: Game pause stops all simulation ticks, market activity, and submission windows

### Solution Submission

- [ ] **SOLN-01**: Teams submit solutions in Word or Markdown format within the initial 1-hour window
- [ ] **SOLN-02**: Solutions represent a 3-month strategic roadmap for the team's company
- [ ] **SOLN-03**: Teams can submit microtweaks to their strategy with a 20-minute cooldown
- [ ] **SOLN-04**: Cooldown status is tracked and automatically cleared when expired

### LLM Evaluation

- [ ] **EVAL-01**: LLM evaluates solutions via OpenRouter API considering: other companies' actions, global/local news, and past actions of the company
- [ ] **EVAL-02**: LLM evaluation produces a quality score and narrative assessment
- [ ] **EVAL-03**: Admin reviews LLM evaluation before it takes effect (human-in-the-loop gate)
- [ ] **EVAL-04**: Admin can edit LLM scores and narrative before approving
- [ ] **EVAL-05**: Only approved evaluations impact simulation (stock price, caseline evolution)

### Simulation Engine

- [ ] **SIM-01**: Stock prices update every 1 minute using formula (random walk) + LLM quality adjustment
- [ ] **SIM-02**: Each 20-minute real-time window represents 3 simulated months of caseline evolution
- [ ] **SIM-03**: Caseline evolves based on approved solution evaluations
- [ ] **SIM-04**: Real-time candlestick chart displays stock price history (lightweight-charts)

### Trading

- [ ] **TRAD-01**: Trader sub-account can buy shares in other teams' companies at current simulated price
- [ ] **TRAD-02**: Trader sub-account can sell shares they hold in other teams' companies
- [ ] **TRAD-03**: Maximum 30% external shareholding per company enforced (company retains 70% minimum)
- [ ] **TRAD-04**: All share transactions validated atomically in PostgreSQL with row-level locking
- [ ] **TRAD-05**: Portfolio view showing holdings, P&L, and total net worth

### News

- [ ] **NEWS-01**: Admin can inject news events visible to all teams in real-time
- [ ] **NEWS-02**: LLM generates contextual news based on game state and team actions
- [ ] **NEWS-03**: News feed updates in real-time via WebSocket
- [ ] **NEWS-04**: Crisis events: admin injects major crises that pause the market, teams solve, market resumes

### Admin Dashboard

- [ ] **ADMN-01**: Live dashboard showing all teams' stock prices, submissions, and scores in real-time
- [ ] **ADMN-02**: Approval queue for LLM evaluations (approve/edit/reject)
- [ ] **ADMN-03**: Broadcast text messages to all teams
- [ ] **ADMN-04**: Inject crisis events mid-game with market pause
- [ ] **ADMN-05**: Approve or remove teams from the competition

### Elimination

- [ ] **ELIM-01**: Admin can eliminate low-performing companies after each round
- [ ] **ELIM-02**: Eliminated teams' shares are handled (refund to holders or marked worthless)
- [ ] **ELIM-03**: Eliminated teams can no longer trade or submit solutions

### UI/UX

- [ ] **UI-01**: Bloomberg Terminal-inspired dark theme across all pages
- [ ] **UI-02**: Real-time candlestick stock chart per company
- [ ] **UI-03**: Responsive layout supporting two-device concurrent play per team
- [ ] **UI-04**: Leaderboard showing company rankings by stock price

### Infrastructure

- [ ] **INFRA-01**: Backend fully dockerized (FastAPI, PostgreSQL, Redis, Celery, Caddy)
- [ ] **INFRA-02**: Frontend deployed on Vercel with API calls to dockerized backend
- [ ] **INFRA-03**: WebSocket communication via Redis pub/sub relay (Celery workers -> API server -> clients)
- [ ] **INFRA-04**: Handles 80 concurrent WebSocket connections on 8GB/4vCPU VPS

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Analytics

- **ANLY-01**: Game replay showing timeline of all events and decisions
- **ANLY-02**: Team performance analytics (decision quality over time)
- **ANLY-03**: Scoring breakdown visible to teams post-game

### Admin Enhancements

- **ADMN-06**: Template caseline library for quick game setup
- **ADMN-07**: Multi-game management (run multiple competitions)
- **ADMN-08**: Spectator mode for observers

## Out of Scope

| Feature | Reason |
|---------|--------|
| Order book / bid-ask trading | Complexity not justified -- simple buy/sell at simulated price sufficient |
| Real-time chat between teams | Not relevant to case comp format, teams are co-located |
| Mobile app | Web-only, two browser tabs per team |
| OAuth / social login | Email/password sufficient for competition setting |
| Manual stock price override by admin | Prices driven by simulation engine to maintain integrity |
| Video/audio communication | Teams are physically co-located |
| Automated elimination | Admin decides eliminations, not algorithm |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| AUTH-05 | Phase 1 | Pending |
| AUTH-06 | Phase 1 | Pending |
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 1 | Pending |
| INFRA-04 | Phase 1 | Pending |
| UI-01 | Phase 1 | Pending |
| GAME-01 | Phase 2 | Pending |
| GAME-02 | Phase 2 | Pending |
| GAME-03 | Phase 2 | Pending |
| GAME-04 | Phase 2 | Pending |
| SIM-01 | Phase 3 | Pending |
| SIM-02 | Phase 3 | Pending |
| SIM-03 | Phase 3 | Pending |
| SIM-04 | Phase 3 | Pending |
| TRAD-01 | Phase 3 | Pending |
| TRAD-02 | Phase 3 | Pending |
| TRAD-03 | Phase 3 | Pending |
| TRAD-04 | Phase 3 | Pending |
| TRAD-05 | Phase 3 | Pending |
| UI-02 | Phase 3 | Pending |
| SOLN-01 | Phase 4 | Pending |
| SOLN-02 | Phase 4 | Pending |
| SOLN-03 | Phase 4 | Pending |
| SOLN-04 | Phase 4 | Pending |
| EVAL-01 | Phase 4 | Pending |
| EVAL-02 | Phase 4 | Pending |
| EVAL-03 | Phase 4 | Pending |
| EVAL-04 | Phase 4 | Pending |
| EVAL-05 | Phase 4 | Pending |
| NEWS-01 | Phase 5 | Pending |
| NEWS-02 | Phase 5 | Pending |
| NEWS-03 | Phase 5 | Pending |
| ADMN-01 | Phase 5 | Pending |
| ADMN-02 | Phase 5 | Pending |
| ADMN-03 | Phase 5 | Pending |
| ADMN-05 | Phase 5 | Pending |
| NEWS-04 | Phase 6 | Pending |
| ADMN-04 | Phase 6 | Pending |
| ELIM-01 | Phase 6 | Pending |
| ELIM-02 | Phase 6 | Pending |
| ELIM-03 | Phase 6 | Pending |
| UI-03 | Phase 6 | Pending |
| UI-04 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 48 total
- Mapped to phases: 48
- Unmapped: 0

---
*Requirements defined: 2026-04-16*
*Last updated: 2026-04-16 after roadmap creation*
