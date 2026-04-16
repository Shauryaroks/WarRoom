# Phase 3: Admin Portal - Research

**Researched:** 2026-04-16
**Domain:** Admin dashboard UI (Next.js + FastAPI), real-time data display, news injection
**Confidence:** HIGH

## Summary

Phase 3 builds a complete admin control center with 7 sidebar tabs (Dashboard, Teams, Evaluations, Markets, News, Settings, Activity Log) following the Stitch "Complex Terminal Blue" admin panel design. The existing codebase already provides the foundational infrastructure: admin auth, game state controls, team approve/reject endpoints, WebSocket broadcasting via Redis pub/sub, and the design token system in globals.css. The MarketNews model already exists in the database with fields for headline, content, source_type, affected_tickers, and sentiment_score.

The primary work is: (1) restructuring the admin page from a single-page layout to a multi-tab layout with sidebar navigation, (2) adding new backend endpoints for news injection, team removal (hard/soft), broadcast, and activity log, (3) building out each tab's UI with the Stitch terminal aesthetic, and (4) scaling up all UI elements per D-08 (currently looks right at 133% zoom, needs to work at 100%).

**Primary recommendation:** Use Next.js App Router nested layouts (`/admin/layout.tsx` with sidebar + top nav) and route-based tabs (`/admin/teams/page.tsx`, `/admin/news/page.tsx`, etc.). Create a Zustand `admin-store` for admin-specific state (team list, news history, activity feed). Backend needs 4-5 new endpoints extending the existing `/api/v1/admin/*` pattern.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Full admin portal with top navigation tabs + left icon sidebar (matching Stitch admin panel design).
- **D-02:** 7 sidebar tabs: Dashboard, Teams, Evaluations, Markets, News, Settings, Activity Log.
  - **Dashboard** -- Game controls (start/pause/resume), timer, quarter management, overall status
  - **Teams** -- Approve/reject pending teams, view all teams, remove mid-game
  - **Evaluations** -- Review LLM prompts + responses, approve/edit/reject scores
  - **Markets** -- Stock price overview for all companies, sparklines
  - **News** -- Inject news events, view news history, broadcast messages (same channel as news)
  - **Settings** -- Round timing controls (rounds are admin-controlled, not fixed intervals)
  - **Activity Log** -- Real-time feed of all events (trades, submissions, approvals, state changes)
- **D-03:** Inline table actions -- Approve/Reject/Remove buttons directly in each team row. No modals.
- **D-04:** Remove behavior depends on game state:
  - Before game starts (SETUP): Hard remove -- team fully deleted, all records purged.
  - During active game (ACTIVE/PAUSED): Soft remove -- team marked BANKRUPT/ELIMINATED, read-only access.
- **D-05:** News and broadcast messages are the same channel -- both appear in team news feed.
- **D-06:** News injection form: Headline (text), Body (textarea), Type selector (GLOBAL/LOCAL), If LOCAL: multi-select for affected companies.
- **D-07:** Eval queue: build complete UI with empty state ("No pending evaluations -- submissions will appear here when teams submit solutions"). Approve/edit/reject buttons render but have no backend connection until Phase 5.
- **D-08:** Scale up all UI elements -- larger text, more padding, bigger buttons/inputs. Target looking right at 100% zoom (currently looks right at 133%).

### Claude's Discretion
- Eval queue empty state design (D-07 recommendation accepted)

### Deferred Ideas (OUT OF SCOPE)
- None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ADMN-01 | Live dashboard showing all teams' stock prices, submissions, and scores in real-time | Dashboard tab with team performance table, WebSocket real-time updates, sparkline trend indicators |
| ADMN-02 | Approval queue for LLM evaluations (approve/edit/reject) | Evaluations tab with card-based queue layout (Stitch reference), empty state UI only -- backend wiring in Phase 5 |
| ADMN-03 | Broadcast text messages to all teams | News tab broadcast form, uses existing `publish_broadcast` Redis pub/sub, new POST endpoint |
| ADMN-04 | Inject crisis events mid-game with market pause | News tab with type=GLOBAL/LOCAL injection, new POST endpoint writes to MarketNews table + broadcasts via WebSocket |
| ADMN-05 | Approve or remove teams from the competition | Teams tab with inline actions, existing approve/reject endpoints, new remove endpoint (hard delete or soft bankrupt) |
| NEWS-01 | Admin can inject news events visible to all teams in real-time | News injection form (D-06), MarketNews model already exists, new endpoint + WebSocket broadcast |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Admin layout + sidebar navigation | Browser / Client | -- | Pure UI routing, client-side tab switching via Next.js App Router |
| Team management (approve/reject/remove) | API / Backend | Browser / Client | State mutations must happen server-side with DB transactions; client renders |
| News injection | API / Backend | Browser / Client | News persisted to MarketNews table, broadcast via Redis pub/sub; client has form |
| Broadcast messages | API / Backend | Browser / Client | Messages published through Redis pub/sub relay to all WebSocket clients |
| Real-time dashboard updates | API / Backend | Browser / Client | WebSocket pushes from server; client renders with Zustand store |
| Activity log | API / Backend | Browser / Client | Events queried from DB (or aggregated from WebSocket stream); client auto-scrolls |
| Evaluation queue UI | Browser / Client | -- | UI-only in this phase (D-07), no backend integration until Phase 5 |
| UI scale adjustments | Browser / Client | -- | CSS-only changes to font sizes, padding, element dimensions |
| Markets overview | Browser / Client | API / Backend | Client renders sparklines from data; backend provides team stock price data |
| Settings (round timing) | API / Backend | Browser / Client | Round advancement is server-side mutation; client provides controls |

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.3 | Frontend framework, App Router for nested admin layouts | Already in use [VERIFIED: CLAUDE.md] |
| React | 19.2.4 | UI components | Already in use [VERIFIED: CLAUDE.md] |
| Zustand | 5.0.12 | Admin state management (team list, news, activity) | Already in use for auth-store, game-store [VERIFIED: codebase] |
| Tailwind CSS | 4.2.2 | Styling with Stitch Terminal Blue tokens | Already in use, tokens in globals.css [VERIFIED: codebase] |
| lucide-react | >=1.8.0 | Sidebar icons (replaces Material Symbols from Stitch HTML) | Already in use [VERIFIED: CLAUDE.md] |
| FastAPI | >=0.135.3 | Backend API endpoints | Already in use [VERIFIED: codebase] |
| SQLAlchemy | >=2.0.49 | Async ORM for team/news queries | Already in use [VERIFIED: codebase] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | (installed) | Toast notifications for admin actions | Already in use for admin login [VERIFIED: codebase] |
| Zod | 4.3.6 | Validate news injection form, admin action payloads | Already in use for login schemas [VERIFIED: codebase] |

### No New Dependencies Needed
This phase requires zero new npm or Python packages. All functionality is achievable with the existing stack.

## Architecture Patterns

### System Architecture Diagram

```
[Admin Browser]
    |
    |-- HTTP REST (fetch via api.ts)
    |       |
    |       v
    |   [FastAPI /api/v1/admin/*]
    |       |
    |       |-- GET /teams --> PostgreSQL (Team table)
    |       |-- POST /teams/{id}/remove --> PostgreSQL (delete or set BANKRUPT)
    |       |-- POST /news/inject --> PostgreSQL (MarketNews) + Redis publish
    |       |-- POST /broadcast --> Redis publish (ws:broadcast channel)
    |       |-- GET /activity --> PostgreSQL (aggregate events)
    |       |-- POST /game/advance-round --> PostgreSQL (GameState)
    |       |
    |       v
    |   [PostgreSQL] <-- Source of truth
    |
    |-- WebSocket (ws://host/ws)
            |
            v
        [Redis Pub/Sub Relay]
            |
            v
        [ConnectionManager.broadcast()]
            |
            v
        [Admin Browser] -- Zustand store updates --> UI re-render
```

### Recommended Project Structure
```
client/src/app/admin/
  layout.tsx              # Admin shell: top nav + sidebar + content area
  page.tsx                # Dashboard tab (game controls, team overview)
  teams/page.tsx          # Teams management tab
  evaluations/page.tsx    # Evaluation queue tab (UI only)
  markets/page.tsx        # Markets overview tab
  news/page.tsx           # News injection + history tab
  settings/page.tsx       # Round timing controls tab
  activity/page.tsx       # Real-time activity log tab
  login/page.tsx          # Already exists

client/src/components/admin/
  admin-sidebar.tsx       # Left icon sidebar (80px wide, Stitch pattern)
  admin-topnav.tsx        # Top navigation bar
  team-table.tsx          # Team performance table with inline actions
  eval-card.tsx           # Evaluation card component
  news-form.tsx           # News injection form
  activity-feed.tsx       # Auto-scrolling activity log
  sparkline.tsx           # Mini bar chart for team trends

client/src/stores/
  admin-store.ts          # Admin-specific state (teams, news, activity)

server/app/api/
  admin.py                # Extended with new endpoints
```

### Pattern 1: Admin Layout with Nested Routes
**What:** Use Next.js App Router nested layout for admin shell. `layout.tsx` renders the sidebar + top nav, child routes render in the content area.
**When to use:** Always for multi-tab admin interfaces.
**Example:**
```typescript
// client/src/app/admin/layout.tsx
// Source: Next.js App Router convention [VERIFIED: codebase pattern]
"use client";
import { usePathname } from "next/navigation";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopNav } from "@/components/admin/admin-topnav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Skip layout for login page
  if (pathname === "/admin/login") return <>{children}</>;

  return (
    <div className="bg-[#131313] min-h-screen">
      <AdminTopNav />
      <AdminSidebar activePath={pathname} />
      <main className="pl-20 pt-12 pb-6 min-h-screen">
        <div className="max-w-[1600px] mx-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
```

### Pattern 2: Admin Store for Tab State
**What:** Zustand store for admin-specific state (team list, news history, activity feed).
**When to use:** State shared across admin tabs or updated via WebSocket.
**Example:**
```typescript
// client/src/stores/admin-store.ts
// Source: Existing store patterns in codebase [VERIFIED: auth-store.ts, game-store.ts]
import { create } from "zustand";

interface AdminTeam {
  id: string;
  name: string;
  ticker: string;
  status: string;
  strategist_email: string;
  trader_email: string;
  created_at: string;
}

interface NewsItem {
  id: string;
  headline: string;
  content: string;
  source_type: string;
  affected_tickers: string[];
  created_at: string;
}

interface AdminState {
  teams: AdminTeam[];
  news: NewsItem[];
  activityLog: Record<string, unknown>[];
  setTeams: (teams: AdminTeam[]) => void;
  addNews: (item: NewsItem) => void;
  addActivity: (event: Record<string, unknown>) => void;
}

export const useAdminStore = create<AdminState>()((set) => ({
  teams: [],
  news: [],
  activityLog: [],
  setTeams: (teams) => set({ teams }),
  addNews: (item) => set((s) => ({ news: [item, ...s.news] })),
  addActivity: (event) => set((s) => ({
    activityLog: [event, ...s.activityLog].slice(0, 200),
  })),
}));
```

### Pattern 3: News Injection Backend Endpoint
**What:** POST endpoint that writes to MarketNews table and broadcasts via Redis pub/sub.
**When to use:** Admin injects news or broadcasts messages.
**Example:**
```python
# server/app/api/admin.py -- new endpoint
# Source: Existing endpoint pattern in admin.py [VERIFIED: codebase]
class NewsInjectRequest(BaseModel):
    headline: str
    body: str
    news_type: str  # "GLOBAL" or "LOCAL"
    affected_tickers: list[str] = []

@router.post("/news/inject")
async def inject_news(
    request: NewsInjectRequest,
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    news = MarketNews(
        headline=request.headline,
        content=request.body,
        source_type="ADMIN_INJECTED",
        affected_tickers=json.dumps(request.affected_tickers) if request.affected_tickers else None,
    )
    db.add(news)
    await db.commit()
    await db.refresh(news)

    # Broadcast to all clients via Redis pub/sub
    await publish_broadcast({
        "type": "news_injected",
        "payload": {
            "id": str(news.id),
            "headline": news.headline,
            "content": news.content,
            "source_type": news.source_type,
            "affected_tickers": request.affected_tickers,
            "created_at": news.created_at.isoformat(),
        },
    })
    return {"message": "News injected", "news_id": str(news.id)}
```

### Pattern 4: Team Removal (Hard/Soft)
**What:** Remove endpoint with conditional behavior based on game state.
**When to use:** D-04 -- hard delete in SETUP, soft bankrupt in ACTIVE/PAUSED.
**Example:**
```python
# server/app/api/admin.py -- new endpoint
@router.post("/teams/{team_id}/remove")
async def remove_team(
    team_id: uuid.UUID,
    _admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    team = await db.execute(select(Team).where(Team.id == team_id))
    team = team.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    # Check game state to determine remove type
    game_state = await get_game_state_readonly(db)

    if game_state.status == GameStatus.SETUP:
        # Hard remove: delete team and all related records
        await db.delete(team)
        await db.commit()
        return {"message": f"Team '{team.name}' permanently removed", "type": "hard"}
    else:
        # Soft remove: mark as BANKRUPT
        team.status = TeamStatus.BANKRUPT
        team.bankrupt_since = datetime.now(timezone.utc)
        await db.commit()
        return {"message": f"Team '{team.name}' marked as bankrupt", "type": "soft"}
```

### Anti-Patterns to Avoid
- **Building admin layout without Next.js nested layouts:** Do NOT put all 7 tabs in a single component with conditional rendering. Use App Router file-based routing for each tab -- this gives URL-addressable tabs and proper code splitting. [ASSUMED]
- **Polling for real-time updates:** Do NOT poll REST endpoints for dashboard updates. The WebSocket infrastructure already exists -- use it for real-time team status, activity feed, and news updates. [VERIFIED: codebase has WebSocket + Redis pub/sub relay]
- **Client-side team removal logic:** Do NOT put hard/soft removal decision logic in the frontend. The backend must check game state and decide the removal type. [ASSUMED]
- **Using modals for team actions:** D-03 explicitly forbids this. Use inline table actions only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast notifications | Custom notification system | `sonner` (already installed) | Already used in admin login, consistent UX [VERIFIED: codebase] |
| Form validation | Manual validation logic | Zod schemas (already used) | Pattern established with `adminLoginSchema` [VERIFIED: codebase] |
| Icon set | Custom SVGs or Material Symbols | `lucide-react` (already installed) | Consistent with project conventions, tree-shakeable [VERIFIED: CLAUDE.md] |
| Sparkline charts | Custom SVG/canvas drawing | CSS bar chart pattern from Stitch HTML | The Stitch reference uses simple `div` bars with percentage heights -- no charting library needed for mini trends [VERIFIED: admin_panel/code.html lines 211-219] |
| WebSocket pub/sub | Custom event system | Existing Redis pub/sub relay + ConnectionManager | Already working, just add new message types [VERIFIED: codebase] |

**Key insight:** The Stitch admin panel HTML uses simple CSS bar charts (colored divs with percentage heights) for sparkline trends -- these are NOT real charts. Do not import a charting library for these. Save `lightweight-charts` for the actual candlestick chart in the game view.

## Common Pitfalls

### Pitfall 1: Hard Delete Cascading Failures
**What goes wrong:** Hard-deleting a team in SETUP mode may fail if the team has related records (stock_holdings, transactions, directives, price_history, cash_ledger) due to foreign key constraints.
**Why it happens:** SQLAlchemy relationships don't auto-cascade deletes unless configured.
**How to avoid:** Either configure `cascade="all, delete-orphan"` on Team relationships, or explicitly delete related records first, or use `ON DELETE CASCADE` in the migration. Since this is SETUP mode only, there should be minimal related records, but the code must handle it.
**Warning signs:** `IntegrityError` or `ForeignKeyViolation` on team deletion.

### Pitfall 2: UI Scale at 100% Zoom
**What goes wrong:** The Stitch HTML reference uses very small font sizes (`text-[10px]`, `text-[9px]`, `text-[8px]`) that look right at 133% zoom but are nearly unreadable at 100%.
**Why it happens:** Stitch designs target a specific preview viewport that differs from production.
**How to avoid:** Scale all sizes by approximately 1.33x. `text-[10px]` becomes `text-[13px]` or `text-sm`. `text-[9px]` becomes `text-xs`. `text-[8px]` becomes `text-[11px]`. Padding and gaps should increase proportionally (e.g., `p-6` becomes `p-8`, `gap-6` becomes `gap-8`). Button heights increase from `py-4` to `py-5` or `py-6`.
**Warning signs:** Text that looks like microprint at normal browser zoom.

### Pitfall 3: Sidebar Icon Mismatch
**What goes wrong:** The Stitch HTML uses Material Symbols (`<span class="material-symbols-outlined">terminal</span>`) but the project uses `lucide-react`.
**Why it happens:** Stitch generates with Google Fonts; the project standardized on lucide.
**How to avoid:** Map Material Symbol names to lucide-react equivalents. `terminal` -> `Terminal`, `insights` -> `BarChart3`, `code` -> `Code`, `history` -> `Clock`, `help` -> `HelpCircle`. For the 7 admin tabs: Dashboard -> `LayoutDashboard`, Teams -> `Users`, Evaluations -> `ClipboardCheck`, Markets -> `TrendingUp`, News -> `Newspaper`, Settings -> `Settings`, Activity -> `Activity`.
**Warning signs:** Missing icons or visual inconsistency.

### Pitfall 4: Admin Layout Wrapping Login Page
**What goes wrong:** The admin layout (sidebar + top nav) renders around the login page, making it look wrong.
**Why it happens:** Next.js nested layouts wrap all child routes including `/admin/login`.
**How to avoid:** In `layout.tsx`, check `usePathname()` and conditionally skip the admin shell for the login route (as shown in Pattern 1 example above).
**Warning signs:** Login page has a sidebar.

### Pitfall 5: Broadcast vs News Confusion
**What goes wrong:** Broadcasts and news use separate systems, creating inconsistency for teams.
**Why it happens:** Developer treats them as separate features.
**How to avoid:** Per D-05, broadcasts ARE news items. A broadcast is just a `MarketNews` record with `source_type="ADMIN_BROADCAST"` and `headline` set to the broadcast message. Use the same endpoint or a thin wrapper.
**Warning signs:** Teams see news and broadcasts in different places.

### Pitfall 6: WebSocket Not Filtering Admin-Specific Messages
**What goes wrong:** Activity log messages (internal admin events) leak to team clients.
**Why it happens:** Using `publish_broadcast` for everything sends to ALL connected clients.
**How to avoid:** For admin-only messages (activity log updates), either: (a) send only to WebSocket connections with `role=admin` (requires extending ConnectionManager), or (b) use a separate Redis channel `ws:admin` and filter in the relay, or (c) send to all but have client ignore unknown message types (simplest, acceptable for 80-user app).
**Warning signs:** Teams see admin activity log events in their feed.

## Code Examples

### Sidebar Component (Stitch-adapted)
```typescript
// Source: Adapted from Stitch admin_panel/code.html sidebar [VERIFIED: code.html lines 111-146]
"use client";
import Link from "next/link";
import {
  LayoutDashboard, Users, ClipboardCheck, TrendingUp,
  Newspaper, Settings, Activity, LogOut,
} from "lucide-react";

const tabs = [
  { href: "/admin", icon: LayoutDashboard, label: "DASHBOARD" },
  { href: "/admin/teams", icon: Users, label: "TEAMS" },
  { href: "/admin/evaluations", icon: ClipboardCheck, label: "EVALS" },
  { href: "/admin/markets", icon: TrendingUp, label: "MARKETS" },
  { href: "/admin/news", icon: Newspaper, label: "NEWS" },
  { href: "/admin/settings", icon: Settings, label: "SETTINGS" },
  { href: "/admin/activity", icon: Activity, label: "ACTIVITY" },
];

export function AdminSidebar({ activePath }: { activePath: string }) {
  return (
    <aside className="fixed left-0 top-12 bottom-6 flex flex-col items-center py-6 z-40 bg-[#0e0e0e] w-20">
      <div className="flex flex-col items-center mb-8 gap-1">
        <span className="font-mono text-[10px] text-gray-600 uppercase tracking-tighter">LIVE_SESSION</span>
      </div>
      <nav className="flex flex-col w-full gap-2">
        {tabs.map(({ href, icon: Icon, label }) => {
          const isActive = href === "/admin"
            ? activePath === "/admin"
            : activePath.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`w-full py-4 flex flex-col items-center gap-1.5 transition-all
                ${isActive
                  ? "bg-[#2196f3]/10 text-[#2196f3] border-l-2 border-[#2196f3]"
                  : "text-gray-600 hover:bg-[#2a2a2a]"
                }`}
            >
              <Icon size={20} />
              <span className="font-mono text-[10px] uppercase">{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto">
        <button className="text-gray-600 hover:text-white transition-colors p-2">
          <LogOut size={20} />
        </button>
      </div>
    </aside>
  );
}
```

### Team Table with Inline Actions
```typescript
// Source: Adapted from Stitch TEAM_PERFORMANCE_LEDGER [VERIFIED: code.html lines 183-258]
// Inline actions per D-03, remove behavior per D-04
interface TeamRow {
  id: string;
  name: string;
  ticker: string;
  status: string;
  submissions: number;
}

function TeamTable({ teams, gameStatus, onApprove, onReject, onRemove }: {
  teams: TeamRow[];
  gameStatus: string;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <table className="w-full text-left font-mono">
      <thead>
        <tr className="text-xs text-gray-600 uppercase border-b border-[#2a2a2a]">
          <th className="pb-4 font-medium">TEAM_ID</th>
          <th className="pb-4 font-medium">TICKER</th>
          <th className="pb-4 font-medium">STATUS</th>
          <th className="pb-4 font-medium text-center">SUBMISSIONS</th>
          <th className="pb-4 font-medium text-right">ACTIONS</th>
        </tr>
      </thead>
      <tbody className="text-sm">
        {teams.map((team) => (
          <tr key={team.id} className="hover:bg-[#2a2a2a] transition-colors">
            <td className="py-5 font-bold text-[#e5e2e1]">{team.name}</td>
            <td className="py-5 text-gray-500">{team.ticker}</td>
            <td className="py-5">
              <span className={`font-mono text-xs font-bold px-3 py-1
                ${team.status === "READY" ? "text-[#40e56c] bg-[#40e56c]/10" : ""}
                ${team.status === "PENDING" ? "text-[#9ecaff] bg-[#9ecaff]/10" : ""}
                ${team.status === "BANKRUPT" ? "text-[#FF1744] bg-[#FF1744]/10" : ""}
              `}>{team.status}</span>
            </td>
            <td className="py-5 text-center">{team.submissions}</td>
            <td className="py-5 text-right">
              <div className="flex gap-2 justify-end">
                {team.status === "PENDING" && (
                  <>
                    <button onClick={() => onApprove(team.id)}
                      className="bg-[#02c953] text-[#003912] px-4 py-2 font-mono text-xs font-bold hover:brightness-110">
                      APPROVE
                    </button>
                    <button onClick={() => onReject(team.id)}
                      className="bg-[#FF1744]/80 text-white px-4 py-2 font-mono text-xs font-bold hover:brightness-110">
                      REJECT
                    </button>
                  </>
                )}
                {team.status !== "BANKRUPT" && team.status !== "ELIMINATED" && (
                  <button onClick={() => onRemove(team.id)}
                    className="bg-[#2a2a2a] text-gray-400 px-4 py-2 font-mono text-xs font-bold hover:text-[#FF1744] hover:bg-[#FF1744]/10">
                    {gameStatus === "SETUP" ? "DELETE" : "REMOVE"}
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### News Injection Form
```typescript
// Source: D-06 from CONTEXT.md + Stitch broadcast pattern [VERIFIED: context]
function NewsForm({ teams, onSubmit }: {
  teams: { id: string; ticker: string }[];
  onSubmit: (data: { headline: string; body: string; news_type: string; affected_tickers: string[] }) => void;
}) {
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [newsType, setNewsType] = useState<"GLOBAL" | "LOCAL">("GLOBAL");
  const [selectedTickers, setSelectedTickers] = useState<string[]>([]);

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ headline, body, news_type: newsType, affected_tickers: selectedTickers }); }}>
      <div className="space-y-6">
        <div>
          <label className="font-mono text-xs text-gray-500 uppercase tracking-tighter">HEADLINE</label>
          <input value={headline} onChange={(e) => setHeadline(e.target.value)}
            className="w-full bg-[#0e0e0e] border-l-2 border-[#2196f3] text-sm font-mono p-4 text-[#e5e2e1] mt-2"
            placeholder="BREAKING: ..." />
        </div>
        <div>
          <label className="font-mono text-xs text-gray-500 uppercase tracking-tighter">BODY</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)}
            className="w-full bg-[#0e0e0e] border-l-2 border-[#2196f3] text-sm font-mono p-4 text-[#e5e2e1] h-32 mt-2"
            placeholder="Enter news content..." />
        </div>
        <div className="flex gap-4">
          <button type="button" onClick={() => setNewsType("GLOBAL")}
            className={`px-6 py-3 font-mono text-xs font-bold ${newsType === "GLOBAL" ? "bg-[#2196f3] text-white" : "bg-[#2a2a2a] text-gray-500"}`}>
            GLOBAL
          </button>
          <button type="button" onClick={() => setNewsType("LOCAL")}
            className={`px-6 py-3 font-mono text-xs font-bold ${newsType === "LOCAL" ? "bg-[#2196f3] text-white" : "bg-[#2a2a2a] text-gray-500"}`}>
            LOCAL
          </button>
        </div>
        {newsType === "LOCAL" && (
          <div className="flex flex-wrap gap-2">
            {teams.map((t) => (
              <button key={t.id} type="button"
                onClick={() => setSelectedTickers(prev =>
                  prev.includes(t.ticker) ? prev.filter(x => x !== t.ticker) : [...prev, t.ticker]
                )}
                className={`px-4 py-2 font-mono text-xs ${selectedTickers.includes(t.ticker) ? "bg-[#2196f3]/20 text-[#2196f3] border border-[#2196f3]" : "bg-[#2a2a2a] text-gray-500"}`}>
                {t.ticker}
              </button>
            ))}
          </div>
        )}
        <button type="submit"
          className="bg-[#2196f3] text-white px-8 py-3 font-mono text-xs font-bold uppercase hover:brightness-110">
          INJECT_NEWS
        </button>
      </div>
    </form>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pages Router `/admin/[tab]` | App Router nested layouts | Next.js 13+ (stable) | Each tab is a separate route with shared layout, proper code splitting |
| Redux for admin state | Zustand store | Project convention | Simpler, less boilerplate, already established pattern in codebase |
| Material Symbols (Google) | lucide-react | Project convention | Tree-shakeable, consistent with CLAUDE.md stack |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Next.js App Router nested layouts will work with "use client" layout.tsx and usePathname() for conditional rendering around login | Architecture Patterns | If server component required, would need different pattern for pathname detection |
| A2 | Hard-deleting a team in SETUP requires explicit cascade handling for foreign key relationships | Pitfall 1 | If ON DELETE CASCADE is already in the migration, explicit handling is unnecessary |
| A3 | Activity log can be built from querying existing database tables (transactions, directives, news) rather than needing a dedicated events table | Architecture Patterns | If performance is poor aggregating across tables, may need a dedicated ActivityEvent table |
| A4 | Sending admin activity log events to all WebSocket clients (and ignoring on team clients) is acceptable for an 80-user app | Pitfall 6 | Minor bandwidth waste but no security risk since activity data is non-sensitive at this stage |

## Open Questions

1. **Activity Log data source**
   - What we know: The activity log should show trades, submissions, approvals, state changes.
   - What's unclear: Should this be a dedicated `ActivityEvent` table, or aggregated from existing tables (transactions, directives, market_news, game_state changes)?
   - Recommendation: Start with a dedicated lightweight `ActivityEvent` table (id, event_type, actor, description, metadata_json, created_at). Backend writes to it as a side-effect of admin actions and game events. Simpler to query and paginate than aggregating across 4+ tables. Can be added via Alembic migration.

2. **Round advancement mechanism**
   - What we know: Settings tab has round timing controls. Rounds are admin-controlled per CONTEXT.md.
   - What's unclear: Does advancing a round update `GameState.current_round`? Does it trigger any simulation behavior?
   - Recommendation: In this phase, just provide a "ADVANCE_QUARTER" button that increments `GameState.current_round` and broadcasts the change. Simulation effects belong to Phase 4.

3. **Team removal cascade for related records**
   - What we know: Hard delete in SETUP mode needs to remove team + related records.
   - What's unclear: Which relationships have cascade delete configured in the migration vs. needing explicit cleanup.
   - Recommendation: Check the Alembic migration for ON DELETE CASCADE. If not present, add explicit deletion of stock_holdings, transactions, directives, price_history, cash_ledger before deleting the team.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.x + pytest-asyncio |
| Config file | `server/pyproject.toml` `[tool.pytest.ini_options]` |
| Quick run command | `cd server && uv run pytest tests/ -x --tb=short` |
| Full suite command | `cd server && uv run pytest tests/ -v` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADMN-01 | GET /admin/teams returns all teams with status | unit | `cd server && uv run pytest tests/test_admin.py::test_list_teams -x` | No -- Wave 0 |
| ADMN-02 | Eval queue renders empty state (UI only) | manual-only | Visual verification | N/A |
| ADMN-03 | POST /admin/broadcast publishes to Redis | unit | `cd server && uv run pytest tests/test_admin.py::test_broadcast -x` | No -- Wave 0 |
| ADMN-04 | POST /admin/news/inject creates MarketNews + broadcasts | unit | `cd server && uv run pytest tests/test_admin.py::test_inject_news -x` | No -- Wave 0 |
| ADMN-05 | POST /admin/teams/{id}/remove hard-deletes in SETUP, soft-removes in ACTIVE | unit | `cd server && uv run pytest tests/test_admin.py::test_remove_team -x` | No -- Wave 0 |
| NEWS-01 | News injection visible to clients via WebSocket | integration | `cd server && uv run pytest tests/test_admin.py::test_news_broadcast -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd server && uv run pytest tests/test_admin.py -x --tb=short`
- **Per wave merge:** `cd server && uv run pytest tests/ -v`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `server/tests/test_admin.py` -- covers ADMN-01, ADMN-03, ADMN-04, ADMN-05, NEWS-01
- [ ] `server/tests/conftest.py` -- already exists (shared fixtures)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Existing `require_admin` dependency on all admin endpoints [VERIFIED: codebase] |
| V3 Session Management | Yes | JWT tokens via `create_access_token`, stored in localStorage [VERIFIED: codebase] |
| V4 Access Control | Yes | `require_admin` middleware prevents non-admin access; team removal is admin-only [VERIFIED: codebase] |
| V5 Input Validation | Yes | Pydantic models for all request bodies (news injection, broadcast) [VERIFIED: codebase pattern] |
| V6 Cryptography | No | No new crypto operations in this phase |

### Known Threat Patterns for Admin Portal

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthorized team removal | Elevation of Privilege | `require_admin` dependency on endpoint [VERIFIED: existing pattern] |
| News injection XSS | Tampering | Sanitize headline/body before rendering on client (React auto-escapes JSX) |
| Mass team deletion via API | Denial of Service | Rate limiting on admin endpoints (defer to production hardening) |

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `server/app/api/admin.py`, `server/app/models.py`, `server/app/websocket.py`, `server/app/redis_pubsub.py` -- existing endpoint patterns, data models, broadcast infrastructure
- Codebase inspection: `client/src/app/admin/page.tsx`, `client/src/stores/auth-store.ts`, `client/src/lib/api.ts` -- existing frontend patterns
- Stitch reference: `assests/stitch_complex_terminal_blue/admin_panel/code.html` and `screen.png` -- exact layout, component structure, styling
- Design system: `assests/stitch_complex_terminal_blue/complex_terminal/DESIGN.md` -- Precision Brutalism, tonal layering, No-Line rule
- CLAUDE.md -- Technology stack decisions, version requirements

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions D-01 through D-08 -- user-confirmed decisions constraining implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project, no new dependencies
- Architecture: HIGH -- patterns directly derived from existing codebase + Stitch reference
- Pitfalls: HIGH -- identified from codebase inspection (cascade deletes, scale issues, icon mapping)

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (stable -- no external dependency changes expected)
