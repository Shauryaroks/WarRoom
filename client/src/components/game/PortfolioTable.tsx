"use client";

import { useTradingStore } from "@/stores/trading-store";

export function PortfolioTable() {
  const holdings = useTradingStore((s) => s.holdings);
  const cash = useTradingStore((s) => s.cash);
  const totalHoldingsValue = useTradingStore((s) => s.totalHoldingsValue);
  const netWorth = useTradingStore((s) => s.netWorth);

  return (
    <div className="p-4 space-y-3">
      <div className="text-[10px] text-[#89919d] uppercase font-bold tracking-widest">
        PORTFOLIO
      </div>

      {holdings.length === 0 ? (
        <div className="font-mono text-xs text-[#404752] py-4 text-center">
          No positions
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[9px] text-[#89919d] uppercase tracking-widest">
                <th className="py-1 pr-2 font-bold">TICKER</th>
                <th className="py-1 pr-2 font-bold text-right">SHARES</th>
                <th className="py-1 pr-2 font-bold text-right">AVG</th>
                <th className="py-1 pr-2 font-bold text-right">PRICE</th>
                <th className="py-1 pr-2 font-bold text-right">P&L</th>
                <th className="py-1 font-bold text-right">OWN%</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => {
                const pnl = parseFloat(h.pnl);
                const pnlColor = pnl >= 0 ? "text-[#40e56c]" : "text-[#FF1744]";

                return (
                  <tr key={h.target_team_id} className="hover:bg-[#2a2a2a]/50 transition-colors">
                    <td className="py-1 pr-2 font-mono text-xs font-bold text-[#9ecaff]">
                      {h.ticker}
                    </td>
                    <td className="py-1 pr-2 font-mono text-xs text-[#e5e2e1] text-right tabular-nums">
                      {h.shares_owned}
                    </td>
                    <td className="py-1 pr-2 font-mono text-xs text-[#e5e2e1] text-right tabular-nums">
                      ${parseFloat(h.avg_buy_price).toFixed(2)}
                    </td>
                    <td className="py-1 pr-2 font-mono text-xs text-[#e5e2e1] text-right tabular-nums">
                      ${parseFloat(h.current_price).toFixed(2)}
                    </td>
                    <td className={`py-1 pr-2 font-mono text-xs text-right tabular-nums ${pnlColor}`}>
                      {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)} ({parseFloat(h.pnl_pct).toFixed(1)}%)
                    </td>
                    <td className="py-1 font-mono text-xs text-[#89919d] text-right tabular-nums">
                      {parseFloat(h.ownership_pct).toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary row */}
      <div className="flex justify-between pt-2 border-t border-[#404752]/20">
        <div className="space-y-1">
          <div className="text-[9px] text-[#89919d] uppercase tracking-widest">HOLDINGS</div>
          <div className="font-mono text-xs text-[#e5e2e1] tabular-nums">
            ${parseFloat(totalHoldingsValue).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="space-y-1 text-right">
          <div className="text-[9px] text-[#89919d] uppercase tracking-widest">NET WORTH</div>
          <div className="font-mono text-xs text-[#40e56c] font-bold tabular-nums">
            ${parseFloat(netWorth).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Cash */}
      <div className="flex justify-between">
        <div className="text-[9px] text-[#89919d] uppercase tracking-widest">CASH</div>
        <div className="font-mono text-xs text-[#e5e2e1] tabular-nums">
          ${parseFloat(cash).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>
    </div>
  );
}
