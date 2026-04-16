"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import { useAuthStore } from "@/stores/auth-store";
import { useGameStore } from "@/stores/game-store";
import { useWebSocket } from "@/hooks/use-websocket";
import { TeamList } from "@/components/lobby/team-list";
import { ConnectionIndicator } from "@/components/lobby/connection-indicator";
import { api } from "@/lib/api";
import type { ApprovedTeam, GameStatePayload } from "@/lib/types";

export default function LobbyPage() {
  const router = useRouter();
  const { isAuthenticated, teamName, ticker, logout } = useAuthStore();
  const [teams, setTeams] = useState<ApprovedTeam[]>([]);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isAuthenticated, router]);

  // Load initial approved teams
  useEffect(() => {
    if (isAuthenticated) {
      api
        .getApprovedTeams()
        .then((data) => setTeams(data))
        .catch(() => {
          // Silently fail -- teams will populate via WebSocket
        });
    }
  }, [isAuthenticated]);

  // Handle WebSocket messages
  const handleMessage = useCallback(
    (data: Record<string, unknown>) => {
      if (data.type === "team_approved") {
        const team = data as unknown as {
          type: string;
          id: string;
          name: string;
          ticker: string;
        };
        setTeams((prev) => {
          // Avoid duplicates
          if (prev.some((t) => t.id === team.id)) return prev;
          return [
            ...prev,
            { id: team.id, name: team.name, ticker: team.ticker },
          ];
        });
      } else if (data.type === "game_started" || data.type === "game_state_changed") {
        const payload = data.payload as GameStatePayload;
        if (payload) {
          useGameStore.getState().setGameState(payload);
        }
        if (data.type === "game_started") {
          // D-08: Instant redirect, no countdown
          router.push("/game");
        }
      }
    },
    [router]
  );

  const { isConnected } = useWebSocket({
    onMessage: handleMessage,
    enabled: isAuthenticated,
  });

  function handleLogout() {
    logout();
    router.push("/auth/login");
  }

  // Don't render until auth check completes
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="bg-[#131313] min-h-screen flex flex-col">
      {/* Fixed top header */}
      <header className="flex justify-between items-center w-full px-4 h-12 bg-[#0e0e0e] fixed top-0 z-50">
        <div className="flex items-center gap-6">
          <span className="text-xl font-black tracking-tighter text-[#2196f3]">COMPLEX</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-[10px] text-[#bfc7d4] uppercase">{teamName}</span>
          <span className="font-mono text-[10px] text-[#2196f3] font-bold">{ticker}</span>
          <button onClick={handleLogout} className="font-mono text-[10px] text-gray-600 hover:text-white uppercase transition-colors">LOGOUT</button>
        </div>
      </header>

      {/* Main content */}
      <div className="mt-12 mb-6 p-6 grid grid-cols-12 gap-6">
        {/* Hero section */}
        <div className="col-span-12 lg:col-span-8 bg-[#1c1b1b] p-8 relative overflow-hidden border-l-4 border-[#2196f3]">
          <div className="relative z-10 flex flex-col justify-between h-full min-h-[280px]">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-3 h-3 bg-[#2196f3] animate-pulse" />
                <span className="font-mono text-xs tracking-tighter text-[#2196f3]">SYSTEM_STATUS: LIVE_CONNECTION_ESTABLISHED</span>
              </div>
              <h2 className="text-4xl lg:text-7xl font-black tracking-tighter mb-4 text-white uppercase italic">COMPLEX</h2>
              <div className="inline-block bg-[#2196f3] px-4 py-1 mb-8">
                <span className="font-mono text-2xl font-bold tracking-widest text-white">TICKER: {ticker}</span>
              </div>
            </div>
            <div className="mt-auto">
              <p className="text-[#bfc7d4] font-medium tracking-tight mb-2">LOBBY STATUS</p>
              <div className="flex items-baseline gap-4">
                <span className="text-2xl font-bold tracking-tight text-white uppercase">Waiting for admin to start the game...</span>
                <span className="font-mono text-[#2196f3] animate-pulse">_</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats cards */}
        <div className="col-span-12 lg:col-span-4 grid grid-rows-2 gap-6">
          {/* Total Approved Teams */}
          <div className="bg-[#201f1f] p-6 flex flex-col justify-center border-t border-[#404752]">
            <span className="text-xs uppercase tracking-widest text-[#bfc7d4] mb-1 font-bold">Total Approved Teams</span>
            <span className="font-mono text-6xl font-black text-[#2196f3]">{teams.length}</span>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-[10px] font-mono text-[#40e56c] uppercase">All nodes validated</span>
            </div>
          </div>

          {/* Network Latency */}
          <div className="bg-[#201f1f] p-6 flex flex-col justify-center border-t border-[#404752]">
            <span className="text-xs uppercase tracking-widest text-[#bfc7d4] mb-1 font-bold">Network Latency</span>
            <span className="font-mono text-6xl font-black text-[#e5e2e1]">14<span className="text-xl">MS</span></span>
            <div className="mt-4 flex items-center gap-2">
              <ConnectionIndicator isConnected={isConnected} />
            </div>
          </div>
        </div>

        {/* Team Roster table */}
        <section className="col-span-12 bg-[#0e0e0e] border border-[#404752] overflow-hidden flex flex-col">
          <div className="px-6 py-3 bg-[#2a2a2a] flex justify-between items-center border-b border-[#404752]">
            <span className="text-xs font-bold uppercase tracking-widest text-white">Verified Competition Roster</span>
            <span className="font-mono text-[10px] text-[#2196f3] uppercase">FILTER: ALL_TEAMS</span>
          </div>
          <TeamList teams={teams} currentTicker={ticker} />
        </section>
      </div>
    </div>
  );
}
