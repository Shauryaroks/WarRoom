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

  const statusColor =
    status === "ACTIVE"
      ? "text-green-400 bg-green-400/10 border-green-400/30"
      : status === "PAUSED"
        ? "text-amber-400 bg-amber-400/10 border-amber-400/30"
        : "text-red-400 bg-red-400/10 border-red-400/30";

  return (
    <div className="bg-background min-h-screen flex flex-col">
      {/* Pause overlay */}
      {status === "PAUSED" && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="border border-amber-400/30 bg-background px-8 py-6 text-center">
            <div className="font-mono text-2xl font-bold text-amber-400">
              GAME PAUSED
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Waiting for admin to resume...
            </p>
          </div>
        </div>
      )}

      {/* Header bar */}
      <header className="border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="font-mono text-sm font-bold text-primary">COMPLEX</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-foreground font-medium">
              {teamName}
            </span>
            <span className="font-mono text-xs font-bold text-primary">
              {ticker}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Quarter */}
          <div className="text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Quarter
            </div>
            <div className="font-mono text-lg font-bold text-foreground">
              Q{currentRound}
            </div>
          </div>

          {/* Timer */}
          <div className="text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Elapsed
            </div>
            <div className="font-mono text-lg font-bold text-foreground tabular-nums">
              {formatElapsed(elapsedSeconds)}
            </div>
          </div>

          {/* Status badge */}
          <div
            className={`font-mono text-xs font-bold px-3 py-1 border ${statusColor}`}
          >
            {status}
          </div>
        </div>
      </header>

      {/* Main content placeholder */}
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="font-mono text-sm text-muted-foreground">
            Trading interface will appear here
          </p>
          <p className="text-xs text-muted-foreground/60">
            Phase 3: Charts, order book, and portfolio
          </p>
        </div>
      </main>
    </div>
  );
}
