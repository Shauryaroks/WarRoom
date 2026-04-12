interface MetricsBarProps {
  activeTeams?: number;
  totalTeams?: number;
  aggregateLiquidity?: string;
  avgMarketCap?: string;
  marketCapChange?: string;
  llmQueue?: number;
  sessionCost?: string;
}

export function MetricsBar({
  activeTeams = 42,
  totalTeams = 50,
  aggregateLiquidity = "$4.2B",
  avgMarketCap = "$350M",
  marketCapChange = "▲+2.4%",
  llmQueue = 3,
  sessionCost = "$4.23",
}: MetricsBarProps) {
  return (
    <section className="grid grid-cols-4 gap-0 border-b border-white/5">
      <div className="p-6 bg-[#0f0f0f] border-r border-white/5">
        <div className="text-[9px] text-zinc-500 mb-1">ACTIVE TEAMS</div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-[#00c853]">
            {activeTeams}
          </span>
          <span className="text-sm text-zinc-700">/ {totalTeams}</span>
        </div>
      </div>
      <div className="p-6 bg-[#0f0f0f] border-r border-white/5">
        <div className="text-[9px] text-zinc-500 mb-1">AGGREGATE LIQUIDITY</div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white">
            {aggregateLiquidity}
          </span>
        </div>
      </div>
      <div className="p-6 bg-[#0f0f0f] border-r border-white/5">
        <div className="text-[9px] text-zinc-500 mb-1">AVG MARKET CAP</div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white">{avgMarketCap}</span>
          <span className="text-[10px] text-[#00c853] font-bold">
            {marketCapChange}
          </span>
        </div>
      </div>
      <div className="p-6 bg-[#0f0f0f]">
        <div className="text-[9px] text-zinc-500 mb-1">
          LLM QUEUE | SESSION_COST
        </div>
        <div className="flex flex-col">
          <div className="text-lg font-bold text-[#0077b6]">
            {llmQueue} PENDING
          </div>
          <div className="text-[10px] text-zinc-400">
            SESSION: {sessionCost}
          </div>
        </div>
      </div>
    </section>
  );
}
