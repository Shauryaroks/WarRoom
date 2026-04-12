"use client";

import { useState } from "react";

interface SidePanelProps {
  pendingTeams?: string[];
  onInitiatePurge?: () => void;
}

const portfolios = {
  "Tech Startup": {
    S: "Proprietary LLM, PhD team, AI patents",
    W: "$500k/month burn rate, dependency on cloud providers",
    O: "Enterprise AI adoption, vertical integration",
    T: "Regulatory scrutiny, compute costs",
  },
  "Legacy Manufacturer": {
    S: "Established supply chain, brand recognition",
    W: "Outdated technology, high labor costs",
    O: "Digital transformation, emerging markets",
    T: "Automation disruption, environmental regs",
  },
  "D2C Disruptor": {
    S: "Direct customer relationships, viral marketing",
    W: "Thin margins, inventory risk",
    O: "International expansion, product line extension",
    T: "Platform fees, customer acquisition costs",
  },
  Conglomerate: {
    S: "Diversified revenue, capital reserves",
    W: "Slow decision-making, legacy systems",
    O: "M&A opportunities, cross-brand synergies",
    T: "Antitrust scrutiny, market volatility",
  },
};

export function SidePanel({
  pendingTeams = ["STARK_INDUSTRIES (PENDING)", "OSCORP_TECH (PENDING)"],
  onInitiatePurge,
}: SidePanelProps) {
  const [selectedPortfolio, setSelectedPortfolio] = useState("");

  return (
    <div className="w-80 bg-[#0f0f0f] border-l border-white/5 flex flex-col">
      {/* Portfolio Assignment */}
      <div className="p-6 border-b border-white/5">
        <h3 className="text-[10px] font-bold text-[#0077b6] mb-6 flex items-center gap-2 uppercase">
          <span className="material-symbols-outlined text-sm">
            assignment_ind
          </span>
          PORTFOLIO_ASSIGNMENT
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-[9px] text-zinc-500 mb-2 block uppercase">
              SELECT TEAM...
            </label>
            <select className="w-full bg-black border border-white/10 text-[10px] p-2 outline-none focus:border-[#00c853] uppercase cursor-pointer">
              <option>SELECT_TEAM...</option>
              {pendingTeams.map((team, i) => (
                <option key={i}>{team}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[9px] text-zinc-500 mb-2 block uppercase">
              ASSIGN_STARTING_PROFILE
            </label>
            <select
              className="w-full bg-black border border-white/10 text-[10px] p-2 outline-none focus:border-[#00c853] uppercase cursor-pointer"
              value={selectedPortfolio}
              onChange={(e) => setSelectedPortfolio(e.target.value)}
            >
              <option value="">SELECT_PROFILE...</option>
              {Object.keys(portfolios).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Portfolio Preview */}
          {selectedPortfolio &&
            portfolios[selectedPortfolio as keyof typeof portfolios] && (
              <div className="p-3 bg-black border border-[#353534] space-y-2">
                <div className="text-[9px] text-[#0077b6] font-bold uppercase mb-2">
                  {selectedPortfolio} Selected:
                </div>
                <div className="space-y-1 text-[8px]">
                  <div className="flex gap-2">
                    <span className="text-[#00c853] font-bold">S:</span>
                    <span className="text-zinc-400">
                      {portfolios[selectedPortfolio as keyof typeof portfolios]?.S || "N/A"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-[#ff3333] font-bold">W:</span>
                    <span className="text-zinc-400">
                      {portfolios[selectedPortfolio as keyof typeof portfolios]?.W || "N/A"}
                    </span>
                  </div>
                </div>
                <button className="text-[8px] text-[#0077b6] hover:underline uppercase cursor-pointer mt-2">
                  [VIEW FULL PROFILE]
                </button>
              </div>
            )}

          <button className="w-full bg-[#00c853] py-3 text-[10px] font-bold text-black border border-[#00c853]/20 hover:brightness-110 uppercase cursor-pointer">
            ACTIVATE_TEAM
          </button>
        </div>
      </div>

      {/* Game Controls */}
      <GameControls onInitiatePurge={onInitiatePurge} />
    </div>
  );
}

interface GameControlsProps {
  onInitiatePurge?: () => void;
}

function GameControls({ onInitiatePurge }: GameControlsProps) {
  return (
    <div className="p-6 flex-1 bg-black/20">
      <h3 className="text-[10px] font-bold text-[#0077b6] mb-6 flex items-center gap-2 uppercase">
        <span className="material-symbols-outlined text-sm">
          settings_remote
        </span>
        GAME_CONTROL
      </h3>
      <div className="space-y-3">
        <button className="w-full bg-[#00c853]/10 border border-[#00c853] text-[#00c853] py-4 text-[11px] font-bold hover:bg-[#00c853] hover:text-black transition-all flex items-center justify-center gap-2 uppercase cursor-pointer">
          <span className="material-symbols-outlined text-sm">play_circle</span>
          START_GAME_SESSION
        </button>
        <button className="w-full bg-[#0077b6]/10 border border-[#0077b6] text-[#0077b6] py-3 text-[10px] font-bold hover:bg-[#0077b6] hover:text-black transition-all flex items-center justify-center gap-2 uppercase cursor-pointer">
          <span className="material-symbols-outlined text-sm">
            pause_circle
          </span>
          PAUSE_TRADING
        </button>
        <button className="w-full bg-white/5 border border-white/20 text-zinc-400 py-3 text-[10px] font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2 uppercase cursor-pointer">
          <span className="material-symbols-outlined text-sm">cancel</span>
          END_EVENT
        </button>
        <div className="pt-6">
          <button
            onClick={onInitiatePurge}
            className="w-full bg-[#dc2626] text-white py-5 text-[11px] font-bold border border-[#dc2626] flex items-center justify-center gap-2 uppercase cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">warning</span>
            INITIATE_PURGE
          </button>
        </div>
      </div>
    </div>
  );
}
