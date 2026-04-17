"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, TrendingUp, FileText, Check } from "lucide-react";
import { useGameStore } from "@/stores/game-store";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { toast } from "sonner";

export function WarRoomPanel() {
  const macroBrief = useGameStore((s) => s.macroBrief);
  const currentRound = useGameStore((s) => s.currentRound);
  const role = useAuthStore((s) => s.role);

  const [planContent, setPlanContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedContent, setSubmittedContent] = useState("");

  // Load existing operating plan
  useEffect(() => {
    api
      .getOperatingPlan()
      .then((plan) => {
        setPlanContent(plan.content);
        setSubmittedContent(plan.content);
        setSubmitted(true);
      })
      .catch(() => {
        // No plan yet
      });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!planContent.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await api.submitOperatingPlan(planContent.trim());
      setSubmittedContent(planContent.trim());
      setSubmitted(true);
      toast.success("Operating plan submitted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  }, [planContent, isSubmitting]);

  return (
    <div className="p-4 space-y-4">
      {/* War Room badge */}
      <div className="bg-[#f59e0b]/10 border border-[#f59e0b]/30 px-3 py-2 flex items-center gap-2">
        <Shield className="w-4 h-4 text-[#f59e0b]" />
        <span className="font-mono text-sm font-bold text-[#f59e0b] uppercase tracking-widest">
          WAR ROOM
        </span>
        <span className="font-mono text-[10px] text-[#89919d] ml-auto">
          ROUND {currentRound}
        </span>
      </div>

      {/* Performance review section */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3 text-[#89919d]" />
          <div className="text-[9px] text-[#89919d] uppercase font-bold tracking-widest">
            PREVIOUS QUARTER PERFORMANCE
          </div>
        </div>
        <div className="bg-[#0e0e0e] border border-[#2a2a2a] p-3">
          <div className="font-mono text-[10px] text-[#89919d] space-y-1">
            <div className="flex items-center justify-between">
              <span>Current Round</span>
              <span className="text-[#e5e2e1]">{currentRound}</span>
            </div>
            <div className="border-t border-[#2a2a2a] my-1.5" />
            <div className="text-[9px] text-[#404752] italic">
              Detailed performance metrics (revenue, margin, market share vs
              benchmark) will be available in Phase 9.
            </div>
          </div>
        </div>
      </div>

      {/* Macro brief section */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <FileText className="w-3 h-3 text-[#89919d]" />
          <div className="text-[9px] text-[#89919d] uppercase font-bold tracking-widest">
            MACRO BRIEF
          </div>
        </div>
        <div className="bg-[#0e0e0e] border border-[#2a2a2a] p-3">
          {macroBrief ? (
            <div className="font-mono text-xs text-[#e5e2e1] leading-relaxed whitespace-pre-wrap">
              {macroBrief}
            </div>
          ) : (
            <div className="font-mono text-[10px] text-[#404752] italic">
              No macro brief available. Waiting for admin...
            </div>
          )}
        </div>
      </div>

      {/* Operating plan form (strategist only) */}
      {role === "strategist" && (
        <div className="space-y-2">
          <div className="text-[9px] text-[#89919d] uppercase font-bold tracking-widest">
            OPERATING PLAN
          </div>

          {submitted && submittedContent ? (
            <div className="space-y-2">
              {/* Submitted confirmation */}
              <div className="bg-[#1c1b1b] border-l-2 border-[#4caf50] p-3 flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#4caf50]" />
                <span className="font-mono text-[10px] text-[#4caf50] uppercase tracking-widest">
                  PLAN_SUBMITTED
                </span>
              </div>
              <div className="bg-[#0e0e0e] border border-[#2a2a2a] p-3 max-h-48 overflow-y-auto">
                <div className="font-mono text-[10px] text-[#e5e2e1] whitespace-pre-wrap leading-relaxed">
                  {submittedContent}
                </div>
              </div>
              <button
                onClick={() => setSubmitted(false)}
                className="w-full py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors bg-[#1c1b1b] text-[#89919d] hover:bg-[#2a2a2a] border border-[#2a2a2a]"
              >
                REVISE_PLAN
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[9px] text-[#404752] font-mono">
                  Markdown supported
                </div>
                <div className="text-[9px] text-[#404752] font-mono">
                  {planContent.length} CHARS
                </div>
              </div>
              <textarea
                value={planContent}
                onChange={(e) => setPlanContent(e.target.value)}
                disabled={isSubmitting}
                placeholder="Outline your operating plan for this quarter...&#10;&#10;- Key strategic priorities&#10;- Resource allocation rationale&#10;- Expected outcomes"
                className="w-full h-48 bg-[#0e0e0e] text-xs text-[#e5e2e1] font-mono p-3 border border-[#2a2a2a] focus:border-[#2196f3] resize-none placeholder:text-[#404752] disabled:opacity-50"
              />
              <button
                onClick={handleSubmit}
                disabled={!planContent.trim() || isSubmitting}
                className="w-full py-2 text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-[#f59e0b] text-black hover:bg-[#d97706]"
              >
                {isSubmitting ? "SUBMITTING..." : "SUBMIT_PLAN"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Trader view for operating plan */}
      {role === "trader" && (
        <div className="space-y-2">
          <div className="text-[9px] text-[#89919d] uppercase font-bold tracking-widest">
            OPERATING PLAN
          </div>
          <div className="bg-[#0e0e0e] border border-[#2a2a2a] p-3">
            <div className="font-mono text-[10px] text-[#404752] italic">
              Operating plan submission is handled by the strategist.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
