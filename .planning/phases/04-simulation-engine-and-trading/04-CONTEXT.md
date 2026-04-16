# Phase 4: Simulation Engine and Trading - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the simulation engine (stock price ticks driven by LLM evaluation results), candlestick charts (lightweight-charts), buy/sell trading with 30% ownership cap and atomic validation, portfolio tracking, and the game view layout for both Strategist and Trader roles with role-based sidebar navigation.

</domain>

<decisions>
## Implementation Decisions

### Price Formula
- **D-01:** Market does NOT start until the first LLM evaluation produces a timeline. Before that, stock prices remain at their initial value set by admin in the caseline. No random walk.
- **D-02:** Stock prices are driven by LLM evaluation results. The LLM evaluates a team's 3-month strategic roadmap and produces a price trajectory. Price ticks every minute follow that trajectory.
- **D-03:** Medium volatility (3-5% per tick). Enough for noticeable swings and trading opportunities without feeling random.
- **D-04:** Microtweaks (submitted every 20 mins) trigger re-evaluation which modifies the future price trajectory. Each 20-min window represents 3 simulated months.
- **D-05:** Since LLM evaluation is Phase 5, Phase 4 builds the simulation engine infrastructure with a pluggable score input. For Phase 4 testing, use a mock/placeholder score (e.g., admin can manually set a quality score per team, or use a default score) to drive price movement. Phase 5 replaces this with real LLM evaluation.

### Trading Mechanics
- **D-06:** Buy/sell with confirmation — select company, enter quantity, see total cost preview, click CONFIRM to execute. One extra step for safety.
- **D-07:** Starting cash is part of the caseline — set per team by admin when creating the company portfolio. Not a fixed amount. Stored in the Team model or associated portfolio data.
- **D-08:** 30% external shareholding cap enforced atomically with SELECT FOR UPDATE row-level locking. Concurrent orders cannot exceed the cap.
- **D-09:** All trades execute at current simulated price (no bid/ask spread, no order book).

### Chart Rendering
- **D-10:** 5-minute candles — each candle aggregates 5 ticks. Smoother, less noisy than 1-minute.
- **D-11:** Company selector tabs above the chart to switch between companies' price histories.
- **D-12:** Price overlay text on chart — current price, change %, high/low. No volume bars.
- **D-13:** Use lightweight-charts 5.1 (already in CLAUDE.md tech stack). Render via refs, not React wrapper.

### Game View Layout
- **D-14:** Game views have a sidebar with role-based tab visibility:
  - **Caseline tab** — accessible to BOTH Strategist and Trader. Shows company story, caseline details, actions taken, timeline.
  - **Trading tab** — TRADER only. Buy/sell panel, portfolio, holdings.
  - **Solutions tab** — STRATEGIST only. Submit solutions, microtweaks (Phase 5 populates this).
  - **News** — NOT a sidebar tab. Instead, a floating overlay window that can be opened from any tab. Glassmorphism style per Stitch DESIGN.md.
- **D-15:** Main content area shows the candlestick chart (center) with the active sidebar tab's content on the left. Chart is always visible regardless of which tab is selected.
- **D-16:** Header bar shows team name, ticker, game timer, current quarter, game status (LIVE/PAUSED), cash balance.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design Reference
- `assests/stitch_complex_terminal_blue/game_strategist_view/code.html` — Stitch strategist game view
- `assests/stitch_complex_terminal_blue/game_trader_view/code.html` — Stitch trader game view
- `assests/stitch_complex_terminal_blue/complex_terminal/DESIGN.md` — Design system (glassmorphism for floating news overlay)

### Project Context
- `.planning/PROJECT.md` — Core value, constraints, game flow
- `.planning/REQUIREMENTS.md` — SIM-01..04, TRAD-01..05, UI-02 requirements
- `.planning/ROADMAP.md` — Phase 4 success criteria

### Prior Phase Output (dependencies)
- `server/app/models.py` — Team, GameState, StockPrice, Transaction models
- `server/app/services/game_service.py` — Game state, timer, Redis cache
- `server/app/worker/celery_app.py` — Celery Beat schedule (add price tick task)
- `server/app/worker/tasks/game_tick.py` — Game tick with is_game_active guard
- `server/app/websocket.py` — ConnectionManager for price broadcasts
- `server/app/redis_pubsub.py` — Redis pub/sub relay
- `server/app/auth_utils.py` — get_current_user, require_role dependencies
- `client/src/app/game/page.tsx` — Current game shell (to be expanded)
- `client/src/hooks/use-websocket.ts` — WebSocket hook for receiving price updates
- `client/src/stores/game-store.ts` — Game state store
- `client/src/stores/auth-store.ts` — Auth store (has role info)

### Research
- `.planning/research/PITFALLS.md` — Trading race conditions, price formula double-counting
- `.planning/research/ARCHITECTURE.md` — Worker-to-WebSocket pattern
- `CLAUDE.md` — lightweight-charts 5.1, Zustand, technology stack

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Celery Beat schedule + game_tick guard pattern — add price_tick task alongside
- WebSocket broadcast — broadcast price updates to all clients
- Redis pub/sub relay — Celery worker publishes price updates, API relays to WebSocket
- Admin store pattern — create market/trading store for game views
- API client pattern — extend for trading endpoints

### Established Patterns
- `with_for_update()` for SQLAlchemy row locking (referenced in pitfalls research)
- WebSocket messages as JSON with `type` field (price_update, trade_executed, etc.)
- Zustand stores without persist for ephemeral game state
- Stitch Terminal Blue design tokens in globals.css

### Integration Points
- Price tick Celery task runs every 60 seconds (respects game state guard)
- Trading API endpoints under `/api/v1/trading/` with team auth
- Game page expands from shell to full multi-panel layout
- Admin Markets tab in Phase 3 shows placeholder sparklines — Phase 4 populates with real data

</code_context>

<specifics>
## Specific Ideas

- The chart should be the visual centerpiece — large, prominent, always visible
- News floating overlay should use the glassmorphism effect from DESIGN.md (surface-container at 80% opacity, 20px backdrop-blur)
- Portfolio section should show: Company | Shares | Avg Buy Price | Current Price | P&L | % Ownership
- Trading confirmation should show: "BUY 100 shares of APEX at $142.50 = $14,250.00" before CONFIRM
- Price trajectory from LLM evaluation should be stored as a series of target prices, and the simulation engine interpolates between them tick-by-tick

</specifics>

<deferred>
## Deferred Ideas

- Solutions submission UI (Phase 5 — the Solutions tab will be a placeholder in Phase 4)
- LLM evaluation integration (Phase 5 — Phase 4 uses mock/manual scores)
- News feed content (Phase 6 — LLM-generated news)

</deferred>

---

*Phase: 04-simulation-engine-and-trading*
*Context gathered: 2026-04-16*
