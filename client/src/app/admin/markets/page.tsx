"use client";

import { useEffect } from "react";
import { useAdminStore } from "@/stores/admin-store";
import { api } from "@/lib/api";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "text-[#9ecaff] bg-[#9ecaff]/10",
  READY: "text-[#40e56c] bg-[#40e56c]/10",
  ACTIVE: "text-[#40e56c] bg-[#40e56c]/10",
  BANKRUPT: "text-[#FF1744] bg-[#FF1744]/10",
  ELIMINATED: "text-[#FF1744] bg-[#FF1744]/10",
  REJECTED: "text-[#FF1744] bg-[#FF1744]/10",
};

const PLACEHOLDER_BARS = [40, 55, 45, 60, 50, 65, 70, 55, 75, 80];

export default function MarketsPage() {
  const { teams, setTeams } = useAdminStore();

  useEffect(() => {
    api
      .getTeams()
      .then((data) => setTeams(data))
      .catch(() => {});
  }, [setTeams]);

  return (
    <div className="flex flex-col gap-6 w-full">
      <h2 className="text-base font-black font-mono tracking-widest text-[#9ecaff] uppercase">
        MARKET_OVERVIEW
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {teams.map((team) => (
          <div key={team.id} className="bg-[#1c1b1b] p-6 flex flex-col gap-3">
            {/* Team name + ticker */}
            <div className="flex items-center justify-between">
              <span className="font-bold text-base text-[#e5e2e1] font-mono">
                {team.name}
              </span>
              <span className="text-sm font-mono text-[#9ecaff] bg-[#9ecaff]/10 px-3 py-1">
                {team.ticker}
              </span>
            </div>

            {/* Price */}
            <div className="text-3xl font-bold font-mono text-[#e5e2e1]">
              $100.00
            </div>

            {/* Change */}
            <div className="text-sm font-mono text-[#40e56c]">+0.00%</div>

            {/* CSS Sparkline bars */}
            <div className="flex items-end gap-0.5 h-10 mt-2">
              {PLACEHOLDER_BARS.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 bg-[#2196f3]/40"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>

            {/* Status chip */}
            <div className="mt-2">
              <span
                className={`text-xs font-mono px-3 py-1 uppercase ${STATUS_STYLES[team.status] || "text-[#89919d] bg-[#89919d]/10"}`}
              >
                {team.status}
              </span>
            </div>
          </div>
        ))}

        {teams.length === 0 && (
          <div className="col-span-full text-center py-12">
            <p className="font-mono text-sm text-gray-600">
              NO_TEAMS_REGISTERED // AWAITING_REGISTRATION
            </p>
          </div>
        )}
      </div>

      <p className="text-sm font-mono text-gray-600">
        MARKET_DATA // LIVE_FEED_AVAILABLE_Q4
      </p>
    </div>
  );
}
