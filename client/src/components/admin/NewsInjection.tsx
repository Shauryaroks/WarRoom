"use client";

import { useState } from "react";

const MAX_HEADLINE_CHARS = 120;

interface NewsInjectionProps {
  onBroadcast?: (headline: string, impact: "bullish" | "bearish") => void;
}

export function NewsInjection({ onBroadcast }: NewsInjectionProps) {
  const [headline, setHeadline] = useState("");
  const [impact, setImpact] = useState<"bullish" | "bearish" | "">("");

  const charCount = headline.length;
  const isOverLimit = charCount > MAX_HEADLINE_CHARS;

  const handleBroadcast = () => {
    if (headline.trim() && impact && !isOverLimit && onBroadcast) {
      onBroadcast(headline, impact);
      setHeadline("");
      setImpact("");
    }
  };

  return (
    <div className="flex-1 p-4 border-r border-white/5 bg-[#0f0f0f]">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-sm text-[#0077b6]">
          megaphone
        </span>
        <span className="text-[10px] font-bold text-[#0077b6] uppercase">
          BREAKING_NEWS_INJECTION
        </span>
      </div>
      <div className="space-y-3">
        <div className="relative">
          <input
            className={`w-full bg-black border border-white/10 p-2 text-[10px] outline-none focus:border-[#0077b6] ${isOverLimit ? "border-[#ff3333] text-[#ff3333]" : ""}`}
            placeholder="ENTER_HEADLINE_TEXT..."
            value={headline}
            onChange={(e) =>
              setHeadline(e.target.value.slice(0, MAX_HEADLINE_CHARS + 20))
            }
          />
          <span
            className={`absolute right-2 top-2 text-[9px] ${isOverLimit ? "text-[#ff3333]" : "text-zinc-500"}`}
          >
            ({charCount}/{MAX_HEADLINE_CHARS})
          </span>
        </div>
        <div className="flex gap-2">
          <select
            className="flex-1 bg-black border border-white/10 p-2 text-[10px] outline-none focus:border-[#0077b6] cursor-pointer"
            value={impact}
            onChange={(e) => setImpact(e.target.value as "bullish" | "bearish")}
          >
            <option value="">SELECT IMPACT</option>
            <option value="bullish" className="text-[#00c853]">
              BULLISH (+)
            </option>
            <option value="bearish" className="text-[#ff3333]">
              BEARISH (-)
            </option>
          </select>
          <button
            onClick={handleBroadcast}
            disabled={!headline.trim() || !impact || isOverLimit}
            className="px-4 bg-[#2196F3] text-white text-[10px] font-bold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            BROADCAST_TO_WIRE
          </button>
        </div>
      </div>
    </div>
  );
}

interface ObservabilityProps {
  llmStats?: {
    avgResponse: string;
    confidence: string;
    blocked: number;
  };
  marketStats?: {
    volIndex: string;
    mostTraded: string;
    pending: number;
  };
}

export function Observability({
  llmStats = { avgResponse: "1.2S", confidence: "87%", blocked: 2 },
  marketStats = { volIndex: "12.4", mostTraded: "$APEX", pending: 3 },
}: ObservabilityProps) {
  return (
    <div className="w-96 p-4 bg-black">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-sm text-[#00c853]">
          analytics
        </span>
        <span className="text-[10px] font-bold text-[#00c853] uppercase">
          OBSERVABILITY_SUITE
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-[9px] text-zinc-500 uppercase">
            LLM_PERFORMANCE
          </div>
          <div className="space-y-1 text-[10px]">
            <div className="flex justify-between">
              <span>AVG_RESP:</span>{" "}
              <span className="text-white">{llmStats.avgResponse}</span>
            </div>
            <div className="flex justify-between">
              <span>CONFIDENCE:</span>{" "}
              <span className="text-white">{llmStats.confidence}</span>
            </div>
            <div className="flex justify-between">
              <span>SEC_FLAGS:</span>{" "}
              <span className="text-[#ff3333]">{llmStats.blocked}</span>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-[9px] text-zinc-500 uppercase">
            MARKET_HEALTH
          </div>
          <div className="space-y-1 text-[10px]">
            <div className="flex justify-between">
              <span>VOL_INDEX:</span>{" "}
              <span className="text-white">{marketStats.volIndex}</span>
            </div>
            <div className="flex justify-between">
              <span>MOST_TRADED:</span>{" "}
              <span className="text-[#0077b6]">{marketStats.mostTraded}</span>
            </div>
            <div className="flex justify-between">
              <span>PENDING:</span>{" "}
              <span className="text-white">{marketStats.pending}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <div className="flex-1 h-8 bg-white/5 border border-white/5 flex items-end p-1 gap-0.5">
          <div className="flex-1 bg-[#00c853]/40 h-[20%]"></div>
          <div className="flex-1 bg-[#00c853]/40 h-[40%]"></div>
          <div className="flex-1 bg-[#00c853]/40 h-[30%]"></div>
          <div className="flex-1 bg-[#00c853]/40 h-[60%]"></div>
          <div className="flex-1 bg-[#00c853]/40 h-[80%]"></div>
          <div className="flex-1 bg-[#00c853] h-full"></div>
        </div>
        <div className="flex-1 h-8 bg-white/5 border border-white/5 flex items-end p-1 gap-0.5">
          <div className="flex-1 bg-[#0077b6]/40 h-[80%]"></div>
          <div className="flex-1 bg-[#0077b6]/40 h-[60%]"></div>
          <div className="flex-1 bg-[#0077b6]/40 h-[70%]"></div>
          <div className="flex-1 bg-[#0077b6]/40 h-[40%]"></div>
          <div className="flex-1 bg-[#0077b6]/40 h-[20%]"></div>
          <div className="flex-1 bg-[#0077b6] h-[30%]"></div>
        </div>
      </div>
    </div>
  );
}
