"use client";
import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { TeamSummary, AdminMetrics, LLMStats, MarketStats } from "@/lib/models";

export default function AdminDashboard() {
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [llm, setLlm] = useState<LLMStats | null>(null);
  const [market, setMarket] = useState<MarketStats | null>(null);

  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Purge State
  const [purgeState, setPurgeState] = useState<
    "PENDING" | "READY" | "CONFIRM" | "PROCESSING" | "COMPLETE"
  >("PENDING");
  const [countdown, setCountdown] = useState(3);

  const fetchData = async () => {
    try {
      const [fetchedTeams, m, l, mk] = await Promise.all([
        api.getTeams(),
        api.adminGetMetrics(),
        api.adminGetLLMStats(),
        api.adminGetMarketStats(),
      ]);
      setTeams(fetchedTeams);
      setMetrics(m);
      setLlm(l);
      setMarket(mk);
    } catch (err) {
      console.error("Failed to fetch data", err);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (purgeState === "PENDING" && metrics) {
      // Simulate safety check delay
      const timer = setTimeout(() => setPurgeState("READY"), 4000);
      return () => clearTimeout(timer);
    }
  }, [purgeState, metrics]);

  useEffect(() => {
    if (purgeState === "CONFIRM" && countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [purgeState, countdown]);

  const handlePurgeAction = async () => {
    if (purgeState === "READY") {
      setPurgeState("CONFIRM");
      setCountdown(3);
    } else if (purgeState === "CONFIRM" && countdown === 0) {
      setPurgeState("PROCESSING");
      try {
        await api.initiatePurge({ confirmation: "PURGE", force: false });
        setPurgeState("COMPLETE");
        fetchData();
      } catch (err) {
        console.error(err);
        setPurgeState("READY");
      }
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
    }).format(val);
  };

  const formatNumber = (val: number) => {
    return new Intl.NumberFormat("en-US", { notation: "compact" }).format(val);
  };

  const filteredTeams = teams.filter((t) => {
    if (statusFilter !== "all" && t.status.toLowerCase() !== statusFilter)
      return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        t.name.toLowerCase().includes(query) ||
        t.ticker.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-4 max-w-7xl mx-auto pb-8 p-4">
      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Game Controls Card */}
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-[6px] p-4 flex flex-col justify-between">
          <h2 className="text-[11px] font-['Inter',sans-serif] text-[#6b7280] uppercase tracking-wider mb-4 font-normal">
            Game Controls
          </h2>
          <div className="grid grid-cols-2 gap-2 mt-auto">
            <button
              onClick={() =>
                api.startGame({}).then(fetchData).catch(console.error)
              }
              className="bg-[#00c853]/10 hover:bg-[#00c853]/20 text-[#00c853] border border-[#00c853]/30 px-3 py-2 rounded-[4px] text-[12px] font-bold font-['Inter',sans-serif] transition-colors"
            >
              START GAME
            </button>
            <button
              onClick={() => api.endGame().then(fetchData).catch(console.error)}
              className="bg-[#ff3333]/10 hover:bg-[#ff3333]/20 text-[#ff3333] border border-[#ff3333]/30 px-3 py-2 rounded-[4px] text-[12px] font-bold font-['Inter',sans-serif] transition-colors"
            >
              END GAME
            </button>
            <button
              onClick={() =>
                api.pauseGame().then(fetchData).catch(console.error)
              }
              className="bg-[#0077b6]/10 hover:bg-[#0077b6]/20 text-[#0077b6] border border-[#0077b6]/30 px-3 py-2 rounded-[4px] text-[12px] font-bold font-['Inter',sans-serif] transition-colors"
            >
              PAUSE
            </button>
            <button
              onClick={() =>
                api.resumeGame().then(fetchData).catch(console.error)
              }
              className="bg-[#00bcd4]/10 hover:bg-[#00bcd4]/20 text-[#00bcd4] border border-[#00bcd4]/30 px-3 py-2 rounded-[4px] text-[12px] font-bold font-['Inter',sans-serif] transition-colors"
            >
              RESUME
            </button>
          </div>
        </div>

        {/* LLM Session Costs Card */}
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-[6px] p-4 flex flex-col justify-between">
          <h2 className="text-[11px] font-['Inter',sans-serif] text-[#6b7280] uppercase tracking-wider mb-4 font-normal">
            LLM Session Costs
          </h2>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-end mb-1">
                <span className="font-['JetBrains_Mono',monospace] text-[#e0e0e0] text-[14px] tabular-nums">
                  ${llm?.total_cost_usd?.toFixed(2) || "0.00"}
                </span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-end mb-1">
                <span className="text-[13px] text-[#9ca3af] font-['Inter',sans-serif]">
                  Total Requests: {llm?.total_requests || 0}
                </span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-end mb-1">
                <span className="text-[13px] text-[#9ca3af] font-['Inter',sans-serif]">
                  Avg Latency:{" "}
                  {llm?.avg_latency_ms
                    ? `${(llm.avg_latency_ms / 1000).toFixed(1)}s`
                    : "0s"}
                </span>
                <span
                  className={`text-[12px] font-['Inter',sans-serif] ${!llm || llm.avg_latency_ms > 2000 ? "text-[#0077b6]" : "text-[#00c853]"}`}
                >
                  {!llm || llm.avg_latency_ms > 2000 ? "Warning" : "Good"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Market Health Card */}
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-[6px] p-4 flex flex-col">
          <h2 className="text-[11px] font-['Inter',sans-serif] text-[#6b7280] uppercase tracking-wider mb-4 font-normal">
            Market Health
          </h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="text-[13px] text-[#9ca3af] font-['Inter',sans-serif] mb-1">
                Trades/hour
              </div>
              <div className="font-['JetBrains_Mono',monospace] text-[#e0e0e0] text-[14px] tabular-nums">
                {market?.trades_last_hour
                  ? formatNumber(market.trades_last_hour)
                  : 0}
              </div>
            </div>
            <div>
              <div className="text-[13px] text-[#9ca3af] font-['Inter',sans-serif] mb-1">
                Total Trades
              </div>
              <div className="font-['JetBrains_Mono',monospace] text-[#e0e0e0] text-[14px] tabular-nums">
                {market?.total_trades ? formatNumber(market.total_trades) : 0}
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-[80px]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-4 h-4 rounded-full bg-[#0077b6]/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-[#0077b6] text-[12px]">
                  warning
                </span>
              </div>
              <span className="text-[13px] text-[#e5e5e5] font-['Inter',sans-serif] font-medium">
                Anomalies Detected
              </span>
            </div>
            <ul className="space-y-1">
              {market?.anomaly_alerts && market.anomaly_alerts.length > 0 ? (
                market.anomaly_alerts.map((anomaly, idx) => (
                  <li
                    key={idx}
                    className="flex justify-between items-center text-[12px] group"
                  >
                    <div className="flex items-center text-[#e5e5e5] font-['Inter',sans-serif]">
                      <span className="text-[#6b7280] mr-2">[-]</span>{" "}
                      {anomaly.type} on {anomaly.ticker}: {anomaly.description}
                    </div>
                  </li>
                ))
              ) : (
                <li className="text-[12px] text-[#6b7280] italic">
                  No active anomalies
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Main Split Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Active Teams Column */}
        <div className="col-span-1 lg:col-span-2 bg-[#141414] border border-[#2a2a2a] rounded-[6px] overflow-hidden flex flex-col">
          <div className="p-4 border-b border-[#2a2a2a] flex justify-between items-center">
            <h2 className="text-[11px] font-['Inter',sans-serif] text-[#6b7280] uppercase tracking-wider font-normal">
              Active Teams ({metrics?.active_teams || 0})
            </h2>
            <button
              onClick={fetchData}
              className="text-[13px] text-[#9ca3af] hover:text-[#e5e5e5] font-['Inter',sans-serif] font-medium flex items-center gap-1 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">
                refresh
              </span>{" "}
              Refresh
            </button>
          </div>

          <div className="p-4 border-b border-[#2a2a2a] flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7280] text-[16px]">
                search
              </span>
              <input
                type="text"
                placeholder="Search teams..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-[4px] h-[40px] pl-9 pr-3 text-[13px] text-[#e5e5e5] placeholder-[#6b7280] focus:outline-none focus:border-[#0077b6] font-['Inter',sans-serif] transition-colors"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-[4px] h-[40px] px-3 text-[13px] text-[#e5e5e5] focus:outline-none focus:border-[#0077b6] font-['Inter',sans-serif] transition-colors min-w-[140px]"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="cooldown">Cooldown</option>
              <option value="bankrupt">Bankrupt</option>
              <option value="eliminated">Eliminated</option>
            </select>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="min-w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  <th className="font-['Inter',sans-serif] text-[11px] font-normal text-[#6b7280] uppercase px-4 py-3 cursor-pointer hover:text-[#e5e5e5] select-none">
                    Team <span className="text-[10px]">▲</span>
                  </th>
                  <th className="font-['Inter',sans-serif] text-[11px] font-normal text-[#6b7280] uppercase px-4 py-3">
                    Ticker
                  </th>
                  <th className="font-['Inter',sans-serif] text-[11px] font-normal text-[#6b7280] uppercase px-4 py-3 cursor-pointer hover:text-[#e5e5e5] select-none text-right">
                    Price
                  </th>
                  <th className="font-['Inter',sans-serif] text-[11px] font-normal text-[#6b7280] uppercase px-4 py-3 text-right">
                    Market Cap
                  </th>
                  <th className="font-['Inter',sans-serif] text-[11px] font-normal text-[#6b7280] uppercase px-4 py-3">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTeams.map((team, idx) => (
                  <React.Fragment key={team.team_id}>
                    <tr
                      className={`h-[56px] border-b border-[#2a2a2a]/50 cursor-pointer transition-colors ${idx % 2 === 0 ? "bg-[#0a0a0a]" : "bg-[#111111]"} hover:bg-[#1a1a1a]`}
                      onClick={() =>
                        setExpandedTeamId(
                          expandedTeamId === team.team_id ? null : team.team_id,
                        )
                      }
                    >
                      <td className="px-4 text-[13px] text-[#9ca3af] font-['Inter',sans-serif] whitespace-nowrap">
                        {team.name}
                      </td>
                      <td className="px-4 text-[14px] text-[#0077b6] font-bold font-['JetBrains_Mono',monospace]">
                        {team.ticker}
                      </td>
                      <td className="px-4 text-[14px] text-[#e0e0e0] font-['JetBrains_Mono',monospace] tabular-nums text-right">
                        ${team.stock_price.toFixed(2)}
                      </td>
                      <td className="px-4 text-[14px] text-[#e0e0e0] font-['JetBrains_Mono',monospace] tabular-nums text-right">
                        {formatCurrency(team.market_cap || 0)}
                      </td>
                      <td className="px-4">
                        <div className="flex items-center h-[56px]">
                          {team.status === "ACTIVE" && (
                            <span className="text-[#00c853] text-[14px] mr-2 leading-none">
                              ●
                            </span>
                          )}
                          {team.status === "COOLDOWN" && (
                            <span className="text-[#0077b6] text-[14px] mr-2 leading-none">
                              ◐
                            </span>
                          )}
                          {(team.status === "BANKRUPT" ||
                            team.status === "ELIMINATED") && (
                            <span className="text-[#6b7280] text-[14px] mr-2 leading-none">
                              ○
                            </span>
                          )}
                          {team.status === "PENDING" && (
                            <span className="text-[#00bcd4] text-[14px] mr-2 leading-none">
                              ◑
                            </span>
                          )}
                          <span className="text-[13px] text-[#e5e5e5] font-['Inter',sans-serif] capitalize">
                            {team.status.toLowerCase()}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {expandedTeamId === team.team_id && (
                      <tr className="bg-[#161616] border-b border-[#2a2a2a]">
                        <td colSpan={5} className="px-4 py-4">
                          <div className="flex justify-between items-start gap-4">
                            <div>
                              {/* Last Directive removed - not in spec */}
                            </div>
                            <div className="text-right flex flex-col items-end">
                              <div className="text-[11px] text-[#6b7280] font-['Inter',sans-serif] uppercase mb-1">
                                Available Cash
                              </div>
                              <div className="text-[14px] text-[#e0e0e0] font-['JetBrains_Mono',monospace] tabular-nums mb-4">
                                {formatCurrency(0)}
                              </div>

                              <button
                                className="bg-[#ff3333]/10 hover:bg-[#ff3333]/20 text-[#ff3333] border border-[#ff3333]/30 px-3 py-1.5 rounded-[4px] text-[12px] font-bold font-['Inter',sans-serif] transition-colors"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    await api.forceBankruptTeam(team.team_id);
                                    fetchData();
                                  } catch (err) {
                                    console.error(err);
                                  }
                                }}
                              >
                                FORCE BANKRUPT
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {filteredTeams.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-gray-500 font-['Inter',sans-serif]"
                    >
                      No teams match criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Purge Control Column */}
        <div className="col-span-1 lg:col-span-1 bg-[#141414] border border-[#2a2a2a] rounded-[6px] p-4 flex flex-col">
          <h2 className="text-[11px] font-['Inter',sans-serif] text-[#6b7280] uppercase tracking-wider mb-6 font-normal">
            Market Purge Control
          </h2>

          <div className="space-y-3 mb-8 flex-1">
            <div className="text-[13px] text-[#9ca3af] font-['Inter',sans-serif] mb-4">
              Status Check:
            </div>

            <div className="flex items-center gap-3">
              {purgeState === "PENDING" ? (
                <span
                  className="text-[#0077b6] text-[16px] material-symbols-outlined animate-spin"
                  style={{ animationDuration: "2s" }}
                >
                  hourglass_empty
                </span>
              ) : (
                <span className="text-[#00c853] text-[16px] material-symbols-outlined">
                  check_box
                </span>
              )}
              <span
                className={`text-[13px] font-['Inter',sans-serif] ${purgeState === "PENDING" ? "text-[#9ca3af]" : "text-[#e5e5e5]"}`}
              >
                Safe to execute purge
              </span>
            </div>

            <div className="flex items-center gap-3">
              {(metrics?.llm_queue_depth ?? 0) > 0 ? (
                <span
                  className="text-[#0077b6] text-[16px] material-symbols-outlined animate-spin"
                  style={{ animationDuration: "2s" }}
                >
                  hourglass_empty
                </span>
              ) : (
                <span className="text-[#00c853] text-[16px] material-symbols-outlined">
                  check_box
                </span>
              )}
              <span
                className={`text-[13px] font-['Inter',sans-serif] ${(metrics?.llm_queue_depth ?? 0) > 0 ? "text-[#9ca3af]" : "text-[#e5e5e5]"}`}
              >
                No directives processing (queue: {metrics?.llm_queue_depth || 0}
                )
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[#00c853] text-[16px] material-symbols-outlined">
                check_box
              </span>
              <span className="text-[13px] text-[#e5e5e5] font-['Inter',sans-serif]">
                {metrics?.active_teams || 0} teams active
              </span>
            </div>
          </div>

          <div className="mt-auto relative">
            {/* Warning overlay after first click */}
            {purgeState === "CONFIRM" && (
              <div className="absolute -top-[4.5rem] left-0 right-0 bg-[#ff3333]/10 border border-[#ff3333]/30 p-3 rounded-[4px] text-center">
                <span className="text-[#ff3333] text-[12px] font-bold font-['Inter',sans-serif] uppercase block">
                  Warning: Irreversible Action
                </span>
                <span className="text-[#ff3333]/80 text-[11px] font-['Inter',sans-serif]">
                  50% of active teams will be liquidated.
                </span>
              </div>
            )}

            {purgeState === "COMPLETE" && (
              <div className="absolute -top-[3.5rem] left-0 right-0 bg-[#00c853]/10 border border-[#00c853]/30 p-3 rounded-[4px] text-center">
                <span className="text-[#00c853] text-[12px] font-bold font-['Inter',sans-serif] uppercase block">
                  Purge Executed
                </span>
                <span className="text-[#00c853]/80 text-[11px] font-['Inter',sans-serif]">
                  Teams successfully eliminated.
                </span>
              </div>
            )}

            <button
              onClick={handlePurgeAction}
              disabled={
                purgeState === "PENDING" ||
                purgeState === "COMPLETE" ||
                purgeState === "PROCESSING"
              }
              className={`w-full h-[48px] rounded-[4px] font-bold text-[13px] tracking-widest font-['Inter',sans-serif] transition-all duration-200 flex items-center justify-center uppercase
                ${purgeState === "PENDING" || purgeState === "PROCESSING" ? "bg-[#2a2a2a] text-[#6b7280] cursor-not-allowed" : ""}
                ${purgeState === "READY" ? "bg-[#0077b6] text-[#0a0a0a] hover:bg-[#0077b6]/90 shadow-[0_0_15px_rgba(255,176,0,0.3)] cursor-pointer" : ""}
                ${purgeState === "CONFIRM" ? "bg-[#ff3333] text-[#e5e5e5] hover:bg-[#ff3333]/90 shadow-[0_0_15px_rgba(255,51,51,0.4)] cursor-pointer" : ""}
                ${purgeState === "COMPLETE" ? "bg-[#00c853] text-[#0a0a0a] cursor-not-allowed" : ""}
              `}
            >
              {purgeState === "PENDING" && "SAFETY CHECKS PENDING..."}
              {purgeState === "READY" && "INITIATE PURGE (1/2)"}
              {purgeState === "CONFIRM" &&
                (countdown > 0
                  ? `CONFIRM PURGE (${countdown})`
                  : "CONFIRM PURGE (2/2)")}
              {purgeState === "PROCESSING" && "PROCESSING..."}
              {purgeState === "COMPLETE" && "PURGE COMPLETE"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
