"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSolutionsStore } from "@/stores/solutions-store";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  PROCESSING: { label: "PROCESSING", color: "#f5a623" },
  PENDING_APPROVAL: { label: "PENDING", color: "#2196f3" },
  APPROVED: { label: "APPROVED", color: "#40e56c" },
  REJECTED: { label: "REJECTED", color: "#FF1744" },
  FAILED: { label: "FAILED", color: "#FF1744" },
};

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function SolutionsPanel() {
  const role = useAuthStore((s) => s.role);
  const {
    solutions,
    cooldown,
    isSubmitting,
    isLoading,
    error,
    fetchSolutions,
    fetchCooldown,
    submitSolution,
    clearError,
  } = useSolutionsStore();

  const [content, setContent] = useState("");
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch on mount
  useEffect(() => {
    fetchSolutions();
    fetchCooldown();
  }, [fetchSolutions, fetchCooldown]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown?.cooldown_active && cooldown.seconds_remaining > 0) {
      setCooldownSeconds(cooldown.seconds_remaining);
    } else {
      setCooldownSeconds(0);
    }
  }, [cooldown]);

  useEffect(() => {
    if (cooldownSeconds <= 0) {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      return;
    }
    cooldownRef.current = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          fetchCooldown(); // Re-sync with server
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [cooldownSeconds, fetchCooldown]);

  // Periodic server sync for cooldown (every 30s)
  useEffect(() => {
    syncRef.current = setInterval(() => {
      fetchCooldown();
    }, 30000);
    return () => {
      if (syncRef.current) clearInterval(syncRef.current);
    };
  }, [fetchCooldown]);

  const hasInitialSubmission = solutions.some(
    (s) => s.solution_type === "INITIAL",
  );
  const isCooldownActive = cooldownSeconds > 0;

  const currentSolutionType: "INITIAL" | "MICROTWEAK" = hasInitialSubmission
    ? "MICROTWEAK"
    : "INITIAL";

  const handleSubmit = useCallback(async () => {
    if (!content.trim() || isSubmitting || isCooldownActive) return;

    try {
      await submitSolution(content.trim(), currentSolutionType);
      setContent("");
      toast.success(
        currentSolutionType === "INITIAL"
          ? "Strategic roadmap submitted"
          : "Microtweak submitted",
      );
    } catch {
      toast.error("Submission failed");
    }
  }, [
    content,
    isSubmitting,
    isCooldownActive,
    submitSolution,
    currentSolutionType,
  ]);

  // Trader view
  if (role === "trader") {
    return (
      <div className="p-4 space-y-6">
        <div className="text-[10px] text-[#89919d] uppercase font-bold tracking-widest">
          SOLUTIONS
        </div>
        <div className="flex-1 flex flex-col items-center justify-center py-12 space-y-4">
          <div className="font-mono text-xs text-[#404752] uppercase tracking-widest text-center">
            TRADER_VIEW_ONLY
          </div>
          <p className="text-xs text-[#89919d] text-center max-w-[240px] leading-relaxed">
            Solution submission is restricted to the strategist role. You have
            view-only market access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="text-[10px] text-[#89919d] uppercase font-bold tracking-widest">
        SOLUTIONS
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-[#1c1b1b] border-l-2 border-[#FF1744] p-2">
          <div className="text-[10px] text-[#FF1744] font-mono">{error}</div>
          <button
            onClick={clearError}
            className="text-[9px] text-[#89919d] underline mt-1"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* Cooldown display */}
      {isCooldownActive && (
        <div className="bg-[#1c1b1b] border-l-2 border-[#f5a623] p-3">
          <div className="text-[9px] text-[#89919d] uppercase font-bold tracking-widest mb-1">
            COOLDOWN_ACTIVE
          </div>
          <div className="font-mono text-lg text-[#f5a623] tabular-nums">
            {formatCountdown(cooldownSeconds)}
          </div>
          <div className="text-[9px] text-[#89919d] mt-1">
            Next submission available when timer expires
          </div>
        </div>
      )}

      {/* Editor */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[9px] text-[#89919d] uppercase font-bold tracking-widest">
            {currentSolutionType === "INITIAL"
              ? "STRATEGIC_ROADMAP"
              : "MICROTWEAK"}
          </div>
          <div className="text-[9px] text-[#404752] font-mono">
            {content.length} CHARS
          </div>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={isSubmitting || isCooldownActive}
          placeholder={
            currentSolutionType === "INITIAL"
              ? "Enter your strategic roadmap...\n\nDescribe your company's strategy, growth plans, competitive advantages, and key initiatives."
              : "Enter your microtweak...\n\nDescribe adjustments to your strategy based on market conditions."
          }
          className="w-full h-48 bg-[#0e0e0e] text-xs text-[#e5e2e1] font-mono p-3 border border-[#2a2a2a] focus:border-[#2196f3] resize-none placeholder:text-[#404752] disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={!content.trim() || isSubmitting || isCooldownActive}
          className="w-full py-2 text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-[#2196f3] text-white hover:bg-[#1976d2]"
        >
          {isSubmitting
            ? "SUBMITTING..."
            : currentSolutionType === "INITIAL"
              ? "SUBMIT_ROADMAP"
              : "SUBMIT_MICROTWEAK"}
        </button>
      </div>

      {/* Submission history */}
      {solutions.length > 0 && (
        <div className="space-y-2">
          <div className="text-[9px] text-[#89919d] uppercase font-bold tracking-widest">
            SUBMISSION_HISTORY
          </div>
          {isLoading ? (
            <div className="text-[10px] text-[#404752] font-mono py-2">
              LOADING...
            </div>
          ) : (
            <div className="space-y-1">
              {solutions.map((solution) => {
                const statusInfo = STATUS_STYLES[
                  solution.evaluation_status || ""
                ] || { label: "QUEUED", color: "#89919d" };

                return (
                  <div key={solution.id} className="bg-[#1c1b1b] p-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-[#89919d] font-mono uppercase">
                          {solution.solution_type}
                        </span>
                        <div className="flex items-center gap-1">
                          <span
                            className="inline-block w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: statusInfo.color }}
                          />
                          <span
                            className="text-[9px] font-mono uppercase"
                            style={{ color: statusInfo.color }}
                          >
                            {statusInfo.label}
                          </span>
                        </div>
                      </div>
                      <span className="text-[9px] text-[#404752] font-mono">
                        {new Date(solution.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#89919d] font-mono line-clamp-2">
                      {solution.content}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
