"use client";

import { useState } from "react";
import { ClipboardCheck } from "lucide-react";

const FILTER_OPTIONS = ["ALL", "PENDING", "APPROVED", "REJECTED"] as const;

export default function EvaluationsPage() {
  const [activeFilter, setActiveFilter] = useState<string>("ALL");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-black font-mono tracking-widest text-[#9ecaff] uppercase">
          EVALUATION_QUEUE
        </h2>
        <span className="text-sm font-mono text-gray-500">QUEUE_EMPTY</span>
      </div>

      {/* Filter bar */}
      <div className="flex gap-0">
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
            {filter}
          </button>
        ))}
      </div>

      {/* Empty state */}
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
            EVALUATION_CARDS_PLACEHOLDER
          </span>
        </div>
      </div>

      {/* Template preview card */}
      <div className="opacity-40 relative">
        <div className="absolute top-3 right-3 font-mono text-xs text-gray-500 bg-[#0e0e0e] px-3 py-1 z-10">
          TEMPLATE_PREVIEW
        </div>
        <div className="bg-[#1c1b1b] p-6">
          {/* Top row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="font-bold text-[#e5e2e1] text-base">
                TEAM_ALPHA
              </span>
              <span className="text-sm font-mono text-[#9ecaff] bg-[#9ecaff]/10 px-3 py-1">
                ALPH
              </span>
            </div>
            <span className="text-sm text-gray-500 font-mono">
              2026-01-15 14:32:00
            </span>
          </div>

          {/* Score row */}
          <div className="mt-4">
            <div className="flex items-center gap-4 mb-2">
              <span className="font-mono text-sm text-gray-500">
                QUALITY_SCORE
              </span>
              <div className="flex-1 bg-[#0e0e0e] h-3 overflow-hidden">
                <div
                  className="h-full bg-[#2196f3]"
                  style={{ width: "72%" }}
                />
              </div>
              <span className="font-mono text-sm text-[#2196f3] font-bold">
                72
              </span>
            </div>
            <p className="text-sm text-gray-400 line-clamp-2">
              Team proposes a diversified acquisition strategy focusing on
              synergies in the technology sector with emphasis on recurring
              revenue models...
            </p>
          </div>

          {/* Action row */}
          <div className="flex gap-3 mt-5">
            <button
              disabled
              className="bg-[#02c953] text-[#003912] px-5 py-2.5 font-mono text-sm font-bold cursor-not-allowed opacity-50"
            >
              APPROVE
            </button>
            <button
              disabled
              className="bg-[#2196f3] text-white px-5 py-2.5 font-mono text-sm font-bold cursor-not-allowed opacity-50"
            >
              EDIT
            </button>
            <button
              disabled
              className="bg-[#FF1744]/80 text-white px-5 py-2.5 font-mono text-sm font-bold cursor-not-allowed opacity-50"
            >
              REJECT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
