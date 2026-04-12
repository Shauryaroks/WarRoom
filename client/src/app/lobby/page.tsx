"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LobbyPage() {
  const router = useRouter();
  const [players, setPlayers] = useState([
    { id: "op_01", name: "ALPHA_CORP", status: "READY" },
    { id: "op_02", name: "OMEGA_FUNDS", status: "READY" },
    { id: "op_03", name: "ZETA_TRADING", status: "WAITING" },
  ]);

  const [countdown, setCountdown] = useState<number | null>(null);

  // Mock game start
  useEffect(() => {
    if (countdown !== null) {
      if (countdown > 0) {
        const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        router.push("/game");
      }
    }
  }, [countdown, router]);

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
              key={player.id}
              className="flex justify-between items-center text-sm py-1 border-b border-[#111]"
            >
              <span className="text-gray-400">[{player.id}]</span>
              <span className="flex-1 ml-4">{player.name}</span>
              <span
                className={`${player.status === "READY" ? "text-[#00FF00]" : "text-[#FF0000]"}`}
              >
                {player.status}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-[#333] pt-6">
          <button
            onClick={() => router.push("/login")}
            className="text-xs text-gray-500 hover:text-white uppercase tracking-wider"
          >
            [ ESC: DISCONNECT ]
          </button>

          {countdown !== null ? (
            <div className="text-[#0077b6] font-bold text-lg animate-pulse">
              COMMENCING IN T-{countdown}...
            </div>
          ) : (
            <button
              onClick={() => {
                setPlayers(
                  players.map((p) =>
                    p.id === "op_03" ? { ...p, status: "READY" } : p,
                  ),
                );
                setCountdown(5);
              }}
              className="bg-[#00FF00] text-black font-bold uppercase tracking-widest px-6 py-2 text-sm hover:bg-[#33FF33] transition-colors"
            >
              SIGNAL_READY
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
