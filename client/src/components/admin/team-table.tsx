"use client";

import type { AdminTeam } from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "text-[#9ecaff] bg-[#9ecaff]/10",
  READY: "text-[#40e56c] bg-[#40e56c]/10",
  ACTIVE: "text-[#40e56c] bg-[#40e56c]/10",
  BANKRUPT: "text-[#FF1744] bg-[#FF1744]/10",
  ELIMINATED: "text-[#FF1744] bg-[#FF1744]/10",
  REJECTED: "text-gray-500 bg-gray-500/10",
};

interface TeamTableProps {
  teams: AdminTeam[];
  gameStatus: string;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRemove: (id: string) => void;
  onBankrupt?: (id: string) => void;
  onCaseline?: (teamId: string) => void;
  compact?: boolean;
}

export function TeamTable({
  teams,
  gameStatus,
  onApprove,
  onReject,
  onRemove,
  onBankrupt,
  onCaseline,
  compact = false,
}: TeamTableProps) {
  if (teams.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="font-mono text-gray-600 text-sm tracking-widest">
          NO_TEAMS_REGISTERED
        </span>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#2a2a2a]">
            <th className="text-left text-sm text-gray-600 uppercase font-mono tracking-widest py-3 pr-4">
              TEAM_NAME
            </th>
            <th className="text-left text-sm text-gray-600 uppercase font-mono tracking-widest py-3 pr-4">
              TICKER
            </th>
            <th className="text-left text-sm text-gray-600 uppercase font-mono tracking-widest py-3 pr-4">
              STATUS
            </th>
            <th className="text-center text-sm text-gray-600 uppercase font-mono tracking-widest py-3 pr-4">
              SUBMISSIONS
            </th>
            <th className="text-right text-sm text-gray-600 uppercase font-mono tracking-widest py-3 pr-4">
              VALUATION
            </th>
            {!compact && (
              <th className="text-right text-sm text-gray-600 uppercase font-mono tracking-widest py-3">
                ACTIONS
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => (
            <tr key={team.id} className="hover:bg-[#2a2a2a] transition-colors">
              <td className="py-5 pr-4 font-mono font-bold text-[#e5e2e1] text-sm">
                <span>{team.name}</span>
                {team.archetype_name && (
                  <span className="ml-2 text-[10px] font-normal text-[#2196f3]/70 uppercase">
                    {team.archetype_name}
                  </span>
                )}
              </td>
              <td className="py-5 pr-4 font-mono text-gray-500 text-sm">
                {team.ticker}
              </td>
              <td className="py-5 pr-4">
                <span
                  className={`inline-block font-mono text-xs font-bold px-3 py-1 uppercase tracking-wider ${STATUS_STYLES[team.status] || "text-gray-500 bg-gray-500/10"}`}
                >
                  {team.status}
                </span>
              </td>
              <td className="py-5 pr-4 text-center font-mono text-sm text-gray-500">
                0
              </td>
              <td className="py-5 pr-4 text-right font-mono text-sm text-[#e5e2e1]">
                $100.00
              </td>
              {!compact && (
                <td className="py-5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {team.status === "PENDING" && (
                      <>
                        <button
                          onClick={() => onApprove(team.id)}
                          className="font-mono text-sm font-bold px-5 py-2.5 bg-[#02c953] text-[#003912] hover:brightness-110 active:scale-95 transition-all"
                        >
                          APPROVE
                        </button>
                        <button
                          onClick={() => onReject(team.id)}
                          className="font-mono text-sm font-bold px-5 py-2.5 bg-[#FF1744]/80 text-white hover:bg-[#FF1744] active:scale-95 transition-all"
                        >
                          REJECT
                        </button>
                      </>
                    )}
                    {gameStatus === "SETUP" && onCaseline && (
                      <button
                        onClick={() => onCaseline(team.id)}
                        className="font-mono text-sm font-bold px-5 py-2.5 bg-[#2a2a2a] text-[#2196f3] hover:bg-[#2196f3]/10 active:scale-95 transition-all"
                      >
                        CASELINE
                      </button>
                    )}
                    {onBankrupt &&
                      team.status !== "BANKRUPT" &&
                      team.status !== "ELIMINATED" &&
                      team.status !== "REJECTED" &&
                      team.status !== "PENDING" && (
                        <button
                          onClick={() => {
                            if (
                              window.confirm(
                                `Mark ${team.name} as bankrupt? Stock price drops to 0, team is frozen out of trading but the record is preserved.`,
                              )
                            ) {
                              onBankrupt(team.id);
                            }
                          }}
                          className="font-mono text-sm font-bold px-5 py-2.5 bg-[#f5a623]/10 text-[#f5a623] hover:bg-[#f5a623]/20 active:scale-95 transition-all"
                        >
                          BANKRUPT
                        </button>
                      )}
                    <button
                      onClick={() => {
                        if (
                          window.confirm(
                            `Permanently DELETE ${team.name}? This wipes the team, their holdings, trades, and price history. No restore.`,
                          )
                        ) {
                          onRemove(team.id);
                        }
                      }}
                      className="font-mono text-sm font-bold px-5 py-2.5 bg-[#FF1744]/10 text-[#FF1744] hover:bg-[#FF1744]/20 active:scale-95 transition-all"
                    >
                      DELETE
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
