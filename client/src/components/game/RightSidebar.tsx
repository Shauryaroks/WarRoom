"use client";

import { useState, useRef, useEffect } from "react";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { NewsItem } from "@/lib/models";
import { NewsDetailModal } from "./Modals";

export function RightSidebar() {
  const [filter, setFilter] = useState<"ALL" | "GLOBAL" | "HOLDINGS">("ALL");
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const { marketNews: newsItems, dossier } = useWebSocket();
  const feedEndRef = useRef<HTMLDivElement>(null);

  const getTagAndStyles = (item: NewsItem) => {
    let tag = item.source_type as string;
    let badgeColor =
      "text-[var(--color-text-primary)] border-[var(--color-outline)]";
    let isBoardFeedback = false;
    let isWhaleWatch = false;

    if (
      item.source_type === "GLOBAL" ||
      item.source_type === "ADMIN_INJECTED"
    ) {
      tag = "GLOBAL";
      badgeColor =
        "text-[var(--color-accent-blue)] border-[var(--color-accent-blue)] bg-[var(--color-accent-blue)]/10";
    } else if (item.source_type === "TEAM_ACTION" && item.source_ticker) {
      tag = "$" + item.source_ticker;
      badgeColor =
        "text-[var(--color-accent-cyan)] border-[var(--color-accent-cyan)] bg-[var(--color-accent-cyan)]/10";
    } else if (item.source_type === "SYSTEM") {
      tag = "SYSTEM";
      badgeColor =
        "text-[var(--color-accent-rose)] border-[var(--color-accent-rose)] bg-[var(--color-accent-rose)]/10";
      isBoardFeedback = true;
    }

    const headlineUpper = item.headline.toUpperCase();
    if (headlineUpper.includes("FOLLOWER")) {
      tag = "FOLLOWER";
      badgeColor =
        "text-[var(--color-accent-mint)] border-[var(--color-accent-mint)] bg-[var(--color-accent-mint)]/10";
    }

    if (headlineUpper.includes("BOARD") || headlineUpper.includes("FEEDBACK")) {
      isBoardFeedback = true;
    }

    if (
      headlineUpper.includes("WHALE") ||
      headlineUpper.includes("LARGE TRADE")
    ) {
      isWhaleWatch = true;
    }

    return { tag, badgeColor, isBoardFeedback, isWhaleWatch };
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
    <aside className="bg-[var(--color-bg-darkest)] flex flex-col h-full w-full font-mono text-[13px] text-[var(--color-text-primary)] border-l border-[var(--color-outline)]">
      {/* Feed Status Header */}
      <div className="h-[30px] shrink-0 border-b border-[var(--color-outline)] bg-[var(--color-bg-dark)] flex items-center justify-between px-3 text-[11px] uppercase tracking-wider">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--color-accent-mint)] animate-pulse"></div>
          <span className="text-[var(--color-text-muted)] font-bold">
            FEED_ACTIVE
          </span>
        </div>
        <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-outline)] px-2 py-0.5 text-[var(--color-accent-cyan)] font-bold">
          {filteredNews.length} NEW ITEMS
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex h-[40px] shrink-0 border-b border-[var(--color-outline)] bg-[var(--color-bg-darkest)] text-[12px]">
        {(["ALL", "GLOBAL", "HOLDINGS"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 border-r border-[var(--color-outline)] uppercase font-bold transition-colors ${
              filter === f
                ? "bg-[var(--color-bg-interactive)] text-[var(--color-text-primary)] border-b-2 border-b-[var(--color-accent-blue)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] border-b-2 border-b-transparent"
            }`}
          >
            [{f}]
          </button>
        ))}
      </div>

      {/* News Feed */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {filteredNews.map((item) => {
          const { tag, badgeColor, isBoardFeedback, isWhaleWatch } =
            getTagAndStyles(item);
          const time = new Date(item.created_at).toLocaleTimeString([], {
            hour12: false,
          });

          if (isBoardFeedback) {
            return (
              <div
                key={item.id}
                className="bg-[var(--color-bg-elevated)] border-l-2 border-l-[var(--color-accent-rose)] p-3 shadow-md cursor-pointer hover:brightness-110 transition-all"
                onClick={() => setSelectedNews(item)}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[var(--color-accent-rose)] font-bold text-sm">
                    △ BOARD FEEDBACK
                  </span>
                  <span className="text-[var(--color-text-muted)] text-[11px] ml-auto">
                    ({time})
                  </span>
                </div>
                <p className="text-[var(--color-text-primary)] italic border-l-2 border-[var(--color-outline)] pl-3 ml-1 py-1">
                  &quot;{item.headline}&quot;
                </p>
              </div>
            );
          }

          if (isWhaleWatch) {
            return (
              <div
                key={item.id}
                className="bg-[var(--color-bg-dark)] border border-[var(--color-outline)] p-2 cursor-pointer hover:bg-[var(--color-bg-elevated)] transition-colors"
                onClick={() => setSelectedNews(item)}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-bold border ${badgeColor}`}
                  >
                    [{tag}]
                  </span>
                  <span className="text-[var(--color-accent-cyan)] font-bold animate-pulse">
                    WHALE ALERT
                  </span>
                  <span className="text-[var(--color-text-muted)] text-[11px] ml-auto">
                    ({time})
                  </span>
                </div>
                <p className="text-[var(--color-text-primary)] font-bold tracking-wide">
                  {item.headline}
                </p>
              </div>
            );
          }

          return (
            <div
              key={item.id}
              className="bg-[var(--color-bg-dark)] border border-[var(--color-outline)] p-2.5 hover:bg-[var(--color-bg-elevated)] transition-colors cursor-pointer"
              onClick={() => setSelectedNews(item)}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-bold border ${badgeColor}`}
                >
                  [{tag}]
                </span>
                <span className="text-[var(--color-text-muted)] text-[11px] ml-auto">
                  ({time})
                </span>
              </div>
              <p className="text-[var(--color-text-primary)] leading-relaxed">
                {item.headline}
              </p>
            </div>
          );
        })}
        <div ref={feedEndRef} />
      </div>

      {selectedNews && (
        <NewsDetailModal
          item={selectedNews}
          onClose={() => setSelectedNews(null)}
        />
      )}
    </aside>
  );
}
