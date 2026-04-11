"use client";

import React from "react";
import { useGameContext } from "@/contexts/GameContext";

export function TradeModal() {
  const { selectedTicker, setIsTradeModalOpen } = useGameContext();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[480px] bg-[#141414] border border-[#2a2a2a] flex flex-col font-mono text-[13px] text-[#e0e0e0]">
        <div className="flex justify-between items-center p-3 border-b border-[#2a2a2a]">
          <span className="uppercase">Execute Order</span>
          <button
            className="text-[#505050] hover:text-[#e0e0e0]"
            onClick={() => setIsTradeModalOpen(false)}
          >
            [X]
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <span className="text-[#808080]">TARGET:</span>
            <div className="flex items-center gap-2">
              <span className="text-[#ffb000] border border-[#2a2a2a] bg-[#0a0a0a] px-2 py-1">
                [{selectedTicker || "$APEX"} ▼]
              </span>
              <span className="text-[#e0e0e0]">[Company Name]</span>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[#808080]">MARKET PRICE:</span>
            <span>104.00</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[#808080]">SHARES:</span>
            <div className="flex flex-col items-end">
              <input
                type="number"
                defaultValue="100"
                className="w-24 bg-[#0a0a0a] border border-[#2a2a2a] text-right px-2 py-1 text-[#e0e0e0] focus:border-[#ffb000] outline-none"
              />
              <span className="text-[#505050] text-[11px] mt-1">
                └─ Max affordable: 8,173 shares
              </span>
            </div>
          </div>

          <div className="border-b border-[#2a2a2a] my-2"></div>

          <div className="flex justify-between items-center">
            <span className="text-[#808080]">TOTAL COST:</span>
            <span>$10,400.00</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[#808080]">AVAILABLE CASH:</span>
            <span>$850,000.00</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[#808080]">POST-TRADE CASH:</span>
            <span>$839,600.00</span>
          </div>

          <div className="border-l-4 border-[#ffcc00] bg-[#332a00] p-3 text-[#ffcc00] mt-4 uppercase">
            [⚠ OWNERSHIP WARNING: 23% → 25%]
          </div>

          <button
            className="w-full mt-4 py-3 bg-[#ffb000] text-black font-bold uppercase hover:brightness-110 active:translate-y-px"
            onClick={() => setIsTradeModalOpen(false)}
          >
            [ CONFIRM MARKET ORDER ]
          </button>
        </div>
      </div>
    </div>
  );
}

export function BoardFeedbackModal() {
  const { setIsFeedbackModalOpen } = useGameContext();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[600px] bg-[#141414] border border-[#2a2a2a] flex flex-col font-mono text-[13px] text-[#e0e0e0]">
        <div className="flex justify-between items-center p-3 border-b border-[#2a2a2a]">
          <span className="uppercase">Board of Directors Feedback</span>
          <button
            className="text-[#505050] hover:text-[#e0e0e0]"
            onClick={() => setIsFeedbackModalOpen(false)}
          >
            [X]
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[#808080]">TONE:</span>
            <span className="text-[#e0e0e0]">[SKEPTICAL ▼]</span>
          </div>

          <div className="border-b border-[#2a2a2a]"></div>

          <p className="text-[#e0e0e0] italic leading-relaxed pl-4 border-l-2 border-[#505050]">
            &quot;Your 15% price slash is bold, but you failed to address the rising
            interest rate environment in your justification. The Board questions
            your macro awareness. Execution proceeds with caution.&quot;
          </p>

          <div className="border-b border-[#2a2a2a]"></div>

          <div className="flex flex-col gap-2">
            <span className="text-[#808080]">FINANCIAL IMPACT:</span>
            <div className="flex justify-between pl-4">
              <span>Revenue:</span>
              <span className="text-[#00c853]">+$450,000 [▲ GREEN]</span>
            </div>
            <div className="flex justify-between pl-4">
              <span>Costs:</span>
              <span className="text-[#ff3333]">-$200,000 [▼ RED]</span>
            </div>
            <div className="flex justify-between pl-4">
              <span>Marketing:</span>
              <span className="text-[#ff3333]">-$150,000 [▼ RED]</span>
            </div>
            <div className="border-b border-[#2a2a2a] ml-4 w-1/2 ml-auto my-1"></div>
            <div className="flex justify-between pl-4">
              <span>Net Profit:</span>
              <span>+$100,000</span>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-2">
            <span className="text-[#808080]">NEW STOCK PRICE:</span>
            <span>
              $95.50 <span className="text-[#ff3333]">[▼4.5%]</span>
            </span>
          </div>

          <div className="flex flex-col gap-2 mt-4 bg-[#0a0a0a] p-3 border border-[#2a2a2a]">
            <span className="text-[#808080]">[GENERATED HEADLINE ▼]</span>
            <span className="text-[#ffb000]">
              &quot;Barbie Inc ($BRBE) slashes prices in aggressive market share
              grab&quot;
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
