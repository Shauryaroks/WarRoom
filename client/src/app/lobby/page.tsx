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
    <div className="bg-background min-h-screen flex flex-col items-center px-4 pt-16">
      {/* Logout button */}
      <div className="fixed top-4 right-4">
        <button
          onClick={handleLogout}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Log out
        </button>
      </div>

      <div className="w-full max-w-[600px] space-y-8">
        {/* Team identity + Status */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">
              {teamName}
            </h1>
            <span className="font-mono text-sm font-bold text-primary">
              {ticker}
            </span>
          </div>

          {/* Status badge */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-primary/10 px-3 py-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              <span className="font-mono text-xs font-medium text-primary">
                WAITING
              </span>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Waiting for admin to start the game...
          </p>
        </div>

        {/* Teams list */}
        <div className="space-y-3">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Teams
          </h2>
          <TeamList teams={teams} />
        </div>
      </div>

      <ConnectionIndicator isConnected={isConnected} />
    </div>
  );
}
