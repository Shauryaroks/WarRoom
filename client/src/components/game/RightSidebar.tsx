"use client";

import { useState } from "react";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { NewsItem } from "@/lib/models";

export function RightSidebar() {
  const [filter, setFilter] = useState<"ALL" | "GLOBAL" | "HOLDINGS" | "SYSTEM">("ALL");
  const { marketNews: newsItems } = useWebSocket();

  const getTagStyle = (item: NewsItem) => {
    switch (item.source_type) {
      case "GLOBAL":
      case "ADMIN_INJECTED":
        return "bg-[#2a2a2a] text-white";
      case "TEAM_ACTION":
        return "bg-[#332200] text-[#ffb000]";
      case "SYSTEM":
        return "bg-[#002233] text-[#00d4ff]";
    }
  };

  const getSentimentColor = (sentimentScore?: number | null) => {
    if (sentimentScore === undefined || sentimentScore === null) return "text-[#808080]";
    if (sentimentScore < 0) return "text-[#ff3333]";
    if (sentimentScore > 0) return "text-[#00c853]";
    return "text-[#808080]";
  };

  return (
    <aside className="bg-[#0a0a0a] flex flex-col h-full w-full font-mono text-[13px] text-[#e0e0e0]">
      {/* Header */}
      <div className="flex h-[40px] shrink-0 items-center justify-between px-4 border-b border-[#2a2a2a] bg-[#0a0a0a]">
        <span className="uppercase text-[#ffb000] font-bold">THE WIRE</span>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as "ALL" | "GLOBAL" | "HOLDINGS" | "SYSTEM")}
          className="bg-transparent border-none text-[#505050] hover:text-[#e0e0e0] focus:outline-none uppercase cursor-pointer"
        >
          <option value="ALL">[ALL ▼]</option>
          <option value="GLOBAL">[GLOBAL ▼]</option>
          <option value="HOLDINGS">[HOLDINGS ▼]</option>
          <option value="SYSTEM">[SYSTEM ▼]</option>
        </select>
      </div>

      {/* News Feed */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {newsItems
          .filter(
            (item) =>
              filter === "ALL" ||
              item.source_type === filter ||
              (filter === "HOLDINGS" && item.source_type === "TEAM_ACTION")
          )
          .map((item) => (
          <div
            key={item.id}
            className="min-h-[60px] border-b border-[#1a1a1a] p-3 flex gap-3 hover:bg-[#141414] transition-colors"
          >
            <span className="text-[#505050] text-[11px] shrink-0 mt-0.5">
              [{new Date(item.created_at).toLocaleTimeString()}]
            </span>
            <div className="flex flex-col flex-1 gap-1">
              <span className="text-[13px] text-[#e0e0e0] leading-tight line-clamp-2">
                <span
                  className={`px-1 mr-2 text-[11px] font-bold uppercase inline-block ${getTagStyle(item)}`}
                >
                  [{item.source_type === "TEAM_ACTION" ? item.source_ticker : item.source_type}]
                </span>
                {item.headline}
              </span>
              <div className="flex gap-2 text-[10px] uppercase font-bold tracking-wider">
                <span className="text-[#808080]">
                  [{item.source_type === "TEAM_ACTION" ? "TECH" : "MACRO"}]
                </span>
                <span className={getSentimentColor(item.sentiment_score)}>
                  [{item.sentiment_score === null ? "NEUTRAL" : item.sentiment_score! > 0 ? "BULLISH" : "BEARISH"}]
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
