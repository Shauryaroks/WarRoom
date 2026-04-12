"use client";

import { useState } from "react";
import { useGameContext } from "@/contexts/GameContext";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { CandlestickChart } from "./CandlestickChart";

export function LeftSidebar() {
  const [activeTab, setActiveTab] = useState<
    "portfolio" | "market" | "history"
  >("portfolio");
  const { setSelectedTicker, setIsTradeModalOpen, setTradePreset } =
    useGameContext();
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
  const stockPrice = dossier?.financials.stock_price || 0;
  const marketCap = dossier?.financials.market_cap || 0;
  const totalValue = dossier?.portfolio.total_portfolio_value || 0;
  const liquidity = cash + 0.5 * totalValue;

  return (
    <aside className="bg-[#0a0a0a] flex flex-col h-full w-full font-mono text-[13px] text-[#e0e0e0] border-r border-[#0077b6]">
      {/* Tab Navigation */}
      <div className="flex h-[40px] border-b border-[#0077b6]">
        <button
          onClick={() => setActiveTab("portfolio")}
          className={`flex-1 flex justify-center items-center gap-1 uppercase ${activeTab === "portfolio" ? "bg-[#0077b6] text-black font-bold" : "text-[#e0e0e0] hover:bg-[#1a1a1a]"}`}
        >
          <span>[PORTFOLIO]</span>
        </button>
        <button
          onClick={() => setActiveTab("market")}
          className={`flex-1 flex justify-center items-center gap-1 uppercase border-l border-[#0077b6] ${activeTab === "market" ? "bg-[#0077b6] text-black font-bold" : "text-[#e0e0e0] hover:bg-[#1a1a1a]"}`}
        >
          <span>[MARKET]</span>
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 flex justify-center items-center gap-1 uppercase border-l border-[#0077b6] ${activeTab === "history" ? "bg-[#0077b6] text-black font-bold" : "text-[#e0e0e0] hover:bg-[#1a1a1a]"}`}
        >
          <span>[HISTORY]</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col">
        {activeTab === "portfolio" && (
          <>
            {/* Ledger Header */}
            <div className="p-4 border-b border-[#0077b6] font-mono text-[12px] leading-tight text-[#0077b6]">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div className="flex justify-between">
                  <span>CASH:</span>
                  <span>
                    $
                    {cash.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>LIQUIDITY:</span>
                  <span>
                    $
                    {liquidity.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>STOCK P:</span>
                  <span>
                    $
                    {stockPrice.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>MKT CAP:</span>
                  <span>
                    $
                    {marketCap.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Holdings Table */}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-[#0a0a0a] z-10 border-b border-[#0077b6]">
                  <tr className="text-[#0077b6]">
                    <th className="p-2 font-normal">TICKER</th>
                    <th className="p-2 font-normal text-right">SHARES</th>
                    <th className="p-2 font-normal text-right">PRICE</th>
                    <th className="p-2 font-normal text-right">P&L</th>
                    <th className="p-2 font-normal text-right">OWN %</th>
                    <th className="p-2 font-normal text-center w-[120px]">
                      TRADE
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dossier?.portfolio.holdings.map((h, i) => (
                    <tr
                      key={i}
                      className="border-b border-[#332300] hover:bg-[#1a1a1a] group"
                    >
                      <td className="p-2 text-[#e0e0e0]">{h.ticker}</td>
                      <td className="p-2 text-right tabular-nums">
                        {h.shares.toLocaleString()}
                      </td>
                      <td className="p-2 text-right tabular-nums text-[#0077b6]">
                        $
                        {h.current_price.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td
                        className={`p-2 text-right tabular-nums ${h.unrealized_pnl > 0 ? "text-green-500" : h.unrealized_pnl < 0 ? "text-red-500" : "text-[#e0e0e0]"}`}
                      >
                        {h.unrealized_pnl > 0 ? "+" : ""}
                        {h.unrealized_pnl.toFixed(2)}%
                      </td>
                      <td
                        className={`p-2 text-right tabular-nums ${h.ownership_percentage >= 20 ? "text-red-500 font-bold" : "text-[#e0e0e0]"}`}
                      >
                        {h.ownership_percentage.toFixed(2)}%
                      </td>
                      <td className="p-2 text-center flex gap-1 justify-center">
                        <button
                          onClick={() =>
                            handleTradeClick(h.ticker, h.shares * 0.25)
                          }
                          className="px-1 text-[10px] border border-[#0077b6] text-[#0077b6] hover:bg-[#0077b6] hover:text-black"
                        >
                          25%
                        </button>
                        <button
                          onClick={() =>
                            handleTradeClick(h.ticker, h.shares * 0.5)
                          }
                          className="px-1 text-[10px] border border-[#0077b6] text-[#0077b6] hover:bg-[#0077b6] hover:text-black"
                        >
                          50%
                        </button>
                        <button
                          onClick={() => handleTradeClick(h.ticker, h.shares)}
                          className="px-1 text-[10px] border border-[#0077b6] text-[#0077b6] hover:bg-[#0077b6] hover:text-black"
                        >
                          ALL
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Quick Actions Bar */}
            <div className="p-2 border-t border-[#0077b6] bg-[#0a0a0a] flex flex-col gap-2">
              <button
                onClick={() => setIsTradeModalOpen(true)}
                className="w-full bg-[#0a0a0a] text-[#0077b6] border border-[#0077b6] font-bold uppercase hover:bg-[#0077b6] hover:text-black py-2"
              >
                [OPEN TRADE TERMINAL]
              </button>
            </div>
          </>
        )}

        {activeTab === "market" && (
          <div className="flex-1 flex flex-col p-4 bg-[#0a0a0a]">
            <div className="mb-2 text-[#0077b6] flex justify-between">
              <span>&gt; MARKET DATA {dossier?.profile.ticker}</span>
            </div>
            {dossier?.profile.ticker ? (
              <div className="flex-1 border border-[#0077b6] p-2">
                <CandlestickChart ticker={dossier.profile.ticker} />
              </div>
            ) : (
              <div className="text-red-500 italic">&gt; NO TICKER SELECTED</div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="p-4 text-[#0077b6] italic">&gt; HISTORY OFFLINE</div>
        )}
      </div>
    </aside>
  );
}
