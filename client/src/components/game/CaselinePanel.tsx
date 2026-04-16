"use client";

import { useAuthStore } from "@/stores/auth-store";

export function CaselinePanel() {
  const { teamName, ticker, role } = useAuthStore();

  return (
    <div className="p-4 space-y-6">
      <div className="text-[10px] text-[#89919d] uppercase font-bold tracking-widest">
        CASELINE
      </div>

      {/* Team info */}
      <div className="space-y-3">
        <div className="text-[9px] text-[#89919d] uppercase font-bold tracking-widest">
          COMPANY PROFILE
        </div>
        <div className="bg-[#201f1f] p-3 space-y-2">
          <div className="flex justify-between">
            <span className="text-[10px] text-[#89919d] uppercase">TEAM</span>
            <span className="font-mono text-xs text-[#e5e2e1]">{teamName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] text-[#89919d] uppercase">TICKER</span>
            <span className="font-mono text-xs text-[#9ecaff]">${ticker}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] text-[#89919d] uppercase">ROLE</span>
            <span className="font-mono text-xs text-[#e5e2e1] uppercase">{role}</span>
          </div>
        </div>
      </div>

      {/* Company story placeholder */}
      <div className="space-y-3">
        <div className="text-[9px] text-[#89919d] uppercase font-bold tracking-widest">
          COMPANY STORY
        </div>
        <div className="bg-[#201f1f] p-3">
          <p className="text-xs text-[#89919d] leading-relaxed">
            Caseline details will be populated when the game admin configures company profiles.
          </p>
        </div>
      </div>

      {/* SWOT placeholder */}
      <div className="space-y-3">
        <div className="text-[9px] text-[#89919d] uppercase font-bold tracking-widest">
          SWOT PROFILE
        </div>
        <div className="grid grid-cols-2 gap-1">
          {["STRENGTHS", "WEAKNESSES", "OPPORTUNITIES", "THREATS"].map((label) => (
            <div key={label} className="bg-[#201f1f] p-2">
              <div className="text-[9px] text-[#89919d] uppercase font-bold tracking-widest mb-1">
                {label}
              </div>
              <div className="text-[10px] text-[#404752] font-mono">--</div>
            </div>
          ))}
        </div>
      </div>

      {/* Portfolio type placeholder */}
      <div className="space-y-3">
        <div className="text-[9px] text-[#89919d] uppercase font-bold tracking-widest">
          PORTFOLIO TYPE
        </div>
        <div className="bg-[#201f1f] p-3">
          <span className="font-mono text-xs text-[#404752]">Not assigned</span>
        </div>
      </div>
    </div>
  );
}
