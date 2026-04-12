"use client";

import React from "react";
import { useGameContext } from "@/contexts/GameContext";
import { useWebSocket } from "@/contexts/WebSocketContext";

export function Footer() {
  const { setSelectedTicker, setIsTradeModalOpen } = useGameContext();
  const { marketTickers: tickers } = useWebSocket();

  const getChangeColor = (change: number) => {
    if (change > 0) return "text-green-500";
    if (change < 0) return "text-red-500";
    return "text-[#ffb000]";
  };

  const handleTickerClick = (symbol: string) => {
    setSelectedTicker(symbol);
    setIsTradeModalOpen(true);
  };

  return (
    <footer className="h-full w-full flex items-center overflow-hidden font-mono text-[13px] bg-[#0a0a0a] text-[#ffb000] border-t border-[#ffb000]">
      <div className="flex items-center whitespace-nowrap ticker-scroll hover:[animation-play-state:paused] w-max">
        {tickers.map((t, i) => {
          const changeColor = getChangeColor(t.change_24h);
          return (
            <React.Fragment key={i}>
              <div
                className="flex items-center gap-2 cursor-pointer hover:bg-[#ffb000] hover:text-black px-3 py-1 transition-colors"
                onClick={() => handleTickerClick(t.ticker)}
              >
                <span className="font-bold">${t.ticker}</span>
                <span className="tabular-nums font-bold">
                  ${t.price.toFixed(2)}
                </span>
                <span className={`${changeColor} font-bold`}>
                  {t.change_24h > 0 ? "▲" : t.change_24h < 0 ? "▼" : ""}
                  {Math.abs(t.change_24h).toFixed(1)}%
                </span>
              </div>
              <span className="text-[#ffb000] mx-1">|</span>
            </React.Fragment>
          );
        })}
        {/* Duplicate the list so it scrolls seamlessly. Optional, but good for marquee. */}
        {tickers.map((t, i) => {
          const changeColor = getChangeColor(t.change_24h);
          return (
            <React.Fragment key={`dup-${i}`}>
              <div
                className="flex items-center gap-2 cursor-pointer hover:bg-[#ffb000] hover:text-black px-3 py-1 transition-colors"
                onClick={() => handleTickerClick(t.ticker)}
              >
                <span className="font-bold">${t.ticker}</span>
                <span className="tabular-nums font-bold">
                  ${t.price.toFixed(2)}
                </span>
                <span className={`${changeColor} font-bold`}>
                  {t.change_24h > 0 ? "▲" : t.change_24h < 0 ? "▼" : ""}
                  {Math.abs(t.change_24h).toFixed(1)}%
                </span>
              </div>
              <span className="text-[#ffb000] mx-1">|</span>
            </React.Fragment>
          );
        })}
      </div>
    </footer>
  );
}
