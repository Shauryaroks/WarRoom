"use client";

import React from "react";
import { useGameContext } from "@/contexts/GameContext";
import { useWebSocket } from "@/contexts/WebSocketContext";

/**
 * The Footer component displays a live-updating, scrolling ticker tape
 * of stock prices and their 24h percentage changes.
 * 
 * Subscribes to the WebSocket context to receive real-time ticker updates.
 * Clicking on a ticker opens the trade modal for that symbol.
 *
 * @returns The rendered scrolling ticker footer.
 */
export function Footer() {
  const { setSelectedTicker, setIsTradeModalOpen } = useGameContext();
  const { marketTickers: tickers } = useWebSocket();

  const getChangeColor = (change: number) => {
    return change > 0 ? "text-[#00c853]" : change < 0 ? "text-[#ff3333]" : "text-[#808080]";
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
              onClick={() => handleTickerClick(t.ticker)}
              title={t.ticker}
            >
              <span className="text-[#0077b6] font-bold">{t.ticker}</span>
              <span className="text-white tabular-nums">{t.price.toFixed(2)}</span>
              <span className={getChangeColor(t.change_24h)}>
                {t.change_24h > 0 ? "▲" : t.change_24h < 0 ? "▼" : ""}{Math.abs(t.change_24h).toFixed(1)}%
              </span>
            </div>
            <span className="text-[#2a2a2a] mx-2">|</span>
          </React.Fragment>
        ))}
      </div>
    </footer>
  );
}
