"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { GameProvider, useGameContext } from "@/contexts/GameContext";
import { api } from "@/lib/api";
import { GameState } from "@/lib/models";
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
  const ticker = user?.ticker || "$BRBE";
  const { isTradeModalOpen, isFeedbackModalOpen } = useGameContext();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [now, setNow] = useState<number>(0);

  useEffect(() => {
    const timer = setTimeout(() => setNow(Date.now()), 0);
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    api.getGameState().then(setGameState).catch(console.error);
  }, []);

  const formatSeconds = (secs?: number) => {
    if (!secs) return "00:00:00";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getMinutesUntil = (dateStr?: string | null) => {
    if (!dateStr || !now) return "N/A";
    const mins = Math.max(0, Math.floor((new Date(dateStr).getTime() - now) / 60000));
    return `${mins} MIN`;
  };

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
            sessionElapsed={formatSeconds(gameState?.elapsed_seconds)}
            timerSeq={`ROUND: [${gameState?.current_round || 0}/4]`}
            nextPurge={getMinutesUntil(gameState?.next_purge_at)}
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
          <Footer />
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
