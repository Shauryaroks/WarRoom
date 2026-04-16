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

  const statusStyles =
    status === "ACTIVE"
      ? "text-[#40e56c] bg-[#40e56c]/10 border border-[#40e56c]/30"
      : status === "PAUSED"
        ? "text-[#9ecaff] bg-[#9ecaff]/10 border border-[#9ecaff]/30"
        : status === "FINISHED"
          ? "text-[#FF1744] bg-[#FF1744]/10 border border-[#FF1744]/30"
          : "text-[#89919d] bg-[#89919d]/10 border border-[#89919d]/30";

  return (
    <div className="grid grid-cols-12 gap-6 w-full">
      {/* Game Control Station */}
      <div className="col-span-12 lg:col-span-5 bg-[#1c1b1b] p-6 flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-black font-mono tracking-widest text-[#9ecaff] uppercase">
            GAME_CONTROL_STATION
          </h2>
          <span className="flex items-center gap-2 font-mono text-[11px] text-[#40e56c]">
            <span className="w-2 h-2 bg-[#40e56c] animate-pulse" /> SYSTEM_LIVE
          </span>
        </div>

        {/* Control buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={handleStart}
            disabled={isLoading || status !== "SETUP"}
            className="bg-[#02c953] text-[#003912] py-5 flex flex-col items-center justify-center gap-1 hover:brightness-110 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <span className="text-xl">&#9654;</span>
            <span className="font-mono text-[13px] font-bold">START</span>
          </button>
          <button
            onClick={handlePause}
            disabled={isLoading || status !== "ACTIVE"}
            className="bg-[#2a2a2a] text-[#e5e2e1] py-5 flex flex-col items-center justify-center gap-1 hover:brightness-125 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <span className="text-xl">&#9646;&#9646;</span>
            <span className="font-mono text-[13px] font-bold">PAUSE</span>
          </button>
          <button
            onClick={handleResume}
            disabled={isLoading || status !== "PAUSED"}
            className="bg-[#2a2a2a] text-[#e5e2e1] py-5 flex flex-col items-center justify-center gap-1 hover:brightness-125 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <span className="text-xl">&#8635;</span>
            <span className="font-mono text-[13px] font-bold">RESUME</span>
          </button>
        </div>

        {/* Broadcast input */}
        <div className="flex flex-col gap-2">
          <label className="font-mono text-[11px] text-gray-500 uppercase tracking-tighter">
            GLOBAL_BROADCAST_CHANNEL
          </label>
          <div className="relative">
            <textarea
              className="w-full bg-[#0e0e0e] border-l-2 border-[#2196f3] text-sm font-mono p-4 text-[#2196f3] h-24 placeholder:text-gray-800 focus:outline-none focus:ring-0"
              placeholder="ENTER MESSAGE TO ALL TEAMS..."
              disabled
            />
            <span className="absolute bottom-4 right-4 font-mono text-[9px] text-gray-600 uppercase">
              COMING_SOON
            </span>
          </div>
        </div>
      </div>

      {/* Status + Timer panel */}
      <div className="col-span-12 lg:col-span-7 bg-[#1c1b1b] p-6">
        <h2 className="text-base font-black font-mono tracking-widest text-[#9ecaff] uppercase mb-6">
          GAME_STATE_MONITOR
        </h2>

        {/* Status badge row */}
        <div className="flex items-center justify-between mb-6">
          <span className="font-mono text-[11px] text-gray-500 uppercase tracking-widest">
            STATUS
          </span>
          <div
            className={`font-mono text-[13px] font-bold px-3 py-1 ${statusStyles}`}
          >
            {status}
          </div>
        </div>

        {/* Timer display */}
        <div className="text-center py-8">
          <div className="font-mono text-[11px] text-gray-500 uppercase tracking-widest mb-2">
            ELAPSED_TIME
          </div>
          <div className="font-mono text-7xl font-black text-[#e5e2e1] tabular-nums">
            {formatElapsed(elapsedSeconds)}
          </div>
        </div>

        {/* Quarter display */}
        <div className="flex items-center justify-between border-t border-[#404752] pt-4">
          <span className="font-mono text-[11px] text-gray-500 uppercase tracking-widest">
            CURRENT_QUARTER
          </span>
          <span className="font-mono text-3xl font-bold text-[#e5e2e1]">
            Q{currentRound}
          </span>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="col-span-12 border border-[#FF1744]/30 bg-[#FF1744]/10 px-4 py-3">
          <p className="font-mono text-[13px] text-[#FF1744]">{error}</p>
        </div>
      )}
    </div>
  );
}
