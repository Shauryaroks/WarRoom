"use client";

import { useState } from "react";

interface StockData {
  symbol: string;
  price: string;
  change: string;
  volume: string;
}

interface LeftSidebarProps {
  ticker?: string;
  stockData?: StockData[];
}

const defaultStockData: StockData[] = [
  { symbol: "$CORP", price: "142.09", change: "+2.41%", volume: "12.4M" },
  { symbol: "$TECH", price: "89.33", change: "-1.24%", volume: "890K" },
  { symbol: "$SOLA", price: "12.44", change: "+0.08%", volume: "2.1M" },
  { symbol: "$AERO", price: "205.12", change: "-4.82%", volume: "4.5M" },
];

export function LeftSidebar({
  ticker = "$XXX",
  stockData = defaultStockData,
}: LeftSidebarProps) {
  const [activeTab, setActiveTab] = useState<"ledger" | "market" | "trade">(
    "ledger",
  );

  return (
    <aside className="bg-[#201f1f] flex flex-col h-full w-80 border-r border-[#353534]">
      <div className="p-3 border-b border-[#353534] bg-[#131313]">
        <div className="text-[10px] font-bold text-[#FFB000] uppercase">
          OPERATIONS
        </div>
        <div className="text-[9px] text-zinc-500">MARKET_PULSE: {ticker}</div>
      </div>

      {/* Candlestick Chart Placeholder */}
      <div
        className="flex-1 border-b border-[#353534] relative bg-black flex flex-col"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "30px 30px",
        }}
      >
        <div className="flex-1 p-4 flex items-end gap-[2px]">
          <div className="flex-1 flex flex-col items-center justify-end h-full">
            <div className="w-1.5 h-12 bg-[#ff3333]/60 border border-[#ff3333]/40"></div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-end h-full">
            <div className="w-1.5 h-20 bg-[#00c853]/60 border border-[#00c853]/40"></div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-end h-full">
            <div className="w-1.5 h-16 bg-[#00c853]/60 border border-[#00c853]/40"></div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-end h-full">
            <div className="w-1.5 h-24 bg-[#ff3333]/60 border border-[#ff3333]/40"></div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-end h-full">
            <div className="w-1.5 h-32 bg-[#00c853]/60 border border-[#00c853]/40"></div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-end h-full">
            <div className="w-1.5 h-40 bg-[#00c853]/60 border border-[#00c853]/40"></div>
          </div>
        </div>
      </div>

      {/* Ledger/Market/Trade Tabs */}
      <div className="h-80 flex flex-col bg-[#131313]">
        <nav className="flex border-b border-[#353534]">
          <button
            onClick={() => setActiveTab("ledger")}
            className={`flex-1 py-1 text-[9px] ${activeTab === "ledger" ? "bg-[#353534] text-[#FFB000] border-b border-[#FFB000]" : "text-zinc-500 hover:bg-[#353534]"} uppercase`}
          >
            LEDGER
          </button>
          <button
            onClick={() => setActiveTab("market")}
            className={`flex-1 py-1 text-[9px] ${activeTab === "market" ? "bg-[#353534] text-[#FFB000] border-b border-[#FFB000]" : "text-zinc-500 hover:bg-[#353534]"} uppercase`}
          >
            MARKET
          </button>
          <button
            onClick={() => setActiveTab("trade")}
            className={`flex-1 py-1 text-[9px] ${activeTab === "trade" ? "bg-[#353534] text-[#FFB000] border-b border-[#FFB000]" : "text-zinc-500 hover:bg-[#353534]"} uppercase`}
          >
            TRADE
          </button>
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
              {stockData.map((stock, i) => (
                <tr
                  key={i}
                  className={`border-b border-[#353534]/5 hover:bg-[#353534]/20 ${i % 2 === 1 ? "bg-black/20" : ""}`}
                >
                  <td className="p-2 text-white font-bold">{stock.symbol}</td>
                  <td className="p-2 text-zinc-300">{stock.price}</td>
                  <td
                    className={`p-2 ${stock.change.startsWith("+") ? "text-[#00c853]" : "text-[#ff3333]"}`}
                  >
                    {stock.change}
                  </td>
                  <td className="p-2 text-zinc-500">{stock.volume}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </aside>
  );
}
