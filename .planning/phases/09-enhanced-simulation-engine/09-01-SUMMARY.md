---
phase: 09-enhanced-simulation-engine
plan: 01
subsystem: simulation-schema-foundation
tags: [alembic, sqlalchemy, schema, fixtures, phase-9]
dependency_graph:
  requires:
    - 04-decision-levers-and-round-structure
    - 07-archetypes-and-sample-portfolios
  provides:
    - db-schema: fundamental_evaluations, pending_shocks, Team.fundamental_*, Team.drift_*, Team.ramp_started_at
    - orm-models: FundamentalEvaluation, PendingShock, FundamentalEvalStatus, ShockSource, ShockSeverity, ShockDirection
    - fixtures: mock_archetype_with_bands, mock_team_with_fundamentals, mock_fundamental_evaluation, mock_pending_shock
    - admin-extension: assign_archetype populates fundamentals at band midpoints
  affects:
    - 09-02 (price engine consumes fundamentals + pending_shocks)
    - 09-03 (fundamental service + Celery task writes FundamentalEvaluation)
    - 09-04 (shock enqueue writes PendingShock)
    - 09-05 (admin endpoints read/mutate FundamentalEvaluation)
    - 09-06 (frontend reads Team fundamentals)
    - 09-07 (stress tests use fixtures)
tech_stack:
  added:
    - pytest-asyncio fixtures via pytest_asyncio.fixture decorator
    - pg_enum with create_type=False (from sqlalchemy.dialects.postgresql) to bypass asyncpg enum re-emission
  patterns:
    - Idempotent raw-DDL enum creation via DO $$ ... IF NOT EXISTS ... CREATE TYPE $$ blocks
    - Backfill-in-migration pattern (Python-side loop with sa.text parameterized UPDATE)
    - Pydantic-independent Python enums for downstream Pydantic schemas (ShockSeverity, ShockDirection)
key_files:
  created:
    - server/alembic/versions/005_fundamentals_and_shocks.py
  modified:
    - server/app/models.py
    - server/app/api/admin.py
    - server/tests/conftest.py
decisions:
  - PG_ENUM(create_type=False) is required with asyncpg to avoid duplicate CREATE TYPE errors (sa.Enum + create_type=False still emits CREATE TYPE in the create_table path)
  - Enum types created via DO-block idempotent raw DDL (not sa.Enum.create() which interacts poorly with create_type=False under asyncpg)
  - Migration 005 backfill is idempotent via WHERE fundamental_market_share IS NULL and uses op.get_bind() Python loop rather than pure-SQL JOIN (archetype benchmark_bands is JSON Text, not columnar)
  - Live dev DB was created by init_db.py create_all without alembic stamp; required alembic stamp 004_decision_levers before upgrade to 005 worked
metrics:
  duration_minutes: ~25
  completed_at: 2026-04-17
  tasks_complete: 3
  commits: 3
---

# Phase 9 Plan 01: Enhanced Simulation Engine — Schema Foundation Summary

Lands the Phase 9 schema bedrock: Alembic migration 005 introduces four new Team fundamentals columns, two new drift columns, `ramp_started_at`, drops v1 `target_price`/`ticks_to_target`, adds `fundamental_evaluations` and `pending_shocks` tables with their `fundamentalevalstatus` and `shocksource` Postgres enums, backfills existing archetype-assigned teams from band midpoints, and ships matching SQLAlchemy ORM models, an `assign_archetype` extension that writes midpoints at assign time, and four pytest fixtures consumable by downstream Phase 9 plans.

## One-liner

Phase 9 foundation: migration 005 (7 new Team cols, 2 dropped v1 cols, 2 new tables, 2 new enums, idempotent backfill), matching SQLAlchemy models (FundamentalEvaluation, PendingShock, 4 enums), archetype-assign midpoint write, and 4 pytest fixtures.

## Migration

- **File:** `server/alembic/versions/005_fundamentals_and_shocks.py`
- **Revision ID:** `005_fundamentals`
- **Down revision:** `004_decision_levers`

### Schema changes

**New columns on `teams`:**

- `fundamental_market_share`, `fundamental_margin`, `fundamental_growth`, `fundamental_ops_efficiency` — `Numeric(10, 4)` nullable
- `drift_target_pct`, `drift_floor_pct` — `Numeric(8, 6)` nullable
- `ramp_started_at` — `DateTime(timezone=True)` nullable

**Dropped columns from `teams`:**

- `target_price`, `ticks_to_target` (per D-31)

**New tables:**

- `fundamental_evaluations` — 16 columns, `UniqueConstraint("team_id","round_number", name="uq_fundeval_team_round")`, `Index("ix_fundeval_status", status)`
- `pending_shocks` — 7 columns, `Index("ix_pending_shocks_team_unapplied", team_id, applied_at)`

**New Postgres enums:**

- `fundamentalevalstatus` (`PROCESSING`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `FAILED`)
- `shocksource` (`CRISIS`, `LLM_EVENT`)

**Backfill UPDATE:** iterates all archetypes, computes band midpoints from `benchmark_bands` JSON, UPDATE teams per-archetype where `archetype_id = :aid AND fundamental_market_share IS NULL`. Idempotent.

## Model mirror in `server/app/models.py`

- New Python enums added after `LeverCategory` (~line 88): `FundamentalEvalStatus`, `ShockSource`, `ShockSeverity`, `ShockDirection`.
- `class Team(Base):` Simulation block (~lines 169-191) — replaced v1 `target_price`/`ticks_to_target` pair with 7 new fields (4 fundamentals + `drift_target_pct` + `drift_floor_pct` + `ramp_started_at`).
- `class FundamentalEvaluation(Base):` added after `class Evaluation(Base):` (~line 413) with `UniqueConstraint("team_id","round_number")`.
- `class PendingShock(Base):` added directly after `FundamentalEvaluation` (~line 454) with `Index("ix_pending_shocks_team_unapplied", "team_id", "applied_at")`.

## Admin extension — `server/app/api/admin.py`

- `assign_archetype` handler (lines ~1639-1664 post-change) now parses `archetype.benchmark_bands` JSON and writes midpoints to `team.fundamental_market_share` / `fundamental_margin` / `fundamental_growth` / `fundamental_ops_efficiency` immediately before the `ActivityEvent` insert.
- `Decimal` and `json` imports were already present at the top; no new imports needed.

## Pytest fixtures — `server/tests/conftest.py`

Four new `@pytest_asyncio.fixture`s appended after the existing `mock_evaluation` fixture:

| Fixture                       | Returns                                                                                                                                                                       | Notes                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `mock_archetype_with_bands`   | `Archetype` with bands `{market_share:[10,20], margin:[5,15], growth:[2,8], ops_efficiency:[60,80]}`                                                                          | Midpoints: 15 / 10 / 5 / 70                                        |
| `mock_team_with_fundamentals` | `Team(status=ACTIVE)` with fundamentals at the midpoints, archetype linked, `ticker="TEST"`                                                                                   | Uses `strategist_email="strat-phase9@test.com"` to avoid collision |
| `mock_fundamental_evaluation` | `FundamentalEvaluation(status=PENDING_APPROVAL)` with proposed_deltas `{market_share_delta:1.0, margin_delta:0.5, growth_delta:0.3, ops_efficiency_delta:2.0}`, narrative set | For 09-03 / 09-05 consumption                                      |
| `mock_pending_shock`          | `PendingShock(magnitude_pct=8.000, source=LLM_EVENT, applied_at=None)`                                                                                                        | For 09-02 / 09-04 shock-consume tests                              |

All fixtures write via `mock_db.add(...)` + `await mock_db.flush()` — works with the existing `AsyncMock`-backed `mock_db` fixture (add/flush become no-op mock calls, but tests that need real ORM persistence can override at their own level).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] asyncpg + SQLAlchemy Enum path fails to respect `create_type=False`**

- **Found during:** Task 1 verification (`alembic upgrade head` repeatedly raised `DuplicateObjectError: type "fundamentalevalstatus" already exists`)
- **Issue:** Despite `sa.Enum(..., name="fundamentalevalstatus", create_type=False)` being used in the `create_table(...)` column definition, SQLAlchemy under asyncpg still emitted `CREATE TYPE fundamentalevalstatus AS ENUM (...)` during `create_table`, conflicting with the type previously created via `.create(op.get_bind(), checkfirst=True)`. Each attempt rolled back the whole migration (confirmed: pg_type showed no `fundamentalevalstatus` after failure).
- **Fix:**
  - Switched enum creation to raw DDL inside `DO $$ ... IF NOT EXISTS ... CREATE TYPE ... END $$` blocks (guaranteed idempotent, asyncpg-safe).
  - Switched column-level enum references from `sa.Enum(..., create_type=False)` to `sqlalchemy.dialects.postgresql.ENUM(..., create_type=False)` (aliased as `PG_ENUM`), which honors `create_type=False` correctly under asyncpg.
- **Files modified:** `server/alembic/versions/005_fundamentals_and_shocks.py` (lines 8-11 imports, 20-65 upgrade body)
- **Commit:** `664ae68d`

**2. [Rule 3 - Environment] Live dev DB schema ahead of alembic**

- **Found during:** Task 1 `alembic upgrade head` attempt
- **Issue:** Dev DB was bootstrapped via `init_db.py create_all` and never stamped; running `alembic upgrade head` would try to apply 001-004 against a schema that already had all those tables.
- **Fix:** One-time operational step: `alembic stamp 004_decision_levers` before applying 005. This is a runtime workflow note, not a code change. Documented in the admin runbook section below.
- **Files modified:** none (operational)

### Authentication / human-action gates

None encountered.

## Verification Results

| Check                                                                                                                                 | Result                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `alembic upgrade head` from 004                                                                                                       | PASS — `005_fundamentals` applied                                               |
| `alembic downgrade 004_decision_levers`                                                                                               | PASS — Team re-gains `target_price`/`ticks_to_target`, new tables/enums dropped |
| Round-trip re-apply `alembic upgrade head`                                                                                            | PASS                                                                            |
| `from app.models import FundamentalEvaluation, PendingShock, FundamentalEvalStatus, ShockSource, ShockSeverity, ShockDirection, Team` | PASS — all importable                                                           |
| `Team.fundamental_market_share` attribute                                                                                             | Present                                                                         |
| `Team.target_price` attribute                                                                                                         | Absent (as expected)                                                            |
| `from tests import conftest` import                                                                                                   | PASS                                                                            |
| `pytest tests/ --collect-only -q`                                                                                                     | 58 tests collected, zero errors                                                 |
| Backfill of existing teams (all had `archetype_id IS NULL` on this DB)                                                                | PASS — UPDATE WHERE clause filtered correctly, no rows modified                 |
| Grep checks for acceptance strings                                                                                                    | All pass (see self-check section)                                               |

## Commits

| Task | Commit     | Description                                                                   |
| ---- | ---------- | ----------------------------------------------------------------------------- |
| 1    | `664ae68d` | `feat(09-01): add migration 005 for fundamentals and shocks`                  |
| 2    | `28be25d8` | `feat(09-01): mirror migration 005 in SQLAlchemy models + backfill on assign` |
| 3    | `c1c26283` | `test(09-01): add Phase 9 pytest fixtures to conftest`                        |

## Runbook for dev / staging / prod

**Fresh DB (from init_db.py create_all):**

```bash
# Mark current schema as 004 so alembic recognizes the starting point.
docker compose exec api uv run alembic stamp 004_decision_levers
# Apply 005.
docker compose exec api uv run alembic upgrade head
# Verify.
docker compose exec db psql -U postgres -d complex -c "\d teams"  # should show fundamental_* columns
```

**Alembic-managed DB already at 004:**

```bash
docker compose exec api uv run alembic upgrade head
```

**Rollback:**

```bash
docker compose exec api uv run alembic downgrade 004_decision_levers
```

## Known Stubs

None — this plan is pure schema + model + fixture work. No UI rendering or placeholder data.

## Self-Check: PASSED

- [x] `server/alembic/versions/005_fundamentals_and_shocks.py` exists
- [x] Commit `664ae68d` exists in `git log`
- [x] Commit `28be25d8` exists in `git log`
- [x] Commit `c1c26283` exists in `git log`
- [x] `server/app/models.py` contains `class FundamentalEvaluation(Base):` (1 match)
- [x] `server/app/models.py` contains `class PendingShock(Base):` (1 match)
- [x] `server/app/models.py` contains all four new enum classes
- [x] `server/app/models.py` Team class body no longer declares `target_price` / `ticks_to_target` (only reference is the comment describing their replacement)
- [x] `server/app/api/admin.py` contains `team.fundamental_market_share =`
- [x] `server/tests/conftest.py` contains all four new fixture defs
