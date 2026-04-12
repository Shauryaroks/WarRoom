"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { TeamSummary } from "@/lib/models";
import { useWebSocket } from "@/contexts/WebSocketContext";

export default function LobbyPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<TeamSummary[]>([]);
  const { gameState } = useWebSocket();

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const teams = await api.getTeams();
        setPlayers(teams);
      } catch (err) {
        console.error("Failed to fetch teams:", err);
      }
    };
    fetchTeams();
    const interval = setInterval(fetchTeams, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (gameState?.status === "ACTIVE") {
      router.push("/game");
    }
  }, [gameState, router]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#00FF00] font-mono flex items-center justify-center p-4">
      <div className="w-full max-w-2xl border border-[#333] p-6 bg-[#111]">
        <div className="flex justify-between items-center mb-6 border-b border-[#333] pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-widest uppercase text-[#0077b6]">
              &gt; WAITING_ROOM
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Awaiting other operators...
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm">
              STATUS:{" "}
              <span className="text-[#00FF00] animate-pulse">ESTABLISHED</span>
            </div>
            <div className="text-xs text-gray-500">
              PEERS: {players.length}/10
            </div>
          </div>
        </div>

        <div className="space-y-2 mb-8 h-64 overflow-y-auto border border-[#222] p-2 bg-black">
          {players.map((player) => (
            <div
              key={player.team_id}
              className="flex justify-between items-center text-sm py-1 border-b border-[#111]"
            >
              <span className="text-gray-400">[{player.ticker}]</span>
              <span className="flex-1 ml-4">{player.name}</span>
              <span
                className={`${player.status === "ACTIVE" || player.status === "READY" ? "text-[#00FF00]" : "text-[#FF0000]"}`}
              >
                {player.status}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-[#333] pt-6">
          <button
            onClick={() => router.push("/auth/login")}
            className="text-xs text-gray-500 hover:text-white uppercase tracking-wider"
          >
            [ ESC: DISCONNECT ]
          </button>

          <div className="text-[#0077b6] font-bold text-lg animate-pulse">
            AWAITING SYSTEM START...
          </div>
        </div>
      </div>
    </div>
  );
}
