# Phase 4: Simulation Engine and Trading - Research

**Researched:** 2026-04-16
**Domain:** Real-time stock simulation engine, trading mechanics, candlestick charting, game view UI
**Confidence:** HIGH

## Summary

Phase 4 builds the core market simulation loop: a Celery Beat price tick task runs every 60 seconds, calculates new stock prices for all teams using a pluggable score system (mock/manual for Phase 4, LLM-driven in Phase 5), stores price history, and broadcasts updates via Redis pub/sub to all WebSocket clients. The trading system provides buy/sell endpoints with atomic 30% cap enforcement using `SELECT FOR UPDATE`. The frontend renders a Bloomberg-style game view with lightweight-charts 5.1 candlestick charts (5-minute candles), role-based sidebar navigation (Caseline/Trading/Solutions tabs), and a floating glassmorphism news overlay.

All backend infrastructure is in place: Celery Beat schedule with game-active guard, Redis pub/sub relay, WebSocket ConnectionManager with broadcast/team-send, async SQLAlchemy with worker session pattern, and JWT-based auth with role enforcement. The data models (Team, StockHolding, Transaction, CashLedger, PriceHistory, MarketNews) are fully defined. Phase 4 fills in the `game.tick` task body, adds trading API endpoints, and transforms the game page shell into the full multi-panel terminal UI.

**Primary recommendation:** Build backend-first (price tick engine, then trading API), followed by frontend (chart component, then game layout with role-based tabs). The price tick and trading service are independent and can be planned as separate waves.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Market does NOT start until the first LLM evaluation produces a timeline. Before that, stock prices remain at their initial value set by admin in the caseline. No random walk.
- D-02: Stock prices are driven by LLM evaluation results. The LLM evaluates a team's 3-month strategic roadmap and produces a price trajectory. Price ticks every minute follow that trajectory.
- D-03: Medium volatility (3-5% per tick). Enough for noticeable swings and trading opportunities without feeling random.
- D-04: Microtweaks (submitted every 20 mins) trigger re-evaluation which modifies the future price trajectory. Each 20-min window represents 3 simulated months.
- D-05: Since LLM evaluation is Phase 5, Phase 4 builds the simulation engine infrastructure with a pluggable score input. For Phase 4 testing, use a mock/placeholder score (e.g., admin can manually set a quality score per team, or use a default score) to drive price movement. Phase 5 replaces this with real LLM evaluation.
- D-06: Buy/sell with confirmation -- select company, enter quantity, see total cost preview, click CONFIRM to execute. One extra step for safety.
- D-07: Starting cash is part of the caseline -- set per team by admin when creating the company portfolio. Not a fixed amount. Stored in the Team model or associated portfolio data.
- D-08: 30% external shareholding cap enforced atomically with SELECT FOR UPDATE row-level locking. Concurrent orders cannot exceed the cap.
- D-09: All trades execute at current simulated price (no bid/ask spread, no order book).
- D-10: 5-minute candles -- each candle aggregates 5 ticks. Smoother, less noisy than 1-minute.
- D-11: Company selector tabs above the chart to switch between companies' price histories.
- D-12: Price overlay text on chart -- current price, change %, high/low. No volume bars.
- D-13: Use lightweight-charts 5.1 (already in CLAUDE.md tech stack). Render via refs, not React wrapper.
- D-14: Game views have a sidebar with role-based tab visibility: Caseline (both), Trading (trader only), Solutions (strategist only). News is NOT a sidebar tab -- floating overlay.
- D-15: Main content area shows the candlestick chart (center) with the active sidebar tab's content on the left. Chart is always visible regardless of which tab is selected.
- D-16: Header bar shows team name, ticker, game timer, current quarter, game status (LIVE/PAUSED), cash balance.

### Claude's Discretion
- Price interpolation algorithm between target prices
- Noise/randomness model within 3-5% volatility band
- Trading API endpoint structure and response shapes
- Zustand store structure for market/trading state
- Component decomposition for game view

### Deferred Ideas (OUT OF SCOPE)
- Solutions submission UI (Phase 5 -- Solutions tab will be a placeholder in Phase 4)
- LLM evaluation integration (Phase 5 -- Phase 4 uses mock/manual scores)
- News feed content (Phase 6 -- LLM-generated news)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SIM-01 | Stock prices update every 1 minute using formula + LLM quality adjustment | Price tick Celery task (60s Beat schedule already exists), pluggable score interface, interpolation algorithm |
| SIM-02 | Each 20-minute real-time window represents 3 simulated months | Quarter tracking in GameState model (`current_round`), timer logic in `calculate_elapsed_seconds` |
| SIM-03 | Caseline evolves based on approved solution evaluations | Pluggable score interface (Phase 4 uses mock; Phase 5 plugs in LLM). PriceHistory model stores trajectory data |
| SIM-04 | Real-time candlestick chart displays stock price history | lightweight-charts 5.1 CandlestickSeries, `update()` for real-time, WebSocket `price_update` messages |
| TRAD-01 | Trader can buy shares in other teams' companies at current price | Trading API endpoint, StockHolding + Transaction models exist, role enforcement via `require_team` |
| TRAD-02 | Trader can sell shares they hold | Trading API endpoint, StockHolding update with cost basis adjustment |
| TRAD-03 | Maximum 30% external shareholding per company enforced | `SELECT FOR UPDATE` on StockHolding rows, sum check against `public_float` |
| TRAD-04 | All share transactions validated atomically with row-level locking | `with_for_update()` in SQLAlchemy async, single transaction wrapping validation + execution |
| TRAD-05 | Portfolio view showing holdings, P&L, and total net worth | Portfolio API endpoint + Zustand store, cost basis tracked in StockHolding.total_cost_basis |
| UI-02 | Real-time candlestick stock chart per company | lightweight-charts 5.1 via refs, company selector tabs, 5-minute candle aggregation |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Price tick calculation | Background Worker (Celery) | Database (PostgreSQL) | Celery Beat fires every 60s, calculates prices, writes to PriceHistory, publishes via Redis |
| Price trajectory storage | Database (PostgreSQL) | -- | Target prices + interpolation params stored in DB, read by tick task |
| Trade execution & validation | API / Backend (FastAPI) | Database (PostgreSQL) | REST endpoint validates, DB enforces atomicity via SELECT FOR UPDATE |
| 30% cap enforcement | Database (PostgreSQL) | API / Backend | Row-level locking in PostgreSQL; API orchestrates the transaction |
| Real-time price broadcast | API / Backend (WebSocket) | Redis (pub/sub) | Celery publishes to Redis, API relay pushes to WebSocket clients |
| Candlestick chart rendering | Browser / Client | -- | lightweight-charts renders entirely client-side via canvas |
| Game view layout & routing | Browser / Client | -- | Role-based sidebar, tab switching, all client-side React |
| Portfolio calculation | API / Backend | Database | Server computes P&L from StockHolding + current prices |
| News overlay | Browser / Client | -- | Floating UI component, data from existing WebSocket news messages |

## Standard Stack

### Core (already installed -- no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| lightweight-charts | 5.1.0 | Candlestick chart rendering | [VERIFIED: npm registry] Already in CLAUDE.md. TradingView's official library, 35kB bundle, `update()` method for real-time streaming |
| Zustand | 5.0.12 | Market/trading client state | [VERIFIED: npm registry] Already used for auth-store, game-store. Add market-store and trading-store |
| Celery | >=5.6.3 | Price tick scheduling | [VERIFIED: pyproject.toml] Beat schedule already configured for 60s game tick |
| SQLAlchemy | >=2.0.49 | Async ORM with row locking | [VERIFIED: pyproject.toml] `with_for_update()` for 30% cap enforcement |
| redis-py | >=5.2.0 | Pub/sub for price broadcasts | [VERIFIED: pyproject.toml] Sync `publish_broadcast_sync` already in redis_pubsub.py |

### Supporting (no new packages needed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | 4.x | WebSocket message validation | Validate `price_update`, `trade_executed` message shapes on client |
| Pydantic | >=2.9.0 | Request/response validation | Trading endpoint schemas (BuyRequest, SellRequest, PortfolioResponse) |
| asyncpg | >=0.29.0 | PostgreSQL async driver | Used by SQLAlchemy async engine, no direct usage needed |

**Installation:** No new packages required. All dependencies are already in `server/pyproject.toml` and `client/package.json`.

## Architecture Patterns

### System Architecture Diagram

```
                    Game View (Browser)
                         |
          +--------------+---------------+
          |              |               |
    REST API        WebSocket       Chart (canvas)
    /trading/*      price_update    lightweight-charts
          |              ^               ^
          |              |               |
    FastAPI Router   Redis Relay    setData/update
          |              |               |
          v              |               |
    PostgreSQL      Redis Pub/Sub   Zustand Store
    (atomic tx)          ^           (priceHistory)
          |              |               ^
          |              |               |
          +--- Celery Beat Task ---------+
               (every 60s)
               1. Check game active
               2. Load target prices
               3. Interpolate + noise
               4. Write PriceHistory
               5. Update Team.stock_price
               6. Publish price_update
```

### Recommended Project Structure

```
server/app/
  services/
    simulation_service.py    # Price calculation, trajectory, interpolation
    trading_service.py       # Buy/sell logic with atomic locking
  api/
    trading.py               # /api/v1/trading/* endpoints
    market.py                # /api/v1/market/* endpoints (price history, portfolio)
  worker/tasks/
    game_tick.py             # Expand: call simulation_service for price updates

client/src/
  app/game/
    page.tsx                 # Game layout shell (expand from current)
  components/game/
    CandlestickChart.tsx     # lightweight-charts wrapper via refs
    CompanyTabs.tsx          # Tab selector for companies
    PriceOverlay.tsx         # Current price, change %, high/low
    TradingPanel.tsx         # Buy/sell form with confirmation
    PortfolioTable.tsx       # Holdings, P&L, net worth
    CaselinePanel.tsx        # Company story, caseline details
    SolutionsPanel.tsx       # Placeholder for Phase 5
    NewsOverlay.tsx          # Floating glassmorphism news window
    GameSidebar.tsx          # Role-based tab navigation
    GameHeader.tsx           # Team info, timer, status, cash
  stores/
    market-store.ts          # Price data, selected company, candle history
    trading-store.ts         # Portfolio, holdings, trade state
  lib/
    types.ts                 # Add PriceUpdate, TradeRequest, Portfolio types
```

### Pattern 1: Price Tick Task (Celery Beat)

**What:** Every 60 seconds, calculate new stock prices for all active teams and broadcast.
**When to use:** The core simulation loop -- runs continuously while game is ACTIVE.

```python
# Source: Existing game_tick.py pattern + D-02/D-05 decisions
# server/app/worker/tasks/game_tick.py

import asyncio
from app.worker.celery_app import celery_app
from app.database import get_worker_session

@celery_app.task(name="game.tick")
def game_tick():
    if not is_game_active():
        return
    asyncio.run(_execute_tick())

async def _execute_tick():
    async with get_worker_session() as db:
        from app.services.simulation_service import calculate_all_prices
        price_updates = await calculate_all_prices(db)
        await db.commit()

    # Publish to Redis AFTER commit (not inside transaction)
    from app.redis_pubsub import publish_broadcast_sync
    publish_broadcast_sync({
        "type": "price_update",
        "payload": {
            "prices": price_updates,  # [{team_id, ticker, price, change_pct, timestamp}]
        }
    })
```

### Pattern 2: Atomic Trade Execution (SELECT FOR UPDATE)

**What:** Buy/sell with row-level locking to prevent 30% cap violation under concurrent access.
**When to use:** Every trade execution.

```python
# Source: PITFALLS.md Pitfall 1 + D-08 decision
# server/app/services/trading_service.py

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Team, StockHolding, Transaction, CashLedger, TransactionType
from decimal import Decimal

async def execute_buy(
    db: AsyncSession,
    buyer_team_id: uuid.UUID,
    target_team_id: uuid.UUID,
    shares: int,
) -> Transaction:
    # 1. Lock the target team row to get current price + public_float
    target = await db.scalar(
        select(Team)
        .where(Team.id == target_team_id)
        .with_for_update()
    )

    # 2. Lock ALL holdings for this target to calculate total external ownership
    holdings_result = await db.execute(
        select(StockHolding)
        .where(StockHolding.target_team_id == target_team_id)
        .with_for_update()
    )
    all_holdings = holdings_result.scalars().all()

    total_external = sum(h.shares_owned for h in all_holdings)
    max_external = int(target.public_float * Decimal("0.30"))

    if total_external + shares > max_external:
        raise ValueError(f"Would exceed 30% cap. Available: {max_external - total_external}")

    # 3. Lock buyer team to check cash
    buyer = await db.scalar(
        select(Team)
        .where(Team.id == buyer_team_id)
        .with_for_update()
    )

    total_cost = target.stock_price * shares
    if buyer.cash < total_cost:
        raise ValueError(f"Insufficient cash. Need: {total_cost}, Have: {buyer.cash}")

    # 4. Execute (all within same transaction -- committed by caller)
    buyer.cash -= total_cost
    # ... update/create StockHolding, create Transaction, create CashLedger entry
```

### Pattern 3: lightweight-charts via Refs (React)

**What:** Render candlestick chart using imperative API through React refs, not a wrapper library.
**When to use:** The main chart component.

```typescript
// Source: lightweight-charts official docs (Context7 verified)
// client/src/components/game/CandlestickChart.tsx

"use client";
import { useEffect, useRef } from "react";
import { createChart, CandlestickSeries, type IChartApi, type ISeriesApi } from "lightweight-charts";

interface CandleData {
  time: string; // "2026-04-16T14:00:00" or unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
}

interface Props {
  data: CandleData[];
  onNewTick?: (candle: CandleData) => void;
}

export function CandlestickChart({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "#0e0e0e" },
        textColor: "#89919d",
      },
      grid: {
        vertLines: { color: "rgba(33,150,243,0.03)" },
        horzLines: { color: "rgba(33,150,243,0.03)" },
      },
      crosshair: { mode: 0 }, // Normal mode
      timeScale: { borderColor: "#2a2a2a" },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#40e56c",
      downColor: "#FF1744",
      wickUpColor: "#40e56c",
      wickDownColor: "#FF1744",
      borderVisible: false,
    });

    series.setData(data);
    chart.timeScale().fitContent();

    chartRef.current = chart;
    seriesRef.current = series;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      chart.applyOptions({ width, height });
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, []); // Create once

  // Update data when new ticks arrive
  useEffect(() => {
    if (seriesRef.current && data.length > 0) {
      const lastCandle = data[data.length - 1];
      seriesRef.current.update(lastCandle);
    }
  }, [data]);

  return <div ref={containerRef} className="w-full h-full" />;
}
```

### Pattern 4: 5-Minute Candle Aggregation

**What:** Aggregate 1-minute price ticks into 5-minute OHLC candles for chart display.
**When to use:** Client-side aggregation from raw price_update WebSocket messages.

```typescript
// Source: [ASSUMED] Standard OHLC aggregation pattern
// client/src/stores/market-store.ts

interface PriceTick {
  teamId: string;
  price: number;
  timestamp: number; // unix seconds
}

interface Candle {
  time: number; // 5-min bucket start (unix)
  open: number;
  high: number;
  low: number;
  close: number;
}

function aggregateToCandles(ticks: PriceTick[]): Candle[] {
  const buckets = new Map<number, PriceTick[]>();

  for (const tick of ticks) {
    const bucket = Math.floor(tick.timestamp / 300) * 300; // 5-min buckets
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket)!.push(tick);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([time, bTicks]) => ({
      time,
      open: bTicks[0].price,
      high: Math.max(...bTicks.map((t) => t.price)),
      low: Math.min(...bTicks.map((t) => t.price)),
      close: bTicks[bTicks.length - 1].price,
    }));
}
```

### Pattern 5: Price Interpolation with Noise

**What:** Interpolate between target prices (from LLM evaluation) with bounded random noise.
**When to use:** Inside the simulation service for each tick calculation.

```python
# Source: [ASSUMED] Standard interpolation + bounded noise pattern
# server/app/services/simulation_service.py

import random
from decimal import Decimal

def interpolate_price(
    current_price: Decimal,
    target_price: Decimal,
    ticks_remaining: int,
    volatility_pct: float = 0.04,  # 4% per D-03
) -> Decimal:
    """Move current_price toward target_price with bounded noise.

    Per D-02: Price trajectory driven by target prices from evaluation.
    Per D-03: 3-5% volatility per tick.
    Per D-05: Phase 4 uses mock target prices (admin-set or default).
    """
    if ticks_remaining <= 0:
        return target_price

    # Linear interpolation step
    step = (target_price - current_price) / Decimal(ticks_remaining)

    # Add bounded noise (normal distribution clamped to volatility band)
    noise_pct = Decimal(str(random.gauss(0, volatility_pct / 2)))
    noise_pct = max(Decimal(str(-volatility_pct)), min(Decimal(str(volatility_pct)), noise_pct))
    noise = current_price * noise_pct

    new_price = current_price + step + noise
    return max(Decimal("0.01"), round(new_price, 2))  # Floor at $0.01
```

### Anti-Patterns to Avoid

- **Querying price history per-team in a loop:** Use a single batch query with window functions to get all teams' latest prices in one query. The N+1 pitfall from PITFALLS.md applies here. [CITED: .planning/research/PITFALLS.md Pitfall 3]
- **Publishing Redis messages inside a DB transaction:** Always publish AFTER `db.commit()`. If the transaction rolls back, the WebSocket message is already sent and clients have stale data. [ASSUMED]
- **Creating lightweight-charts instances on every render:** Use refs and create the chart once in a `useEffect([], ...)`. Use `series.update()` for streaming data, not `series.setData()` on every tick. [VERIFIED: lightweight-charts docs]
- **Holding FOR UPDATE locks while doing I/O:** Lock rows, validate, execute, commit. Do NOT call external services (Redis, HTTP) while holding row locks -- this increases lock duration and deadlock risk. [ASSUMED]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Candlestick chart | Custom canvas/SVG chart | lightweight-charts 5.1 `CandlestickSeries` | OHLC rendering, crosshair, zoom, resize, time axis -- hundreds of edge cases. 35kB. [VERIFIED: lightweight-charts docs] |
| Row-level locking | Application-level mutex or Redis lock | PostgreSQL `SELECT FOR UPDATE` via SQLAlchemy `with_for_update()` | DB-level locking is the only correct solution for ACID compliance on share cap. Redis locks can be lost on crash. [CITED: .planning/research/PITFALLS.md] |
| WebSocket broadcast relay | In-process pub/sub | Redis pub/sub via existing `redis_pubsub.py` | Already built. Celery workers cannot import ConnectionManager (different process). [VERIFIED: server/app/redis_pubsub.py] |
| Real-time chart updates | Full data replacement per tick | `series.update(lastCandle)` | O(1) update vs O(n) setData. Designed for live streaming. [VERIFIED: lightweight-charts docs] |

## Common Pitfalls

### Pitfall 1: Race Condition on 30% Cap

**What goes wrong:** Two concurrent buy orders both read current holdings as under 30%, both pass validation, both execute, total exceeds 30%.
**Why it happens:** No row-level locking between read and write.
**How to avoid:** `SELECT FOR UPDATE` on ALL StockHolding rows for the target team before summing. Lock acquisition is serialized by PostgreSQL. [CITED: .planning/research/PITFALLS.md Pitfall 1]
**Warning signs:** Holdings exceeding 30% in production data, negative cash balances.

### Pitfall 2: Celery asyncio.run() Per Task

**What goes wrong:** Each task invocation creates a new event loop and engine, causing connection pool exhaustion under load.
**Why it happens:** Celery is sync; project needs async DB access.
**How to avoid:** Use `get_worker_session()` which already creates a disposable engine per call. For the price tick (runs every 60s, processes all teams in one call), this is acceptable -- one engine per tick, not one per team. [CITED: .planning/research/PITFALLS.md Pitfall 2, server/app/database.py]
**Warning signs:** Worker memory growth, `TooManyConnectionsError`.

### Pitfall 3: lightweight-charts Memory Leak

**What goes wrong:** Chart instances not properly cleaned up on component unmount or company tab switch, causing memory leaks.
**Why it happens:** `createChart()` allocates a canvas context. If not explicitly removed via `chart.remove()`, the canvas persists.
**How to avoid:** Always call `chart.remove()` in the useEffect cleanup function. When switching companies, update series data rather than destroying/recreating the chart. [VERIFIED: lightweight-charts docs]
**Warning signs:** Browser tab memory growing over time, canvas elements accumulating in DOM.

### Pitfall 4: Stale Candle Data on Reconnect

**What goes wrong:** Client reconnects after WebSocket drop, chart is missing candles from the disconnected period.
**Why it happens:** WebSocket only pushes new ticks. Historical data is only loaded on initial page load.
**How to avoid:** On WebSocket reconnect, fetch price history via REST API to backfill the gap, then resume streaming. The `useWebSocket` hook already handles reconnection -- add a `sync_request` handler that fetches missed data. [ASSUMED]
**Warning signs:** Gaps in candlestick chart, missing candles after network blip.

### Pitfall 5: Decimal Precision in JavaScript

**What goes wrong:** Python `Decimal("142.50")` becomes `142.49999999999997` in JavaScript float, causing display issues and rounding errors in P&L calculations.
**Why it happens:** JSON serializes Decimal as float; JavaScript has IEEE 754 float precision issues.
**How to avoid:** Serialize prices as strings from the API (`"142.50"` not `142.5`), parse with `parseFloat()` only for chart data, and use `toFixed(2)` for all display. For P&L calculations, multiply by 100 to work in cents, then divide for display. [ASSUMED]
**Warning signs:** Prices showing as `$142.4999999`, P&L showing tiny fractions.

## Code Examples

### WebSocket Price Update Message Shape

```typescript
// Source: Existing WebSocket message pattern (server/app/websocket.py)
// Broadcast by Celery tick task via Redis pub/sub

interface PriceUpdateMessage {
  type: "price_update";
  payload: {
    prices: Array<{
      team_id: string;
      ticker: string;
      price: string;        // Decimal as string to avoid float precision
      change_pct: string;    // e.g. "+2.34" or "-1.12"
      market_cap: string;
      timestamp: string;     // ISO 8601
    }>;
  };
}

interface TradeExecutedMessage {
  type: "trade_executed";
  payload: {
    buyer_team_id: string;
    target_ticker: string;
    shares: number;
    price_per_share: string;
    total_value: string;
    transaction_type: "BUY" | "SELL";
  };
}
```

### Trading API Endpoint Structure

```python
# Source: Existing API pattern (server/app/api/admin.py)
# server/app/api/trading.py

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.auth_utils import require_team

router = APIRouter(prefix="/api/v1/trading", tags=["trading"])

class TradeRequest(BaseModel):
    target_team_id: str  # UUID
    shares: int          # positive integer

class TradePreview(BaseModel):
    target_ticker: str
    shares: int
    price_per_share: str
    total_cost: str
    available_cash: str
    shares_available: int  # remaining before 30% cap

class TradeResult(BaseModel):
    transaction_id: str
    message: str
    new_cash_balance: str
    shares_owned: int

@router.post("/preview")
async def preview_trade(
    req: TradeRequest,
    current_user: dict = Depends(require_team),
    db: AsyncSession = Depends(get_db),
) -> TradePreview:
    """Preview trade without executing. No locks needed."""
    ...

@router.post("/buy")
async def buy_shares(
    req: TradeRequest,
    current_user: dict = Depends(require_team),
    db: AsyncSession = Depends(get_db),
) -> TradeResult:
    """Execute buy with atomic 30% cap enforcement."""
    if current_user["role"] != "trader":
        raise HTTPException(403, "Only traders can execute trades")
    ...

@router.post("/sell")
async def sell_shares(
    req: TradeRequest,
    current_user: dict = Depends(require_team),
    db: AsyncSession = Depends(get_db),
) -> TradeResult:
    """Execute sell -- trader must own the shares."""
    ...

@router.get("/portfolio")
async def get_portfolio(
    current_user: dict = Depends(require_team),
    db: AsyncSession = Depends(get_db),
) -> PortfolioResponse:
    """Get current team's holdings, P&L, and net worth."""
    ...
```

### Market Data API Endpoint

```python
# server/app/api/market.py

@router.get("/prices/{team_id}")
async def get_price_history(
    team_id: str,
    current_user: dict = Depends(require_team),
    db: AsyncSession = Depends(get_db),
):
    """Get price history for a team (for chart backfill)."""
    ...

@router.get("/companies")
async def get_all_companies(
    current_user: dict = Depends(require_team),
    db: AsyncSession = Depends(get_db),
):
    """Get all active companies with current prices."""
    ...
```

### Glassmorphism News Overlay CSS

```css
/* Source: DESIGN.md glassmorphism spec */
.news-overlay {
  background: rgba(32, 31, 31, 0.80);  /* surface-container at 80% */
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(64, 71, 82, 0.15);  /* outline-variant at 15% (ghost border) */
  box-shadow: 0 0 40px rgba(33, 150, 243, 0.04);  /* primary-tinted ambient shadow */
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `chart.addCandlestickSeries()` | `chart.addSeries(CandlestickSeries)` | lightweight-charts v5.0 | Series type passed as first argument to `addSeries()` [VERIFIED: Context7] |
| `aioredis` standalone package | `redis.asyncio` from redis-py | redis-py v4.2 | Already using correct approach in codebase [VERIFIED: server/app/redis_pubsub.py] |
| python-jose for JWT | PyJWT | 2024 | Already using PyJWT in codebase [VERIFIED: server/app/auth_utils.py] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 5-minute candle aggregation should be done client-side from raw ticks | Pattern 4 | If done server-side instead, need additional DB table or Redis cache for candle state. Client-side is simpler for 40 teams. |
| A2 | Publishing Redis messages after DB commit is sufficient ordering guarantee | Anti-Patterns | If Redis publish fails after commit, clients miss an update. Low risk -- next tick will correct. |
| A3 | Price interpolation with Gaussian noise clamped to 3-5% band is the right volatility model | Pattern 5 | If user wants a different model (geometric Brownian motion, etc.), the algorithm changes but interface stays same. |
| A4 | Decimal-as-string serialization is needed to avoid float precision issues in JS | Pitfall 5 | If float precision is acceptable for a competition app, simpler to use numbers directly. |
| A5 | On reconnect, backfill chart data via REST API | Pitfall 4 | Could alternatively store last N ticks in Redis and include in WebSocket burst sync. |

## Open Questions

1. **Target price storage model**
   - What we know: D-02 says LLM produces a "price trajectory" stored as target prices, interpolated tick-by-tick. Phase 4 uses mock.
   - What's unclear: Where to store target prices -- new model/table, or a JSON column on Team, or a separate Redis key?
   - Recommendation: Add a `PriceTrajectory` table (team_id, target_price, target_tick, created_at) or store as a JSON array on a new field. Keep it simple for Phase 4 -- a `target_price` and `target_tick` field on Team, updated by admin or mock score.

2. **Admin manual score mechanism for Phase 4**
   - What we know: D-05 says admin can manually set a quality score per team to drive price movement.
   - What's unclear: Is this a new admin UI panel, or just an API endpoint?
   - Recommendation: Add a simple API endpoint `POST /api/v1/admin/teams/{id}/set-score` that sets a mock quality score, which the simulation engine converts to a target price. No new admin UI -- use existing admin panel or curl.

3. **Self-trading prevention**
   - What we know: Teams trade in OTHER teams' companies (TRAD-01, TRAD-02).
   - What's unclear: Is there an explicit check preventing a team from buying their own stock?
   - Recommendation: Add validation `buyer_team_id != target_team_id` in trading service.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio |
| Config file | server/pyproject.toml `[tool.pytest.ini_options]` |
| Quick run command | `cd server && python -m pytest tests/ -x -q` |
| Full suite command | `cd server && python -m pytest tests/ -v` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SIM-01 | Price tick calculates and stores new prices | unit | `pytest tests/test_simulation.py::test_price_tick -x` | Wave 0 |
| SIM-01 | Price tick respects game active guard | unit | `pytest tests/test_game_tick.py -x` | Exists (test_game_tick.py) |
| TRAD-01 | Buy shares at current price | unit | `pytest tests/test_trading.py::test_buy_shares -x` | Wave 0 |
| TRAD-02 | Sell shares owned | unit | `pytest tests/test_trading.py::test_sell_shares -x` | Wave 0 |
| TRAD-03 | 30% cap enforced | unit | `pytest tests/test_trading.py::test_30pct_cap -x` | Wave 0 |
| TRAD-04 | Concurrent trades atomic | unit | `pytest tests/test_trading.py::test_concurrent_cap -x` | Wave 0 |
| TRAD-05 | Portfolio returns holdings + P&L | unit | `pytest tests/test_trading.py::test_portfolio -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd server && python -m pytest tests/ -x -q`
- **Per wave merge:** `cd server && python -m pytest tests/ -v`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `server/tests/test_simulation.py` -- covers SIM-01 (price calculation logic)
- [ ] `server/tests/test_trading.py` -- covers TRAD-01 through TRAD-05 (trading service logic)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (Phase 1) | JWT via PyJWT (already implemented) |
| V3 Session Management | No (Phase 1) | Token-based (already implemented) |
| V4 Access Control | Yes | `require_team` + role check ("trader" for buy/sell) via existing auth_utils.py |
| V5 Input Validation | Yes | Pydantic models for trade requests (shares > 0, valid UUID, etc.) |
| V6 Cryptography | No | No new crypto in this phase |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Trader buys/sells from strategist account | Elevation of Privilege | Role check `current_user["role"] == "trader"` in trading endpoints |
| Team trades own stock | Tampering | Validation `buyer_team_id != target_team_id` |
| Negative shares in trade request | Tampering | Pydantic validation `shares: int = Field(gt=0)` |
| Race condition on 30% cap | Tampering | `SELECT FOR UPDATE` row locking |
| Price manipulation via rapid trades | Denial of Service | Trades at current simulated price only (D-09), no market impact from trades |

## Sources

### Primary (HIGH confidence)
- [Context7 /tradingview/lightweight-charts] - createChart, CandlestickSeries, update() method, chart options
- [server/app/models.py] - Team, StockHolding, Transaction, PriceHistory model definitions
- [server/app/worker/tasks/game_tick.py] - Game tick guard pattern
- [server/app/redis_pubsub.py] - Redis pub/sub broadcast pattern (sync + async)
- [server/app/websocket.py] - ConnectionManager broadcast/team-send
- [server/app/services/game_service.py] - Game state transitions, elapsed timer
- [server/app/auth_utils.py] - JWT auth, require_team, require_admin
- [server/app/database.py] - get_worker_session for Celery tasks
- [assests/stitch_complex_terminal_blue/complex_terminal/DESIGN.md] - Glassmorphism spec, color tokens
- [assests/stitch_complex_terminal_blue/game_trader_view/code.html] - Trader view layout reference
- [assests/stitch_complex_terminal_blue/game_strategist_view/code.html] - Strategist view layout reference

### Secondary (MEDIUM confidence)
- [.planning/research/PITFALLS.md] - Trading race conditions, N+1 queries, Celery async patterns
- [.planning/research/ARCHITECTURE.md] - System architecture diagram, component responsibilities

### Tertiary (LOW confidence)
- None -- all claims verified against codebase or official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed and used in codebase
- Architecture: HIGH - extends existing patterns (Celery tick, Redis pub/sub, WebSocket, SQLAlchemy async)
- Pitfalls: HIGH - race condition and locking patterns well-documented in project research
- Chart integration: HIGH - verified against Context7 lightweight-charts docs
- Price formula: MEDIUM - interpolation algorithm is Claude's discretion per CONTEXT.md

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (stable -- all libraries are established, no fast-moving APIs)
