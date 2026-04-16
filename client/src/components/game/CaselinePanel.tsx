"use client";

import { useState, useEffect } from "react";
import Markdown from "react-markdown";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import type { CaselineResponse } from "@/lib/types";

export function CaselinePanel() {
  const { teamName, ticker, role } = useAuthStore();
  const [caseline, setCaseline] = useState<CaselineResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadCaseline() {
      try {
        const data = await api.getCaseline();
        if (!cancelled) {
          setCaseline(data);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load caseline"
          );
          setIsLoading(false);
        }
      }
    }
    loadCaseline();
    return () => {
      cancelled = true;
    };
  }, []);

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
          {caseline?.company_display_name && (
            <div className="flex justify-between">
              <span className="text-[10px] text-[#89919d] uppercase">
                COMPANY
              </span>
              <span className="font-mono text-xs text-[#2196f3] font-bold">
                {caseline.company_display_name}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-[10px] text-[#89919d] uppercase">TEAM</span>
            <span className="font-mono text-xs text-[#e5e2e1]">
              {teamName}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] text-[#89919d] uppercase">
              TICKER
            </span>
            <span className="font-mono text-xs text-[#9ecaff]">${ticker}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] text-[#89919d] uppercase">ROLE</span>
            <span className="font-mono text-xs text-[#e5e2e1] uppercase">
              {role}
            </span>
          </div>
        </div>
      </div>

      {/* Caseline document */}
      <div className="space-y-3">
        <div className="text-[9px] text-[#89919d] uppercase font-bold tracking-widest">
          CASELINE DOCUMENT
        </div>
        <div className="bg-[#201f1f] p-3">
          {isLoading ? (
            <div className="text-[10px] text-[#404752] font-mono py-4 text-center">
              LOADING_CASELINE...
            </div>
          ) : error ? (
            <div className="text-[10px] text-[#FF1744] font-mono py-2">
              {error}
            </div>
          ) : caseline?.caseline_document ? (
            <div className="caseline-markdown text-xs text-[#e5e2e1] leading-relaxed [&_h1]:text-sm [&_h1]:font-bold [&_h1]:text-[#9ecaff] [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-xs [&_h2]:font-bold [&_h2]:text-[#9ecaff] [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h3]:text-xs [&_h3]:font-bold [&_h3]:text-[#89919d] [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:mb-2 [&_p]:text-[#e5e2e1] [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-2 [&_li]:mb-0.5 [&_li]:text-[#e5e2e1] [&_strong]:text-[#9ecaff] [&_em]:text-[#89919d] [&_code]:bg-[#0e0e0e] [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[#f5a623] [&_blockquote]:border-l-2 [&_blockquote]:border-[#2196f3] [&_blockquote]:pl-3 [&_blockquote]:text-[#89919d] [&_blockquote]:my-2 [&_hr]:border-[#2a2a2a] [&_hr]:my-3">
              <Markdown>{caseline.caseline_document}</Markdown>
            </div>
          ) : (
            <p className="text-xs text-[#89919d] leading-relaxed">
              Caseline details will be populated when the game admin configures
              company profiles.
            </p>
          )}
        </div>
      </div>

      {/* SWOT placeholder */}
      <div className="space-y-3">
        <div className="text-[9px] text-[#89919d] uppercase font-bold tracking-widest">
          SWOT PROFILE
        </div>
        <div className="grid grid-cols-2 gap-1">
          {["STRENGTHS", "WEAKNESSES", "OPPORTUNITIES", "THREATS"].map(
            (label) => (
              <div key={label} className="bg-[#201f1f] p-2">
                <div className="text-[9px] text-[#89919d] uppercase font-bold tracking-widest mb-1">
                  {label}
                </div>
                <div className="text-[10px] text-[#404752] font-mono">--</div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
