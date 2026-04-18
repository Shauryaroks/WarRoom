---
phase: 09-enhanced-simulation-engine
plan: 04
subsystem: admin-fundamentals-api
tags: [admin-api, fundamentals-queue, phase-9]
dependency_graph:
  requires: [09-03]
  provides:
    [
      list_fundamentals_queue,
      approve_fundamental_eval,
      reject_fundamental_eval,
      compute_fundamentals_endpoint,
    ]
  affects: [admin.py]
simplifications_vs_plan:
  - 4 endpoints instead of the planned 6; dropped patch/edit-deltas endpoint and dedicated team /me/fundamentals endpoint
  - Shock sources simplified: admin crisis only (LLM news is_event tag schema extension deferred)
  - No PATCH endpoint — admin either approves directly or rejects
decisions:
  - Endpoints registered under /api/v1/admin/fundamentals-queue
  - WebSocket broadcast on approve: type="fundamentals_updated" with {evaluation_id, team_id, ticker, drift_target_pct}
  - compute endpoint is POST /admin/fundamentals-queue/compute with {round_number}
metrics:
  duration: "~5min (inline)"
  commit: 5389a8d3
---

# Phase 9 Plan 04 — Summary

4 admin endpoints registered and verified via OpenAPI. Fundamental compute triggered by admin button, not game state transition. LLM news schema extension (is_event/severity/direction) deferred to future work — shock enqueueing currently scoped to admin crisis only.

**Commit:** `5389a8d3 feat(09-03,04): fundamental_service + admin queue endpoints`

**Deferred:**

- LLM news `is_event`/`severity`/`direction` schema extension (Plan 04 original scope — shocks currently admin-only)
- Automatic compute_fundamentals fan-out on War Room transition (replaced with admin-triggered POST button)
