"use client";

import { useMemo } from "react";
import { useMarketStore } from "@/stores/market-store";

export function PriceOverlay() {
  const selectedCompanyId = useMarketStore((s) => s.selectedCompanyId);
  const currentPrices = useMarketStore((s) => s.currentPrices);
  const candles = useMarketStore((s) => s.candles);
  const companies = useMarketStore((s) => s.companies);

  const selectedCompany = companies.find(
    (c) => c.team_id === selectedCompanyId,
  );
  const priceInfo = selectedCompanyId
    ? currentPrices[selectedCompanyId]
    : undefined;
  const companyCandles = selectedCompanyId
    ? candles[selectedCompanyId]
    : undefined;

  const { sessionHigh, sessionLow } = useMemo(() => {
    if (!companyCandles || companyCandles.length === 0) {
      return { sessionHigh: null, sessionLow: null };
    }
    let high = -Infinity;
    let low = Infinity;
    for (const c of companyCandles) {
      if (c.high > high) high = c.high;
      if (c.low < low) low = c.low;
    }
    return { sessionHigh: high, sessionLow: low };
  }, [companyCandles]);

  const currentPrice = priceInfo
    ? parseFloat(priceInfo.price)
    : selectedCompany
      ? parseFloat(selectedCompany.stock_price)
      : null;

  const changePct = priceInfo
    ? parseFloat(priceInfo.change_pct)
    : selectedCompany
      ? parseFloat(selectedCompany.change_pct)
      : null;

  const isPositive = changePct !== null && changePct >= 0;

  return (
    <div className="absolute top-2 left-2 z-10 pointer-events-none select-none">
      {/* Ticker */}
      {selectedCompany && (
        <div className="font-mono text-[10px] text-[#89919d] mb-0.5">
          {selectedCompany.ticker} / USD
        </div>
      )}

      {/* Current price */}
      <div className="font-mono text-xl font-bold text-[#e5e2e1] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
        {currentPrice !== null ? `$${currentPrice.toFixed(2)}` : "--"}
      </div>

      {/* Change % */}
      <div
        className={`font-mono text-xs font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${
          changePct === null
            ? "text-[#89919d]"
            : isPositive
              ? "text-[#40e56c]"
              : "text-[#FF1744]"
        }`}
      >
        {changePct !== null
          ? `${isPositive ? "+" : ""}${changePct.toFixed(2)}%`
          : "--"}
      </div>

      {/* High / Low */}
      <div className="flex gap-3 mt-1">
        <div className="font-mono text-[10px]">
          <span className="text-[#89919d]">H </span>
          <span className="text-[#e5e2e1] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            {sessionHigh !== null ? `$${sessionHigh.toFixed(2)}` : "--"}
          </span>
        </div>
        <div className="font-mono text-[10px]">
          <span className="text-[#89919d]">L </span>
          <span className="text-[#e5e2e1] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            {sessionLow !== null ? `$${sessionLow.toFixed(2)}` : "--"}
          </span>
        </div>
      </div>
    </div>
  );
}
