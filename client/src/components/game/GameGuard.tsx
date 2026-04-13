"use client";

import React, { useEffect, useState } from "react";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { useAuth } from "@/contexts/AuthContext";

export function GameGuard({ children }: { children: React.ReactNode }) {
  const { gameState, dossier, isMarketConnected, isTeamConnected } =
    useWebSocket();
  const { user, logout } = useAuth();

  const [countdown, setCountdown] = useState(60);
  const [connectionTimeout, setConnectionTimeout] = useState(false);

  // Simple countdown effect for Bankrupt state
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (dossier?.profile?.status === "BANKRUPT") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCountdown(60);
      interval = setInterval(() => {
        setCountdown((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [dossier?.profile?.status]);

  const loading = !gameState?.status || !dossier?.profile?.status;

  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        setConnectionTimeout(true);
      }, 10000);
      return () => clearTimeout(timer);
    } else {
      setConnectionTimeout(false);
    }
  }, [loading]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--color-bg-darkest)] text-[var(--color-accent-blue)] font-mono">
        <div className="text-2xl animate-pulse mb-4">
          CONNECTING TO SYSTEM...
        </div>
        {connectionTimeout && (
          <div className="text-center mt-4">
            <p className="text-[var(--color-accent-rose)] mb-4">
              Connection is taking longer than expected. Please check your
              network or refresh the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[var(--color-accent-blue)] text-black font-bold hover:bg-opacity-80 transition-colors"
            >
              REFRESH
            </button>
          </div>
        )}
      </div>
    );
  }

  if (dossier?.profile?.status === "REJECTED") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--color-bg-darkest)] text-red-500 font-mono">
        <div className="text-3xl font-bold mb-6 text-center px-4">
          ACCESS DENIED - REGISTRATION REJECTED BY ADMINISTRATOR
        </div>
        <button
          onClick={logout}
          className="px-6 py-2 bg-red-600 text-white font-bold hover:bg-red-700 transition-colors"
        >
          LOGOUT
        </button>
      </div>
    );
  }

  const isDisconnected = !loading && (!isMarketConnected || !isTeamConnected);

  // State 1: Pre-Game Lobby
  if (
    gameState?.status === "SETUP" &&
    (dossier?.profile?.status === "PENDING_START" ||
      dossier?.profile?.status === "READY")
  ) {
    return (
      <>
        {isDisconnected && (
          <div className="fixed top-0 left-0 w-full z-[100] bg-red-600 text-white text-center py-1 font-bold animate-pulse">
            CONNECTION LOST - RECONNECTING...
          </div>
        )}
        <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--color-bg-darkest)] text-[var(--color-accent-blue)] font-mono p-8 text-center relative overflow-hidden">
          {/* Terminal text styling */}
          <div className="absolute top-8 left-8 text-left text-sm opacity-70 mt-8">
            <p>{`> Initializing terminal interface... [OK]`}</p>
            <p>{`> Authenticating user token... [OK]`}</p>
            <p>{`> Connection established to /ws/team/${user?.token || "API_KEY"}`}</p>
            <p className="animate-pulse">{`> Waiting for Administrator / TRADING_OPEN broadcast...`}</p>
          </div>

          <h1 className="text-4xl font-bold mb-4 tracking-widest border border-[var(--color-accent-blue)] p-4 inline-block shadow-[0_0_15px_rgba(255,176,0,0.3)]">
            PRE-GAME LOBBY
          </h1>
          <p className="text-xl mb-8">MARKET STATUS: CLOSED</p>

          <div className="mb-12 border border-[var(--color-accent-blue)]/50 p-6 max-w-2xl bg-[var(--color-accent-blue)]/5">
            <h2 className="text-2xl mb-4 underline decoration-[var(--color-accent-blue)]/50">
              PORTFOLIO DOSSIER (READ-ONLY)
            </h2>
            <div className="grid grid-cols-2 gap-8 text-left">
              {Object.entries(dossier?.profile?.swot || {}).length === 0 ? (
                <div className="col-span-2 text-center text-[var(--color-text-muted)] italic">
                  No data available
                </div>
              ) : (
                Object.entries(dossier?.profile?.swot || {}).map(
                  ([key, value]) => (
                    <div key={key}>
                      <h3 className="font-bold mb-2 uppercase">{key}</h3>
                      <p className="opacity-80 text-sm whitespace-pre-wrap">
                        {value || "No data"}
                      </p>
                    </div>
                  ),
                )
              )}
            </div>
          </div>

          <div className="mt-auto animate-pulse text-lg border-t border-b border-[var(--color-accent-blue)] py-2 px-8">
            STATUS: {50 - (gameState?.teams_remaining || 0)} of 50 teams ready
          </div>
        </div>
      </>
    );
  }

  // To render an overlay while keeping the game read-only behind it,
  // we render children and absolute overlays over them.
  const isSpectator = dossier?.profile?.status === "ELIMINATED";
  const isBankrupt = dossier?.profile?.status === "BANKRUPT";
  const isPendingPurge = dossier?.profile?.status === "PENDING_PURGE";
  const isPaused = gameState?.status === "PAUSED";

  const hasOverlay = isSpectator || isBankrupt || isPendingPurge || isPaused;

  return (
    <>
      {isDisconnected && (
        <div className="fixed top-0 left-0 w-full z-[100] bg-red-600 text-white text-center py-1 font-bold animate-pulse">
          CONNECTION LOST - RECONNECTING...
        </div>
      )}
      <div className="relative w-full h-full">
        {/* We always render children so it's a "read-only view" beneath the overlays */}
        <div className={hasOverlay ? "pointer-events-none opacity-50" : ""}>
          {children}
        </div>

        {isSpectator && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[var(--color-bg-darkest)]/80 backdrop-blur-sm text-gray-400 font-mono">
            <div className="border-4 border-gray-500 p-12 bg-black shadow-[0_0_50px_rgba(107,114,128,0.5)] flex flex-col items-center">
              <h1 className="text-7xl font-bold mb-6 tracking-[0.3em] opacity-80">
                ELIMINATED
              </h1>
              <p className="text-2xl tracking-widest animate-pulse">
                SPECTATOR MODE
              </p>
            </div>
          </div>
        )}

        {isBankrupt && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-red-950/60 backdrop-blur-sm text-red-500 font-mono">
            <div className="border-4 border-red-600 p-12 bg-black shadow-[0_0_80px_rgba(220,38,38,0.6)] flex flex-col items-center">
              <h1 className="text-8xl font-black mb-6 tracking-[0.2em] animate-pulse drop-shadow-[0_0_15px_rgba(220,38,38,1)]">
                BANKRUPT
              </h1>
              <p className="text-3xl font-bold tracking-widest text-red-400 mt-4">
                {countdown}-SECOND COUNTDOWN
              </p>
              <p className="text-xl text-red-400/80 mt-2">
                TO FORCED LIQUIDATION
              </p>
            </div>
          </div>
        )}

        {isPendingPurge && !isSpectator && !isBankrupt && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[var(--color-bg-darkest)]/80 backdrop-blur-sm text-[var(--color-accent-blue)] font-mono">
            <div className="border-4 border-[var(--color-accent-blue)] p-12 bg-black shadow-[0_0_50px_rgba(255,176,0,0.5)] flex flex-col items-center">
              <h1 className="text-6xl font-bold mb-6 tracking-[0.2em] opacity-100 animate-pulse">
                MARKET PURGE IN PROGRESS
              </h1>
              <p className="text-xl tracking-widest">
                PLEASE STAND BY FOR ADMINISTRATOR RESOLUTION
              </p>
            </div>
          </div>
        )}

        {isPaused && !isSpectator && !isBankrupt && !isPendingPurge && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[var(--color-bg-darkest)]/70 backdrop-blur-sm text-[var(--color-accent-blue)] font-mono">
            <div className="border-y-4 border-[var(--color-accent-blue)] py-8 w-full bg-black/90 flex flex-col items-center shadow-[0_0_30px_rgba(255,176,0,0.4)]">
              <h1 className="text-6xl font-bold tracking-[0.4em] animate-pulse">
                TRADING HALTED
              </h1>
              <p className="text-xl mt-4 opacity-80">
                ADMINISTRATOR PAUSE IN EFFECT
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
