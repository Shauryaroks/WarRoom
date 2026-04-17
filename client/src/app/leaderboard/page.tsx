"use client";

import { useEffect, useState, useCallback } from "react";
import { useWebSocket } from "@/hooks/use-websocket";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import type { LeaderboardEntry } from "@/lib/types";

export default function LeaderboardPage() {
  const { isAuthenticated } = useAuthStore();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    if (!isAuthenticated) return;
    api
      .getLeaderboard()
      .then(setEntries)
      .catch(() => {});
  }, [isAuthenticated]);

  const handleMessage = useCallback((data: Record<string, unknown>) => {
    if (data.type === "leaderboard_update" || data.type === "price_update") {
      api
        .getLeaderboard()
        .then(setEntries)
        .catch(() => {});
    }
  }, []);

  useWebSocket({ onMessage: handleMessage, enabled: isAuthenticated });

  return (
    <div className="bg-[#131313] min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-mono text-2xl font-black text-[#9ecaff] uppercase tracking-widest">
            COMPETITION_LEADERBOARD
          </h1>
          <a
            href="/game"
            className="font-mono text-xs text-[#2196f3] uppercase hover:underline"
          >
            BACK_TO_TERMINAL
          </a>
        </div>

        <div className="border border-[#404752]/20">
          {/* Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-[#0e0e0e] font-mono text-[10px] text-gray-500 uppercase tracking-widest">
            <div className="col-span-1">RANK</div>
            <div className="col-span-3">TEAM</div>
            <div className="col-span-2">TICKER</div>
            <div className="col-span-3 text-right">STOCK_PRICE</div>
            <div className="col-span-2 text-right">CHANGE</div>
            <div className="col-span-1 text-right">STATUS</div>
          </div>

          {/* Rows */}
          {entries.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="font-mono text-sm text-gray-600">
                NO_TEAMS_ACTIVE // Leaderboard populates when game starts
              </p>
            </div>
          ) : (
            entries.map((entry, i) => {
              const isEliminated =
                entry.status === "ELIMINATED" || entry.status === "BANKRUPT";
              return (
                <div
                  key={entry.team_id}
                  className={`grid grid-cols-12 gap-4 px-6 py-4 border-t border-[#404752]/10 ${
                    isEliminated ? "opacity-40" : "hover:bg-[#1c1b1b]"
                  } transition-colors`}
                >
                  <div className="col-span-1 font-mono text-lg font-bold text-[#9ecaff]">
                    {i + 1}
                  </div>
                  <div className="col-span-3 font-mono text-sm font-bold text-[#e5e2e1] truncate">
                    {entry.name}
                  </div>
                  <div className="col-span-2 font-mono text-sm font-bold text-[#2196f3]">
                    {entry.ticker}
                  </div>
                  <div
                    className={`col-span-3 text-right font-mono text-lg font-bold ${
                      isEliminated ? "text-[#FF1744]" : "text-[#e5e2e1]"
                    }`}
                  >
                    ${Number(entry.stock_price).toFixed(2)}
                  </div>
                  <div
                    className={`col-span-2 text-right font-mono text-sm font-bold ${
                      Number(entry.change_pct) >= 0
                        ? "text-[#40e56c]"
                        : "text-[#FF1744]"
                    }`}
                  >
                    {Number(entry.change_pct) >= 0 ? "+" : ""}
                    {Number(entry.change_pct).toFixed(1)}%
                  </div>
                  <div className="col-span-1 text-right">
                    {isEliminated ? (
                      <span className="font-mono text-[9px] text-[#FF1744] bg-[#FF1744]/10 px-2 py-1">
                        OUT
                      </span>
                    ) : (
                      <span className="font-mono text-[9px] text-[#40e56c] bg-[#40e56c]/10 px-2 py-1">
                        LIVE
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 flex justify-between items-center">
          <span className="font-mono text-[9px] text-gray-600">
            SYSTEM_STABLE // LATENCY: 14MS
          </span>
          <span className="font-mono text-[9px] text-gray-600">
            RANKINGS_BY_STOCK_PRICE // REAL_TIME
          </span>
        </div>
      </div>
    </div>
  );
}
