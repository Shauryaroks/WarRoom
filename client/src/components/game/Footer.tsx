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

  const renderTicker = (t: (typeof tickers)[0], i: number, keyPrefix = "") => {
    const isDead =
      t.status === "HALTED" ||
      t.status === "ELIMINATED" ||
      t.status === "BANKRUPT";
    const changeColor = isDead
      ? "text-[var(--color-accent-rose)]"
      : getChangeColor(t.change_24h);
    const isPriority = !isDead && Math.abs(t.change_24h) > 5;

    return (
      <React.Fragment key={`${keyPrefix}${i}`}>
        <div
          className={`flex items-center gap-3 cursor-pointer hover:bg-[var(--color-bg-interactive)] px-4 py-1.5 transition-colors border-l border-[var(--color-outline)] first:border-l-0 ${isDead ? "bg-red-950/30" : isPriority ? "bg-[var(--color-bg-elevated)]" : ""}`}
          onClick={() => !isDead && handleTickerClick(t.ticker)}
        >
          <span
            className={`font-bold ${isDead ? "text-[var(--color-accent-rose)] line-through" : isPriority ? "text-[var(--color-accent-cyan)]" : "text-[var(--color-text-primary)]"}`}
          >
            {t.ticker}
          </span>
          <span
            className={`tabular-nums font-medium ${isDead ? "text-[var(--color-accent-rose)]/60" : "text-[var(--color-text-muted)]"}`}
          >
            {isDead ? "$0.00" : `$${t.price.toFixed(2)}`}
          </span>
          {isDead ? (
            <span className="text-[var(--color-accent-rose)] font-bold text-[11px]">
              ELIMINATED
            </span>
          ) : (
            <span
              className={`${changeColor} font-bold flex items-center gap-1`}
            >
              {t.change_24h > 0 ? "▲" : t.change_24h < 0 ? "▼" : "−"}
              {Math.abs(t.change_24h).toFixed(1)}%
            </span>
          )}
        </div>
      </React.Fragment>
    );
  };

  return (
    <footer className="h-full w-full flex items-center overflow-hidden font-mono text-[13px] bg-[var(--color-bg-darkest)] text-[var(--color-text-primary)] border-t border-[var(--color-outline)]">
      <div className="flex items-center whitespace-nowrap ticker-scroll hover:[animation-play-state:paused] w-max">
        {tickers.map((t, i) => renderTicker(t, i))}
        {tickers.map((t, i) => renderTicker(t, i, "dup-"))}
      </div>
    </footer>
  );
}
