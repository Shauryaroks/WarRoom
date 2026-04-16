"use client";

import { useMarketStore } from "@/stores/market-store";

export function CompanyTabs() {
  const companies = useMarketStore((s) => s.companies);
  const selectedCompanyId = useMarketStore((s) => s.selectedCompanyId);
  const selectCompany = useMarketStore((s) => s.selectCompany);
  const currentPrices = useMarketStore((s) => s.currentPrices);

  if (companies.length === 0) {
    return (
      <div className="flex items-center h-9 bg-[#0e0e0e] px-3">
        <span className="font-mono text-[11px] text-[#89919d]">
          Awaiting market data...
        </span>
      </div>
    );
  }

  return (
    <div className="flex gap-0 overflow-x-auto bg-[#0e0e0e]">
      {companies.map((company) => {
        const isActive = company.team_id === selectedCompanyId;
        const priceInfo = currentPrices[company.team_id];
        const changePct = priceInfo
          ? parseFloat(priceInfo.change_pct)
          : parseFloat(company.change_pct);
        const price = priceInfo ? priceInfo.price : company.stock_price;
        const isPositive = changePct >= 0;

        return (
          <button
            key={company.team_id}
            onClick={() => selectCompany(company.team_id)}
            className={`flex items-center gap-2 px-3 h-9 shrink-0 transition-colors ${
              isActive
                ? "bg-[#2196f3]/10 text-[#2196f3] border-b-2 border-[#2196f3]"
                : "text-[#89919d] hover:bg-[#2a2a2a] border-b-2 border-transparent"
            }`}
          >
            <span className="font-mono text-[11px] font-bold">
              {company.ticker}
            </span>
            <span className="font-mono text-[10px]">
              ${parseFloat(price).toFixed(2)}
            </span>
            <span
              className={`font-mono text-[10px] ${
                isPositive ? "text-[#40e56c]" : "text-[#FF1744]"
              }`}
            >
              {isPositive ? "+" : ""}
              {changePct.toFixed(2)}%
            </span>
          </button>
        );
      })}
    </div>
  );
}
