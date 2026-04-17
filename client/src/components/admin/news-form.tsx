"use client";

import { useState } from "react";

interface NewsFormProps {
  teams: { id: string; ticker: string }[];
  onSubmit: (data: {
    headline: string;
    body: string;
    news_type: string;
    affected_tickers: string[];
  }) => Promise<void>;
  isSubmitting: boolean;
}

export function NewsForm({ teams, onSubmit, isSubmitting }: NewsFormProps) {
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [newsType, setNewsType] = useState<"GLOBAL" | "LOCAL">("GLOBAL");
  const [selectedTickers, setSelectedTickers] = useState<string[]>([]);

  function toggleTicker(ticker: string) {
    setSelectedTickers((prev) =>
      prev.includes(ticker)
        ? prev.filter((t) => t !== ticker)
        : [...prev, ticker],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!headline.trim() || !body.trim()) return;

    await onSubmit({
      headline: headline.trim(),
      body: body.trim(),
      news_type: newsType,
      affected_tickers: newsType === "LOCAL" ? selectedTickers : [],
    });

    setHeadline("");
    setBody("");
    setNewsType("GLOBAL");
    setSelectedTickers([]);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block font-mono text-sm text-gray-500 uppercase tracking-tighter">
          HEADLINE
        </label>
        <input
          type="text"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="BREAKING: ..."
          className="w-full bg-[#0e0e0e] border-l-2 border-[#2196f3] text-base font-mono p-5 text-[#e5e2e1] mt-2 focus:outline-none"
          required
        />
      </div>

      <div>
        <label className="block font-mono text-sm text-gray-500 uppercase tracking-tighter">
          BODY
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Enter news body content..."
          className="w-full bg-[#0e0e0e] border-l-2 border-[#2196f3] text-base font-mono p-5 text-[#e5e2e1] mt-2 h-36 resize-none focus:outline-none"
          required
        />
      </div>

      <div>
        <label className="block font-mono text-sm text-gray-500 uppercase tracking-tighter mb-2">
          TYPE
        </label>
        <div className="flex gap-0">
          <button
            type="button"
            onClick={() => {
              setNewsType("GLOBAL");
              setSelectedTickers([]);
            }}
            className={`px-7 py-3.5 font-mono text-sm font-bold transition-colors ${
              newsType === "GLOBAL"
                ? "bg-[#2196f3] text-white"
                : "bg-[#2a2a2a] text-gray-500 hover:text-gray-300"
            }`}
          >
            GLOBAL
          </button>
          <button
            type="button"
            onClick={() => setNewsType("LOCAL")}
            className={`px-7 py-3.5 font-mono text-sm font-bold transition-colors ${
              newsType === "LOCAL"
                ? "bg-[#2196f3] text-white"
                : "bg-[#2a2a2a] text-gray-500 hover:text-gray-300"
            }`}
          >
            LOCAL
          </button>
        </div>
      </div>

      {newsType === "LOCAL" && (
        <div>
          <label className="block font-mono text-sm text-gray-500 uppercase tracking-tighter mb-2">
            AFFECTED_COMPANIES
          </label>
          <div className="flex flex-wrap gap-2">
            {teams.map((team) => (
              <button
                key={team.id}
                type="button"
                onClick={() => toggleTicker(team.ticker)}
                className={`px-5 py-2.5 font-mono text-sm transition-colors ${
                  selectedTickers.includes(team.ticker)
                    ? "bg-[#2196f3]/20 text-[#2196f3] border border-[#2196f3]"
                    : "bg-[#2a2a2a] text-gray-500 border border-transparent hover:text-gray-300"
                }`}
              >
                {team.ticker}
              </button>
            ))}
            {teams.length === 0 && (
              <span className="font-mono text-sm text-gray-600">
                NO_TEAMS_AVAILABLE
              </span>
            )}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting || !headline.trim() || !body.trim()}
        className="bg-[#2196f3] text-white px-8 py-3.5 font-mono text-sm font-bold uppercase hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "INJECTING..." : "INJECT_NEWS"}
      </button>
    </form>
  );
}
