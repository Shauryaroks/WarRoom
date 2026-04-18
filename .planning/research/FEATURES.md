# Feature Research

**Domain:** Real-time case competition platform with stock market simulation
**Researched:** 2026-04-16
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature                                    | Why Expected                                                                                              | Complexity | Notes                                                                                                |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------- |
| Team registration + admin approval         | Every competition platform has gated registration; StockTrak, Capsim, Devpost all require it              | LOW        | Simple CRUD + approval flag. Email/password sufficient for physical event                            |
| Role-based access (Strategist vs Trader)   | Core design constraint — enforces division of labor that makes the competition interesting                | MEDIUM     | Two sub-accounts per team, different UI views/permissions per role                                   |
| Lobby / waiting room                       | Teams need a staging area before game starts; standard in multiplayer games and hackathon platforms       | LOW        | WebSocket-driven state, admin triggers transition                                                    |
| Game state management (start/pause/resume) | Admin must control the flow; Capsim and BSG both have round-based admin controls                          | MEDIUM     | State machine with WebSocket broadcast to all clients                                                |
| Real-time stock price chart                | StockTrak, Wall Street Survivor, How The Market Works all center on live price visualization              | HIGH       | Candlestick/line chart updating every minute via WebSocket. This is the primary visual feedback loop |
| Simple buy/sell trading                    | Every stock sim has this; StockTrak supports market orders as baseline                                    | MEDIUM     | Order validation (30% cap, balance check), atomic DB transactions                                    |
| Portfolio view with P&L                    | StockTrak and every trading sim shows holdings, cost basis, current value, gains/losses                   | MEDIUM     | Calculated from trade history + current prices                                                       |
| Solution/caseline submission               | Core mechanic — teams submit strategic plans. Analogous to hackathon project submission                   | MEDIUM     | File upload (Word/Markdown) or rich text editor with deadline enforcement                            |
| Leaderboard / rankings                     | Universal across competition platforms — StockTrak, Capsim, hackathon platforms all have them             | LOW        | Composite score from stock price + solution quality, sorted, broadcast via WebSocket                 |
| Admin dashboard with live overview         | Hackathon platforms (Devpost, TAIKAI, Onova) all provide admin visibility into teams, scores, submissions | HIGH       | Real-time view of all 32-40 teams' stock prices, submission status, scores                           |
| News feed                                  | Financial simulations show market-moving news; Bloomberg Terminal's news panel is a core feature          | MEDIUM     | Scrolling feed of LLM-generated + admin-injected news items with timestamps                          |
| Timer / round clock                        | Participants need to see how much time remains; every timed competition has this                          | LOW        | Server-authoritative timer broadcast to all clients, showing real-time and simulated time            |
| Elimination announcements                  | Teams need to know who's been eliminated; standard tournament mechanic                                    | LOW        | Admin triggers elimination, broadcast notification, eliminated teams get read-only access            |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature                                                 | Value Proposition                                                                                                                                           | Complexity | Notes                                                                                                                                                                                   |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LLM-powered solution evaluation                         | No competitor does AI scoring of business strategy submissions with rubric-based assessment. Capsim uses formula-based scoring. This is the core innovation | HIGH       | Use structured rubric prompts (research shows rubric-based LLM grading outperforms raw prompts). Multi-dimensional scoring: feasibility, creativity, market awareness, financial impact |
| Human-in-the-loop validation of LLM scores              | Prevents LLM hallucination from ruining the competition. Admin sees LLM's reasoning + score, can adjust before it takes effect                              | MEDIUM     | Async approval queue in admin dashboard. LLM generates score + rationale, admin approves/edits/rejects                                                                                  |
| Crisis event injection with market pause                | No stock sim has admin-triggered crises that pause trading and force strategic pivots. Creates dramatic moments                                             | HIGH       | Admin creates crisis scenario, system pauses market, teams get time-boxed response window, LLM evaluates crisis responses, market resumes with adjusted prices                          |
| LLM-generated contextual news                           | News that reflects actual team actions and market conditions, not just random events. Creates narrative coherence                                           | HIGH       | LLM ingests game state (team actions, price movements, crisis events) and generates plausible business news. Admin can also inject manual news                                          |
| Bloomberg Terminal-style UI                             | Distinctive visual identity — dark theme, dense information layout, multi-panel design. No education sim looks like this                                    | MEDIUM     | Dark theme, monospace accents, data-dense panels, tabbed layout. Bloomberg's design philosophy: conceal complexity behind clean panels                                                  |
| Microtweak submissions during simulation                | Teams can adjust strategy mid-round without full resubmission. Creates dynamic gameplay                                                                     | MEDIUM     | Lightweight submission form for incremental strategy changes, LLM evaluates impact on next tick cycle                                                                                   |
| Stock price = f(simulation formula + LLM quality score) | Unique pricing model where stock price reflects both random walk market dynamics AND quality of business decisions. No competitor does this                 | HIGH       | Random walk base provides organic movement; LLM evaluation adjusts direction/magnitude. Must feel natural, not jumpy                                                                    |
| Two-device-per-team concurrent play                     | Strategist and Trader work simultaneously on different screens. Creates coordination pressure between teammates                                             | LOW        | Different frontend routes/views gated by role. WebSocket keeps both in sync                                                                                                             |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature                                      | Why Requested                            | Why Problematic                                                                                                                                                       | Alternative                                                                                                  |
| -------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Order book / bid-ask trading                 | "More realistic" stock market simulation | Massively increases complexity. With 32-40 companies and simulated prices, there aren't enough participants to create liquid order books. Price discovery would break | Simple buy/sell at simulation-determined price. The simulation IS the market maker                           |
| Real-time chat between teams                 | "Communication enhances collaboration"   | Teams are physically co-located. Chat adds distraction, moderation burden, and potential for collusion/harassment                                                     | Teams talk face-to-face. Admin broadcasts are one-way                                                        |
| Mobile app                                   | "Accessibility"                          | Teams have two devices each at a physical event. Mobile adds a whole platform to maintain for zero benefit                                                            | Responsive web works on tablets if needed, but optimize for desktop                                          |
| Manual stock price override by admin         | "Admin should control everything"        | Undermines trust in the simulation. If admin can manually set prices, teams will suspect manipulation                                                                 | Admin influences prices indirectly through crisis events and news injection. The formula + LLM drives prices |
| OAuth / social login                         | "Convenience"                            | Adds third-party dependency for a closed competition environment. Teams register once                                                                                 | Email/password with admin approval. Simple, no external auth providers needed                                |
| Full strategy resubmission during simulation | "Let teams completely pivot"             | Destroys the value of initial strategic planning. Makes early submission meaningless                                                                                  | Microtweaks only during simulation. Full resubmission only at round boundaries (crisis events)               |
| Automated elimination (no admin review)      | "Saves admin time"                       | Eliminates human judgment. Edge cases (technical issues, scoring bugs) need admin discretion before removing a team                                                   | Admin reviews elimination candidates, confirms manually. System recommends but doesn't auto-eliminate        |
| Replay / playback system                     | "Review past rounds"                     | Significant storage and engineering effort for a live event that runs once. Build it if you run competitions regularly                                                | Export final results/charts as static reports post-game                                                      |
| Per-trade transaction fees / commissions     | "More realistic"                         | Adds unnecessary complexity to a simulation focused on strategy, not trading mechanics                                                                                | Free trades. The 30% ownership cap is sufficient constraint                                                  |

## Feature Dependencies

```
[Team Registration + Auth]
    └──requires──> [Role System (Strategist/Trader)]
                       └──requires──> [Permission-gated UI views]

[Game State Machine (start/pause/resume)]
    └──requires──> [Lobby System]
    └──requires──> [Timer/Round Clock]
    └──enables──> [Simulation Engine]

[Simulation Engine (price ticks)]
    └──requires──> [Stock Price Formula (random walk)]
    └──requires──> [Game State Machine]
    └──enhances──> [LLM Quality Score adjustment]

[Solution Submission]
    └──requires──> [Caseline/Company Assignment]
    └──enables──> [LLM Evaluation]
                       └──enables──> [Human-in-the-Loop Validation]
                                         └──enables──> [Stock Price Adjustment]

[News System]
    └──requires──> [Game State Machine]
    └──enhanced-by──> [LLM News Generation]
    └──enhanced-by──> [Admin News Injection]

[Crisis Events]
    └──requires──> [Game State Machine (pause capability)]
    └──requires──> [News System (to announce crisis)]
    └──requires──> [Solution Submission (crisis response)]
    └──requires──> [LLM Evaluation (to score crisis responses)]

[Trading System]
    └──requires──> [Stock Price Chart (to see prices)]
    └──requires──> [Portfolio tracking]
    └──requires──> [Simulation Engine (prices must be ticking)]

[Elimination]
    └──requires──> [Leaderboard/Scoring]
    └──requires──> [Admin Dashboard (to confirm)]
    └──requires──> [Game State Machine (round boundaries)]

[Admin Dashboard]
    └──requires──> [WebSocket infrastructure]
    └──requires──> [All team/game data accessible]
```

### Dependency Notes

- **Crisis Events require almost everything else:** They need game state pausing, news announcements, solution submission for crisis responses, and LLM evaluation. Build crisis events last.
- **LLM Evaluation requires Solution Submission:** Cannot score what doesn't exist. Submission system must be solid before LLM integration.
- **Trading requires Simulation Engine:** Prices must be ticking before trading makes sense. Simulation engine is a prerequisite.
- **Stock Price Adjustment requires Human-in-the-Loop:** LLM scores don't affect prices until admin approves. This async flow must work before prices can reflect solution quality.
- **Leaderboard requires both Trading and LLM scoring:** Composite score combines market performance and solution quality.

## MVP Definition

### Launch With (v1)

Minimum viable product -- what's needed to run a single competition event.

- [ ] Team registration with admin approval -- gates access to competition
- [ ] Role system (Strategist + Trader) with permission-gated views -- core design constraint
- [ ] Lobby with admin game start trigger -- staging area before competition begins
- [ ] Game state machine (start, pause, resume, end) -- admin controls the flow
- [ ] Caseline assignment and solution submission -- teams need to submit strategies
- [ ] LLM evaluation with structured rubric -- the core innovation, cannot defer
- [ ] Human-in-the-loop admin approval of scores -- prevents LLM errors from ruining competition
- [ ] Simulation engine with 1-minute price ticks (random walk + LLM adjustment) -- the market must run
- [ ] Real-time stock price chart (candlestick) -- primary visual feedback
- [ ] Simple buy/sell trading with 30% cap validation -- teams invest in each other
- [ ] Portfolio view with holdings and P&L -- teams track their investments
- [ ] News feed (admin-injectable) -- market context for trading decisions
- [ ] Timer showing real-time and simulated time -- temporal awareness
- [ ] Leaderboard with composite scoring -- competitive ranking
- [ ] Admin dashboard with live team overview -- admin situational awareness
- [ ] Elimination flow (admin-confirmed) -- progressive narrowing of field
- [ ] Bloomberg Terminal-inspired dark theme UI -- visual identity, do this from day one or never

### Add After Validation (v1.x)

Features to add once core loop is validated in a test run.

- [ ] LLM-generated contextual news -- requires tuning prompts against real game state data
- [ ] Microtweak submissions during simulation -- adds strategic depth but not essential for first event
- [ ] Crisis event injection with market pause -- high complexity, test the base game first
- [ ] Admin broadcast messages to all teams -- nice but teams are co-located, can announce verbally
- [ ] Detailed scoring breakdown visible to teams -- transparency into how LLM scored them

### Future Consideration (v2+)

Features to defer until after running at least one competition.

- [ ] Historical game replay / post-mortem analytics -- useful for multi-event operation
- [ ] Template caselines library -- reusable scenarios across competitions
- [ ] Multi-game management (run multiple competitions) -- only if this becomes a recurring product
- [ ] Spectator mode for audience viewing -- if competitions become public-facing events

## Feature Prioritization Matrix

| Feature                            | User Value | Implementation Cost | Priority |
| ---------------------------------- | ---------- | ------------------- | -------- |
| Team registration + auth + roles   | HIGH       | LOW                 | P1       |
| Lobby + game state machine         | HIGH       | MEDIUM              | P1       |
| Solution submission                | HIGH       | MEDIUM              | P1       |
| LLM evaluation + human-in-the-loop | HIGH       | HIGH                | P1       |
| Simulation engine (price ticks)    | HIGH       | HIGH                | P1       |
| Real-time stock chart              | HIGH       | HIGH                | P1       |
| Buy/sell trading + portfolio       | HIGH       | MEDIUM              | P1       |
| News feed (admin-injected)         | HIGH       | LOW                 | P1       |
| Leaderboard                        | HIGH       | LOW                 | P1       |
| Admin dashboard                    | HIGH       | HIGH                | P1       |
| Timer / round clock                | MEDIUM     | LOW                 | P1       |
| Elimination flow                   | MEDIUM     | LOW                 | P1       |
| Bloomberg UI theme                 | MEDIUM     | MEDIUM              | P1       |
| LLM-generated news                 | MEDIUM     | HIGH                | P2       |
| Microtweak submissions             | MEDIUM     | MEDIUM              | P2       |
| Crisis events                      | HIGH       | HIGH                | P2       |
| Admin broadcast messages           | LOW        | LOW                 | P2       |
| Scoring breakdown for teams        | MEDIUM     | LOW                 | P2       |
| Game replay / analytics            | LOW        | HIGH                | P3       |
| Caseline template library          | LOW        | MEDIUM              | P3       |
| Spectator mode                     | LOW        | MEDIUM              | P3       |

**Priority key:**

- P1: Must have for launch -- the competition cannot run without these
- P2: Should have, add after first successful test run
- P3: Nice to have, future consideration for recurring events

## Competitor Feature Analysis

| Feature           | StockTrak                                        | Capsim/BSG                                     | Hackathon Platforms (Devpost, TAIKAI) | Complex (Our Approach)                                                                  |
| ----------------- | ------------------------------------------------ | ---------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------- |
| Trading           | Full order types, 50 exchanges, real market data | No trading -- business decisions only          | N/A                                   | Simple buy/sell at simulated price. Intentionally simplified                            |
| Evaluation        | N/A -- no strategy submission                    | Formula-based scoring across financial metrics | Human judges with scoring rubrics     | LLM evaluation with human-in-the-loop. Unique hybrid                                    |
| Real-time prices  | 15-min delayed real market data                  | Round-based (annual results after each round)  | N/A                                   | 1-minute simulated ticks. Faster feedback than any competitor                           |
| News / events     | Real market news feed                            | Simulated industry reports between rounds      | N/A                                   | LLM-generated + admin-injected. Dynamic and contextual                                  |
| Crisis management | N/A                                              | N/A                                            | N/A                                   | Admin-triggered crisis events with market pause. No competitor has this                 |
| Team structure    | Individual accounts                              | Teams manage one company                       | Teams submit projects                 | Two sub-accounts per team with role separation. More structured than competitors        |
| Elimination       | Contest ends at deadline, ranked                 | All companies survive all rounds               | Some have elimination rounds          | Progressive elimination after each round. Creates stakes                                |
| UI aesthetic      | Standard fintech dashboard                       | Corporate/academic interface                   | Modern web app                        | Bloomberg Terminal-inspired. Distinctive and immersive                                  |
| Admin control     | Instructor sets parameters upfront               | Instructor configures before start             | Organizer manages timeline            | Real-time admin intervention during gameplay. More dynamic                              |
| AI integration    | None                                             | None                                           | Some have AI-assisted judging         | LLM evaluates strategies, generates news, adjusts stock prices. AI is deeply integrated |

## Sources

- [StockTrak](https://www.stocktrak.com/) -- stock market simulation platform for education
- [Capsim](https://www.capsim.com/) -- business simulation for universities
- [The Business Strategy Game](https://www.bsg-online.com/) -- multiplayer business strategy simulation
- [Bloomberg Terminal UX](https://www.bloomberg.com/company/stories/how-bloomberg-terminal-ux-designers-conceal-complexity/) -- UI design philosophy
- [Devpost Hackathon Features](https://info.devpost.com/blog/key-hackathon-platform-features) -- competition platform features
- [TAIKAI](https://taikai.network/) -- hackathon management platform
- [HackerEarth Hackathon Platforms 2026](https://www.hackerearth.com/blog/hackathon-platforms) -- platform comparison
- [LLM-Rubric Research](https://arxiv.org/html/2501.00274v1) -- rubric-based LLM evaluation methods
- [AutoSCORE](https://arxiv.org/html/2509.21910v1) -- multi-agent LLM scoring framework
- [Simformer](https://simformer.com/) -- business simulation with crisis management

---

_Feature research for: Real-time case competition platform with stock market simulation_
_Researched: 2026-04-16_
