"use client";

import React from "react";

interface HeaderBarProps {
  sessionElapsed?: string;
  timerSeq?: string;
  ticker?: string;
  isMarketConnected?: boolean;
  isTeamConnected?: boolean;
}

/**
 * The HeaderBar component displays the top-level game state and terminal information.
 * It shows the current session time, round number, player ticker, and the
 * WebSocket connection status.
 *
 * @param {HeaderBarProps} props - The properties for the HeaderBar.
 * @param {string} [props.sessionElapsed="00:00:00"] - The formatted elapsed game time.
 * @param {string} [props.timerSeq="0/4"] - The current round sequence.
 * @param {string} [props.ticker="$SSSS"] - The player's team ticker.
 * @param {boolean} [props.isMarketConnected=false] - Whether the market WS is connected.
 * @param {boolean} [props.isTeamConnected=false] - Whether the team WS is connected.
 * @returns The rendered header bar.
 */
export function HeaderBar({
  sessionElapsed = "00:00:00",
  timerSeq = "0/4",
  ticker = "$SSSS",
  isMarketConnected = false,
  isTeamConnected = false,
}: HeaderBarProps) {
  const gameState = "ACTIVE"; // Could come from context

  return (
    <header className="flex h-full w-full justify-between items-center px-4 font-mono text-[13px] bg-[var(--color-bg-darkest)] text-[var(--color-text-primary)] border-b border-[var(--color-outline)]">
      {/* Left Zone */}
      <div className="flex items-center gap-3 w-[380px]">
        {gameState === "ACTIVE" && (
          <div className="flex items-center gap-2 bg-[var(--color-accent-mint)]/10 text-[var(--color-accent-mint)] px-2 py-0.5 rounded-full border border-[var(--color-accent-mint)]/20">
            <div className="w-2 h-2 rounded-full bg-[var(--color-accent-mint)] animate-pulse"></div>
            <span className="font-bold text-[11px] tracking-wide">LIVE</span>
          </div>
        )}
        <span className="font-bold tracking-wide text-[var(--color-text-primary)]">COMPLEX_TERMINAL</span>
        <span className="text-[var(--color-text-muted)] text-[11px]">v1.0.4</span>
      </div>

      {/* Center Zone */}
      <div className="flex items-center gap-6 justify-center flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[var(--color-text-muted)]">PHASE:</span>
          <span className="text-[var(--color-accent-mint)]">
            [{gameState}]
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[var(--color-text-muted)]">T-MINUS:</span>
          <span className="text-[var(--color-accent-cyan)] tabular-nums font-bold">
            [{sessionElapsed}]
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[var(--color-text-muted)]">ROUND:</span>
          <span className="text-[var(--color-text-primary)]">[{timerSeq}]</span>
        </div>
      </div>

      {/* Right Zone */}
      <div className="flex items-center gap-4 justify-end w-[380px]">
        <span className="text-[var(--color-accent-cyan)] font-bold text-[14px]">{ticker}</span>
        <span className="text-[var(--color-outline)]">|</span>
        <div className="flex items-center gap-2">
          <span className="text-[var(--color-text-muted)]">WS:</span>
          {isMarketConnected && isTeamConnected ? (
            <span className="text-[var(--color-accent-mint)] font-bold">LIVE</span>
          ) : (
            <span className="text-[var(--color-accent-rose)] animate-pulse font-bold">
              RECONNECTING...
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
