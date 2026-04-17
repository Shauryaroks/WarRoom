"use client";

import { useMarketStore } from "@/stores/market-store";

export function LeaderboardWidget() {
  const companies = useMarketStore((s) => s.companies);

  const sorted = [...companies]
    .sort((a, b) => Number(b.stock_price ?? 0) - Number(a.stock_price ?? 0))
    .slice(0, 10);

  return (
    <div className="bg-[#0e0e0e] border border-[#404752]/20 p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-mono text-[10px] font-bold text-[#9ecaff] uppercase tracking-widest">
          LEADERBOARD
        </h3>
        <a
          href="/leaderboard"
          className="font-mono text-[9px] text-[#2196f3] uppercase hover:underline"
        >
          FULL_VIEW
        </a>
      </div>
      <div className="space-y-1">
        {sorted.length === 0 ? (
          <p className="font-mono text-xs text-gray-600 text-center py-2">
            NO_DATA
          </p>
        ) : (
          sorted.map((c, i) => (
            <div
              key={c.team_id}
              className="flex items-center justify-between py-1 px-2 hover:bg-[#1c1b1b] transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-gray-500 w-4">
                  {i + 1}
                </span>
                <span className="font-mono text-xs font-bold text-[#e5e2e1]">
                  {c.ticker}
                </span>
              </div>
              <span
                className={`font-mono text-xs font-bold ${
                  Number(c.stock_price ?? 0) > 100
                    ? "text-[#40e56c]"
                    : Number(c.stock_price ?? 0) < 100
                      ? "text-[#FF1744]"
                      : "text-[#e5e2e1]"
                }`}
              >
                ${Number(c.stock_price ?? 100).toFixed(2)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
