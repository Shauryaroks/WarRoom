"use client";

import { useState } from "react";
import {
  TopNav,
  SideNav,
  MetricsBar,
  TeamTable,
  SidePanel,
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
  },
  {
    name: "STARK_INDUSTRIES",
    ticker: "$STRK",
    status: "PENDING",
    liquidity: "$0.00",
    mktCap: "$0.00",
    lastDirective: "N/A",
  },
  {
    name: "WAYNE_CORP",
    ticker: "$WAYN",
    status: "COOLDOWN",
    liquidity: "$89.2M",
    mktCap: "$210.0M",
    lastDirective: "RESTRUCTURING_V4...",
  },
  {
    name: "ACME_CO",
    ticker: "$ACME",
    status: "ELIMINATED",
    liquidity: "$0.0M",
    mktCap: "$0.0M",
    lastDirective: "LIQUIDATED_SYSTEM",
  },
];

type Tab = "register" | "teams" | "wire" | "purge" | "settings";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>("teams");
  const [filter, setFilter] = useState("all");

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
          />
          <SidePanel />
        </section>
      </main>

      <Footer />
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
