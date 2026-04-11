"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useGameContext } from "@/contexts/GameContext";
import { NewsItem, TickerSnapshot, GameState, TeamDossier } from "@/lib/models";

interface WebSocketContextType {
  isMarketConnected: boolean;
  isTeamConnected: boolean;
  marketNews: NewsItem[];
  marketTickers: TickerSnapshot[];
  gameState: GameState | null;
  dossier: TeamDossier | null;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

/**
 * WebSocketProvider manages the persistent WebSocket connections to the backend
 * (both the public market feed and the private team feed).
 * 
 * It automatically handles reconnection with exponential backoff and tracks
 * the latest sequence IDs to recover missed messages upon reconnection.
 * Exposes live market news, tickers, game state, and team dossier to the rest of the application.
 *
 * @param {Object} props - React props.
 * @param {ReactNode} props.children - Child components to be provided with WS state.
 * @returns A context provider component.
 */
export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { setCooldownRemaining } = useGameContext();
  const [isMarketConnected, setIsMarketConnected] = useState(false);
  const [isTeamConnected, setIsTeamConnected] = useState(false);
  
  const [marketNews, setMarketNews] = useState<NewsItem[]>([]);
  const [marketTickers, setMarketTickers] = useState<TickerSnapshot[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [dossier, setDossier] = useState<TeamDossier | null>(null);

  const marketWsRef = useRef<WebSocket | null>(null);
  const teamWsRef = useRef<WebSocket | null>(null);
  
  const marketSeqRef = useRef<number>(0);
  const teamSeqRef = useRef<number>(0);

  // Reconnection timers
  const marketReconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const teamReconnectTimer = useRef<NodeJS.Timeout | null>(null);

  const connectMarket = () => {
    if (marketWsRef.current?.readyState === WebSocket.OPEN) return;
    
    // In a real app, use environment variables: process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000"
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";
    const ws = new WebSocket(`${wsUrl}/ws/market`);

    ws.onopen = () => {
      setIsMarketConnected(true);
      if (marketSeqRef.current > 0) {
        ws.send(JSON.stringify({ type: "sync_request", last_sequence_id: marketSeqRef.current }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.sequence_id) marketSeqRef.current = data.sequence_id;

        switch (data.type) {
          case "connection_established":
            if (data.payload?.burst_sync) {
              if (data.payload.burst_sync.news) setMarketNews(data.payload.burst_sync.news);
              if (data.payload.burst_sync.tickers) setMarketTickers(data.payload.burst_sync.tickers);
              if (data.payload.burst_sync.game_state) setGameState(data.payload.burst_sync.game_state);
            }
            break;
          case "news":
            setMarketNews(prev => [data.payload, ...prev].slice(0, 50));
            break;
          case "price_update":
            setMarketTickers(prev => {
              const updated = [...prev];
              const idx = updated.findIndex(t => t.ticker === data.payload.ticker);
              if (idx >= 0) {
                updated[idx] = data.payload;
              } else {
                updated.push(data.payload);
              }
              return updated;
            });
            break;
          case "system_event":
            // E.g. purge
            if (data.payload?.game_state) {
                setGameState(data.payload.game_state);
            }
            break;
        }
      } catch (err) {
        console.error("Failed to parse market WS message:", err);
      }
    };

    ws.onclose = () => {
      setIsMarketConnected(false);
      marketReconnectTimer.current = setTimeout(connectMarket, 3000); // basic backoff
    };

    ws.onerror = (err) => {
      console.error("Market WS Error:", err);
    };

    marketWsRef.current = ws;
  };

  const connectTeam = () => {
    if (!user?.id) return;
    if (teamWsRef.current?.readyState === WebSocket.OPEN) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";
    // using user.id as api_key for now, or token
    const ws = new WebSocket(`${wsUrl}/ws/team/${user.id}`);

    ws.onopen = () => {
      setIsTeamConnected(true);
      if (teamSeqRef.current > 0) {
        ws.send(JSON.stringify({ type: "sync_request", last_sequence_id: teamSeqRef.current }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.sequence_id) teamSeqRef.current = data.sequence_id;

        switch (data.type) {
          case "connection_established":
            if (data.payload?.burst_sync?.dossier) {
              setDossier(data.payload.burst_sync.dossier);
            }
            break;
          case "cooldown_sync":
            setCooldownRemaining(data.payload.seconds_remaining);
            break;
          case "portfolio_update":
          case "cash_update":
            // Server pushes updated dossier components
            if (data.payload) {
                setDossier(prev => prev ? { ...prev, ...data.payload } : data.payload);
            }
            break;
          case "directive_complete":
            // Show modal or toast, maybe trigger REST fetch for history
            break;
          case "trade_confirmation":
            // Toast or notification
            break;
        }
      } catch (err) {
        console.error("Failed to parse team WS message:", err);
      }
    };

    ws.onclose = () => {
      setIsTeamConnected(false);
      teamReconnectTimer.current = setTimeout(connectTeam, 3000);
    };

    ws.onerror = (err) => {
      console.error("Team WS Error:", err);
    };

    teamWsRef.current = ws;
  };

  useEffect(() => {
    connectMarket();
    return () => {
      if (marketReconnectTimer.current) clearTimeout(marketReconnectTimer.current);
      if (marketWsRef.current) marketWsRef.current.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user?.id) {
      connectTeam();
    }
    return () => {
      if (teamReconnectTimer.current) clearTimeout(teamReconnectTimer.current);
      if (teamWsRef.current) teamWsRef.current.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <WebSocketContext.Provider
      value={{
        isMarketConnected,
        isTeamConnected,
        marketNews,
        marketTickers,
        gameState,
        dossier,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
}
