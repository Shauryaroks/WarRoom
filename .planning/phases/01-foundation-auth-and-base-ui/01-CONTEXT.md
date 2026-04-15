# Phase 1: Foundation, Auth, and Base UI - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the foundational infrastructure: fully dockerized backend (FastAPI, PostgreSQL, Redis, Celery, Caddy), team authentication with role-separated sub-accounts (Strategist + Trader), admin authentication, and Bloomberg Terminal-inspired dark theme scaffold. The Redis pub/sub relay between Celery workers and FastAPI WebSocket must work end-to-end.

</domain>

<decisions>
## Implementation Decisions

### Sub-account Model
- **D-01:** Single Team table with dual credential fields (strategist_email/password, trader_email/password) — no separate User table. Team + role field approach.
- **D-02:** One registration form generates both sub-account logins. Team registers once with team name, ticker, email, and password. System creates both Strategist and Trader credentials from that single registration.

### Session & Auth Flow
- **D-03:** Admin has a dedicated login with their own email/password, separate from teams. Admin panel uses a different login page/route.
- **D-04:** Replace API key auth with JWT (PyJWT). JWT includes team_id and role (strategist/trader/admin).

### Claude's Discretion
- **D-05:** Token storage strategy — Claude decides between httpOnly cookies or localStorage based on the Vercel (frontend) + Docker (backend) split-origin architecture. Consider CORS implications.
- **D-06:** Component library choice — Claude decides between pure Tailwind or shadcn/ui based on Bloomberg terminal density requirements.

### Schema Approach
- **D-07:** Evolve existing SQLAlchemy models (Team, Transaction, Directive, StockPrice, etc.) rather than starting from scratch. Add sub-account credential fields to Team model, add Admin model.
- **D-08:** Single clean initial Alembic migration. Discard old migration history, create one migration that establishes the full v2 schema.

### Bloomberg UI Scaffold
- **D-09:** Use Stitch MCP designs as the primary reference for all UI implementation. For anything Stitch doesn't cover, follow the same visual theme and patterns Stitch established. The Stitch prompt is at `.planning/STITCH_PROMPT.md`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Core value, constraints, game flow, key decisions
- `.planning/REQUIREMENTS.md` — AUTH-01..06, INFRA-01..04, UI-01 requirements for this phase
- `.planning/ROADMAP.md` — Phase 1 success criteria and requirement mappings

### UI Design
- `.planning/STITCH_PROMPT.md` — Bloomberg Terminal design spec for Stitch MCP (auth pages, lobby, game views, admin panel design language)

### Research
- `.planning/research/STACK.md` — Technology recommendations with versions (PyJWT, Zustand, SQLAlchemy async, etc.)
- `.planning/research/ARCHITECTURE.md` — Component boundaries, data flow, anti-patterns (broken worker-to-WS relay)
- `.planning/research/PITFALLS.md` — Critical bugs to avoid (trading race conditions, Celery engine leak, hardcoded admin key)

### Existing Code (in git history, working tree is clean)
- `server/app/models.py` — Existing SQLAlchemy models to evolve (Team, Transaction, Directive, StockPrice)
- `server/app/database.py` — Async engine setup, Settings via pydantic-settings
- `server/app/api/auth.py` — Current API key auth (to be replaced with JWT)
- `docker-compose.yml` — Existing service definitions (db, redis, api, worker, caddy)
- `server/alembic/` — Existing migration structure (to be reset with single initial migration)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- SQLAlchemy async engine configuration (`create_async_engine` + `AsyncSession` + `asyncpg`) — already correct pattern
- Docker Compose with all 5 services (postgres:15, redis:7, caddy:2, api, worker) — needs Caddy WebSocket timeout config
- Celery worker with embedded beat (`--beat` flag in docker-compose) — correct pattern
- Pydantic Settings for env loading — reuse as-is
- Team model with name, ticker, email, password_hash, status enum — extend with sub-account fields

### Established Patterns
- Async SQLAlchemy with asyncpg driver — continue this pattern
- Pydantic request/response models for API validation — continue
- bcrypt for password hashing — continue
- UUID primary keys — continue

### Integration Points
- Frontend (Next.js on Vercel) connects to backend API via CORS-configured endpoints
- WebSocket connection from frontend to FastAPI via Caddy reverse proxy
- Redis pub/sub bridges Celery worker broadcasts to FastAPI WebSocket manager
- Alembic migrations run against PostgreSQL in Docker

</code_context>

<specifics>
## Specific Ideas

- Stitch MCP has been connected and will produce Bloomberg Terminal-style designs. Implementation should follow Stitch output as the source of truth for visual design.
- Registration form should be simple: team name, ticker (3-5 uppercase), email, password. System auto-generates both sub-account credentials.
- Admin is a completely separate entity from teams — different login page, different JWT claims.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-auth-and-base-ui*
*Context gathered: 2026-04-16*
