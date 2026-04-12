"use client";

import { useState, useRef, useEffect } from "react";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { NewsItem } from "@/lib/models";

export function RightSidebar() {
  const [filter, setFilter] = useState<"ALL" | "GLOBAL" | "HOLDINGS">("ALL");
  const { marketNews: newsItems, dossier } = useWebSocket();
  const feedEndRef = useRef<HTMLDivElement>(null);

  const getTagAndColor = (item: NewsItem) => {
    let tag = item.source_type;
    let color = "text-[#0077b6]";

    if (
      item.source_type === "GLOBAL" ||
      item.source_type === "ADMIN_INJECTED"
    ) {
      tag = "GLOBAL";
      color = "text-[#a0a0a0]"; // white/gray
    } else if (item.source_type === "TEAM_ACTION" && item.source_ticker) {
      tag = "$" + item.source_ticker;
      if (item.sentiment_score !== null && item.sentiment_score !== undefined) {
        if (item.sentiment_score > 0) color = "text-green-500";
        else if (item.sentiment_score < 0) color = "text-red-500";
        else color = "text-[#0077b6]";
      } else {
        color = "text-[#0077b6]";
      }
    } else if (item.source_type === "SYSTEM") {
      tag = "SYSTEM";
      color = "text-red-500"; // red/amber
    }
    return { tag, color };
  };

  const filteredNews = newsItems.filter((item) => {
    if (filter === "ALL") return true;
    if (filter === "GLOBAL")
      return (
        item.source_type === "GLOBAL" || item.source_type === "ADMIN_INJECTED"
      );
    if (filter === "HOLDINGS") {
      const holdings = dossier?.portfolio.holdings.map((h) => h.ticker) || [];
      return (
        item.source_type === "TEAM_ACTION" &&
        item.source_ticker &&
        holdings.includes(item.source_ticker)
      );
    }
    return true;
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (feedEndRef.current) {
      feedEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [filteredNews.length]);

  return (
    <aside className="bg-[#0a0a0a] flex flex-col h-full w-full font-mono text-[13px] text-[#0077b6] border-l border-[#0077b6]">
      {/* Filter Buttons */}
      <div className="flex h-[40px] shrink-0 border-b border-[#0077b6] bg-[#0a0a0a]">
        <button
          onClick={() => setFilter("ALL")}
          className={`flex-1 border-r border-[#0077b6] uppercase font-bold ${filter === "ALL" ? "bg-[#0077b6] text-black" : "text-[#0077b6] hover:bg-[#1a1a1a]"}`}
        >
          [ALL]
        </button>
        <button
          onClick={() => setFilter("GLOBAL")}
          className={`flex-1 border-r border-[#0077b6] uppercase font-bold ${filter === "GLOBAL" ? "bg-[#0077b6] text-black" : "text-[#0077b6] hover:bg-[#1a1a1a]"}`}
        >
          [GLOBAL]
        </button>
        <button
          onClick={() => setFilter("HOLDINGS")}
          className={`flex-1 uppercase font-bold ${filter === "HOLDINGS" ? "bg-[#0077b6] text-black" : "text-[#0077b6] hover:bg-[#1a1a1a]"}`}
        >
          [HOLDINGS]
        </button>
      </div>

      {/* News Feed */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
        {filteredNews.map((item) => {
          const { tag, color } = getTagAndColor(item);
          const time = new Date(item.created_at).toLocaleTimeString([], {
            hour12: false,
          });

          return (
            <div key={item.id} className="py-1">
              <span className="text-[#a0a0a0]">[{time}] </span>
              <span className={`font-bold ${color}`}>[{tag}] </span>
              <span className="text-[#0077b6]">{item.headline}</span>
            </div>
          );
        })}
        <div ref={feedEndRef} />
      </div>
    </aside>
  );
}
