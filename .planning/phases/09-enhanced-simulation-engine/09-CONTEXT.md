# Phase 9: Enhanced Simulation Engine - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the v1 price formula (random walk + LLM quality_score → target_price → linear interpolation) with a rigorous per-tick price engine where stock prices reflect:

1. **Weighted 4-fundamental z-score** (Market Share 35%, Margin/Profitability 30%, Ops Efficiency 20%, Growth/Brand Health 15%) relative to each team's archetype benchmark band
2. **Event shocks** (±3-15%) from admin-injected crises and LLM-tagged news
3. **Sentiment flow** from net trading pressure (last-tick instantaneous)
4. **Linear 5-minute ramp** when fundamentals change (smoothed decision phase-in)
5. **Bounded Gaussian noise** for per-tick texture

Fundamentals are updated once per quarter (Live Floor → War Room transition) via a hybrid LLM-eval + admin-approval pipeline. Admin also gets a direct-override endpoint and a per-team view of fundamentals, z-scores, and drift.

This phase is backend-heavy. Minimal frontend surface: Strategist's Caseline panel shows fundamentals + z-score; admin portal gets a new Fundamentals Queue tab.

</domain>

<decisions>
## Implementation Decisions

### Fundamental Value Source

- **D-01:** Hybrid LLM + admin approval. At each Live Floor → War Room transition, a Celery task runs per team: LLM reads (current Decision row for the round, latest OperatingPlan, last-quarter fundamentals, archetype.benchmark_bands, team narrative context) and outputs `{market_share_delta, margin_delta, growth_delta, ops_efficiency_delta, narrative}` via structured JSON output. Pattern mirrors Phase 5 `evaluation_service.py`.
- **D-02:** Output is staged as a new `FundamentalEvaluation` row with `status=PENDING_APPROVAL`. Admin reviews in a new Fundamentals Queue tab, can edit the proposed deltas, then approves. Only on approval are deltas added to the team's stored fundamentals.
- **D-03:** Starting values for each fundamental = midpoint of the archetype's benchmark band. Set at archetype assignment time (`server/app/api/admin.py` archetype assign handler) — not a separate seed step.
- **D-04:** New Team fields: `fundamental_market_share`, `fundamental_margin`, `fundamental_growth`, `fundamental_ops_efficiency` (Decimal(10,4), nullable, populated on archetype assign). These replace the v1 `quality_score`-driven pipeline as the input to price math.

### Price Formula — Full Per-Tick Rewrite

- **D-05:** Drop `interpolate_price`, `Team.target_price`, `Team.ticks_to_target`. These v1 fields are deleted, not kept as fallback.
- **D-06:** Per-tick formula (in new `compute_price(team, tick_ctx)` in `simulation_service.py`):
  ```
  weighted_z = 0.35 * z(market_share) + 0.30 * z(margin) + 0.20 * z(ops_efficiency) + 0.15 * z(growth)
  drift_target = clamp(0.15 * weighted_z, -0.05, +0.05)   # ±5% per-tick drift cap
  drift_now = ramp_fraction * drift_target                 # 0→1 over 5 ticks after fundamentals update
  sentiment = last_tick_sentiment(team_id)                 # see D-08
  shock = shock_this_tick(team_id) or 0                    # see D-09
  noise = gauss(0, 0.02) bounded to ±0.04
  new_price = prev_price * (1 + drift_now + sentiment + shock + noise)
  new_price = max(Decimal("0.01"), round(new_price, 2))
  ```
- **D-07:** `z(fundamental)` is a signed distance from the archetype band: `z = 0` at band midpoint, `z = +1` at band max, `z = -1` at band min, linear extrapolation beyond. Clamped to ±2 to prevent runaway.

### Benchmark Keys — Alias-Relabel Only

- **D-10:** Keep the existing DB schema unchanged: `market_share / margin / growth / ops_efficiency`. Validator in `server/app/api/admin.py:1427` and preset archetypes untouched.
- **D-11:** Relabel in UI and docs: `margin` renders as "Profitability"; `growth` renders as "Brand Health". Weights 35/30/20/15 map to MS/margin/ops_efficiency/growth respectively.
- **D-12:** If true Brand Health / NPS-style signal is wanted later, that's Phase 11 (dashboard tiles) scope — out of this phase.

### Sentiment Flow — Last-Tick Instantaneous

- **D-13:** Each tick, compute signed INR volume imbalance from `Transaction` rows in the last 60 seconds (where `target_team_id = team.id`, `tx_type in (BUY, SELL)`). Buys positive, sells negative.
- **D-14:** Normalize: `sentiment_raw = (net_inr_volume / team.market_cap)`. Per-tick drift contribution: `sentiment = clamp(sentiment_raw * 0.02, -0.003, +0.003)` — max ±0.3% per tick.
- **D-15:** No rolling window, no time decay, no count-weighted alternative. Known tradeoff: thin trading ticks produce jittery sign flips — accepted on the basis that 40 teams × 2 traders typically produces enough volume.

### Event Shocks — Admin Crisis + Tagged LLM News

- **D-16:** Two shock sources:
  1. **Admin crisis injection** — always fires on the team(s) named by admin. Retains existing market-pause behavior orthogonally.
  2. **LLM-generated news** — news generation service adds two new fields to news payload: `is_event` (bool) and `severity` (enum: `MINOR` / `MAJOR` / `CATASTROPHIC`). If `is_event=true`, shock fires on teams matched by ticker/name in the news body.
- **D-17:** Magnitude by severity: `MINOR=±3%`, `MAJOR=±8%`, `CATASTROPHIC=±15%`. Sign (±) comes from a separate `direction` field (`POSITIVE` / `NEGATIVE`) set by admin or LLM.
- **D-18:** Shocks are single-tick instant jumps — applied once in the `shock` term of the next tick's formula, then cleared. Not spread across multiple ticks.
- **D-19:** Mechanism: a new `PendingShock` table (team_id, magnitude_pct, applied_at nullable). Worker enqueues rows on crisis/event; tick loop consumes (one per team per tick, FIFO if multiple queued).

### Decision Impact Smoothing — Linear 5-Min Ramp

- **D-20:** When `FundamentalEvaluation` is approved, Team gains a `ramp_started_at` timestamp and a stored `drift_target` snapshot. Per-tick `ramp_fraction = min(1.0, ticks_since_ramp_start / 5)`.
- **D-21:** If a new approval comes in mid-ramp, `ramp_started_at` resets and `drift_target` re-snapshots from the fresh fundamentals, but `drift_now` at the moment of reset becomes the new ramp floor (no visible discontinuity — ramp continues smoothly from current drift toward new target over 5 more ticks).

### Compute Cadence

- **D-22:** LLM fundamental eval: once per team per quarter, triggered by War Room transition in `game_service.py`. Celery task `compute_fundamentals(round_number)` fans out one subtask per ACTIVE team, parallel.
- **D-23:** Per-tick math: one batched SELECT for all ACTIVE teams, pure Python per-tick compute (no per-team DB query). Target <50ms total for 40 teams.
- **D-24:** PriceHistory batch insert: single `db.add_all(...)` per tick instead of per-team `db.add(...)`.

### Admin Visibility & Controls

- **D-25:** New admin endpoints:
  - `GET /api/v1/admin/teams/:id/fundamentals` — returns raw fundamentals, z-scores per metric, weighted_z, drift_target, ramp_fraction
  - `GET /api/v1/admin/fundamentals-queue` — list pending FundamentalEvaluations
  - `PATCH /api/v1/admin/fundamentals-queue/:id` — edit proposed deltas
  - `POST /api/v1/admin/fundamentals-queue/:id/approve` — approve + apply
  - `POST /api/v1/admin/fundamentals-queue/:id/reject` — reject (no deltas applied)
  - `POST /api/v1/admin/teams/:id/override-fundamentals` — direct override; bypasses LLM; triggers ramp restart per D-21
- **D-26:** Admin portal: new "Fundamentals" tab (between existing Evaluations and Markets). Shows queue + per-team fundamentals panel (accessible from team row).
- **D-27:** Weights (35/30/20/15) are Python-level constants in `simulation_service.py`. No Settings UI in Phase 9. Adjusting requires a code deploy.

### Migration from v1

- **D-28:** v1 price pipeline is removed, not gated:
  - `Team.target_price`, `Team.ticks_to_target` → dropped in a migration
  - `interpolate_price()` → deleted
  - `set_team_score()` admin endpoint → deprecated with 410 Gone response; replaced by override endpoint (D-25)
  - Phase 5 `Evaluation` (solution quality_score) → stays; still computed by LLM, still admin-approvable, but approval **no longer sets target_price**. Quality score becomes an input signal the LLM reads when proposing fundamental deltas (indirect).
- **D-29:** Existing `price_tick` Celery task: keeps its scheduling and WebSocket broadcast wiring. Only its body changes from `interpolate_price` invocation to batched `compute_price` loop.

### Data Model Summary (delta vs current)

- **D-30:** New columns on `teams`: `fundamental_market_share`, `fundamental_margin`, `fundamental_growth`, `fundamental_ops_efficiency`, `drift_target_pct`, `ramp_started_at`.
- **D-31:** Dropped columns on `teams`: `target_price`, `ticks_to_target`.
- **D-32:** New tables: `fundamental_evaluations` (id, team_id, round_number, proposed_deltas JSON, admin_edits JSON, narrative, status enum, created_at, approved_at, approved_by_admin_id), `pending_shocks` (id, team_id, magnitude_pct, source enum [CRISIS/LLM_EVENT], source_ref_id, enqueued_at, applied_at nullable).

### Claude's Discretion

- Exact noise distribution and bounds if tuning reveals drift is too tame or too hot (D-06 leaves `0.15` coefficient tunable).
- Choice between `SELECT FOR UPDATE` vs optimistic locking for the fundamentals update transaction.
- Whether to cache archetype.benchmark_bands in Redis or read per-tick (40-row read is cheap but adds latency under lock contention).
- Z-score clamp values (±2 in D-07) — adjust if unit tests show overflow.

### Phase 8 Polish (applied 2026-04-17, post-discuss, pre-Phase 9 execution)

- **D-33:** PRICING lever removed from the system. Enum, validator, budget calculation, types, and UI all dropped. DB-level enum still contains PRICING for backward compatibility but no code path creates new rows. Post-Phase 9 migration 005 may optionally drop it; not required for correctness.
- **D-34:** Each remaining lever (MARKETING, SUPPLY_CHAIN, NEW_PRODUCT) is independently optional per submission. DecisionsPanel renders an `INCLUDE` checkbox per section; only checked sections are sent in the payload. Backend endpoint already accepts 1-N decision items — no schema change. Team may submit 0-3 lever decisions per quarter.
- **D-35:** Phase 9 Plan 03 `build_fundamental_prompt` must handle partial/empty decision sets gracefully. If no Decision rows exist for a team in a given round, the "DECISION LEVERS THIS ROUND" section of the prompt reads "(no decisions submitted this round)" and the LLM infers fundamentals from operating plan + archetype + prior narrative alone. If only some levers are present, list them without filler for the absent ones.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Specs

- `.planning/REQUIREMENTS.md` — SIM-05, SIM-06, SIM-07, SIM-08, SIM-09, ARCH-03 (Phase 9 requirements)
- `.planning/CASELINE_SPEC.md` §6 — Simulation structure, 4-fundamental weighting
- `.planning/PROJECT.md` — v2.0 milestone goals (enhanced price formula explicitly listed)

### Prior Phase Context

- `.planning/phases/07-archetypes-and-sample-portfolios/07-CONTEXT.md` — Archetype data model, benchmark_bands JSON shape (keys, format)
- `.planning/phases/08-decision-levers-and-round-structure/08-CONTEXT.md` — Decision table shape, War Room/Live Floor state machine, quarter cadence

### Existing Code

- `server/app/services/simulation_service.py` — Current `interpolate_price`, `calculate_all_prices`, `set_team_score`. To be rewritten.
- `server/app/services/game_service.py` — War Room / Live Floor transitions; hook point for `compute_fundamentals` task trigger
- `server/app/services/evaluation_service.py` — Phase 5 Evaluation pattern to mirror for FundamentalEvaluation
- `server/app/services/llm_service.py` — `call_openrouter(json_schema=...)` reusable for fundamental eval
- `server/app/models.py` — Team (add fundamental fields, drop target_price/ticks_to_target), Archetype (benchmark_bands), Transaction (for sentiment query), Evaluation (pattern reference), CrisisEvent (shock source)
- `server/app/api/admin.py` — Archetype validator `_validate_benchmark_bands:1427`, seed_archetypes:1917, crisis endpoints
- `server/app/worker/tasks/generate_news.py` — Add `is_event` / `severity` / `direction` to news schema
- `server/app/worker/tasks/` — Location for new `compute_fundamentals` task
- `client/src/components/game/CaselinePanel.tsx` — Add fundamental + z-score display for Strategist
- `client/src/app/admin/page.tsx` — Add Fundamentals tab; wire override UI

### Operational Refs

- `server/init_db.py` — Current dev-mode schema bootstrap via `Base.metadata.create_all`; Phase 9 schema changes need a matching Alembic migration (since `create_all` won't add columns to existing tables — STATE.md blocker noted)

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- **Phase 5 `Evaluation` model + admin approval queue** — exact pattern to mirror for `FundamentalEvaluation`. Same PENDING_APPROVAL / APPROVED / REJECTED states, same admin-edit-before-approve UX.
- **`llm_service.call_openrouter(..., json_schema=...)`** — already accepts a custom JSON schema. Feed it the fundamental-deltas schema.
- **`price_tick` Celery task pipeline + WebSocket broadcast** — unchanged at the boundary; only `compute_price` body differs.
- **Crisis injection flow** — existing `CrisisEvent` model and admin endpoint can be extended to enqueue a `PendingShock` on injection.
- **Transaction model** — already has `tx_type`, `quantity`, `price_per_share`, `target_team_id`, `executed_at`. Sentiment query is a straightforward aggregate.
- **News generation service** — already produces structured news items; adding three fields is localized.

### Established Patterns

- Async SQLAlchemy with `AsyncSession` (no blocking in tick loop)
- Decimal arithmetic for all price math (float only for noise/ratios internal to the function)
- `SELECT FOR UPDATE` used in trading service — available if concurrent fundamental updates need locking (probably fine without — updates are serialized through admin approval)
- Celery Beat drives the 60s price tick; no changes needed to scheduling

### Integration Points

- **Phase 7 dependency**: `archetype.benchmark_bands` is the sole source for z-score reference — failure mode is team without archetype. Fallback: skip fundamental computation; price stays flat.
- **Phase 8 dependency**: `Decision` table is the primary LLM input for fundamental deltas. Quarter boundary comes from the War Room transition in `game_service.py`.
- **Phase 5 dependency**: `Evaluation` flow for solutions still runs; `quality_score` becomes narrative input, not price driver.
- **Phase 11 hook**: Admin Fundamentals tab will grow into the operational dashboard tiles in Phase 11. Design it to extend cleanly.

### Risks / Pitfalls

- v1 rewrite means existing E2E tests covering `interpolate_price` and `ticks_to_target` will fail. Must be rewritten as part of this phase, not deferred.
- DB migration needed for column add/drop. `init_db.py` (dev) uses `create_all` which won't migrate existing rows — document requirement to wipe DB or run Alembic upgrade, matching the pattern from STATE.md blocker note.
- LLM cost: 40 teams × 1 eval per quarter × 20-30 quarters per competition = ~1000 LLM calls. Tractable but not negligible — budget the OpenRouter spend.
- Sentiment last-tick-only on thin volume will produce visible chart jitter. If competition experience feedback flags it as noise, D-13/D-14 are the tuning knobs.

</code_context>

<specifics>
## Specific Ideas

- New formula feels "alive" on charts — sentiment visibly responds to volume, shocks are discrete jumps visible in the candlestick, fundamentals ramp in smoothly over 5 min after War Room ends.
- Fundamentals display on Caseline panel: show MS / Profitability / Ops / Brand Health with current value, z-score, and band range. Color-coded (green inside band, red outside).
- Admin Fundamentals Queue feels like Phase 5 evaluation queue — not a new pattern, a mirrored one. Consistency is the UX goal.
- Direct override is a break-glass tool. Use rarely, not as the primary workflow.

</specifics>

<deferred>
## Deferred Ideas

- **Admin-configurable weights** — weights stay hardcoded in Phase 9 (D-27). If future competitions want e.g. 40/25/20/15 or to emphasize Brand Health, Phase 11+ can add a Settings UI.
- **True Brand Health signal (NPS / sentiment)** — Phase 11 dashboard scope. Phase 9 uses `growth` as the proxy.
- **Rolling-window sentiment + time decay** — deferred per D-15. Revisit if last-tick sentiment proves too jittery in live competition.
- **Short-selling impact on sentiment** — Phase 10 introduces shorts. Phase 9's sentiment math naturally handles sell volume, but short-specific weighting (net short interest) is Phase 10+.
- **M&A / distress triggers** — Phase 12 scope.

</deferred>

---

_Phase: 09-enhanced-simulation-engine_
_Context gathered: 2026-04-17_
