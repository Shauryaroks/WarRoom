"use client";

export function SolutionsPanel() {
  return (
    <div className="p-4 space-y-6">
      <div className="text-[10px] text-[#89919d] uppercase font-bold tracking-widest">
        SOLUTIONS
      </div>

      <div className="flex-1 flex flex-col items-center justify-center py-12 space-y-4">
        <div className="font-mono text-xs text-[#404752] uppercase tracking-widest text-center">
          SOLUTIONS_MODULE // AWAITING_DEPLOYMENT
        </div>
        <p className="text-xs text-[#89919d] text-center max-w-[240px] leading-relaxed">
          Strategic solution submission will be available in the next update.
        </p>
        <div className="bg-[#1c1b1b] p-3 border-l-2 border-[#404752]">
          <div className="font-mono text-[9px] text-[#89919d] uppercase">MODULE</div>
          <div className="font-mono text-xs text-[#404752]">STRATEGY_EDITOR</div>
        </div>
      </div>
    </div>
  );
}
