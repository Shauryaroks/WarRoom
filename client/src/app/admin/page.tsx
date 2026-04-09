'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminPage() {
  const { login } = useAuth();
  const [activeTab, setActiveTab] = useState('teams');
  const [filter, setFilter] = useState('all');

  // Auth check commented out for now

  const mockTeams = [
    { name: 'BARBIE INC', ticker: '$BARB', status: 'ACTIVE', liquidity: '$124.5M', mktCap: '$540.0M', lastDirective: 'EXPAND_MARKET_SHARE_EMEA...' },
    { name: 'STARK_INDUSTRIES', ticker: '$STRK', status: 'PENDING', liquidity: '$0.00', mktCap: '$0.00', lastDirective: 'N/A' },
    { name: 'WAYNE_CORP', ticker: '$WAYN', status: 'COOLDOWN', liquidity: '$89.2M', mktCap: '$210.0M', lastDirective: 'RESTRUCTURING_V4...' },
    { name: 'ACME_CO', ticker: '$ACME', status: 'ELIMINATED', liquidity: '$0.0M', mktCap: '$0.0M', lastDirective: 'LIQUIDATED_SYSTEM' },
  ];

  const getStatusBadge = (status: string) => {
    const styles = {
      ACTIVE: 'text-[#00c853] border border-[#00c853]/30 bg-[#00c853]/10',
      PENDING: 'text-zinc-400 border border-white/10 bg-white/5',
      COOLDOWN: 'text-[#FFB000] border border-[#FFB000]/30 bg-[#FFB000]/10',
      ELIMINATED: 'text-[#ff3333] border border-[#ff3333]/30 bg-[#ff3333]/10',
      BANKRUPT: 'text-[#ff3333] border border-[#ff3333]/30 bg-[#ff3333]/10',
    };
    return styles[status as keyof typeof styles] || styles.PENDING;
  };

  return (
    <>
      {/* Top Navigation Shell */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-[#0a0a0a] border-b border-white/5">
        <div className="flex items-center gap-8">
          <span className="text-xl font-bold tracking-tighter text-[#FFB000] font-mono">COMPLEX: ADMIN_CONSOLE</span>
          <nav className="hidden md:flex gap-1 text-[11px] items-center">
            <a className="px-3 py-1 bg-white/5 border border-white/10 text-white" href="#">REGISTER</a>
            <span className="text-zinc-700">|</span>
            <a className="px-3 py-1 text-zinc-500 hover:text-white" href="#">AUDIT</a>
            <span className="text-zinc-700">|</span>
            <a className="px-3 py-1 text-zinc-500 hover:text-white" href="#">LIQUIDATE</a>
            <span className="text-zinc-700">|</span>
            <a className="px-3 py-1 text-zinc-500 hover:text-white" href="#">PURGE</a>
          </nav>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-zinc-500">SERVER_TIME: --:--:-- UTC</span>
            <span className="text-[10px] text-[#FFB000]">EVENT_ID: CAMPUS_2026_Q2</span>
          </div>
          <div className="flex gap-4">
            <span className="material-symbols-outlined text-zinc-500 hover:text-[#FFB000] cursor-pointer text-xl">database</span>
            <span className="material-symbols-outlined text-zinc-500 hover:text-[#FFB000] cursor-pointer text-xl">shield</span>
            <button onClick={() => login({ id: '1', teamName: 'Player', ticker: '$PLAY', role: 'player' })} className="material-symbols-outlined text-zinc-500 hover:text-[#FFB000] cursor-pointer text-xl">account_circle</button>
          </div>
        </div>
      </header>

      {/* Side Navigation Shell */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-[#0a0a0a] flex flex-col py-8 z-40 border-r border-white/5">
        <div className="px-6 mb-12 mt-12">
          <div className="flex items-center gap-3 p-3 bg-[#1a1a1a] border border-white/5">
            <div className="w-2 h-2 rounded-full bg-[#00c853] animate-pulse"></div>
            <div>
              <div className="text-[11px] font-bold text-[#FFB000]">SYSTEM_STATUS: ONLINE</div>
              <div className="text-[9px] text-zinc-500 tracking-widest">VERSION_PROD_4.2</div>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 flex flex-col text-xs tracking-widest">
          <button 
            onClick={() => setActiveTab('register')}
            className={`flex items-center gap-4 px-6 py-4 transition-all ${activeTab === 'register' ? 'text-[#FFB000] bg-white/5 border-l-2 border-[#FFB000]' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
          >
            <span className="material-symbols-outlined text-sm">content_paste</span>
            <span>REGISTRATION_QUEUE</span>
          </button>
          <button 
            onClick={() => setActiveTab('teams')}
            className={`flex items-center gap-4 px-6 py-4 transition-all ${activeTab === 'teams' ? 'text-[#FFB000] bg-white/5 border-l-2 border-[#FFB000]' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
          >
            <span className="material-symbols-outlined text-sm">groups</span>
            <span>ACTIVE_TEAMS</span>
          </button>
          <button 
            onClick={() => setActiveTab('wire')}
            className={`flex items-center gap-4 px-6 py-4 transition-all ${activeTab === 'wire' ? 'text-[#FFB000] bg-white/5 border-l-2 border-[#FFB000]' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
          >
            <span className="material-symbols-outlined text-sm">newspaper</span>
            <span>MARKET_WIRE</span>
          </button>
          <button 
            onClick={() => setActiveTab('purge')}
            className={`flex items-center gap-4 px-6 py-4 transition-all ${activeTab === 'purge' ? 'text-[#FFB000] bg-white/5 border-l-2 border-[#FFB000]' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
          >
            <span className="material-symbols-outlined text-sm">bomb</span>
            <span>PURGE_CONTROL</span>
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-4 px-6 py-4 transition-all ${activeTab === 'settings' ? 'text-[#FFB000] bg-white/5 border-l-2 border-[#FFB000]' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
          >
            <span className="material-symbols-outlined text-sm">settings</span>
            <span>SYSTEM_SETTINGS</span>
          </button>
        </nav>

        <div className="px-6 py-6 border-t border-white/5 space-y-4">
          <div className="p-3 bg-black/40 border border-white/5 text-[9px] text-zinc-500 space-y-1">
            <div className="flex justify-between"><span>CPU_LOAD:</span> <span className="text-[#00c853]">12%</span></div>
            <div className="flex justify-between"><span>NET_LAT:</span> <span className="text-[#00c853]">4MS</span></div>
          </div>
        </div>
      </aside>

      {/* Main Content Canvas */}
      <main className="pl-64 pt-16 pb-8 h-screen overflow-hidden flex flex-col bg-[#0a0a0a]">
        {/* Header Metrics Bar */}
        <section className="grid grid-cols-4 gap-0 border-b border-white/5">
          <div className="p-6 bg-[#0f0f0f] border-r border-white/5">
            <div className="text-[9px] text-zinc-500 mb-1">ACTIVE TEAMS</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[#00c853]">42</span>
              <span className="text-sm text-zinc-700">/ 50</span>
            </div>
          </div>
          <div className="p-6 bg-[#0f0f0f] border-r border-white/5">
            <div className="text-[9px] text-zinc-500 mb-1">AGGREGATE LIQUIDITY</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">$4.2B</span>
            </div>
          </div>
          <div className="p-6 bg-[#0f0f0f] border-r border-white/5">
            <div className="text-[9px] text-zinc-500 mb-1">AVG MARKET CAP</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">$350M</span>
              <span className="text-[10px] text-[#00c853] font-bold">▲+2.4%</span>
            </div>
          </div>
          <div className="p-6 bg-[#0f0f0f]">
            <div className="text-[9px] text-zinc-500 mb-1">LLM QUEUE | SESSION_COST</div>
            <div className="flex flex-col">
              <div className="text-lg font-bold text-[#FFB000]">3 PENDING</div>
              <div className="text-[10px] text-zinc-400">SESSION: $4.23</div>
            </div>
          </div>
        </section>

        {/* Dynamic Content Area */}
        <section className="flex flex-1 overflow-hidden">
          {/* Teams Registry Module */}
          <div className="flex-1 flex flex-col bg-[#0a0a0a] overflow-hidden">
            <div className="p-4 bg-[#0f0f0f] border-b border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex gap-4">
                  {['ALL', 'ACTIVE', 'COOLDOWN', 'BANKRUPT', 'ELIMINATED', 'PENDING_APPROVAL'].map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f.toLowerCase())}
                      className={`text-[11px] py-1 cursor-pointer ${filter === f.toLowerCase() ? 'text-[#FFB000] font-bold border-b-2 border-[#FFB000]' : 'text-zinc-600 hover:text-zinc-400'}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <div className="flex items-center bg-black px-2 py-1 border border-white/10 gap-2">
                    <span className="material-symbols-outlined text-xs text-zinc-500">search</span>
                    <input className="bg-transparent border-none focus:ring-0 text-[10px] w-32 outline-none uppercase" placeholder="FILTER_TEAM..." type="text"/>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-[#1a1a1a] z-10">
                  <tr className="text-[10px] text-zinc-500 font-bold border-b border-white/5 uppercase">
                    <th className="px-4 py-3">TEAM_NAME</th>
                    <th className="px-4 py-3">TICKER</th>
                    <th className="px-4 py-3">STATUS</th>
                    <th className="px-4 py-3 text-right">LIQUIDITY</th>
                    <th className="px-4 py-3 text-right">MKT_CAP</th>
                    <th className="px-4 py-3">LAST_DIRECTIVE</th>
                    <th className="px-4 py-3 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="text-[10px]">
                  {mockTeams.map((team, i) => (
                    <tr key={i} className={`border-b border-white/5 hover:bg-white/5 ${team.status === 'ELIMINATED' ? 'opacity-40' : ''}`}>
                      <td className="px-4 py-3 font-bold text-white">{team.name}</td>
                      <td className="px-4 py-3 text-[#FFB000] font-bold">{team.ticker}</td>
                      <td className="px-4 py-3">
                        <span className={`border px-2 py-0.5 text-[9px] ${getStatusBadge(team.status)}`}>
                          {team.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{team.liquidity}</td>
                      <td className="px-4 py-3 text-right">{team.mktCap}</td>
                      <td className="px-4 py-3 text-zinc-500 italic truncate max-w-[150px]">{team.lastDirective}</td>
                      <td className="px-4 py-3 text-right space-x-1">
                        <button className="bg-[#2196F3]/10 text-[#2196F3] border border-[#2196F3]/30 px-2 py-1 hover:bg-[#2196F3] hover:text-white text-[9px] uppercase">VIEW DOSSIER</button>
                        {team.status === 'ACTIVE' && (
                          <>
                            <button className="bg-[#FFB000]/10 text-[#FFB000] border border-[#FFB000]/30 px-2 py-1 hover:bg-[#FFB000] hover:text-black text-[9px] uppercase">FORCE BANKRUPT</button>
                            <button className="bg-[#ff3333]/10 text-[#ff3333] border border-[#ff3333]/30 px-2 py-1 hover:bg-[#ff3333] hover:text-white text-[9px] uppercase">ELIMINATE</button>
                          </>
                        )}
                        {team.status === 'PENDING' && (
                          <>
                            <button className="bg-[#00c853]/10 text-[#00c853] border border-[#00c853]/30 px-2 py-1 hover:bg-[#00c853] hover:text-white text-[9px] uppercase">APPROVE</button>
                            <button className="bg-[#ff3333]/10 text-[#ff3333] border border-[#ff3333]/30 px-2 py-1 hover:bg-[#ff3333] hover:text-white text-[9px] uppercase">REJECT</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Side Panel */}
          <div className="w-80 bg-[#0f0f0f] border-l border-white/5 flex flex-col">
            {/* Portfolio Assignment */}
            <div className="p-6 border-b border-white/5">
              <h3 className="text-[10px] font-bold text-[#FFB000] mb-6 flex items-center gap-2 uppercase">
                <span className="material-symbols-outlined text-sm">assignment_ind</span>
                PORTFOLIO_ASSIGNMENT
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[9px] text-zinc-500 mb-2 block uppercase">SELECT TEAM...</label>
                  <select className="w-full bg-black border border-white/10 text-[10px] p-2 outline-none focus:border-[#00c853] uppercase">
                    <option>SELECT_TEAM...</option>
                    <option>STARK_INDUSTRIES (PENDING)</option>
                    <option>OSCORP_TECH (PENDING)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] text-zinc-500 mb-2 block uppercase">ASSIGN_STARTING_PROFILE</label>
                  <select className="w-full bg-black border border-white/10 text-[10px] p-2 outline-none focus:border-[#00c853] uppercase">
                    <option>Tech Startup</option>
                    <option>Legacy Manufacturer</option>
                    <option>D2C Disruptor</option>
                    <option>Conglomerate</option>
                  </select>
                </div>
                <button className="w-full bg-[#00c853] py-3 text-[10px] font-bold text-black border border-[#00c853]/20 hover:brightness-110 uppercase">
                  ACTIVATE_TEAM
                </button>
              </div>
            </div>

            {/* Game Controls */}
            <div className="p-6 flex-1 bg-black/20">
              <h3 className="text-[10px] font-bold text-[#FFB000] mb-6 flex items-center gap-2 uppercase">
                <span className="material-symbols-outlined text-sm">settings_remote</span>
                GAME_CONTROL
              </h3>
              <div className="space-y-3">
                <button className="w-full bg-[#00c853]/10 border border-[#00c853] text-[#00c853] py-4 text-[11px] font-bold hover:bg-[#00c853] hover:text-black transition-all flex items-center justify-center gap-2 uppercase">
                  <span className="material-symbols-outlined text-sm">play_circle</span>
                  START_GAME_SESSION
                </button>
                <button className="w-full bg-[#FFB000]/10 border border-[#FFB000] text-[#FFB000] py-3 text-[10px] font-bold hover:bg-[#FFB000] hover:text-black transition-all flex items-center justify-center gap-2 uppercase">
                  <span className="material-symbols-outlined text-sm">pause_circle</span>
                  PAUSE_TRADING
                </button>
                <button className="w-full bg-white/5 border border-white/20 text-zinc-400 py-3 text-[10px] font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2 uppercase">
                  <span className="material-symbols-outlined text-sm">cancel</span>
                  END_EVENT
                </button>
                <div className="pt-6">
                  <button className="w-full bg-[#ff3333] text-white py-5 text-[11px] font-bold border border-[#ff3333]/50 flex items-center justify-center gap-2 uppercase">
                    <span className="material-symbols-outlined text-sm">warning</span>
                    INITIATE_PURGE
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer Shell */}
      <footer className="fixed bottom-0 w-full z-50 flex justify-between items-center px-6 h-8 bg-black border-t border-white/10">
        <div className="text-[#FFB000] text-[9px] font-bold">
          COMPLEX // ADMIN_TERMINAL
        </div>
        <div className="flex gap-4 text-zinc-500 text-[9px] font-bold">
          <span>ACTIVE_TEAMS: 42</span>
          <span className="text-zinc-800">|</span>
          <span>TOTAL_LIQUIDITY: $4.2B</span>
          <span className="text-zinc-800">|</span>
          <span>AVG_MKT_CAP: $350M</span>
          <span className="text-zinc-800">|</span>
          <span>LLM_COST: $4.23</span>
        </div>
      </footer>
    </>
  );
}