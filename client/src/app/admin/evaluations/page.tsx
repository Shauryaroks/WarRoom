"use client";

import { useState, useEffect, useCallback } from "react";
import { ClipboardCheck, ChevronDown, ChevronUp, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { useAuthStore } from "@/stores/auth-store";
import { useWebSocket } from "@/hooks/use-websocket";
import { api } from "@/lib/api";
import type { EvaluationListItem } from "@/lib/types";
import { toast } from "sonner";

const FILTER_OPTIONS = [
  "ALL",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "PROCESSING",
  "FAILED",
] as const;

const STATUS_COLORS: Record<string, string> = {
  PROCESSING: "text-amber-400 bg-amber-400/10",
  PENDING_APPROVAL: "text-[#2196f3] bg-[#2196f3]/10",
  APPROVED: "text-[#02c953] bg-[#02c953]/10",
  REJECTED: "text-[#FF1744] bg-[#FF1744]/10",
  FAILED: "text-red-800 bg-red-800/10",
};

interface ScoringMetrics {
  strategic_quality: number;
  feasibility: number;
  innovation: number;
  market_awareness: number;
  overall_score: number;
}

interface PriceTimelineEntry {
  month: number;
  price_change_pct: number;
}

export default function EvaluationsPage() {
  const router = useRouter();
  const { isAuthenticated, role } = useAuthStore();

  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [evaluations, setEvaluations] = useState<EvaluationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Edit form state
  const [editMetrics, setEditMetrics] = useState<ScoringMetrics | null>(null);
  const [editHeadline, setEditHeadline] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editSentiment, setEditSentiment] = useState(0);
  const [editTimeline, setEditTimeline] = useState<PriceTimelineEntry[]>([]);
  const [rejectNotes, setRejectNotes] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Auth guard
  useEffect(() => {
    if (!isAuthenticated || role !== "admin") {
      router.push("/admin/login");
    }
  }, [isAuthenticated, role, router]);

  // Fetch evaluations
  const fetchEvaluations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getEvaluations(
        activeFilter === "ALL" ? undefined : activeFilter,
      );
      setEvaluations(data);
    } catch {
      toast.error("Failed to load evaluations");
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    if (isAuthenticated && role === "admin") {
      fetchEvaluations();
    }
  }, [isAuthenticated, role, fetchEvaluations]);

  // WebSocket: auto-refresh on evaluation_pending
  const handleMessage = useCallback(
    (data: Record<string, unknown>) => {
      if (
        data.type === "evaluation_pending" ||
        data.type === "evaluation_updated"
      ) {
        fetchEvaluations();
      }
    },
    [fetchEvaluations],
  );

  useWebSocket({
    onMessage: handleMessage,
    enabled: isAuthenticated && role === "admin",
  });

  // Expand an evaluation and populate edit form
  function handleExpand(evaluation: EvaluationListItem) {
    if (expandedId === evaluation.id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(evaluation.id);
    setShowRejectInput(false);
    setRejectNotes("");

    // Parse scoring_metrics
    try {
      const metrics = evaluation.scoring_metrics
        ? JSON.parse(evaluation.scoring_metrics)
        : {
            strategic_quality: 0,
            feasibility: 0,
            innovation: 0,
            market_awareness: 0,
            overall_score: evaluation.overall_score ?? 0,
          };
      setEditMetrics(metrics);
    } catch {
      setEditMetrics({
        strategic_quality: 0,
        feasibility: 0,
        innovation: 0,
        market_awareness: 0,
        overall_score: evaluation.overall_score ?? 0,
      });
    }

    setEditHeadline(evaluation.news_headline ?? "");
    setEditBody(evaluation.news_body ?? "");
    setEditSentiment(evaluation.news_sentiment ?? 0);

    // Parse price_timeline
    try {
      const timeline = evaluation.price_timeline
        ? JSON.parse(evaluation.price_timeline)
        : [];
      setEditTimeline(Array.isArray(timeline) ? timeline : []);
    } catch {
      setEditTimeline([]);
    }
  }

  // Save edits
  async function handleSaveEdits(evaluationId: string) {
    if (!editMetrics) return;
    setActionLoading(true);
    try {
      await api.editEvaluation(evaluationId, {
        overall_score: editMetrics.overall_score,
        scoring_metrics: JSON.stringify(editMetrics),
        news_headline: editHeadline,
        news_body: editBody,
        news_sentiment: editSentiment,
        price_timeline: JSON.stringify(editTimeline),
      });
      toast.success("Evaluation updated");
      await fetchEvaluations();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save changes",
      );
    } finally {
      setActionLoading(false);
    }
  }

  // Approve
  async function handleApprove(evaluationId: string) {
    setActionLoading(true);
    try {
      await api.approveEvaluation(evaluationId);
      toast.success("Evaluation approved -- impact queued for next tick");
      setExpandedId(null);
      await fetchEvaluations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setActionLoading(false);
    }
  }

  // Reject
  async function handleReject(evaluationId: string) {
    setActionLoading(true);
    try {
      await api.rejectEvaluation(evaluationId, rejectNotes || undefined);
      toast.success("Evaluation rejected");
      setExpandedId(null);
      setShowRejectInput(false);
      setRejectNotes("");
      await fetchEvaluations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject");
    } finally {
      setActionLoading(false);
    }
  }

  const pendingCount = evaluations.filter(
    (e) => e.status === "PENDING_APPROVAL",
  ).length;

  if (!isAuthenticated || role !== "admin") {
    return null;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-base font-black font-mono tracking-widest text-[#9ecaff] uppercase">
            EVALUATION_QUEUE
          </h2>
          {pendingCount > 0 && (
            <span className="font-mono text-xs font-bold px-3 py-1 bg-[#2196f3]/10 text-[#2196f3]">
              {pendingCount} PENDING
            </span>
          )}
        </div>
        <span className="text-sm font-mono text-gray-500">
          {evaluations.length} TOTAL
        </span>
      </div>

      {/* Filter bar */}
      <div className="flex gap-0 flex-wrap">
        {FILTER_OPTIONS.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-5 py-2.5 font-mono text-sm font-bold transition-colors ${
              activeFilter === filter
                ? "bg-[#2196f3]/10 text-[#2196f3]"
                : "bg-[#2a2a2a] text-gray-500 hover:text-gray-300"
            }`}
          >
            {filter.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="bg-[#1c1b1b] p-12 text-center">
          <span className="font-mono text-sm text-gray-500 tracking-widest animate-pulse">
            LOADING_EVALUATIONS...
          </span>
        </div>
      )}

      {/* Empty state */}
      {!loading && evaluations.length === 0 && (
        <div className="bg-[#1c1b1b] p-12 text-center">
          <ClipboardCheck size={48} className="text-gray-600 mx-auto" />
          <h3 className="text-lg font-bold font-mono text-gray-400 mt-6">
            NO PENDING EVALUATIONS
          </h3>
          <p className="text-sm text-gray-600 mt-3 max-w-md mx-auto">
            Submissions will appear here when teams submit solutions. You can
            review, edit scores, and approve or reject each evaluation.
          </p>
          <div className="mt-6 border-2 border-dashed border-gray-700 p-8 max-w-lg mx-auto">
            <span className="font-mono text-sm text-gray-600">
              {activeFilter === "ALL"
                ? "QUEUE_EMPTY"
                : `NO_${activeFilter}_EVALUATIONS`}
            </span>
          </div>
        </div>
      )}

      {/* Evaluation cards */}
      {!loading &&
        evaluations.map((evaluation) => (
          <div key={evaluation.id} className="bg-[#1c1b1b]">
            {/* Card header */}
            <div
              className="p-6 cursor-pointer hover:bg-[#222] transition-colors"
              onClick={() => handleExpand(evaluation)}
            >
              {/* Top row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="font-bold text-[#e5e2e1] text-base">
                    {evaluation.team_name}
                  </span>
                  <span className="text-sm font-mono text-[#9ecaff] bg-[#9ecaff]/10 px-3 py-1">
                    {evaluation.team_ticker}
                  </span>
                  <span className="text-xs font-mono text-gray-400 bg-[#2a2a2a] px-3 py-1 uppercase">
                    {evaluation.solution_type}
                  </span>
                  <span
                    className={`text-xs font-mono font-bold px-3 py-1 uppercase tracking-wider ${
                      STATUS_COLORS[evaluation.status] ||
                      "text-gray-500 bg-gray-500/10"
                    }`}
                  >
                    {evaluation.status.replace("_", " ")}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500 font-mono">
                    {new Date(evaluation.created_at).toLocaleString()}
                  </span>
                  {expandedId === evaluation.id ? (
                    <ChevronUp size={16} className="text-gray-500" />
                  ) : (
                    <ChevronDown size={16} className="text-gray-500" />
                  )}
                </div>
              </div>

              {/* Score row */}
              {evaluation.overall_score !== null && (
                <div className="mt-4">
                  <div className="flex items-center gap-4 mb-2">
                    <span className="font-mono text-sm text-gray-500">
                      QUALITY_SCORE
                    </span>
                    <div className="flex-1 bg-[#0e0e0e] h-3 overflow-hidden">
                      <div
                        className="h-full bg-[#2196f3]"
                        style={{
                          width: `${Math.round(evaluation.overall_score * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="font-mono text-sm text-[#2196f3] font-bold">
                      {Math.round(evaluation.overall_score * 100)}
                    </span>
                  </div>
                  {evaluation.news_headline && (
                    <p className="text-sm text-gray-400 line-clamp-2">
                      {evaluation.news_headline}
                    </p>
                  )}
                </div>
              )}

              {/* Quick action buttons (collapsed view) */}
              {evaluation.status === "PENDING_APPROVAL" &&
                expandedId !== evaluation.id && (
                  <div className="flex gap-3 mt-5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApprove(evaluation.id);
                      }}
                      disabled={actionLoading}
                      className="bg-[#02c953] text-[#003912] px-5 py-2.5 font-mono text-sm font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                    >
                      APPROVE
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExpand(evaluation);
                      }}
                      className="bg-[#2196f3] text-white px-5 py-2.5 font-mono text-sm font-bold hover:brightness-110 active:scale-95 transition-all"
                    >
                      EDIT
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReject(evaluation.id);
                      }}
                      disabled={actionLoading}
                      className="bg-[#FF1744]/80 text-white px-5 py-2.5 font-mono text-sm font-bold hover:bg-[#FF1744] active:scale-95 transition-all disabled:opacity-50"
                    >
                      REJECT
                    </button>
                  </div>
                )}
            </div>

            {/* Expanded detail view (D-08: one-at-a-time review) */}
            {expandedId === evaluation.id && (
              <div className="border-t border-[#2a2a2a] p-6 space-y-6">
                {/* Team submission (what the strategist actually wrote) */}
                <div>
                  <h4 className="font-mono text-xs text-gray-500 tracking-widest mb-4 uppercase">
                    TEAM_SUBMISSION // {evaluation.solution_type}
                  </h4>
                  <div className="bg-[#0e0e0e] border border-[#2a2a2a] max-h-96 overflow-y-auto">
                    {evaluation.solution_content ? (
                      <pre className="font-mono text-xs text-[#e5e2e1] p-4 whitespace-pre-wrap break-words leading-relaxed">
                        {evaluation.solution_content}
                      </pre>
                    ) : (
                      <p className="font-mono text-xs text-gray-600 p-4">
                        (solution content unavailable — submission may have been
                        deleted)
                      </p>
                    )}
                  </div>
                </div>

                {/* Scoring Metrics */}
                <div>
                  <h4 className="font-mono text-xs text-gray-500 tracking-widest mb-4 uppercase">
                    SCORING_METRICS
                  </h4>
                  {editMetrics && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      {(
                        Object.keys(editMetrics) as Array<keyof ScoringMetrics>
                      ).map((key) => (
                        <div key={key}>
                          <label className="block font-mono text-xs text-gray-500 mb-1 uppercase">
                            {key.replace(/_/g, " ")}
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={1}
                            step={0.01}
                            value={editMetrics[key]}
                            onChange={(e) => {
                              const val = Math.max(
                                0,
                                Math.min(1, parseFloat(e.target.value) || 0),
                              );
                              setEditMetrics({
                                ...editMetrics,
                                [key]: val,
                              });
                            }}
                            disabled={evaluation.status !== "PENDING_APPROVAL"}
                            className="w-full bg-[#0e0e0e] border border-[#2a2a2a] text-[#e5e2e1] font-mono text-sm px-3 py-2 focus:border-[#2196f3] focus:outline-none disabled:opacity-50"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* News Article */}
                <div>
                  <h4 className="font-mono text-xs text-gray-500 tracking-widest mb-4 uppercase">
                    NEWS_ARTICLE
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block font-mono text-xs text-gray-500 mb-1">
                        HEADLINE (max 120 chars)
                      </label>
                      <input
                        type="text"
                        maxLength={120}
                        value={editHeadline}
                        onChange={(e) => setEditHeadline(e.target.value)}
                        disabled={evaluation.status !== "PENDING_APPROVAL"}
                        className="w-full bg-[#0e0e0e] border border-[#2a2a2a] text-[#e5e2e1] font-mono text-sm px-3 py-2 focus:border-[#2196f3] focus:outline-none disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-xs text-gray-500 mb-1">
                        BODY
                      </label>
                      <textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        disabled={evaluation.status !== "PENDING_APPROVAL"}
                        rows={5}
                        className="w-full bg-[#0e0e0e] border border-[#2a2a2a] text-[#e5e2e1] font-mono text-sm px-3 py-2 focus:border-[#2196f3] focus:outline-none resize-y disabled:opacity-50"
                      />
                    </div>
                    <div className="w-48">
                      <label className="block font-mono text-xs text-gray-500 mb-1">
                        SENTIMENT (-1.0 to 1.0)
                      </label>
                      <input
                        type="number"
                        min={-1}
                        max={1}
                        step={0.1}
                        value={editSentiment}
                        onChange={(e) => {
                          const val = Math.max(
                            -1,
                            Math.min(1, parseFloat(e.target.value) || 0),
                          );
                          setEditSentiment(val);
                        }}
                        disabled={evaluation.status !== "PENDING_APPROVAL"}
                        className="w-full bg-[#0e0e0e] border border-[#2a2a2a] text-[#e5e2e1] font-mono text-sm px-3 py-2 focus:border-[#2196f3] focus:outline-none disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>

                {/* Price Timeline */}
                <div>
                  <h4 className="font-mono text-xs text-gray-500 tracking-widest mb-4 uppercase">
                    PRICE_TIMELINE
                  </h4>
                  {editTimeline.length > 0 ? (
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                      {editTimeline.map((entry, idx) => (
                        <div key={idx}>
                          <label className="block font-mono text-xs text-gray-500 mb-1">
                            MONTH {entry.month ?? idx + 1}
                          </label>
                          <input
                            type="number"
                            step={0.01}
                            value={entry.price_change_pct}
                            onChange={(e) => {
                              const updated = [...editTimeline];
                              updated[idx] = {
                                ...updated[idx],
                                price_change_pct:
                                  parseFloat(e.target.value) || 0,
                              };
                              setEditTimeline(updated);
                            }}
                            disabled={evaluation.status !== "PENDING_APPROVAL"}
                            className="w-full bg-[#0e0e0e] border border-[#2a2a2a] text-[#e5e2e1] font-mono text-sm px-3 py-2 focus:border-[#2196f3] focus:outline-none disabled:opacity-50"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="font-mono text-xs text-gray-600">
                      NO_TIMELINE_DATA
                    </span>
                  )}
                </div>

                {/* LLM Model */}
                {evaluation.llm_model && (
                  <div>
                    <h4 className="font-mono text-xs text-gray-500 tracking-widest mb-2 uppercase">
                      LLM_MODEL
                    </h4>
                    <span className="font-mono text-sm text-gray-400">
                      {evaluation.llm_model}
                    </span>
                  </div>
                )}

                {/* Admin Notes (for rejected) */}
                {evaluation.admin_notes && (
                  <div>
                    <h4 className="font-mono text-xs text-gray-500 tracking-widest mb-2 uppercase">
                      ADMIN_NOTES
                    </h4>
                    <p className="font-mono text-sm text-gray-400">
                      {evaluation.admin_notes}
                    </p>
                  </div>
                )}

                {/* Actions for PENDING_APPROVAL */}
                {evaluation.status === "PENDING_APPROVAL" && (
                  <div className="border-t border-[#2a2a2a] pt-5 space-y-4">
                    {/* Reject notes input */}
                    {showRejectInput && (
                      <div className="flex items-start gap-3">
                        <textarea
                          value={rejectNotes}
                          onChange={(e) => setRejectNotes(e.target.value)}
                          placeholder="Rejection notes (optional)..."
                          rows={2}
                          className="flex-1 bg-[#0e0e0e] border border-[#2a2a2a] text-[#e5e2e1] font-mono text-sm px-3 py-2 focus:border-[#FF1744] focus:outline-none resize-none"
                        />
                        <button
                          onClick={() => {
                            setShowRejectInput(false);
                            setRejectNotes("");
                          }}
                          className="text-gray-500 hover:text-gray-300 p-1"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={() => handleSaveEdits(evaluation.id)}
                        disabled={actionLoading}
                        className="bg-[#2a2a2a] text-[#2196f3] px-5 py-2.5 font-mono text-sm font-bold hover:bg-[#2196f3]/10 active:scale-95 transition-all disabled:opacity-50"
                      >
                        SAVE CHANGES
                      </button>
                      <button
                        onClick={() => handleApprove(evaluation.id)}
                        disabled={actionLoading}
                        className="bg-[#02c953] text-[#003912] px-5 py-2.5 font-mono text-sm font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                      >
                        APPROVE
                      </button>
                      {showRejectInput ? (
                        <button
                          onClick={() => handleReject(evaluation.id)}
                          disabled={actionLoading}
                          className="bg-[#FF1744] text-white px-5 py-2.5 font-mono text-sm font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                        >
                          CONFIRM REJECT
                        </button>
                      ) : (
                        <button
                          onClick={() => setShowRejectInput(true)}
                          className="bg-[#FF1744]/80 text-white px-5 py-2.5 font-mono text-sm font-bold hover:bg-[#FF1744] active:scale-95 transition-all"
                        >
                          REJECT
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
    </div>
  );
}
