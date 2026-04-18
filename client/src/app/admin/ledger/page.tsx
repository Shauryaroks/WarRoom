"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useWebSocket } from "@/hooks/use-websocket";
import { api } from "@/lib/api";
import type { TradeLedgerItem, AdminTeam } from "@/lib/types";
import { RefreshCw } from "lucide-react";

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: "short", day: "2-digit" });
}

function formatMoney(raw: string): string {
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return raw;
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function LedgerPage() {
  const { isAuthenticated, role } = useAuthStore();
  const [ledger, setLedger] = useState<TradeLedgerItem[]>([]);
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [filterTeamId, setFilterTeamId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLedger = useCallback(async (teamId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getTradeLedger(teamId || undefined);
      setLedger(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ledger");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLedger(filterTeamId);
  }, [loadLedger, filterTeamId]);

  useEffect(() => {
    api
      .getTeams()
      .then(setTeams)
      .catch(() => {});
  }, []);

  // Live-append new trades as they execute (best-effort — payload shape
  // from backend's trade_executed doesn't include buyer/seller names, so
  // we just trigger a refresh instead of synthesizing a row).
  const handleMessage = useCallback(
    (data: Record<string, unknown>) => {
      if (data.type === "trade_executed") {
        loadLedger(filterTeamId);
      }
    },
    [loadLedger, filterTeamId],
  );

  useWebSocket({
    onMessage: handleMessage,
    enabled: isAuthenticated && role === "admin",
  });

  const totals = useMemo(() => {
    let volume = 0;
    let shares = 0;
    for (const tx of ledger) {
      volume += parseFloat(tx.total_value) || 0;
      shares += tx.shares;
    }
    return { volume, shares, count: ledger.length };
  }, [ledger]);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-black font-mono tracking-widest text-[#9ecaff] uppercase">
          TRADE_LEDGER
        </h2>
        <div className="flex items-center gap-3">
          <select
            value={filterTeamId}
            onChange={(e) => setFilterTeamId(e.target.value)}
            className="bg-[#201f1f] border border-[#2a2a2a] px-3 py-1.5 font-mono text-xs text-[#e5e2e1] uppercase"
          >
            <option value="">ALL TEAMS</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.ticker} — {t.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => loadLedger(filterTeamId)}
            disabled={isLoading}
            className="flex items-center gap-2 bg-[#2196f3]/10 text-[#2196f3] border border-[#2196f3]/30 px-3 py-1.5 font-mono text-xs uppercase hover:bg-[#2196f3]/20 disabled:opacity-50"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            REFRESH
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[#201f1f] p-3">
          <div className="text-[10px] text-[#89919d] uppercase font-bold tracking-widest">
            TRADES
          </div>
          <div className="font-mono text-lg text-[#e5e2e1] mt-1">
            {totals.count}
          </div>
        </div>
        <div className="bg-[#201f1f] p-3">
          <div className="text-[10px] text-[#89919d] uppercase font-bold tracking-widest">
            TOTAL SHARES
          </div>
          <div className="font-mono text-lg text-[#e5e2e1] mt-1">
            {totals.shares.toLocaleString()}
          </div>
        </div>
        <div className="bg-[#201f1f] p-3">
          <div className="text-[10px] text-[#89919d] uppercase font-bold tracking-widest">
            TOTAL VOLUME
          </div>
          <div className="font-mono text-lg text-[#40e56c] mt-1">
            ₹{formatMoney(totals.volume.toFixed(2))}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-[#FF1744]/10 border border-[#FF1744]/30 text-[#FF1744] p-3 font-mono text-xs">
          {error}
        </div>
      )}

      <div className="bg-[#201f1f] overflow-x-auto">
        <table className="w-full font-mono text-[11px]">
          <thead className="bg-[#0e0e0e] text-[#89919d] uppercase tracking-widest">
            <tr>
              <th className="px-3 py-2 text-left">TIME</th>
              <th className="px-3 py-2 text-left">TYPE</th>
              <th className="px-3 py-2 text-left">BUYER</th>
              <th className="px-3 py-2 text-left">SELLER</th>
              <th className="px-3 py-2 text-left">TICKER</th>
              <th className="px-3 py-2 text-right">SHARES</th>
              <th className="px-3 py-2 text-right">PRICE</th>
              <th className="px-3 py-2 text-right">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && ledger.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-6 text-center text-[#89919d]"
                >
                  LOADING_LEDGER...
                </td>
              </tr>
            ) : ledger.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-6 text-center text-[#89919d]"
                >
                  NO_TRADES_RECORDED
                </td>
              </tr>
            ) : (
              ledger.map((tx) => {
                const typeColor =
                  tx.transaction_type === "BUY"
                    ? "text-[#40e56c]"
                    : tx.transaction_type === "SELL"
                      ? "text-[#FF1744]"
                      : "text-[#f5a623]";
                return (
                  <tr
                    key={tx.id}
                    className="border-t border-[#2a2a2a] hover:bg-[#2a2a2a]/40"
                  >
                    <td className="px-3 py-2 text-[#89919d] whitespace-nowrap">
                      <span className="text-[#e5e2e1]">
                        {formatTime(tx.executed_at)}
                      </span>
                      <span className="ml-2 text-[9px]">
                        {formatDate(tx.executed_at)}
                      </span>
                    </td>
                    <td className={`px-3 py-2 font-bold ${typeColor}`}>
                      {tx.transaction_type}
                    </td>
                    <td className="px-3 py-2 text-[#e5e2e1]">
                      {tx.buyer_ticker ? (
                        <span>
                          <span className="text-[#9ecaff]">
                            ${tx.buyer_ticker}
                          </span>
                          <span className="text-[#89919d] ml-1">
                            {tx.buyer_name}
                          </span>
                        </span>
                      ) : (
                        <span className="text-[#89919d]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[#e5e2e1]">
                      {tx.seller_ticker ? (
                        <span>
                          <span className="text-[#9ecaff]">
                            ${tx.seller_ticker}
                          </span>
                          <span className="text-[#89919d] ml-1">
                            {tx.seller_name}
                          </span>
                        </span>
                      ) : (
                        <span className="text-[#89919d]">TREASURY</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-[#9ecaff] font-bold">
                        ${tx.target_ticker}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-[#e5e2e1]">
                      {tx.shares.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-[#e5e2e1]">
                      ₹{formatMoney(tx.price_per_share)}
                    </td>
                    <td className="px-3 py-2 text-right text-[#40e56c] font-bold">
                      ₹{formatMoney(tx.total_value)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
