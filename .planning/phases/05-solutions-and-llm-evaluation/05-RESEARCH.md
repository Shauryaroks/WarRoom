# Phase 5: Solutions and LLM Evaluation - Research

**Researched:** 2026-04-16
**Domain:** LLM-powered evaluation pipeline, solution submission, admin approval flow
**Confidence:** HIGH

## Summary

Phase 5 connects the core simulation loop: teams submit solutions via a Markdown editor, a Celery task calls OpenRouter for LLM evaluation (producing scoring metrics, a price timeline, and a news article), and an admin reviews/edits/approves each evaluation before it impacts the simulation. Additionally, admins assign caseline documents to teams before the game starts, populating company profiles shown in the Caseline tab.

The backend work centers on three new models (Solution, Evaluation, Caseline), a new Celery task for async LLM evaluation using httpx + OpenRouter's structured output API, new API endpoints for submission/approval/caseline-assignment, and integration with the existing simulation engine (writing `target_price`/`ticks_to_target` on approval). The frontend work replaces the placeholder SolutionsPanel with a Markdown editor, fills the empty Evaluations admin page with a functional approval queue, and adds a caseline assignment editor to the admin Teams tab.

**Primary recommendation:** Use OpenRouter's `response_format: { type: "json_schema" }` with a strict schema to guarantee parseable LLM output. Run LLM calls in a dedicated Celery task with an extended time limit (120s) separate from the 60s game tick. Use `react-markdown` for rendering and a plain `<textarea>` for the terminal-style Markdown editor (no heavy WYSIWYG library needed for this aesthetic).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Markdown editor built into the Solutions tab of the game sidebar. No file upload -- teams type directly in the terminal-style editor.
- **D-02:** Initial submission during the 1-hour window is the full strategic roadmap.
- **D-03:** Microtweaks use the same editor, labeled "MICROTWEAK". Content is additive -- appended to the original solution context. 20-minute cooldown between microtweaks.
- **D-04:** Cooldown status tracked server-side and auto-cleared when expired.
- **D-05:** LLM receives full context when evaluating: solution/microtweak, caseline, competitors' actions, current news/events.
- **D-06:** LLM outputs three things: scoring metrics (placeholder), price timeline (3 simulated months), news article.
- **D-07:** OpenRouter API for LLM calls. Model configurable via environment variable.
- **D-08:** One-at-a-time review -- admin opens each evaluation individually.
- **D-09:** On approve: impact queued until the next price tick (60-second cycle).
- **D-10:** On reject: evaluation marked as rejected, team notified to resubmit.
- **D-11:** Approved evaluation's price timeline replaces team's target_price/ticks_to_target. News article publishes to all feeds.
- **D-12:** Admin assigns caseline document (Markdown/text) to each team before game starts.
- **D-13:** Assignment UI in admin Teams tab -- admin pastes/writes caseline in Markdown editor, saves.
- **D-14:** System extracts key fields from caseline (company name, cash, price) or admin fills separately.
- **D-15:** Teams see their caseline in the Caseline tab when game starts.

### Claude's Discretion
- Markdown editor implementation (textarea vs CodeMirror vs other)
- LLM prompt structure details
- Database schema for Solution/Evaluation models
- Frontend state management approach for solutions

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SOLN-01 | Teams submit solutions in Markdown format within initial 1-hour window | Markdown textarea editor, Solution model with submission_type field, time window validation against game elapsed time |
| SOLN-02 | Solutions represent a 3-month strategic roadmap | Content field in Solution model, caseline context provides company profile for roadmap framing |
| SOLN-03 | Teams can submit microtweaks with 20-minute cooldown | Microtweak type on same Solution model, cooldown_until on Team, server-side validation |
| SOLN-04 | Cooldown status tracked and auto-cleared when expired | Team.cooldown_until field already exists, check against UTC now |
| EVAL-01 | LLM evaluates via OpenRouter considering competitors, news, past actions | Celery task builds prompt with all context, calls OpenRouter /v1/chat/completions |
| EVAL-02 | LLM produces quality score and narrative assessment | Structured output schema with scoring_metrics + news_article fields |
| EVAL-03 | Admin reviews LLM evaluation before it takes effect | Evaluation model with PENDING_APPROVAL status, admin endpoint to list/review |
| EVAL-04 | Admin can edit LLM scores and narrative before approving | PUT endpoint for evaluation, admin UI with editable fields |
| EVAL-05 | Only approved evaluations impact simulation | Approval endpoint writes target_price/ticks_to_target to Team, publishes news |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Solution submission | API / Backend | Frontend (form) | Validation (time window, cooldown, game state) must be server-authoritative |
| LLM evaluation | Celery Worker | API (trigger) | Long-running LLM call (~10-30s) must not block the API event loop |
| Admin approval flow | API / Backend | Frontend (UI) | State transitions (PENDING_APPROVAL -> APPROVED/REJECTED) are server-authoritative |
| Price timeline application | Database / Storage | Celery Worker (tick) | Writes to Team.target_price, picked up by existing game_tick task |
| News article publication | API / Backend | Redis pub/sub | Uses existing MarketNews + publish_broadcast pattern |
| Caseline assignment | API / Backend | Frontend (admin UI) | Admin writes caseline doc, server stores and extracts key fields |
| Markdown editing | Browser / Client | -- | Pure client-side editing, submitted as plain text |
| Caseline display | Browser / Client | API (fetch) | Client fetches caseline document, renders as Markdown |

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| httpx | >=0.27.0 | Async HTTP client for OpenRouter API | Already in pyproject.toml, async-native [VERIFIED: pyproject.toml] |
| Celery | >=5.6.3 | Background LLM evaluation task | Already configured with game_tick pattern [VERIFIED: celery_app.py] |
| redis-py | >=5.2.0 | Pub/sub for broadcasting evaluation results | Already used via publish_broadcast [VERIFIED: redis_pubsub.py] |
| SQLAlchemy async | >=2.0.49 | Solution/Evaluation models, async queries | Already in use with AsyncSession [VERIFIED: database.py] |
| Pydantic | >=2.9.0 | Request/response schemas, LLM output validation | Already used for all API models [VERIFIED: admin.py] |
| Zustand | 5.0.12 | Frontend state for solutions/evaluations | Already used for game, auth, admin stores [VERIFIED: package.json] |

### New (to add)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-markdown | 10.1.0 | Render caseline and news articles as Markdown on the client | Caseline tab, news feed items [VERIFIED: npm registry] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain textarea for Markdown editor | @uiw/react-md-editor (4.1.0) | Heavier (150kB+), adds toolbar/preview. But D-01 says "terminal-style editor" -- a styled textarea with monospace font matches the Bloomberg aesthetic better and is far simpler |
| react-markdown | @uiw/react-markdown-preview | More features but heavier. react-markdown at 10.1.0 is lighter and sufficient for rendering caseline documents |
| json_schema response_format | json_object mode | json_schema enforces exact structure, preventing LLM from hallucinating extra fields. Worth the strict mode |

**Installation:**
```bash
# Frontend
cd client && npm install react-markdown@10.1.0

# Backend -- no new packages needed (httpx already present)
```

## Architecture Patterns

### System Architecture Diagram

```
[Strategist Client]
    |
    | POST /api/v1/solutions/submit  (Markdown text)
    v
[FastAPI API Server]
    |
    | 1. Validate: game ACTIVE, time window, cooldown
    | 2. Create Solution record (status=SUBMITTED)
    | 3. Dispatch Celery task
    v
[Celery Worker: evaluate_solution]
    |
    | 1. Load full context (caseline, competitors, news)
    | 2. Build structured prompt
    | 3. POST to OpenRouter /v1/chat/completions
    |    (response_format: json_schema)
    | 4. Parse response -> Evaluation record
    | 5. Set status=PENDING_APPROVAL
    | 6. Notify admin via Redis pub/sub
    v
[Admin Client: Evaluations Tab]
    |
    | GET /api/v1/admin/evaluations (list pending)
    | GET /api/v1/admin/evaluations/{id} (detail)
    | PUT /api/v1/admin/evaluations/{id} (edit scores/narrative)
    | POST /api/v1/admin/evaluations/{id}/approve
    | POST /api/v1/admin/evaluations/{id}/reject
    v
[FastAPI: Approval Handler]
    |
    | On APPROVE:
    | 1. Write target_price + ticks_to_target to Team
    | 2. Create MarketNews from news_article
    | 3. Publish news via Redis pub/sub
    | 4. Update GameState.total_llm_cost
    |
    | On REJECT:
    | 1. Set Evaluation status=REJECTED
    | 2. Notify team via team-specific Redis channel
    v
[Game Tick (existing)]
    |
    | Picks up new target_price on next 60s tick
    | Interpolates price toward target
```

### Recommended Project Structure
```
server/app/
  models.py                    # Add: Solution, Evaluation models
  api/
    solutions.py               # NEW: submit, get-my-solutions, get-caseline
    admin.py                   # EXTEND: caseline assignment, evaluation endpoints
  services/
    llm_service.py             # NEW: OpenRouter client, prompt builder
    evaluation_service.py      # NEW: evaluation lifecycle (submit -> evaluate -> approve)
  worker/tasks/
    evaluate_solution.py       # NEW: Celery task for async LLM evaluation
client/src/
  components/game/
    SolutionsPanel.tsx          # REPLACE: Markdown editor, submission history
    CaselinePanel.tsx           # EXTEND: Show caseline document content
  app/admin/
    evaluations/page.tsx        # FILL: Functional evaluation queue
    teams/page.tsx              # EXTEND: Caseline assignment editor
  stores/
    solutions-store.ts          # NEW: Solution submission state
  lib/
    types.ts                    # EXTEND: Solution, Evaluation types
    api.ts                      # EXTEND: Solution/evaluation API methods
```

### Pattern 1: Celery Task for LLM Evaluation
**What:** Async LLM call in Celery worker, following existing game_tick pattern
**When to use:** Every solution submission triggers this task
**Example:**
```python
# server/app/worker/tasks/evaluate_solution.py
# Source: Existing game_tick.py pattern + OpenRouter docs

import asyncio
import logging
from app.worker.celery_app import celery_app

logger = logging.getLogger(__name__)

@celery_app.task(
    name="solution.evaluate",
    time_limit=120,       # LLM calls can take 30-60s
    soft_time_limit=100,
    max_retries=2,
    default_retry_delay=10,
)
def evaluate_solution(solution_id: str):
    """Evaluate a solution via OpenRouter LLM."""
    asyncio.run(_evaluate(solution_id))

async def _evaluate(solution_id: str):
    from app.database import get_worker_session
    from app.services.llm_service import call_openrouter
    from app.services.evaluation_service import build_prompt, save_evaluation
    from app.redis_pubsub import publish_broadcast_sync

    async with get_worker_session() as db:
        # 1. Load solution + context
        prompt = await build_prompt(db, solution_id)

        # 2. Call OpenRouter
        llm_response = await call_openrouter(prompt)

        # 3. Save evaluation with PENDING_APPROVAL status
        evaluation = await save_evaluation(db, solution_id, llm_response)
        await db.commit()

    # 4. Notify admin (after commit)
    publish_broadcast_sync({
        "type": "evaluation_pending",
        "payload": {"evaluation_id": str(evaluation.id), "team_ticker": evaluation.team_ticker},
    })
```

### Pattern 2: OpenRouter Structured Output Call
**What:** httpx async call to OpenRouter with JSON schema enforcement
**When to use:** Inside the Celery evaluation task
**Example:**
```python
# server/app/services/llm_service.py
# Source: https://openrouter.ai/docs/guides/features/structured-outputs

import httpx
import json
from app.database import settings
from app.models import GameState

EVALUATION_SCHEMA = {
    "name": "evaluation_output",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "scoring_metrics": {
                "type": "object",
                "properties": {
                    "strategic_quality": {"type": "number", "description": "0.0-1.0"},
                    "feasibility": {"type": "number"},
                    "innovation": {"type": "number"},
                    "market_awareness": {"type": "number"},
                    "overall_score": {"type": "number"},
                },
                "required": ["strategic_quality", "feasibility", "innovation", "market_awareness", "overall_score"],
                "additionalProperties": False,
            },
            "price_timeline": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "month": {"type": "integer"},
                        "price_change_pct": {"type": "number"},
                    },
                    "required": ["month", "price_change_pct"],
                    "additionalProperties": False,
                },
                "description": "3-month price trajectory as percentage changes",
            },
            "news_article": {
                "type": "object",
                "properties": {
                    "headline": {"type": "string"},
                    "body": {"type": "string"},
                    "sentiment": {"type": "number", "description": "-1.0 to 1.0"},
                },
                "required": ["headline", "body", "sentiment"],
                "additionalProperties": False,
            },
        },
        "required": ["scoring_metrics", "price_timeline", "news_article"],
        "additionalProperties": False,
    },
}

async def call_openrouter(
    messages: list[dict],
    model: str | None = None,
    max_tokens: int = 2000,
    temperature: float = 0.7,
) -> dict:
    """Call OpenRouter chat completions with structured output."""
    async with httpx.AsyncClient(timeout=90.0) as client:
        response = await client.post(
            f"{settings.OPENROUTER_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://complex-platform.com",
            },
            json={
                "model": model or "nvidia/nemotron-3-super-120b-a12b:free",
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "response_format": {
                    "type": "json_schema",
                    "json_schema": EVALUATION_SCHEMA,
                },
            },
        )
        response.raise_for_status()
        data = response.json()
        content = data["choices"][0]["message"]["content"]
        return json.loads(content)
```

### Pattern 3: Admin Approval -> Simulation Integration
**What:** On approval, write price timeline to Team model and publish news
**When to use:** When admin clicks APPROVE on an evaluation
**Example:**
```python
# Source: Existing set_team_score pattern in simulation_service.py

async def approve_evaluation(db: AsyncSession, evaluation_id: uuid.UUID) -> dict:
    evaluation = await db.get(Evaluation, evaluation_id)
    if not evaluation or evaluation.status != "PENDING_APPROVAL":
        raise ValueError("Evaluation not found or already processed")

    team = await db.get(Team, evaluation.team_id)

    # Convert LLM price timeline to target_price
    # D-06: price_timeline is 3-month projection
    # D-11: replaces team's current target_price/ticks_to_target
    price_changes = evaluation.price_timeline  # JSON array
    final_change_pct = price_changes[-1]["price_change_pct"] / 100
    target_price = round(team.stock_price * Decimal(str(1 + final_change_pct)), 2)

    team.target_price = target_price
    team.ticks_to_target = 20  # 20 ticks = 1 quarter at 1 tick/min

    # Publish news article (D-11)
    news = MarketNews(
        headline=evaluation.news_headline,
        content=evaluation.news_body,
        source_type="LLM_EVALUATION",
        source_team_id=team.id,
        affected_tickers=json.dumps([team.ticker]),
        sentiment_score=evaluation.news_sentiment,
    )
    db.add(news)

    evaluation.status = "APPROVED"
    evaluation.approved_at = utc_now()

    return {"team_id": str(team.id), "target_price": str(target_price)}
```

### Anti-Patterns to Avoid
- **Calling OpenRouter from the API server directly:** LLM calls take 10-60s. This would block the FastAPI event loop and stall all WebSocket connections. Always use Celery.
- **Broadcasting before db.commit():** Existing pattern in game_tick.py shows publishing AFTER commit. Follow this to avoid broadcasting data from a rolled-back transaction.
- **Storing LLM response as unstructured text:** Use structured output schema to guarantee parseable JSON. Validate with Pydantic before saving to DB.
- **Using the 60s task_time_limit for LLM tasks:** The existing celery_app.py has `task_time_limit=60`. LLM tasks need 120s. Set per-task override, not global.
- **Overwriting global Celery time limits:** Define time limits on the task decorator, not in celery_app.conf. The game_tick task should keep its 60s limit.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown rendering | Custom parser | react-markdown 10.1.0 | Edge cases in Markdown parsing (nested lists, code blocks, tables) are endless |
| LLM output parsing | regex extraction | OpenRouter json_schema response_format | Guarantees valid JSON matching your schema, no parsing failures |
| Cooldown tracking | Client-side timers | Server-side Team.cooldown_until check | Client clocks are unreliable, server is authoritative |
| WebSocket notification on eval completion | Polling from frontend | Redis pub/sub (existing pattern) | Already works, publish_broadcast_sync from Celery |
| Retry logic for LLM calls | Custom retry loop | Celery max_retries + default_retry_delay | Built-in exponential backoff, dead letter queue, monitoring |

**Key insight:** The existing codebase already has working patterns for every infrastructure concern (Celery tasks, Redis pub/sub, WebSocket broadcast, async DB). Phase 5's complexity is in the LLM prompt engineering and the evaluation state machine, not in plumbing.

## Common Pitfalls

### Pitfall 1: Celery Task Time Limit Too Short for LLM Calls
**What goes wrong:** The global `task_time_limit=60` in celery_app.py kills LLM evaluation tasks that take >60s.
**Why it happens:** OpenRouter calls to larger models can take 30-60s, especially with long prompts (full context per D-05).
**How to avoid:** Set `time_limit=120` and `soft_time_limit=100` on the evaluate_solution task decorator. Do NOT change the global setting (game_tick needs to stay at 60s).
**Warning signs:** Celery logs showing `TimeLimitExceeded` for evaluation tasks.

### Pitfall 2: LLM Response Parsing Failures
**What goes wrong:** LLM returns malformed JSON despite json_schema mode, crashing the evaluation pipeline.
**Why it happens:** Not all OpenRouter models support structured outputs equally well. Free-tier models may have worse adherence.
**How to avoid:** 1) Validate LLM response with Pydantic before saving. 2) Wrap json.loads in try/except with fallback to FAILED status. 3) Log the raw response for debugging. 4) Consider enabling OpenRouter's Response Healing plugin for non-streaming.
**Warning signs:** Evaluation records stuck in PROCESSING status with no result.

### Pitfall 3: Race Condition Between Multiple Evaluations for Same Team
**What goes wrong:** Two microtweaks submitted in rapid succession create two evaluations, both approved, overwriting each other's target_price.
**Why it happens:** 20-minute cooldown prevents rapid submission but admin might approve an older evaluation after a newer one.
**How to avoid:** On approval, check if a more recent APPROVED evaluation exists for the same team. If so, warn admin. Or simply: when approving, the latest evaluation always wins -- overwrite target_price regardless.
**Warning signs:** Price trajectory jumps erratically because target_price keeps getting overwritten.

### Pitfall 4: Missing OpenRouter API Key in Production
**What goes wrong:** LLM evaluation task fails silently or crashes with 401 from OpenRouter.
**Why it happens:** OPENROUTER_API_KEY is empty string by default in Settings.
**How to avoid:** Validate API key is non-empty before dispatching Celery task. Return clear error to admin/team. Add a health check endpoint that verifies OpenRouter connectivity.
**Warning signs:** All evaluations stuck in PROCESSING/FAILED status.

### Pitfall 5: Celery Worker Cannot Use asyncpg from Forked Process
**What goes wrong:** Connection pool errors when Celery worker tries to use the main engine.
**Why it happens:** asyncpg connections don't survive fork(). The existing `get_worker_session()` already handles this correctly by creating a fresh engine per task.
**How to avoid:** Always use `get_worker_session()` in Celery tasks, never import the global `engine` or `AsyncSessionLocal`. This pattern is already established in game_tick.py.
**Warning signs:** "connection is closed" errors in Celery worker logs.

### Pitfall 6: Strategist Submitting During Wrong Game Phase
**What goes wrong:** Solutions submitted before game starts or after window closes.
**Why it happens:** Frontend might not gate submission correctly, or server validation is missing.
**How to avoid:** Server-side validation chain: 1) Game must be ACTIVE, 2) For initial submission: elapsed_seconds < 3600 (1 hour), 3) For microtweak: cooldown_until is None or in the past, 4) Team must be ACTIVE status.
**Warning signs:** Solutions with timestamps outside the valid window.

## Code Examples

### Database Models for Solution and Evaluation

```python
# Source: Existing Directive model pattern in models.py + D-01 through D-11

class SolutionType(str, enum.Enum):
    INITIAL = "INITIAL"      # Full strategic roadmap (D-02)
    MICROTWEAK = "MICROTWEAK"  # Additive tweak (D-03)

class EvaluationStatus(str, enum.Enum):
    PROCESSING = "PROCESSING"        # LLM call in progress
    PENDING_APPROVAL = "PENDING_APPROVAL"  # Awaiting admin review
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    FAILED = "FAILED"              # LLM call failed

class Solution(Base):
    __tablename__ = "solutions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    solution_type: Mapped[SolutionType] = mapped_column(Enum(SolutionType), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    # Relationships
    team: Mapped["Team"] = relationship("Team")
    evaluation: Mapped[Optional["Evaluation"]] = relationship("Evaluation", back_populates="solution", uselist=False)

class Evaluation(Base):
    __tablename__ = "evaluations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    solution_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("solutions.id"), unique=True, nullable=False)
    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id"), nullable=False)

    status: Mapped[EvaluationStatus] = mapped_column(Enum(EvaluationStatus), default=EvaluationStatus.PROCESSING)

    # LLM output: scoring metrics (D-06)
    scoring_metrics: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON
    overall_score: Mapped[Optional[float]] = mapped_column(nullable=True)

    # LLM output: price timeline (D-06)
    price_timeline: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON array

    # LLM output: news article (D-06)
    news_headline: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    news_body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    news_sentiment: Mapped[Optional[Decimal]] = mapped_column(Numeric(3, 2), nullable=True)

    # LLM call tracking
    llm_model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    llm_latency_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    llm_cost: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 6), nullable=True)
    raw_response: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Debug

    # Approval tracking
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    rejected_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    admin_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    # Relationships
    solution: Mapped["Solution"] = relationship("Solution", back_populates="evaluation")
    team: Mapped["Team"] = relationship("Team")
```

### Caseline Fields on Team Model

```python
# Source: D-12, D-14 -- extend existing Team model

# Add to Team model:
caseline_document: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Full Markdown document (D-12)
company_display_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # Extracted from caseline (D-14)
```

### LLM Prompt Structure

```python
# Source: D-05 context specification + CONTEXT.md specifics

def build_evaluation_prompt(
    solution_content: str,
    caseline: str,
    competitor_summaries: list[dict],
    active_news: list[dict],
    solution_type: str,  # "INITIAL" or "MICROTWEAK"
) -> list[dict]:
    system_prompt = """You are an expert business analyst evaluating strategic solutions for a simulated case competition. Evaluate the solution considering the company's profile, competitive landscape, and market conditions.

Output a JSON object with:
1. scoring_metrics: Rate each dimension 0.0-1.0
2. price_timeline: Project stock price changes over 3 months
3. news_article: Write a market news article about this company's strategy"""

    context_parts = [
        f"[COMPANY PROFILE]\n{caseline}",
        f"[{'STRATEGIC SOLUTION' if solution_type == 'INITIAL' else 'STRATEGY MICROTWEAK'}]\n{solution_content}",
    ]

    if competitor_summaries:
        competitor_text = "\n".join(
            f"- {c['ticker']}: {c['summary']}" for c in competitor_summaries
        )
        context_parts.append(f"[COMPETITOR ACTIONS]\n{competitor_text}")

    if active_news:
        news_text = "\n".join(f"- {n['headline']}" for n in active_news)
        context_parts.append(f"[MARKET NEWS]\n{news_text}")

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": "\n\n".join(context_parts)},
    ]
```

### Frontend: Terminal-Style Markdown Editor

```tsx
// Source: D-01 terminal-style editor, Bloomberg aesthetic from existing components

"use client";
import { useState } from "react";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  label: string;
}

export function MarkdownEditor({ value, onChange, placeholder, disabled, label }: MarkdownEditorProps) {
  return (
    <div className="space-y-2">
      <div className="text-[9px] text-[#89919d] uppercase font-bold tracking-widest">
        {label}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full h-64 bg-[#0e0e0e] text-[#e5e2e1] font-mono text-xs
          p-3 border border-[#2a2a2a] focus:border-[#2196f3] focus:outline-none
          resize-none placeholder:text-[#404752] disabled:opacity-50"
        spellCheck={false}
      />
      <div className="flex justify-between text-[9px] text-[#404752] font-mono">
        <span>MARKDOWN_SUPPORTED</span>
        <span>{value.length} CHARS</span>
      </div>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| python-jose for JWT | PyJWT >=2.9.0 | 2024 | Already using PyJWT [VERIFIED: pyproject.toml] |
| Unstructured LLM text output | json_schema response_format | 2025 | Guarantees parseable output [CITED: openrouter.ai/docs/guides/features/structured-outputs] |
| Separate aioredis package | redis.asyncio (merged) | redis-py 4.2+ | Already using [VERIFIED: admin.py imports] |

**Deprecated/outdated:**
- The existing `Directive` model in models.py has scoring fields (consistency_score, aggression_score, vibe_multiplier, etc.) from a previous design iteration. Phase 5 introduces `Solution` + `Evaluation` as the proper models. The Directive model can remain for backward compatibility but new code should use Solution/Evaluation. [VERIFIED: models.py lines 203-255]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | OpenRouter's json_schema mode works reliably with the default free model (nvidia/nemotron-3-super-120b-a12b:free) | Architecture Patterns | If the free model doesn't support structured output well, evaluations will fail. Mitigation: model is configurable via env var per D-07 |
| A2 | httpx timeout of 90s is sufficient for OpenRouter responses with full context prompts | Code Examples | If responses take longer, tasks will get httpx.ReadTimeout. Mitigation: configurable timeout, Celery retry |
| A3 | react-markdown 10.1.0 works with React 19.2.4 without compatibility issues | Standard Stack | If incompatible, would need to find alternative renderer. Risk is LOW -- react-markdown is widely used |
| A4 | 20 ticks (20 minutes) is the correct interpolation window for a 3-month price timeline | Code Examples | This matches the existing set_team_score pattern. If the game design changes the quarter length, this needs updating |

## Open Questions

1. **Scoring metrics schema finalization**
   - What we know: D-06 says "placeholder fields for now (will be refined later with proper rubrics)"
   - What's unclear: Exact metric names and weights. Current research uses strategic_quality, feasibility, innovation, market_awareness, overall_score
   - Recommendation: Implement with these 5 placeholder metrics. Store as JSON so schema can evolve without migrations

2. **Competitor summary depth for LLM context (D-05)**
   - What we know: LLM should see "other teams' actions (summary of competitor submissions and scores)"
   - What's unclear: How much competitor detail? Full solutions? Just scores? Summaries of summaries?
   - Recommendation: Include each competitor's ticker, latest overall_score, and a 1-line summary (news_headline from their last evaluation). Keeps prompt size manageable for 32-40 teams

3. **Price timeline granularity (D-06)**
   - What we know: "projected stock prices over the next 3 simulated months (reflected in ~1 hour of real time)"
   - What's unclear: Should timeline be 3 data points (one per month) or more granular?
   - Recommendation: 3 data points (month 1, 2, 3 percentage changes). Convert final month's cumulative change to target_price. Simpler for LLM to generate and for simulation engine to consume

4. **What happens to the existing Directive model?**
   - What we know: Directive has LLM scoring fields that overlap with the new Evaluation model
   - What's unclear: Should Directive be deprecated or repurposed?
   - Recommendation: Leave Directive model in place (no migration risk). New code uses Solution/Evaluation exclusively. Can clean up Directive in a future phase

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| OpenRouter API | LLM evaluation | External service | v1 | None -- core requirement |
| OPENROUTER_API_KEY env var | LLM auth | Needs config | -- | Validate at startup, clear error message |
| httpx | OpenRouter client | Yes | >=0.27.0 | -- (already in pyproject.toml) |
| Celery worker | Async evaluation | Yes | >=5.6.3 | -- (already running) |
| Redis | Pub/sub + broker | Yes | 7 | -- (already running) |

**Missing dependencies with no fallback:**
- OPENROUTER_API_KEY must be configured in .env before LLM evaluation can work. Solution submission can work without it (just won't trigger evaluation).

**Missing dependencies with fallback:**
- None

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio |
| Config file | server/pyproject.toml `[tool.pytest.ini_options]` |
| Quick run command | `cd server && uv run pytest tests/ -x -q` |
| Full suite command | `cd server && uv run pytest tests/ -v` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SOLN-01 | Submit solution in Markdown within 1-hour window | unit | `uv run pytest tests/test_solutions.py::test_submit_solution_within_window -x` | Wave 0 |
| SOLN-03 | Microtweak with 20-min cooldown enforcement | unit | `uv run pytest tests/test_solutions.py::test_microtweak_cooldown -x` | Wave 0 |
| SOLN-04 | Cooldown auto-clear on expiry | unit | `uv run pytest tests/test_solutions.py::test_cooldown_expired -x` | Wave 0 |
| EVAL-01 | LLM evaluation builds correct prompt with context | unit | `uv run pytest tests/test_evaluation.py::test_build_prompt -x` | Wave 0 |
| EVAL-02 | LLM response parsed into scoring + news | unit | `uv run pytest tests/test_evaluation.py::test_parse_llm_response -x` | Wave 0 |
| EVAL-03 | Evaluation requires admin approval | unit | `uv run pytest tests/test_evaluation.py::test_pending_approval_status -x` | Wave 0 |
| EVAL-04 | Admin can edit scores before approving | unit | `uv run pytest tests/test_evaluation.py::test_edit_evaluation -x` | Wave 0 |
| EVAL-05 | Approval writes target_price and publishes news | unit | `uv run pytest tests/test_evaluation.py::test_approve_writes_target_price -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd server && uv run pytest tests/ -x -q`
- **Per wave merge:** `cd server && uv run pytest tests/ -v`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/test_solutions.py` -- covers SOLN-01, SOLN-03, SOLN-04
- [ ] `tests/test_evaluation.py` -- covers EVAL-01 through EVAL-05
- [ ] Fixtures for Solution/Evaluation models in `tests/conftest.py`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing require_admin / require_team / get_current_user (PyJWT) |
| V3 Session Management | yes | Existing JWT with expiry |
| V4 Access Control | yes | Strategist-only submission (role check), admin-only approval (require_admin) |
| V5 Input Validation | yes | Pydantic models for all inputs, solution content length limits |
| V6 Cryptography | no | No new crypto -- existing bcrypt/JWT sufficient |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Trader submitting solutions | Elevation of Privilege | role == "strategist" check in submission endpoint |
| Solution content injection (XSS via Markdown) | Tampering | react-markdown sanitizes by default (no raw HTML), server stores as plain text |
| LLM prompt injection via solution content | Tampering | Structured output schema limits damage; admin review gate catches manipulation |
| Submitting outside time window | Tampering | Server-side elapsed time check (game timer is authoritative) |
| Cooldown bypass by rapid requests | Tampering | Server-side cooldown_until check with DB read in transaction |
| Unauthorized evaluation approval | Elevation of Privilege | require_admin dependency on all approval endpoints |
| OpenRouter API key exposure | Information Disclosure | Key in .env (not in code), never sent to frontend |

## Sources

### Primary (HIGH confidence)
- `server/app/models.py` -- Existing Team, Directive, MarketNews model patterns [VERIFIED: codebase]
- `server/app/worker/tasks/game_tick.py` -- Celery task pattern with state guard [VERIFIED: codebase]
- `server/app/services/simulation_service.py` -- set_team_score, interpolate_price, calculate_all_prices [VERIFIED: codebase]
- `server/app/redis_pubsub.py` -- publish_broadcast, publish_to_team, sync variants [VERIFIED: codebase]
- `server/app/database.py` -- get_worker_session for Celery tasks, Settings with OPENROUTER config [VERIFIED: codebase]
- `server/app/auth_utils.py` -- require_admin, require_team, get_current_user [VERIFIED: codebase]
- [OpenRouter Structured Outputs](https://openrouter.ai/docs/guides/features/structured-outputs) -- json_schema response_format [CITED]
- [OpenRouter Chat Completions API](https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request) -- Request format [CITED]

### Secondary (MEDIUM confidence)
- react-markdown 10.1.0 -- npm registry version [VERIFIED: npm view]
- @uiw/react-md-editor 4.1.0 -- npm registry version, considered but not recommended [VERIFIED: npm view]

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use except react-markdown (verified on npm)
- Architecture: HIGH -- follows established codebase patterns (Celery task, Redis pub/sub, async DB)
- Pitfalls: HIGH -- derived from actual codebase constraints (time limits, fork safety, existing patterns)
- LLM integration: MEDIUM -- OpenRouter structured output documented but free model adherence is assumption (A1)

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (stable -- architecture patterns won't change, OpenRouter API is stable)
