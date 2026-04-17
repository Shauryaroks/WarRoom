"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Gauge, ChevronDown, ChevronUp, Zap } from "lucide-react";
import { toast } from "sonner";

import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import type { FundamentalEvalListItem } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  PROCESSING: "text-amber-400 bg-amber-400/10",
  PENDING_APPROVAL: "text-[#2196f3] bg-[#2196f3]/10",
  APPROVED: "text-[#02c953] bg-[#02c953]/10",
  REJECTED: "text-[#FF1744] bg-[#FF1744]/10",
  FAILED: "text-red-800 bg-red-800/10",
};

const FILTER_OPTIONS = [
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "FAILED",
] as const;

function fmtDelta(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}`;
}

export default function FundamentalsPage() {
  const router = useRouter();
  const { isAuthenticated, role } = useAuthStore();

  const [filter, setFilter] = useState<string>("PENDING_APPROVAL");
  const [items, setItems] = useState<FundamentalEvalListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [roundInput, setRoundInput] = useState<number>(1);
  const [computeLoading, setComputeLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");
  const [showRejectFor, setShowRejectFor] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || role !== "admin") {
      router.replace("/auth/admin");
    }
  }, [isAuthenticated, role, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listFundamentalsQueue(filter);
      setItems(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (role === "admin") load();
  }, [role, load]);

  const handleCompute = async () => {
    setComputeLoading(true);
    try {
      const r = await api.computeFundamentals(roundInput);
      const { created, skipped, failed } = r as {
        created: string[];
        skipped: string[];
        failed: Array<{ ticker: string; error: string }>;
      };
      toast.success(
        `Round ${roundInput}: ${created.length} created, ${skipped.length} skipped, ${failed.length} failed`
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Compute failed");
    } finally {
      setComputeLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setActionLoading(true);
    try {
      await api.approveFundamental(id);
      toast.success("Fundamentals applied");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading(true);
    try {
      await api.rejectFundamental(id, rejectNotes);
      toast.success("Evaluation rejected");
      setShowRejectFor(null);
      setRejectNotes("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setActionLoading(false);
    }
  };

  if (!isAuthenticated || role !== "admin") return null;

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-[#2196f3]" />
          <h1 className="font-mono text-sm uppercase tracking-widest text-[#e5e2e1]">
            FUNDAMENTALS_QUEUE
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={roundInput}
            onChange={(e) => setRoundInput(parseInt(e.target.value) || 0)}
            className="w-16 bg-[#1c1b1b] border border-[#2a2a2a] text-xs text-[#e5e2e1] font-mono px-2 py-1.5 text-center"
          />
          <button
            onClick={handleCompute}
            disabled={computeLoading}
            className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-[#2196f3] text-white hover:bg-[#1976d2] disabled:opacity-30 flex items-center gap-1"
          >
            <Zap className="w-3 h-3" />
            {computeLoading ? "COMPUTING..." : "RUN_LLM_EVAL"}
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-1">
        {FILTER_OPTIONS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest border transition-colors ${
              filter === f
                ? "border-[#2196f3] bg-[#2196f3]/10 text-[#2196f3]"
                : "border-[#2a2a2a] bg-[#1c1b1b] text-[#89919d] hover:bg-[#2a2a2a]"
            }`}
          >
            {f}
          </button>
        ))}
        <button
          onClick={load}
          className="ml-auto px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest border border-[#2a2a2a] bg-[#1c1b1b] text-[#89919d] hover:bg-[#2a2a2a]"
        >
          REFRESH
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="font-mono text-xs text-[#89919d]">LOADING...</div>
      ) : items.length === 0 ? (
        <div className="bg-[#0e0e0e] border border-[#2a2a2a] p-6 text-center">
          <div className="font-mono text-xs text-[#89919d] uppercase tracking-widest">
            NO_EVALUATIONS / Filter: {filter}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const expanded = expandedId === item.id;
            const d = item.admin_edits || item.proposed_deltas;
            return (
              <div
                key={item.id}
                className="bg-[#0e0e0e] border border-[#2a2a2a]"
              >
                <button
                  onClick={() =>
                    setExpandedId(expanded ? null : item.id)
                  }
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#1c1b1b]"
                >
                  <div className="flex items-center gap-3">
                    {expanded ? (
                      <ChevronUp className="w-3 h-3 text-[#89919d]" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-[#89919d]" />
                    )}
                    <span className="font-mono text-xs text-[#e5e2e1] font-bold">
                      {item.ticker}
                    </span>
                    <span className="font-mono text-[10px] text-[#89919d]">
                      {item.team_name}
                    </span>
                    <span className="font-mono text-[10px] text-[#404752]">
                      R{item.round_number}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] text-[#89919d]">
                      MS {fmtDelta(d.market_share_delta)} · MG {fmtDelta(d.margin_delta)} · OP {fmtDelta(d.ops_efficiency_delta)} · GR {fmtDelta(d.growth_delta)}
                    </span>
                    <span
                      className={`font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 ${STATUS_COLORS[item.status] || ""}`}
                    >
                      {item.status}
                    </span>
                  </div>
                </button>

                {expanded && (
                  <div className="px-4 pb-4 pt-0 space-y-3 border-t border-[#2a2a2a]">
                    {/* Deltas grid */}
                    <div className="grid grid-cols-4 gap-2 pt-3">
                      {[
                        ["market_share_delta", "MARKET_SHARE"],
                        ["margin_delta", "PROFITABILITY"],
                        ["ops_efficiency_delta", "OPS"],
                        ["growth_delta", "BRAND_HEALTH"],
                      ].map(([key, label]) => {
                        const v = (d as unknown as Record<string, number>)[key];
                        return (
                          <div
                            key={key}
                            className="bg-[#1c1b1b] border border-[#2a2a2a] p-2"
                          >
                            <div className="text-[9px] text-[#89919d] uppercase tracking-widest font-bold">
                              {label}
                            </div>
                            <div
                              className={`font-mono text-sm mt-1 ${
                                v >= 0 ? "text-[#02c953]" : "text-[#FF1744]"
                              }`}
                            >
                              {fmtDelta(v)}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Narrative */}
                    {item.narrative && (
                      <div className="bg-[#1c1b1b] border border-[#2a2a2a] p-3">
                        <div className="text-[9px] text-[#89919d] uppercase tracking-widest font-bold mb-1">
                          NARRATIVE
                        </div>
                        <div className="font-mono text-xs text-[#e5e2e1] leading-relaxed">
                          {item.narrative}
                        </div>
                      </div>
                    )}

                    {/* Timestamps */}
                    <div className="flex gap-4 text-[9px] text-[#404752] font-mono">
                      {item.created_at && <span>created: {item.created_at.slice(0, 19)}</span>}
                      {item.approved_at && <span>approved: {item.approved_at.slice(0, 19)}</span>}
                      {item.rejected_at && <span>rejected: {item.rejected_at.slice(0, 19)}</span>}
                    </div>

                    {/* Actions (PENDING only) */}
                    {item.status === "PENDING_APPROVAL" && (
                      <div className="space-y-2">
                        {showRejectFor === item.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={rejectNotes}
                              onChange={(e) => setRejectNotes(e.target.value)}
                              placeholder="Rejection reason (optional)..."
                              className="w-full bg-[#1c1b1b] border border-[#2a2a2a] text-xs text-[#e5e2e1] font-mono px-2 py-1.5 placeholder:text-[#404752]"
                              rows={2}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleReject(item.id)}
                                disabled={actionLoading}
                                className="flex-1 py-1.5 font-mono text-[10px] uppercase tracking-widest bg-[#FF1744] text-white hover:bg-[#D50000] disabled:opacity-30"
                              >
                                CONFIRM_REJECT
                              </button>
                              <button
                                onClick={() => {
                                  setShowRejectFor(null);
                                  setRejectNotes("");
                                }}
                                className="flex-1 py-1.5 font-mono text-[10px] uppercase tracking-widest bg-[#1c1b1b] text-[#89919d] border border-[#2a2a2a] hover:bg-[#2a2a2a]"
                              >
                                CANCEL
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApprove(item.id)}
                              disabled={actionLoading}
                              className="flex-1 py-1.5 font-mono text-[10px] uppercase tracking-widest bg-[#02c953] text-white hover:bg-[#019540] disabled:opacity-30"
                            >
                              APPROVE_AND_APPLY
                            </button>
                            <button
                              onClick={() => setShowRejectFor(item.id)}
                              disabled={actionLoading}
                              className="flex-1 py-1.5 font-mono text-[10px] uppercase tracking-widest bg-[#1c1b1b] text-[#FF1744] border border-[#FF1744]/40 hover:bg-[#FF1744]/10 disabled:opacity-30"
                            >
                              REJECT
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
