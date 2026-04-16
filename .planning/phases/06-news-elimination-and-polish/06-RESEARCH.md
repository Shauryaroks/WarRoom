# Phase 6: News, Elimination, and Polish - Research

**Researched:** 2026-04-16
**Domain:** LLM news generation, game elimination mechanics, real-time leaderboard, crisis events
**Confidence:** HIGH

## Summary

Phase 6 completes the competition loop by adding four major capabilities to existing infrastructure: (1) LLM-generated news triggered after each evaluation approval, (2) crisis events with a full admin-controlled flow, (3) elimination mechanics where shares become worthless, and (4) a real-time leaderboard. All four capabilities hook into systems already built in Phases 1-5 -- the LLM service, game pause/resume, team status model, Redis pub/sub broadcast, and WebSocket message routing.

The codebase is well-positioned for this phase. The `MarketNews` model already supports multiple `source_type` values. The `TeamStatus` enum already includes `ELIMINATED`. The `approve_evaluation` function in `evaluation_service.py` is the natural hook point for triggering news generation. The game pause mechanism in `game_service.py` handles the crisis auto-pause. The main engineering challenges are: (a) ensuring elimination correctly zeroes out shares across all holders atomically, (b) designing the crisis flow as a state machine that doesn't conflict with normal pause/resume, and (c) building the leaderboard as a lightweight query rather than a new data structure.

**Primary recommendation:** Build each capability as a thin extension of existing services -- no new models needed beyond a `CrisisEvent` table. The leaderboard is a sorted query on `teams.stock_price`. News generation is a second Celery task dispatched from the approval endpoint. Elimination is an admin endpoint that sets `stock_price=0`, marks status, and broadcasts.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** News generated after each approved evaluation -- when admin approves an LLM evaluation, the system also generates related news. No periodic/ambient news generation.
- **D-02:** Two types of generated news: Market commentary (team-specific) and World events (broader context).
- **D-03:** Reuse the existing LLM service (Phase 5) with a news-generation prompt. Output published via the existing news WebSocket broadcast.
- **D-04:** Full crisis flow: Admin injects crisis -> Market auto-pauses -> All teams see crisis overlay -> Warning timer counts down -> Teams submit crisis response -> Crisis responses evaluated by LLM -> Admin manually resumes market.
- **D-05:** Timer is a WARNING only -- admin controls the actual pause/resume. Timer does NOT auto-resume.
- **D-06:** Crisis scenario appears as an urgent full-screen overlay on all game views, red-themed.
- **D-07:** When admin eliminates a team, their shares become worthless ($0). Holders lose their investment. No refund.
- **D-08:** Eliminated teams get read-only game view -- same game page but all actions disabled.
- **D-09:** Eliminated team's stock is removed from trading -- other teams can no longer buy/sell their shares.
- **D-10:** Leaderboard shows in both locations: compact widget in game view + full dedicated page at `/leaderboard`.
- **D-11:** Rankings by stock price, updating in real-time via WebSocket.
- **D-12:** Claude's discretion -- assess responsive layout for two-device concurrent play.

### Claude's Discretion
- D-12: Two-device responsive polish -- assess what's needed, fix issues.

### Deferred Ideas (OUT OF SCOPE)
None -- this is the final phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NEWS-02 | LLM generates contextual news based on game state and team actions | Hook into `approve_evaluation` endpoint, dispatch Celery task with news-gen prompt to existing LLM service |
| NEWS-03 | News feed updates in real-time via WebSocket | Already working -- `publish_broadcast` with `news_injected` type, `NewsOverlay` component handles it |
| NEWS-04 | Crisis events: admin injects major crises that pause the market, teams solve, market resumes | New `CrisisEvent` model, admin endpoint, auto-pause via `transition_state`, crisis overlay on frontend |
| ELIM-01 | Admin can eliminate low-performing companies after each round | New admin endpoint extending `remove_team` pattern, sets `stock_price=0`, `status=ELIMINATED` |
| ELIM-02 | Eliminated teams' shares are handled (marked worthless) | Zero out `StockHolding` value via `stock_price=0`, write-off transactions in `CashLedger` |
| ELIM-03 | Eliminated teams can no longer trade or submit solutions | Frontend disables all actions when team status is ELIMINATED; backend guards on team status |
| UI-03 | Responsive layout supporting two-device concurrent play | Audit existing layout (sidebar + chart), add responsive breakpoints, test strategist vs trader views |
| UI-04 | Leaderboard showing company rankings by stock price | Query `teams` sorted by `stock_price DESC`, filter ACTIVE/COOLDOWN, broadcast on price updates |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| LLM news generation | API/Backend (Celery) | -- | LLM call is async background work; result pushed via Redis pub/sub |
| Crisis event flow | API/Backend | Frontend (overlay) | Backend owns state machine (pause/resume/crisis); frontend renders overlay |
| Elimination mechanics | API/Backend (PostgreSQL) | Frontend (read-only) | Atomic DB operations for share zeroing; frontend disables UI based on status |
| Leaderboard data | API/Backend | Frontend (widget + page) | Backend provides sorted team data; frontend renders in two locations |
| Crisis overlay | Frontend | -- | Full-viewport red-themed overlay with countdown timer |
| Read-only eliminated view | Frontend | API/Backend (guards) | Frontend disables controls; backend rejects trades/submissions for eliminated teams |
| Two-device polish | Frontend | -- | CSS responsive breakpoints, layout adjustments |

## Standard Stack

No new libraries needed. Phase 6 uses exclusively existing stack components.

### Core (already installed)
| Library | Version | Purpose | Phase 6 Usage |
|---------|---------|---------|---------------|
| FastAPI | >=0.135.3 | API endpoints | New admin endpoints for crisis inject, eliminate, leaderboard |
| Celery | >=5.6.3 | Background tasks | New `generate_news` task dispatched after evaluation approval |
| SQLAlchemy | >=2.0.49 | ORM (async) | CrisisEvent model, elimination queries, leaderboard query |
| Redis pub/sub | redis-py >=7.1.1 | WebSocket broadcast | Crisis overlay broadcast, leaderboard updates, news broadcast |
| Zustand | 5.0.12 | Frontend state | Leaderboard store slice, crisis state, elimination status |
| Tailwind CSS | 4.2.2 | Styling | Crisis overlay (red theme), leaderboard styling, responsive breakpoints |

### New Model Required
| Model | Purpose | Fields |
|-------|---------|--------|
| `CrisisEvent` | Track crisis lifecycle | id, scenario, timer_seconds, status (ACTIVE/RESOLVED), created_at, resolved_at |

## Architecture Patterns

### System Architecture Diagram

```
Admin Panel                          Game Client (all teams)
     |                                      |
     v                                      |
[Crisis Inject] -----> POST /admin/crisis/inject
     |                        |
     |                   [Create CrisisEvent]
     |                   [Auto-pause game via transition_state()]
     |                   [Broadcast crisis_started]
     |                        |                    \
     |                        v                     v
     |                  [Redis pub/sub] -----> [WebSocket relay]
     |                                              |
     |                                    [Crisis overlay renders]
     |                                    [Timer countdown starts]
     |                                              |
     v                                              v
[Admin approves eval] --> approve_evaluation()    [Team submits crisis response]
     |                        |                     |
     |                   [Dispatch Celery:          [POST /solutions/submit]
     |                    generate_news task]        [type=CRISIS_RESPONSE]
     |                        |
     |                   [LLM generates news]
     |                   [Save MarketNews]
     |                   [Broadcast news_injected]
     |
[Admin resumes] --------> POST /admin/game/resume
                              |
                         [transition_state(ACTIVE)]
                         [Broadcast game_state_changed]
                         [Update crisis status -> RESOLVED]
```

### Elimination Flow

```
Admin Panel
     |
     v
POST /admin/teams/{id}/eliminate
     |
     +--> [Set team.stock_price = 0]
     +--> [Set team.status = ELIMINATED]
     +--> [Set team.eliminated_at = now()]
     +--> [Write CashLedger entries for holders (write-off)]
     +--> [Broadcast team_eliminated]
     +--> [Broadcast leaderboard_update]
     |
     v
Game Clients:
  - Holders see portfolio loss
  - Eliminated team sees read-only overlay
  - Leaderboard removes eliminated team from active rankings
  - CompanyTabs hides eliminated team's stock
```

### Leaderboard Data Flow

```
[Price tick (every 60s)] --> [Celery game_tick] --> [broadcast price_update]
                                                         |
                                                    [Frontend recalculates
                                                     leaderboard from
                                                     currentPrices in
                                                     market-store]

[Evaluation approved] --> [target_price changes] --> [next price tick reflects it]

Leaderboard widget: sorted companies by stock_price, filtered by status != ELIMINATED
Full page: same data + additional columns (change_pct, market_cap, status)
```

### Pattern 1: News Generation as Celery Task

**What:** After `approve_evaluation` commits, dispatch a separate Celery task to generate news via LLM. This keeps approval fast (no waiting for second LLM call).
**When to use:** Every evaluation approval.

```python
# In admin.py approve_evaluation_endpoint, after db.commit():
from app.worker.tasks.generate_news import generate_news
generate_news.delay(str(evaluation_id), str(team.id))
```

```python
# server/app/worker/tasks/generate_news.py
@celery_app.task(name="news.generate", time_limit=120, soft_time_limit=100)
def generate_news(evaluation_id: str, team_id: str):
    """Generate market commentary + world event news after evaluation approval."""
    asyncio.run(_generate(evaluation_id, team_id))

async def _generate(evaluation_id: str, team_id: str):
    # Build news-specific prompt with evaluation context
    # Call OpenRouter with NEWS_SCHEMA (not EVALUATION_SCHEMA)
    # Save two MarketNews records: MARKET_COMMENTARY + WORLD_EVENT
    # Broadcast both via publish_broadcast_sync
```

[VERIFIED: server/app/worker/tasks/evaluate_solution.py -- same Celery task pattern]

### Pattern 2: Crisis State Machine

**What:** Crisis events use existing game pause but add crisis-specific state.
**When to use:** Admin injects crisis.

```python
# Crisis is NOT a new GameStatus -- it's a pause with a CrisisEvent record.
# The CrisisEvent tracks: scenario, timer_seconds, status.
# Frontend checks: is game PAUSED AND is there an active CrisisEvent?
#   -> YES: show crisis overlay instead of normal pause overlay
#   -> NO: show normal pause overlay
```

[ASSUMED -- design choice to not add CRISIS to GameStatus enum, keeping it orthogonal]

### Pattern 3: Elimination with Atomic Share Zeroing

**What:** When a team is eliminated, their stock_price is set to 0. No need to modify individual StockHolding records -- the value is derived from stock_price.
**When to use:** Admin eliminates a team.

```python
# The key insight: shares become "worthless" by setting stock_price = 0.
# StockHolding records remain (audit trail) but their market_value = shares * 0 = 0.
# Portfolio endpoint already calculates: market_value = shares * current_price.
# So we just need to:
# 1. Set team.stock_price = 0, team.target_price = None, team.ticks_to_target = None
# 2. Set team.status = ELIMINATED
# 3. Exclude eliminated teams from simulation_service.tick_all_teams()
# 4. Exclude eliminated teams from trading (backend guard)
```

[VERIFIED: server/app/services/trading_service.py -- portfolio calculates value from stock_price]

### Anti-Patterns to Avoid
- **Modifying StockHolding records on elimination:** Don't zero out individual holdings. The value is derived from `team.stock_price`. Setting price to 0 automatically makes all holdings worthless.
- **Adding CRISIS to GameStatus enum:** This would break the existing state machine. Crisis is an overlay on PAUSED state, not a separate state.
- **Auto-resume from timer:** D-05 explicitly says timer is WARNING only. Never implement a countdown that auto-transitions game state.
- **Separate leaderboard table:** Don't create a materialized leaderboard. Just query `teams` sorted by `stock_price`. With 32-40 teams, this is trivially fast.
- **Blocking approval on news generation:** News gen is a separate LLM call. Never make it synchronous with approval. Use Celery.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| News generation scheduling | Custom scheduler or cron | Celery task dispatched from approval endpoint | Already have Celery; D-01 says trigger on approval, not periodic |
| Countdown timer (frontend) | Custom interval/timeout | `useEffect` with `setInterval` referencing server timestamp | Prevents drift; timer is display-only per D-05 |
| Leaderboard ranking | Materialized view or ranking table | `SELECT * FROM teams WHERE status IN ('ACTIVE','COOLDOWN') ORDER BY stock_price DESC` | 32-40 rows; query is sub-millisecond |
| Crisis overlay dismiss logic | Complex state machine | Single boolean `isCrisisActive` in Zustand, controlled by WebSocket messages | Simple on/off; admin controls lifecycle |

## Common Pitfalls

### Pitfall 1: Double News Generation
**What goes wrong:** If the approve endpoint is clicked twice rapidly, two Celery tasks fire and generate duplicate news.
**Why it happens:** The evaluation status check (`PENDING_APPROVAL`) prevents double-approval, but the Celery dispatch happens after the status change.
**How to avoid:** The existing `approve_evaluation` service already checks status and raises if not `PENDING_APPROVAL`. Since it transitions to `APPROVED` atomically, a second call raises ValueError before dispatching Celery. This is already safe.
**Warning signs:** Duplicate news headlines in the feed.

### Pitfall 2: Eliminated Team Still Receives Price Ticks
**What goes wrong:** The simulation service continues calculating prices for eliminated teams, wasting cycles and potentially overriding the $0 price.
**Why it happens:** `tick_all_teams` queries ACTIVE teams but might not exclude ELIMINATED.
**How to avoid:** Verify the simulation service query filters by `TeamStatus.ACTIVE` (or `COOLDOWN`). Add explicit exclusion of `ELIMINATED` and `BANKRUPT` if not already present.
**Warning signs:** Eliminated team's price changes from $0 after a tick.

### Pitfall 3: Crisis Overlay Doesn't Dismiss After Resume
**What goes wrong:** Admin resumes game but crisis overlay stays visible.
**Why it happens:** Frontend listens for `game_state_changed` but doesn't clear crisis state.
**How to avoid:** When broadcasting game resume, also broadcast `crisis_resolved`. Frontend handles both: `game_state_changed` updates game store, `crisis_resolved` clears crisis overlay.
**Warning signs:** Overlay persists after market resumes.

### Pitfall 4: Leaderboard Shows Stale Data Between Ticks
**What goes wrong:** Leaderboard only updates every 60s (on price tick), but evaluations change target prices immediately.
**Why it happens:** Leaderboard reads from `currentPrices` which only updates on `price_update` WebSocket messages.
**How to avoid:** Also broadcast a `leaderboard_update` message when: (a) evaluation is approved, (b) team is eliminated, (c) crisis resolved. Frontend re-sorts on these events.
**Warning signs:** Rankings don't reflect recent approval until next tick.

### Pitfall 5: Race Condition on Elimination During Active Trading
**What goes wrong:** A trade executes against an eliminated team's stock between the elimination and the broadcast.
**Why it happens:** Elimination sets `stock_price=0` but the trading endpoint might read the old price if not in the same transaction.
**How to avoid:** Trading endpoint already loads target team with `SELECT FOR UPDATE`. Add a guard: reject trades where `target_team.status == ELIMINATED`. The `team_eliminated` broadcast tells frontends to remove the stock from trading panels.
**Warning signs:** A trade executes at $0 (or old price) for an eliminated team.

### Pitfall 6: News Generation LLM Schema Conflicts
**What goes wrong:** Using `EVALUATION_SCHEMA` for news generation returns evaluation-shaped output instead of news-shaped output.
**Why it happens:** Reusing the same `call_openrouter` function but forgetting to change the `response_format` schema.
**How to avoid:** Create a separate `NEWS_SCHEMA` for the news generation call. The `call_openrouter` function should accept a custom schema parameter (currently hardcoded to `EVALUATION_SCHEMA`).
**Warning signs:** News generation fails with JSON parse errors or returns scoring metrics instead of headlines.

## Code Examples

### News Generation Celery Task

```python
# server/app/worker/tasks/generate_news.py
# Source: Pattern derived from evaluate_solution.py [VERIFIED]

NEWS_SCHEMA = {
    "name": "news_output",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "market_commentary": {
                "type": "object",
                "properties": {
                    "headline": {"type": "string"},
                    "body": {"type": "string"},
                    "sentiment": {"type": "number"},
                },
                "required": ["headline", "body", "sentiment"],
                "additionalProperties": False,
            },
            "world_event": {
                "type": "object",
                "properties": {
                    "headline": {"type": "string"},
                    "body": {"type": "string"},
                    "sentiment": {"type": "number"},
                    "affected_sectors": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
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

[ASSUMED -- schema design follows D-02 types]

### Eliminate Team Endpoint

```python
# Extends server/app/api/admin.py
# Source: remove_team pattern [VERIFIED: server/app/api/admin.py:363]

@router.post("/teams/{team_id}/eliminate", response_model=TeamActionResponse)
async def eliminate_team(
    team_id: uuid.UUID,
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    team = await db.scalar(select(Team).where(Team.id == team_id).with_for_update())
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if team.status not in (TeamStatus.ACTIVE, TeamStatus.COOLDOWN):
        raise HTTPException(status_code=409, detail="Team not eligible for elimination")

    # Compute rank at elimination time
    rank_result = await db.execute(
        select(func.count()).select_from(Team).where(
            Team.status.in_([TeamStatus.ACTIVE, TeamStatus.COOLDOWN]),
            Team.stock_price > team.stock_price,
        )
    )
    rank = (rank_result.scalar() or 0) + 1

    # D-07: Shares become worthless
    team.stock_price = Decimal("0")
    team.target_price = None
    team.ticks_to_target = None
    team.status = TeamStatus.ELIMINATED
    team.eliminated_at = datetime.now(timezone.utc)
    team.rank_at_elimination = rank

    await db.commit()

    # Broadcast elimination
    await publish_broadcast({
        "type": "team_eliminated",
        "payload": {"team_id": str(team_id), "ticker": team.ticker, "rank": rank},
    })
```

### Crisis Inject Endpoint

```python
# Source: inject_news pattern [VERIFIED: server/app/api/admin.py:462]

@router.post("/crisis/inject")
async def inject_crisis(
    request: CrisisInjectRequest,
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    # 1. Create CrisisEvent record
    crisis = CrisisEvent(
        scenario=request.scenario,
        timer_seconds=request.timer_seconds,
        status="ACTIVE",
    )
    db.add(crisis)

    # 2. Auto-pause game (D-04 step 2)
    try:
        await transition_state(db, GameStatus.PAUSED)
    except ValueError:
        pass  # Already paused is fine

    await db.commit()
    await db.refresh(crisis)

    # 3. Broadcast crisis to all clients
    await publish_broadcast({
        "type": "crisis_started",
        "payload": {
            "crisis_id": str(crisis.id),
            "scenario": crisis.scenario,
            "timer_seconds": crisis.timer_seconds,
            "started_at": crisis.created_at.isoformat(),
        },
    })
```

### Leaderboard Query (Backend)

```python
# Source: teams query pattern [VERIFIED: server/app/api/admin.py:266]

@router.get("/api/v1/leaderboard")
async def get_leaderboard(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Team)
        .where(Team.status.in_([TeamStatus.ACTIVE, TeamStatus.COOLDOWN, TeamStatus.ELIMINATED]))
        .order_by(Team.stock_price.desc())
    )
    teams = result.scalars().all()
    return [
        {
            "rank": i + 1,
            "team_id": str(t.id),
            "name": t.name,
            "ticker": t.ticker,
            "stock_price": str(t.stock_price),
            "change_pct": "0.00",  # Calculated from price history
            "status": t.status.value,
        }
        for i, t in enumerate(teams)
    ]
```

### Crisis Overlay Component (Frontend)

```tsx
// Source: Pause overlay pattern [VERIFIED: client/src/app/game/page.tsx:179]
// D-06: Red-themed, full-screen, can't be dismissed

function CrisisOverlay({ scenario, timerSeconds, startedAt }: CrisisOverlayProps) {
  const [remaining, setRemaining] = useState(timerSeconds);

  useEffect(() => {
    const started = new Date(startedAt).getTime();
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - started) / 1000);
      setRemaining(Math.max(0, timerSeconds - elapsed));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerSeconds, startedAt]);

  return (
    <div className="fixed inset-0 z-50 bg-red-950/80 flex items-center justify-center">
      <div className="border border-red-500/50 bg-[#131313] px-12 py-8 text-center max-w-2xl">
        <div className="font-mono text-3xl font-bold text-red-400">CRISIS EVENT</div>
        <div className="font-mono text-lg text-red-200/80 mt-2">
          {formatTime(remaining)}
        </div>
        <p className="mt-6 text-sm text-[#e5e2e1] leading-relaxed">{scenario}</p>
      </div>
    </div>
  );
}
```

### Eliminated Team Read-Only Guard (Frontend)

```tsx
// Source: Game page layout [VERIFIED: client/src/app/game/page.tsx]
// D-08: Same game page, all actions disabled

// In game-store.ts or auth-store.ts:
// Track team status from /me endpoint or WebSocket

// In GamePage:
const isEliminated = teamStatus === "ELIMINATED";

// Wrap action components:
<TradingPanel disabled={isEliminated} />
<SolutionsPanel disabled={isEliminated} />

// Add eliminated banner:
{isEliminated && (
  <div className="bg-red-900/50 border-b border-red-500/30 px-4 py-2 text-center">
    <span className="font-mono text-sm text-red-400 font-bold">ELIMINATED</span>
  </div>
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Periodic news generation | Event-driven (on approval) | D-01 decision | Simpler, no scheduler needed |
| Separate CRISIS game status | Crisis as overlay on PAUSED | D-04 design | No state machine changes |
| Refund shares on elimination | Shares go worthless ($0) | D-07 decision | Simpler -- just set price to 0 |
| Separate leaderboard service | Query teams table directly | D-11 design | No new infrastructure |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Crisis should NOT be a separate GameStatus enum value; use PAUSED + CrisisEvent record | Architecture Patterns | If wrong, need to add CRISIS to GameStatus and update all state transition logic |
| A2 | The `call_openrouter` function needs a schema parameter (currently hardcoded to EVALUATION_SCHEMA) | Pitfall 6, Code Examples | If function already accepts custom schema, this is a non-issue; if not, must refactor |
| A3 | NEWS_SCHEMA produces two items (market_commentary + world_event) per D-02 in a single LLM call | Code Examples | Could split into two LLM calls if single call doesn't produce quality output for both types |
| A4 | Setting stock_price=0 is sufficient for "worthless" shares; no need to modify StockHolding records | Anti-Patterns | If portfolio or P&L calculations don't derive from stock_price, holdings would show stale values |

## Open Questions

1. **LLM Schema for call_openrouter**
   - What we know: `call_openrouter` currently hardcodes `EVALUATION_SCHEMA` in the `response_format` parameter.
   - What's unclear: Whether to make the schema a parameter of `call_openrouter` or create a separate `call_openrouter_news` function.
   - Recommendation: Add an optional `json_schema` parameter to `call_openrouter`, defaulting to `EVALUATION_SCHEMA`. This is a minimal change.

2. **Crisis Response Submission Type**
   - What we know: D-04 says teams submit crisis response "via the Solutions tab as a special submission."
   - What's unclear: Should this be a new `SolutionType.CRISIS_RESPONSE` or reuse `MICROTWEAK`?
   - Recommendation: Add `CRISIS_RESPONSE` to `SolutionType` enum. This lets the LLM evaluation prompt differentiate crisis responses from normal solutions.

3. **Leaderboard Update Frequency**
   - What we know: Price ticks happen every 60s. Leaderboard ranks by stock_price.
   - What's unclear: Should leaderboard have its own broadcast or piggyback on price_update?
   - Recommendation: Piggyback on `price_update` -- the frontend already receives all prices every 60s and can sort locally. Add explicit `leaderboard_update` only for discrete events (elimination, evaluation approval).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio |
| Config file | server/pytest.ini (or pyproject.toml) |
| Quick run command | `cd server && uv run pytest tests/ -x --timeout=10` |
| Full suite command | `cd server && uv run pytest tests/ --timeout=30` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NEWS-02 | News generation triggered on evaluation approval | integration | `pytest tests/test_news_generation.py -x` | Wave 0 |
| NEWS-03 | News broadcast via WebSocket | integration | `pytest tests/test_news_generation.py::test_news_broadcast -x` | Wave 0 |
| NEWS-04 | Crisis inject pauses game, broadcast overlay | integration | `pytest tests/test_crisis.py -x` | Wave 0 |
| ELIM-01 | Admin can eliminate team | unit | `pytest tests/test_elimination.py::test_eliminate_team -x` | Wave 0 |
| ELIM-02 | Eliminated shares become worthless | unit | `pytest tests/test_elimination.py::test_shares_worthless -x` | Wave 0 |
| ELIM-03 | Eliminated teams cannot trade or submit | unit | `pytest tests/test_elimination.py::test_eliminated_blocked -x` | Wave 0 |
| UI-03 | Responsive layout two-device | manual-only | -- | N/A (visual) |
| UI-04 | Leaderboard rankings | unit | `pytest tests/test_leaderboard.py -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd server && uv run pytest tests/ -x --timeout=10`
- **Per wave merge:** `cd server && uv run pytest tests/ --timeout=30`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/test_news_generation.py` -- covers NEWS-02, NEWS-03
- [ ] `tests/test_crisis.py` -- covers NEWS-04
- [ ] `tests/test_elimination.py` -- covers ELIM-01, ELIM-02, ELIM-03
- [ ] `tests/test_leaderboard.py` -- covers UI-04

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Existing auth from Phase 1 |
| V3 Session Management | no | Existing JWT from Phase 1 |
| V4 Access Control | yes | `require_admin` for eliminate/crisis endpoints; team status guards for trading/submissions |
| V5 Input Validation | yes | Pydantic models for crisis scenario input; validate timer_seconds is positive integer |
| V6 Cryptography | no | No new crypto in this phase |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthorized elimination | Elevation of Privilege | `require_admin` dependency on all admin endpoints |
| Eliminated team bypasses read-only | Tampering | Backend guards on team status in trading + solution endpoints |
| Crisis scenario XSS | Tampering | React auto-escapes; admin-only input reduces risk |
| Timer manipulation | Spoofing | Timer is display-only (D-05); server controls actual resume |

## Sources

### Primary (HIGH confidence)
- `server/app/models.py` -- TeamStatus.ELIMINATED, MarketNews, GameState (codebase verified)
- `server/app/services/evaluation_service.py` -- approve_evaluation flow, hook point (codebase verified)
- `server/app/services/game_service.py` -- transition_state, pause/resume (codebase verified)
- `server/app/api/admin.py` -- remove_team, inject_news, approve_evaluation_endpoint patterns (codebase verified)
- `server/app/worker/tasks/evaluate_solution.py` -- Celery task pattern (codebase verified)
- `server/app/redis_pubsub.py` -- publish_broadcast, publish_to_team (codebase verified)
- `client/src/app/game/page.tsx` -- game page layout, pause overlay, WebSocket handler (codebase verified)
- `client/src/components/game/NewsOverlay.tsx` -- news overlay component (codebase verified)
- `client/src/stores/market-store.ts` -- price data handling pattern (codebase verified)

### Secondary (MEDIUM confidence)
- `.planning/phases/06-news-elimination-and-polish/06-CONTEXT.md` -- all D-01 through D-12 decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all existing infrastructure
- Architecture: HIGH -- all patterns extend verified existing code
- Pitfalls: HIGH -- derived from actual codebase analysis (race conditions, state machine)
- News generation: MEDIUM -- LLM schema design is assumed (A2, A3)

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (stable -- no external dependencies changing)
