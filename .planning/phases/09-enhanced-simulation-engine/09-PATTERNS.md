# Phase 9: Enhanced Simulation Engine - Pattern Map

**Mapped:** 2026-04-17
**Files analyzed:** 17 (9 backend new/touch, 5 frontend new/touch, 1 migration, 2 test surfaces)
**Analogs found:** 17 / 17 (all files have a direct in-repo analog — this phase is fundamentally a clone-and-adapt of Phase 5's evaluation pipeline plus a formula rewrite)

## File Classification

| New/Modified File                                                                                                       | New/Touch   | Role              | Data Flow                           | Closest Analog                                                                            | Match Quality      |
| ----------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------- | ----------------------------------- | ----------------------------------------------------------------------------------------- | ------------------ |
| `server/app/services/simulation_service.py`                                                                             | REWRITE     | service           | batch + transform (per-tick)        | self (existing `calculate_all_prices`)                                                    | exact (extend)     |
| `server/app/services/fundamental_service.py`                                                                            | NEW         | service           | CRUD + transform                    | `server/app/services/evaluation_service.py`                                               | exact (1:1 mirror) |
| `server/app/services/evaluation_service.py`                                                                             | TOUCH       | service           | CRUD                                | self (surgery on `approve_evaluation`)                                                    | self               |
| `server/app/services/game_service.py`                                                                                   | TOUCH       | service           | state machine                       | self (extend `set_game_phase`)                                                            | self               |
| `server/app/worker/tasks/compute_fundamentals.py`                                                                       | NEW         | worker task       | event-driven fan-out + LLM call     | `server/app/worker/tasks/evaluate_solution.py`                                            | exact              |
| `server/app/worker/tasks/game_tick.py`                                                                                  | TOUCH       | worker task       | periodic tick + broadcast           | self (minimal diff to `_execute_tick`)                                                    | self               |
| `server/app/worker/tasks/generate_news.py`                                                                              | TOUCH       | worker task       | LLM call + DB insert                | self (extend `NEWS_SCHEMA`)                                                               | self               |
| `server/app/api/admin.py`                                                                                               | EXTEND      | controller/router | request-response (CRUD + approval)  | self (mirror `list_evaluations` etc. + extend `inject_crisis`)                            | exact              |
| `server/app/api/teams.py`                                                                                               | EXTEND      | controller/router | request-response (team-scoped read) | self (`list_approved_teams` pattern)                                                      | exact              |
| `server/app/schemas/fundamentals.py`                                                                                    | NEW         | schemas           | validation                          | `server/app/schemas/decisions.py`                                                         | exact              |
| `server/app/models.py`                                                                                                  | TOUCH       | model             | SQLAlchemy mapped classes + enums   | self (mirror `Evaluation`, add enums)                                                     | self               |
| `server/alembic/versions/005_fundamentals_and_shocks.py`                                                                | NEW         | migration         | schema DDL                          | `server/alembic/versions/004_decision_levers_round_structure.py` + `003_add_archetype.py` | exact              |
| `client/src/app/admin/fundamentals/page.tsx`                                                                            | NEW         | component (page)  | request-response + WS subscribe     | `client/src/app/admin/evaluations/page.tsx` (625 LOC, 1:1 clone)                          | exact              |
| `client/src/components/admin/admin-sidebar.tsx`                                                                         | TOUCH       | component         | static nav                          | self (add entry to `NAV_ITEMS`)                                                           | self               |
| `client/src/components/game/CaselinePanel.tsx`                                                                          | TOUCH       | component         | request-response (REST fetch)       | self (extend after Archetype Identity block)                                              | self               |
| `client/src/lib/types.ts`                                                                                               | EXTEND      | types             | —                                   | self (add types after `EvaluationListItem`)                                               | self               |
| `server/tests/test_simulation.py`, `test_fundamental_service.py`, `test_admin_fundamentals.py`, `test_shock_enqueue.py` | NEW/REWRITE | tests             | pytest-asyncio                      | `server/tests/test_evaluation.py`, `test_game_tick.py`                                    | exact              |

## Pattern Assignments

### `server/app/services/simulation_service.py` (service, batch + per-tick transform) — REWRITE

**Analog:** self (existing `calculate_all_prices` at lines 112-185). The file structure stays; the body of `calculate_all_prices` is fully rewritten and `interpolate_price`/`set_team_score` are deleted.

**Imports pattern to preserve** (lines 10-19):

```python
import logging
import random
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PriceHistory, Team, TeamStatus
```

Extend with: `from sqlalchemy import func, case, update`, `from sqlalchemy.orm import selectinload`, `from datetime import timedelta`, and new model imports `Transaction, TransactionType, PendingShock, Archetype`.

**Existing batch SELECT pattern to extend** (lines 125-129):

```python
# Single batch query for all active teams
result = await db.execute(
    select(Team).where(Team.status == TeamStatus.ACTIVE)
)
teams = result.scalars().all()
```

Extend with `.options(selectinload(Team.archetype))` and `.where(Team.archetype_id.is_not(None))` (Pitfall 3 from RESEARCH).

**Existing Decimal price math pattern to preserve** (lines 50-56):

```python
noise_pct = random.gauss(0, volatility_pct / 2)
noise_pct = max(-volatility_pct, min(volatility_pct, noise_pct))
noise = current_price * Decimal(str(noise_pct))

new_price = current_price + step + noise
return max(Decimal("0.01"), round(new_price, 2))
```

Key invariant: `Decimal(str(random.gauss(...)))` — never pass a float directly to `Decimal`. Final `max(Decimal("0.01"), ...)` floor is preserved in new formula.

**Existing PriceHistory add + price_updates dict pattern to preserve** (lines 161-183):

```python
db.add(PriceHistory(
    team_id=team.id,
    price=new_price,
    market_cap=market_cap,
    calculated_at=now,
))
# ...
price_updates.append({
    "team_id": str(team.id),
    "ticker": team.ticker,
    "price": str(new_price),
    "change_pct": f"{change_pct:+.2f}",
    "market_cap": str(market_cap),
    "timestamp": now.isoformat(),
})
```

Keep the dict shape verbatim (frontend `PriceTickData` depends on it — see `client/src/lib/types.ts:108-115`). The new function returns `tuple[list[dict], list[dict]]` (prices + shocks).

**Delete these functions** (full removal, no backward-compat shim):

- `interpolate_price` (lines 24-56)
- `set_team_score` (lines 73-109)

---

### `server/app/services/fundamental_service.py` (service, CRUD + transform) — NEW

**Analog:** `server/app/services/evaluation_service.py` (1:1 mirror, this is the phase's core template).

**Imports pattern** (lines 13-33 of analog):

```python
import json
import logging
import uuid
from decimal import Decimal
from datetime import datetime, timezone

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Evaluation,
    EvaluationStatus,
    MarketNews,
    Solution,
    SolutionType,
    Team,
    TeamStatus,
    utc_now,
)
```

For fundamentals, swap to: `FundamentalEvaluation, FundamentalEvalStatus, Team, TeamStatus, Archetype, Decision, OperatingPlan, utc_now`.

**Core function 1 — `build_fundamental_prompt(db, team_id, round_number)`** (mirror lines 37-164 `build_prompt`):

```python
async def build_prompt(db: AsyncSession, solution_id: uuid.UUID) -> list[dict]:
    # Load solution with team
    result = await db.execute(
        select(Solution)
        .options(selectinload(Solution.team))
        .where(Solution.id == solution_id)
    )
    solution = result.scalar_one_or_none()
    if solution is None:
        raise ValueError(f"Solution {solution_id} not found")
    team = solution.team
    # ... builds [COMPANY PROFILE], [SECTION], [MARKET NEWS], [SCORING CRITERIA]
    system_prompt = "You are an expert business analyst..."
    user_content = "\n\n".join([company_profile, solution_section, ...])
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]
```

For fundamentals: load Team with `selectinload(Team.archetype)`, Decision rows for (team_id, round_number) all four levers, latest OperatingPlan, previous FundamentalEvaluation narrative (for continuity). Sections: `[COMPANY & ARCHETYPE]`, `[BENCHMARK BANDS]`, `[CURRENT FUNDAMENTALS]`, `[DECISION LEVERS THIS ROUND]`, `[OPERATING PLAN]`, `[INSTRUCTIONS: deltas relative to current, not absolute]`. System prompt must explicitly guard against Pitfall 8 (LLM delta sign flipping).

**Core function 2 — `save_fundamental_evaluation(db, team_id, round_number, llm_output, metadata)`** (mirror lines 167-211 `save_evaluation`):

```python
async def save_evaluation(
    db: AsyncSession,
    solution_id: uuid.UUID,
    llm_output: dict,
    metadata: dict,
) -> Evaluation:
    # ...
    scoring = llm_output["scoring_metrics"]
    news = llm_output["news_article"]

    evaluation = Evaluation(
        solution_id=solution.id,
        team_id=solution.team_id,
        status=EvaluationStatus.PENDING_APPROVAL,
        scoring_metrics=json.dumps(scoring),
        overall_score=scoring["overall_score"],
        price_timeline=json.dumps(llm_output["price_timeline"]),
        news_headline=news["headline"][:120],
        news_body=news["body"],
        news_sentiment=Decimal(str(news["sentiment"])),
        llm_model=metadata.get("model"),
        llm_latency_ms=metadata.get("latency_ms"),
    )
    db.add(evaluation)
    await db.flush()
    return evaluation
```

For fundamentals: store `proposed_deltas=json.dumps({market_share_delta, margin_delta, growth_delta, ops_efficiency_delta})`, `narrative=llm_output["narrative"]`, `status=PENDING_APPROVAL`.

**Core function 3 — `apply_fundamental_deltas(db, evaluation_id, admin_id)`** (mirror lines 214-282 `approve_evaluation`):

```python
async def approve_evaluation(
    db: AsyncSession, evaluation_id: uuid.UUID
) -> dict:
    result = await db.execute(
        select(Evaluation).where(Evaluation.id == evaluation_id)
    )
    evaluation = result.scalar_one_or_none()
    if evaluation is None:
        raise ValueError(f"Evaluation {evaluation_id} not found")
    if evaluation.status != EvaluationStatus.PENDING_APPROVAL:
        raise ValueError(
            f"Evaluation {evaluation_id} is {evaluation.status.value}, "
            f"expected PENDING_APPROVAL"
        )
    # Load team
    team_result = await db.execute(
        select(Team).where(Team.id == evaluation.team_id)
    )
    team = team_result.scalar_one()
    # ... apply deltas, flush, return dict
    evaluation.status = EvaluationStatus.APPROVED
    evaluation.approved_at = datetime.now(timezone.utc)
    return {"team_id": str(team.id), "target_price": str(target_price), ...}
```

For fundamentals: prefer `admin_edits` over `proposed_deltas`; apply four deltas to `team.fundamental_*` (null-safe with archetype midpoint fallback per D-03); compute fresh `drift_target_pct` via `simulation_service.compute_drift_target(team, bands)`; persist prior `drift_now` snapshot into `drift_floor_pct` BEFORE overwriting `ramp_started_at` (Pitfall 1 from RESEARCH); set `ramp_started_at = now`; set `approved_by_admin_id = admin_id`; return dict with `{team_id, ticker, new_drift_target_pct, z_scores}`.

**Core function 4 — `reject_fundamental_evaluation(db, evaluation_id, admin_notes)`** (mirror lines 285-322 `reject_evaluation`): byte-for-byte structure; just swap enum type.

**Core function 5 — `override_fundamentals(db, team_id, overrides, admin_id)`** (NEW — no direct analog). Pattern: same status-gate semantics as `apply_fundamental_deltas` but create synthetic `FundamentalEvaluation` row with `status=APPROVED`, `proposed_deltas={}`, `admin_edits=<overrides>`, `narrative="Admin override"`, `approved_by_admin_id=admin_id`, then run the same team-update flow. This way audit trail is preserved.

---

### `server/app/services/evaluation_service.py` (service, CRUD) — TOUCH (surgery on `approve_evaluation`)

**Analog:** self. Remove target_price/ticks_to_target writes.

**Lines 250-259 to DELETE** (per D-28, Pitfall 5):

```python
# Per D-11: Convert price_timeline to target_price
timeline = json.loads(evaluation.price_timeline)
final_change_pct = sum(entry["price_change_pct"] for entry in timeline)
target_price = round(
    team.stock_price * Decimal(str(1 + final_change_pct / 100)), 2
)

# Write to team
team.target_price = target_price
team.ticks_to_target = 20  # One quarter at 1 tick/min (per D-09)
```

**Lines 262-270 to PRESERVE** (news creation still runs):

```python
news = MarketNews(
    headline=evaluation.news_headline,
    content=evaluation.news_body,
    source_type="LLM_EVALUATION",
    source_team_id=team.id,
    sentiment_score=evaluation.news_sentiment,
    affected_tickers=json.dumps([team.ticker]),
)
db.add(news)
await db.flush()
```

**Return dict at lines 277-282**: drop `target_price` key; return `{"team_id", "news_id", "ticker"}` only. Update `admin.py:1069-1107` endpoint to stop reading `result["target_price"]` in the activity event.

---

### `server/app/services/game_service.py` (service, state machine) — TOUCH

**Analog:** self. Extend `set_game_phase` at lines 225-285 to enqueue `compute_fundamentals` fan-out on Live Floor → War Room transition.

**Pattern to extend** (lines 251-257 `set_game_phase` body):

```python
if phase == "war_room":
    state.game_phase = "war_room"
    if macro_brief is not None:
        state.macro_brief = macro_brief
elif phase == "live_floor":
    state.game_phase = "live_floor"
    state.current_quarter_start = now
```

Insert AFTER the `state.game_phase = "war_room"` assignment but BEFORE `await db.commit()` — or preferably AFTER commit to avoid enqueueing tasks in a rolled-back transaction. Pattern for task dispatch (lines 1088-1090 of `admin.py`):

```python
from app.worker.tasks.generate_news import generate_news
generate_news.delay(str(evaluation_id), result["team_id"])
```

Apply: `from app.worker.tasks.compute_fundamentals import compute_fundamentals_for_team` then iterate ACTIVE+archetype-assigned teams and call `.delay(state.current_round, str(team.id))`. Only fire fan-out when transitioning **into** war_room (guard: was previous phase `live_floor`? or unconditional on entry? — D-22 says "triggered by War Room transition" → fire on entry).

---

### `server/app/worker/tasks/compute_fundamentals.py` (worker task, event-driven fan-out + LLM) — NEW

**Analog:** `server/app/worker/tasks/evaluate_solution.py` (1:1 mirror).

**Task decorator pattern** (lines 17-23 of analog):

```python
@celery_app.task(
    name="solution.evaluate",
    time_limit=120,        # LLM calls can take 30-60s (override global 60s)
    soft_time_limit=100,
    max_retries=2,
    default_retry_delay=10,
)
def evaluate_solution(solution_id: str):
    asyncio.run(_evaluate(solution_id))
```

For fundamentals: name `"fundamentals.compute_for_team"`, same time limits, **add `rate_limit="20/m"`** (Pitfall 10 — throttle OpenRouter fan-out).

**Deferred imports + asyncio.run pattern** (lines 36-40):

```python
from app.database import get_worker_session
from app.models import Evaluation, EvaluationStatus, Solution
from app.redis_pubsub import publish_broadcast_sync, publish_to_team_sync
from app.services.evaluation_service import build_prompt, save_evaluation
from app.services.llm_service import call_openrouter
```

Swap: `from app.services.fundamental_service import build_fundamental_prompt, save_fundamental_evaluation`, `from app.models import FundamentalEvaluation, FundamentalEvalStatus, Team`.

**Happy path + broadcast AFTER commit pattern** (lines 44-63 of analog — copy verbatim, swap message type):

```python
async with get_worker_session() as db:
    try:
        prompt = await build_prompt(db, sid)
        llm_output, metadata = await call_openrouter(prompt)
        evaluation = await save_evaluation(db, sid, llm_output, metadata)
        await db.commit()

        # Notify admin after commit (per RESEARCH anti-patterns)
        publish_broadcast_sync({
            "type": "evaluation_pending",
            "payload": {
                "evaluation_id": str(evaluation.id),
                "team_id": str(evaluation.team_id),
            },
        })
```

Swap `call_openrouter(prompt)` → `call_openrouter(prompt, json_schema=FUNDAMENTAL_DELTA_SCHEMA)` (schema defined in this same file top-level, mirroring `NEWS_SCHEMA` in `generate_news.py:20-73`). Broadcast type: `"fundamental_evaluation_pending"`.

**FAILED record on exception pattern** (lines 65-99 of analog — copy verbatim):

```python
except Exception as e:
    logger.error("Evaluation failed for solution %s: %s", solution_id, e)
    await db.rollback()
    try:
        async with get_worker_session() as fail_db:
            from sqlalchemy import select
            result = await fail_db.execute(
                select(Solution).where(Solution.id == sid)
            )
            solution = result.scalar_one_or_none()
            if solution:
                eval_obj = Evaluation(
                    solution_id=solution.id,
                    team_id=solution.team_id,
                    status=EvaluationStatus.FAILED,
                    raw_response=str(e)[:5000],  # Truncate for safety
                )
                fail_db.add(eval_obj)
                await fail_db.commit()
                publish_to_team_sync(solution.team_id, {
                    "type": "evaluation_failed",
                    "payload": {"solution_id": solution_id},
                })
    # ...
    raise  # Let Celery retry
```

Swap: Solution lookup → Team lookup by `team_id`; create `FundamentalEvaluation(team_id=team.id, round_number=round_number, status=FAILED, proposed_deltas="{}", raw_response=str(e)[:5000])`; publish to the team's WS channel with type `"fundamental_evaluation_failed"`.

**FUNDAMENTAL_DELTA_SCHEMA to define at top of file** — mirror `NEWS_SCHEMA` structure from `server/app/worker/tasks/generate_news.py:20-73`:

```python
NEWS_SCHEMA = {
    "name": "news_output",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "market_commentary": {
                "type": "object",
                "properties": {
                    "headline": {"type": "string", "description": "Max 120 chars..."},
                    ...
                },
                "required": [...],
                "additionalProperties": False,
            },
            ...
        },
        "required": [...],
        "additionalProperties": False,
    },
}
```

Apply: keys `market_share_delta`, `margin_delta`, `growth_delta`, `ops_efficiency_delta` (all `"type": "number"`), plus `narrative` (`"type": "string"`). All five in `required`, `additionalProperties: False`, `strict: true`. See RESEARCH Pattern 7 for the exact shape.

---

### `server/app/worker/tasks/game_tick.py` (worker task, periodic tick + broadcast) — TOUCH

**Analog:** self. Only `_execute_tick()` body (lines 66-88) changes; the outer `game_tick()` task and `is_game_active()` guard are untouched.

**Unchanged pattern** (preserves Phase 8 war_room guard at lines 38-45 verbatim):

```python
phase = r.get("game:phase")
if phase is not None:
    if isinstance(phase, bytes):
        phase = phase.decode()
    if phase == "war_room":
        logger.debug("Tick skipped: game phase is war_room")
        return False
```

**Body extension pattern** (current lines 72-88):

```python
from app.database import get_worker_session
from app.services.simulation_service import calculate_all_prices
from app.redis_pubsub import publish_broadcast_sync

async with get_worker_session() as db:
    price_updates = await calculate_all_prices(db)
    await db.commit()

# Publish AFTER commit (per RESEARCH anti-patterns)
if price_updates:
    publish_broadcast_sync({
        "type": "price_update",
        "payload": {"prices": price_updates},
    })
```

Change to unpack tuple: `price_updates, shock_events = await calculate_all_prices(db)`. Add second publish after first: `if shock_events: publish_broadcast_sync({"type": "shock_applied", "payload": {"shocks": shock_events}})`. Keep "publish AFTER `db.commit()`" invariant.

---

### `server/app/worker/tasks/generate_news.py` (worker task, LLM call + DB insert) — TOUCH

**Analog:** self. Extend `NEWS_SCHEMA` (lines 20-73) with `is_event`, `severity`, `direction`, `affected_tickers` fields; add post-LLM shock enqueue logic.

**Existing schema structure to extend** (lines 20-73):

```python
NEWS_SCHEMA = {
    "name": "news_output",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "market_commentary": {
                "type": "object",
                "properties": {
                    "headline": {"type": "string", "description": "Max 120 chars, team-specific market reaction"},
                    "body": {"type": "string", "description": "2-3 sentence market analysis"},
                    "sentiment": {"type": "number", "description": "-1.0 to 1.0"},
                },
                "required": ["headline", "body", "sentiment"],
                "additionalProperties": False,
            },
            "world_event": {
                "type": "object",
                "properties": {
                    "headline": {"type": "string", "description": "Max 120 chars, broader market context"},
                    "body": {"type": "string", "description": "2-3 sentence world event description"},
                    "sentiment": {"type": "number", "description": "-1.0 to 1.0"},
                    "affected_sectors": {"type": "array", "items": {"type": "string"}, ...},
                },
                "required": ["headline", "body", "sentiment", "affected_sectors"],
                "additionalProperties": False,
            },
        },
        "required": ["market_commentary", "world_event"],
        "additionalProperties": False,
    },
}
```

Add into BOTH `market_commentary` and `world_event`: `is_event: bool`, `severity: enum [MINOR, MAJOR, CATASTROPHIC]`, `direction: enum [POSITIVE, NEGATIVE]`, `affected_tickers: array of string`. Add all to `required`. Keep `strict: true`.

**Existing news insert pattern to preserve** (lines 166-186):

```python
news_mc = MarketNews(
    headline=mc_headline,
    content=market_commentary["body"],
    source_type="MARKET_COMMENTARY",
    source_team_id=team.id,
    sentiment_score=Decimal(str(market_commentary["sentiment"])),
    affected_tickers=json.dumps([team.ticker]),
)
db.add(news_mc)
```

**New shock enqueue block to insert AFTER `db.add(news_mc)` / `db.add(news_we)`, BEFORE `db.commit()`** (pattern from RESEARCH Pattern 8):

```python
SEVERITY_MAG = {"MINOR": Decimal("3"), "MAJOR": Decimal("8"), "CATASTROPHIC": Decimal("15")}
DIRECTION_SIGN = {"POSITIVE": Decimal("1"), "NEGATIVE": Decimal("-1")}
for payload, news_obj in [(market_commentary, news_mc), (world_event, news_we)]:
    if payload.get("is_event"):
        magnitude = SEVERITY_MAG[payload["severity"]] * DIRECTION_SIGN[payload["direction"]]
        for ticker in payload.get("affected_tickers", []):
            team_row = (await db.execute(
                select(Team).where(Team.ticker == ticker)
            )).scalar_one_or_none()
            if team_row:
                db.add(PendingShock(
                    team_id=team_row.id,
                    magnitude_pct=magnitude,
                    source=ShockSource.LLM_EVENT,
                    source_ref_id=news_obj.id,
                ))
```

**Error handling pattern preserved** (lines 225-232): LLM failure logged but NOT re-raised (non-critical per T-06-02). Keep this for shock-enqueue too — a missing team ticker must not fail the whole task.

---

### `server/app/api/admin.py` (controller/router, request-response) — EXTEND

**Analog:** self — 1:1 mirror of the evaluation endpoints at lines 972-1148, plus extension of `inject_crisis` at line 1203.

**Endpoint 1 — `GET /api/v1/admin/fundamentals-queue`** (mirror `list_evaluations` at lines 972-1000):

```python
@router.get("/evaluations", response_model=list[EvaluationListItem])
async def list_evaluations(
    status_filter: Optional[str] = Query(None, alias="status"),
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List evaluations with team info. Optionally filter by status (EVAL-03)."""
    from sqlalchemy.orm import selectinload
    query = (
        select(Evaluation)
        .options(selectinload(Evaluation.team), selectinload(Evaluation.solution))
        .order_by(Evaluation.created_at.desc())
    )
    if status_filter:
        try:
            eval_status = EvaluationStatus(status_filter)
            query = query.where(Evaluation.status == eval_status)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status: {status_filter}. Valid: {[s.value for s in EvaluationStatus]}",
            )
    result = await db.execute(query)
    evaluations = result.scalars().all()
    return [_evaluation_to_list_item(e, e.team) for e in evaluations]
```

Swap `Evaluation` → `FundamentalEvaluation`, remove `selectinload(Evaluation.solution)` (no solution relation on fundamental eval), response_model → `FundamentalEvalListItem`.

**Endpoint 2 — `PATCH /api/v1/admin/fundamentals-queue/:id`** (mirror `edit_evaluation` at lines 1024-1065):

```python
@router.put("/evaluations/{evaluation_id}", response_model=EvaluationActionResponse)
async def edit_evaluation(
    evaluation_id: uuid.UUID,
    request: EvaluationEditRequest,
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Edit evaluation fields before approval (EVAL-04). Only PENDING_APPROVAL (T-05-08)."""
    result = await db.execute(
        select(Evaluation).where(Evaluation.id == evaluation_id)
    )
    evaluation = result.scalar_one_or_none()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    if evaluation.status != EvaluationStatus.PENDING_APPROVAL:
        raise HTTPException(
            status_code=409,
            detail=f"Can only edit PENDING_APPROVAL evaluations, current: {evaluation.status.value}",
        )
    # Update only non-None fields
    if request.overall_score is not None:
        evaluation.overall_score = request.overall_score
    # ...
    await db.commit()
    return EvaluationActionResponse(message="Evaluation updated", evaluation_id=str(evaluation.id))
```

Swap: use `PATCH` verb (CONTEXT D-25), write to `evaluation.admin_edits = json.dumps({...})` instead of direct column writes; keep 409-on-not-pending guard verbatim.

**Endpoint 3 — `POST /api/v1/admin/fundamentals-queue/:id/approve`** (mirror `approve_evaluation_endpoint` at lines 1068-1107):

```python
@router.post("/evaluations/{evaluation_id}/approve", response_model=EvaluationActionResponse)
async def approve_evaluation_endpoint(
    evaluation_id: uuid.UUID,
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await _approve_evaluation(db, evaluation_id)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    db.add(ActivityEvent(
        event_type="EVALUATION_APPROVED",
        actor="admin",
        description=f"Evaluation approved for {result['ticker']} (target: ${result['target_price']})",
        metadata_json=json.dumps(result),
    ))
    await db.commit()
    # D-01: Dispatch news generation after approval
    from app.worker.tasks.generate_news import generate_news
    generate_news.delay(str(evaluation_id), result["team_id"])
    # Broadcast news to all teams
    await publish_broadcast({
        "type": "evaluation_approved",
        "payload": {...},
    })
    return EvaluationActionResponse(...)
```

Swap: call `apply_fundamental_deltas(db, evaluation_id, admin_id=_admin["admin_id"])`; ActivityEvent type `"FUNDAMENTALS_APPROVED"`; no news dispatch; broadcast `"fundamentals_updated"` with `{team_id, ticker, fundamentals, z_scores, drift_target_pct}` (Open Question 6 → include full payload).

**Endpoint 4 — `POST /api/v1/admin/fundamentals-queue/:id/reject`** (mirror lines 1114-1147): verbatim mirror, swap enum + broadcast type `"fundamentals_rejected"`.

**Endpoint 5 — `POST /api/v1/admin/teams/:id/override-fundamentals`** (no direct analog, adapt `approve_evaluation_endpoint`): skip the PENDING_APPROVAL guard; take `FundamentalOverrideRequest` body with four delta fields; call `fundamental_service.override_fundamentals(...)`; ActivityEvent type `"FUNDAMENTALS_OVERRIDDEN"`.

**Endpoint 6 — `GET /api/v1/admin/teams/:id/fundamentals`** (new — analog: per-team read portion of `list_evaluations`). Load `Team.archetype`, parse benchmark_bands, compute live z-scores using `simulation_service.z_score` + `compute_weighted_z`, return `{fundamentals, bands, z_scores, weighted_z, drift_target_pct, drift_floor_pct, ramp_started_at, ramp_fraction}`.

**Endpoint 7 — `POST /api/v1/admin/teams/:id/score` → 410 Gone** (D-28). Existing endpoint at lines 452-483: replace body with:

```python
raise HTTPException(
    status_code=410,
    detail="v1 quality_score flow replaced by fundamental evaluation and override endpoints",
)
```

Keep route decorator and signature to preserve URL contract.

**Endpoint 8 — `POST /api/v1/admin/crisis/inject` extended** (Assumption A4 / A7 — RESEARCH recommends "option 1: extend"). Existing pattern at lines 1203-1262:

```python
@router.post("/crisis/inject", response_model=CrisisInjectResponse)
async def inject_crisis(
    request: CrisisInjectRequest,
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(CrisisEvent).where(CrisisEvent.status == "ACTIVE")
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A crisis is already active...")
    crisis = CrisisEvent(
        scenario=request.scenario,
        timer_seconds=request.timer_seconds,
        status="ACTIVE",
    )
    db.add(crisis)
    # D-04 step 2: Auto-pause game
    try:
        await transition_state(db, GameStatus.PAUSED)
    except ValueError:
        pass
    db.add(ActivityEvent(...))
    await db.commit()
```

Extend `CrisisInjectRequest` (lines 207-209) with three optional fields: `affected_team_ids: list[str] | None = None`, `severity: Literal["MINOR","MAJOR","CATASTROPHIC"] | None = None`, `direction: Literal["POSITIVE","NEGATIVE"] | None = None`. When all three present, enqueue `PendingShock` rows per team with `source=ShockSource.CRISIS, source_ref_id=crisis.id`. When absent → current narrative-only + auto-pause behavior preserved.

**Existing `ActivityEvent` + `publish_broadcast` pattern to reuse** for all new endpoints (lines 1080-1086, 1093-1102):

```python
db.add(ActivityEvent(
    event_type="EVALUATION_APPROVED",
    actor="admin",
    description=f"Evaluation approved for {result['ticker']}...",
    metadata_json=json.dumps(result),
))
await db.commit()
await publish_broadcast({
    "type": "evaluation_approved",
    "payload": {...},
})
```

**Existing `require_admin` auth pattern** applies to every new endpoint (`_admin: dict = Depends(require_admin)` from line 36 import).

**Existing `_validate_benchmark_bands` at lines 1427-1452** — reuse as-is if any new endpoint validates band JSON (not expected for Phase 9 admin endpoints, but shared if override ever touches bands).

**Archetype-assign population hook** (lines 1639-1650, `assign_archetype` body):

```python
# D-02: Populate team fields from archetype
team.archetype_id = archetype.id
team.caseline_document = archetype.dossier_content
team.company_display_name = archetype.name
team.cash = archetype.starting_cash
team.stock_price = archetype.starting_stock_price
team.shares_outstanding = archetype.starting_shares
team.swot_strengths = archetype.swot_strengths
team.swot_weaknesses = archetype.swot_weaknesses
team.swot_opportunities = archetype.swot_opportunities
team.swot_threats = archetype.swot_threats
```

Extend per D-03/D-04 — insert BEFORE `db.add(ActivityEvent...)`:

```python
bands = json.loads(archetype.benchmark_bands)
team.fundamental_market_share    = Decimal(str((bands["market_share"][0]    + bands["market_share"][1]    ) / 2))
team.fundamental_margin          = Decimal(str((bands["margin"][0]          + bands["margin"][1]          ) / 2))
team.fundamental_growth          = Decimal(str((bands["growth"][0]          + bands["growth"][1]          ) / 2))
team.fundamental_ops_efficiency  = Decimal(str((bands["ops_efficiency"][0]  + bands["ops_efficiency"][1]  ) / 2))
```

---

### `server/app/api/teams.py` (controller/router, team-scoped read) — EXTEND

**Analog:** self. Add `GET /api/v1/teams/me/fundamentals` following the same JWT-auth + async-session pattern as `list_approved_teams` (lines 20-40):

```python
@router.get("/approved", response_model=list[ApprovedTeamItem])
async def list_approved_teams(
    _user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Team)
        .where(Team.status.in_([TeamStatus.READY, TeamStatus.ACTIVE]))
        .order_by(Team.name)
    )
    teams = result.scalars().all()
    return [ApprovedTeamItem(...) for t in teams]
```

Apply: extract `team_id` from `_user["team_id"]` (already placed in JWT by `get_current_user` — see `app/auth_utils.py`); load Team with `selectinload(Team.archetype)`; compute z-scores via `simulation_service.z_score`; return `TeamFundamentalsResponse` with raw + z-scores + bands. Auth semantics: JWT-scoped to self-team; no other team's fundamentals visible (ASVS V4, Security Domain in RESEARCH).

---

### `server/app/schemas/fundamentals.py` (schemas, validation) — NEW

**Analog:** `server/app/schemas/decisions.py` (100 LOC, directly parallel in shape).

**Imports + file structure pattern** (lines 1-19 of analog):

```python
"""Pydantic schemas for Phase 8 decision levers and round structure.

Covers: decision submission, operating plan submission, budget response,
game phase transitions.
"""

from enum import Enum

from pydantic import BaseModel, Field


class LeverCategory(str, Enum):
    """Mirror of the SQLAlchemy LeverCategory enum for Pydantic validation."""

    PRICING = "PRICING"
    MARKETING = "MARKETING"
    SUPPLY_CHAIN = "SUPPLY_CHAIN"
    NEW_PRODUCT = "NEW_PRODUCT"
```

**Request/response pair pattern** (lines 26-50):

```python
class DecisionSubmitRequest(BaseModel):
    lever_category: LeverCategory
    decisions_json: dict = Field(
        ..., description="Lever-specific values as a JSON object"
    )
    budget_spent: float = Field(ge=0, description="Budget allocated to this lever")


class DecisionSubmitResponse(BaseModel):
    message: str
    decision_id: str
    lever_category: str
    budget_spent: str
```

Apply: build `FundamentalEvalListItem`, `FundamentalEditRequest` (PATCH body with optional four `_delta` fields + narrative + admin_edits as JSON string), `FundamentalActionResponse` (mirror `EvaluationActionResponse` at `admin.py:190-192`), `FundamentalOverrideRequest` (four required delta fields), `TeamFundamentalsResponse` (raw fundamentals + z_scores + bands + drift_target_pct + ramp_fraction), `ShockSeverity`/`ShockDirection` str enums (mirror `LeverCategory` str-Enum pattern at lines 12-18).

**Validation constants** — use `Field(ge=-100, le=100)` for deltas (percentage-point bounds matching D-17 ±15% cap with margin).

---

### `server/app/models.py` (model, SQLAlchemy) — TOUCH

**Analog:** self. Mirror `Evaluation` at lines 348-411 for `FundamentalEvaluation`; mirror `CrisisEvent` at lines 675-689 for `PendingShock`.

**New enums to add** (pattern lines 70-87):

```python
class LeverCategory(str, enum.Enum):
    PRICING = "PRICING"
    MARKETING = "MARKETING"
    SUPPLY_CHAIN = "SUPPLY_CHAIN"
    NEW_PRODUCT = "NEW_PRODUCT"
```

Add: `FundamentalEvalStatus` (values `PROCESSING, PENDING_APPROVAL, APPROVED, REJECTED, FAILED` — reuses Phase 5 state machine names for mental model parity but distinct enum to keep DB migrations decoupled), `ShockSource` (values `CRISIS, LLM_EVENT`), `ShockSeverity` (values `MINOR, MAJOR, CATASTROPHIC`), `ShockDirection` (values `POSITIVE, NEGATIVE`).

**Team column additions** (insert after lines 171-174 which currently hold `target_price`/`ticks_to_target`):

```python
# Simulation: price trajectory (per D-05, Phase 4 mock score input)
target_price: Mapped[Optional[Decimal]] = mapped_column(
    Numeric(10, 2), nullable=True
)
ticks_to_target: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
```

**Delete both** (per D-31). **Add**:

```python
fundamental_market_share: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
fundamental_margin:        Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
fundamental_growth:        Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
fundamental_ops_efficiency: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
drift_target_pct: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 6), nullable=True)
drift_floor_pct:  Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 6), nullable=True)  # per Pitfall 1
ramp_started_at:  Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
```

**`FundamentalEvaluation` model** (mirror `Evaluation` at lines 348-411 verbatim):

```python
class Evaluation(Base):
    __tablename__ = "evaluations"
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    solution_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("solutions.id"), unique=True, nullable=False
    )
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id"), nullable=False
    )
    status: Mapped[EvaluationStatus] = mapped_column(
        Enum(EvaluationStatus), default=EvaluationStatus.PROCESSING
    )
    # ... scoring_metrics, price_timeline, news_headline, news_body, news_sentiment
    # ... llm_model, llm_latency_ms, llm_cost, raw_response
    approved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    rejected_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    admin_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
    solution: Mapped["Solution"] = relationship("Solution", back_populates="evaluation")
    team: Mapped["Team"] = relationship("Team")
```

Swap: drop `solution_id` FK; replace scoring*metrics/price_timeline/news*\* columns with `proposed_deltas: Mapped[str] = mapped_column(Text, nullable=False)`, `admin_edits: Mapped[Optional[str]] = mapped_column(Text, nullable=True)`, `narrative: Mapped[Optional[str]] = mapped_column(Text, nullable=True)`, `round_number: Mapped[int] = mapped_column(Integer, nullable=False)`, `approved_by_admin_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("admins.id"), nullable=True)`. Keep `status`, all timestamps, `llm_model`, `llm_latency_ms`, `raw_response`, `admin_notes`. Add `UniqueConstraint("team_id", "round_number")`.

**`PendingShock` model** (mirror `CrisisEvent` at 675-689 + `Decision` at 607-646 for FK+index pattern):

```python
class CrisisEvent(Base):
    __tablename__ = "crisis_events"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scenario: Mapped[str] = mapped_column(Text, nullable=False)
    timer_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
```

Apply shape:

```python
class PendingShock(Base):
    __tablename__ = "pending_shocks"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id"), nullable=False)
    magnitude_pct: Mapped[Decimal] = mapped_column(Numeric(6, 3), nullable=False)  # signed, e.g. -15.000
    source: Mapped[ShockSource] = mapped_column(Enum(ShockSource), nullable=False)
    source_ref_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    enqueued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    applied_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    team: Mapped["Team"] = relationship("Team")
    __table_args__ = (
        Index("ix_pending_shocks_team_unapplied", "team_id", "applied_at"),
    )
```

---

### `server/alembic/versions/005_fundamentals_and_shocks.py` (migration, DDL) — NEW

**Analog:** `server/alembic/versions/004_decision_levers_round_structure.py` (full template) + `003_add_archetype.py` (add_column + FK pattern).

**Header + enum creation pattern** (004 lines 1-25):

```python
"""Add decisions, operating_plans tables and game_phase fields on game_state

Revision ID: 004_decision_levers
Revises: 003_archetype
Create Date: 2026-04-16
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = "004_decision_levers"
down_revision = "003_archetype"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create levercategory enum type
    lever_enum = sa.Enum(
        "PRICING", "MARKETING", "SUPPLY_CHAIN", "NEW_PRODUCT",
        name="levercategory",
    )
    lever_enum.create(op.get_bind(), checkfirst=True)
```

Apply: `revision = "005_fundamentals"`, `down_revision = "004_decision_levers"`. Create three enums: `fundamentalevalstatus`, `shocksource`, (optional: `shockseverity`, `shockdirection` if enums used in DB; RESEARCH Pattern 6 only declares two).

**`create_table` pattern with UUID PKs + server_default + unique constraint** (004 lines 28-52):

```python
op.create_table(
    "decisions",
    sa.Column("id", UUID(as_uuid=True), primary_key=True),
    sa.Column("team_id", UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=False),
    sa.Column("round_number", sa.Integer(), nullable=False),
    sa.Column("lever_category", lever_enum, nullable=False),
    sa.Column("decisions_json", sa.Text(), nullable=False),
    sa.Column("budget_spent", sa.Numeric(15, 2), server_default="0", nullable=False),
    sa.Column("submitted_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
    sa.Column("window_end", sa.DateTime(timezone=True), nullable=False),
    sa.UniqueConstraint("team_id", "round_number", "lever_category", name="uq_decision_team_round_lever"),
)
op.create_index(
    "ix_decisions_team_round_lever",
    "decisions",
    ["team_id", "round_number", "lever_category"],
)
```

**`add_column` + `drop_column` pattern** (004 lines 80-93 adds; 003 lines 52-60 adds FK column; inverse in downgrade):

```python
op.add_column("game_state", sa.Column("game_phase", sa.String(20), nullable=True))
op.add_column("game_state", sa.Column("macro_brief", sa.Text(), nullable=True))
op.add_column("game_state", sa.Column("current_quarter_start", sa.DateTime(timezone=True), nullable=True))
```

Apply for Phase 9: add 7 columns to `teams` (`fundamental_market_share`, `fundamental_margin`, `fundamental_growth`, `fundamental_ops_efficiency`, `drift_target_pct`, `drift_floor_pct`, `ramp_started_at`), drop `target_price` + `ticks_to_target`.

**`downgrade` reversibility pattern** (004 lines 96-105):

```python
def downgrade() -> None:
    op.drop_column("game_state", "current_quarter_start")
    op.drop_column("game_state", "macro_brief")
    op.drop_column("game_state", "game_phase")
    op.drop_index("ix_decisions_team_round_lever", table_name="decisions")
    op.drop_table("operating_plans")
    op.drop_table("decisions")
    sa.Enum(name="levercategory").drop(op.get_bind(), checkfirst=True)
```

Apply: drop indexes → drop tables → drop columns → re-add dropped v1 columns (`target_price`, `ticks_to_target`) → drop enums. See RESEARCH Pattern 6 lines 559-574 for exact downgrade order.

**Backfill hook** (Open Question 5 resolution): after adding the nullable fundamental columns but inside the same `upgrade()` body, run a raw SQL UPDATE to populate existing archetype-assigned teams from band midpoints:

```python
op.execute("""
    UPDATE teams
    SET fundamental_market_share    = (ap.band_min_ms + ap.band_max_ms) / 2,
        fundamental_margin          = (ap.band_min_mg + ap.band_max_mg) / 2,
        -- ... etc
    FROM (SELECT id, ... FROM archetypes) ap
    WHERE teams.archetype_id = ap.id AND teams.fundamental_market_share IS NULL
""")
```

(Concrete SQL depends on how bands JSON is parsed — migration may alternatively do a Python-side loop via `op.get_bind().execute(...)`. Planner decides.)

---

### `client/src/app/admin/fundamentals/page.tsx` (component, page) — NEW

**Analog:** `client/src/app/admin/evaluations/page.tsx` (625 LOC, full 1:1 clone).

**Imports + auth guard pattern** (lines 1-12, 43-67):

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { ClipboardCheck, ChevronDown, ChevronUp, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { useAuthStore } from "@/stores/auth-store";
import { useWebSocket } from "@/hooks/use-websocket";
import { api } from "@/lib/api";
import type { EvaluationListItem } from "@/lib/types";
import { toast } from "sonner";
// ...
export default function EvaluationsPage() {
  const router = useRouter();
  const { isAuthenticated, role } = useAuthStore();
  // ... state
  useEffect(() => {
    if (!isAuthenticated || role !== "admin") {
      router.push("/admin/login");
    }
  }, [isAuthenticated, role, router]);
```

Swap: import `FundamentalEvaluationListItem` type; pick a suitable Lucide icon (TrendingUp already used by Markets — suggest `Gauge` or `Activity`).

**Filter + status color constants** (lines 13-28):

```tsx
const FILTER_OPTIONS = [
  "ALL",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "PROCESSING",
  "FAILED",
] as const;
const STATUS_COLORS: Record<string, string> = {
  PROCESSING: "text-amber-400 bg-amber-400/10",
  PENDING_APPROVAL: "text-[#2196f3] bg-[#2196f3]/10",
  APPROVED: "text-[#02c953] bg-[#02c953]/10",
  REJECTED: "text-[#FF1744] bg-[#FF1744]/10",
  FAILED: "text-red-800 bg-red-800/10",
};
```

Reuse verbatim.

**Fetch + WebSocket auto-refresh pattern** (lines 69-103):

```tsx
const fetchEvaluations = useCallback(async () => {
  try {
    setLoading(true);
    const data = await api.getEvaluations(
      activeFilter === "ALL" ? undefined : activeFilter,
    );
    setEvaluations(data);
  } catch {
    toast.error("Failed to load evaluations");
  } finally {
    setLoading(false);
  }
}, [activeFilter]);
// ...
const handleMessage = useCallback(
  (data: Record<string, unknown>) => {
    if (
      data.type === "evaluation_pending" ||
      data.type === "evaluation_updated"
    ) {
      fetchEvaluations();
    }
  },
  [fetchEvaluations],
);
useWebSocket({
  onMessage: handleMessage,
  enabled: isAuthenticated && role === "admin",
});
```

Swap: `api.getFundamentalsQueue(...)`, WS message types `"fundamental_evaluation_pending"`, `"fundamentals_updated"`, `"fundamental_evaluation_failed"`.

**Approve/reject action handler pattern** (lines 179-213):

```tsx
async function handleApprove(evaluationId: string) {
  setActionLoading(true);
  try {
    await api.approveEvaluation(evaluationId);
    toast.success("Evaluation approved -- impact queued for next tick");
    setExpandedId(null);
    await fetchEvaluations();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Failed to approve");
  } finally {
    setActionLoading(false);
  }
}
```

Swap success toast: `"Fundamentals applied — ramp started"`.

**Card + expanded edit block pattern** (lines 289-622 — the visual shell stays identical, the form fields swap). Input fields: replace the 5 scoring-metric inputs with 4 delta inputs (`market_share_delta`, `margin_delta`, `ops_efficiency_delta`, `growth_delta` — labels "MKT SHARE Δ", "PROFITABILITY Δ", "OPS EFF Δ", "BRAND HEALTH Δ" per D-11 relabel). Replace `NEWS_ARTICLE` + `PRICE_TIMELINE` sections with a `PROJECTED vs CURRENT` table showing `current / +delta = projected` for each fundamental, plus z-score before/after (calculated client-side from archetype bands included in the list item response). Narrative renders read-only as a paragraph below.

**Action button palette reuse** (lines 586-615) — APPROVE green `bg-[#02c953]`, REJECT red `bg-[#FF1744]`, SAVE CHANGES `bg-[#2a2a2a] text-[#2196f3]`. Palette is locked by CLAUDE.md Bloomberg Terminal Blue aesthetic.

---

### `client/src/components/admin/admin-sidebar.tsx` (component, static nav) — TOUCH

**Analog:** self. Extend `NAV_ITEMS` constant at lines 21-29.

**Existing pattern** (lines 5-29):

```tsx
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  TrendingUp,
  Newspaper,
  Settings,
  Activity,
  LogOut,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/admin", icon: LayoutDashboard, label: "DASHBOARD", exact: true },
  { href: "/admin/teams", icon: Users, label: "TEAMS", exact: false },
  {
    href: "/admin/evaluations",
    icon: ClipboardCheck,
    label: "EVALS",
    exact: false,
  },
  { href: "/admin/markets", icon: TrendingUp, label: "MARKETS", exact: false },
  { href: "/admin/news", icon: Newspaper, label: "NEWS", exact: false },
  { href: "/admin/settings", icon: Settings, label: "SETTINGS", exact: false },
  { href: "/admin/activity", icon: Activity, label: "ACTIVITY", exact: false },
] as const;
```

Apply: add `import { Gauge } from "lucide-react"` (or `Activity` — careful to pick one not already used); insert entry BETWEEN EVALS and MARKETS (CONTEXT D-26): `{ href: "/admin/fundamentals", icon: Gauge, label: "FUND", exact: false }`. (Label short enough for 20px sidebar per lines 40-64 styling.)

**Active state pattern preserved** (lines 43-47):

```tsx
const isActive = item.exact
  ? activePath === item.href
  : activePath.startsWith(item.href);
```

No changes — `/admin/fundamentals` matches the prefix rule.

---

### `client/src/components/game/CaselinePanel.tsx` (component, REST fetch) — TOUCH

**Analog:** self. Extend with fundamentals strip inserted between "ARCHETYPE IDENTITY" block (ends at line 131) and "CASELINE DOCUMENT" block (starts at line 134).

**Existing benchmark bands parse pattern** (lines 102-128):

```tsx
{
  caseline.benchmark_bands &&
    (() => {
      try {
        const bands = JSON.parse(caseline.benchmark_bands);
        return (
          <div className="grid grid-cols-2 gap-2">
            <div className="flex justify-between">
              <span className="text-[10px] text-[#89919d] uppercase">
                MKT SHARE
              </span>
              <span className="font-mono text-xs text-[#e5e2e1]">
                {bands.market_share[0]}-{bands.market_share[1]}%
              </span>
            </div>
            {/* margin, growth, ops_efficiency */}
          </div>
        );
      } catch {
        return null;
      }
    })();
}
```

Reuse this JSON-parse-in-IIFE pattern for the new fundamentals block. Load fundamentals via new `api.getMyFundamentals()` call (add to `api` client → hits `GET /api/v1/teams/me/fundamentals`). Use a second `useEffect`/`useState` pair mirroring lines 11-37.

**New fundamentals tile pattern** (RESEARCH Example 4):

```tsx
{
  fundamentals && (
    <div className="space-y-3">
      <div className="text-[9px] text-[#89919d] uppercase font-bold tracking-widest">
        FUNDAMENTALS
      </div>
      <div className="grid grid-cols-2 gap-1">
        {[
          {
            label: "MKT SHARE",
            value: fundamentals.market_share,
            z: fundamentals.z_market_share,
            band: bands.market_share,
          },
          {
            label: "PROFITABILITY",
            value: fundamentals.margin,
            z: fundamentals.z_margin,
            band: bands.margin,
          },
          {
            label: "OPS EFF",
            value: fundamentals.ops_efficiency,
            z: fundamentals.z_ops_efficiency,
            band: bands.ops_efficiency,
          },
          {
            label: "BRAND HEALTH",
            value: fundamentals.growth,
            z: fundamentals.z_growth,
            band: bands.growth,
          },
        ].map(({ label, value, z, band }) => {
          const inBand = Math.abs(z) <= 1;
          const color = inBand ? "#02c953" : z > 0 ? "#9ecaff" : "#FF1744";
          return (
            <div key={label} className="bg-[#201f1f] p-2">
              <div className="text-[9px] text-[#89919d] uppercase font-bold tracking-widest mb-1">
                {label}
              </div>
              <div className="flex justify-between items-baseline">
                <span className="font-mono text-xs" style={{ color }}>
                  {Number(value).toFixed(2)}
                </span>
                <span className="font-mono text-[10px] text-[#89919d]">
                  z {Number(z).toFixed(2)}
                </span>
              </div>
              <div className="text-[9px] text-[#404752] font-mono mt-1">
                band {band[0]}-{band[1]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

Visual consistency with existing SWOT grid at lines 165-181 (`grid-cols-2 gap-1` + `bg-[#201f1f] p-2` tile shape) and benchmark bands block above (same 4-key ordering; UI labels match D-11 relabel).

**WebSocket `fundamentals_updated` subscriber**: also register `useWebSocket` hook in this component (mirror evaluations page pattern at lines 100-103) to re-fetch when the team's fundamentals change live.

---

### `client/src/lib/types.ts` — EXTEND

**Analog:** self. Add new interfaces after `EvaluationListItem` (lines 240-256).

**Existing style to match**:

```ts
export interface EvaluationListItem {
  id: string;
  team_id: string;
  team_name: string;
  team_ticker: string;
  solution_type: string;
  status: string;
  overall_score: number | null;
  // ...
  created_at: string;
}

export interface EvaluationActionResponse {
  message: string;
  evaluation_id: string;
}
```

Apply: `FundamentalEvaluationListItem`, `FundamentalActionResponse`, `TeamFundamentalsResponse`, `FundamentalEvalPendingMessage`, `FundamentalsUpdatedMessage`, `ShockAppliedMessage` (WS types modeled after `PriceUpdateMessage` at lines 117-120).

**WS type shape pattern to mirror** (lines 108-120):

```ts
export interface PriceTickData {
  team_id: string;
  ticker: string;
  price: string;
  change_pct: string;
  market_cap: string;
  timestamp: string;
}

export interface PriceUpdateMessage {
  type: "price_update";
  payload: { prices: PriceTickData[] };
}
```

Apply: `ShockAppliedMessage { type: "shock_applied"; payload: { shocks: ShockEvent[] } }` and `FundamentalsUpdatedMessage { type: "fundamentals_updated"; payload: { team_id: string; fundamentals: {...}; z_scores: {...}; drift_target_pct: string } }`.

---

### Test files — NEW + REWRITE

**Analog:** `server/tests/test_evaluation.py` + `server/tests/test_game_tick.py` + `server/tests/conftest.py`.

**Pattern to mirror** — existing pytest structure at `server/tests/conftest.py`:

```python
# fixtures: mock_db, mock_redis, mock_team, mock_evaluation, game_state_active
```

Extend conftest.py with: `mock_archetype_with_bands` (returns Archetype with JSON bands), `mock_team_with_fundamentals` (Team with fundamental\_\* populated at band midpoints), `mock_fundamental_evaluation` (PENDING_APPROVAL), `mock_pending_shock`.

**Rewrite `test_simulation.py`** — DELETE `TestInterpolatePrice`, `TestSetTeamScore` classes; ADD `TestZScore`, `TestComputeDriftTarget`, `TestComputePrice`, `TestSentimentQuery`, `TestShockApplication`, `TestRamp`, `TestArchetypeRelative`, `TestFullTickCycle` (see RESEARCH §Validation Architecture for full list).

**Update `test_evaluation.py`** — modify `TestApproveEvaluation::test_approve_writes_target_price` to assert "news created but NOT target_price written" (column no longer exists post-migration).

**New `test_fundamental_service.py`** — mirror `test_evaluation.py` structure: `TestBuildPrompt`, `TestSaveEvaluation`, `TestApplyDeltas`, `TestRampReset`, `TestQuarterTransitionFanOut`.

**New `test_admin_fundamentals.py`** — mirror admin test patterns: `TestListQueue`, `TestEditThenApprove`, `TestReject`, `TestOverride`, `TestCrisisShockEnqueue`, `TestGetTeamFundamentals`.

**New `test_shock_enqueue.py`** — covers `generate_news` shock enqueue branch + admin crisis shock enqueue branch.

---

## Shared Patterns

### Authentication

**Source:** `server/app/auth_utils.py` — `require_admin` dep, `get_current_user` dep.
**Apply to:** ALL new admin endpoints (use `_admin: dict = Depends(require_admin)`), and `GET /api/v1/teams/me/fundamentals` (use `_user: dict = Depends(get_current_user)`).
**Pattern** (`server/app/api/admin.py:456-461`):

```python
async def set_team_score(
    team_id: uuid.UUID,
    request: SetScoreRequest,
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
```

### Error Handling: ValueError → HTTPException 409

**Source:** `server/app/api/admin.py:1075-1078` and `server/app/services/evaluation_service.py:238-242`.
**Apply to:** All endpoints that call `fundamental_service.apply_fundamental_deltas` / `reject_fundamental_evaluation`. Pattern: service raises `ValueError` on status mismatch; endpoint converts to 409.
**Pattern**:

```python
try:
    result = await _approve_evaluation(db, evaluation_id)
except ValueError as e:
    raise HTTPException(status_code=409, detail=str(e))
```

### Publish-After-Commit (WebSocket Broadcast Invariant)

**Source:** `server/app/worker/tasks/game_tick.py:76-85` and `server/app/worker/tasks/evaluate_solution.py:49-58`.
**Apply to:** Every Celery task AND every admin endpoint that mutates state + broadcasts. Never broadcast inside an open transaction.
**Pattern**:

```python
async with get_worker_session() as db:
    # ... mutate
    await db.commit()
# Publish AFTER commit (per RESEARCH anti-patterns)
publish_broadcast_sync({"type": "...", "payload": {...}})
```

For async endpoints use `publish_broadcast(...)` (async variant) instead of the `_sync` flavor.

### ActivityEvent audit log

**Source:** `server/app/api/admin.py:1080-1085, 1127-1131` — every admin mutation writes one.
**Apply to:** All 6 new admin endpoints.
**Pattern**:

```python
db.add(ActivityEvent(
    event_type="EVALUATION_APPROVED",
    actor="admin",
    description=f"Evaluation approved for {result['ticker']}...",
    metadata_json=json.dumps(result),
))
await db.commit()
```

Use event types: `FUNDAMENTALS_APPROVED`, `FUNDAMENTALS_REJECTED`, `FUNDAMENTALS_EDITED`, `FUNDAMENTALS_OVERRIDDEN`, `SHOCK_ENQUEUED`.

### Async SQLAlchemy Session (worker context)

**Source:** `server/app/database.py:62-86` — `get_worker_session()` context manager.
**Apply to:** All new Celery tasks.
**Pattern** (from `evaluate_solution.py:36, 44`):

```python
from app.database import get_worker_session
async with get_worker_session() as db:
    # async ORM calls
    await db.commit()
```

### Async SQLAlchemy Session (API context)

**Source:** `server/app/database.py` — `get_db` FastAPI dep.
**Apply to:** All new admin endpoints.
**Pattern** (from `admin.py:460`):

```python
db: AsyncSession = Depends(get_db),
```

### Decimal precision for all price/fundamental math

**Source:** `server/app/services/simulation_service.py:50-56`.
**Apply to:** `simulation_service.z_score`, `compute_weighted_z`, `compute_price`, `compute_drift_target`; `fundamental_service.apply_fundamental_deltas`; admin.py archetype-assign backfill.
**Invariant**: convert `random.gauss(...)` → `Decimal(str(...))` before any arithmetic. Convert JSON band values via `Decimal(str(v))` when reading `archetype.benchmark_bands`. `.quantize(Decimal("0.01"))` before persistence.

### Selectinload to avoid N+1

**Source:** `server/app/services/evaluation_service.py:55-57` + `server/app/services/game_service.py:302-305` + `admin.py:982-984`.
**Apply to:** `simulation_service.calculate_all_prices` (Team + archetype), `fundamental_service.build_fundamental_prompt` (Team + archetype + Decision rows + OperatingPlan), admin fundamentals endpoints that join Team.
**Pattern**:

```python
from sqlalchemy.orm import selectinload
result = await db.execute(
    select(Team)
    .options(selectinload(Team.archetype))
    .where(Team.id == team_id)
)
```

### Next.js page: auth guard + WS + toast pattern

**Source:** `client/src/app/admin/evaluations/page.tsx` — full template.
**Apply to:** `/admin/fundamentals/page.tsx`.
**Pattern**: `useAuthStore` guard → `useCallback` fetcher → `useWebSocket({ onMessage })` for auto-refresh → `toast.success/error` on actions → cards with expand/collapse + edit form.

### Bloomberg Terminal Blue palette (CLAUDE.md)

**Source:** `client/src/app/admin/evaluations/page.tsx` color tokens throughout + `client/src/components/game/CaselinePanel.tsx` tile styling.
**Apply to:** All new UI.
**Tokens**: primary `#2196f3`; accent `#9ecaff`; backgrounds `#0e0e0e` (deepest), `#131313`, `#1c1b1b` (card), `#201f1f` (tile), `#2a2a2a` (border); text `#e5e2e1` (primary), `#89919d` (muted), `#404752` (hint); semantic `#02c953` (green/APPROVE), `#FF1744` (red/REJECT), `#f5a623` (amber/code), `#2196f3` (blue/PROCESSING). `font-mono`, `uppercase`, `tracking-widest` for labels. `0px border-radius` (never use `rounded-*`).

## No Analog Found

None. Every Phase 9 file has at least a strong role-match in the existing codebase. Notable observations:

- `FundamentalOverrideRequest` endpoint has no exact analog (no direct-mutation admin endpoint bypassing approval currently exists) — closest is `admin.py:452 set_team_score` (the one being deprecated), so the body pattern is adapted from `approve_evaluation_endpoint` with the PENDING_APPROVAL guard stripped.
- The `shock_applied` WebSocket event type is new, but its shape mirrors `price_update` exactly (payload has `shocks: [...]` array analogous to `prices: [...]`).

## Metadata

**Analog search scope:**

- `server/app/services/` (all 5 files read)
- `server/app/worker/tasks/` (all 3 files read)
- `server/app/api/admin.py` (lines 1-120, 440-550, 700-780, 960-1150, 1200-1260, 1400-1960), `teams.py`, `schemas/decisions.py`
- `server/app/models.py` (all key classes read)
- `server/app/redis_pubsub.py` (full)
- `server/alembic/versions/003_add_archetype.py`, `004_decision_levers_round_structure.py` (full)
- `client/src/app/admin/evaluations/page.tsx` (full 625 LOC)
- `client/src/components/game/CaselinePanel.tsx` (full)
- `client/src/components/admin/admin-sidebar.tsx` (full)
- `client/src/lib/types.ts` (lines 100-256)

**Files scanned:** 17 analogs fully read; classification verified against CONTEXT.md (32 decisions) and RESEARCH.md (10 patterns + 10 pitfalls).

**Pattern extraction date:** 2026-04-17

**Key ranking observations:**

1. Phase 5 `Evaluation` → Phase 9 `FundamentalEvaluation` is a 1:1 mirror at every layer (model, service, Celery task, admin endpoints, admin page). This collapses 60% of Phase 9 effort into "clone + rename".
2. `calculate_all_prices` rewrite is the only truly new code — formula math, sentiment aggregate, shock consumption. Python-side only; no new SQL patterns.
3. Alembic 004 is the closest migration template (enum + create_table + add_column + UniqueConstraint + Index + downgrade all present). 005 follows 004's outline exactly.
4. Admin page `/admin/evaluations/page.tsx` is 625 LOC of copy-paste-modify work; visual shell and state machine are preserved verbatim.
