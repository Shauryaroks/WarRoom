"use client";

import React from "react";
import { useWebSocket } from "@/contexts/WebSocketContext";

export function GameGuard({ children }: { children: React.ReactNode }) {
  const { gameState } = useWebSocket();
  const loading = !gameState?.status;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-amber-500 font-mono">
        <div className="text-2xl animate-pulse">CONNECTING TO SYSTEM...</div>
      </div>
    );
  }

  if (gameState?.status === "SETUP") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-amber-500 font-mono">
        <h1 className="text-4xl font-bold mb-4 tracking-widest text-center">
          PRE-GAME LOBBY
        </h1>
        <p className="text-xl mb-8">WAITING FOR MARKET OPEN...</p>
        <div className="animate-pulse border border-amber-500 p-4 inline-block">
          STATUS: STANDBY
        </div>
      </div>
    );
  }

  if (gameState?.status === "FINISHED") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-red-500 font-mono">
        <h1 className="text-6xl font-bold mb-4 tracking-widest">
          GAME OVER
        </h1>
        <p className="text-2xl mb-8">MARKET HAS CLOSED</p>
      </div>
    );
  }

  return <>{children}</>;
}
