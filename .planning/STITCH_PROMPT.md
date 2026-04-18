# Stitch MCP Design Prompt — Complex

## Project Overview

Design the UI for **Complex**, a real-time case competition platform where 32-40 teams compete by solving business caselines, trading stocks in each other's companies, and navigating crisis events. The UI should be heavily inspired by **Bloomberg Terminal** — dark theme, dense data, monospace accents, amber/green/red accent colors on a near-black background.

## Design System

**Theme:** Bloomberg Terminal-inspired

- **Background:** Near-black (#0A0A0A to #1A1A1A)
- **Surface:** Dark gray (#1E1E1E to #2A2A2A)
- **Borders:** Subtle gray (#333333)
- **Primary text:** White (#E0E0E0)
- **Secondary text:** Gray (#888888)
- **Accent colors:**
  - Amber (#FF9500) — primary actions, highlights, active states
  - Green (#00C853) — positive values, stock up, success
  - Red (#FF1744) — negative values, stock down, errors, alerts
  - Blue (#2196F3) — informational, links, secondary actions
- **Font:** Monospace for numbers/data (JetBrains Mono or similar), sans-serif for UI labels (Inter)
- **Density:** High information density — minimize whitespace, maximize data on screen

## Pages to Design

### 1. Auth Pages (`/auth/register` and `/auth/login`)

**Register page:**

- Team name field
- Ticker symbol field (3-5 uppercase letters, like NYSE tickers)
- Email field
- Password field
- "Register Team" button
- Link to login page
- Bloomberg-style minimal branding — logo at top, dark background, single centered card

**Login page:**

- Email field
- Password field
- Role selector: "Strategist" or "Trader" (toggle or radio — each sub-account logs in separately)
- "Login" button
- Link to register page
- Same minimal Bloomberg aesthetic

### 2. Lobby Page (`/lobby`)

- Team name and ticker displayed prominently
- Status: "Waiting for admin to start the game..."
- List of approved teams (team name + ticker) — shows who's in
- Pulsing/animated indicator showing "connected" status
- When game starts, auto-redirect to game page
- Clean, sparse — this is a waiting room

### 3. Game Page — Strategist View (`/game` with strategist role)

This is the primary terminal view. **Dense, Bloomberg-style multi-panel layout.**

**Header bar:**

- Team name + ticker
- Game timer (server-authoritative, shows elapsed time and current simulated quarter e.g. "Q2 2024")
- Game status indicator (LIVE / PAUSED / CRISIS)
- Cash balance

**Left panel — Strategy & Solutions:**

- Directive/solution editor (markdown textarea or rich text)
- "Submit Solution" / "Submit Microtweak" button
- Cooldown timer (shows remaining cooldown if active)
- Submission history (list of past submissions with timestamps)
- LLM evaluation results for past submissions (score + narrative, when approved by admin)

**Center panel — Market Overview:**

- **VIEW ONLY for Strategist** — clearly labeled "VIEW ONLY"
- Candlestick chart (primary, large) — own company's stock price
- Mini sparkline charts for other companies
- Current stock price with change indicator (green up / red down)

**Right panel — News Feed:**

- Scrollable news feed with timestamps
- News tagged by type: [GLOBAL], [LOCAL], [CRISIS]
- Auto-scrolls to latest
- Crisis events highlighted with red banner

**Bottom bar:**

- Portfolio summary (own stock value + investments in others)
- Leaderboard position
- Connection status indicator

### 4. Game Page — Trader View (`/game` with trader role)

Same Bloomberg multi-panel layout but different panel emphasis:

**Header bar:** Same as strategist

**Left panel — Trading:**

- Company selector dropdown (list of all active companies with current prices)
- Buy/Sell toggle
- Shares quantity input
- Current price display
- "Execute Trade" button
- Holdings table: Company | Shares | Avg Price | Current Price | P&L | % Ownership
- Total portfolio value

**Center panel — Market Charts:**

- **FULL ACCESS for Trader**
- Large candlestick chart — selected company
- Company selector tabs along top
- Volume indicators if relevant
- Price change percentages

**Right panel — News Feed:**

- Same as strategist view
- News is critical for trading decisions

**Bottom bar:**

- Cash balance prominently displayed
- Recent trades history (last 5-10 trades)
- Leaderboard

### 5. Admin Panel (`/admin`)

**NOT Bloomberg-styled** — cleaner, more functional admin UI (still dark theme but less dense).

**Top navigation:**

- Dashboard | Teams | Game Control | Evaluations | News | Crisis

**Dashboard tab:**

- All teams table: Team | Ticker | Stock Price | Change | Submissions | Score | Status
- Real-time updating values
- Mini chart sparklines per team
- Overall market health indicators

**Teams tab:**

- Pending approvals section (approve/reject buttons)
- Active teams list with option to remove/eliminate
- Team details on click

**Game Control tab:**

- Start / Pause / Resume buttons (large, obvious)
- Game timer display
- Current phase/quarter indicator
- Broadcast message input + send button

**Evaluations tab:**

- Queue of pending LLM evaluations
- Each item shows: Team | Submission excerpt | LLM Score | LLM Narrative
- "Approve" / "Edit" / "Reject" buttons per item
- Edit mode: inline editing of score and narrative
- Approved/rejected history

**News tab:**

- Inject news form: headline + body + type (Global/Local)
- News history (what's been sent)
- LLM-generated news toggle/preview

**Crisis tab:**

- Crisis event creator: scenario description + response time limit
- "Inject Crisis" button (with confirmation — this pauses the market)
- Crisis history

## Key Design Principles

1. **Information density over whitespace** — Bloomberg users want MORE data, not less
2. **Numbers are king** — stock prices, percentages, scores should be large and color-coded
3. **Real-time feel** — subtle animations on data updates (flash green/red on price change)
4. **Role clarity** — Strategist and Trader views must be obviously different (different left panels)
5. **Status always visible** — game state, connection status, timer always in the header
6. **Monospace for data** — all numbers, prices, tickers in monospace font
7. **No decorative elements** — no illustrations, no gradients, no rounded corners on data panels. Functional density.

## What NOT to Design

- Mobile layouts (desktop only, two devices per team)
- Chat or messaging between teams
- Order book / bid-ask interface
- User settings/preferences page
- Landing/marketing page
- Spectator mode
