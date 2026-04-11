"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const mockTeams = [
  {
    id: 1,
    name: "Monster Inc",
    ticker: "MNST",
    status: "ACTIVE",
    price: "145.20",
    mktCap: "$145.0M",
    cooldown: null,
    cash: "$1.2M",
    lastDirective: "Acquire local distributor in EMEA...",
  },
  {
    id: 2,
    name: "Apex Corp",
    ticker: "APEX",
    status: "ACTIVE",
    price: "104.00",
    mktCap: "$104.0M",
    cooldown: null,
    cash: "$4.5M",
    lastDirective: "Liquidate unused real estate...",
  },
  {
    id: 3,
    name: "Barbie Inc",
    ticker: "BRBE",
    status: "COOLDOWN",
    price: "95.50",
    mktCap: "$95.5M",
    cooldown: "04:32",
    cash: "$800K",
    lastDirective: "Launch new marketing campaign...",
  },
  {
    id: 4,
    name: "Fail Co",
    ticker: "FAIL",
    status: "BANKRUPT",
    price: "0.00",
    mktCap: "$0.0M",
    cooldown: null,
    cash: "$0",
    lastDirective: "System liquidation",
  },
];

export default function AdminDashboard() {
  const [expandedTeamId, setExpandedTeamId] = useState<number | null>(null);

  // Purge State
  const [purgeState, setPurgeState] = useState<
    "PENDING" | "READY" | "CONFIRM" | "COMPLETE"
  >("PENDING");
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    // Mock checks resolving
    if (purgeState === "PENDING") {
      const timer = setTimeout(() => setPurgeState("READY"), 4000);
      return () => clearTimeout(timer);
    }
  }, [purgeState]);

  useEffect(() => {
    if (purgeState === "CONFIRM" && countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [purgeState, countdown]);

  const handlePurgeAction = () => {
    if (purgeState === "READY") {
      setPurgeState("CONFIRM");
      setCountdown(3);
    } else if (purgeState === "CONFIRM" && countdown === 0) {
      setPurgeState("COMPLETE");
    }
  };

  const [anomalies, setAnomalies] = useState([
    {
      id: 1,
      text: "Circular trading detected between $APEX and $MNST",
      time: "14:32:01",
    },
    { id: 2, text: "Unusual volume spike in $BRBE", time: "14:28:45" },
  ]);

  return (
    <div className="flex flex-col gap-4 max-w-7xl mx-auto pb-8">
      {/* Top Metrics Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* LLM Session Costs Card */}
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-[6px] p-4 flex flex-col justify-between">
          <h2 className="text-[11px] font-['Inter',sans-serif] text-[#6b7280] uppercase tracking-wider mb-4 font-normal">
            LLM Session Costs
          </h2>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-end mb-1">
                <span className="font-['JetBrains_Mono',monospace] text-[#e0e0e0] text-[14px] tabular-nums">
                  $4.23 / $50.00
                </span>
                <span className="font-['JetBrains_Mono',monospace] text-[#e0e0e0] text-[12px]">
                  8%
                </span>
              </div>
              <div className="w-full h-1 bg-[#2a2a2a] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#ffb000]"
                  style={{ width: "8%" }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-end mb-1">
                <span className="text-[13px] text-[#9ca3af] font-['Inter',sans-serif]">
                  Requests: 342/1000
                </span>
                <span className="font-['JetBrains_Mono',monospace] text-[#e0e0e0] text-[12px]">
                  34%
                </span>
              </div>
              <div className="w-full h-1 bg-[#2a2a2a] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#ffb000]"
                  style={{ width: "34%" }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-end mb-1">
                <span className="text-[13px] text-[#9ca3af] font-['Inter',sans-serif]">
                  Avg Latency: 1.2s
                </span>
                <span className="text-[12px] text-[#00c853] font-['Inter',sans-serif]">
                  Good
                </span>
              </div>
              <div className="w-full h-1 bg-[#2a2a2a] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#00c853]"
                  style={{ width: "20%" }}
                ></div>
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
                1,234
              </div>
            </div>
            <div>
              <div className="text-[13px] text-[#9ca3af] font-['Inter',sans-serif] mb-1">
                Volume
              </div>
              <div className="font-['JetBrains_Mono',monospace] text-[#e0e0e0] text-[14px] tabular-nums">
                $4.2M
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-[80px]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-4 h-4 rounded-full bg-[#ffb000]/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-[#ffb000] text-[12px]">
                  warning
                </span>
              </div>
              <span className="text-[13px] text-[#e5e5e5] font-['Inter',sans-serif] font-medium">
                Anomalies Detected
              </span>
            </div>
            <ul className="space-y-1">
              {anomalies.map((anomaly) => (
                <li
                  key={anomaly.id}
                  className="flex justify-between items-center text-[12px] group"
                >
                  <div className="flex items-center text-[#e5e5e5] font-['Inter',sans-serif]">
                    <span className="text-[#6b7280] mr-2">[-]</span>{" "}
                    {anomaly.text}
                  </div>
                  <div className="flex items-center">
                    <span className="text-[#6b7280] font-['JetBrains_Mono',monospace] mr-2">
                      {anomaly.time}
                    </span>
                    <button
                      onClick={() =>
                        setAnomalies(
                          anomalies.filter((a) => a.id !== anomaly.id),
                        )
                      }
                      className="text-[#6b7280] hover:text-[#e5e5e5] opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        close
                      </span>
                    </button>
                  </div>
                </li>
              ))}
              {anomalies.length === 0 && (
                <li className="text-[12px] text-[#6b7280] italic">
                  No active anomalies
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Main Split Row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Active Teams Column */}
        <div className="col-span-2 bg-[#141414] border border-[#2a2a2a] rounded-[6px] overflow-hidden flex flex-col">
          <div className="p-4 border-b border-[#2a2a2a] flex justify-between items-center">
            <h2 className="text-[11px] font-['Inter',sans-serif] text-[#6b7280] uppercase tracking-wider font-normal">
              Active Teams (25)
            </h2>
            <button className="text-[13px] text-[#9ca3af] hover:text-[#e5e5e5] font-['Inter',sans-serif] font-medium flex items-center gap-1 transition-colors">
              <span className="material-symbols-outlined text-[16px]">
                refresh
              </span>{" "}
              Refresh
            </button>
          </div>

          <div className="p-4 border-b border-[#2a2a2a] flex gap-4">
            <div className="flex-1 relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7280] text-[16px]">
                search
              </span>
              <input
                type="text"
                placeholder="Search teams..."
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-[4px] h-[40px] pl-9 pr-3 text-[13px] text-[#e5e5e5] placeholder-[#6b7280] focus:outline-none focus:border-[#ffb000] font-['Inter',sans-serif] transition-colors"
              />
            </div>
            <select className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-[4px] h-[40px] px-3 text-[13px] text-[#e5e5e5] focus:outline-none focus:border-[#ffb000] font-['Inter',sans-serif] transition-colors min-w-[140px]">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="cooldown">Cooldown</option>
              <option value="bankrupt">Bankrupt</option>
            </select>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse">
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
                  <th className="font-['Inter',sans-serif] text-[11px] font-normal text-[#6b7280] uppercase px-4 py-3 text-right">
                    Cooldown
                  </th>
                </tr>
              </thead>
              <tbody>
                {mockTeams.map((team, idx) => (
                  <React.Fragment key={team.id}>
                    <tr
                      className={`h-[56px] border-b border-[#2a2a2a]/50 cursor-pointer transition-colors ${idx % 2 === 0 ? "bg-[#0a0a0a]" : "bg-[#111111]"} hover:bg-[#1a1a1a]`}
                      onClick={() =>
                        setExpandedTeamId(
                          expandedTeamId === team.id ? null : team.id,
                        )
                      }
                    >
                      <td className="px-4 text-[13px] text-[#9ca3af] font-['Inter',sans-serif]">
                        {team.name}
                      </td>
                      <td className="px-4 text-[14px] text-[#ffb000] font-bold font-['JetBrains_Mono',monospace]">
                        ${team.ticker}
                      </td>
                      <td className="px-4 text-[14px] text-[#e0e0e0] font-['JetBrains_Mono',monospace] tabular-nums text-right">
                        {team.price}
                      </td>
                      <td className="px-4 text-[14px] text-[#e0e0e0] font-['JetBrains_Mono',monospace] tabular-nums text-right">
                        {team.mktCap}
                      </td>
                      <td className="px-4">
                        <div className="flex items-center h-[56px]">
                          {team.status === "ACTIVE" && (
                            <span className="text-[#00c853] text-[14px] mr-2 leading-none">
                              ●
                            </span>
                          )}
                          {team.status === "COOLDOWN" && (
                            <span className="text-[#ffb000] text-[14px] mr-2 leading-none">
                              ◐
                            </span>
                          )}
                          {team.status === "BANKRUPT" && (
                            <span className="text-[#6b7280] text-[14px] mr-2 leading-none">
                              ○
                            </span>
                          )}
                          <span className="text-[13px] text-[#e5e5e5] font-['Inter',sans-serif] capitalize">
                            {team.status.toLowerCase()}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 text-[14px] text-[#6b7280] font-['JetBrains_Mono',monospace] tabular-nums text-right">
                        {team.cooldown || (
                          <span className="opacity-50">00:00</span>
                        )}
                      </td>
                    </tr>
                    {expandedTeamId === team.id && (
                      <tr className="bg-[#161616] border-b border-[#2a2a2a]">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="flex justify-between items-start gap-4">
                            <div>
                              <div className="text-[11px] text-[#6b7280] font-['Inter',sans-serif] uppercase mb-1">
                                Last Directive
                              </div>
                              <div className="text-[13px] text-[#e5e5e5] font-['Inter',sans-serif] bg-[#0a0a0a] p-3 rounded-[4px] border border-[#2a2a2a] max-w-md">
                                {team.lastDirective}
                              </div>
                            </div>
                            <div className="text-right flex flex-col items-end">
                              <div className="text-[11px] text-[#6b7280] font-['Inter',sans-serif] uppercase mb-1">
                                Available Cash
                              </div>
                              <div className="text-[14px] text-[#e0e0e0] font-['JetBrains_Mono',monospace] tabular-nums mb-4">
                                {team.cash}
                              </div>

                              <button
                                className="bg-[#ff3333]/10 hover:bg-[#ff3333]/20 text-[#ff3333] border border-[#ff3333]/30 px-3 py-1.5 rounded-[4px] text-[12px] font-bold font-['Inter',sans-serif] transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  alert(`Force bankrupting ${team.ticker}`);
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
              </tbody>
            </table>
          </div>
        </div>

        {/* Purge Control Column */}
        <div className="col-span-1 bg-[#141414] border border-[#2a2a2a] rounded-[6px] p-4 flex flex-col">
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
                  className="text-[#ffb000] text-[16px] material-symbols-outlined animate-spin"
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
                30 minutes elapsed since last purge
              </span>
            </div>

            <div className="flex items-center gap-3">
              {purgeState === "PENDING" ? (
                <span
                  className="text-[#ffb000] text-[16px] material-symbols-outlined animate-spin"
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
                No directives processing (queue: 0)
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[#00c853] text-[16px] material-symbols-outlined">
                check_box
              </span>
              <span className="text-[13px] text-[#e5e5e5] font-['Inter',sans-serif]">
                25 teams active (minimum 10)
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
                  12 teams successfully eliminated.
                </span>
              </div>
            )}

            <button
              onClick={handlePurgeAction}
              disabled={purgeState === "PENDING" || purgeState === "COMPLETE"}
              className={`w-full h-[48px] rounded-[4px] font-bold text-[13px] tracking-widest font-['Inter',sans-serif] transition-all duration-200 flex items-center justify-center uppercase
                ${purgeState === "PENDING" ? "bg-[#2a2a2a] text-[#6b7280] cursor-not-allowed" : ""}
                ${purgeState === "READY" ? "bg-[#ffb000] text-[#0a0a0a] hover:bg-[#ffb000]/90 shadow-[0_0_15px_rgba(255,176,0,0.3)] cursor-pointer" : ""}
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
              {purgeState === "COMPLETE" && "PURGE COMPLETE"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
