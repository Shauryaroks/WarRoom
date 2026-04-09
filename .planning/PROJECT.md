# Corporate Strategy Case Arena

## What This Is

A high-intensity, synchronous multiplayer business simulation platform for competitive academic environments. 50 teams act as publicly traded companies navigating a compressed 6-7 hour economic lifecycle, communicating strategy through natural language directives parsed by an LLM "Board of Directors" while managing real-time equity positions in a live stock market.

## Core Value

The ONE thing that must work: **Real-time multiplayer business simulation with LLM-driven strategic evaluation that produces a winner through progressive eliminations.**

## Why This Matters

- Merges qualitative strategic reasoning with quantitative financial outcomes
- Success requires operational excellence (revenue, profit) AND narrative coherence, market timing, and psychological acumen
- Unlike static case competitions, operates as a live, reflexive market where every action alters the information environment for all participants

## Key Constraints

- **Event Format**: Campus-wide competitive seminar, 6-7 hours continuous
- **Venue**: Physical seminar hall with projector displays and reliable WiFi
- **Capacity**: Exactly 50 teams (1 interface/connection per team)
- **Team Structure**: 1 player per team interface
- **Operational Reality**: Live orchestration by administrative team with manual override capabilities

## Technical Stack

- **Backend**: FastAPI (Python 3.11) with async PostgreSQL (asyncpg), Redis for queue/caching
- **Frontend**: React with Bloomberg terminal aesthetic (high-density, monospace, real-time scrolling)
- **LLM**: Claude Sonnet via OpenRouter for directive parsing and evaluation
- **Real-time**: WebSocket feeds for market data and team updates
- **Background Processing**: Celery workers for LLM processing

## Core Features

### Registration & Onboarding
- Team name, ticker symbol ($XXX), contact email, password
- Manual admin approval with portfolio assignment (SWOT profiles)
- API key generation upon approval

### Gameplay Loop
- Observation: Monitor market wire, stock prices, competitor holdings
- Strategy: Draft Markdown directives (max 2000 chars)
- Submission: 10-minute cooldown between directives
- Processing: LLM evaluates and returns feedback
- Trading: Real-time stock transactions allowed during cooldown

### Economic Engine
- Demand function based on marketing spend and price levels
- Revenue/profit calculation with R&D efficiency gains
- Liquidity tracking (cash + 50% of stock holdings)
- Bankruptcy triggers on negative cash

### Stock Market
- Continuous double auction (market orders only)
- Price discovery via fundamental + market sentiment
- Ownership limits (max 25% of any single team's shares)
- Delisting on elimination (stock = $0)

### Elimination Mechanics
- Manual admin-triggered "Market Purges" (bottom 50%)
- Strategic Score = 50% Market Cap + 50% Liquidity
- Bankruptcy auto-elimination
- Final 3-4 teams present IRL to live jury

### The Board (LLM System)
- Parses directives, assigns Vibe Scores (Consistency, Macro Sensitivity, Aggression)
- Generates narrative feedback and public headlines
- Extraction confidence affects execution penalty
- Multi-layer prompt injection defenses

## Out of Scope

- Mobile applications (web-only)
- Persistent tournaments/league system (single-event focus)
- AI opponent teams (human-only)
- Social features beyond team communication to Board
- Post-event analytics for participants (admin-only)

---

## Requirements

### Active

- [ ] Real-time multiplayer game state management for 50 concurrent teams
- [ ] Team registration with admin approval workflow
- [ ] Markdown directive submission with 10-minute cooldown
- [ ] LLM-powered directive evaluation returning structured JSON
- [ ] Real-time WebSocket market data feed (prices, news, eliminations)
- [ ] Stock trading system (buy/sell at market price)
- [ ] Economic simulation engine (demand, revenue, profit, liquidity)
- [ ] Manual admin purge trigger for eliminations
- [ ] Bankruptcy detection and auto-elimination
- [ ] Final presentation phase with IRL component
- [ ] Bloomberg terminal-style UI with real-time tickers
- [ ] Admin panel for game orchestration

---

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| LLM via OpenRouter | Reliable API with fallback models, cost-effective | — Pending |
| Manual purge triggers | Allows admin to manage game rhythm and energy | — Pending |
| Black box scoring | Forces teams to optimize absolute performance, not formula | — Pending |
| Prose over parameters | Tests strategic reasoning, not UI mastery | — Pending |

---

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

*Last updated: 2026-04-10 after initialization*