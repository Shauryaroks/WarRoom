"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AdminMetrics, LLMStats, MarketStats } from "@/lib/models";

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [llm, setLlm] = useState<LLMStats | null>(null);
  const [market, setMarket] = useState<MarketStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [m, l, mk] = await Promise.all([
          api.adminGetMetrics(),
          api.adminGetLLMStats(),
          api.adminGetMarketStats(),
        ]);
        setMetrics(m);
        setLlm(l);
        setMarket(mk);
      } catch (err) {
        console.error("Failed to fetch metrics", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
    }).format(val);
  };

  if (loading && !metrics) {
    return (
      <div className="p-8 text-[#ffb000] font-['JetBrains_Mono',monospace]">
        [SYS] GATHERING_TELEMETRY...
      </div>
    );
  }

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      <header className="flex justify-between items-center bg-[#111] p-4 border border-[#2a2a2a] rounded-[6px]">
        <div>
          <h1 className="text-xl text-gray-200 font-['Inter',sans-serif]">
            System Metrics
          </h1>
          <p className="text-sm text-gray-500 mt-1 font-['Inter',sans-serif]">
            Real-time telemetry for game operations and LLM performance.
          </p>
        </div>
        <div className="text-xs text-gray-500 font-['JetBrains_Mono',monospace] border border-[#2a2a2a] px-3 py-1 rounded bg-[#0a0a0a]">
          POLLING_INTERVAL: 10s
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Game Stats */}
        <div className="bg-[#111] border border-[#2a2a2a] rounded-[6px] p-4 space-y-4">
          <div className="flex items-center text-gray-400 gap-2 mb-2 font-['Inter',sans-serif] uppercase text-xs tracking-wider">
            <span className="material-symbols-outlined text-[16px]">
              pie_chart
            </span>
            <h2>Game State</h2>
          </div>
          <div className="flex justify-between items-end border-b border-[#2a2a2a] pb-2">
            <span className="text-sm text-gray-500 font-['Inter',sans-serif]">
              Active Teams
            </span>
            <span className="text-xl text-white font-['JetBrains_Mono',monospace]">
              {metrics?.activeTeams}{" "}
              <span className="text-xs text-gray-500">
                / {metrics?.totalTeams}
              </span>
            </span>
          </div>
          <div className="flex justify-between items-end border-b border-[#2a2a2a] pb-2">
            <span className="text-sm text-gray-500 font-['Inter',sans-serif]">
              Total Liquidity
            </span>
            <span className="text-xl text-[#00c853] font-['JetBrains_Mono',monospace]">
              {formatCurrency(metrics?.aggregateLiquidity || 0)}
            </span>
          </div>
          <div className="flex justify-between items-end pb-2">
            <span className="text-sm text-gray-500 font-['Inter',sans-serif]">
              Avg Market Cap
            </span>
            <span className="text-xl text-[#ffb000] font-['JetBrains_Mono',monospace]">
              {formatCurrency(metrics?.avgMarketCap || 0)}
            </span>
          </div>
        </div>

        {/* LLM Engine */}
        <div className="bg-[#111] border border-[#2a2a2a] rounded-[6px] p-4 space-y-4">
          <div className="flex items-center text-gray-400 gap-2 mb-2 font-['Inter',sans-serif] uppercase text-xs tracking-wider">
            <span className="material-symbols-outlined text-[16px]">dns</span>
            <h2>The Board (LLM)</h2>
          </div>
          <div className="flex justify-between items-end border-b border-[#2a2a2a] pb-2">
            <span className="text-sm text-gray-500 font-['Inter',sans-serif]">
              Avg Latency
            </span>
            <span className="text-xl text-white font-['JetBrains_Mono',monospace]">
              {llm?.avgLatencyMs}ms
            </span>
          </div>
          <div className="flex justify-between items-end border-b border-[#2a2a2a] pb-2">
            <span className="text-sm text-gray-500 font-['Inter',sans-serif]">
              Error Rate
            </span>
            <span className="text-xl text-[#ffb000] font-['JetBrains_Mono',monospace]">
              {((llm?.errorRate || 0) * 100).toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between items-end pb-2">
            <span className="text-sm text-gray-500 font-['Inter',sans-serif]">
              Session Cost
            </span>
            <span className="text-xl text-[#ff3333] font-['JetBrains_Mono',monospace]">
              ${metrics?.sessionCostUsd?.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Market Activity */}
        <div className="bg-[#111] border border-[#2a2a2a] rounded-[6px] p-4 space-y-4">
          <div className="flex items-center text-gray-400 gap-2 mb-2 font-['Inter',sans-serif] uppercase text-xs tracking-wider">
            <span className="material-symbols-outlined text-[16px]">
              trending_up
            </span>
            <h2>Market Activity</h2>
          </div>
          <div className="flex justify-between items-end border-b border-[#2a2a2a] pb-2">
            <span className="text-sm text-gray-500 font-['Inter',sans-serif]">
              Total Trades
            </span>
            <span className="text-xl text-white font-['JetBrains_Mono',monospace]">
              {market?.totalTrades}
            </span>
          </div>
          <div className="flex justify-between items-end border-b border-[#2a2a2a] pb-2">
            <span className="text-sm text-gray-500 font-['Inter',sans-serif]">
              Trades Last Hour
            </span>
            <span className="text-xl text-[#ffb000] font-['JetBrains_Mono',monospace]">
              {market?.tradesLastHour}
            </span>
          </div>
          <div className="flex justify-between items-end pb-2">
            <span className="text-sm text-gray-500 font-['Inter',sans-serif]">
              Most Traded
            </span>
            <span className="text-xl text-[#00c853] font-['JetBrains_Mono',monospace]">
              {Object.keys(market?.volumeByTicker || {})[0] || "N/A"}
            </span>
          </div>
        </div>
      </div>

      {/* Warnings & Anomalies */}
      <div className="bg-[#111] border border-[#2a2a2a] rounded-[6px] p-4">
        <div className="flex items-center text-[#ffb000] gap-2 mb-4 font-['Inter',sans-serif] uppercase text-xs tracking-wider">
          <span className="material-symbols-outlined text-[16px]">
            gpp_maybe
          </span>
          <h2>System Anomalies</h2>
        </div>
        <div className="space-y-2">
          {market?.anomalyAlerts && market.anomalyAlerts.length > 0
            ? market.anomalyAlerts.map((alert, idx) => (
                <div
                  key={idx}
                  className="bg-[#ff3333]/10 border border-[#ff3333]/20 p-3 rounded flex justify-between items-center text-sm font-['JetBrains_Mono',monospace]"
                >
                  <span className="text-[#ff3333] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[14px]">
                      warning
                    </span>{" "}
                    {alert.type} ({alert.ticker})
                  </span>
                  <span className="text-gray-400">{alert.description}</span>
                </div>
              ))
            : null}
          {(metrics?.llmQueueDepth ?? 0) > 10 ? (
            <div className="bg-[#ffb000]/10 border border-[#ffb000]/20 p-3 rounded flex justify-between items-center text-sm font-['JetBrains_Mono',monospace]">
              <span className="text-[#ffb000] flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px]">
                  network_ping
                </span>{" "}
                HIGH_DIRECTIVE_QUEUE_DEPTH
              </span>
              <span className="text-gray-400">
                DEPTH: {metrics?.llmQueueDepth}
              </span>
            </div>
          ) : (
            <div className="bg-[#00c853]/10 border border-[#00c853]/20 p-3 rounded flex justify-between items-center text-sm font-['JetBrains_Mono',monospace]">
              <span className="text-[#00c853] flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px]">
                  bolt
                </span>{" "}
                SYSTEM_NOMINAL
              </span>
              <span className="text-gray-400">
                QUEUE: {metrics?.llmQueueDepth || 0}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
