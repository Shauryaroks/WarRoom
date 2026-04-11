"use client";

import React from "react";

interface HeaderBarProps {
  sessionElapsed?: string;
  timerSeq?: string;
  nextPurge?: string;
  ticker?: string;
  latency?: string;
}

export function HeaderBar({
  sessionElapsed = "05:23:17",
  timerSeq = "2/4",
  ticker = "$XXX",
  latency = "12ms",
}: HeaderBarProps) {
  const gameState = "ACTIVE"; // Could come from context

  return (
    <header className="flex h-full w-full justify-between items-center px-4 font-mono text-[13px] bg-[#0a0a0a] text-[#e0e0e0]">
      {/* Left Zone */}
      <div className="flex items-center gap-3 w-[380px]">
        <div className="w-2 h-2 rounded-full bg-[#00c853] animate-pulse"></div>
        <span className="font-bold tracking-wide">COMPLEX_TERMINAL</span>
        <span className="text-[#505050] text-[11px]">v1.0.4</span>
        {gameState === "ACTIVE" && (
          <span className="border border-[#00c853] text-[#00c853] px-1.5 py-0.5 text-[11px]">
            [LIVE]
          </span>
        )}
      </div>

      {/* Center Zone */}
      <div className="flex items-center gap-6 justify-center flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[#808080]">PHASE:</span>
          <span className="bg-[#00c853]/10 text-[#00c853] px-2 py-0.5">
            [{gameState}]
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#808080]">T-MINUS:</span>
          <span className="text-[#ffb000] tabular-nums font-bold">
            [{sessionElapsed}]
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#808080]">ROUND:</span>
          <span className="text-[#e0e0e0]">[{timerSeq}]</span>
        </div>
      </div>

      {/* Right Zone */}
      <div className="flex items-center gap-4 justify-end w-[380px]">
        <span className="text-[#ffb000] font-bold text-[14px]">{ticker}</span>
        <span className="text-[#505050]">|</span>
        <div className="flex items-center gap-2">
          <span className="text-[#808080]">WS:</span>
          <span className="text-[#00c853]">{latency}</span>
        </div>
        <div className="flex gap-0.5 text-[#00c853] tracking-widest text-[10px]">
          [■■■■]
        </div>
      </div>
    </header>
  );
}
