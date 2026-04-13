"use client";

import React, { useState, useEffect } from "react";
import { useGameContext } from "@/contexts/GameContext";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { api } from "@/lib/api";

export function TradeModal() {
  const {
    selectedTicker,
    setSelectedTicker,
    setIsTradeModalOpen,
    tradePreset,
  } = useGameContext();
  const { dossier, marketTickers } = useWebSocket();
  const [shares, setShares] = useState(
    tradePreset ? Math.floor(tradePreset).toString() : "100",
  );
  const [action, setAction] = useState<"buy" | "sell">("buy");
  const [isExecuting, setIsExecuting] = useState(false);
  const [tradeResult, setTradeResult] = useState<string | null>(null);
  const [tradeError, setTradeError] = useState<string | null>(null);

  const cash = dossier?.financials.cash || 0;

  // Find current price of selected ticker
  const selectedMarketTicker = marketTickers.find(
    (t) => t.ticker === selectedTicker,
  );
  const holding = dossier?.portfolio.holdings.find(
    (h) => h.ticker === selectedTicker,
  );
  const price = selectedMarketTicker?.price || holding?.current_price || 0;

  const numShares = parseInt(shares) || 0;
  const totalCost = numShares * price;
  const maxAffordable = price > 0 ? Math.floor(cash / price) : 0;
  const maxSellable = holding?.shares || 0;

  const handleExecute = async () => {
    if (!selectedTicker || numShares <= 0 || isExecuting) return;
    setIsExecuting(true);
    setTradeError(null);
    setTradeResult(null);
    try {
      const result = await api.executeTrade({
        action,
        target_ticker: selectedTicker,
        shares: numShares,
        order_type: "MARKET",
      });
      setTradeResult(
        `${action.toUpperCase()} ${result.filled_shares} shares @ $${result.execution_price.toFixed(2)} = $${result.total_value.toFixed(2)}`,
      );
    } catch (error: unknown) {
      setTradeError(
        error instanceof Error ? error.message : "Trade execution failed",
      );
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 font-mono">
      <div className="w-[480px] bg-[var(--color-bg-darkest)] border-2 border-[var(--color-accent-blue)] flex flex-col text-[13px] text-[var(--color-text-primary)] shadow-none rounded-none">
        <div className="flex justify-between items-center p-3 border-b-2 border-[var(--color-accent-blue)] bg-[var(--color-accent-blue)] text-black font-bold">
          <span className="uppercase">[ EXECUTE ORDER ]</span>
          <button
            className="text-black hover:text-white"
            onClick={() => setIsTradeModalOpen(false)}
          >
            [X]
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          {/* Action toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setAction("buy")}
              className={`flex-1 py-2 font-bold uppercase border-2 transition-colors ${
                action === "buy"
                  ? "border-[var(--color-accent-mint)] text-[var(--color-accent-mint)] bg-[var(--color-accent-mint)]/10"
                  : "border-[var(--color-outline)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              [ BUY ]
            </button>
            <button
              onClick={() => setAction("sell")}
              className={`flex-1 py-2 font-bold uppercase border-2 transition-colors ${
                action === "sell"
                  ? "border-[var(--color-accent-rose)] text-[var(--color-accent-rose)] bg-[var(--color-accent-rose)]/10"
                  : "border-[var(--color-outline)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              [ SELL ]
            </button>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[var(--color-accent-blue)]">TARGET:</span>
            <div className="flex items-center gap-2">
              <select
                className="bg-[var(--color-bg-darkest)] border border-[var(--color-accent-blue)] text-[var(--color-accent-blue)] p-1 outline-none cursor-pointer uppercase"
                value={selectedTicker || ""}
                onChange={(e) => setSelectedTicker(e.target.value)}
              >
                <option value="">[SELECT]</option>
                {dossier?.portfolio.holdings.map((h) => (
                  <option key={h.ticker} value={h.ticker}>
                    {h.ticker}
                  </option>
                ))}
                {marketTickers
                  .filter(
                    (mt) =>
                      !dossier?.portfolio.holdings.some(
                        (h) => h.ticker === mt.ticker,
                      ),
                  )
                  .map((mt) => (
                    <option key={mt.ticker} value={mt.ticker}>
                      {mt.ticker}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[var(--color-accent-blue)]">
              MARKET PRICE:
            </span>
            <span className="tabular-nums">
              $
              {price.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[var(--color-accent-blue)]">SHARES:</span>
            <div className="flex flex-col items-end">
              <input
                type="number"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                className="w-24 bg-[var(--color-bg-darkest)] border border-[var(--color-accent-blue)] text-right px-2 py-1 text-[var(--color-accent-blue)] focus:border-[var(--color-accent-blue)] outline-none tabular-nums"
              />
              <span className="text-[var(--color-text-muted)] text-[11px] mt-1">
                {action === "buy"
                  ? `Max affordable: ${maxAffordable.toLocaleString()} shares`
                  : `Held: ${maxSellable.toLocaleString()} shares`}
              </span>
            </div>
          </div>

          <div className="border-b border-dashed border-[var(--color-accent-blue)] my-2"></div>

          <div className="flex justify-between items-center">
            <span className="text-[var(--color-accent-blue)]">
              TOTAL VALUE:
            </span>
            <span className="tabular-nums">
              $
              {totalCost.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[var(--color-accent-blue)]">
              AVAILABLE CASH:
            </span>
            <span className="tabular-nums">
              $
              {cash.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>

          {tradeResult && (
            <div className="border-l-4 border-[var(--color-accent-mint)] bg-[var(--color-accent-mint)]/10 p-3 text-[var(--color-accent-mint)] uppercase text-[12px]">
              {tradeResult}
            </div>
          )}

          {tradeError && (
            <div className="border-l-4 border-[var(--color-accent-rose)] bg-[var(--color-accent-rose)]/10 p-3 text-[var(--color-accent-rose)] uppercase text-[12px]">
              {tradeError}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button
              className={`flex-1 py-3 font-bold uppercase transition-colors border-2 ${
                action === "buy"
                  ? "border-[var(--color-accent-mint)] text-[var(--color-accent-mint)] hover:bg-[var(--color-accent-mint)] hover:text-black"
                  : "border-[var(--color-accent-rose)] text-[var(--color-accent-rose)] hover:bg-[var(--color-accent-rose)] hover:text-black"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              onClick={handleExecute}
              disabled={!selectedTicker || numShares <= 0 || isExecuting}
            >
              {isExecuting
                ? "EXECUTING..."
                : `[ ${action.toUpperCase()} ${numShares} SHARES ]`}
            </button>
            <button
              className="py-3 px-4 bg-[var(--color-bg-darkest)] border-2 border-[var(--color-outline)] text-[var(--color-text-muted)] font-bold uppercase hover:text-[var(--color-text-primary)] transition-colors"
              onClick={() => setIsTradeModalOpen(false)}
            >
              [X]
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function NewsDetailModal({
  item,
  onClose,
}: {
  item: {
    id: string;
    headline: string;
    content?: string | null;
    source_type: string;
    source_ticker?: string | null;
    sentiment_score?: number | null;
    affected_sectors?: string[];
    affected_tickers?: string[];
    created_at: string;
  };
  onClose: () => void;
}) {
  const time = new Date(item.created_at).toLocaleString([], {
    hour12: false,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const sentimentLabel =
    item.sentiment_score != null
      ? item.sentiment_score > 0.2
        ? "BULLISH"
        : item.sentiment_score < -0.2
          ? "BEARISH"
          : "NEUTRAL"
      : null;
  const sentimentColor =
    sentimentLabel === "BULLISH"
      ? "text-[var(--color-accent-mint)]"
      : sentimentLabel === "BEARISH"
        ? "text-[var(--color-accent-rose)]"
        : "text-[var(--color-text-muted)]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 font-mono"
      onClick={onClose}
    >
      <div
        className="w-[560px] max-h-[80vh] bg-[var(--color-bg-darkest)] border-2 border-[var(--color-accent-blue)] flex flex-col text-[13px] text-[var(--color-text-primary)] shadow-none rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-3 border-b-2 border-[var(--color-accent-blue)] bg-[var(--color-accent-blue)] text-black font-bold shrink-0">
          <span className="uppercase">[ WIRE DISPATCH ]</span>
          <button
            className="text-black hover:text-white"
            onClick={onClose}
          >
            [X]
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4 overflow-y-auto">
          {/* Metadata row */}
          <div className="flex items-center gap-3 text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider">
            <span className="px-1.5 py-0.5 border border-[var(--color-accent-blue)] text-[var(--color-accent-blue)]">
              [{item.source_type}]
            </span>
            {item.source_ticker && (
              <span className="text-[var(--color-accent-cyan)]">
                {item.source_ticker}
              </span>
            )}
            <span className="ml-auto">{time}</span>
          </div>

          {/* Headline */}
          <h2 className="text-[18px] font-bold leading-snug text-[var(--color-text-primary)]">
            {item.headline}
          </h2>

          {/* Content */}
          {item.content ? (
            <div className="border-l-2 border-[var(--color-outline)] pl-4 text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">
              {item.content}
            </div>
          ) : (
            <div className="text-[var(--color-text-muted)] italic border border-dashed border-[var(--color-outline)] p-3 text-center text-[12px]">
              No additional details available for this dispatch.
            </div>
          )}

          {/* Sentiment & tags */}
          <div className="flex flex-wrap gap-3 mt-2">
            {sentimentLabel && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[var(--color-text-muted)] uppercase">
                  Sentiment:
                </span>
                <span className={`text-[12px] font-bold ${sentimentColor}`}>
                  {sentimentLabel} (
                  {item.sentiment_score! > 0 ? "+" : ""}
                  {item.sentiment_score!.toFixed(2)})
                </span>
              </div>
            )}
          </div>

          {(item.affected_sectors?.length || item.affected_tickers?.length) ? (
            <div className="flex flex-wrap gap-2 mt-1">
              {item.affected_sectors?.map((s) => (
                <span
                  key={s}
                  className="text-[10px] px-2 py-0.5 border border-[var(--color-outline)] text-[var(--color-text-muted)] uppercase"
                >
                  {s}
                </span>
              ))}
              {item.affected_tickers?.map((t) => (
                <span
                  key={t}
                  className="text-[10px] px-2 py-0.5 border border-[var(--color-accent-cyan)] text-[var(--color-accent-cyan)] uppercase"
                >
                  {t}
                </span>
              ))}
            </div>
          ) : null}

          <button
            className="w-full mt-4 py-2 bg-[var(--color-bg-darkest)] border border-[var(--color-accent-blue)] text-[var(--color-accent-blue)] font-bold uppercase hover:bg-[var(--color-accent-blue)] hover:text-black transition-colors"
            onClick={onClose}
          >
            [ DISMISS ]
          </button>
        </div>
      </div>
    </div>
  );
}

export function BoardFeedbackModal() {
  const { setIsFeedbackModalOpen } = useGameContext();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 font-mono text-[13px]">
      <div className="w-[600px] bg-[var(--color-bg-darkest)] border-2 border-[var(--color-accent-blue)] flex flex-col text-[var(--color-text-primary)] shadow-none rounded-none">
        <div className="flex justify-between items-center p-3 border-b-2 border-[var(--color-accent-blue)] bg-[var(--color-accent-blue)] text-black font-bold">
          <span className="uppercase">[ BOARD OF DIRECTORS FEEDBACK ]</span>
          <button
            className="text-black hover:text-white"
            onClick={() => setIsFeedbackModalOpen(false)}
          >
            [X]
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div className="text-[var(--color-accent-blue)] uppercase text-center border border-[var(--color-accent-blue)] p-2 mb-2 animate-pulse">
            FEEDBACK SYSTEM OFFLINE
          </div>
          <button
            className="w-full mt-4 py-2 bg-[var(--color-bg-darkest)] border border-[var(--color-accent-blue)] text-[var(--color-accent-blue)] font-bold uppercase hover:bg-[var(--color-accent-blue)] hover:text-black transition-colors"
            onClick={() => setIsFeedbackModalOpen(false)}
          >
            [ ACKNOWLEDGE ]
          </button>
        </div>
      </div>
    </div>
  );
}
