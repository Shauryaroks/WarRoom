# Complex — Case Competition Platform

A real-time case competition platform where **16-40 teams** compete in a simulated FMCG stock market. Teams run companies, submit strategic decisions, and trade each other's stocks. An LLM evaluates strategic quality with admin oversight; prices tick every 60 seconds driven by weighted-fundamental math.

Inspired by the **"Bharat Bites & Brews" FMCG Stock Wars** competition model.

---

## What the game looks like

1. Admin registers and approves teams
2. Each team gets two sub-accounts: **Strategist** (submits decisions + caselines) and **Trader** (buys/sells stocks)
3. Admin assigns each team an **archetype** (Legacy Giant / D2C Challenger / Regional Leader / Premium Niche) — this defines the team's balance sheet, benchmark bands, and starting cash
4. Admin starts the game → teams enter the **Lobby → Live Floor** loop
5. Each 20-minute real-time quarter:
   - **War Room phase**: trading halts. Teams review the previous quarter's performance and submit an operating plan + macro brief
   - **Live Floor phase**: trading opens. Teams submit decisions across 3 levers (Marketing / Supply Chain / New Product). Stock prices tick every 60s
6. At quarter-end, admin clicks **RUN_LLM_EVAL** on the Fundamentals Queue. The LLM evaluates each team's quarterly performance → produces 4 fundamental deltas (Market Share, Profitability, Ops, Brand Health) + narrative
7. Admin reviews → approves or rejects each evaluation. Approvals update the team's fundamentals and kick off a 5-minute smooth price ramp
8. Prices reflect fundamentals (z-score vs archetype benchmark), trading sentiment, admin-injected crises, and bounded noise
9. Admin can inject crisis events (discrete ±3–15% price shocks) and broadcast news
10. Low-performing teams are eliminated; the leaderboard tracks ranks in real-time

---

## Tech Stack

| Layer | Stack |
|------:|-------|
| Frontend | Next.js 16 + React 19 + Tailwind 4 + Zustand 5 + lightweight-charts 5 + Zod 4 |
| Backend | FastAPI + async SQLAlchemy 2 + asyncpg + Pydantic v2 + PyJWT |
| Worker | Celery 5.6 + Beat scheduler (60s periodic price tick) |
| Cache / Pub-Sub | Redis 7 (`redis.asyncio`) |
| DB | PostgreSQL 15 |
| LLM | OpenRouter (structured JSON output via `response_format: json_schema`) |
| Reverse proxy | Caddy 2 (auto-HTTPS + WebSocket proxy) |
| Design language | "Complex Terminal Blue" — dark monospace, blue `#2196F3` primary, 0px radius (precision-brutalism) |

Everything except the frontend runs in Docker. Frontend can run inside Docker (prod) or locally via `pnpm dev` (dev).

---

## Architecture at a glance

```
                 ┌──────────────────────────────────────────┐
                 │              Browser (team or admin)      │
                 └────────────┬────────────┬────────────────┘
                         WS   │      HTTP  │
                              │            │
                 ┌────────────▼────────────▼────────────────┐
                 │    Caddy 2  (:8080 → reverse-proxy)       │
                 └────────────┬────────────┬────────────────┘
                              │            │
                 ┌────────────▼────────────▼────────────────┐
                 │          FastAPI API (uvicorn)           │
                 │  • /api/v1/auth/* /admin/* /teams/*      │
                 │  • /ws   (WebSocket manager)             │
                 │  • SQLAlchemy async → PostgreSQL         │
                 │  • redis.asyncio pub/sub subscriber      │
                 └────────────┬──────────────▲──────────────┘
                              │              │
                       ┌──────▼──────┐    pub/sub
                       │ PostgreSQL  │       │
                       │   (15)      │       │
                       └──────▲──────┘       │
                              │              │
                 ┌────────────┴──────────────┴──────────────┐
                 │        Celery Worker + Beat              │
                 │  • game.tick        (every 60s)          │
                 │  • solution.evaluate (on-demand)         │
                 │  • news.generate    (on-demand)          │
                 │  • publish_broadcast_sync → Redis        │
                 └──────────────────────────────────────────┘
```

**Publish-after-commit invariant** — every broadcast happens AFTER `await db.commit()`. Never before.

---

## Running locally

### Prereqs
- Docker + Docker Compose
- Node 20+ with pnpm (for frontend dev server)
- An OpenRouter API key

### Setup
```bash
# 1. Clone and env
cp server/.env.example server/.env
#    edit server/.env:
#      - OPENROUTER_API_KEY=sk-or-...
#      - JWT_SECRET=<some random 64-char string>

# 2. Bring up the backend stack
docker compose up -d

# 3. Wait ~10s for db health
docker compose ps

# 4. Seed admin + 4 pre-built archetypes
curl -X POST http://localhost:8080/api/v1/admin/seed
curl -X POST http://localhost:8080/api/v1/admin/archetypes/seed \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 5. Frontend
cd client
pnpm install
pnpm dev
# → http://localhost:3000
```

### Default credentials
- **Admin email:** `admin@complex.com` (NOT `.local` — Pydantic rejects it)
- **Admin password:** seed script default (check `server/init_db.py`)

### Gotchas
- Port **8080** is used by Caddy. Kill any conflicts: `sudo fuser -k 8080/tcp`
- If you change schema (`models.py`): `docker compose down -v` to wipe DB, then `docker compose up -d` (dev uses `init_db.py`'s `create_all` — it won't auto-migrate)
- Worker volume-mounts `./server` (see `docker-compose.override.yml`). If you add a new Celery task, **make sure to import it in `server/app/worker/tasks/__init__.py`** or autodiscover won't find it

---

## Roles & URLs

| Role | Login URL | What they see |
|------|-----------|---------------|
| **Admin** | `/auth/admin` | Full 8-tab portal: Dashboard, Teams, Evals, **Fundamentals**, Markets, News, Settings, Activity |
| **Strategist** | `/auth/login` | Caseline, Solutions, **Decisions** sidebar tabs + view-only market |
| **Trader** | `/auth/login` | Trading panel (buy/sell), news, portfolio |
| **Public game state** | — | `/api/v1/teams/game-state` (any auth'd user, used for lobby redirect logic) |

### Admin portal tabs

- **Dashboard** — start/pause/resume/restart game, live overview, phase controls (War Room / Live Floor), macro-brief modal
- **Teams** — approve / reject / remove teams, assign archetypes, edit caselines
- **Evals** — Phase 5 solution evaluation queue (PENDING_APPROVAL → approve / edit / reject → publishes news)
- **Fundamentals** *(new in Phase 9)* — click **RUN_LLM_EVAL** with round number → LLM fans out across ACTIVE teams → PENDING_APPROVAL rows appear → approve applies deltas + starts 5-min ramp
- **Markets** — stock overview, set per-team quality scores *(v1 endpoint now returns 410 Gone — use Fundamentals)*
- **News** — inject news, broadcast messages
- **Settings** — archetype CRUD, round controls
- **Activity** — audit log of admin actions

---

## The two core loops

### Loop 1: Solution evaluation (Phase 5)
```
Strategist submits solution (Markdown)
  → evaluation_service.save_evaluation (PROCESSING)
  → Celery: solution.evaluate task
    → call_openrouter(messages, json_schema=EVALUATION_SCHEMA)
    → status=PENDING_APPROVAL
  → Admin reviews /admin/evaluations
    → approve: publishes MarketNews, fires news.generate task, WS broadcast
    → reject: stops at REJECTED
```

**Note (Phase 9 change):** approval no longer writes `target_price`. Solutions are now narrative/scoring context, not the price driver.

### Loop 2: Price engine (Phase 9)
```
Every 60s: Celery Beat → game.tick
  → game state guard (must be ACTIVE + live_floor)
  → simulation_service.calculate_all_prices:
      for each ACTIVE team:
        weighted_z   = 0.35·z(MS) + 0.30·z(margin) + 0.20·z(ops) + 0.15·z(growth)
        drift        = clamp(0.15 · weighted_z, ±5%) · ramp_fraction
        sentiment    = last-60s signed INR volume / public_float_INR · 0.02  (capped ±0.3%/tick)
        shock        = one pending_shock row (severity: ±3%/8%/15%, single tick, then cleared)
        noise        = gauss(0, 0.02) bounded ±4%
        new_price    = prev · (1 + drift + sentiment + shock + noise)
  → PriceHistory insert per team
  → publish_broadcast_sync → Redis → WS clients get price_update
```

**Fundamentals update loop:**
```
Admin clicks RUN_LLM_EVAL(round_number) in Fundamentals Queue
  → fundamental_service.trigger_compute_for_round:
      for each ACTIVE team with archetype:
        build_fundamental_prompt (archetype bands, current fundamentals, decisions, operating plan, prev narrative)
        call_openrouter(FUNDAMENTAL_SCHEMA) → 4 deltas + narrative
        save_fundamental_evaluation (PENDING_APPROVAL)
  → Admin approves → apply_fundamental_deltas:
      prior_drift = ramp_fraction · drift_target_pct      (captured BEFORE mutation)
      fundamentals += deltas
      drift_target_pct = compute_drift_target(new_weighted_z)
      drift_floor_pct  = prior_drift                       (prevents snap-back)
      ramp_started_at  = now                               (5-min linear ramp starts)
```

---

## Game phase state machine

| Game status | Sub-phase | What happens |
|-------------|-----------|--------------|
| `SETUP` | — | Teams register, admin assigns archetypes |
| `ACTIVE` | `null` | Transition limbo (shouldn't linger here) |
| `ACTIVE` | `war_room` | Trading **halted**. Teams review previous quarter, submit operating plans. Admin writes macro brief. |
| `ACTIVE` | `live_floor` | Trading **open**. Ticks fire every 60s. Teams submit decisions (3 levers, all optional). News streams in. |
| `PAUSED` | — | Everything frozen. Game clock stops. |
| `FINISHED` | — | Game over. |

Admin transitions via `POST /api/v1/admin/game/war-room` and `/live-floor`.

---

## Decision levers (Strategist only)

Teams can optionally submit any subset of:

- **Marketing** — ATL/Digital/Influencer/BTL split (must sum to 100%), campaign theme (Value / Premium / Health / Patriotism / Nostalgia). Costs 30% of operating budget.
- **Supply Chain** — Inventory policy (Lean/Balanced/Stocked), distribution expansion tiers (Tier-1 ₹5Cr, Tier-2 ₹3Cr, Rural ₹2Cr), capacity utilization (60-100%)
- **New Product** — Launch a new SKU? If yes: description + target category. ₹10Cr R&D cost.

Each lever has an **INCLUDE** checkbox — teams only submit what they opt into. Decisions feed the LLM as input for the next fundamental evaluation. No strict "all levers required" validation.

*(Pricing lever was removed 2026-04-17.)*

---

## Stock market mechanics

- Every team's stock starts at ₹100 (configurable per archetype)
- External investors (other teams) can own up to **30%** of any team's shares — enforced atomically via `SELECT FOR UPDATE`
- Buy / sell at market price. No order book. No shorts.
- Transactions log to `transactions` table; rolling 60s volume drives sentiment
- Candlestick chart via lightweight-charts 5, data-conflated for performance

---

## Crisis events

Admin can inject a crisis via `/admin/crisis/inject`. Named teams get a `PendingShock` row queued. Next tick applies the shock as a single-tick discrete price jump (±3% minor / ±8% major / ±15% catastrophic, signed by direction).

Crises also pause the market via the existing game-state machine and broadcast to all clients.

---

## Repo layout

```
complex/
├── client/                     # Next.js frontend
│   ├── src/app/
│   │   ├── auth/{login,register,admin}/
│   │   ├── lobby/
│   │   ├── game/               # Team game view (Strategist + Trader share route, role-gated)
│   │   ├── portfolio/
│   │   ├── markets/
│   │   └── admin/              # 8-tab admin portal
│   │       ├── dashboard/
│   │       ├── teams/
│   │       ├── evaluations/
│   │       ├── fundamentals/   # Phase 9 Fundamentals Queue
│   │       ├── markets/
│   │       ├── news/
│   │       ├── settings/
│   │       └── activity/
│   ├── src/components/{game,admin,ui}/
│   ├── src/stores/             # Zustand stores (auth, game, market, trading, decisions, admin)
│   ├── src/hooks/use-websocket.ts  # Singleton WS manager
│   └── src/lib/{api.ts,types.ts}
│
├── server/                     # FastAPI backend
│   ├── app/
│   │   ├── main.py             # FastAPI app, router registration, WS endpoint
│   │   ├── models.py           # All SQLAlchemy models (Team, Archetype, Decision, OperatingPlan, FundamentalEvaluation, PendingShock, StockHolding, Transaction, etc.)
│   │   ├── database.py         # Async engine, settings
│   │   ├── auth_utils.py       # JWT + require_admin / require_team deps
│   │   ├── api/                # REST routers (auth, admin, teams, game, market, solutions, trading, decisions)
│   │   ├── schemas/            # Pydantic request/response models
│   │   ├── services/
│   │   │   ├── game_service.py             # Game state machine, War Room / Live Floor transitions
│   │   │   ├── simulation_service.py       # Phase 9 per-tick engine (z_score, compute_price, calculate_all_prices)
│   │   │   ├── trading_service.py          # Atomic buy/sell with 30% cap
│   │   │   ├── llm_service.py              # OpenRouter client, structured JSON
│   │   │   ├── evaluation_service.py       # Phase 5 solution eval pipeline
│   │   │   └── fundamental_service.py      # Phase 9 fundamental eval pipeline
│   │   └── worker/
│   │       ├── celery_app.py
│   │       └── tasks/
│   │           ├── __init__.py             # (explicit imports — required for autodiscover)
│   │           ├── game_tick.py            # game.tick — every 60s
│   │           ├── evaluate_solution.py    # solution.evaluate
│   │           └── generate_news.py        # news.generate
│   ├── alembic/versions/       # 001..005 migrations
│   ├── tests/                  # pytest + pytest-asyncio
│   ├── scripts/audit_endpoints.py  # smoke-test all 54 endpoints
│   ├── init_db.py              # dev-mode create_all bootstrap
│   └── Dockerfile
│
├── docker-compose.yml          # api, worker, db, redis, caddy
├── docker-compose.override.yml # dev: mount ./server on api+worker
├── Caddyfile                   # single reverse-proxy line, flush_interval -1 for WS
│
├── .planning/                  # GSD workflow artifacts (roadmap, phases, state, research)
│   ├── PROJECT.md  ROADMAP.md  REQUIREMENTS.md  STATE.md
│   └── phases/NN-<slug>/       # Per-phase: CONTEXT / RESEARCH / PLAN / SUMMARY
│
└── assests/stitch_complex_terminal_blue/  # UI design reference
```

---

## Running tests

```bash
# Backend (inside api container — share the uv env)
docker compose exec api uv run pytest -q --timeout=60

# Quick tier only
docker compose exec api uv run pytest tests/test_simulation.py tests/test_fundamental_service.py -q

# Endpoint smoke test (54 endpoints, 98 assertions)
python3 server/scripts/audit_endpoints.py

# Frontend
cd client
pnpm tsc --noEmit
pnpm eslint src
```

---

## v2.0 milestone status

Shipped in the v2.0 milestone (alignment with Bharat Bites & Brews):

- ✅ **Phase 7** — Archetypes + 4 pre-built dossiers
- ✅ **Phase 8** — Decision Levers + War Room / Live Floor round structure *(Pricing lever removed 2026-04-17; decisions made per-lever optional)*
- ✅ **Phase 9** — Enhanced Simulation Engine: per-tick z-score engine, Fundamentals Queue, 5-min decision ramp, event shocks, last-tick sentiment *(Plan 07 stress tests + some polish deferred)*
- ✂️ **Phase 10** — Descoped. v1 buy/sell + 30% cap retained. No shorts/margin/circuit breakers.
- ⏳ **Phase 11** — Press releases + enhanced dashboard tiles (pending)
- ⏳ **Phase 12** — Final scoring (50/25/25) + strategy memo + distress triggers (pending)

---

## Common operations

```bash
# Restart just api (pick up code changes)
docker compose restart api

# Restart worker (pick up task changes)
docker compose restart worker

# Wipe DB (after schema change)
docker compose down -v && docker compose up -d

# Watch tick activity
docker compose logs -f worker | grep -E "game.tick|succeeded"

# Hit the API
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/v1/teams/me
```

---

## Key URLs

| URL | Purpose |
|-----|---------|
| `http://localhost:3000` | Frontend (Next.js dev) |
| `http://localhost:8080` | API (via Caddy) |
| `http://localhost:8080/docs` | FastAPI Swagger UI |
| `http://localhost:8080/openapi.json` | OpenAPI spec |
| `ws://localhost:8080/ws?token=<jwt>` | WebSocket endpoint |

---

## Further reading

- `.planning/PROJECT.md` — full stack recommendation + decision log
- `.planning/ROADMAP.md` — phase breakdown with success criteria
- `.planning/CASELINE_SPEC.md` — the Bharat Bites & Brews competition model this platform implements
- `.planning/phases/0N-*/0N-CONTEXT.md` — locked decisions per phase
- `CLAUDE.md` — AI-agent instructions for contributing via the GSD workflow
