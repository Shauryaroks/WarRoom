# WarRoom Backend Developer Guide

> Last updated: 2026-04-12
> Covers: `server/` directory only (FastAPI + Celery + PostgreSQL + Redis)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Infrastructure Graph](#2-infrastructure-graph)
3. [Request Flow](#3-request-flow)
4. [Database Schema](#4-database-schema)
5. [Authentication](#5-authentication)
6. [API Endpoint Reference](#6-api-endpoint-reference)
7. [Background Workers](#7-background-workers)
8. [LLM Integration (Grok)](#8-llm-integration-grok)
9. [WebSocket](#9-websocket)
10. [Game State Machine](#10-game-state-machine)
11. [Team State Machine](#11-team-state-machine)
12. [Price Calculation Pipeline](#12-price-calculation-pipeline)
13. [Bankruptcy Pipeline](#13-bankruptcy-pipeline)
14. [File Map](#14-file-map)
15. [Environment Variables](#15-environment-variables)
16. [Running Locally](#16-running-locally)
17. [TODO / Not Yet Production](#17-todo--not-yet-production)

---

## 1. Architecture Overview

WarRoom is a real-time multiplayer business simulation game. Teams register, get assigned company profiles (SWOT), submit strategic directives evaluated by an LLM, trade each other's stocks, and survive periodic purges. The backend is a FastAPI async app with Celery workers for LLM calls and periodic tasks.

**Tech Stack:**

| Layer | Technology | Purpose |
|-------|-----------|---------|
| API Server | FastAPI 0.135+ / Uvicorn | Async HTTP + WebSocket |
| ORM | SQLAlchemy 2.0 (async) | Database models + queries |
| Database | PostgreSQL 15 | Persistent storage |
| Task Queue | Celery 5.6 + Redis broker | LLM calls, price recalc, bankruptcy |
| Cache/Pubsub | Redis 7 | Celery broker/backend |
| Reverse Proxy | Caddy 2 | TLS termination, routing |
| Runtime | Python 3.13, uv | Package management, execution |
| Container | Docker Compose | Orchestration |

---

## 2. Infrastructure Graph

```
                         ┌──────────────────────────────────┐
                         │           INTERNET                │
                         └──────────────┬───────────────────┘
                                        │
                                   :80 / :443
                                        │
                              ┌─────────▼─────────┐
                              │      Caddy 2       │
                              │  (reverse proxy)   │
                              │  api-complex.      │
                              │  helixtiet.in      │
                              └─────────┬──────────┘
                                        │
                                   api:80
                                        │
                    ┌───────────────────▼───────────────────┐
                    │          FastAPI (api container)       │
                    │                                       │
                    │  /api/v1/auth/*    → auth.py          │
                    │  /api/v1/teams/*   → teams.py         │
                    │  /api/v1/game/*    → game.py          │
                    │  /api/v1/orders/*  → trading.py       │
                    │  /api/v1/directives/* → directive.py  │
                    │  /api/v1/market/*  → market.py        │
                    │  /api/v1/news/*    → news.py          │
                    │  /api/v1/admin/*   → admin.py         │
                    │  /ws              → websocket.py      │
                    │                                       │
                    └──┬───────────────────┬───────────────┘
                       │                   │
             ┌─────────▼──────┐   ┌────────▼────────┐
             │  PostgreSQL 15 │   │    Redis 7       │
             │  (db)          │   │    (redis)       │
             │                │   │                  │
             │  teams         │   │  celery broker   │
             │  directives    │   │  celery backend  │
             │  transactions  │   │                  │
             │  stock_holdings│   │                  │
             │  cash_ledger   │   │                  │
             │  price_history │   │                  │
             │  market_news   │   │                  │
             │  game_state    │   │                  │
             └────────────────┘   └────────┬────────┘
                                           │
                                  ┌────────▼────────┐
                                  │  Celery Worker   │
                                  │  (worker)        │
                                  │                  │
                                  │  Tasks:          │
                                  │  • process_      │
                                  │    directive     │
                                  │  • recalculate_  │
                                  │    price_task    │
                                  │  • periodic_     │
                                  │    price_sweep   │
                                  │  • periodic_     │
                                  │    bankruptcy_   │
                                  │    check         │
                                  │  • resolve_      │
                                  │    bankruptcy    │
                                  │  • start_        │
                                  │    directive_    │
                                  │    cooldown      │
                                  │                  │
                                  │  Beat Schedule:  │
                                  │  • prices: 30s   │
                                  │  • bankruptcy:10s│
                                  └────────┬────────┘
                                           │
                                   ┌───────▼───────┐
                                   │  Grok (xAI)   │
                                   │  LLM API      │
                                   │               │
                                   │  api.x.ai/v1  │
                                   └───────────────┘
```

---

## 3. Request Flow

### 3.1 Directive Submission Flow (most complex path)

```
Player                   API                     Celery Worker           Grok LLM (xAI)
  │                       │                          │                        │
  │  POST /directives     │                          │                        │
  │  {directive_markdown} │                          │                        │
  │──────────────────────►│                          │                        │
  │                       │                          │                        │
  │                       │ 1. Verify X-API-Key      │                        │
  │                       │ 2. Check team ACTIVE      │                        │
  │                       │ 3. Check game ACTIVE      │                        │
  │                       │ 4. Check cooldown expired  │                        │
  │                       │ 5. Create Directive(PENDING)│                       │
  │                       │ 6. Set team → COOLDOWN     │                        │
  │                       │ 7. Enqueue Celery task     │                        │
  │                       │                          │                        │
  │  202 {submission_id,  │                          │                        │
  │   cooldown_until}     │                          │                        │
  │◄──────────────────────│                          │                        │
  │                       │                          │                        │
  │                       │   process_directive       │                        │
  │                       │─────────────────────────►│                        │
  │                       │                          │                        │
  │                       │                          │ 8. Set → PROCESSING    │
  │                       │                          │ 9. Read GROK_API_KEY   │
  │                       │                          │                        │
  │                       │                          │ POST /chat/completions │
  │                       │                          │───────────────────────►│
  │                       │                          │                        │
  │                       │                          │  {extraction_confidence│
  │                       │                          │   consistency_score,   │
  │                       │                          │   financial_impact,    │
  │                       │                          │   board_feedback, ...} │
  │                       │                          │◄───────────────────────│
  │                       │                          │                        │
  │                       │                          │ 10. Apply financial    │
  │                       │                          │     impact to team.cash│
  │                       │                          │ 11. Create CashLedger  │
  │                       │                          │ 12. Set → COMPLETED    │
  │                       │                          │ 13. Create MarketNews  │
  │                       │                          │     (TEAM_ACTION)      │
  │                       │                          │                        │
```

### 3.2 Buy Order Flow

```
Player                   API                      Database
  │                       │                          │
  │  POST /orders         │                          │
  │  {buy, $APEX, 100}    │                          │
  │──────────────────────►│                          │
  │                       │                          │
  │                       │ 1. Verify team auth       │
  │                       │ 2. Verify team ACTIVE     │
  │                       │ 3. Look up target team    │
  │                       │ 4. Check target not       │
  │                       │    ELIMINATED             │
  │                       │ 5. Check public_float     │
  │                       │    >= shares              │
  │                       │ 6. Check buyer cash       │
  │                       │    >= total_cost          │
  │                       │ 7. Check 25% ownership    │
  │                       │    cap                    │
  │                       │                          │
  │                       │ 8. buyer.cash -= cost    │
  │                       │ 9. target.float -= shares│
  │                       │ 10. Upsert StockHolding  │
  │                       │ 11. Create Transaction   │
  │                       │ 12. Create CashLedger    │
  │                       │ 13. COMMIT               │
  │                       │                          │
  │  200 {FILLED,         │                          │
  │   execution_price,    │                          │
  │   updated_cash,       │                          │
  │   updated_holdings}   │                          │
  │◄──────────────────────│                          │
```

### 3.3 Price Recalculation Flow (every 30 seconds)

```
Celery Beat              Worker                   Database
  │                       │                          │
  │  periodic_price_sweep │                          │
  │  (every 30s)          │                          │
  │──────────────────────►│                          │
  │                       │                          │
  │                       │  For each ACTIVE/         │
  │                       │  COOLDOWN team:           │
  │                       │                          │
  │                       │  recalculate_price_task   │
  │                       │──────────────────────────►│
  │                       │                          │
  │                       │  1. Get recent profit     │
  │                       │     (directives, 30 min)  │
  │                       │  2. base = (profit*10     │
  │                       │     + cash*0.1) * vibe    │
  │                       │  3. vibe = 0.5 + (0.5     │
  │                       │     * consistency         │
  │                       │     * macro_sensitivity)  │
  │                       │  4. sentiment = tanh(5    │
  │                       │     * net_flow) from      │
  │                       │     last 15 min trades    │
  │                       │  5. final = base * vibe   │
  │                       │     * sentiment           │
  │                       │  6. Clamp to >= $0.01     │
  │                       │  7. Update team.stock_    │
  │                       │     price                 │
  │                       │  8. Insert PriceHistory   │
  │                       │                          │
```

---

## 4. Database Schema

```
┌─────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│     teams        │       │   directives     │       │  stock_holdings  │
├─────────────────┤       ├──────────────────┤       ├──────────────────┤
│ id          UUID │◄──┐  │ id          UUID │       │ id          UUID │
│ name     VARCHAR │   │  │ team_id     UUID │───────│ owner_team_id    │──┐
│ ticker   VARCHAR │   │  │ content     TEXT │       │ target_team_id   │──┤
│ email    VARCHAR │   │  │ confidence FLOAT │       │ shares_owned INT │  │
│ password VARCHAR │   │  │ status     ENUM  │       │ total_cost_basis │  │
│ api_key     UUID │   │  │                  │       │   NUMERIC        │  │
│ status     ENUM  │   │  │ extraction FLOAT │       │ created_at       │  │
│ portfolio  VARCHAR│   │  │ consistency FLOAT│       │ updated_at       │  │
│                  │   │  │ macro_sens FLOAT │       └──────────────────┘  │
│ swot_strengths   │   │  │ aggression FLOAT │                             │
│ swot_weaknesses  │   │  │ innovation FLOAT │       ┌──────────────────┐  │
│ swot_opportunities│  │  │ vibe_mult NUMERIC│       │  transactions    │  │
│ swot_threats     │   │  │ financial  TEXT   │       ├──────────────────┤  │
│                  │   │  │ board_feed TEXT   │       │ id          UUID │  │
│ cash     NUMERIC │   │  │ news_head  TEXT   │       │ buyer_id    UUID │──┤
│ stock_price NUM  │   │  │ exec_penalty FLT │       │ seller_id   UUID │──┤
│ shares_out  INT  │   │  │ created_at       │       │ target_id   UUID │──┘
│ public_float INT │   │  │ completed_at     │       │ shares       INT │
│ treasury     INT │   │  └──────────────────┘       │ price_per  NUM   │
│ cooldown_until   │   │                              │ total_value NUM  │
│ bankrupt_since   │   │  ┌──────────────────┐       │ type        ENUM │
│ bankrupt_resolved│   │  │   cash_ledger    │       │ executed_at      │
│ dilution_cap INT │   │  ├──────────────────┤       └──────────────────┘
│ eliminated_at    │   │  │ id          UUID │
│ elimination_     │   │  │ team_id     UUID │──┘    ┌──────────────────┐
│   reason VARCHAR │   │  │ entry_type  VARCHAR│     │  price_history   │
│ rank_at_elim INT │   │  │ amount    NUMERIC│       ├──────────────────┤
│ rejection_reason │   │  │ balance   NUMERIC│       │ id          UUID │
│ created_at       │   │  │ ref_type  VARCHAR│       │ team_id     UUID │──┘
│ updated_at       │   │  │ ref_id      UUID │       │ price      NUM   │
└─────────────────┘   │  │ description TEXT  │       │ market_cap NUM   │
                      │  │ created_at       │       │ vibe_mult  NUM   │
                      │  └──────────────────┘       │ sentiment  NUM   │
                      │                              │ consistency FLT  │
                      │  ┌──────────────────┐       │ macro_sens  FLT  │
                      │  │   market_news    │       │ profit_comp NUM  │
                      │  ├──────────────────┤       │ cash_comp   NUM  │
                      │  │ id          UUID │       │ calculated_at    │
                      │  │ headline VARCHAR │       └──────────────────┘
                      │  │ content    TEXT  │
                      │  │ source_type      │       ┌���─────────────────┐
                      └──│ source_team_id   │       │   game_state     │
                         │ sentiment  NUM   │       ├──────────────────┤
                         │ affected_sectors │       │ id          INT  │ (always 1)
                         │ affected_tickers │       │ status      ENUM │
                         │ relevance_decay  │       │ started_at       │
                         │ created_at       │       │ paused_at        │
                         └──────────────────┘       │ resumed_at       │
                                                    │ finished_at      │
                                                    │ current_round INT│
                                                    │ last_purge_at    │
                                                    │ teams_remaining  │
                                                    │ llm_queue_depth  │
                                                    │ total_llm_cost   │
                                                    │ cooldown_minutes │
                                                    │ tam_per_cycle    │
                                                    │ starting_cash    │
                                                    │ starting_price   │
                                                    │ starting_shares  │
                                                    │ llm_model VARCHAR│
                                                    │ llm_max_tokens   │
                                                    │ llm_temperature  │
                                                    │ updated_at       │
                                                    └──────────────────┘
```

### Enums

| Enum | Values |
|------|--------|
| `TeamStatus` | `PENDING`, `ACTIVE`, `COOLDOWN`, `BANKRUPT`, `ELIMINATED`, `REJECTED` |
| `GameStatus` | `SETUP`, `ACTIVE`, `PAUSED`, `FINISHED` |
| `TransactionType` | `BUY`, `SELL`, `TREASURY_SALE`, `BANKRUPTCY_LIQUIDATION` |
| `DirectiveStatus` | `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED` |

---

## 5. Authentication

Two independent auth mechanisms, both via HTTP headers:

### Team Auth (`X-API-Key`)

- Header: `X-API-Key: <uuid>`
- Dependency: `get_current_team()` in `auth.py`
- Resolves to: `Team` ORM object
- Rejects: unknown keys (401), REJECTED teams (403)
- Used by: all player-facing endpoints (directives, orders, teams/me, etc.)

### Admin Auth (`X-Admin-Key`)

- Header: `X-Admin-Key: <string>`
- Dependency: `verify_admin_key()` in `auth.py`
- Compares against: `ADMIN_API_KEY` env var (default: `admin-secret-key`)
- Rejects: missing or wrong key (403)
- Used by: game control, team approval, news inject, admin metrics, settings

**Note:** The spec mentions `BearerAuth` for admin but implementation uses `X-Admin-Key` header. This is a known divergence -- admin auth is functional but uses a different header scheme than spec.

---

## 6. API Endpoint Reference

All endpoints are prefixed with `/api/v1`.

### Legend

| Column | Meaning |
|--------|---------|
| **Status** | `PROD` = fully implemented matching spec, `STUB` = returns placeholder data (see TODO), `PARTIAL` = works but missing some spec fields |
| **Auth** | `Team` = X-API-Key, `Admin` = X-Admin-Key, `None` = public |

---

### 6.1 Authentication (`/auth`)

| Method | Path | Auth | Status | Current Behavior | Spec Requirement | Gap |
|--------|------|------|--------|-----------------|-----------------|-----|
| `POST` | `/auth/register` | None | **PROD** | Creates team in PENDING status. Validates ticker uniqueness (3-4 uppercase letters, auto-prefixed with `$`), team name uniqueness, email format, password 8+ chars. Returns 202 with `{message, registration_id}`. | Same | None |
| `POST` | `/auth/login` | None | **PROD** | Accepts `{ticker, password}`. Normalizes ticker (adds `$` if missing, uppercases). Bcrypt password check. Returns `{api_key, team_name, ticker, status, ws_endpoint}`. | Same | None |

---

### 6.2 Game State (`/game`)

| Method | Path | Auth | Status | Current Behavior | Spec Requirement | Gap |
|--------|------|------|--------|-----------------|-----------------|-----|
| `GET` | `/game/state` | None | **PROD** | Returns `{status, server_time, started_at, elapsed_seconds, next_purge_at, current_round, teams_remaining, total_llm_cost_usd, llm_queue_depth}`. next_purge_at is last_purge + 1.5 hours. | Same | `next_purge_at` should be admin-configurable, currently hardcoded 1.5h offset. |
| `POST` | `/game/start` | Admin | **PROD** | Transitions SETUP/PAUSED -> ACTIVE. Activates all PENDING teams that have a portfolio_type assigned (i.e., approved teams). Initializes their cash, stock_price, shares from GameState config. Accepts `{scheduled_duration_hours, initial_news_items}`. | Same | `initial_news_items` param is accepted but not used (news items not created). `scheduled_duration_hours` is accepted but no auto-end timer exists. |
| `POST` | `/game/stop` | Admin | **PROD** | Resets game to SETUP status. | Not in spec | Extra endpoint, not in spec. |
| `POST` | `/game/pause` | Admin | **PROD** | ACTIVE -> PAUSED. Returns `{paused_at, will_resume_at: null}`. | Same | `will_resume_at` always null (no scheduled resume). |
| `POST` | `/game/resume` | Admin | **PROD** | PAUSED -> ACTIVE. Clears paused_at, sets resumed_at. | Same | None |
| `POST` | `/game/end` | Admin | **PROD** | Sets FINISHED, records finished_at. | Same | None |
| `POST` | `/game/purge` | Admin | **PROD** | Requires `{confirmation: "PURGE"}`. Calculates Strategic Score for each team: `(0.5 * market_cap) + (0.5 * liquidity)` where `liquidity = cash + (portfolio_value * 0.5)`. Eliminates bottom 50%. Increments round. Updates dilution caps (10% -> 20% -> 30%). Zeros holdings of eliminated teams. | Same | Min team threshold hardcoded to 6 (should be configurable). Treasury limit progression hardcoded. No WebSocket broadcast on purge. |

---

### 6.3 Teams (`/teams`)

| Method | Path | Auth | Status | Current Behavior | Spec Requirement | Gap |
|--------|------|------|--------|-----------------|-----------------|-----|
| `GET` | `/teams/me` | Team | **PROD** | Returns full TeamDossier: profile (id, name, ticker, status, SWOT, portfolio_id), financials (cash, stock_price, market_cap, liquidity, treasury_sale_limit_remaining), portfolio (holdings with cost_basis and unrealized PnL), last_directive, cooldown_status (active, started_at, ends_at, seconds_remaining). | Same | None |
| `GET` | `/teams/me/holdings` | Team | **PROD** | Returns portfolio with per-holding: ticker, shares, current_price, current_value, cost_basis, unrealized_pnl, ownership_percentage. Totals: total_portfolio_value, total_unrealized_pnl. | Same | None |
| `GET` | `/teams/me/directives` | Team | **PROD** | Paginated (limit/offset). Returns each directive with: headline, feedback, status, raw_markdown, character_count, extraction_confidence, vibe_scores dict, financial_impact dict. | Same | None |
| `GET` | `/teams` | None | **PROD** | Public: shows ACTIVE + COOLDOWN teams only. With `status_filter` param: shows filtered set. With `filter` param: searches name/ticker via ILIKE. Returns team_id, name, ticker, status, stock_price, market_cap, portfolio_id, eliminated_at, rank_at_elimination. | Spec says returns `pending_count` for admins | Missing `pending_count` field in response. |
| `POST` | `/teams/{id}/approve` | Admin | **PROD** | Approves PENDING team. Assigns SWOT from portfolio template (PORT_TECH_01, PORT_LEGACY_01, PORT_DISRUPT_01). If game ACTIVE: immediately activates with starting cash/shares. If not: stays PENDING with portfolio assigned, will activate on game start. | Same | None |
| `POST` | `/teams/{id}/reject` | Admin | **PROD** | Sets REJECTED status, stores reason. | Same | Spec says reason is emailed to team -- no email sending implemented. |
| `POST` | `/teams/{id}/bankrupt` | Admin | **PROD** | Force eliminates team. Zeros stock price. Clears all holdings of this team (other teams' shares become worthless). Accepts `{reason, public_message}`. | Spec says triggers liquidation | Skips liquidation grace period (immediate elimination). No WebSocket broadcast. `public_message` not broadcast. |

---

### 6.4 Directives (`/directives`)

| Method | Path | Auth | Status | Current Behavior | Spec Requirement | Gap |
|--------|------|------|--------|-----------------|-----------------|-----|
| `POST` | `/directives` | Team | **PROD** | Validates: team ACTIVE or expired COOLDOWN, game ACTIVE. Creates Directive(PENDING), sets team to COOLDOWN for `cooldown_minutes` (default 10). Dispatches `process_directive` Celery task. Returns 202 with `{submission_id, status: COOLDOWN, cooldown_until, seconds_remaining, message}`. Returns 429 if cooldown still active with Retry-After header. | Same | None |
| `GET` | `/directives/history` | Team | **PROD** | Returns list of team's directives (newest first, configurable limit). Each entry: id, content (truncated to 200 chars), status, board_feedback, created_at, completed_at, extraction_confidence. | Same | None |
| `GET` | `/directives/{id}` | Team | **PROD** | Returns full directive detail including all LLM scores, financial_impact (parsed JSON), board_feedback, news_headline. Verifies team ownership (403 if not owner). | Same | None |

---

### 6.5 Trading (`/orders`)

| Method | Path | Auth | Status | Current Behavior | Spec Requirement | Gap |
|--------|------|------|--------|-----------------|-----------------|-----|
| `POST` | `/orders` | Team | **PROD** | Immediate MARKET execution. **BUY**: validates target exists and not ELIMINATED, checks public_float >= shares, cash >= total_cost, 25% ownership cap. Deducts cash, reduces target float, upserts StockHolding with cost_basis tracking, creates Transaction + CashLedger. **SELL**: validates ownership, proportionally reduces cost_basis, returns float, adds proceeds. Returns `{order_id, status: FILLED, filled_shares, remaining_shares: 0, execution_price, total_value, updated_cash, updated_holdings}`. | Same | No LIMIT orders (spec says v1 is MARKET only). Cannot buy own stock (undocumented guard). |
| `GET` | `/orders` | Team | **PROD** | Returns transaction history for team (as buyer or seller). Newest first, configurable limit. Each entry: id, side (BUY/SELL), target_ticker, shares, price_per_share, status (always FILLED), total_value, timestamps. | Same | `status_filter` param accepted but not used (all orders are FILLED). |
| `DELETE` | `/orders/{id}` | Team | **STUB** | Always returns 400: "Cannot cancel: order already filled (all market orders execute instantly)". | Spec allows cancellation of pending orders | No LIMIT orders exist, so nothing to cancel. Correct stub behavior. |
| `POST` | `/orders/treasury/sell` | Team | **PROD** | Team sells own treasury shares to market. Limited by `dilution_cap_percent` of `shares_outstanding`. Increases public_float, adds cash. Creates TREASURY_SALE transaction + CashLedger. | Same | None |

---

### 6.6 Market Data (`/market`)

| Method | Path | Auth | Status | Current Behavior | Spec Requirement | Gap |
|--------|------|------|--------|-----------------|-----------------|-----|
| `GET` | `/market/tickers` | None | **PROD** | Returns snapshot of all ACTIVE/COOLDOWN/BANKRUPT teams. Per ticker: ticker, name, price, change_24h (%), change_absolute, volume_24h (public_float), market_cap, status. Change calculated from last 2 PriceHistory entries. | Same | None |
| `GET` | `/market/history/{ticker}` | None | **PARTIAL** | Returns PriceHistory entries for ticker. Normalizes ticker input. Supports `interval` param (1m/5m/15m/1h) and `limit` (max 500). | Spec expects OHLCV candlesticks aggregated by interval | Returns raw price points as close-only candles (open=high=low=close=price, volume=0). No real OHLCV aggregation. No `from`/`to` date params. |
| `GET` | `/market/sectors` | None | **STUB** | Returns single sector "ALL" with total market cap of all active teams. | Spec expects sector grouping by portfolio type | Placeholder -- all teams lumped into one sector. avg_change_percent always 0. |
| `GET` | `/market/ticker/{ticker}` | None | **PROD** | Detailed ticker info: team_id, name, ticker, status, cash, stock_price, shares_outstanding, public_float, treasury_shares, dilution_cap_percent, market_cap, liquidity (cash + stock_value * 0.5), strategic_score ((0.5 * market_cap) + (0.5 * liquidity)), SWOT dict. | Same | None |

---

### 6.7 News (`/news`)

| Method | Path | Auth | Status | Current Behavior | Spec Requirement | Gap |
|--------|------|------|--------|-----------------|-----------------|-----|
| `GET` | `/news` | None | **PROD** | Paginated news feed (newest first). Supports `limit` (max 50), `before_id` (cursor pagination), `source_type` filter. Per item: id, headline, content, source_type, source_ticker, sentiment_score, affected_sectors, affected_tickers, created_at, relevance_decay. Returns `has_more` boolean. | Same | None |
| `POST` | `/news/inject` | Admin | **PARTIAL** | Creates ADMIN_INJECTED news item. Accepts `{headline, content, impact_type, affected_sectors, affected_tickers, scheduled_for}`. Returns `{news_id, broadcast_count: 0, scheduled}`. | Spec expects WebSocket broadcast + scheduling | `broadcast_count` always 0 (no WebSocket broadcast). `scheduled_for` accepted but news publishes immediately. `impact_type` stored but doesn't affect sentiment_score. |

---

### 6.8 Admin (`/admin`)

| Method | Path | Auth | Status | Current Behavior | Spec Requirement | Gap |
|--------|------|------|--------|-----------------|-----------------|-----|
| `GET` | `/admin/metrics` | Admin | **PROD** | Returns `{active_teams, total_teams, teams_by_status, aggregate_liquidity, avg_market_cap, market_cap_change_24h, llm_queue_depth, session_cost_usd}`. | Same | `market_cap_change_24h` always 0 (not calculated from history). |
| `GET` | `/admin/llm-stats` | Admin | **PARTIAL** | Returns directive counts (total, completed, failed), error_rate, total_cost, model info. | Same | `avg_latency_ms` always 0 (no per-request latency tracking). Cost not tracked per-request. |
| `GET` | `/admin/market-stats` | Admin | **STUB** | Returns `{total_trades, trades_last_hour, volume_by_ticker: {}, anomaly_alerts: []}`. | Spec expects volume breakdown + anomaly detection | volume_by_ticker empty. anomaly_alerts empty. |
| `GET` | `/admin/teams` | Admin | **PROD** | Lists all teams sorted by cash desc. Filterable by status. Returns: id, name, ticker, status, cash, stock_price, market_cap, portfolio_type, email, created_at. | Same | None |
| `GET` | `/admin/teams/pending` | Admin | **PROD** | Lists PENDING teams sorted by creation date. Returns: id, name, ticker, email, created_at. | Not explicitly in spec | Extra convenience endpoint. |
| `POST` | `/admin/settings` | Admin | **PROD** | Updates GameState config: cooldown_minutes, tam_per_cycle, starting_cash, starting_price, starting_shares, llm_model. | Same | None |
| `GET` | `/admin/settings` | Admin | **PROD** | Returns current GameState config values. | Same | None |
| `POST` | `/admin/teams/{id}/reset` | Admin | **PROD** | Resets team to ACTIVE with initial state. Restores cash, stock_price, shares, zeros holdings, clears cooldown/bankruptcy/elimination flags. | Not in spec | Extra admin utility endpoint. |
| `POST` | `/admin/news/seed` | Admin | **PROD** | Seeds 1-20 initial GLOBAL news headlines if none exist. Returns count seeded. Idempotent (skips if global news already exists). | Not explicitly in spec | Extra admin utility endpoint. |

---

### 6.9 Health Checks (no prefix)

| Method | Path | Auth | Status | Description |
|--------|------|------|--------|-------------|
| `GET` | `/` | None | **PROD** | Returns `{message, version}` |
| `GET` | `/health` | None | **PROD** | Returns `{status: "ok"}` -- used by Docker healthcheck |
| `GET` | `/health/db` | None | **PROD** | Tests PostgreSQL connection with `SELECT 1` |
| `GET` | `/health/redis` | None | **PROD** | Tests Redis connection with `PING` |

---

## 7. Background Workers

### Celery Configuration

| Setting | Value |
|---------|-------|
| Broker | Redis (same instance as app) |
| Serializer | JSON |
| Hard time limit | 300s per task |
| Soft time limit | 270s per task |
| Prefetch multiplier | 10 |
| Max tasks per child | 1000 |

### Beat Schedule (periodic tasks)

| Task | Interval | What It Does |
|------|----------|-------------|
| `periodic_price_sweep` | 30 seconds | Enqueues `recalculate_price_task` for every ACTIVE/COOLDOWN team |
| `periodic_bankruptcy_check` | 10 seconds | Detects negative-cash teams, triggers bankruptcy flow |

### Task Inventory

| Task | Trigger | Retries | Description |
|------|---------|---------|-------------|
| `process_directive` | POST /directives | 3 | Sends directive to LLM, applies financial impact, generates news |
| `start_directive_cooldown` | process_directive | 0 | Sets team COOLDOWN status with timer |
| `recalculate_price_task` | periodic_price_sweep | 3 | Recalculates one team's stock price (see [Price Calculation](#12-price-calculation-pipeline)) |
| `periodic_price_sweep` | Celery Beat (30s) | 0 | Fan-out: enqueues recalculate for each active team |
| `periodic_bankruptcy_check` | Celery Beat (10s) | 0 | Checks for negative cash, triggers resolution |
| `resolve_bankruptcy_task` | periodic_bankruptcy_check | 0 | Liquidates holdings, eliminates if still negative |

---

## 8. LLM Integration (Grok)

LLM calls use a single Grok API key (xAI) configured via environment variable.

### Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `GROK_API_KEY` | (empty) | xAI API key. If empty, directive evaluation returns deterministic stubs. |
| `GROK_BASE_URL` | `https://api.x.ai/v1` | Grok API base URL. |

### How It Works

1. The Celery worker task `process_directive` calls `evaluate_directive()`
2. If `GROK_API_KEY` is empty, a deterministic stub response is returned (safe for development)
3. If set, an `httpx` POST is made to `{GROK_BASE_URL}/chat/completions` with the team's SWOT profile and directive content
4. The model, max_tokens, and temperature are read from the `GameState` row (defaults: `grok-3-mini`, 2000, 0.7)
5. Response is parsed as JSON containing LLM scores, board feedback, financial impact, and a news headline

### Model Configuration

The model can be changed at runtime via `POST /admin/settings`:
```json
{"llm_model": "grok-3-mini"}
```

The default model stored in the `game_state` table is `grok-3-mini`.

---

## 9. WebSocket

**Endpoint:** `GET /ws?team_id=<optional>`

### Connection Types

| Parameter | Channel | Use Case |
|-----------|---------|----------|
| No team_id | `market` | Public market feed (prices, news, purge events) |
| `team_id=<uuid>` | `team:<uuid>` | Team-specific private updates |

### Inbound Messages

| Type | Payload | Effect |
|------|---------|--------|
| `ping` | (none) | Returns `{type: "pong", timestamp}` |
| `subscribe` | `{channel: "team:<team_id>"}` | Adds connection to team channel |

### Outbound Message Types

| Type | When Sent | Payload |
|------|-----------|---------|
| `price_update` | After price recalculation | `{ticker, price, change_percent}` |
| `news` | On news creation | `{headline, ticker, is_global}` |
| `purge_complete` | After market purge | `{eliminated_tickers, remaining_count, message}` |
| `bankruptcy_alert` | On team bankruptcy | `{ticker, message, severity: "CRITICAL"}` |
| `system_event` | Various admin actions | `{event_type, message, affected_ticker}` |

### Current State

The `ConnectionManager` class and broadcast methods are fully implemented but **most broadcast calls are TODO** -- the WebSocket infrastructure exists but is not wired to the worker tasks that generate events. Broadcasts from API endpoints (price updates from pricing worker, purge events, bankruptcy events) are stubbed.

---

## 10. Game State Machine

```
                    ┌────────┐
                    │ SETUP  │◄──────────────────────┐
                    └───┬────┘                       │
                        │                            │
                   POST /game/start              POST /game/stop
                   (admin)                       (admin)
                        │                            │
                        ▼                            │
                    ┌────────┐                       │
           ┌───────│ ACTIVE │───────┐               │
           │       └───┬────┘       │               │
           │           │            │               │
      POST /game/   POST /game/  POST /game/        │
      pause         end          stop               │
           │           │            │               │
           ▼           ▼            └───────────────┘
       ┌────────┐  ┌──────────┐
       │ PAUSED │  │ FINISHED │
       └───┬────┘  └──────────┘
           │           (terminal)
      POST /game/
      resume
           │
           └──────────► ACTIVE
```

### What happens at each transition

| Transition | Side Effects |
|-----------|-------------|
| SETUP -> ACTIVE | `started_at` set, all approved PENDING teams activated with starting financials |
| ACTIVE -> PAUSED | `paused_at` set |
| PAUSED -> ACTIVE | `resumed_at` set, `paused_at` cleared |
| ACTIVE -> FINISHED | `finished_at` set, scores locked |
| Any -> SETUP | Status reset (via `/game/stop`) |

---

## 11. Team State Machine

```
      Register
         │
         ▼
     ┌─────────┐     reject      ┌──────────┐
     │ PENDING │─────────────────►│ REJECTED │
     └────┬────┘                  └──────────┘
          │                         (terminal)
     approve + game start
     (or game already active)
          │
          ▼
     ┌─────────┐    submit directive    ┌──────────┐
     │ ACTIVE  │───────────────────────►│ COOLDOWN │
     └────┬────┘◄───────────────────────┘────┬─────┘
          │       cooldown expires            │
          │                                   │
          │  cash < 0 (detected by worker)    │  cash < 0
          ▼                                   ▼
     ┌──────────┐
     │ BANKRUPT │
     └────┬─────┘
          │
          ├── liquidation succeeds (cash >= 0) ──► ACTIVE
          │
          └── liquidation fails (cash < 0) ──┐
                                              │
     purge (bottom 50%) ──────────────────────┤
     admin force-bankrupt ────────────────────┤
                                              ▼
                                        ┌─────────────┐
                                        │ ELIMINATED  │
                                        └─────────────┘
                                          (terminal)
                                          stock_price = 0
                                          all holdings zeroed
```

### Timing

| Event | Duration |
|-------|----------|
| Cooldown after directive | `cooldown_minutes` (default 10 min, configurable) |
| Bankruptcy grace period | 60 seconds before liquidation attempt |
| Price recalculation | Every 30 seconds |
| Bankruptcy check | Every 10 seconds |

---

## 12. Price Calculation Pipeline

Runs every 30 seconds per active team via Celery worker.

### Formula

```
final_price = base_price * vibe_multiplier * sentiment_multiplier
```

Where:

```
base_price = (recent_profit * 10 + cash * 0.1) * vibe_multiplier
```

### Component Breakdown

| Component | Formula | Range | Source |
|-----------|---------|-------|--------|
| **recent_profit** | Sum of `net_profit_delta` from directives completed in last 30 min | unbounded | `directives.financial_impact` JSON |
| **profit_component** | `recent_profit * 10` | unbounded | Amplifies directive outcomes |
| **cash_component** | `team.cash * 0.1` | unbounded | Floor from cash reserves |
| **vibe_multiplier** | `0.5 + (0.5 * consistency_score * macro_sensitivity_score)` | [0.5, 1.5] | Last completed directive's LLM scores |
| **sentiment_multiplier** | `1.0 + (tanh(5.0 * net_flow) * 0.20)` | [0.80, 1.20] | Trading activity in last 15 min |
| **net_flow** | `(buy_volume - sell_volume) / public_float` | [-1.0, 1.0] | Recent BUY vs SELL+TREASURY_SALE trades |

### Floor

`final_price` is clamped to a minimum of `$0.01`.

### Recording

Each calculation creates a `PriceHistory` row with all components for audit trail.

---

## 13. Bankruptcy Pipeline

```
  periodic_bankruptcy_check (every 10s)
         │
         ├── Find ACTIVE/COOLDOWN teams with cash < 0
         │         │
         │         ▼
         │   enter_bankruptcy()
         │   • team.status = BANKRUPT
         │   • team.bankrupt_since = now
         │   • Schedule resolve_bankruptcy_task (60s countdown)
         │
         └── Find BANKRUPT teams with bankrupt_since > 60s ago
                   │
                   ▼
            resolve_bankruptcy_task
                   │
                   ▼
            attempt_liquidation()
            • Get all StockHoldings (sorted by shares desc)
            • Fire-sale each holding at current market price
            • Stop once cash >= 0 or all holdings sold
            • Create BANKRUPTCY_LIQUIDATION transaction for each
            • Create CashLedger entry for each
                   │
           ┌───────┴───────┐
           │               │
     cash >= 0        cash < 0
           │               │
           ▼               ▼
     ACTIVE           eliminate_team()
     bankrupt_        • status = ELIMINATED
     resolved=true    • stock_price = 0
                      • Zero all holdings of this team
                      • Record eliminated_at + reason
```

---

## 14. File Map

```
server/
├── Dockerfile                          # Python 3.13, uv, port 80
├── pyproject.toml                      # Dependencies
├── uv.lock                             # Lock file
├── .env                                # Environment variables
├── .gitignore
│
└── app/
    ├── main.py                         # FastAPI app, lifespan, routers, websocket, health
    ├── database.py                     # Settings, engine, session factory
    ├── models.py                       # All SQLAlchemy ORM models + enums
    ├── websocket.py                    # ConnectionManager, broadcast methods
    │
    ├── api/
    │   ├── __init__.py
    │   ├── auth.py                     # Register, login, auth dependencies
    │   ├── teams.py                    # /teams/me, holdings, directives, approve, reject, bankrupt
    │   ├── game.py                     # Game lifecycle, purge, strategic score
    │   ├── trading.py                  # Buy/sell orders, treasury sales
    │   ├── directive.py                # Directive submission, history, detail
    │   ├── market.py                   # Tickers, price history, sectors, ticker detail
    │   ├── news.py                     # News feed, admin inject
    │   └── admin.py                    # Metrics, LLM stats, market stats, settings, team mgmt
    │
    └── worker/
        ├── __init__.py                 # Re-exports celery_app
        ├── celery_app.py               # Celery config, beat schedule
        └── tasks/
            ├── __init__.py
            ├── directive.py            # LLM evaluation, financial impact, news generation
            ├── pricing.py              # Price calculation, vibe/sentiment multipliers
            └── bankruptcy.py           # Bankruptcy detection, liquidation, elimination
```

---

## 15. Environment Variables

### `server/.env`

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@db:5432/complex` | Yes | Async PostgreSQL connection string. Must use `asyncpg` driver. Host `db` is Docker service name. |
| `REDIS_URL` | `redis://redis:6379/0` | Yes | Redis for Celery broker/backend. Host `redis` is Docker service name. |
| `GROK_API_KEY` | (empty) | No | xAI Grok API key. If empty, LLM calls return stubs. |
| `GROK_BASE_URL` | `https://api.x.ai/v1` | No | Grok API base URL. |
| `ADMIN_API_KEY` | `admin-secret-key` | Yes | Admin auth key. **Change for production.** |

---

## 16. Running Locally

### Prerequisites

- Docker and Docker Compose
- (Optional) `uv` for running without Docker

### Docker Compose (recommended)

```bash
# From repo root (NOT server/)
docker compose up --build

# API available at:
#   http://localhost:8080/api/v1    (direct, bypasses Caddy)
#   http://localhost/api/v1         (through Caddy)

# Health check:
curl http://localhost:8080/health
```

### Services

| Service | Image | Port | Notes |
|---------|-------|------|-------|
| `db` | postgres:15 | 5432 (internal) | Data in `db_data` volume |
| `redis` | redis:7 | 6379 (internal) | Ephemeral |
| `api` | ./server | 8080:80 | FastAPI + Uvicorn |
| `worker` | ./server | (none) | Celery worker + Beat |
| `caddy` | caddy:2 | 80, 443 | Reverse proxy to api:80 |

### Without Docker

```bash
cd server

# Start PostgreSQL and Redis locally, then:
export DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/complex"
export REDIS_URL="redis://localhost:6379/0"

# API
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Worker (separate terminal)
uv run celery -A app.worker worker --loglevel=info --beat
```

---

## 17. TODO / Not Yet Production

These are features referenced in the spec or marked with `# TODO` in the codebase that are not yet fully implemented.

### High Priority (affects gameplay correctness)

| Item | Location | Description |
|------|----------|-------------|
| OHLCV candlestick aggregation | `market.py:138-152` | Price history returns raw points, not aggregated candles by interval. `open`/`high`/`low` are all equal to `close`. |
| WebSocket broadcasts | `pricing.py:172`, `game.py:363`, `teams.py:578`, `news.py:148` | Infrastructure exists but worker tasks don't call broadcast methods. Clients won't get real-time updates. |
| `initial_news_items` in game start | `game.py:78` | Parameter accepted but news items not created. |
| `scheduled_for` in news inject | `news.py:149` | Parameter accepted but news publishes immediately (no scheduling). |
| News inject sentiment_score | `news.py:136-143` | `impact_type` not translated to `sentiment_score` on the MarketNews row. |

### Medium Priority (admin/monitoring gaps)

| Item | Location | Description |
|------|----------|-------------|
| LLM latency tracking | `admin.py:97` | `avg_latency_ms` always 0. Need per-request timing in directive worker. |
| LLM cost tracking per request | `admin.py:95` | `total_llm_cost` in GameState exists but is never incremented by the worker. |
| Market cap change 24h | `admin.py:66` | Always 0. Need to compare current vs historical aggregate. |
| Volume by ticker | `admin.py:136` | Empty dict. Need aggregation query on transactions. |
| Anomaly detection | `admin.py:137` | Empty array. No detection logic implemented. |
| Sector grouping | `market.py:177-198` | Single "ALL" sector. Should group by `portfolio_type`. |
| `pending_count` in /teams response | `teams.py:397` | Missing from response. Spec expects it for admin views. |
| Price history `from`/`to` params | `market.py:110-113` | Not implemented. Only `interval` and `limit` supported. |

### Low Priority (nice-to-have / future)

| Item | Location | Description |
|------|----------|-------------|
| Configurable purge threshold | `game.py:287` | Hardcoded to 6 teams minimum. |
| Configurable treasury progression | `game.py:343-347` | Hardcoded 10% -> 20% -> 30% by round. |
| Configurable next_purge_at | `game.py:60-61` | Hardcoded 1.5 hours after last purge. |
| `scheduled_duration_hours` auto-end | `game.py:77` | Parameter accepted but no timer to auto-end game. |
| Email on team rejection | `teams.py:509-531` | Spec mentions reason is "emailed" but no email sending. |
| Public message broadcast on force-bankrupt | `teams.py:576-578` | `public_message` param accepted but not broadcast. |
| LIMIT order support | `trading.py:311-322` | Only MARKET orders exist. DELETE /orders always returns 400. |
| Redis pub/sub for WebSocket | `pricing.py:172` | Broadcast stub exists but no Redis pub/sub wiring. Multi-instance deployments won't share WS events. |
