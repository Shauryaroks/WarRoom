# Phase 9: Enhanced Simulation Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 09-enhanced-simulation-engine
**Areas discussed:** Fundamental value source, Price formula integration, Benchmark key reconciliation, Sentiment flow mechanics, Event shock triggers, Decision impact smoothing, Compute cadence, Admin visibility

---

## Fundamental Value Source

| Option                          | Description                                                                                      | Selected |
| ------------------------------- | ------------------------------------------------------------------------------------------------ | -------- |
| (a) LLM-only                    | LLM evaluates decisions + operating plan each quarter, outputs the 4 fundamental scores directly |          |
| (b) Deterministic formula       | Each lever setting adds/subtracts from fundamentals via hardcoded mapping                        |          |
| (c) Hybrid LLM + admin approval | LLM proposes deltas → staged PENDING_APPROVAL → admin reviews/edits/approves → deltas applied    | ✓        |

**User's choice:** Hybrid LLM + admin approval.
**Notes:** Reuses Phase 5 evaluation pattern. Pure LLM doesn't give admin the editing checkpoint. Pure formula can't judge semantic lever choices like "Marketing campaign theme: Nostalgia". Starting values seeded from archetype benchmark band midpoints (not a separate dossier field).

---

## Price Formula Integration

| Option                | Description                                                                                                                                                                 | Selected |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Target + interpolate  | Keep v1 `interpolate_price` traversal; layer sentiment + shock as per-tick modifiers on current price; compute new `target_price` at quarter boundary from weighted z-score |          |
| Full per-tick rewrite | Drop `interpolate_price`, `target_price`, `ticks_to_target`. Every tick: `new_price = prev * (1 + weighted_z_drift + sentiment + shock + noise)`                            | ✓        |

**User's choice:** Full per-tick rewrite (overrode Claude's recommendation of the safer target+interpolate approach).
**Notes:** Preference for the clean architecture and complete removal of v1 pipeline. Accepted risk of rewriting battle-tested interpolation code.

---

## Benchmark Key Reconciliation

| Option                   | Description                                                                                                                                | Selected |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| (a) Alias-relabel only   | Keep DB schema `market_share/margin/growth/ops_efficiency`; relabel in UI/docs (`margin`→"Profitability", `growth`→"Brand Health")         | ✓        |
| (b) Migrate to v2 keys   | Rewrite benchmark_bands JSON to `market_share/profitability/ops_efficiency/brand_health` across validator, seed presets, types, Phase 7 UI |          |
| (c) Add parallel v2 keys | Keep existing 4 keys and add `profitability`/`brand_health` alongside, validator accepts both                                              |          |

**User's choice:** Alias-relabel only (aligned with Claude's recommendation).
**Notes:** Avoids cascading changes across validator, seed presets, Phase 7 code. Weights 35/30/20/15 map to MS/margin/ops/growth. True Brand Health signal deferred to Phase 11.

---

## Sentiment Flow Mechanics

| Option                         | Description                                                                               | Selected |
| ------------------------------ | ----------------------------------------------------------------------------------------- | -------- |
| Rolling 5-min volume-weighted  | Sum signed INR volume over last 5 min, normalize by market cap, clamp to ±0.3%/tick       |          |
| Rolling quarter count-weighted | Count of buy trades minus sell trades over current quarter; simpler but whale-blind       |          |
| Last-tick-only instantaneous   | Look at trades in last 60s only; no window, no decay; cheapest but jittery on thin volume | ✓        |

**User's choice:** Last-tick-only instantaneous (overrode Claude's recommendation of rolling 5-min volume-weighted).
**Notes:** Preference for simplicity. Known tradeoff: thin trading ticks flip sentiment sign. Accepted on assumption that 40 teams × 2 traders will produce enough volume in practice.

---

## Event Shock Triggers

| Option                         | Description                                                                                                                                         | Selected |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Admin crisis + tagged LLM news | Admin crisis always fires. LLM news adds `is_event` + `severity` fields. Magnitude: MINOR±3%, MAJOR±8%, CATASTROPHIC±15%. Single-tick instant jump. | ✓        |
| Admin crisis only              | Only explicit admin injection fires shocks. LLM news is narrative-only. Simpler, but narrative and price decoupled.                                 |          |
| Admin crisis + all LLM news    | Every LLM news item produces a small shock on mentioned teams. Risk of runaway volatility.                                                          |          |

**User's choice:** Admin crisis + tagged LLM news (aligned with Claude's recommendation).
**Notes:** Severity and direction (positive/negative) are both structured fields. Crisis retains its "market pause" behavior independently of the shock application.

---

## Decision Impact Smoothing

| Option                 | Description                                                                                           | Selected |
| ---------------------- | ----------------------------------------------------------------------------------------------------- | -------- |
| Linear 5-min ramp      | Weighted_z_drift target ramps 0→full linearly over 5 ticks. New update mid-ramp cancels and restarts. | ✓        |
| Exponential ease-in    | `1 - exp(-t/tau)` with tau=2min. Organic chart feel but never fully reaches target.                   |          |
| Instant — no smoothing | Fundamentals change → drift jumps to full effect next tick. Violates SIM-09.                          |          |

**User's choice:** Linear 5-min ramp (aligned with Claude's recommendation).
**Notes:** Simple to reason about. Mid-ramp restart semantics captured in CONTEXT D-21 — new ramp starts from current drift value to avoid chart discontinuity.

---

## Compute Cadence

| Option                            | Description                                                                                                                                       | Selected |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| LLM per-quarter, math per-tick    | LLM eval once per team per quarter at Live Floor→War Room transition. Per-tick is pure math (batched SELECT + Python). Target <50ms for 40 teams. | ✓        |
| LLM per-quarter, math every-5-sec | Faster chart updates but 12x DB write load. Only justified for much more liquid-looking chart.                                                    |          |
| LLM + math both per-tick          | Rejected — 40 LLM calls/min costs ~₹25/hour and LLM latency exceeds tick interval.                                                                |          |

**User's choice:** LLM per-quarter, math per-tick (aligned with Claude's recommendation).
**Notes:** Compute budget is tight but achievable. One batched SELECT for all ACTIVE teams; PriceHistory inserts via `add_all`.

---

## Admin Visibility & Tunability

| Option                                                | Description                                                                                                                                                                                       | Selected |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| View + approve + override                             | Admin sees raw fundamentals, z-scores, drift. Fundamentals Queue (mirror of Evaluations) for approving LLM deltas with edit capability. Direct override endpoint bypasses LLM. Weights hardcoded. | ✓        |
| View + approve only                                   | Read fundamentals; only channel is approval queue. No direct override. Safer but slower.                                                                                                          |          |
| Full control (view + override + configurable weights) | Everything in option 1, plus weights configurable via Settings UI. More surface to test.                                                                                                          |          |

**User's choice:** View + approve + override (aligned with Claude's recommendation).
**Notes:** Direct override is the "break-glass" tool. Weights (35/30/20/15) stay hardcoded in Phase 9; configurable weights deferred.

---

## Claude's Discretion

Captured in CONTEXT.md `<decisions>` section at the end:

- Noise distribution tuning
- SELECT FOR UPDATE vs optimistic locking choice for fundamentals update
- Benchmark bands Redis caching (optional)
- Z-score clamp values

## Deferred Ideas

Captured in CONTEXT.md `<deferred>` section:

- Admin-configurable weights (Phase 11+)
- True Brand Health / NPS signal (Phase 11)
- Rolling-window sentiment + time decay (revisit if jitter becomes a problem)
- Short-specific sentiment weighting (Phase 10)
- M&A / distress triggers (Phase 12)
