# Phase 10: Enhanced Trading - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves alternatives considered.

**Date:** 2026-04-17
**Phase:** 10-enhanced-trading
**Areas discussed:** Margin source, Short position representation, Position limit + 30% cap reconciliation, Circuit breaker semantics

---

## Margin Source

| Option | Description | Selected |
|--------|-------------|----------|
| Carve from team cash | Team.margin_reserved field; opening a short moves 30% of notional from cash into margin_reserved | ✓ |
| Separate margin pool | Team.short_buying_power fixed at round start; shorts don't touch cash | |
| Hybrid — locked cash buffer | % of cash auto-reserved as margin; optional fallback to cash | |

**Selected:** Carve from team cash. Aligned with Claude's recommendation. Natural limit, single source of truth for liquidity, no new admin knobs in Phase 10.

---

## Short Position Representation

| Option | Description | Selected |
|--------|-------------|----------|
| Separate ShortPosition table | New table with entry_price, margin_locked, status; clean queryability | |
| Negative shares_owned on StockHolding | Reuse existing table; sign indicates direction | ✓ |
| StockHolding + position_type enum | Unified table with LONG/SHORT enum + margin/entry columns | |

**Selected:** Negative shares_owned (overrode Claude's recommendation of separate ShortPosition table). Simpler schema accepted with known tradeoff: every StockHolding consumer must be sign-aware.

---

## Position Limit + 30% Cap Reconciliation

| Option | Description | Selected |
|--------|-------------|----------|
| 15% by notional INR, 30% cap longs-only | 15%: \|shares\| * price <= 0.15 * owner_market_cap. 30% cap applies to longs only (shorts don't "own"). | ✓ |
| 15% by share count, shorts count toward 30% | \|shares\| / target.shares_outstanding. Shorts absolute-value count toward external-ownership cap. | |
| 15% by notional AND 30% combined | Both use \|notional\|. 30% sums abs longs + shorts. Most conservative. | |

**Selected:** 15% notional + 30% longs-only. Aligned with Claude's recommendation.

---

## Circuit Breaker Semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Quarter-start reference + admin-reset halt | Ref = price at quarter start; ±25% triggers halt on both directions; simulation engine keeps ticking; reset on admin click or quarter rollover | ✓ |
| Trailing 25% + auto-reset next tick | Rolling reference; auto-reset 1 minute after trip | |
| Quarter-start reference + same-direction only halt | Nuanced halt preserving counter-trade liquidity | |

**Selected:** Quarter-start reference + admin-reset halt. Aligned with Claude's recommendation.

---

## Claude's Discretion

Documented in CONTEXT.md `<decisions>` at the end:
- Error message wording
- Client-side pre-submit validation vs relying on 409s
- Chart animation of breaker events
- Admin visibility of margin_reserved
- Exact Portfolio UI layout

## Deferred Ideas

Documented in CONTEXT.md `<deferred>`:
- Margin calls
- Short borrow fees / rebates
- Per-archetype margin percentages
- Pair/spread trades
- Stop-loss / take-profit orders
- Admin-tunable circuit breaker thresholds
- Auto-close-on-elimination for shorts
