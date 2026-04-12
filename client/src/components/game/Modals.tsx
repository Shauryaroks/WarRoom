"use client";

import React, { useState, useEffect } from "react";
import { useGameContext } from "@/contexts/GameContext";
import { useWebSocket } from "@/contexts/WebSocketContext";

export function TradeModal() {
  const { selectedTicker, setSelectedTicker, setIsTradeModalOpen, tradePreset } = useGameContext();
  const { dossier, marketTickers } = useWebSocket();
  const [shares, setShares] = useState(tradePreset ? Math.floor(tradePreset).toString() : "100");

  const cash = dossier?.financials.cash || 0;
  
  // Find current price of selected ticker
  const selectedMarketTicker = marketTickers.find(t => t.ticker === selectedTicker);
  const holding = dossier?.portfolio.holdings.find(h => h.ticker === selectedTicker);
  const price = selectedMarketTicker?.price || holding?.current_price || 0;

  const numShares = parseInt(shares) || 0;
  const totalCost = numShares * price;
  const postTradeCash = cash - totalCost; // Simplified, assuming buy. If sell, it's + totalCost
  const maxAffordable = price > 0 ? Math.floor(cash / price) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 font-mono">
      <div className="w-[480px] bg-[#0a0a0a] border-2 border-[#ffb000] flex flex-col text-[13px] text-[#e0e0e0] shadow-none rounded-none">
        <div className="flex justify-between items-center p-3 border-b-2 border-[#ffb000] bg-[#ffb000] text-black font-bold">
          <span className="uppercase">[ EXECUTE ORDER ]</span>
          <button
            className="text-black hover:text-white"
            onClick={() => setIsTradeModalOpen(false)}
          >
            [X]
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <span className="text-[#ffb000]">TARGET:</span>
            <div className="flex items-center gap-2">
              <select 
                className="bg-[#0a0a0a] border border-[#ffb000] text-[#ffb000] p-1 outline-none cursor-pointer uppercase"
                value={selectedTicker || ""}
                onChange={(e) => setSelectedTicker(e.target.value)}
              >
                <option value="">[SELECT]</option>
                {dossier?.portfolio.holdings.map(h => (
                  <option key={h.ticker} value={h.ticker}>{h.ticker}</option>
                ))}
                {marketTickers.filter(mt => !dossier?.portfolio.holdings.some(h => h.ticker === mt.ticker)).map(mt => (
                  <option key={mt.ticker} value={mt.ticker}>{mt.ticker}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[#ffb000]">MARKET PRICE:</span>
            <span className="tabular-nums">${price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[#ffb000]">SHARES:</span>
            <div className="flex flex-col items-end">
              <input
                type="number"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                className="w-24 bg-[#0a0a0a] border border-[#ffb000] text-right px-2 py-1 text-[#ffb000] focus:border-[#ffb000] outline-none tabular-nums"
              />
              <span className="text-[#808080] text-[11px] mt-1">
                └─ Max affordable: {maxAffordable.toLocaleString()} shares
              </span>
            </div>
          </div>

          <div className="border-b border-dashed border-[#ffb000] my-2"></div>

          <div className="flex justify-between items-center">
            <span className="text-[#ffb000]">TOTAL VALUE:</span>
            <span className="tabular-nums">${totalCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[#ffb000]">AVAILABLE CASH:</span>
            <span className="tabular-nums">${cash.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
          </div>

          <div className="border-l-4 border-amber-500 bg-[#1a1100] p-3 text-amber-500 mt-4 uppercase">
            [ SYSTEM NOTICE: TRADE EXECUTION REQUIRES BOARD APPROVAL. USE DIRECTIVE CONSOLE. ]
          </div>

          <button
            className="w-full mt-4 py-3 bg-[#0a0a0a] border-2 border-[#ffb000] text-[#ffb000] font-bold uppercase hover:bg-[#ffb000] hover:text-black transition-colors"
            onClick={() => setIsTradeModalOpen(false)}
          >
            [ CLOSE TERMINAL ]
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
      <div className="w-[600px] bg-[#0a0a0a] border-2 border-[#ffb000] flex flex-col text-[#e0e0e0] shadow-none rounded-none">
        <div className="flex justify-between items-center p-3 border-b-2 border-[#ffb000] bg-[#ffb000] text-black font-bold">
          <span className="uppercase">[ BOARD OF DIRECTORS FEEDBACK ]</span>
          <button
            className="text-black hover:text-white"
            onClick={() => setIsFeedbackModalOpen(false)}
          >
            [X]
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div className="text-[#ffb000] uppercase text-center border border-[#ffb000] p-2 mb-2 animate-pulse">
            FEEDBACK SYSTEM OFFLINE
          </div>
          <button
            className="w-full mt-4 py-2 bg-[#0a0a0a] border border-[#ffb000] text-[#ffb000] font-bold uppercase hover:bg-[#ffb000] hover:text-black transition-colors"
            onClick={() => setIsFeedbackModalOpen(false)}
          >
            [ ACKNOWLEDGE ]
          </button>
        </div>
      </div>
    </div>
  );
}
