"use client";

import React from "react";
import { useGameContext } from "@/contexts/GameContext";
import { useWebSocket } from "@/contexts/WebSocketContext";

export function Footer() {
  const { setSelectedTicker, setIsTradeModalOpen } = useGameContext();
  const { marketTickers: tickers } = useWebSocket();

  const getChangeColor = (change: number) => {
    if (change > 0) return "text-[var(--color-accent-mint)]";
    if (change < 0) return "text-[var(--color-accent-rose)]";
    return "text-[var(--color-text-muted)]";
  };

  const handleTickerClick = (symbol: string) => {
    setSelectedTicker(symbol);
    setIsTradeModalOpen(true);
  };

  return (
    <footer className="h-full w-full flex items-center overflow-hidden font-mono text-[13px] bg-[var(--color-bg-darkest)] text-[var(--color-text-primary)] border-t border-[var(--color-outline)]">
      <div className="flex items-center whitespace-nowrap ticker-scroll hover:[animation-play-state:paused] w-max">
        {tickers.map((t, i) => {
          const changeColor = getChangeColor(t.change_24h);
          const isPriority = Math.abs(t.change_24h) > 5;
          return (
            <React.Fragment key={i}>
              <div
                className={`flex items-center gap-3 cursor-pointer hover:bg-[var(--color-bg-interactive)] px-4 py-1.5 transition-colors border-l border-[var(--color-outline)] first:border-l-0 ${isPriority ? "bg-[var(--color-bg-elevated)]" : ""}`}
                onClick={() => handleTickerClick(t.ticker)}
              >
                <span
                  className={`font-bold ${isPriority ? "text-[var(--color-accent-cyan)]" : "text-[var(--color-text-primary)]"}`}
                >
                  ${t.ticker}
                </span>
                <span className="tabular-nums font-medium text-[var(--color-text-muted)]">
                  ${t.price.toFixed(2)}
                </span>
                <span
                  className={`${changeColor} font-bold flex items-center gap-1`}
                >
                  {t.change_24h > 0 ? "▲" : t.change_24h < 0 ? "▼" : "−"}
                  {Math.abs(t.change_24h).toFixed(1)}%
                </span>
              </div>
            </React.Fragment>
          );
        })}
        {/* Duplicate the list so it scrolls seamlessly. Optional, but good for marquee. */}
        {tickers.map((t, i) => {
          const changeColor = getChangeColor(t.change_24h);
          const isPriority = Math.abs(t.change_24h) > 5;
          return (
            <React.Fragment key={`dup-${i}`}>
              <div
                className={`flex items-center gap-3 cursor-pointer hover:bg-[var(--color-bg-interactive)] px-4 py-1.5 transition-colors border-l border-[var(--color-outline)] ${isPriority ? "bg-[var(--color-bg-elevated)]" : ""}`}
                onClick={() => handleTickerClick(t.ticker)}
              >
                <span
                  className={`font-bold ${isPriority ? "text-[var(--color-accent-cyan)]" : "text-[var(--color-text-primary)]"}`}
                >
                  ${t.ticker}
                </span>
                <span className="tabular-nums font-medium text-[var(--color-text-muted)]">
                  ${t.price.toFixed(2)}
                </span>
                <span
                  className={`${changeColor} font-bold flex items-center gap-1`}
                >
                  {t.change_24h > 0 ? "▲" : t.change_24h < 0 ? "▼" : "−"}
                  {Math.abs(t.change_24h).toFixed(1)}%
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </footer>
  );
}
