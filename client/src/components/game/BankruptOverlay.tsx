"use client";

interface BankruptOverlayProps {
  ticker: string | null;
  teamName: string | null;
}

export function BankruptOverlay({ ticker, teamName }: BankruptOverlayProps) {
  return (
    <div className="fixed inset-0 z-[100] bg-[#0a0000]/95 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="max-w-xl w-full border-2 border-[#FF1744] bg-[#1a0000] p-10 text-center space-y-6">
        <div className="text-[10px] font-mono text-[#FF1744]/70 uppercase tracking-[0.3em]">
          STATUS // TERMINAL
        </div>

        <div className="font-mono text-5xl font-black text-[#FF1744] tracking-widest">
          BANKRUPT
        </div>

        <div className="h-px bg-[#FF1744]/30" />

        <div className="space-y-2">
          {ticker && (
            <div className="font-mono text-xl text-[#FF6E7A]">${ticker}</div>
          )}
          {teamName && (
            <div className="font-mono text-sm text-[#89919d]">{teamName}</div>
          )}
        </div>

        <p className="text-xs text-[#FF6E7A]/80 leading-relaxed font-mono">
          Your stock price has collapsed to ₹0.00. Your company has been
          delisted from the exchange. All trading, solution submissions, and
          decision inputs are frozen.
        </p>

        <div className="text-[10px] font-mono text-[#89919d] uppercase tracking-widest pt-4">
          CONTACT ADMIN FOR NEXT STEPS
        </div>
      </div>
    </div>
  );
}
