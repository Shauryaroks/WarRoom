"use client";

import { useState } from "react";
import { useGameContext } from "@/contexts/GameContext";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { CandlestickChart } from "./CandlestickChart";

export function LeftSidebar() {
  const { setSelectedTicker, setIsTradeModalOpen, setTradePreset } =
    useGameContext();
  const { dossier, marketTickers } = useWebSocket();
  const [activeTab, setActiveTab] = useState<
    "HOLDINGS" | "PORTFOLIO" | "MARKET"
  >("HOLDINGS");
  const [expandedMarketTicker, setExpandedMarketTicker] = useState<
    string | null
  >(null);

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
    if (absNum >= 1_000_000) {
      return (num / 1_000_000).toFixed(1) + "M";
    }
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

  const getChangeColor = (change: number) => {
    if (change > 0) return "text-[var(--color-accent-mint)]";
    if (change < 0) return "text-[var(--color-accent-rose)]";
    return "text-[var(--color-text-muted)]";
  };

  // All other tickers (including eliminated — shown in red)
  const otherTickers = marketTickers.filter(
    (t) => t.ticker !== teamTicker,
  );

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
              <span className="text-[var(--color-text-muted)] text-[10px]">
                CASH
              </span>
              <span className="text-lg font-semibold">${formatK(cash)}</span>
            </div>
            <div className="bg-[var(--color-bg-dark)] border border-[var(--color-outline)] p-2 rounded-sm flex flex-col">
              <span className="text-[var(--color-text-muted)] text-[10px]">
                LIQUIDITY
              </span>
              <span className="text-lg font-semibold">
                ${formatK(liquidity)}
              </span>
            </div>
            <div className="bg-[var(--color-bg-dark)] border border-[var(--color-outline)] p-2 rounded-sm flex flex-col">
              <span className="text-[var(--color-text-muted)] text-[10px]">
                MARKET CAP
              </span>
              <span className="text-lg font-semibold">
                ${formatK(marketCap)}
              </span>
            </div>
            <div className="bg-[var(--color-bg-dark)] border border-[var(--color-outline)] p-2 rounded-sm flex flex-col justify-center">
              <span className="text-[var(--color-text-muted)] text-[10px]">
                UNREALIZED P&L
              </span>
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

        {/* Tabs */}
        <section className="flex flex-col gap-2">
          <div className="flex h-[30px] shrink-0 border-b border-[var(--color-outline)] text-[11px] mb-2">
            <button
              onClick={() => setActiveTab("HOLDINGS")}
              className={`flex-1 uppercase font-bold transition-colors ${activeTab === "HOLDINGS" ? "bg-[var(--color-bg-interactive)] text-[var(--color-text-primary)] border-b-2 border-b-[var(--color-accent-blue)]" : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] border-b-2 border-b-transparent"}`}
            >
              [HOLDINGS]
            </button>
            <button
              onClick={() => setActiveTab("MARKET")}
              className={`flex-1 uppercase font-bold transition-colors ${activeTab === "MARKET" ? "bg-[var(--color-bg-interactive)] text-[var(--color-text-primary)] border-b-2 border-b-[var(--color-accent-blue)]" : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] border-b-2 border-b-transparent"}`}
            >
              [MARKET]
            </button>
            <button
              onClick={() => setActiveTab("PORTFOLIO")}
              className={`flex-1 uppercase font-bold transition-colors ${activeTab === "PORTFOLIO" ? "bg-[var(--color-bg-interactive)] text-[var(--color-text-primary)] border-b-2 border-b-[var(--color-accent-blue)]" : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] border-b-2 border-b-transparent"}`}
            >
              [DOSSIER]
            </button>
          </div>

          {/* HOLDINGS TAB */}
          {activeTab === "HOLDINGS" && (
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
                      <span className="font-semibold text-sm">
                        ${formatK(value)}
                      </span>
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

              {/* Own stock chart */}
              <div className="mt-2">
                <h3 className="text-[var(--color-text-muted)] uppercase tracking-wider text-[10px] mb-1">
                  {teamTicker} / USD
                </h3>
                <div className="h-40 border border-[var(--color-outline)] bg-[var(--color-bg-dark)] p-2 rounded-sm">
                  <div className="w-full h-full relative">
                    {teamTicker !== "TICKER" ? (
                      <CandlestickChart data={[]} />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-[var(--color-text-muted)] italic text-xs">
                        Awaiting Market Data
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MARKET TAB - all companies */}
          {activeTab === "MARKET" && (
            <div className="flex flex-col gap-2">
              {otherTickers.length === 0 && (
                <div className="text-[var(--color-text-muted)] italic text-sm p-3 text-center border border-dashed border-[var(--color-outline)] rounded-sm">
                  No other companies in the market
                </div>
              )}
              {otherTickers.map((t) => {
                const isExpanded = expandedMarketTicker === t.ticker;
                const holding = dossier?.portfolio.holdings.find(
                  (h) => h.ticker === t.ticker,
                );
                const isDead =
                  t.status === "HALTED" ||
                  t.status === "ELIMINATED" ||
                  t.status === "BANKRUPT";

                return (
                  <div key={t.ticker} className="flex flex-col">
                    <div
                      className={`border p-3 rounded-sm flex items-center justify-between transition-colors cursor-pointer ${isDead ? "bg-red-950/20 border-[var(--color-accent-rose)]/30" : `bg-[var(--color-bg-dark)] border-[var(--color-outline)] hover:border-[var(--color-accent-blue)]`} ${isExpanded ? "border-[var(--color-accent-blue)]" : ""}`}
                      onClick={() =>
                        setExpandedMarketTicker(isExpanded ? null : t.ticker)
                      }
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold text-sm ${isDead ? "text-[var(--color-accent-rose)] line-through" : "text-[var(--color-accent-cyan)]"}`}>
                            {t.ticker}
                          </span>
                          {isDead && (
                            <span className="text-[9px] px-1 py-0.5 bg-[var(--color-accent-rose)]/20 text-[var(--color-accent-rose)] font-bold">
                              DEAD
                            </span>
                          )}
                          {!isDead && holding && (
                            <span className="text-[9px] px-1 py-0.5 bg-[var(--color-accent-blue)]/20 text-[var(--color-accent-blue)] font-bold">
                              HELD
                            </span>
                          )}
                        </div>
                        <span className="text-[var(--color-text-muted)] text-[10px]">
                          {isDead ? "ELIMINATED" : `MCap $${formatK(t.market_cap)}`}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        <span className={`font-semibold text-sm tabular-nums ${isDead ? "text-[var(--color-accent-rose)]" : ""}`}>
                          {isDead ? "$0.00" : `$${t.price.toFixed(2)}`}
                        </span>
                        <span
                          className={`text-[11px] font-bold tabular-nums ${getChangeColor(t.change_24h)}`}
                        >
                          {t.change_24h > 0 ? "+" : ""}
                          {t.change_24h.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Expanded: chart + trade buttons */}
                    {isExpanded && (
                      <div className="bg-[var(--color-bg-dark)] border border-t-0 border-[var(--color-accent-blue)] p-3 rounded-b-sm">
                        <div className="h-36 mb-3">
                          <CandlestickChart data={[]} />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTradeClick(t.ticker);
                            }}
                            className="flex-1 py-2 border border-[var(--color-accent-mint)] text-[var(--color-accent-mint)] font-bold uppercase text-[11px] hover:bg-[var(--color-accent-mint)] hover:text-black transition-colors"
                          >
                            BUY
                          </button>
                          {holding && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTradeClick(t.ticker, holding.shares);
                              }}
                              className="flex-1 py-2 border border-[var(--color-accent-rose)] text-[var(--color-accent-rose)] font-bold uppercase text-[11px] hover:bg-[var(--color-accent-rose)] hover:text-black transition-colors"
                            >
                              SELL ({holding.shares})
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* PORTFOLIO/DOSSIER TAB */}
          {activeTab === "PORTFOLIO" && (
            <div className="bg-[var(--color-bg-dark)] border border-[var(--color-outline)] p-3 rounded-sm font-mono text-[12px] whitespace-pre-wrap leading-relaxed overflow-y-auto max-h-[400px]">
              <div className="text-[var(--color-accent-blue)] font-bold mb-3">
                # CORPORATE DOSSIER: {teamTicker}
              </div>

              {(() => {
                const portfolioEntries = Object.entries(
                  dossier?.profile?.swot || ({} as Record<string, string>),
                );
                if (portfolioEntries.length === 0) {
                  return (
                    <div className="text-[var(--color-text-muted)] italic">
                      No data available
                    </div>
                  );
                }

                return portfolioEntries.map(([key, value]) => {
                  const lowerKey = key.toLowerCase();
                  let colorClass = "text-[var(--color-text-primary)]";
                  if (
                    lowerKey.includes("strength") ||
                    lowerKey.includes("advantage") ||
                    lowerKey.includes("pro")
                  ) {
                    colorClass = "text-[var(--color-accent-mint)]";
                  } else if (
                    lowerKey.includes("weakness") ||
                    lowerKey.includes("risk") ||
                    lowerKey.includes("con") ||
                    lowerKey.includes("threat")
                  ) {
                    colorClass = "text-[var(--color-accent-rose)]";
                  }

                  return (
                    <div key={key} className="mb-3">
                      <div className="text-[var(--color-text-muted)] font-bold">
                        ## {key.toUpperCase()}
                      </div>
                      <div className={colorClass}>{value || "N/A"}</div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
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
          BUY {teamTicker}
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
