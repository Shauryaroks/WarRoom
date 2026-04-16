# Complex — Case Competition Platform

## What This Is

A real-time case competition platform where 32-40 teams compete by solving business caselines, submitting strategic solutions evaluated by an LLM with human-in-the-loop validation, and trading stocks in each other's companies. Teams are progressively eliminated based on performance across simulation rounds. Built with a Next.js frontend (Vercel) and a fully dockerized backend (FastAPI, PostgreSQL, Redis/Celery, Caddy).

## Core Value

The simulation engine — teams submit solutions, the LLM evaluates them with admin oversight, and the market reacts in real-time. If this loop doesn't work, nothing else matters.

## Current Milestone: v2.0 Final Integration

**Goal:** Align platform with the "Bharat Bites & Brews" FMCG Stock Wars competition model — decision levers, enhanced simulation, archetype-relative scoring, short selling, admin-controlled dynamic event flow.

**Target features:**
- Decision Levers system (5 categories submitted every 20 min)
- Enhanced price formula (4 weighted fundamentals + event shock + sentiment + noise)
- Archetype benchmark system (relative scoring per team archetype)
- Round/Quarter structure (War Room + Live Floor, admin-controlled)
- Short selling with margin requirements
- Enhanced dashboard tiles (revenue, margin, market share, NPS, cash, trading P&L)
- Final scoring engine (50% stock + 25% trading P&L + 25% memo)
- Press release channel
- Sample archetype dossiers (4 pre-built)
- Circuit breakers and distress triggers

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User registration and login with team-based accounts
- [ ] Two sub-accounts per team: Strategist (solutions + view-only market) and Trader (buy/sell stocks + news)
- [ ] Admin portal to approve/remove teams, start/pause/resume games
- [ ] Lobby system where teams wait for admin to start the game
- [ ] Admin pre-creates caselines (company portfolios) assigned to teams
- [ ] Teams submit solutions in Word/Markdown format within initial 1-hour window
- [ ] LLM evaluates solutions considering: other companies' actions, global/local news, past company actions
- [ ] Human-in-the-loop: admin validates/edits LLM scoring before it takes effect
- [ ] Simulation engine: 20-min real-time windows map to 3-month simulated periods
- [ ] Stock price updates every minute using formula (random walk) + LLM quality adjustment
- [ ] Microtweak submissions allowed during simulation (no full resubmission cooldown)
- [ ] News system: LLM-generated + admin-injectable news events updating in real-time
- [ ] Crisis events: admin injects major crises, market pauses, teams solve, market resumes
- [ ] Stock trading: simple buy/sell at current price, max 30% shareholding per external investor (company retains 70% minimum)
- [ ] All trading/investment actions validated in DB before execution
- [ ] Elimination: low-performing companies removed after each round
- [ ] Admin live dashboard: all teams' stock prices, submissions, scores in real-time
- [ ] Admin broadcast messages to all teams
- [ ] Bloomberg terminal-inspired UI
- [ ] Game state management: start, pause, resume

### Out of Scope

- Real-time chat between teams — not relevant to case comp format
- Mobile app — web-only, two browser tabs per team
- OAuth/social login — email/password sufficient for competition setting
- Order book / bid-ask trading — simple buy/sell at simulated price
- Manual stock price override by admin — prices driven by simulation engine only
- Video/audio communication — teams are physically co-located

## Context

- **Deployment target:** Single VPS with 8GB RAM, 4 vCPU, 50GB storage
- **Scale:** 32-40 teams, ~80 concurrent users (2 devices per team)
- **LLM provider:** OpenRouter API (Claude configured later)
- **Competition format:** Physical event, teams co-located, two devices per team
- **Simulation cadence:** Stock prices update every 1 minute, caseline evolves every 20-minute window (representing 3 simulated months)
- **Game flow:**
  1. Teams register, admin approves, teams enter lobby
  2. Admin starts game — initial caseline presented, 1 hour to submit solution (3-month strategic roadmap)
  3. Simulation begins — market runs parallel, stock prices tick every minute, news updates live
  4. Teams can submit microtweaks to their strategy during simulation
  5. Every 20 real-time minutes = 3 simulated months of caseline evolution
  6. Admin injects crisis event — market pauses, teams get time to solve crisis
  7. Market resumes, microtweaks + trading resume
  8. Low performers eliminated after each round
  9. Repeat until final round determines winner

## Constraints

- **Infrastructure:** Single server (8GB/4vCPU/50GB) — must handle 80 concurrent WebSocket connections + LLM calls + simulation ticks
- **Tech stack:** Next.js (Vercel), FastAPI, PostgreSQL, Redis/Celery, Caddy, Alembic, SQLAlchemy — all backend services dockerized
- **LLM latency:** Human-in-the-loop means evaluation isn't instant — UI must handle async approval flow
- **Concurrency:** Redis/Celery for background simulation ticks, LLM calls, and stock price calculations to avoid blocking the API
- **Data integrity:** All share transactions and portfolio changes must be atomically validated in PostgreSQL (no race conditions on 30% cap)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Two sub-accounts per team (Strategist + Trader) | Enforces role separation, strategist gets view-only market access | — Pending |
| OpenRouter as LLM gateway | Flexibility to swap models, Claude configured later | — Pending |
| Simple buy/sell (no order book) | Reduces complexity, price set by simulation not market makers | — Pending |
| Formula + LLM for stock prices | Random walk base gives organic movement, LLM adjusts for solution quality | — Pending |
| Human-in-the-loop before LLM actions take effect | Prevents LLM from scoring too high/low without admin review | — Pending |
| Elimination-based progression | Narrows field each round, creates stakes | — Pending |
| Admin pre-creates caselines | Ensures balanced, curated competition scenarios | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-16 after initialization*
