# 1. Executive Overview

## 1.1. Product Vision

Complex is a high-intensity, synchronous multiplayer business simulation designed for competitive academic environments. Unlike traditional case competitions that rely on static PowerPoint submissions, this platform operates as a **live, reflexive market** where 50 teams act as publicly traded companies navigating a compressed 6-7 hour economic lifecycle. Teams communicate strategy through natural language directives parsed by an LLM "Board of Directors," while simultaneously managing real-time equity positions in a live stock market.

The platform merges qualitative strategic reasoning with quantitative financial outcomes: success requires not only operational excellence (revenue, profit) but also narrative coherence, market timing, and psychological acumen in interpreting competitor movements through the news wire.

## 1.2. Core Philosophy

**Prose over Parameters**  
Strategy is expressed through Markdown directives (prose), not spreadsheet toggles. Teams must articulate _why_ they are cutting prices or entering new markets, not simply select values from dropdown menus. The LLM evaluates the strategic intent, consistency, and sophistication of the narrative.

**Reflexive Market**  
The market is a mirror, not a backdrop. When Team A announces aggressive expansion, this becomes a news headline that influences the LLM's evaluation of Team B's defensive maneuvers. Every action alters the information environment for all other participants.

**Opaque Evaluation (The Black Box)**  
While stock prices and cash balances are public, the "Strategic Score" that determines elimination is partially opaque. The "Board" (LLM) applies qualitative judgment (Vibe Scores) that modifies financial outcomes. Teams receive narrative feedback ("This strategy seems too AI-generated...") but do not see the underlying algorithmic weights until the conclusion of the event.

**Terminal Aesthetic**  
The interface mimics a Bloomberg terminal: high-density information, monospaced typography, real-time scrolling tickers, and a command-line interface for directive submission. No gamified avatars or cartoonish UI elements.

## 1.3. Event Context

**Format**: Campus-wide competitive seminar  
**Duration**: 6-7 hours (single continuous session)  
**Venue**: Physical seminar hall with projector displays and reliable WiFi infrastructure  
**Capacity**: Exactly 50 teams (1 interface/connection per team)  
**Team Structure**: 1 player per team interface (though teams may huddle behind the screen)

**Operational Reality**:  
The game is orchestrated live by an administrative team with manual override capabilities. Unlike automated tournament systems, eliminations ("Market Purges") are triggered manually by administrators based on game rhythm and energy levels. The final phase transitions from digital gameplay to an analog IRL presentation before a live jury.

## 1.4. Success Metrics & Win Conditions

**Primary Victory Condition**:  
Be among the final surviving teams after successive eliminations (50 → 25 → 12 → 6 → 3 → 1) OR secure the highest Strategic Score at the conclusion of the final elimination phase.

**Secondary Victory (Final Round)**:  
The final 3-4 teams present their overarching strategy in a 10-minute IRL presentation to a panel of judges. This presentation does not alter the game state but serves as the capstone evaluation for the championship title.

**Elimination Criteria**:  
Teams are eliminated based on **Strategic Score**, calculated as:  
`Strategic_Score = (0.5 × Market_Capitalization) + (0.5 × Liquidity_Score)`

_Bankruptcy Override_: If `Cash < $0` at any calculation checkpoint, the team is immediately flagged as Bankrupt and auto-eliminated regardless of their relative ranking.

## 1.5. Glossary of Terms

- **The Board**: The LLM Judge (Claude Sonnet via OpenRouter) that parses directives, assigns Vibe Scores, and generates feedback.
- **Cooldown**: A 10-minute lockout period during which a team cannot submit new strategic directives (begins upon submission receipt).
- **Directive**: A Markdown text submission (max 2,000 characters) containing a team's strategic decisions for the current period.
- **Elimination (Market Purge)**: The manual administrative action of removing the bottom 50% of teams by Strategic Score.
- **Liquidity**: Calculated as `Cash_on_Hand + (Value_of_Stock_Holdings × 0.5)`. Represents deployable financial resources for strategy execution.
- **Market Capitalization**: `Current_Stock_Price × Total_Shares_Outstanding`.
- **Market Wire**: The real-time WebSocket feed of news headlines (global events and team actions).
- **Portfolio**: The pre-assigned SWOT profile and starting financial configuration assigned to a team upon registration approval.
- **Public Float**: Shares available for trading. Starts at 10% of total shares and expands as teams sell their own treasury stock.
- **Stock Ticker**: Unique 3-4 character identifier (e.g., `$BRBE`, `$APEX`) assigned during registration.
- **Strategic Score**: The composite metric (50% Market Cap, 50% Liquidity) used for elimination ranking.
- **SWOT Profile**: Pre-written Strengths, Weaknesses, Opportunities, Threats document provided to the LLM as context for each team.
- **Vibe Scores**: Qualitative LLM assessments (0.0-1.0) of Consistency, Macro Sensitivity, and Aggression that modify financial outcomes.
- **WebSocket Ticker**: The scrolling, real-time price feed visible to all participants.
