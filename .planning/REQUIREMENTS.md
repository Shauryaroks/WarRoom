# Requirements: Complex

**Defined:** 2026-04-16
**Updated:** 2026-04-16 (v2.0 Final Integration)
**Core Value:** The simulation engine -- teams submit solutions, the LLM evaluates them with admin oversight, and the market reacts in real-time.

## v2 Requirements

Requirements for Final Integration milestone. Aligned with Bharat Bites & Brews competition model.

### Decision Levers

- [ ] **LEVER-01**: Teams submit decisions across 5 lever categories every 20 minutes (Pricing, Marketing, Supply Chain, New Product, Trading)
- [ ] **LEVER-02**: Each lever has configurable options (price change +/-15%, promo depth 0-40%, channel allocation, campaign theme)
- [ ] **LEVER-03**: Decision budgets scale with team archetype and last-quarter revenue

### Simulation Engine (Enhanced)

- [ ] **SIM-05**: Price formula uses 4 weighted fundamentals (Market Share 35%, Profitability 30%, Ops Efficiency 20%, Brand Health 15%)
- [ ] **SIM-06**: Each fundamental scored relative to team's archetype benchmark band (not absolute)
- [ ] **SIM-07**: Event shocks produce +/-3% to +/-15% discrete price jumps
- [ ] **SIM-08**: Sentiment flow from net trading pressure (heavily shorted stock falls, longed rises)
- [ ] **SIM-09**: Decision impact phases in over 3-5 minutes (smoothing prevents instant snaps)

### Archetype System

- [ ] **ARCH-01**: Admin assigns archetype to each team with benchmark bands for all 4 fundamentals
- [ ] **ARCH-02**: 4 pre-built archetype dossiers with balance sheets, SWOT, cost structures, and benchmark bands
- [ ] **ARCH-03**: Archetype-relative scoring: team's z-score against its archetype's fair expectations band

### Round Structure

- [ ] **ROUND-01**: Admin controls round/quarter transitions: War Room (no trading) and Live Floor (trading open)
- [ ] **ROUND-02**: War Room phase: macro brief, performance review, operating plan submission
- [ ] **ROUND-03**: Live Floor phase: market ticks, trading open, news streams, 20-min decision cycles

### Trading (Enhanced)

- [ ] **TRAD-06**: Short selling with 30% margin requirement on position value
- [ ] **TRAD-07**: Position limit: max 15% of own market cap in any single stock
- [ ] **TRAD-08**: Trading P&L tracked separately from operating P&L, feeds into final score
- [ ] **TRAD-09**: Circuit breakers: +/-25% per quarter price limits halt trading on that stock

### Dashboard (Enhanced)

- [ ] **DASH-01**: Per-team live tiles: revenue QTD, EBITDA margin %, market share %, NPS/brand sentiment
- [ ] **DASH-02**: Market-wide tiles: BCX composite index, sector indices, biggest movers, short interest leaderboard
- [ ] **DASH-03**: Team-only tiles: cash position, inventory turnover, trading P&L (visible only to own team + judges)

### Scoring & Endgame

- [ ] **SCORE-01**: Final score = 50% stock price performance + 25% trading portfolio P&L + 25% strategy memo
- [ ] **SCORE-02**: Final strategy memo submission (1000 words max, LLM + human scored)
- [ ] **SCORE-03**: Distress triggers: 3 consecutive quarters missing archetype benchmark -> forced divestment/dilution event

### Press & Communication

- [ ] **PRESS-01**: Teams publish press releases via a press channel; LLM incorporates into live news
- [ ] **PRESS-02**: Press releases become public analyst commentary visible to all teams

### Sample Portfolios

- [ ] **PORT-01**: 4 pre-built archetype dossiers: Legacy Giant, D2C Challenger, Regional Leader, Premium Niche

## Future Requirements

- M&A mechanics (acquire distressed rivals)
- Influence Points system (creator economy spending)
- Spectator mode for audience viewing

## Out of Scope

| Feature | Reason |
|---------|--------|
| Automated archetype assignment | Admin assigns manually for balance |
| Real-world data integration | Closed simulation, no external feeds |
| Mobile-optimized layout | Desktop two-device play only |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ARCH-01 | Phase 7 | Pending |
| ARCH-02 | Phase 7 | Pending |
| PORT-01 | Phase 7 | Pending |
| LEVER-01 | Phase 8 | Pending |
| LEVER-02 | Phase 8 | Pending |
| LEVER-03 | Phase 8 | Pending |
| ROUND-01 | Phase 8 | Pending |
| ROUND-02 | Phase 8 | Pending |
| ROUND-03 | Phase 8 | Pending |
| SIM-05 | Phase 9 | Pending |
| SIM-06 | Phase 9 | Pending |
| SIM-07 | Phase 9 | Pending |
| SIM-08 | Phase 9 | Pending |
| SIM-09 | Phase 9 | Pending |
| ARCH-03 | Phase 9 | Pending |
| TRAD-06 | Phase 10 | Pending |
| TRAD-07 | Phase 10 | Pending |
| TRAD-08 | Phase 10 | Pending |
| TRAD-09 | Phase 10 | Pending |
| PRESS-01 | Phase 11 | Pending |
| PRESS-02 | Phase 11 | Pending |
| DASH-01 | Phase 11 | Pending |
| DASH-02 | Phase 11 | Pending |
| DASH-03 | Phase 11 | Pending |
| SCORE-01 | Phase 12 | Pending |
| SCORE-02 | Phase 12 | Pending |
| SCORE-03 | Phase 12 | Pending |

**Coverage:**
- v2 requirements: 27 total (9 categories)
- Mapped to phases: 27
- Unmapped: 0

---
*Requirements defined: 2026-04-16*
*Last updated: 2026-04-16 after v2.0 roadmap creation*
