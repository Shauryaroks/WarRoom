"use client";

import { useState } from "react";

interface NewsItem {
  id: string;
  timestamp: string;
  tagType: "GLOBAL" | "TICKER" | "SYSTEM";
  ticker?: string;
  headline: string;
  sentiment: "BEARISH" | "NEUTRAL" | "BULLISH";
}

const defaultNewsItems: NewsItem[] = [
  {
    id: "1",
    timestamp: "14:32:05",
    tagType: "TICKER",
    ticker: "$BRBE",
    headline: "Barbie Inc slashes prices 15% in aggressive market share grab",
    sentiment: "BEARISH",
  },
  {
    id: "2",
    timestamp: "14:18:45",
    tagType: "GLOBAL",
    headline:
      "Fed announces 0.25% rate hike. Markets reacting to hawk-ish stance.",
    sentiment: "BEARISH",
  },
  {
    id: "3",
    timestamp: "14:05:12",
    tagType: "SYSTEM",
    headline: "Market Purge Complete. 25 teams remain.",
    sentiment: "NEUTRAL",
  },
  {
    id: "4",
    timestamp: "13:50:00",
    tagType: "TICKER",
    ticker: "$APEX",
    headline:
      "$APEX acquires logistics firm for $420M, stock surges 12% in pre-market.",
    sentiment: "BULLISH",
  },
];

export function RightSidebar({
  newsItems = defaultNewsItems,
}: {
  newsItems?: NewsItem[];
}) {
  const [filter, setFilter] = useState<
    "ALL" | "GLOBAL" | "HOLDINGS" | "SYSTEM"
  >("ALL");

  const getTagStyle = (item: NewsItem) => {
    switch (item.tagType) {
      case "GLOBAL":
        return "bg-[#2a2a2a] text-white";
      case "TICKER":
        return "bg-[#332200] text-[#ffb000]";
      case "SYSTEM":
        return "bg-[#002233] text-[#00d4ff]";
    }
  };

  const getSentimentColor = (sentiment: string) => {
    if (sentiment === "BEARISH") return "text-[#ff3333]";
    if (sentiment === "BULLISH") return "text-[#00c853]";
    return "text-[#808080]";
  };

  return (
    <aside className="bg-[#0a0a0a] flex flex-col h-full w-full font-mono text-[13px] text-[#e0e0e0]">
      {/* Header */}
      <div className="flex h-[40px] shrink-0 items-center justify-between px-4 border-b border-[#2a2a2a] bg-[#0a0a0a]">
        <span className="uppercase text-[#ffb000] font-bold">THE WIRE</span>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
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
        {newsItems.map((item) => (
          <div
            key={item.id}
            className="min-h-[60px] border-b border-[#1a1a1a] p-3 flex gap-3 hover:bg-[#141414] transition-colors"
          >
            <span className="text-[#505050] text-[11px] shrink-0 mt-0.5">
              [{item.timestamp}]
            </span>
            <div className="flex flex-col flex-1 gap-1">
              <span className="text-[13px] text-[#e0e0e0] leading-tight line-clamp-2">
                <span
                  className={`px-1 mr-2 text-[11px] font-bold uppercase inline-block ${getTagStyle(item)}`}
                >
                  [{item.tagType === "TICKER" ? item.ticker : item.tagType}]
                </span>
                {item.headline}
              </span>
              <div className="flex gap-2 text-[10px] uppercase font-bold tracking-wider">
                <span className="text-[#808080]">
                  [{item.tagType === "TICKER" ? "TECH" : "MACRO"}]
                </span>
                <span className={getSentimentColor(item.sentiment)}>
                  [{item.sentiment}]
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
