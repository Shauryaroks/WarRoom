interface SecondaryStatusBarProps {
  liquidity?: string;
  cash?: string;
  stockPrice?: string;
  changePercent?: string;
  holdings?: string;
}

export function SecondaryStatusBar({
  liquidity = "$1.2M",
  cash = "$850K",
  stockPrice = "$95.50",
  changePercent = "▼2.1%",
  holdings = "$400K",
}: SecondaryStatusBarProps) {
  return (
    <div className="fixed top-10 left-0 w-full h-8 bg-black border-b border-[var(--color-outline)] flex items-center px-4 gap-8 z-40 text-[10px]">
      <div className="flex gap-2">
        <span className="text-zinc-500 uppercase">LIQUIDITY:</span>
        <span className="text-[var(--color-accent-mint)]">{liquidity}</span>
      </div>
      <div className="flex gap-2">
        <span className="text-zinc-500 uppercase">CASH:</span>
        <span className="text-[var(--color-accent-mint)]">{cash}</span>
      </div>
      <div className="flex gap-2">
        <span className="text-zinc-500 uppercase">STOCK PRICE:</span>
        <span className="text-white">{stockPrice}</span>
        <span className="text-[var(--color-accent-rose)]">{changePercent}</span>
      </div>
      <div className="flex gap-2">
        <span className="text-zinc-500 uppercase">HOLDINGS:</span>
        <span className="text-[var(--color-accent-blue)]">{holdings}</span>
      </div>
    </div>
  );
}
