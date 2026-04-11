"use client";

import { useState } from "react";
import { useGameContext } from "@/contexts/GameContext";

interface Holding {
  symbol: string;
  price: string;
  shares: number;
  pnl: string;
  sparkline: string;
}

const defaultHoldings: Holding[] = [
  {
    symbol: "$APEX",
    price: "104.00",
    shares: 150,
    pnl: "+2.4%",
    sparkline: "▁▃▅▇▃",
  },
  {
    symbol: "$MNST",
    price: "88.50",
    shares: 300,
    pnl: "-5.1%",
    sparkline: "▇▆▄▃▁",
  },
  {
    symbol: "$TECH",
    price: "156.20",
    shares: 50,
    pnl: "+12.0%",
    sparkline: "▃▄▅▆▇",
  },
];

export function LeftSidebar({ ticker = "$XXX" }: { ticker?: string }) {
  const [activeTab, setActiveTab] = useState<
    "portfolio" | "market" | "history"
  >("portfolio");
  const { setSelectedTicker, setIsTradeModalOpen } = useGameContext();

  const handleTradeClick = (symbol: string) => {
    setSelectedTicker(symbol);
    setIsTradeModalOpen(true);
  };

  return (
    <aside className="bg-[#0a0a0a] flex flex-col h-full w-full font-mono text-[13px] text-[#e0e0e0]">
      {/* Tab Navigation */}
      <div className="flex h-[40px] border-b border-[#2a2a2a]">
        <button
          onClick={() => setActiveTab("portfolio")}
          className={`flex-1 flex justify-center items-center gap-1 uppercase ${activeTab === "portfolio" ? "border-b-2 border-[#ffb000] text-[#ffb000]" : "text-[#505050] hover:text-[#808080]"}`}
        >
          <span>[1 PORTFOLIO]</span>
        </button>
        <button
          onClick={() => setActiveTab("market")}
          className={`flex-1 flex justify-center items-center gap-1 uppercase ${activeTab === "market" ? "border-b-2 border-[#ffb000] text-[#ffb000]" : "text-[#505050] hover:text-[#808080]"}`}
        >
          <span>[2 MARKET]</span>
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 flex justify-center items-center gap-1 uppercase ${activeTab === "history" ? "border-b-2 border-[#ffb000] text-[#ffb000]" : "text-[#505050] hover:text-[#808080]"}`}
        >
          <span>[3 HISTORY]</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col">
        {activeTab === "portfolio" && (
          <>
            {/* Net Worth Header */}
            <div className="p-4 border-b border-[#2a2a2a] whitespace-pre font-mono text-[12px] leading-tight text-[#ffb000]">
              {`┌────────────────────────────────────┐
│ NET WORTH            $1,245,000.00 │
│ ▲ +12.4% ▲ $137,000      [REFRESH] │
├────────────────────────────────────┤
│ CASH                   $850,000.00 │
│ MARGIN USED                  12.5% │
│ LIQUIDITY SCORE          1,245,000 │
└────────────────────────────────────┘`}
            </div>

            {/* Holdings Table */}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-[#0a0a0a] z-10 border-b border-[#2a2a2a]">
                  <tr className="text-[#808080]">
                    <th className="p-3 font-normal">SYMBOL</th>
                    <th className="p-3 font-normal text-right">PRICE</th>
                    <th className="p-3 font-normal text-right">SHARES</th>
                    <th className="p-3 font-normal text-right">P&L</th>
                    <th className="p-3 font-normal text-center w-[80px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {defaultHoldings.map((h, i) => (
                    <tr
                      key={i}
                      className="border-b border-[#1a1a1a] hover:bg-[#141414] group"
                    >
                      <td className="p-3 text-[#e0e0e0]">{h.symbol}</td>
                      <td className="p-3 text-[#ffb000] text-right tabular-nums">
                        {h.price}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {h.shares}
                      </td>
                      <td
                        className={`p-3 text-right tabular-nums ${h.pnl.startsWith("+") ? "text-[#00c853]" : "text-[#ff3333]"}`}
                      >
                        {h.pnl}{" "}
                        <span className="text-[#505050] text-[10px] ml-1">
                          {h.sparkline}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleTradeClick(h.symbol)}
                          className="hidden group-hover:block border border-[#ffb000] text-[#ffb000] px-2 py-0.5 text-[11px] hover:bg-[#ffb000] hover:text-black uppercase"
                        >
                          Trade
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Quick Actions Bar */}
            <div className="h-[36px] flex border-t border-[#2a2a2a] shrink-0 bg-[#0a0a0a]">
              <button className="flex-1 bg-[#ffb000] text-black font-bold uppercase hover:brightness-110 border-r border-black">
                [SELL 25%]
              </button>
              <button className="flex-1 bg-[#ffb000] text-black font-bold uppercase hover:brightness-110">
                [SELL 50%]
              </button>
            </div>
          </>
        )}

        {activeTab === "market" && (
          <div className="p-4 text-[#808080] italic">
            Market view not implemented...
          </div>
        )}

        {activeTab === "history" && (
          <div className="flex flex-col">
            <div className="p-3 border-b border-[#1a1a1a] flex items-center gap-2">
              <span className="text-[#505050]">[14:32:05]</span>
              <span className="text-[#e0e0e0]">BOUGHT 100 $APEX @ 104.00</span>
              <span className="text-[#00c853]">[FILLED]</span>
            </div>
            <div className="p-3 border-b border-[#1a1a1a] flex items-center gap-2">
              <span className="text-[#505050]">[13:10:22]</span>
              <span className="text-[#e0e0e0]">SOLD 50 $TECH @ 150.00</span>
              <span className="text-[#ffb000]">[FILLED]</span>
            </div>
            <div className="p-3 border-b border-[#1a1a1a] flex items-center gap-2">
              <span className="text-[#505050]">[12:05:01]</span>
              <span className="text-[#e0e0e0]">BOUGHT 200 $MNST @ 88.50</span>
              <span className="text-[#00c853]">[FILLED]</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
