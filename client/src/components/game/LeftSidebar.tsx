"use client";

import { useGameContext } from "@/contexts/GameContext";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { CandlestickChart } from "./CandlestickChart";

export function LeftSidebar() {
  const { setSelectedTicker, setIsTradeModalOpen, setTradePreset } = useGameContext();
  const { dossier } = useWebSocket();

  const handleTradeClick = (symbol: string, presetShares?: number) => {
    setSelectedTicker(symbol);
    if (presetShares !== undefined) {
      setTradePreset(presetShares);
    } else {
      setTradePreset(null);
    }
    setIsTradeModalOpen(true);
  };

  const cash = dossier?.financials.cash || 0;
  const marketCap = dossier?.financials.market_cap || 0;
  const totalValue = dossier?.portfolio.total_portfolio_value || 0;
  const liquidity = cash + 0.5 * totalValue;
  
  const teamTicker = dossier?.profile.ticker || "TICKER";

  const formatK = (num: number) => {
    const absNum = Math.abs(num);
    if (absNum >= 1000) {
      return (num / 1000).toFixed(1) + "k";
    }
    return num.toFixed(1);
  };

  let totalCostBasis = 0;
  let totalCurrentValue = 0;

  dossier?.portfolio.holdings.forEach((h) => {
    const value = h.shares * h.current_price;
    const costBasis = value / (1 + h.unrealized_pnl / 100);
    totalCurrentValue += value;
    totalCostBasis += costBasis;
  });

  const totalUnrealizedPnlAbs = totalCurrentValue - totalCostBasis;
  const totalUnrealizedPnlPct =
    totalCostBasis > 0 ? (totalUnrealizedPnlAbs / totalCostBasis) * 100 : 0;

  return (
    <aside className="bg-[var(--color-bg-darkest)] flex flex-col h-full w-full font-mono text-[13px] text-[var(--color-text-primary)] border-r border-[var(--color-outline)]">
      <div className="flex-1 overflow-y-auto flex flex-col p-4 gap-6">
        {/* Portfolio Overview */}
        <section className="flex flex-col gap-2">
          <h2 className="text-[var(--color-text-muted)] uppercase tracking-wider text-xs mb-1">
            Portfolio Overview
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[var(--color-bg-dark)] border border-[var(--color-outline)] p-2 rounded-sm flex flex-col">
              <span className="text-[var(--color-text-muted)] text-[10px]">CASH</span>
              <span className="text-lg font-semibold">${formatK(cash)}</span>
            </div>
            <div className="bg-[var(--color-bg-dark)] border border-[var(--color-outline)] p-2 rounded-sm flex flex-col">
              <span className="text-[var(--color-text-muted)] text-[10px]">LIQUIDITY</span>
              <span className="text-lg font-semibold">${formatK(liquidity)}</span>
            </div>
            <div className="bg-[var(--color-bg-dark)] border border-[var(--color-outline)] p-2 rounded-sm flex flex-col">
              <span className="text-[var(--color-text-muted)] text-[10px]">MARKET CAP</span>
              <span className="text-lg font-semibold">${formatK(marketCap)}</span>
            </div>
            <div className="bg-[var(--color-bg-dark)] border border-[var(--color-outline)] p-2 rounded-sm flex flex-col justify-center">
              <span className="text-[var(--color-text-muted)] text-[10px]">UNREALIZED P&L</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`text-lg font-semibold ${
                    totalUnrealizedPnlAbs >= 0
                      ? "text-[var(--color-accent-mint)]"
                      : "text-[var(--color-accent-rose)]"
                  }`}
                >
                  {totalUnrealizedPnlAbs >= 0 ? "+" : "-"}$
                  {formatK(Math.abs(totalUnrealizedPnlAbs))}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-sm font-medium ${
                    totalUnrealizedPnlPct >= 0
                      ? "bg-[var(--color-accent-mint)]/20 text-[var(--color-accent-mint)]"
                      : "bg-[var(--color-accent-rose)]/20 text-[var(--color-accent-rose)]"
                  }`}
                >
                  {totalUnrealizedPnlPct >= 0 ? "+" : ""}
                  {totalUnrealizedPnlPct.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Asset Cards */}
        <section className="flex flex-col gap-2">
          <h2 className="text-[var(--color-text-muted)] uppercase tracking-wider text-xs mb-1">
            Holdings
          </h2>
          <div className="flex flex-col gap-2">
            {dossier?.portfolio.holdings.map((h, i) => {
              const value = h.shares * h.current_price;
              const costBasis = value / (1 + h.unrealized_pnl / 100);
              const absPnl = value - costBasis;
              const isPositive = absPnl >= 0;

              return (
                <div
                  key={i}
                  className="bg-[var(--color-bg-dark)] border border-[var(--color-outline)] p-3 rounded-sm flex items-center justify-between hover:border-[var(--color-accent-blue)] transition-colors cursor-pointer"
                  onClick={() => handleTradeClick(h.ticker)}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[var(--color-accent-mint)] font-bold text-sm">
                      {h.ticker}
                    </span>
                    <span className="text-[var(--color-text-muted)] text-[10px]">
                      QTY {h.shares.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="font-semibold text-sm">${formatK(value)}</span>
                    <span
                      className={`text-[11px] font-medium ${
                        isPositive
                          ? "text-[var(--color-accent-mint)]"
                          : "text-[var(--color-accent-rose)]"
                      }`}
                    >
                      {isPositive ? "+" : "-"}${formatK(Math.abs(absPnl))} (
                      {isPositive ? "+" : ""}
                      {h.unrealized_pnl.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              );
            })}
            {!dossier?.portfolio.holdings?.length && (
              <div className="text-[var(--color-text-muted)] italic text-sm p-3 text-center border border-dashed border-[var(--color-outline)] rounded-sm">
                No active holdings
              </div>
            )}
          </div>
        </section>

        {/* Market Data */}
        <section className="flex flex-col gap-2">
          <h2 className="text-[var(--color-text-muted)] uppercase tracking-wider text-xs mb-1">
            Market Data
          </h2>
          <div className="h-40 border border-[var(--color-outline)] bg-[var(--color-bg-dark)] p-2 rounded-sm flex flex-col">
            <span className="text-[var(--color-text-muted)] text-[10px] mb-2">{teamTicker} / USD</span>
            <div className="flex-1 relative">
              {teamTicker !== "TICKER" ? (
                <CandlestickChart ticker={teamTicker} />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-[var(--color-text-muted)] italic text-xs">
                  Awaiting Market Data
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Action Zone */}
      <div className="p-4 border-t border-[var(--color-outline)] bg-[var(--color-bg-darkest)] flex gap-3">
        <button
          onClick={() => {
            setSelectedTicker(teamTicker);
            setTradePreset(null);
            setIsTradeModalOpen(true);
          }}
          className="flex-1 bg-[var(--color-accent-blue)] text-white font-bold py-3 px-4 rounded-sm hover:opacity-90 transition-opacity uppercase text-sm tracking-wide"
        >
          BUY ${teamTicker}
        </button>
        <button
          onClick={() => {
            setTradePreset(null);
            setIsTradeModalOpen(true);
          }}
          className="flex-1 border border-[var(--color-outline)] text-[var(--color-text-primary)] font-bold py-3 px-4 rounded-sm hover:bg-[var(--color-bg-dark)] transition-colors uppercase text-sm tracking-wide"
        >
          SELL HOLDINGS
        </button>
      </div>
    </aside>
  );
}
