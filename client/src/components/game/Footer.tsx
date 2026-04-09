interface StockTicker {
  symbol: string;
  change: string;
  volume: string;
}

interface FooterProps {
  ticker?: string;
  tickers?: StockTicker[];
}

const defaultTickers: StockTicker[] = [
  { symbol: "$CORP", change: "▲+2.41%", volume: "12.4M" },
  { symbol: "$TECH", change: "▼-1.24%", volume: "890K" },
  { symbol: "$SOLA", change: "▲+0.08%", volume: "2.1M" },
];

export function Footer({
  ticker = "$XXX",
  tickers = defaultTickers,
}: FooterProps) {
  const getChangeColor = (change: string) => {
    return change.startsWith("▲") ? "text-[#00c853]" : "text-[#ff3333]";
  };

  return (
    <footer className="fixed bottom-0 left-0 w-full z-50 flex items-center justify-between px-4 bg-black h-6 border-t border-[#353534]">
      <div className="flex gap-4 overflow-hidden items-center flex-1">
        <div
          className="flex items-center gap-6 whitespace-nowrap text-[9px] animate-[ticker_40s_linear_infinite]"
          style={{ animation: "ticker 40s linear infinite" }}
        >
          <span className="text-[#FFB000] font-bold">
            {ticker} <span className="text-[#00c853]">▲+2.41%</span>{" "}
            <span className="text-zinc-600">[VOL: 12.4M]</span>
          </span>
          {tickers.map((t, i) => (
            <span key={i} className="text-[#FFB000] font-bold">
              {t.symbol}{" "}
              <span className={getChangeColor(t.change)}>{t.change}</span>{" "}
              <span className="text-zinc-600">[VOL: {t.volume}]</span>
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-4 border-l border-[#353534] pl-4 h-full text-[8px] tracking-[0.1em]">
        <div className="flex gap-3">
          <span className="text-[#00c853]">MARKET_STATUS: ACTIVE</span>
          <span className="text-zinc-500 uppercase">ENCRYPTION: AES_256</span>
        </div>
        <span className="text-zinc-600">SYSTEM_STABLE_v1.02_FIN</span>
      </div>
    </footer>
  );
}
