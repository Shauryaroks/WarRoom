---
phase: 09
slug: enhanced-simulation-engine
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-17
---

# Phase 09 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution of Phase 9 (Enhanced Simulation Engine).
> Source of truth: `09-RESEARCH.md` §Validation Architecture + locked decisions in `09-CONTEXT.md`.

---

## Test Infrastructure

| Property                | Value                                                                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**           | pytest 8.x + pytest-asyncio (backend), Playwright (frontend smoke — Wave 5)                                                         |
| **Config file**         | `server/pyproject.toml` (`[tool.pytest.ini_options]`, `asyncio_mode = "auto"`)                                                      |
| **Quick run command**   | `cd server && uv run pytest tests/test_simulation.py tests/test_fundamental_service.py tests/test_shock_enqueue.py -q --timeout=30` |
| **Full suite command**  | `cd server && uv run pytest -q --timeout=60`                                                                                        |
| **Stress test command** | `cd server && uv run pytest tests/test_stress.py -q --timeout=300 -m stress`                                                        |
| **Estimated runtime**   | Quick ~8s · Full ~45s · Stress ~240s                                                                                                |

---

## Sampling Rate

- **After every task commit:** Run `quick` command restricted to the file(s) touched
- **After every plan wave:** Run `full suite` command
- **Before `/gsd-verify-work`:** Full suite + stress suite must be green
- **Max feedback latency:** 30 seconds on quick; 60 seconds on full; 300 seconds on stress

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement                     | Threat Ref | Secure Behavior                                                                             | Test Type         | Automated Command                                                                                                                                     | File Exists | Status     |
| -------- | ---- | ---- | ------------------------------- | ---------- | ------------------------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------- |
| 09-01-01 | 01   | 1    | SIM-05, SIM-06, ARCH-03         | —          | N/A                                                                                         | unit              | `cd server && uv run alembic upgrade head && uv run pytest tests/test_migration_005.py -q`                                                            | ❌ W0       | ⬜ pending |
| 09-01-02 | 01   | 1    | SIM-05, ARCH-03                 | —          | N/A                                                                                         | unit              | `cd server && uv run pytest tests/test_models.py::TestFundamentalEvaluation tests/test_models.py::TestPendingShock -q`                                | ❌ W0       | ⬜ pending |
| 09-01-03 | 01   | 1    | ARCH-03                         | —          | Archetype band midpoint backfills existing teams                                            | integration       | `cd server && uv run pytest tests/test_admin.py::TestArchetypeAssignBackfill -q`                                                                      | ❌ W0       | ⬜ pending |
| 09-02-01 | 02   | 2    | SIM-05, SIM-06                  | —          | N/A                                                                                         | unit (9 classes)  | `cd server && uv run pytest tests/test_simulation.py -q`                                                                                              | ❌ W0       | ⬜ pending |
| 09-02-02 | 02   | 2    | SIM-05, SIM-06, SIM-08, SIM-09  | —          | N/A                                                                                         | unit              | `cd server && uv run pytest tests/test_simulation.py::TestComputePrice tests/test_simulation.py::TestSentiment tests/test_simulation.py::TestRamp -q` | ❌ W0       | ⬜ pending |
| 09-02-03 | 02   | 2    | SIM-07                          | —          | Shock fires then clears applied_at within one tick                                          | integration       | `cd server && uv run pytest tests/test_simulation.py::TestShockConsume tests/test_game_tick.py -q`                                                    | ❌ W0       | ⬜ pending |
| 09-03-01 | 03   | 3    | SIM-09, ARCH-03                 | —          | Admin-only approval gate (re-tested)                                                        | unit              | `cd server && uv run pytest tests/test_fundamental_service.py::TestBuildPrompt tests/test_fundamental_service.py::TestSave -q`                        | ❌ W0       | ⬜ pending |
| 09-03-02 | 03   | 3    | SIM-05, SIM-09                  | —          | N/A                                                                                         | integration       | `cd server && uv run pytest tests/test_compute_fundamentals_task.py -q`                                                                               | ❌ W0       | ⬜ pending |
| 09-03-03 | 03   | 3    | SIM-09                          | —          | War Room transition triggers fan-out                                                        | integration       | `cd server && uv run pytest tests/test_game_service.py::TestWarRoomTriggersFundamentals -q`                                                           | ❌ W0       | ⬜ pending |
| 09-03-04 | 03   | 3    | — (v1 deprecation)              | —          | Phase 5 approve no longer writes target_price                                               | unit              | `cd server && uv run pytest tests/test_evaluation.py::test_approve_no_longer_writes_target_price -q`                                                  | ❌ W0       | ⬜ pending |
| 09-04-01 | 04   | 3    | SIM-07                          | —          | Only admins enqueue shocks; non-admin 403                                                   | unit              | `cd server && uv run pytest tests/test_shock_enqueue.py::TestCrisisShockEnqueue tests/test_shock_enqueue.py::TestNewsShockEnqueue -q`                 | ❌ W0       | ⬜ pending |
| 09-04-02 | 04   | 3    | SIM-07                          | —          | News schema extension backward-compatible                                                   | unit              | `cd server && uv run pytest tests/test_generate_news.py::TestNewsSchemaExtension -q`                                                                  | ❌ W0       | ⬜ pending |
| 09-04-03 | 04   | 3    | — (v1 deprecation)              | —          | set_team_score returns 410                                                                  | unit              | `cd server && uv run pytest tests/test_admin.py::TestSetTeamScoreDeprecated -q`                                                                       | ❌ W0       | ⬜ pending |
| 09-05-01 | 05   | 4    | SIM-05, SIM-06, SIM-09, ARCH-03 | T-05-01    | Non-admin → 403 on all 6 queue/override endpoints                                           | endpoint          | `cd server && uv run pytest tests/test_admin_fundamentals.py -q`                                                                                      | ❌ W0       | ⬜ pending |
| 09-05-02 | 05   | 4    | SIM-05, SIM-06                  | —          | Team sees own fundamentals; not others'                                                     | endpoint          | `cd server && uv run pytest tests/test_teams_fundamentals.py -q`                                                                                      | ❌ W0       | ⬜ pending |
| 09-06-01 | 06   | 5    | SIM-05, SIM-06, SIM-09, ARCH-03 | —          | N/A (TypeScript compile)                                                                    | unit              | `cd client && pnpm tsc --noEmit`                                                                                                                      | ❌ W0       | ⬜ pending |
| 09-06-02 | 06   | 5    | SIM-05, ARCH-03                 | —          | N/A                                                                                         | unit              | `cd client && pnpm eslint src/app/admin/fundamentals/page.tsx src/components/game/CaselinePanel.tsx`                                                  | ❌ W0       | ⬜ pending |
| 09-06-03 | 06   | 5    | —                               | —          | Admin can navigate to /admin/fundamentals, see queue, approve item end-to-end               | manual checkpoint | `checkpoint:human-verify`                                                                                                                             | ❌ W0       | ⬜ pending |
| 09-07-01 | 07   | 6    | SIM-05..09, ARCH-03             | —          | 40-team tick compute <50ms p95                                                              | stress            | `cd server && uv run pytest tests/test_stress.py::TestTickThroughput -q -m stress`                                                                    | ❌ W0       | ⬜ pending |
| 09-07-02 | 07   | 6    | SIM-07, SIM-08                  | —          | Sentiment aggregate correct under 200 concurrent trades/minute                              | stress            | `cd server && uv run pytest tests/test_stress.py::TestSentimentUnderLoad -q -m stress`                                                                | ❌ W0       | ⬜ pending |
| 09-07-03 | 07   | 6    | SIM-09                          | —          | Celery fan-out 40 teams completes before next quarter starts; rate_limit="20/m" honored     | stress            | `cd server && uv run pytest tests/test_stress.py::TestFundamentalFanOut -q -m stress`                                                                 | ❌ W0       | ⬜ pending |
| 09-07-04 | 07   | 6    | —                               | —          | All 6 admin endpoints + 1 team endpoint pass exhaustive matrix (auth/role/404/422/422/race) | endpoint          | `cd server && uv run pytest tests/test_endpoint_matrix.py -q`                                                                                         | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · ❌ W0 = file created in Wave 0_

---

## Wave 0 Requirements (Plan 09-01 Task 3 creates these)

- [ ] `server/tests/conftest.py` — extend existing conftest with fundamental/shock fixtures: `archetype_with_bands`, `team_with_fundamentals`, `pending_fundamental_eval`, `pending_shock`, `make_trades` helper
- [ ] `server/tests/test_simulation.py` — scaffolded with 9 test classes (TestZScore, TestWeightedDrift, TestRampFraction, TestSentiment, TestShockConsume, TestComputePrice, TestNoise, TestBatchedQuery, TestV1Removed)
- [ ] `server/tests/test_fundamental_service.py` — scaffolded with 4 test classes (TestBuildPrompt, TestSave, TestApply, TestReject)
- [ ] `server/tests/test_compute_fundamentals_task.py` — scaffolded (integration)
- [ ] `server/tests/test_shock_enqueue.py` — scaffolded with 2 test classes (TestCrisisShockEnqueue, TestNewsShockEnqueue)
- [ ] `server/tests/test_generate_news.py` — new file; schema extension tests
- [ ] `server/tests/test_admin_fundamentals.py` — scaffolded with 7 test classes covering the 6 admin endpoints (list/patch/approve/reject/override, plus auth matrix)
- [ ] `server/tests/test_teams_fundamentals.py` — new file; `/me/fundamentals` coverage
- [ ] `server/tests/test_stress.py` — new file; `@pytest.mark.stress` markers on 3 stress test classes (see Plan 07)
- [ ] `server/tests/test_endpoint_matrix.py` — new file; exhaustive endpoint matrix for Phase 9's 7 new endpoints
- [ ] `server/tests/test_migration_005.py` — verifies upgrade/downgrade round-trip
- [ ] `pytest.ini` `markers = ["stress: stress tests (slow — only run with -m stress)"]` registered in `pyproject.toml`

---

## Manual-Only Verifications

| Behavior                                                                            | Requirement | Why Manual                                            | Test Instructions                                                                                                                              |
| ----------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Charts visually animate shock jumps (candlestick shows discrete bar on shock tick)  | SIM-07      | Visual animation can't be asserted in automated tests | In running game, admin injects crisis with severity=MAJOR; observe stock chart shows +/-8% jump on next tick; fundamentals drift resumes after |
| Admin Fundamentals Queue UX — edit/approve/reject feels responsive, no layout jumps | ARCH-03     | UX polish                                             | See 09-06 Task 4 checkpoint                                                                                                                    |
| Z-score color coding in CaselinePanel readable on Complex Terminal Blue dark theme  | SIM-06      | Visual only                                           | See 09-06 Task 4 checkpoint — green inside band, red outside                                                                                   |

---

## Endpoint Matrix (Exhaustive Coverage — Plan 09-07)

Every endpoint introduced in Phase 9 must be tested against this matrix. Tests live in `tests/test_endpoint_matrix.py`.

### Admin endpoints (6)

| Endpoint                                        | Method | Auth tests   | Role tests     | Validation tests                                                  | Business tests                                                                               | Race tests                                        |
| ----------------------------------------------- | ------ | ------------ | -------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `/api/v1/admin/fundamentals-queue`              | GET    | 401 no token | 403 team token | N/A                                                               | list empty / paginated / status-filtered                                                     | —                                                 |
| `/api/v1/admin/fundamentals-queue/:id`          | PATCH  | 401          | 403            | 422 non-Decimal / out-of-range delta / extra key / unknown id 404 | edit persists to admin_edits JSON                                                            | concurrent PATCH last-write-wins                  |
| `/api/v1/admin/fundamentals-queue/:id/approve`  | POST   | 401          | 403            | 404 missing, 409 already approved, 409 rejected                   | fundamentals updated, ramp reset, drift_floor captured, WS event fired                       | 2× approve request same row ⇒ 1 succeeds, 1 × 409 |
| `/api/v1/admin/fundamentals-queue/:id/reject`   | POST   | 401          | 403            | 404, 409 already terminal                                         | status=REJECTED, no fundamentals change, no WS fired                                         | —                                                 |
| `/api/v1/admin/teams/:id/override-fundamentals` | POST   | 401          | 403            | 422 negative / 422 non-Decimal / 404 team                         | fundamentals updated, ramp restart with drift_floor = current drift_now, WS fired            | 2× override same team ⇒ both serialize, last wins |
| `/api/v1/admin/teams/:id/fundamentals`          | GET    | 401          | 403            | 404 team                                                          | returns z-scores, weighted_z, drift_target_pct, drift_floor_pct, ramp_fraction computed live | —                                                 |

### Team endpoints (1)

| Endpoint                        | Method | Auth tests   | Role tests                                                 | Validation tests                                           | Business tests          | Race tests |
| ------------------------------- | ------ | ------------ | ---------------------------------------------------------- | ---------------------------------------------------------- | ----------------------- | ---------- |
| `/api/v1/teams/me/fundamentals` | GET    | 401 no token | Strategist + Trader both allowed; team A can't read team B | team without fundamentals ⇒ 200 with null fields (not 500) | same shape as admin GET | —          |

### Deprecated endpoints (regression)

| Endpoint                             | Expected                                                                                     | Test                              |
| ------------------------------------ | -------------------------------------------------------------------------------------------- | --------------------------------- |
| `POST /api/v1/admin/teams/:id/score` | HTTP 410 Gone with `detail: "v1 quality_score pipeline replaced by fundamental_evaluations"` | `test_set_team_score_returns_410` |

---

## Stress Test Specifications (Plan 09-07)

### S-01: Tick throughput — `TestTickThroughput`

- **Setup:** 40 teams with archetype_id assigned, fundamentals populated, `status=ACTIVE`, random drift targets
- **Action:** Run `calculate_all_prices` in a loop of 60 ticks (simulates 1 hour of game time)
- **Assert:**
  - p50 tick duration < 20ms
  - p95 tick duration < 50ms
  - p99 tick duration < 100ms
  - No PriceHistory insert errors
  - Single batched SELECT per tick verified via `SQLALCHEMY_ECHO` hook / captured query count ≤ 3 per tick (1 SELECT teams, 1 SELECT pending_shocks, 1 BULK INSERT price_history)

### S-02: Sentiment under trade load — `TestSentimentUnderLoad`

- **Setup:** 40 teams, simulate 200 trades/min fan-in for 5 real minutes (1000 trades total)
- **Action:** Issue concurrent BUY/SELL transactions via the trading endpoints with randomized teams/amounts; run per-tick `compute_price` in parallel
- **Assert:**
  - All trades commit atomically (30% cap preserved)
  - Sentiment per team tracks net INR signed volume over last 60s (within ±5% of hand-computed reference)
  - No sentiment overflow (absolute value stays within ±0.003 clamp)
  - No deadlocks, no connection pool exhaustion

### S-03: Fundamental fan-out — `TestFundamentalFanOut`

- **Setup:** 40 teams, Live Floor → War Room transition triggers `compute_fundamentals` group
- **Action:** Use Celery eager-mode OR real worker with mocked OpenRouter; dispatch all 40 subtasks simultaneously
- **Assert:**
  - `rate_limit="20/m"` honored — no burst exceeds OpenRouter free tier
  - All 40 FundamentalEvaluation rows written with status PENDING_APPROVAL within 3 min wall clock
  - No duplicate evaluations for same team/round (unique constraint enforced)
  - If any subtask fails (mock failure), status=FAILED is recorded and other teams' evaluations succeed (no cascading failure)

### S-04: Endpoint matrix concurrency

- Covered by exhaustive matrix in `test_endpoint_matrix.py` — every race row marked "concurrent" runs with asyncio.gather of 2-10 requests

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (Plan 01 Task 3 creates scaffolds)
- [x] No watch-mode flags
- [x] Feedback latency < 60s quick / 300s stress
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending (will flip to approved after Plan 07 is authored and committed)
