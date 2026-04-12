"use client";

import { useAuth } from "@/contexts/AuthContext";
import { GameProvider, useGameContext } from "@/contexts/GameContext";
import { WebSocketProvider, useWebSocket } from "@/contexts/WebSocketContext";
import {
  HeaderBar,
  LeftSidebar,
  DirectiveEditor,
  RightSidebar,
  Footer,
} from "@/components/game";
import { GameGuard } from "@/components/game/GameGuard";
import { TradeModal, BoardFeedbackModal } from "@/components/game/Modals";

/**
 * The inner layout component for the main game dashboard.
 * Connects to the Auth, Game, and WebSocket contexts to retrieve the user,
 * game state, and modal statuses, and renders the terminal UI grid consisting
 * of the header, sidebars, directive editor, and footer ticker.
 *
 * @returns The rendered terminal layout.
 */
function GameLayout() {
  const { user } = useAuth();
  const ticker = user?.ticker || "$BRBE";
  const { isTradeModalOpen, isFeedbackModalOpen } = useGameContext();
  const { gameState, isMarketConnected, isTeamConnected, globalAnnouncement } =
    useWebSocket();

  const formatSeconds = (secs?: number) => {
    if (!secs) return "00:00:00";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0a0a0a] text-[#0077b6] font-mono text-[13px] leading-tight overflow-hidden select-none">
      {/* HEADER BAR */}
      <div className="h-12 border-b border-[#2a2a2a] bg-[#0a0a0a] shrink-0">
        <HeaderBar
          sessionElapsed={formatSeconds(gameState?.elapsed_seconds)}
          timerSeq={`ROUND: [${gameState?.current_round || 0}/4]`}
          ticker={ticker}
          isMarketConnected={isMarketConnected}
          isTeamConnected={isTeamConnected}
        />
      </div>

      {/* MIDDLE SECTION */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEDGER */}
        <div className="w-1/4 h-full border-r border-[#2a2a2a] bg-[#0a0a0a] overflow-hidden">
          <LeftSidebar />
        </div>

        {/* COMMAND LINE */}
        <div className="w-2/4 h-full bg-[#0d0d0d] overflow-hidden">
          <DirectiveEditor maxChars={2000} />
        </div>

        {/* THE WIRE */}
        <div className="w-1/4 h-full border-l border-[#2a2a2a] bg-[#0a0a0a] overflow-hidden">
          <RightSidebar />
        </div>
      </div>

      {/* FOOTER TICKER */}
      <div className="h-8 border-t border-[#2a2a2a] bg-black shrink-0">
        <Footer />
      </div>

      {isTradeModalOpen && <TradeModal />}
      {isFeedbackModalOpen && <BoardFeedbackModal />}
      {globalAnnouncement && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="flex flex-col items-center justify-center border-2 border-red-500 bg-black p-8 shadow-[0_0_30px_rgba(239,68,68,0.5)]">
            <h1 className="text-4xl font-bold tracking-[0.2em] text-red-500 animate-pulse mb-4">
              {globalAnnouncement.type === "PURGE"
                ? "SYSTEM PURGE ALERT"
                : "BANKRUPTCY ALERT"}
            </h1>
            <p className="text-xl text-red-400 font-mono text-center max-w-2xl">
              {globalAnnouncement.message}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The main entry point for the player game dashboard.
 * Wraps the `GameLayout` in the required context providers (GameProvider and WebSocketProvider).
 *
 * @returns The wrapped game page layout.
 */
export default function GamePage() {
  return (
    <GameProvider>
      <WebSocketProvider>
        <GameGuard>
          <GameLayout />
        </GameGuard>
      </WebSocketProvider>
    </GameProvider>
  );
}
