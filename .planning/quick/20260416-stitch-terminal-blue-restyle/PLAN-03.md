---
plan: 03
type: execute
wave: 2
depends_on: [01]
files_modified:
  - client/src/app/admin/page.tsx
  - client/src/app/lobby/page.tsx
  - client/src/app/game/page.tsx
  - client/src/components/lobby/team-list.tsx
  - client/src/components/lobby/connection-indicator.tsx
autonomous: true
---

<objective>
Restyle the admin game controls, lobby, and game shell pages to match their Stitch HTML reference designs while preserving all existing functionality (WebSocket hooks, Zustand store integration, API calls, auth guards, router navigation).

Purpose: These are the core operational pages -- admin controls the game, teams wait in the lobby, and the game shell frames the trading experience.
Output: Three restyled pages + two restyled lobby components matching Stitch terminal aesthetic.
</objective>

<context>
@assests/stitch_complex_terminal_blue/admin_panel/code.html (admin reference)
@assests/stitch_complex_terminal_blue/lobby/code.html (lobby reference)
@assests/stitch_complex_terminal_blue/game_strategist_view/code.html (game shell reference)
@client/src/app/admin/page.tsx (current admin)
@client/src/app/lobby/page.tsx (current lobby)
@client/src/app/game/page.tsx (current game)
@client/src/components/lobby/team-list.tsx
@client/src/components/lobby/connection-indicator.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Restyle admin page to Stitch GAME_CONTROL_STATION design</name>
  <files>client/src/app/admin/page.tsx</files>
  <action>
Read client/src/app/admin/page.tsx first.

Rewrite the JSX layout to match the Stitch admin panel reference. Keep ALL existing state management (isLoading, error), handleStart/handlePause/handleResume functions, useEffect redirects, WebSocket hook, Zustand store integration, formatElapsed, and all imports EXACTLY as they are. Only change the return() JSX.

New layout (matching Stitch admin_panel/code.html -- simplified for current functionality):

1. **Outer**: `bg-[#131313] min-h-screen flex flex-col pt-12 pb-6`

2. **Top header** (fixed):
   ```tsx
   <header className="flex justify-between items-center w-full px-4 h-12 bg-[#0e0e0e] fixed top-0 z-50">
     <div className="flex items-center gap-6">
       <span className="text-xl font-black tracking-tighter text-[#2196f3]">COMPLEX</span>
       <span className="font-sans uppercase tracking-widest text-[0.75rem] font-bold text-[#2196f3] border-b-2 border-[#2196f3] pb-1">ADMIN</span>
     </div>
     <div className="flex items-center gap-2">
       <span className="font-mono text-[9px] text-gray-600">TIME: {new Date().toLocaleTimeString('en-US', { hour12: false })} UTC</span>
       <span className="w-1.5 h-1.5 bg-[#40e56c]" />
     </div>
   </header>
   ```

3. **Main content**: `max-w-[1200px] mx-auto p-6 grid grid-cols-12 gap-6 w-full`

4. **Game Control Station** (col-span-12 lg:col-span-5, bg-[#1c1b1b] p-6, flex flex-col gap-6):
   - Header row:
     ```tsx
     <div className="flex justify-between items-center">
       <h2 className="text-sm font-black font-mono tracking-widest text-[#9ecaff] uppercase">GAME_CONTROL_STATION</h2>
       <span className="flex items-center gap-2 font-mono text-[10px] text-[#40e56c]">
         <span className="w-2 h-2 bg-[#40e56c] animate-pulse" /> SYSTEM_LIVE
       </span>
     </div>
     ```
   - **Control buttons** (grid grid-cols-3 gap-2):
     ```tsx
     <button
       onClick={handleStart}
       disabled={isLoading || status !== "SETUP"}
       className="bg-[#02c953] text-[#003912] py-4 flex flex-col items-center justify-center gap-1 hover:brightness-110 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
     >
       <span className="text-xl">&#9654;</span>
       <span className="font-mono text-[10px] font-bold">START</span>
     </button>
     <button
       onClick={handlePause}
       disabled={isLoading || status !== "ACTIVE"}
       className="bg-[#2a2a2a] text-[#e5e2e1] py-4 flex flex-col items-center justify-center gap-1 hover:brightness-125 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
     >
       <span className="text-xl">&#9646;&#9646;</span>
       <span className="font-mono text-[10px] font-bold">PAUSE</span>
     </button>
     <button
       onClick={handleResume}
       disabled={isLoading || status !== "PAUSED"}
       className="bg-[#2a2a2a] text-[#e5e2e1] py-4 flex flex-col items-center justify-center gap-1 hover:brightness-125 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
     >
       <span className="text-xl">&#8635;</span>
       <span className="font-mono text-[10px] font-bold">RESUME</span>
     </button>
     ```

   - **Broadcast input** (below controls):
     ```tsx
     <div className="flex flex-col gap-2">
       <label className="font-mono text-[10px] text-gray-500 uppercase tracking-tighter">GLOBAL_BROADCAST_CHANNEL</label>
       <div className="relative">
         <textarea
           className="w-full bg-[#0e0e0e] border-l-2 border-[#2196f3] text-sm font-mono p-4 text-[#2196f3] h-24 placeholder:text-gray-800 focus:outline-none focus:ring-0"
           placeholder="ENTER MESSAGE TO ALL TEAMS..."
           disabled
         />
         <span className="absolute bottom-4 right-4 font-mono text-[9px] text-gray-600 uppercase">COMING_SOON</span>
       </div>
     </div>
     ```

5. **Status + Timer panel** (col-span-12 lg:col-span-7, bg-[#1c1b1b] p-6):
   - Header: `<h2 className="text-sm font-black font-mono tracking-widest text-[#9ecaff] uppercase mb-6">GAME_STATE_MONITOR</h2>`
   - Status badge row:
     ```tsx
     <div className="flex items-center justify-between mb-6">
       <span className="font-mono text-[10px] text-gray-500 uppercase tracking-widest">STATUS</span>
       <div className={`font-mono text-xs font-bold px-3 py-1 ${statusStyles}`}>
         {status}
       </div>
     </div>
     ```
     Where statusStyles uses the Stitch palette:
     ```tsx
     const statusStyles =
       status === "ACTIVE"
         ? "text-[#40e56c] bg-[#40e56c]/10 border border-[#40e56c]/30"
         : status === "PAUSED"
           ? "text-[#9ecaff] bg-[#9ecaff]/10 border border-[#9ecaff]/30"
           : status === "FINISHED"
             ? "text-[#FF1744] bg-[#FF1744]/10 border border-[#FF1744]/30"
             : "text-[#89919d] bg-[#89919d]/10 border border-[#89919d]/30";
     ```

   - Timer display (large):
     ```tsx
     <div className="text-center py-8">
       <div className="font-mono text-[10px] text-gray-500 uppercase tracking-widest mb-2">ELAPSED_TIME</div>
       <div className="font-mono text-6xl font-black text-[#e5e2e1] tabular-nums">{formatElapsed(elapsedSeconds)}</div>
     </div>
     ```

   - Quarter display:
     ```tsx
     <div className="flex items-center justify-between border-t border-[#404752] pt-4">
       <span className="font-mono text-[10px] text-gray-500 uppercase tracking-widest">CURRENT_QUARTER</span>
       <span className="font-mono text-2xl font-bold text-[#e5e2e1]">Q{currentRound}</span>
     </div>
     ```

6. **Error display** (below grid, full width):
   ```tsx
   {error && (
     <div className="col-span-12 border border-[#FF1744]/30 bg-[#FF1744]/10 px-4 py-3">
       <p className="font-mono text-xs text-[#FF1744]">{error}</p>
     </div>
   )}
   ```

Keep all existing function definitions, state, useEffect hooks, WebSocket integration, and auth guards. Only the return JSX changes.
  </action>
  <verify>Run `cd /home/shaurya/Projects/complex/client && npx next build 2>&1 | tail -5`. Grep for "handleStart\|handlePause\|handleResume\|useWebSocket" in admin/page.tsx to confirm all control logic preserved.</verify>
  <done>Admin page has Stitch GAME_CONTROL_STATION layout: START/PAUSE/RESUME buttons in grid, broadcast input placeholder, large timer display, quarter indicator, status badge. All game control API calls, WebSocket, auth guards preserved.</done>
</task>

<task type="auto">
  <name>Task 2: Restyle lobby page and components to Stitch terminal design</name>
  <files>client/src/app/lobby/page.tsx, client/src/components/lobby/team-list.tsx, client/src/components/lobby/connection-indicator.tsx</files>
  <action>
Read these files first:
- client/src/app/lobby/page.tsx
- client/src/components/lobby/team-list.tsx
- client/src/components/lobby/connection-indicator.tsx

**lobby/page.tsx** -- Rewrite JSX to match Stitch lobby reference. Keep ALL existing state, useEffect hooks (auth redirect, team loading, WebSocket message handler), handleLogout, imports EXACTLY as they are. Only change the return() JSX.

New layout:

1. **Outer**: `bg-[#131313] min-h-screen flex flex-col`

2. **Top header** (fixed):
   ```tsx
   <header className="flex justify-between items-center w-full px-4 h-12 bg-[#0e0e0e] fixed top-0 z-50">
     <div className="flex items-center gap-6">
       <span className="text-xl font-black tracking-tighter text-[#2196f3]">COMPLEX</span>
     </div>
     <div className="flex items-center gap-4">
       <span className="font-mono text-[10px] text-[#bfc7d4] uppercase">{teamName}</span>
       <span className="font-mono text-[10px] text-[#2196f3] font-bold">{ticker}</span>
       <button onClick={handleLogout} className="font-mono text-[10px] text-gray-600 hover:text-white uppercase transition-colors">LOGOUT</button>
     </div>
   </header>
   ```

3. **Main content**: `mt-12 mb-6 p-6 grid grid-cols-12 gap-6`

4. **Hero section** (col-span-12 lg:col-span-8, bg-[#1c1b1b] p-8 relative overflow-hidden border-l-4 border-[#2196f3]):
   ```tsx
   <div className="relative z-10 flex flex-col justify-between h-full min-h-[280px]">
     <div>
       <div className="flex items-center gap-3 mb-2">
         <div className="w-3 h-3 bg-[#2196f3] animate-pulse" />
         <span className="font-mono text-xs tracking-tighter text-[#2196f3]">SYSTEM_STATUS: LIVE_CONNECTION_ESTABLISHED</span>
       </div>
       <h2 className="text-4xl lg:text-7xl font-black tracking-tighter mb-4 text-white uppercase italic">COMPLEX</h2>
       <div className="inline-block bg-[#2196f3] px-4 py-1 mb-8">
         <span className="font-mono text-2xl font-bold tracking-widest text-white">TICKER: {ticker}</span>
       </div>
     </div>
     <div className="mt-auto">
       <p className="text-[#bfc7d4] font-medium tracking-tight mb-2">LOBBY STATUS</p>
       <div className="flex items-baseline gap-4">
         <span className="text-2xl font-bold tracking-tight text-white uppercase">Waiting for admin to start the game...</span>
         <span className="font-mono text-[#2196f3] animate-pulse">_</span>
       </div>
     </div>
   </div>
   ```

5. **Stats cards** (col-span-12 lg:col-span-4, grid grid-rows-2 gap-6):
   - Total Approved Teams card:
     ```tsx
     <div className="bg-[#201f1f] p-6 flex flex-col justify-center border-t border-[#404752]">
       <span className="text-xs uppercase tracking-widest text-[#bfc7d4] mb-1 font-bold">Total Approved Teams</span>
       <span className="font-mono text-6xl font-black text-[#2196f3]">{teams.length}</span>
       <div className="mt-4 flex items-center gap-2">
         <span className="text-[10px] font-mono text-[#40e56c] uppercase">All nodes validated</span>
       </div>
     </div>
     ```
   - Network Latency card:
     ```tsx
     <div className="bg-[#201f1f] p-6 flex flex-col justify-center border-t border-[#404752]">
       <span className="text-xs uppercase tracking-widest text-[#bfc7d4] mb-1 font-bold">Network Latency</span>
       <span className="font-mono text-6xl font-black text-[#e5e2e1]">14<span className="text-xl">MS</span></span>
       <div className="mt-4 flex items-center gap-2">
         <ConnectionIndicator isConnected={isConnected} />
       </div>
     </div>
     ```

6. **Team Roster table** (col-span-12, bg-[#0e0e0e] border border-[#404752] overflow-hidden):
   ```tsx
   <section className="col-span-12 bg-[#0e0e0e] border border-[#404752] overflow-hidden flex flex-col">
     <div className="px-6 py-3 bg-[#2a2a2a] flex justify-between items-center border-b border-[#404752]">
       <span className="text-xs font-bold uppercase tracking-widest text-white">Verified Competition Roster</span>
       <span className="font-mono text-[10px] text-[#2196f3] uppercase">FILTER: ALL_TEAMS</span>
     </div>
     <TeamList teams={teams} currentTicker={ticker} />
   </section>
   ```

**team-list.tsx** -- Update to render as a table matching Stitch roster:

Accept a new optional prop `currentTicker?: string | null`.

Render as:
```tsx
<div className="overflow-y-auto max-h-64">
  <table className="w-full text-left border-collapse">
    <thead className="sticky top-0 bg-[#1c1b1b] text-[10px] uppercase font-bold text-[#bfc7d4] font-mono border-b border-[#404752]">
      <tr>
        <th className="py-3 px-6">Rank</th>
        <th className="py-3 px-6">Team Entity Name</th>
        <th className="py-3 px-6">Ticker ID</th>
        <th className="py-3 px-6">Auth Status</th>
      </tr>
    </thead>
    <tbody className="font-mono text-xs">
      {teams.map((team, i) => {
        const isCurrentTeam = currentTicker && team.ticker === currentTicker;
        return (
          <tr
            key={team.id}
            className={isCurrentTeam
              ? "bg-[#2196f3]/5 hover:bg-[#2196f3]/10 transition-colors border-l-2 border-[#2196f3]"
              : "hover:bg-[#2a2a2a] transition-colors"
            }
          >
            <td className="py-3 px-6 text-[#bfc7d4]">{String(i + 1).padStart(3, '0')}</td>
            <td className="py-3 px-6 font-bold text-white uppercase">{team.name}</td>
            <td className="py-3 px-6">
              <span className={`px-2 py-0.5 ${isCurrentTeam ? 'bg-[#2196f3] text-white' : 'bg-[#2a2a2a] text-[#2196f3]'}`}>
                {team.ticker}
              </span>
            </td>
            <td className="py-3 px-6 text-[#40e56c]">APPROVED</td>
          </tr>
        );
      })}
    </tbody>
  </table>
</div>
```

If teams array is empty, show: `<div className="p-6 text-center font-mono text-xs text-gray-600 uppercase">NO_TEAMS_REGISTERED</div>`

Keep the existing component props interface, just add the optional `currentTicker`.

**connection-indicator.tsx** -- Simplify to inline Stitch style:

Render as:
```tsx
<div className="flex items-center gap-2">
  <span className={`w-2 h-2 ${isConnected ? 'bg-[#40e56c]' : 'bg-[#FF1744]'}`} />
  <span className={`text-[10px] font-mono uppercase ${isConnected ? 'text-[#40e56c]' : 'text-[#FF1744]'}`}>
    {isConnected ? 'Connection stable' : 'Disconnected'}
  </span>
</div>
```

Keep the same props interface.
  </action>
  <verify>Run `cd /home/shaurya/Projects/complex/client && npx next build 2>&1 | tail -5`. Grep for "useWebSocket\|handleMessage\|api.getApprovedTeams" in lobby/page.tsx to confirm all lobby logic preserved.</verify>
  <done>Lobby page has Stitch terminal layout: COMPLEX hero with ticker badge, team count and latency stats cards, full-width verified competition roster table with current team highlighted. WebSocket, auth guards, team loading, game_started redirect all preserved.</done>
</task>

<task type="auto">
  <name>Task 3: Restyle game shell page to Stitch terminal layout</name>
  <files>client/src/app/game/page.tsx</files>
  <action>
Read client/src/app/game/page.tsx first.

Rewrite the JSX layout to match the Stitch game view shell. This is a SHELL only -- the full trading interface comes in later phases. Keep ALL existing state, useEffect hooks (auth redirect, SETUP redirect), WebSocket handler, formatElapsed, imports EXACTLY as they are. Only change the return() JSX.

New layout (based on Stitch strategist_view/code.html header and structure):

1. **Outer**: `bg-[#131313] min-h-screen flex flex-col`

2. **Pause overlay** (keep existing, just restyle):
   ```tsx
   {status === "PAUSED" && (
     <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
       <div className="border border-[#9ecaff]/30 bg-[#131313] px-8 py-6 text-center">
         <div className="font-mono text-2xl font-bold text-[#9ecaff]">GAME PAUSED</div>
         <p className="mt-2 text-sm text-[#89919d]">Waiting for admin to resume...</p>
       </div>
     </div>
   )}
   ```

3. **Top header** (matching Stitch strategist header, h-12, bg-[#0e0e0e]):
   ```tsx
   <header className="flex justify-between items-center w-full px-4 h-12 bg-[#0e0e0e] border-b border-[#2a2a2a] z-50">
     <div className="flex items-center gap-6">
       <span className="text-xl font-black tracking-tighter text-[#2196f3]">COMPLEX</span>
       <div className="flex items-center gap-4 border-l border-[#2a2a2a] pl-6">
         <div className="flex flex-col">
           <span className="text-[10px] text-[#89919d] uppercase font-bold tracking-widest">TEAM</span>
           <span className="font-mono text-xs font-bold text-[#9ecaff]">{teamName}</span>
         </div>
         <div className="flex flex-col">
           <span className="text-[10px] text-[#89919d] uppercase font-bold tracking-widest">TICKER</span>
           <span className="font-mono text-xs font-bold text-[#e5e2e1]">${ticker}</span>
         </div>
       </div>
     </div>
     <div className="flex items-center gap-8">
       <div className="flex items-center gap-3 bg-[#1c1b1b] px-3 py-1 border border-[#404752]/20">
         <span className="relative flex h-2 w-2">
           <span className="animate-ping absolute inline-flex h-full w-full bg-[#2196f3] opacity-75" />
           <span className="relative inline-flex h-2 w-2 bg-[#2196f3]" />
         </span>
         <span className="font-mono text-xs font-bold text-[#2196f3]">LIVE // Q{currentRound}</span>
       </div>
       <div className="flex flex-col items-end">
         <span className="text-[10px] text-[#89919d] uppercase font-bold tracking-widest">ELAPSED</span>
         <span className="font-mono text-sm font-bold text-[#e5e2e1] tabular-nums">{formatElapsed(elapsedSeconds)}</span>
       </div>
       <div className={`font-mono text-xs font-bold px-3 py-1 ${statusStyles}`}>
         {status}
       </div>
     </div>
   </header>
   ```

   Where statusStyles:
   ```tsx
   const statusStyles =
     status === "ACTIVE"
       ? "text-[#40e56c] bg-[#40e56c]/10 border border-[#40e56c]/30"
       : status === "PAUSED"
         ? "text-[#9ecaff] bg-[#9ecaff]/10 border border-[#9ecaff]/30"
         : "text-[#FF1744] bg-[#FF1744]/10 border border-[#FF1744]/30";
   ```

4. **Main content placeholder** (same as current but restyled):
   ```tsx
   <main className="flex-1 flex items-center justify-center">
     <div className="text-center space-y-4">
       <div className="font-mono text-xs text-[#89919d] uppercase tracking-widest">AWAITING_MODULE_LOAD</div>
       <p className="font-mono text-sm text-[#404752]">
         Trading interface will be deployed in Phase 3
       </p>
       <div className="flex justify-center gap-8 mt-8">
         <div className="bg-[#1c1b1b] p-4 border-l-2 border-[#2196f3]">
           <div className="font-mono text-[9px] text-[#89919d] uppercase">MODULE</div>
           <div className="font-mono text-xs text-[#2196f3]">STRATEGY_EDITOR</div>
         </div>
         <div className="bg-[#1c1b1b] p-4 border-l-2 border-[#404752]">
           <div className="font-mono text-[9px] text-[#89919d] uppercase">MODULE</div>
           <div className="font-mono text-xs text-[#404752]">MARKET_CHARTS</div>
         </div>
         <div className="bg-[#1c1b1b] p-4 border-l-2 border-[#404752]">
           <div className="font-mono text-[9px] text-[#89919d] uppercase">MODULE</div>
           <div className="font-mono text-xs text-[#404752]">INTEL_STREAM</div>
         </div>
       </div>
     </div>
   </main>
   ```

Keep all existing function definitions, state, useEffect hooks, WebSocket integration, and auth guards. Only the return JSX changes.
  </action>
  <verify>Run `cd /home/shaurya/Projects/complex/client && npx next build 2>&1 | tail -5`. Grep for "useWebSocket\|useGameStore\|useAuthStore" in game/page.tsx to confirm all game logic preserved.</verify>
  <done>Game page has Stitch terminal header with team/ticker info, LIVE indicator with quarter, elapsed timer, status badge. Placeholder modules hint at Phase 3 content. Pause overlay restyled with blue accent. All game state, WebSocket, auth guards preserved.</done>
</task>

</tasks>

<verification>
- `cd client && npx next build` completes without errors
- Admin page: START/PAUSE/RESUME buttons visible with correct disable states, timer and quarter display
- Lobby page: Hero with COMPLEX branding and ticker, team count card, latency card, roster table
- Game page: Terminal header with team info, live indicator, timer, status badge
- All WebSocket hooks connected and processing messages
- All auth guards redirecting correctly
- All API calls preserved (getApprovedTeams, startGame, pauseGame, resumeGame, getGameState)
</verification>

<success_criteria>
- Admin page: GAME_CONTROL_STATION with 3-button grid, broadcast placeholder, large timer, status monitor
- Lobby page: COMPLEX hero with animated pulse indicator, team count + latency stats, full roster table with current team highlighted
- Game page: Terminal shell header matching Stitch strategist view, module placeholders for Phase 3
- Team list renders as Stitch-styled table with rank/name/ticker/status columns
- Connection indicator uses green/red square dots (not rounded)
- Zero functional regressions across all three pages
</success_criteria>
