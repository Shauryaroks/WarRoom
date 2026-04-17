---
phase: 09-enhanced-simulation-engine
plan: 03
subsystem: fundamental-eval-service
tags: [fundamental-service, llm-eval, approval-pipeline, phase-9]
dependency_graph:
  requires: [09-01, 09-02]
  provides: [build_fundamental_prompt, save_fundamental_evaluation, apply_fundamental_deltas, reject_fundamental_evaluation, trigger_compute_for_round, FUNDAMENTAL_SCHEMA]
  affects: [fundamental_service.py]
simplifications_vs_plan:
  - Admin-triggered compute via POST endpoint instead of automatic War Room transition hook (Celery group fan-out)
  - Single override/edit flow merged into apply_fundamental_deltas via admin_edits field
  - No separate Celery task file — trigger_compute_for_round runs inline in the admin request
decisions:
  - FUNDAMENTAL_SCHEMA json_schema: 4 deltas + narrative, strict=True
  - System prompt explicitly marks operating plan + decisions as UNTRUSTED INPUT (prompt injection guard)
  - apply_fundamental_deltas captures prior drift_now BEFORE mutation, stores as drift_floor_pct (D-21)
  - None-fundamental fallback uses archetype band midpoint (D-03)
metrics:
  duration: "~8min (inline)"
  commit: 5389a8d3
---

# Phase 9 Plan 03 — Summary

`fundamental_service.py` implements LLM eval + admin approval pipeline mirroring Phase 5. trigger_compute_for_round iterates ACTIVE teams, builds prompt, calls OpenRouter with FUNDAMENTAL_SCHEMA, saves PENDING_APPROVAL row, skips duplicates.

**Commit:** `5389a8d3 feat(09-03,04): fundamental_service + admin queue endpoints`
