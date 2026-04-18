"use client";

import { useAuthStore } from "@/stores/auth-store";
import { useGameStore } from "@/stores/game-store";
import { useTradingStore } from "@/stores/trading-store";
import { useLiveElapsed } from "@/hooks/use-live-elapsed";

export function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatCash(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return "$0.00";
  return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function GameHeader() {
  const { teamName, ticker } = useAuthStore();
  const { status, currentRound } = useGameStore();
  const elapsedSeconds = useLiveElapsed();
  const cash = useTradingStore((s) => s.cash);

  const statusLabel = status === "ACTIVE" ? "LIVE" : status;
  const statusStyles =
    status === "ACTIVE"
      ? "text-[#40e56c] bg-[#40e56c]/10 border border-[#40e56c]/30"
      : status === "PAUSED"
        ? "text-[#9ecaff] bg-[#9ecaff]/10 border border-[#9ecaff]/30"
        : "text-[#FF1744] bg-[#FF1744]/10 border border-[#FF1744]/30";

  return (
    <header className="flex justify-between items-center w-full px-2 md:px-4 h-12 bg-[#0e0e0e] border-b border-[#2a2a2a] z-50 shrink-0">
      <div className="flex items-center gap-3 md:gap-6 min-w-0">
        <span className="text-xl font-black tracking-tighter text-[#2196f3] shrink-0">
          COMPLEX
        </span>
        <div className="flex items-center gap-2 md:gap-4 border-l border-[#2a2a2a] pl-3 md:pl-6 min-w-0">
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] text-[#89919d] uppercase font-bold tracking-widest">
              TEAM
            </span>
            <span className="font-mono text-xs font-bold text-[#9ecaff] truncate max-w-[120px] md:max-w-none">
              {teamName}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-[#89919d] uppercase font-bold tracking-widest">
              TICKER
            </span>
            <span className="font-mono text-xs font-bold text-[#e5e2e1]">
              ${ticker}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 md:gap-8 shrink-0">
        <div className="flex items-center gap-3 bg-[#1c1b1b] px-3 py-1 border border-[#404752]/20">
          {status === "ACTIVE" && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full bg-[#40e56c] opacity-75" />
              <span className="relative inline-flex h-2 w-2 bg-[#40e56c]" />
            </span>
          )}
          <span className="font-mono text-xs font-bold text-[#2196f3]">
            {statusLabel} // Q{currentRound}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-[#89919d] uppercase font-bold tracking-widest">
            ELAPSED
          </span>
          <span className="font-mono text-sm font-bold text-[#e5e2e1] tabular-nums">
            {formatElapsed(elapsedSeconds)}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-[#89919d] uppercase font-bold tracking-widest">
            CASH
          </span>
          <span className="font-mono text-sm font-bold text-[#40e56c] tabular-nums">
            {formatCash(cash)}
          </span>
        </div>
        <div
          className={`font-mono text-xs font-bold px-3 py-1 ${statusStyles}`}
        >
          {statusLabel}
        </div>
      </div>
    </header>
  );
}
