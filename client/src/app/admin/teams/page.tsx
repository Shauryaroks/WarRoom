"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { TeamSummary } from "@/lib/models";

export default function TeamsPage() {
  const [filter, setFilter] = useState("ALL");
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // For native HTML select of portfolios
  const [selectedPortfolios, setSelectedPortfolios] = useState<
    Record<string, string>
  >({});
  const [availablePortfolios, setAvailablePortfolios] = useState<string[]>([]);


  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let fetchedTeams: TeamSummary[] = [];
      let currentPorts = availablePortfolios;
      try {
        const ports = await api.adminGetPortfolios();
        setAvailablePortfolios(ports);
        currentPorts = ports;
      } catch (err) {
        console.error("Failed to fetch portfolios", err);
      }

      if (filter === "PENDING") {
        const [pending, ready] = await Promise.all([
          api.getTeams("pending"),
          api.getTeams("ready")
        ]);
        fetchedTeams = [...pending, ...ready];
      } else {
        fetchedTeams = await api.getTeams(filter === "ALL" ? "" : filter.toLowerCase());
      }
      setTeams(fetchedTeams);

      // Initialize selected portfolios for pending teams
      const initialPorts: Record<string, string> = {};
      fetchedTeams.forEach((t) => {
        if (t.status === "PENDING") {
          initialPorts[t.team_id] = currentPorts[0] || "PORT_TECH_01";
        }
      });
      setSelectedPortfolios((prev) => ({ ...initialPorts, ...prev }));
    } catch (err) {
      console.error("Failed to fetch data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (teamId: string) => {
    const portfolioId = selectedPortfolios[teamId] || availablePortfolios[0] || "PORT_TECH_01";
    if (!portfolioId) return;
    try {
      await api.approveTeam(teamId, portfolioId);
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async (teamId: string) => {
    try {
      await api.rejectTeam(teamId);
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleBankrupt = async (teamId: string) => {
    try {
      await api.forceBankruptTeam(teamId);
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
    }).format(val);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto p-4">
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-[#111] p-4 border border-[#2a2a2a] rounded-[6px] gap-4">
        <div>
          <h1 className="text-xl text-gray-200 font-['Inter',sans-serif]">
            Approvals & Management
          </h1>
          <p className="text-sm text-gray-500 mt-1 font-['Inter',sans-serif]">
            Manage active operators and enforce market rules.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
            {[
              "ALL",
              "PENDING",
              "ACTIVE",
              "COOLDOWN",
              "BANKRUPT",
              "ELIMINATED",
            ].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded transition-colors font-['Inter',sans-serif] ${
                filter === f
                  ? "bg-[#0077b6] text-black"
                  : "bg-[#2a2a2a] text-gray-400 hover:text-gray-200"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      <div className="bg-[#111] rounded-[6px] border border-[#2a2a2a] overflow-x-auto">
        <table className="min-w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#2a2a2a] text-gray-500 text-xs uppercase tracking-wider font-['Inter',sans-serif] h-12">
              <th className="px-4 font-medium">Team</th>
              <th className="px-4 font-medium">Ticker</th>
              <th className="px-4 font-medium">Status</th>
              <th className="px-4 font-medium hidden sm:table-cell">
                Liquidity
              </th>
              <th className="px-4 font-medium hidden sm:table-cell">
                Market Cap
              </th>
              <th className="px-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2a2a2a]">
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-gray-500 font-['JetBrains_Mono',monospace]"
                >
                  LOADING_DATA...
                </td>
              </tr>
            ) : teams.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-gray-500 font-['Inter',sans-serif]"
                >
                  No teams found.
                </td>
              </tr>
            ) : (
              teams.map((team, idx) => (
                <tr
                  key={team.team_id}
                  className={`h-[56px] transition-colors ${
                    idx % 2 === 0 ? "bg-[#111]" : "bg-[#161616]"
                  } hover:bg-[#1a1a1a]`}
                >
                  <td className="px-4 whitespace-nowrap text-gray-200 font-['Inter',sans-serif] text-sm">
                    {team.name}
                  </td>
                  <td className="px-4 whitespace-nowrap text-white font-['JetBrains_Mono',monospace] text-sm">
                    {team.ticker}
                  </td>
                  <td className="px-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 text-xs font-bold rounded-sm font-['JetBrains_Mono',monospace] ${
                        team.status === "ACTIVE"
                          ? "bg-[#00c853]/20 text-[#00c853]"
                          : team.status === "ELIMINATED" ||
                              team.status === "BANKRUPT"
                            ? "bg-[#ff3333]/20 text-[#ff3333]"
                            : team.status === "COOLDOWN"
                              ? "bg-[#0077b6]/20 text-[#0077b6]"
                              : team.status === "READY"
                                ? "bg-[#00c853]/10 text-[#00c853]"
                                : "bg-[#2a2a2a] text-gray-400"
                      }`}
                    >
                      [{team.status}]
                    </span>
                  </td>
                  <td className="px-4 whitespace-nowrap text-gray-400 font-['JetBrains_Mono',monospace] text-sm tabular-nums hidden sm:table-cell">
                    {team.status === "PENDING" || team.status === "READY"
                      ? "---"
                      : formatCurrency(team.market_cap || 0)}
                  </td>
                  <td className="px-4 whitespace-nowrap text-gray-400 font-['JetBrains_Mono',monospace] text-sm tabular-nums hidden sm:table-cell">
                    {team.status === "PENDING" || team.status === "READY"
                      ? "---"
                      : formatCurrency(team.market_cap || 0)}
                  </td>
                  <td className="px-4 whitespace-nowrap text-right space-x-2">
                    {team.status === "PENDING" && (
                      <div className="flex justify-end items-center gap-2">
                        <select
                          className="bg-[#0a0a0a] border border-[#2a2a2a] text-gray-300 text-xs rounded px-2 py-1 outline-none focus:border-[#0077b6] font-['JetBrains_Mono',monospace] w-[130px]"
                          value={selectedPortfolios[team.team_id] || ""}
                          onChange={(e) =>
                            setSelectedPortfolios({
                              ...selectedPortfolios,
                              [team.team_id]: e.target.value,
                            })
                          }
                        >
                          <option value="" disabled>Select Portfolio</option>
                          {availablePortfolios.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleApprove(team.team_id)}
                          className="p-1.5 rounded bg-[#00c853]/10 text-[#00c853] hover:bg-[#00c853]/20 transition-colors"
                          title="Approve"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            check
                          </span>
                        </button>
                        <button
                          onClick={() => handleReject(team.team_id)}
                          className="p-1.5 rounded bg-[#ff3333]/10 text-[#ff3333] hover:bg-[#ff3333]/20 transition-colors"
                          title="Reject"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            close
                          </span>
                        </button>
                      </div>
                    )}
                    {team.status === "READY" && (
                      <span className="text-[#00c853] font-['Inter',sans-serif] text-xs font-bold uppercase tracking-wide">
                        Approved, Awaiting Start
                      </span>
                    )}
                    {(team.status === "ACTIVE" ||
                      team.status === "COOLDOWN") && (
                      <button
                        onClick={() => handleBankrupt(team.team_id)}
                        className="p-1.5 rounded bg-[#ff3333]/10 text-[#ff3333] hover:bg-[#ff3333]/20 transition-colors inline-flex items-center gap-1"
                        title="Force Bankrupt"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          block
                        </span>
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
