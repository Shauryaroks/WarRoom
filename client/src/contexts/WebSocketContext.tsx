"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useRef,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useGameContext } from "@/contexts/GameContext";
import { NewsItem, TickerSnapshot, GameState, TeamDossier } from "@/lib/models";

export interface BankruptcyWarning {
  cash_balance: number;
  grace_period_seconds: number;
}

interface WebSocketContextType {
  isMarketConnected: boolean;
  isTeamConnected: boolean;
  marketNews: NewsItem[];
  marketTickers: TickerSnapshot[];
  gameState: GameState | null;
  dossier: TeamDossier | null;
  bankruptcyWarning: BankruptcyWarning | null;
  globalAnnouncement: { message: string; type: "PURGE" | "BANKRUPTCY" } | null;
  connectionError: string | null;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(
  undefined,
);

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
function getWsBaseUrl(): string {
  // Derive from API URL: https://host/api/v1 -> wss://host, http://host:80/api/v1 -> ws://host:80
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:80/api/v1";
  try {
    const url = new URL(apiUrl);
    const wsProto = url.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProto}//${url.host}`;
  } catch {
    console.log("WS apiUrl resolution failed: using ws://localhost:80");
    return "ws://localhost:80";
  }
}

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { setCooldownRemaining } = useGameContext();
  const [isMarketConnected, setIsMarketConnected] = useState(false);
  const [isTeamConnected, setIsTeamConnected] = useState(false);

  const [marketNews, setMarketNews] = useState<NewsItem[]>([]);
  const [marketTickers, setMarketTickers] = useState<TickerSnapshot[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [dossier, setDossier] = useState<TeamDossier | null>(null);
  const [bankruptcyWarning, setBankruptcyWarning] =
    useState<BankruptcyWarning | null>(null);
  const [globalAnnouncement, setGlobalAnnouncement] = useState<{
    message: string;
    type: "PURGE" | "BANKRUPTCY";
  } | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const marketWsRef = useRef<WebSocket | null>(null);
  const teamWsRef = useRef<WebSocket | null>(null);

  const marketSeqRef = useRef<number>(0);
  const teamSeqRef = useRef<number>(0);

  // Reconnection timers
  const marketReconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const teamReconnectTimer = useRef<NodeJS.Timeout | null>(null);

  const connectMarket = () => {
    if (marketWsRef.current?.readyState === WebSocket.OPEN) return;

    const wsUrl = getWsBaseUrl();
    const ws = new WebSocket(`${wsUrl}/ws/market`);

    ws.onopen = () => {
      setIsMarketConnected(true);
      if (marketSeqRef.current > 0) {
        ws.send(
          JSON.stringify({
            type: "sync_request",
            last_sequence_id: marketSeqRef.current,
          }),
        );
      }
    };

    ws.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (err) {
        console.error("[Market WS] Failed to parse message:", err);
        console.error("[Market WS] Raw payload:", event.data);
        return;
      }

      try {
        if (data.type === "error") {
          console.error(
            "[Market WS] Received server error:",
            data.payload || data.message || data,
          );
          return;
        }

        if (data.sequence_id) marketSeqRef.current = data.sequence_id;

        switch (data.type) {
          case "connection_established":
            if (data.payload?.burst_sync) {
              if (data.payload.burst_sync.news)
                setMarketNews(data.payload.burst_sync.news);
              if (data.payload.burst_sync.tickers)
                setMarketTickers(data.payload.burst_sync.tickers);
              if (data.payload.burst_sync.game_state)
                setGameState(data.payload.burst_sync.game_state);
            }
            break;
          case "news":
            setMarketNews((prev) => [data.payload, ...prev].slice(0, 50));
            break;
          case "price_update":
            setMarketTickers((prev) => {
              const updated = [...prev];
              const idx = updated.findIndex(
                (t) => t.ticker === data.payload.ticker,
              );
              if (idx >= 0) {
                updated[idx] = data.payload;
              } else {
                updated.push(data.payload);
              }
              return updated;
            });
            break;
          case "HALT":
            setMarketTickers((prev) => {
              const updated = [...prev];
              const idx = updated.findIndex(
                (t) => t.ticker === data.payload.ticker,
              );
              if (idx >= 0) {
                updated[idx] = { ...updated[idx], status: "HALTED" };
              }
              return updated;
            });
            break;
          case "system_event": {
            const eventType = data.payload?.event_type;

            if (eventType === "PURGE_COMPLETE") {
              console.log("Market Purge Complete:", data.payload);
              const eliminated =
                data.payload.eliminated_tickers ||
                data.payload.eliminated ||
                [];
              setGlobalAnnouncement({
                message: `PURGE PROTOCOL COMPLETE. ELIMINATED: ${eliminated.join(", ") || "NONE"}`,
                type: "PURGE",
              });
              if (Array.isArray(eliminated)) {
                setMarketTickers((prev) =>
                  prev.map((t) =>
                    eliminated.includes(t.ticker)
                      ? { ...t, status: "HALTED" }
                      : t,
                  ),
                );
              }
              setTimeout(() => setGlobalAnnouncement(null), 5000);
            }

            if (eventType === "BANKRUPTCY_DECLARATION") {
              console.log("System Event: Bankruptcy Declaration", data.payload);
              setGlobalAnnouncement({
                message: `BANKRUPTCY DECLARED: ${data.payload.ticker || data.payload.team_id}`,
                type: "BANKRUPTCY",
              });
              setTimeout(() => setGlobalAnnouncement(null), 5000);
            }

            if (data.payload?.game_state) {
              setGameState(data.payload.game_state);
            }
            break;
          }
        }
      } catch (err) {
        console.error("[Market WS] Failed to process message logic:", err);
      }
    };

    ws.onclose = (event) => {
      console.warn(
        `[Market WS] Connection closed. Code: ${event.code}, Reason: ${event.reason}`,
      );
      setIsMarketConnected(false);
      marketReconnectTimer.current = setTimeout(connectMarket, 3000); // basic backoff
    };

    ws.onerror = (error) => {
      console.error("[Market WS] Connection error:", error);
    };

    marketWsRef.current = ws;
  };

  const connectTeam = () => {
    const apiKey =
      typeof window !== "undefined"
        ? localStorage.getItem("complex_api_key")
        : null;
    if (!apiKey) return;
    if (teamWsRef.current?.readyState === WebSocket.OPEN) return;

    const wsUrl = getWsBaseUrl();
    const ws = new WebSocket(`${wsUrl}/ws/team/${apiKey}`);

    ws.onopen = () => {
      setIsTeamConnected(true);
      if (teamSeqRef.current > 0) {
        ws.send(
          JSON.stringify({
            type: "sync_request",
            last_sequence_id: teamSeqRef.current,
          }),
        );
      }
    };

    ws.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (err) {
        console.error("[Team WS] Failed to parse message:", err);
        console.error("[Team WS] Raw payload:", event.data);
        return;
      }

      try {
        if (data.type === "error") {
          console.error(
            "[Team WS] Received server error:",
            data.payload || data.message || data,
          );
          return;
        }

        if (data.sequence_id) teamSeqRef.current = data.sequence_id;

        switch (data.type) {
          case "connection_established":
            if (data.payload?.burst_sync?.dossier) {
              setDossier(data.payload.burst_sync.dossier);
              // Initialize cooldown from dossier if active
              const cd = data.payload.burst_sync.dossier.cooldown_status;
              if (cd?.active && cd.seconds_remaining && cd.seconds_remaining > 0) {
                setCooldownRemaining(cd.seconds_remaining);
              }
            }
            break;
          case "cooldown_sync":
            setCooldownRemaining(data.payload.seconds_remaining);
            break;
          case "portfolio_update":
          case "cash_update":
            // Server pushes updated dossier components
            if (data.payload) {
              setDossier((prev) =>
                prev ? { ...prev, ...data.payload } : data.payload,
              );
            }
            break;
          case "bankruptcy_alert":
            console.log("Bankruptcy Alert:", data.payload);
            setBankruptcyWarning(data.payload);
            break;
          case "directive_complete":
            console.log("Directive complete:", data.payload);
            // Update dossier with latest directive info
            if (data.payload) {
              setDossier((prev) =>
                prev
                  ? {
                      ...prev,
                      last_directive: {
                        id: data.payload.directive_id || data.payload.id || "",
                        headline:
                          data.payload.headline || data.payload.news_headline || "",
                        feedback:
                          data.payload.feedback || data.payload.board_feedback || "",
                        submitted_at: data.payload.submitted_at || "",
                        status: data.payload.status || "COMPLETED",
                      },
                      profile: {
                        ...prev.profile,
                        status:
                          data.payload.team_status || prev.profile.status,
                      },
                    }
                  : prev,
              );
            }
            break;
          case "trade_confirmation":
            console.log("Trade confirmation:", data.payload);
            break;
        }
      } catch (err) {
        console.error("[Team WS] Failed to process message logic:", err);
      }
    };

    ws.onclose = (event) => {
      console.warn(
        `[Team WS] Connection closed. Code: ${event.code}, Reason: ${event.reason}`,
      );
      setIsTeamConnected(false);

      // Stop reconnecting and show error for 400x WebSocket codes (e.g. 4001 Invalid API key)
      if (event.code >= 4000 && event.code < 4010) {
        setConnectionError(
          event.reason || "Connection rejected by server (Invalid Token).",
        );
      } else {
        teamReconnectTimer.current = setTimeout(connectTeam, 3000);
      }
    };

    ws.onerror = () => {
      // Suppress — onclose handler below manages the actual error state
    };

    teamWsRef.current = ws;
  };

  useEffect(() => {
    connectMarket();
    return () => {
      if (marketReconnectTimer.current)
        clearTimeout(marketReconnectTimer.current);
      if (marketWsRef.current) marketWsRef.current.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      localStorage.getItem("complex_api_key")
    ) {
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
        bankruptcyWarning,
        globalAnnouncement,
        connectionError,
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
