# Phase 10: Enhanced Trading - Context

**Gathered:** 2026-04-17
**Status:** SCOPE REDUCED TO ZERO — user decision 2026-04-17
**Last updated:** 2026-04-17

## SCOPE REDUCTION NOTICE

Per user decision on 2026-04-17: Phase 10 is skipped entirely. v1 trading (buy/sell at market price, 30% external-ownership cap) is sufficient. No short selling, no margin, no circuit breakers, no 15% position cap, no separate trading P&L. All D-01 through D-26 below are DEFERRED to potential future phases.

The requirements TRAD-06 / TRAD-07 / TRAD-08 / TRAD-09 are de-scoped from v2.0. Update REQUIREMENTS.md accordingly when archiving.

The CONTEXT below is preserved as reference for a future Phase 10 revival if the competition model ever needs these mechanics.

---

<domain>
## Phase Boundary

Add short selling with cash-locked margin, 15%-of-own-market-cap position limits, separate trading P&L tracking (realized + unrealized), and ±25%-per-quarter circuit breakers that halt trading on individual stocks. Extends the existing buy/sell pipeline without rewriting it.

Requirements: TRAD-06 (30% margin short), TRAD-07 (15% position limit), TRAD-08 (separate trading P&L), TRAD-09 (±25%/quarter circuit breakers).

</domain>

<decisions>
## Implementation Decisions

### Margin Source & Mechanics
- **D-01:** Margin is carved from team cash. New field `Team.margin_reserved: Decimal(15,2)` (default 0). Opening a short of N shares at price P deducts `0.30 * N * P` from `team.cash` into `team.margin_reserved`. Closing the short returns `margin + P&L` to cash.
- **D-02:** Natural cash-based limit: a team cannot short more than `team.cash / (0.30 * price)` shares in aggregate across all shorts. No separate pool, no admin tuning knob for short buying power in Phase 10.
- **D-03:** No margin calls. If a short moves against the team and unrealized loss exceeds the margin, nothing auto-closes. The team can still cover manually. This is acceptable for a college competition — matches the FMCG spec philosophy of no forced liquidation beyond the existing distress-trigger framework (Phase 12).
- **D-04:** No share-borrowing model. A short just establishes a negative `shares_owned` row; the game does not check whether enough float is available to borrow, does not charge a borrow fee, and does not pay short-rebate. Simplification accepted — competitors aren't playing with realistic prime-broker mechanics.

### Short Position Representation
- **D-05:** Shorts stored as **negative `shares_owned`** on the existing `StockHolding` table. No new table. `total_cost_basis` stores the entry-side cash flow (positive for a short sale — the short opener received cash). A holding row represents the *net* position per (owner, target) pair.
- **D-06:** Accepted tradeoff: every downstream consumer of StockHolding must be sign-aware. Portfolio view, leaderboard net worth, 30% cap check, mark-to-market P&L — all need to handle negative `shares_owned`. Document sign semantics inline and in a module docstring.
- **D-07:** Short-specific fields needed on StockHolding: `margin_locked: Decimal(15,2)` (per-position margin reserved; null/0 for longs), `short_entry_price: Decimal(10,2)` (avg entry price for the short side of the net position; null for pure longs). A holding that flips sign (e.g. covered short → long) resets these accordingly.
- **D-08:** When a row's `shares_owned` crosses zero (full cover or full sell), the row is not deleted — `shares_owned` goes to 0 and the row stays for audit. Re-opening a position reuses the row.

### Position Limits + 30% Cap Reconciliation
- **D-09:** TRAD-07 15% limit is **notional INR**: `|shares_owned| * current_price <= 0.15 * owner_market_cap` per (owner, target) pair. `owner_market_cap = owner.stock_price * owner.shares_outstanding`. Enforced at BUY / SHORT / SHORT_INCREASE paths (not on mark-to-market drift).
- **D-10:** v1 30% external-ownership cap continues to apply to **long holdings only**. Shorts don't own shares, they borrowed — they don't count toward "external investors own X% of target". Formula for 30% cap: `sum(holdings.shares_owned WHERE target_team_id = T AND shares_owned > 0) <= 0.30 * T.shares_outstanding` (i.e. only positive shares_owned count).
- **D-11:** The 15% notional uses the SAME sign-aware holding row — if a team has +100 long AND -50 short on the same target (which shouldn't happen if we merge into one row, but defensive), it's `|net| * current_price`.
- **D-12:** A team cannot hold its OWN stock (existing v1 rule). Extends: a team cannot SHORT its own stock either. Validator at endpoint level.

### Trading P&L (TRAD-08)
- **D-13:** New field `Team.realized_trading_pnl: Decimal(15,2)` (default 0). Running total of closed-position gains/losses. Incremented on SELL (for longs) and COVER (for shorts). Never decremented except on game restart.
- **D-14:** Unrealized P&L computed on-the-fly from `StockHolding` rows: `sum(shares_owned * (current_price - cost_basis_per_share))` for longs, `sum(|shares_shorted| * (entry_price - current_price))` for shorts. Not stored.
- **D-15:** Trading P&L is **separate** from `team.cash`. It's a reporting metric for the final scoring engine (Phase 12, 25% weight). Cash reflects actual liquid balance; realized_trading_pnl is the cumulative sum of gains/losses even if the cash has been re-deployed into new positions.
- **D-16:** Portfolio API (`GET /api/v1/trading/portfolio`) returns `realized_trading_pnl`, `unrealized_trading_pnl`, `total_trading_pnl`, per-holding unrealized breakdown. Phase 12's final scoring reads `realized + unrealized at game end`.

### Circuit Breakers (TRAD-09)
- **D-17:** Each Team gets new fields: `circuit_reference_price: Decimal(10,2)` (set to `stock_price` at quarter start / admin-reset), `circuit_halted: bool` (default false), `circuit_halted_at: DateTime nullable`.
- **D-18:** Evaluation: on every tick after `compute_price`, check `|stock_price - circuit_reference_price| / circuit_reference_price >= 0.25`. If yes AND `circuit_halted` is false, flip `circuit_halted = true`, set `circuit_halted_at`, broadcast `circuit_breaker_triggered` WS event.
- **D-19:** Halt behavior: while `circuit_halted` is true, ALL trading on that stock is blocked — buy / sell / short / cover all return 409 with "Trading halted (circuit breaker)". Simulation ENGINE continues ticking the price (drift + sentiment + shock + noise keep running). Only trading endpoints reject.
- **D-20:** Reset triggers (two paths): (a) Admin clicks "RESET_BREAKER" on the stock → `circuit_halted = false`, `circuit_reference_price = current stock_price`; broadcast `circuit_breaker_reset`. (b) Quarter rolls over (Live Floor → War Room → new Live Floor) → all breakers reset automatically, `circuit_reference_price = current stock_price`.
- **D-21:** Quarter-start reference price is captured at the moment the GAME enters Live Floor (game_service transition hook). Existing War Room → Live Floor transition already has a hook point in `game_service.py`.

### UI Surface
- **D-22:** Trading panel: existing BUY / SELL buttons unchanged. New SHORT and COVER buttons appear when the team has cash >= minimum margin. Trading panel shows current net position per target (long shares, short shares, avg entry) + P&L on each.
- **D-23:** Stock card (in MarketsPanel): HALTED badge appears when `circuit_halted = true`. Trading buttons disabled with tooltip "Trading halted — circuit breaker". Price continues to animate.
- **D-24:** Portfolio page: two rows of cards — LONGS (positive shares_owned) and SHORTS (negative shares_owned). Each card shows shares, entry/cost basis, current price, unrealized P&L (green/red). Header shows realized + unrealized + total trading P&L.
- **D-25:** Admin portal: new "BREAKERS" row in MARKETS tab listing stocks with `circuit_halted = true`, with RESET_BREAKER button per row. Also auto-reset info note ("breakers auto-reset on quarter rollover").

### Data Model Summary (delta vs current)
- **D-26:** Migration 006:
  - Team: add `margin_reserved Decimal(15,2) default 0`, `realized_trading_pnl Decimal(15,2) default 0`, `circuit_reference_price Decimal(10,2) nullable`, `circuit_halted bool default false`, `circuit_halted_at DateTime nullable`
  - StockHolding: add `margin_locked Decimal(15,2) default 0`, `short_entry_price Decimal(10,2) nullable`
  - Transaction: add `SHORT` and `COVER` values to TransactionType enum
  - No new tables.

### Claude's Discretion
- Exact wording of error responses on 15% cap exceeded, 30% cap exceeded, halted stock, insufficient margin
- Whether to warn the user client-side before hitting a cap (pre-submit validation) or rely solely on 409 responses
- Chart animation of breaker events (flash banner vs modal)
- Admin visibility of each team's margin_reserved (probably yes — add to Teams tab)
- Exact UI layout of LONG/SHORT split in Portfolio

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Specs
- `.planning/REQUIREMENTS.md` — TRAD-06, TRAD-07, TRAD-08, TRAD-09
- `.planning/CASELINE_SPEC.md` — FMCG competition model, circuit breaker context
- `.planning/PROJECT.md` — v2.0 milestone goals

### Prior Phase Context
- `.planning/phases/09-enhanced-simulation-engine/09-CONTEXT.md` — Phase 9 per-tick engine is the hook point for circuit breaker evaluation (D-18)
- `.planning/STATE.md` — Short-selling-margin blocker explicitly listed; resolved by D-01 in this CONTEXT

### Existing Code
- `server/app/services/trading_service.py` — Current buy/sell with 30% cap via SELECT FOR UPDATE; extend with short + cover flows
- `server/app/api/trading.py` — Existing /buy, /sell, /preview endpoints; add /short, /cover
- `server/app/models.py` — Team, StockHolding, Transaction, TransactionType (add SHORT + COVER values)
- `server/app/services/simulation_service.py` — Per-tick engine; hook post-compute_price to evaluate breaker trigger (D-18)
- `server/app/services/game_service.py` — War Room → Live Floor transition; reset circuit_reference_price at Live Floor entry (D-20, D-21)
- `client/src/components/game/TradingPanel.tsx` — Existing buy/sell UI; extend with SHORT/COVER buttons
- `client/src/app/portfolio/*` — Portfolio page; split into LONGS / SHORTS sections
- `client/src/components/admin/*` — Admin MARKETS tab; add BREAKERS row

### Operational Refs
- `server/alembic/versions/005_*` — Phase 9 migration template for Phase 10's migration 006
- Phase 9 SUMMARY files document the per-tick engine hook points (Wave 2 simulation_service rewrite)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Atomic trade pattern with `SELECT FOR UPDATE`** in trading_service — the short/cover paths reuse this lock approach to prevent race conditions on margin_reserved and position limits
- **StockHolding upsert pattern** — existing buy path increments shares_owned; short path decrements it
- **30% cap validator in trading_service** — becomes longs-only; the 15% notional cap is a new validator added alongside
- **WebSocket broadcast after commit** — reuse for `circuit_breaker_triggered` / `circuit_breaker_reset` events
- **Portfolio API response shape** — extend with trading_pnl fields; no schema rewrite

### Established Patterns
- Decimal arithmetic for all money math (cash, margin, P&L)
- Transaction logging per trade (existing table)
- Celery Beat 60s tick → Phase 9 compute_price → per-tick breaker check is the natural insertion point
- Admin MARKETS tab already shows per-team stock table — add a column or row for circuit state

### Integration Points
- Phase 9 per-tick engine: breaker check runs AFTER compute_price. Shorts' mark-to-market affects team's total equity shown on leaderboard.
- Phase 12 final scoring: `realized_trading_pnl + unrealized_trading_pnl` at game end contributes 25% of final score.
- Phase 7 archetype starting cash: some archetypes (Legacy Giant at ₹400 Cr) naturally have more short buying power; D-02's natural limit preserves this as intended.

### Risks / Pitfalls
- **Sign-flip bugs**: every function reading `shares_owned` needs to handle negative. High risk of portfolio display bugs, leaderboard miscounts, 30% cap off-by-one. Mitigate with a module docstring on StockHolding + concentrated sign-aware helpers in trading_service.
- **Breaker check latency**: if breaker is checked synchronously inside the 60s tick loop, a trip could delay price broadcast. Keep the check cheap (single field compare), happen inside the existing tick transaction.
- **Cover transaction cash flow**: closing a short means paying `|shares| * current_price` to buy back, but the entry received `|shares| * entry_price` — realized P&L = entry_received - cover_paid. Margin released separately. Easy to double-count.
- **Admin RESET_BREAKER concurrency**: if two admins reset at the same moment, or a reset fires just as a new breach triggers, ensure the operation is idempotent (check current state before flipping).

</code_context>

<specifics>
## Specific Ideas

- Short/cover UX should feel parallel to buy/sell — same form structure, same validation messaging pattern. Color the SHORT button differently (maybe red-orange accent vs blue for BUY) to signal "this is a different kind of trade".
- Circuit breaker visual: HALTED badge should be prominent but not disruptive — red border + monospace "HALTED" text on the stock card, not a modal overlay.
- Portfolio view should show a single net P&L number prominently so teams can see at a glance whether trading is helping or hurting their score.

</specifics>

<deferred>
## Deferred Ideas

- **Margin call mechanics** — forced liquidation if unrealized loss > margin. Not in Phase 10 per D-03. If competition needs this, Phase 11+.
- **Short borrow fee / rebate** — not modeled per D-04.
- **Different margin percentages per team archetype** — fixed 30% for everyone. If admin wants to tune per-archetype, future phase.
- **Pair trades or spread orders** — Phase 10 is single-leg only.
- **Stop-loss / take-profit orders** — not in scope; trader places market orders only.
- **Circuit breaker flexibility** — ±25% is hardcoded per TRAD-09. Admin-tunable thresholds deferred.
- **Auto-close all shorts on team elimination** — current behavior: eliminated team's shorts remain frozen (team status blocks further trading). Clean-up mechanic deferred to Phase 12 endgame scoring work.

</deferred>

---

*Phase: 10-enhanced-trading*
*Context gathered: 2026-04-17*
