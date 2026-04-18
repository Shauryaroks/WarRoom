---
phase: 09-enhanced-simulation-engine
plan: 02
subsystem: simulation-engine
tags: [simulation, phase-9, per-tick-engine, v1-cleanup]
dependency_graph:
  requires: [09-01]
  provides:
    [
      compute_price,
      z_score,
      compute_weighted_z,
      compute_drift_target,
      compute_ramp_fraction,
      compute_sentiment,
      consume_shock,
      calculate_all_prices,
    ]
  affects: [simulation_service.py, evaluation_service.py, admin.py]
decisions:
  - Per-tick engine rewritten wholesale; interpolate_price deleted; target_price/ticks_to_target columns dropped (done in Wave 1)
  - evaluation_service.approve_evaluation no longer writes target_price — solution pipeline decoupled from price per D-28
  - set_team_score endpoint returns 410 Gone with v1 deprecation detail string
  - Sentiment normalizer uses public_float (30% of shares_outstanding) per research Q2 resolution
  - drift_floor_pct snap-free ramp floor per D-21 — captures prior drift_now at approval
metrics:
  duration: "~15min (inline, no subagent)"
  commit: 92a39942
---

# Phase 9 Plan 02 — Summary

Phase 9 per-tick price engine live. v1 random-walk + target_price pipeline removed.

**Math smoke-tested:** z_score at band midpoint = 0; at max = 1; at min = -1; beyond clamped to ±2. compute_drift_target(5) = 0.05 (cap hit).

**Commit:** `92a39942 feat(09-02): Phase 9 per-tick engine + v1 cleanup`
