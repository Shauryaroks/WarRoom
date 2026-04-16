"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

import { useAuthStore } from "@/stores/auth-store";
import { useGameStore } from "@/stores/game-store";
import { useWebSocket } from "@/hooks/use-websocket";
import type { GameStatePayload } from "@/lib/types";

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function GamePage() {
  const router = useRouter();
  const { isAuthenticated, teamName, ticker } = useAuthStore();
  const { status, elapsedSeconds, currentRound } = useGameStore();

  // Redirect unauthenticated users
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isAuthenticated, router]);

  // Redirect to lobby if game hasn't started
  useEffect(() => {
    if (isAuthenticated && status === "SETUP") {
      router.push("/lobby");
    }
  }, [isAuthenticated, status, router]);

  // Handle WebSocket messages
  const handleMessage = useCallback((data: Record<string, unknown>) => {
    if (data.type === "game_state_changed" || data.type === "game_started") {
      const payload = data.payload as GameStatePayload;
      if (payload) {
        useGameStore.getState().setGameState(payload);
      }
    }
  }, []);

  useWebSocket({
    onMessage: handleMessage,
    enabled: isAuthenticated,
  });

  if (!isAuthenticated || status === "SETUP") {
    return null;
  }

  const statusStyles =
    status === "ACTIVE"
      ? "text-[#40e56c] bg-[#40e56c]/10 border border-[#40e56c]/30"
      : status === "PAUSED"
        ? "text-[#9ecaff] bg-[#9ecaff]/10 border border-[#9ecaff]/30"
        : "text-[#FF1744] bg-[#FF1744]/10 border border-[#FF1744]/30";

  return (
    <div className="bg-[#131313] min-h-screen flex flex-col">
      {/* Pause overlay */}
      {status === "PAUSED" && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="border border-[#9ecaff]/30 bg-[#131313] px-8 py-6 text-center">
            <div className="font-mono text-2xl font-bold text-[#9ecaff]">GAME PAUSED</div>
            <p className="mt-2 text-sm text-[#89919d]">Waiting for admin to resume...</p>
          </div>
        </div>
      )}

      {/* Top header */}
      <header className="flex justify-between items-center w-full px-4 h-12 bg-[#0e0e0e] border-b border-[#2a2a2a] z-50">
        <div className="flex items-center gap-6">
          <span className="text-xl font-black tracking-tighter text-[#2196f3]">COMPLEX</span>
          <div className="flex items-center gap-4 border-l border-[#2a2a2a] pl-6">
            <div className="flex flex-col">
              <span className="text-[10px] text-[#89919d] uppercase font-bold tracking-widest">TEAM</span>
              <span className="font-mono text-xs font-bold text-[#9ecaff]">{teamName}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-[#89919d] uppercase font-bold tracking-widest">TICKER</span>
              <span className="font-mono text-xs font-bold text-[#e5e2e1]">${ticker}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3 bg-[#1c1b1b] px-3 py-1 border border-[#404752]/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full bg-[#2196f3] opacity-75" />
              <span className="relative inline-flex h-2 w-2 bg-[#2196f3]" />
            </span>
            <span className="font-mono text-xs font-bold text-[#2196f3]">LIVE // Q{currentRound}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-[#89919d] uppercase font-bold tracking-widest">ELAPSED</span>
            <span className="font-mono text-sm font-bold text-[#e5e2e1] tabular-nums">{formatElapsed(elapsedSeconds)}</span>
          </div>
          <div className={`font-mono text-xs font-bold px-3 py-1 ${statusStyles}`}>
            {status}
          </div>
        </div>
      </header>

      {/* Main content placeholder */}
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="font-mono text-xs text-[#89919d] uppercase tracking-widest">AWAITING_MODULE_LOAD</div>
          <p className="font-mono text-sm text-[#404752]">
            Trading interface will be deployed in Phase 3
          </p>
          <div className="flex justify-center gap-8 mt-8">
            <div className="bg-[#1c1b1b] p-4 border-l-2 border-[#2196f3]">
              <div className="font-mono text-[9px] text-[#89919d] uppercase">MODULE</div>
              <div className="font-mono text-xs text-[#2196f3]">STRATEGY_EDITOR</div>
            </div>
            <div className="bg-[#1c1b1b] p-4 border-l-2 border-[#404752]">
              <div className="font-mono text-[9px] text-[#89919d] uppercase">MODULE</div>
              <div className="font-mono text-xs text-[#404752]">MARKET_CHARTS</div>
            </div>
            <div className="bg-[#1c1b1b] p-4 border-l-2 border-[#404752]">
              <div className="font-mono text-[9px] text-[#89919d] uppercase">MODULE</div>
              <div className="font-mono text-xs text-[#404752]">INTEL_STREAM</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
