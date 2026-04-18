# Bharat Bites & Brews — Competition Spec

This document is the source of truth for the competition model. Saved from user input.
See the full document in the conversation history.

## Key Alignment Requirements

### What exists and works:

- Auth, teams, sub-accounts (strategist/trader)
- Game state machine (start/pause/resume)
- Admin portal (7 tabs)
- Basic stock simulation engine
- Trading (buy/sell with 30% cap)
- LLM evaluation via OpenRouter
- News injection + LLM-generated news
- Crisis events with market pause
- Elimination mechanics
- Leaderboard
- Caseline/portfolio assignment

### What needs to be built or aligned:

1. **Archetype System** — 16 team archetypes with asymmetric balance sheets, benchmark bands, archetype-relative scoring
2. **Decision Levers** — 5 categories (Pricing, Marketing, Supply Chain, New Product, Trading) submitted every 20 minutes
3. **Enhanced Price Formula** — DecisionImpact (4 fundamentals) + EventShock + SentimentFlow + Noise + Smoothing
4. **Round/Quarter Structure** — Admin-controlled rounds with War Room (no trading) + Live Floor (trading open) phases
5. **Short Selling** — Teams can short other stocks with margin requirements
6. **Enhanced Dashboard** — Per-team tiles (revenue, margin, market share, NPS, distribution, inventory, cash, CAC/LTV, trading P&L)
7. **Press Release System** — Teams publish press releases that LLM incorporates into news
8. **Final Scoring** — 50% stock performance + 25% trading P&L + 25% strategy memo
9. **Distress Triggers** — 3 consecutive loss quarters = forced divestment/dilution
10. **M&A Mechanics** — Acquire distressed rivals (later rounds)
11. **Influence Points** — Creator economy mechanic (Round 4+)
12. **Circuit Breakers** — ±25% per quarter price limits

### Admin control philosophy:

- Admin decides which rounds/features to activate
- Not all features are mandatory for every competition
- Admin maps portfolios to teams manually
- Admin controls round timing (not fixed)
- Admin can inject any event at any time
