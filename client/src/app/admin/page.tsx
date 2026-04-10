"use client";

import { useState } from "react";
import {
  TopNav,
  SideNav,
  MetricsBar,
  TeamTable,
  SidePanel,
  NewsInjection,
  Observability,
} from "@/components/admin";
import { Team } from "@/components/admin/TeamTable";

const mockTeams: Team[] = [
  {
    name: "BARBIE INC",
    ticker: "$BARB",
    status: "ACTIVE",
    liquidity: "$124.5M",
    mktCap: "$540.0M",
    lastDirective: "EXPAND_MARKET_SHARE_EMEA...",
    cooldownRemaining: null,
  },
  {
    name: "STARK_INDUSTRIES",
    ticker: "$STRK",
    status: "PENDING",
    liquidity: "$0.00",
    mktCap: "$0.00",
    lastDirective: "N/A",
    cooldownRemaining: null,
  },
  {
    name: "WAYNE_CORP",
    ticker: "$WAYN",
    status: "COOLDOWN",
    liquidity: "$89.2M",
    mktCap: "$210.0M",
    lastDirective: "RESTRUCTURING_V4...",
    cooldownRemaining: "06:42",
  },
  {
    name: "ACME_CO",
    ticker: "$ACME",
    status: "ELIMINATED",
    liquidity: "$0.0M",
    mktCap: "$0.0M",
    lastDirective: "LIQUIDATED_SYSTEM",
    cooldownRemaining: null,
  },
  {
    name: "TECH_CORP",
    ticker: "$TECH",
    status: "BANKRUPT",
    liquidity: "-$50K",
    mktCap: "$0.0M",
    lastDirective: "FIRED_WORKERS...",
    cooldownRemaining: null,
  },
];

type Tab = "register" | "teams" | "wire" | "purge" | "settings";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>("teams");
  const [filter, setFilter] = useState("all");
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeConfirmText, setPurgeConfirmText] = useState("");
  const [selectedTeamForAction, setSelectedTeamForAction] = useState<{
    team: Team;
    action: "bankrupt";
  } | null>(null);
  const [bankruptConfirmText, setBankruptConfirmText] = useState("");

  const activeCount = mockTeams.filter((t) => t.status === "ACTIVE").length;
  const teamsToEliminate = Math.floor(activeCount / 2);

  const handlePurgeConfirm = () => {
    if (purgeConfirmText === "PURGE") {
      console.log("Executing purge...");
      setShowPurgeModal(false);
      setPurgeConfirmText("");
    }
  };

  const handleBankruptConfirm = () => {
    if (selectedTeamForAction && bankruptConfirmText === "BANKRUPT") {
      console.log("Force bankrupt:", selectedTeamForAction.team.name);
      setSelectedTeamForAction(null);
      setBankruptConfirmText("");
    }
  };

  return (
    <>
      <TopNav />
      <SideNav activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="pl-64 pt-16 pb-8 h-screen overflow-hidden flex flex-col bg-[#0a0a0a]">
        <MetricsBar />

        <section className="flex flex-1 overflow-hidden">
          <TeamTable
            teams={mockTeams}
            filter={filter}
            onFilterChange={setFilter}
            onForceBankrupt={(team) =>
              setSelectedTeamForAction({ team, action: "bankrupt" })
            }
          />
          <SidePanel onInitiatePurge={() => setShowPurgeModal(true)} />
        </section>

        {/* News Injection & Observability */}
        <div className="h-48 border-t border-white/10 flex">
          <NewsInjection />
          <Observability />
        </div>
      </main>

      <Footer />
      <FooterStats />

      {/* Purge Confirmation Modal */}
      {showPurgeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setShowPurgeModal(false)}
        >
          <div
            className="absolute inset-0 bg-black/80"
            style={{
              background:
                "radial-gradient(circle, transparent 30%, rgba(0,0,0,0.9) 100%)",
            }}
          />
          <div
            className="relative bg-[#0f0f0f] border border-[#ff3333]/50 p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-[#ff3333] text-2xl">
                warning
              </span>
              <h2 className="text-lg font-bold text-[#ff3333] uppercase tracking-widest">
                CONFIRM PURGE
              </h2>
            </div>
            <p className="text-[11px] text-zinc-300 mb-4">
              This will eliminate{" "}
              <span className="text-[#ff3333] font-bold">
                {teamsToEliminate} teams
              </span>{" "}
              from the competition. All eliminated teams will have their stock
              delisted and holdings zeroed.
            </p>
            <div className="mb-4">
              <label className="text-[9px] text-zinc-500 uppercase block mb-2">
                Type PURGE to confirm:
              </label>
              <input
                type="text"
                value={purgeConfirmText}
                onChange={(e) =>
                  setPurgeConfirmText(e.target.value.toUpperCase())
                }
                className="w-full bg-black border border-[#353534] p-2 text-[10px] uppercase outline-none focus:border-[#ff3333]"
                placeholder="______"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handlePurgeConfirm}
                disabled={purgeConfirmText !== "PURGE"}
                className="flex-1 bg-[#ff3333] text-white py-2 text-[10px] font-bold uppercase disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                CONFIRM PURGE
              </button>
              <button
                onClick={() => {
                  setShowPurgeModal(false);
                  setPurgeConfirmText("");
                }}
                className="flex-1 bg-[#353534] text-zinc-300 py-2 text-[10px] font-bold uppercase cursor-pointer"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Force Bankrupt Confirmation Modal */}
      {selectedTeamForAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setSelectedTeamForAction(null)}
        >
          <div
            className="absolute inset-0 bg-black/80"
            style={{
              background:
                "radial-gradient(circle, transparent 30%, rgba(0,0,0,0.9) 100%)",
            }}
          />
          <div
            className="relative bg-[#0f0f0f] border border-[#ff3333]/50 p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-[#ff3333] text-2xl">
                gavel
              </span>
              <h2 className="text-lg font-bold text-[#ff3333] uppercase tracking-widest">
                FORCE BANKRUPTCY
              </h2>
            </div>
            <p className="text-[11px] text-zinc-300 mb-4">
              This will zero{" "}
              <span className="text-[#FFB000] font-bold">
                {selectedTeamForAction.team.name}'s
              </span>{" "}
              holdings and delist their stock immediately. Use only for cheating
              detection or rule violations.
            </p>
            <div className="mb-4">
              <label className="text-[9px] text-zinc-500 uppercase block mb-2">
                Type BANKRUPT to confirm:
              </label>
              <input
                type="text"
                value={bankruptConfirmText}
                onChange={(e) =>
                  setBankruptConfirmText(e.target.value.toUpperCase())
                }
                className="w-full bg-black border border-[#353534] p-2 text-[10px] uppercase outline-none focus:border-[#ff3333]"
                placeholder="______"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleBankruptConfirm}
                disabled={bankruptConfirmText !== "BANKRUPT"}
                className="flex-1 bg-[#ff3333] text-white py-2 text-[10px] font-bold uppercase disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                CONFIRM BANKRUPTCY
              </button>
              <button
                onClick={() => {
                  setSelectedTeamForAction(null);
                  setBankruptConfirmText("");
                }}
                className="flex-1 bg-[#353534] text-zinc-300 py-2 text-[10px] font-bold uppercase cursor-pointer"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Footer() {
  return (
    <footer className="fixed bottom-0 w-full z-50 flex justify-between items-center px-6 h-8 bg-black border-t border-white/10">
      <div className="text-[#FFB000] text-[9px] font-bold">
        COMPLEX // ADMIN_TERMINAL
      </div>
      <div className="flex gap-4 text-zinc-500 text-[9px] font-bold">
        <span>ACTIVE_TEAMS: 42</span>
        <span className="text-zinc-800">|</span>
        <span>TOTAL_LIQUIDITY: $4.2B</span>
        <span className="text-zinc-800">|</span>
        <span>AVG_MKT_CAP: $350M</span>
        <span className="text-zinc-800">|</span>
        <span>LLM_COST: $4.23</span>
      </div>
    </footer>
  );
}

function FooterStats() {
  return null;
}
