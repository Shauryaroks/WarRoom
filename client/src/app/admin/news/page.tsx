"use client";

import { useState, useEffect, useCallback } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAdminStore } from "@/stores/admin-store";
import { useWebSocket } from "@/hooks/use-websocket";
import { NewsForm } from "@/components/admin/news-form";
import type { NewsItem } from "@/lib/types";

function SourceChip({ sourceType }: { sourceType: string }) {
  const colorMap: Record<string, string> = {
    ADMIN_INJECTED: "text-[#2196f3]",
    ADMIN_BROADCAST: "text-[#02c953]",
    SYSTEM: "text-gray-500",
  };
  const color = colorMap[sourceType] || "text-gray-500";

  return (
    <span className={`font-mono text-sm font-bold ${color}`}>{sourceType}</span>
  );
}

function NewsHistoryItem({
  item,
  onDelete,
  isDeleting,
}: {
  item: NewsItem;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  const timestamp = new Date(item.created_at).toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return (
    <div className="bg-[#1c1b1b] p-5 mb-2">
      <div className="flex items-center justify-between gap-4">
        <span className="font-bold text-[#e5e2e1] text-base truncate">
          {item.headline}
        </span>
        <div className="flex items-center gap-4 shrink-0">
          <SourceChip sourceType={item.source_type} />
          <span className="text-sm text-gray-500 font-mono">{timestamp}</span>
          <button
            onClick={() => onDelete(item.id)}
            disabled={isDeleting}
            title="Delete news item"
            className="text-gray-400 hover:text-[#FF1744] hover:bg-[#FF1744]/10 p-2 -m-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      {item.content && (
        <p className="text-sm text-gray-400 mt-2">{item.content}</p>
      )}
      {item.affected_tickers.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {item.affected_tickers.map((ticker) => (
            <span
              key={ticker}
              className="text-sm font-mono text-[#9ecaff] bg-[#9ecaff]/10 px-3 py-1"
            >
              {ticker}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NewsPage() {
  const { news, setNews, addNews, removeNews } = useAdminStore();
  const [teams, setTeams] = useState<{ id: string; ticker: string }[]>([]);
  const [isSubmittingNews, setIsSubmittingNews] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [isSubmittingBroadcast, setIsSubmittingBroadcast] = useState(false);
  const [deletingNewsId, setDeletingNewsId] = useState<string | null>(null);

  async function handleDeleteNews(newsId: string) {
    if (deletingNewsId) return;
    setDeletingNewsId(newsId);
    try {
      await api.deleteNews(newsId);
      removeNews(newsId);
      toast.success("News deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete news");
    } finally {
      setDeletingNewsId(null);
    }
  }

  const handleWsMessage = useCallback(
    (data: Record<string, unknown>) => {
      if (data.type === "news_injected") {
        const payload = data.payload as NewsItem;
        addNews(payload);
      }
    },
    [addNews],
  );

  useWebSocket({ onMessage: handleWsMessage });

  useEffect(() => {
    async function loadData() {
      try {
        const [newsHistory, teamList] = await Promise.all([
          api.getNewsHistory(),
          api.getTeams(),
        ]);
        setNews(newsHistory);
        setTeams(teamList.map((t) => ({ id: t.id, ticker: t.ticker })));
      } catch {
        // Data load failure is non-fatal -- UI shows empty state
      }
    }
    loadData();
  }, [setNews]);

  async function handleInjectNews(data: {
    headline: string;
    body: string;
    news_type: string;
    affected_tickers: string[];
  }) {
    setIsSubmittingNews(true);
    try {
      const result = await api.injectNews(data);
      addNews({
        id: result.news_id,
        headline: data.headline,
        content: data.body,
        source_type: "ADMIN_INJECTED",
        news_type: data.news_type,
        affected_tickers: data.affected_tickers,
        created_at: new Date().toISOString(),
      });
      toast.success("News injected");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to inject news");
    } finally {
      setIsSubmittingNews(false);
    }
  }

  async function handleBroadcast(e: React.FormEvent) {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;

    setIsSubmittingBroadcast(true);
    try {
      const result = await api.broadcast(broadcastMessage.trim());
      addNews({
        id: result.news_id,
        headline: broadcastMessage.trim(),
        content: null,
        source_type: "ADMIN_BROADCAST",
        affected_tickers: [],
        created_at: new Date().toISOString(),
      });
      toast.success("Broadcast sent");
      setBroadcastMessage("");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to send broadcast",
      );
    } finally {
      setIsSubmittingBroadcast(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Top section: News Injection + Broadcast side by side */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left: News Injection Form */}
        <div className="col-span-7">
          <h2 className="text-base font-black font-mono tracking-widest text-[#9ecaff] uppercase mb-6">
            NEWS_INJECTION
          </h2>
          <NewsForm
            teams={teams}
            onSubmit={handleInjectNews}
            isSubmitting={isSubmittingNews}
          />
        </div>

        {/* Right: Broadcast Channel */}
        <div className="col-span-5">
          <h2 className="text-base font-black font-mono tracking-widest text-[#9ecaff] uppercase mb-6">
            BROADCAST_CHANNEL
          </h2>
          <form onSubmit={handleBroadcast} className="space-y-6">
            <div>
              <label className="block font-mono text-sm text-gray-500 uppercase tracking-tighter">
                GLOBAL_BROADCAST_CHANNEL
              </label>
              <textarea
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="Enter broadcast message..."
                className="w-full bg-[#0e0e0e] border-l-2 border-[#2196f3] text-base font-mono p-5 text-[#2196f3] mt-2 h-36 resize-none focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmittingBroadcast || !broadcastMessage.trim()}
              className="bg-[#02c953] text-[#003912] px-8 py-3.5 font-mono text-sm font-bold uppercase hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmittingBroadcast ? "SENDING..." : "BROADCAST"}
            </button>
          </form>
        </div>
      </div>

      {/* Bottom section: News History */}
      <div>
        <h2 className="text-base font-black font-mono tracking-widest text-[#9ecaff] uppercase mb-6">
          NEWS_HISTORY
        </h2>
        {news.length === 0 ? (
          <div className="bg-[#1c1b1b] p-12 text-center">
            <p className="font-mono text-sm text-gray-600">
              NO_NEWS_ITEMS // History will populate as news is injected or
              broadcast
            </p>
          </div>
        ) : (
          <div>
            {news.map((item) => (
              <NewsHistoryItem
                key={item.id}
                item={item}
                onDelete={handleDeleteNews}
                isDeleting={deletingNewsId === item.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
