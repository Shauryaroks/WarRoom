"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { api } from "@/lib/api";
import type { NewsItem } from "@/lib/types";

interface NewsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function NewsOverlay({ isOpen, onClose }: NewsOverlayProps) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    api
      .getNewsHistory()
      .then((items) => setNews(items))
      .catch(() => {
        // Silently fail -- news is non-critical
      })
      .finally(() => setIsLoading(false));
  }, [isOpen]);

  // Allow adding news items from WebSocket
  function addNewsItem(item: NewsItem) {
    setNews((prev) => [item, ...prev]);
  }

  // Expose addNewsItem on the component instance via a global ref pattern
  // The game page will call this when receiving news_injected WebSocket messages
  useEffect(() => {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__newsOverlayAddItem = addNewsItem;
    }
    return () => {
      if (typeof window !== "undefined") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (window as any).__newsOverlayAddItem;
      }
    };
  });

  if (!isOpen) return null;

  return (
    <div
      className="fixed top-16 bottom-4 right-4 z-40 w-96 flex flex-col"
      style={{
        background: "rgba(32, 31, 31, 0.80)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(64, 71, 82, 0.15)",
        boxShadow: "0 0 40px rgba(33, 150, 243, 0.04)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#404752]/15">
        <span className="text-[10px] text-[#89919d] uppercase font-bold tracking-widest">
          MARKET NEWS
        </span>
        <button
          onClick={onClose}
          className="text-[#89919d] hover:text-[#e5e2e1] transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* News list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="py-8 text-center font-mono text-xs text-[#404752]">
            Loading...
          </div>
        ) : news.length === 0 ? (
          <div className="py-8 text-center font-mono text-xs text-[#404752]">
            No market news yet
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {news.map((item) => (
              <div
                key={item.id}
                className="px-2 py-2 hover:bg-[#2a2a2a]/50 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[10px] text-[#89919d] tabular-nums">
                    {formatTimestamp(item.created_at)}
                  </span>
                  <span className="text-[9px] text-[#2196f3] bg-[#2196f3]/10 px-1 py-0.5 font-mono uppercase">
                    {item.source_type || item.news_type || "NEWS"}
                  </span>
                  {item.affected_tickers.length > 0 && (
                    <span className="font-mono text-[9px] text-[#9ecaff]">
                      {item.affected_tickers.join(", ")}
                    </span>
                  )}
                </div>
                <div className="font-mono text-xs text-[#e5e2e1] font-bold leading-tight">
                  {item.headline}
                </div>
                {item.content && (
                  <div className="text-[11px] text-[#89919d] mt-1 leading-snug line-clamp-2">
                    {item.content}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
