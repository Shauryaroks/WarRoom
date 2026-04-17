"use client";

import { useState } from "react";
import { useMarketStore } from "@/stores/market-store";
import { useAuthStore } from "@/stores/auth-store";
import { useTradingStore } from "@/stores/trading-store";
import { api } from "@/lib/api";

export function TradingPanel() {
  const companies = useMarketStore((s) => s.companies);
  const teamId = useAuthStore((s) => s.teamId);

  const pendingTrade = useTradingStore((s) => s.pendingTrade);
  const isExecutingTrade = useTradingStore((s) => s.isExecutingTrade);
  const tradeError = useTradingStore((s) => s.tradeError);

  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [tradeType, setTradeType] = useState<"BUY" | "SELL">("BUY");
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Exclude own team from company list
  const tradableCompanies = companies.filter((c) => c.team_id !== teamId);

  async function handlePreview() {
    if (!selectedTargetId || !quantity || parseInt(quantity) <= 0) return;

    setIsLoadingPreview(true);
    useTradingStore.getState().setTradeError(null);

    try {
      const preview = await api.previewTrade({
        target_team_id: selectedTargetId,
        shares: parseInt(quantity),
        trade_type: tradeType,
      });

      useTradingStore.getState().setPendingTrade({
        targetTeamId: selectedTargetId,
        targetTicker: preview.target_ticker,
        shares: preview.shares,
        pricePerShare: preview.price_per_share,
        totalCost: preview.total_cost,
        tradeType,
      });
    } catch (err) {
      useTradingStore
        .getState()
        .setTradeError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setIsLoadingPreview(false);
    }
  }

  async function handleConfirm() {
    if (!pendingTrade) return;

    useTradingStore.getState().setExecutingTrade(true);
    useTradingStore.getState().setTradeError(null);

    try {
      const action =
        pendingTrade.tradeType === "BUY" ? api.buyShares : api.sellShares;
      const result = await action.call(api, {
        target_team_id: pendingTrade.targetTeamId,
        shares: pendingTrade.shares,
      });

      // Update cash balance
      useTradingStore.getState().updateCashBalance(result.new_cash_balance);
      useTradingStore.getState().clearPendingTrade();

      // Refresh portfolio
      const portfolio = await api.getPortfolio();
      useTradingStore.getState().setPortfolio(portfolio);

      // Reset form
      setQuantity("");
      setSelectedTargetId("");
    } catch (err) {
      useTradingStore
        .getState()
        .setTradeError(err instanceof Error ? err.message : "Trade failed");
    } finally {
      useTradingStore.getState().setExecutingTrade(false);
    }
  }

  function handleCancel() {
    useTradingStore.getState().clearPendingTrade();
  }

  // Confirmation view
  if (pendingTrade) {
    const total = parseFloat(pendingTrade.totalCost);
    const price = parseFloat(pendingTrade.pricePerShare);

    return (
      <div className="p-4 space-y-4">
        <div className="text-[10px] text-[#89919d] uppercase font-bold tracking-widest">
          CONFIRM TRADE
        </div>

        <div className="bg-[#201f1f] p-4 space-y-2">
          <div className="font-mono text-sm text-[#e5e2e1]">
            <span
              className={
                pendingTrade.tradeType === "BUY"
                  ? "text-[#40e56c]"
                  : "text-[#FF1744]"
              }
            >
              {pendingTrade.tradeType}
            </span>{" "}
            {pendingTrade.shares} shares of{" "}
            <span className="text-[#9ecaff]">{pendingTrade.targetTicker}</span>{" "}
            at ${price.toFixed(2)} = $
            {total.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>

        {tradeError && (
          <div className="font-mono text-xs text-[#FF1744] bg-[#FF1744]/10 p-2">
            {tradeError}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleConfirm}
            disabled={isExecutingTrade}
            className="flex-1 milled-metal-btn text-white font-mono text-xs font-bold py-2 px-4 disabled:opacity-50 transition-opacity"
          >
            {isExecutingTrade ? "EXECUTING..." : "CONFIRM"}
          </button>
          <button
            onClick={handleCancel}
            disabled={isExecutingTrade}
            className="flex-1 border border-[#404752] text-[#89919d] font-mono text-xs font-bold py-2 px-4 hover:bg-[#2a2a2a] disabled:opacity-50 transition-colors"
          >
            CANCEL
          </button>
        </div>
      </div>
    );
  }

  // Order form view
  return (
    <div className="p-4 space-y-4">
      <div className="text-[10px] text-[#89919d] uppercase font-bold tracking-widest">
        NEW ORDER
      </div>

      {/* Company selector */}
      <div className="space-y-1">
        <label className="text-[10px] text-[#89919d] uppercase font-bold tracking-widest">
          COMPANY
        </label>
        <select
          value={selectedTargetId}
          onChange={(e) => setSelectedTargetId(e.target.value)}
          className="w-full bg-[#201f1f] text-[#e5e2e1] font-mono text-xs px-3 py-2 border border-[#404752]/20 focus:border-l-2 focus:border-l-[#2196f3]"
        >
          <option value="">Select company...</option>
          {tradableCompanies.map((c) => (
            <option key={c.team_id} value={c.team_id}>
              {c.ticker} - {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Quantity */}
      <div className="space-y-1">
        <label className="text-[10px] text-[#89919d] uppercase font-bold tracking-widest">
          SHARES
        </label>
        <input
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="0"
          className="w-full bg-[#201f1f] text-[#e5e2e1] font-mono text-xs px-3 py-2 border border-[#404752]/20 tabular-nums"
        />
      </div>

      {/* BUY / SELL toggle */}
      <div className="flex gap-0">
        <button
          onClick={() => setTradeType("BUY")}
          className={`flex-1 font-mono text-xs font-bold py-2 transition-colors ${
            tradeType === "BUY"
              ? "bg-[#40e56c]/10 text-[#40e56c] border border-[#40e56c]/30"
              : "bg-[#201f1f] text-[#89919d] border border-[#404752]/20 hover:bg-[#2a2a2a]"
          }`}
        >
          BUY
        </button>
        <button
          onClick={() => setTradeType("SELL")}
          className={`flex-1 font-mono text-xs font-bold py-2 transition-colors ${
            tradeType === "SELL"
              ? "bg-[#FF1744]/10 text-[#FF1744] border border-[#FF1744]/30"
              : "bg-[#201f1f] text-[#89919d] border border-[#404752]/20 hover:bg-[#2a2a2a]"
          }`}
        >
          SELL
        </button>
      </div>

      {tradeError && (
        <div className="font-mono text-xs text-[#FF1744] bg-[#FF1744]/10 p-2">
          {tradeError}
        </div>
      )}

      {/* Preview button */}
      <button
        onClick={handlePreview}
        disabled={
          !selectedTargetId ||
          !quantity ||
          parseInt(quantity) <= 0 ||
          isLoadingPreview
        }
        className="w-full milled-metal-btn text-white font-mono text-xs font-bold py-2 px-4 disabled:opacity-50 transition-opacity"
      >
        {isLoadingPreview ? "LOADING..." : "PREVIEW ORDER"}
      </button>
    </div>
  );
}
