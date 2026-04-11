"use client";

import { useAuth } from "@/contexts/AuthContext";
import { GameProvider, useGameContext } from "@/contexts/GameContext";
import {
  HeaderBar,
  LeftSidebar,
  DirectiveEditor,
  RightSidebar,
  Footer,
} from "@/components/game";
import { TradeModal, BoardFeedbackModal } from "@/components/game/Modals";

function GameLayout() {
  const { user } = useAuth();
  const ticker = user?.ticker || "$XXX";
  const { isTradeModalOpen, isFeedbackModalOpen } = useGameContext();

  return (
    <div className="h-screen w-screen bg-[#0a0a0a] text-[#e0e0e0] font-mono text-[13px] leading-tight overflow-hidden select-none">
      <div
        className="grid h-full w-full"
        style={{
          gridTemplateRows: "48px 1fr 32px",
          gridTemplateColumns: "380px 1fr 380px",
          gridTemplateAreas: `
            "header header header"
            "ledger command wire"
            "ticker ticker ticker"
          `,
        }}
      >
        <div
          style={{ gridArea: "header" }}
          className="border-b border-[#2a2a2a] bg-[#0a0a0a]"
        >
          <HeaderBar
            sessionElapsed="04:23:17"
            timerSeq="ROUND: [2/4]"
            nextPurge="15 MIN"
            ticker={ticker}
          />
        </div>

        <div
          style={{ gridArea: "ledger" }}
          className="border-r border-[#2a2a2a] bg-[#0a0a0a]"
        >
          <LeftSidebar ticker={ticker} />
        </div>

        <div style={{ gridArea: "command" }} className="bg-[#0d0d0d]">
          <DirectiveEditor maxChars={2000} />
        </div>

        <div
          style={{ gridArea: "wire" }}
          className="border-l border-[#2a2a2a] bg-[#0a0a0a]"
        >
          <RightSidebar />
        </div>

        <div
          style={{ gridArea: "ticker" }}
          className="border-t border-[#2a2a2a] bg-black"
        >
          <Footer ticker={ticker} />
        </div>
      </div>

      {isTradeModalOpen && <TradeModal />}
      {isFeedbackModalOpen && <BoardFeedbackModal />}
    </div>
  );
}

export default function GamePage() {
  return (
    <GameProvider>
      <GameLayout />
    </GameProvider>
  );
}
