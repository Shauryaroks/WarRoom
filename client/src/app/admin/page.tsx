"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import { useAuthStore } from "@/stores/auth-store";
import { useGameStore } from "@/stores/game-store";
import { useWebSocket } from "@/hooks/use-websocket";
import { api } from "@/lib/api";
import type { GameStatePayload } from "@/lib/types";

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function AdminPage() {
  const router = useRouter();
  const { isAuthenticated, role } = useAuthStore();
  const { status, elapsedSeconds, currentRound, setGameState } = useGameStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect non-admin users
  useEffect(() => {
    if (!isAuthenticated || role !== "admin") {
      router.push("/admin/login");
    }
  }, [isAuthenticated, role, router]);

  // Load initial game state on mount
  useEffect(() => {
    if (isAuthenticated && role === "admin") {
      api
        .getGameState()
        .then((data) => {
          setGameState({
            status: data.status as GameStatePayload["status"],
            elapsed_seconds: data.elapsed_seconds,
            current_round: data.current_round,
          });
        })
        .catch(() => {
          // Will populate via WebSocket
        });
    }
  }, [isAuthenticated, role, setGameState]);

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
    enabled: isAuthenticated && role === "admin",
  });

  async function handleStart() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.startGame();
      setGameState({
        status: data.status as GameStatePayload["status"],
        elapsed_seconds: data.elapsed_seconds,
        current_round: data.current_round,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start game");
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePause() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.pauseGame();
      setGameState({
        status: data.status as GameStatePayload["status"],
        elapsed_seconds: data.elapsed_seconds,
        current_round: data.current_round,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to pause game");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResume() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.resumeGame();
      setGameState({
        status: data.status as GameStatePayload["status"],
        elapsed_seconds: data.elapsed_seconds,
        current_round: data.current_round,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resume game");
    } finally {
      setIsLoading(false);
    }
  }

  if (!isAuthenticated || role !== "admin") {
    return null;
  }

  const statusColor =
    status === "ACTIVE"
      ? "text-green-400 bg-green-400/10 border-green-400/30"
      : status === "PAUSED"
        ? "text-amber-400 bg-amber-400/10 border-amber-400/30"
        : status === "FINISHED"
          ? "text-red-400 bg-red-400/10 border-red-400/30"
          : "text-muted-foreground bg-muted/10 border-border";

  return (
    <div className="bg-background min-h-screen flex flex-col items-center px-4 pt-16">
      <div className="w-full max-w-[480px] space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="font-mono text-xl font-semibold text-primary">
            COMPLEX
          </h1>
          <p className="text-xs text-muted-foreground">Game Control Panel</p>
        </div>

        {/* Status card */}
        <div className="border border-border bg-card p-6 space-y-6">
          {/* Status badge */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              Game Status
            </span>
            <div
              className={`font-mono text-xs font-bold px-3 py-1 border ${statusColor}`}
            >
              {status}
            </div>
          </div>

          {/* Timer */}
          <div className="text-center py-4">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
              Elapsed Time
            </div>
            <div className="font-mono text-4xl font-bold text-foreground tabular-nums">
              {formatElapsed(elapsedSeconds)}
            </div>
          </div>

          {/* Quarter */}
          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              Current Quarter
            </span>
            <span className="font-mono text-lg font-bold text-foreground">
              Q{currentRound}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-3">
          {status === "SETUP" && (
            <button
              onClick={handleStart}
              disabled={isLoading}
              className="w-full font-mono text-sm font-bold px-4 py-3 border border-green-400/30 bg-green-400/10 text-green-400 hover:bg-green-400/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "STARTING..." : "START GAME"}
            </button>
          )}

          {status === "ACTIVE" && (
            <button
              onClick={handlePause}
              disabled={isLoading}
              className="w-full font-mono text-sm font-bold px-4 py-3 border border-amber-400/30 bg-amber-400/10 text-amber-400 hover:bg-amber-400/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "PAUSING..." : "PAUSE GAME"}
            </button>
          )}

          {status === "PAUSED" && (
            <button
              onClick={handleResume}
              disabled={isLoading}
              className="w-full font-mono text-sm font-bold px-4 py-3 border border-green-400/30 bg-green-400/10 text-green-400 hover:bg-green-400/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "RESUMING..." : "RESUME GAME"}
            </button>
          )}

          {status === "FINISHED" && (
            <div className="w-full font-mono text-sm text-center px-4 py-3 border border-red-400/30 bg-red-400/10 text-red-400">
              GAME FINISHED
            </div>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="border border-red-400/30 bg-red-400/10 px-4 py-3">
            <p className="font-mono text-xs text-red-400">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
