'use client';

import { useState } from 'react';

interface NewsItem {
  id: string;
  timestamp: string;
  type: 'urgent' | 'acquisition' | 'info';
  content: string;
  headline?: string;
}

interface RightSidebarProps {
  newsItems?: NewsItem[];
}

const defaultNewsItems: NewsItem[] = [
  { id: '1', timestamp: '14:22:01', type: 'urgent', headline: 'FED RATE DECISION', content: 'Fed announces 0.25% rate hike. Markets reacting to hawk-ish stance.' },
  { id: '2', timestamp: '14:18:45', type: 'acquisition', headline: 'MERGER ALERT', content: '$APEX acquires logistics firm for $420M, stock surges 12% in pre-market.' },
  { id: '3', timestamp: '14:05:12', type: 'info', headline: 'EXPANSION NEWS', content: 'Barbie Inc ($BRBE) announces Asian expansion plans following Q2 beat.' },
];

export function RightSidebar({ newsItems = defaultNewsItems }: RightSidebarProps) {
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);

  const getBorderColor = (type: NewsItem['type']) => {
    switch (type) {
      case 'urgent': return 'border-[#ff3333]';
      case 'acquisition': return 'border-[#00c853]';
      default: return 'border-[#FFB000]';
    }
  };

  const getLabel = (type: NewsItem['type']) => {
    switch (type) {
      case 'urgent': return 'URGENT';
      case 'acquisition': return 'ACQUISITION';
      default: return null;
    }
  };

  return (
    <>
      <aside className="w-72 bg-[#201f1f] flex flex-col border-l border-[#353534]">
        <div className="p-3 bg-[#131313] border-b border-[#353534] flex items-center justify-between">
          <span className="font-bold text-[10px] tracking-widest uppercase">THE_WIRE</span>
          <span className="text-[9px] text-[#00c853]">LIVE_FEED</span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {newsItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedNews(item)}
              className={`w-full text-left border-l pl-3 py-1 cursor-pointer hover:bg-[#353534]/30 transition-colors ${getBorderColor(item.type)}`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-[8px] text-zinc-500">{item.timestamp}</span>
                {getLabel(item.type) && (
                  <span className={`text-[8px] font-bold ${item.type === 'urgent' ? 'text-[#ff3333]' : 'text-[#00c853]'}`}>
                    {getLabel(item.type)}
                  </span>
                )}
              </div>
              <p className="text-[10px] leading-tight text-white normal-case">{item.content}</p>
            </button>
          ))}
        </div>

        <MarketHeatmap />
        <SystemAdBlock />
      </aside>

      {/* News Modal */}
      {selectedNews && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setSelectedNews(null)}
        >
          {/* Vignette overlay */}
          <div className="absolute inset-0 bg-black/80" style={{ background: 'radial-gradient(circle, transparent 30%, rgba(0,0,0,0.9) 100%)' }} />
          
          {/* Modal content */}
          <div 
            className="relative bg-[#131313] border border-[#353534] p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] text-zinc-500">{selectedNews.timestamp}</span>
              <button 
                onClick={() => setSelectedNews(null)}
                className="text-zinc-500 hover:text-white cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            {selectedNews.headline && (
              <div className={`text-xs font-bold uppercase mb-3 ${selectedNews.type === 'urgent' ? 'text-[#ff3333]' : selectedNews.type === 'acquisition' ? 'text-[#00c853]' : 'text-[#FFB000]'}`}>
                {selectedNews.headline}
              </div>
            )}
            <h2 className="text-lg font-bold text-[#FFB000] mb-4">{selectedNews.content.split('.')[0]}.</h2>
            <p className="text-[11px] text-zinc-300 leading-relaxed">
              {selectedNews.content.split('.').slice(1).join('.').trim() || 'Full story details would appear here from the news wire.'}
            </p>
            <div className="mt-6 pt-4 border-t border-[#353534] flex justify-between items-center">
              <span className="text-[8px] text-zinc-500 uppercase">SOURCE: MARKET_WIRE</span>
              <span className="text-[8px] text-[#00c853]">● LIVE</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MarketHeatmap() {
  const sectors = [
    { name: 'TECH', color: 'bg-[#00c853]/40 border-[#00c853]/60' },
    { name: 'FIN', color: 'bg-[#ff3333]/40 border-[#ff3333]/60' },
    { name: 'REIT', color: 'bg-[#00c853]/20 border-[#00c853]/40' },
    { name: 'ENG', color: 'bg-[#ff3333]/20 border-[#ff3333]/40' },
    { name: 'CONS', color: 'bg-[#00c853]/50 border-[#00c853]/70' },
  ];

  return (
    <div className="h-56 border-t border-[#353534] p-3 bg-black">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[9px] text-zinc-500 uppercase">MARKET_HEATMAP</span>
        <span className="material-symbols-outlined text-zinc-600 text-[14px]">grid_view</span>
      </div>
      <div className="grid h-36" style={{ gridTemplateColumns: '2fr 1fr 1fr', gridTemplateRows: '1.5fr 1fr' }}>
        {sectors.map((sector, i) => (
          <div key={i} className={`${sector.color} border flex items-center justify-center text-[8px] text-white ${sector.name === 'TECH' || sector.name === 'CONS' ? 'font-bold' : ''}`}>
            {sector.name}
          </div>
        ))}
      </div>
    </div>
  );
}

function SystemAdBlock() {
  return (
    <div className="p-3 bg-[#131313] border-t border-[#353534]">
      <div className="h-16 bg-black border border-[#353534] flex items-center justify-center text-[8px] text-zinc-600">
        TERMINAL_V1_ADS_BLOCKED
      </div>
    </div>
  );
}