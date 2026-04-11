"use client";

import React from "react";
import { useGameContext } from "@/contexts/GameContext";

interface StockTicker {
  symbol: string;
  price: string;
  change: string;
  sparkline: string;
}

interface FooterProps {
  ticker?: string;
  tickers?: StockTicker[];
}

const defaultTickers: StockTicker[] = [
  { symbol: "$BRBE", price: "95.50", change: "▼2.1%", sparkline: "▁▃▄▅" },
  { symbol: "$APEX", price: "104.00", change: "▲2.4%", sparkline: "▃▄▅▇" },
  { symbol: "$MNST", price: "88.00", change: "▼5.0%", sparkline: "▇▄▃▁" },
  { symbol: "$TECH", price: "156.20", change: "▲1.2%", sparkline: "▅▆▇▇" },
  { symbol: "$SOLA", price: "12.44", change: "▲0.8%", sparkline: "▃▃▄▅" },
  { symbol: "$AERO", price: "205.12", change: "▼4.8%", sparkline: "▇▆▄▃" },
  { symbol: "$CORP", price: "142.09", change: "▲2.4%", sparkline: "▄▅▆▇" },
  { symbol: "$BRBE", price: "95.50", change: "▼2.1%", sparkline: "▁▃▄▅" },
  { symbol: "$APEX", price: "104.00", change: "▲2.4%", sparkline: "▃▄▅▇" },
  { symbol: "$MNST", price: "88.00", change: "▼5.0%", sparkline: "▇▄▃▁" },
];

export function Footer({
  ticker = "$XXX",
  tickers = defaultTickers,
}: FooterProps) {
  const { setSelectedTicker, setIsTradeModalOpen } = useGameContext();

  const getChangeColor = (change: string) => {
    return change.startsWith("▲") ? "text-[#00c853]" : "text-[#ff3333]";
  };

  const handleTickerClick = (symbol: string) => {
    setSelectedTicker(symbol);
    setIsTradeModalOpen(true);
  };

  return (
    <footer className="h-full w-full flex items-center overflow-hidden font-mono text-[13px] bg-black text-[#e0e0e0]">
      <div className="flex items-center whitespace-nowrap animate-[ticker_40s_linear_infinite] hover:[animation-play-state:paused]">
        {tickers.map((t, i) => (
          <React.Fragment key={i}>
            <div
              className="flex items-center gap-2 cursor-pointer hover:bg-[#1a1a1a] px-2 py-1 transition-colors"
              onClick={() => handleTickerClick(t.symbol)}
              title={t.symbol}
            >
              <span className="text-[#ffb000] font-bold">{t.symbol}</span>
              <span className="text-white tabular-nums">{t.price}</span>
              <span className={getChangeColor(t.change)}>{t.change}</span>
              <span className="text-[#505050] tracking-tighter">
                {t.sparkline}
              </span>
            </div>
            <span className="text-[#2a2a2a] mx-2">|</span>
          </React.Fragment>
        ))}
      </div>
    </footer>
  );
}
