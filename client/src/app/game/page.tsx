'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function GamePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/register');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-[#FFB000] tracking-widest uppercase text-sm animate-pulse">
          Loading...
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e2e1] font-mono">
      {/* Header Bar */}
      <header className="fixed top-0 left-0 w-full px-4 h-10 z-50 bg-[#131313] flex justify-between items-center border-b border-[#353534]">
        <div className="flex items-center gap-6">
          <span className="font-bold text-lg text-[#FFB000] tracking-tighter">COMPLEX</span>
          <div className="h-4 w-px bg-[#353534]"></div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-[9px] text-zinc-500 uppercase">SESSION ELAPSED</span>
              <span className="text-[#FFB000] font-bold">00:00:00</span>
            </div>
            <div className="flex flex-col border-l border-[#353534] pl-4">
              <span className="text-[9px] text-zinc-500 uppercase">TIMER_SEQ</span>
              <span className="text-white">00:00:00</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-8">
          <div className="flex flex-col items-end">
            <span className="text-[9px] text-zinc-500 uppercase">NEXT PURGE</span>
            <span className="text-[#ff3333] font-bold">-- MIN</span>
          </div>
          <div className="flex items-center gap-2 bg-black px-3 py-1 border border-[#353534]">
            <div className="w-1.5 h-1.5 bg-[#00c853] animate-pulse"></div>
            <span className="text-[10px] uppercase">SYSTEM: STABLE</span>
          </div>
          <div className="flex gap-2">
            <button className="text-zinc-500 hover:text-white p-1">
              <span className="material-symbols-outlined">timer</span>
            </button>
            <button className="text-zinc-500 hover:text-white p-1">
              <span className="material-symbols-outlined">account_tree</span>
            </button>
            <button className="text-zinc-500 hover:text-white p-1">
              <span className="material-symbols-outlined">notifications</span>
            </button>
          </div>
        </div>
      </header>

      {/* Secondary Status Bar */}
      <div className="fixed top-10 left-0 w-full h-8 bg-black border-b border-[#353534] flex items-center px-4 gap-8 z-40 text-[10px]">
        <div className="flex gap-2"><span className="text-zinc-500 uppercase">LIQUIDITY:</span> <span className="text-[#00c853]">$1.2M</span></div>
        <div className="flex gap-2"><span className="text-zinc-500 uppercase">CASH:</span> <span className="text-[#00c853]">$850K</span></div>
        <div className="flex gap-2"><span className="text-zinc-500 uppercase">STOCK PRICE:</span> <span className="text-white">$95.50</span> <span className="text-[#ff3333]">▼2.1%</span></div>
        <div className="flex gap-2"><span className="text-zinc-500 uppercase">HOLDINGS:</span> <span className="text-[#FFB000]">$400K</span></div>
      </div>

      {/* Main Layout Container */}
      <main className="flex flex-1 pt-[72px] pb-6 overflow-hidden h-screen">
        {/* Left Sidebar: Operations & Ledger */}
        <aside className="bg-[#201f1f] flex flex-col h-full w-80 border-r border-[#353534]">
          <div className="p-3 border-b border-[#353534] bg-[#131313]">
            <div className="text-[10px] font-bold text-[#FFB000] uppercase">OPERATIONS</div>
            <div className="text-[9px] text-zinc-500">MARKET_PULSE: {user.ticker}</div>
          </div>

          {/* Candlestick Chart Placeholder */}
          <div className="flex-1 border-b border-[#353534] relative bg-black flex flex-col" style={{ backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '30px 30px' }}>
            <div className="flex-1 p-4 flex items-end gap-[2px]">
              <div className="flex-1 flex flex-col items-center justify-end h-full"><div className="w-1.5 h-12 bg-[#ff3333]/60 border border-[#ff3333]/40"></div></div>
              <div className="flex-1 flex flex-col items-center justify-end h-full"><div className="w-1.5 h-20 bg-[#00c853]/60 border border-[#00c853]/40"></div></div>
              <div className="flex-1 flex flex-col items-center justify-end h-full"><div className="w-1.5 h-16 bg-[#00c853]/60 border border-[#00c853]/40"></div></div>
              <div className="flex-1 flex flex-col items-center justify-end h-full"><div className="w-1.5 h-24 bg-[#ff3333]/60 border border-[#ff3333]/40"></div></div>
              <div className="flex-1 flex flex-col items-center justify-end h-full"><div className="w-1.5 h-32 bg-[#00c853]/60 border border-[#00c853]/40"></div></div>
              <div className="flex-1 flex flex-col items-center justify-end h-full"><div className="w-1.5 h-40 bg-[#00c853]/60 border border-[#00c853]/40"></div></div>
            </div>
          </div>

          {/* Ledger/Market/Trade Tabs */}
          <div className="h-80 flex flex-col bg-[#131313]">
            <nav className="flex border-b border-[#353534]">
              <button className="flex-1 py-1 text-[9px] bg-[#353534] text-[#FFB000] border-b border-[#FFB000] uppercase">LEDGER</button>
              <button className="flex-1 py-1 text-[9px] text-zinc-500 hover:bg-[#353534] uppercase">MARKET</button>
              <button className="flex-1 py-1 text-[9px] text-[#FFB000]/70 hover:bg-[#353534] font-bold uppercase">TRADE</button>
            </nav>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-[#131313] z-10">
                  <tr className="text-[8px] text-zinc-500 border-b border-[#353534] uppercase">
                    <th className="p-2 font-normal">SYMBOL</th>
                    <th className="p-2 font-normal">PRICE</th>
                    <th className="p-2 font-normal">CHG%</th>
                    <th className="p-2 font-normal">VOLUME</th>
                  </tr>
                </thead>
                <tbody className="text-[10px]">
                  <tr className="border-b border-[#353534]/5 hover:bg-[#353534]/20">
                    <td className="p-2 text-white font-bold">{user.ticker}</td>
                    <td className="p-2 text-zinc-300">142.09</td>
                    <td className="p-2 text-[#00c853]">+2.41%</td>
                    <td className="p-2 text-zinc-500">12.4M</td>
                  </tr>
                  <tr className="border-b border-[#353534]/5 bg-black/20 hover:bg-[#353534]/20">
                    <td className="p-2 text-white font-bold">$TECH</td>
                    <td className="p-2 text-zinc-300">89.33</td>
                    <td className="p-2 text-[#ff3333]">-1.24%</td>
                    <td className="p-2 text-zinc-500">890K</td>
                  </tr>
                  <tr className="border-b border-[#353534]/5 hover:bg-[#353534]/20">
                    <td className="p-2 text-white font-bold">$SOLA</td>
                    <td className="p-2 text-zinc-300">12.44</td>
                    <td className="p-2 text-[#00c853]">+0.08%</td>
                    <td className="p-2 text-zinc-500">2.1M</td>
                  </tr>
                  <tr className="border-b border-[#353534]/5 bg-black/20 hover:bg-[#353534]/20">
                    <td className="p-2 text-white font-bold">$AERO</td>
                    <td className="p-2 text-zinc-300">205.12</td>
                    <td className="p-2 text-[#ff3333]">-4.82%</td>
                    <td className="p-2 text-zinc-500">4.5M</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </aside>

        {/* Center Panel: Directive Editor */}
        <section className="flex-1 flex flex-col bg-black relative">
          <div className="p-3 border-b border-[#353534] flex justify-between items-center bg-[#131313]/80 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#FFB000]">edit_note</span>
              <span className="text-[10px] font-bold text-zinc-300 uppercase">DIRECTIVE_DRAFT (0 / 2,000)</span>
            </div>
            <div className="flex gap-2">
              <button className="bg-[#353534] px-3 py-1 text-[9px] text-zinc-300 hover:text-white border border-[#353534] uppercase">SAVE_LOCAL</button>
              <button className="bg-[#00c853] px-4 py-1 text-[9px] text-black font-bold uppercase">SUBMIT TO BOARD</button>
            </div>
          </div>

          <div className="flex-1 p-6 text-sm relative overflow-hidden flex flex-col gap-6">
            <div className="flex-1 bg-black border border-[#353534] p-6">
              <div className="text-[#FFB000] mb-4"># STRATEGIC DIRECTIVE</div>
              <div className="text-[#FFB000]/80 mb-2">## Action Plan</div>
              <div className="text-zinc-400 mb-6">### Strategy</div>
              <div className="text-zinc-600 animate-pulse">_Submit strategic directive...</div>
            </div>

            {/* Bottom Panel: The Board Responds */}
            <div className="h-44 bg-[#131313] border border-[#353534] p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3 border-b border-[#353534] pb-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#FFB000] text-sm">gavel</span>
                  <span className="font-bold text-[10px] tracking-widest uppercase">THE BOARD RESPONDS</span>
                </div>
                <span className="text-[9px] text-zinc-500">--:--:--</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                <p className="text-[11px] text-zinc-300 leading-relaxed normal-case font-medium">
                  Board feedback will appear here after submitting your first directive.
                </p>
              </div>
            </div>
          </div>

          {/* Tactical Stats */}
          <div className="h-12 grid grid-cols-4 border-t border-[#353534] bg-[#131313]">
            <div className="border-r border-[#353534] p-2 flex flex-col justify-center">
              <span className="text-[8px] text-zinc-500 uppercase">PORTFOLIO_RISK</span>
              <div className="w-full bg-[#353534] h-1 mt-1"><div className="bg-[#FFB000] h-full w-2/3"></div></div>
            </div>
            <div className="border-r border-[#353534] p-2 flex flex-col justify-center">
              <span className="text-[8px] text-zinc-500 uppercase">MARKET_STATUS</span>
              <span className="text-[10px] text-[#00c853] font-bold uppercase">ACTIVE</span>
            </div>
            <div className="border-r border-[#353534] p-2 flex flex-col justify-center">
              <span className="text-[8px] text-zinc-500 uppercase">ALPHA_GENERATION</span>
              <span className="text-[10px] text-[#FFB000]">--</span>
            </div>
            <div className="p-2 flex flex-col justify-center">
              <span className="text-[8px] text-zinc-500 uppercase">PENDING_DIRECTIVES</span>
              <span className="text-[10px] text-[#FFB000] font-bold">0</span>
            </div>
          </div>
        </section>

        {/* Right Sidebar: The Wire & Heatmap */}
        <aside className="w-72 bg-[#201f1f] flex flex-col border-l border-[#353534]">
          <div className="p-3 bg-[#131313] border-b border-[#353534] flex items-center justify-between">
            <span className="font-bold text-[10px] tracking-widest uppercase">THE_WIRE</span>
            <span className="text-[9px] text-[#00c853]">LIVE_FEED</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            <div className="border-l border-[#ff3333] pl-3 py-1">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[8px] text-zinc-500">--:--:--</span>
                <span className="text-[8px] text-[#ff3333] font-bold uppercase">URGENT</span>
              </div>
              <p className="text-[10px] leading-tight text-white normal-case">Waiting for market events...</p>
            </div>
          </div>

          {/* Market Heatmap */}
          <div className="h-56 border-t border-[#353534] p-3 bg-black">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[9px] text-zinc-500 uppercase">MARKET_HEATMAP</span>
              <span className="material-symbols-outlined text-zinc-600 text-[14px]">grid_view</span>
            </div>
            <div className="grid h-36" style={{ gridTemplateColumns: '2fr 1fr 1fr', gridTemplateRows: '1.5fr 1fr' }}>
              <div className="bg-[#00c853]/40 border border-[#00c853]/60 flex items-center justify-center text-[8px] text-white font-bold">TECH</div>
              <div className="bg-[#ff3333]/40 border border-[#ff3333]/60 flex items-center justify-center text-[8px] text-white font-bold">FIN</div>
              <div className="bg-[#00c853]/20 border border-[#00c853]/40 flex items-center justify-center text-[8px] text-white">REIT</div>
              <div className="bg-[#ff3333]/20 border border-[#ff3333]/40 flex items-center justify-center text-[8px] text-white">ENG</div>
              <div className="bg-[#00c853]/50 border border-[#00c853]/70 flex items-center justify-center text-[8px] text-white font-bold">CONS</div>
            </div>
          </div>

          {/* System Ad Block */}
          <div className="p-3 bg-[#131313] border-t border-[#353534]">
            <div className="h-16 bg-black border border-[#353534] flex items-center justify-center text-[8px] text-zinc-600">
              TERMINAL_V1_ADS_BLOCKED
            </div>
          </div>
        </aside>
      </main>

      {/* Footer / Ticker */}
      <footer className="fixed bottom-0 left-0 w-full z-50 flex items-center justify-between px-4 bg-black h-6 border-t border-[#353534]">
        <div className="flex gap-4 overflow-hidden items-center flex-1">
          <div className="flex items-center gap-6 whitespace-nowrap text-[9px] animate-[ticker_40s_linear_infinite]" style={{ animation: 'ticker 40s linear infinite' }}>
            <span className="text-[#FFB000] font-bold">{user.ticker} <span className="text-[#00c853]">▲+2.41%</span> <span className="text-zinc-600">[VOL: 12.4M]</span></span>
            <span className="text-[#FFB000] font-bold">$TECH <span className="text-[#ff3333]">▼-1.24%</span> <span className="text-zinc-600">[VOL: 890K]</span></span>
            <span className="text-[#FFB000] font-bold">$SOLA <span className="text-[#00c853]">▲+0.08%</span> <span className="text-zinc-600">[VOL: 2.1M]</span></span>
          </div>
        </div>
        <div className="flex items-center gap-4 border-l border-[#353534] pl-4 h-full text-[8px] tracking-[0.1em]">
          <div className="flex gap-3">
            <span className="text-[#00c853]">MARKET_STATUS: ACTIVE</span>
            <span className="text-zinc-500 uppercase">ENCRYPTION: AES_256</span>
          </div>
          <span className="text-zinc-600">SYSTEM_STABLE_v1.02_FIN</span>
        </div>
      </footer>
    </div>
  );
}