"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useAuthStore } from "@/stores/auth-store";

type MessageHandler = (data: Record<string, unknown>) => void;

interface UseWebSocketOptions {
  onMessage?: MessageHandler;
  enabled?: boolean;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  sendMessage: (data: Record<string, unknown>) => void;
}

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080";

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const { onMessage, enabled = true } = options;
  const token = useAuthStore((s) => s.token);
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const pingIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (!token || !enabled) return;

    try {
      const ws = new WebSocket(`${WS_BASE}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        // Send auth message as first message
        ws.send(JSON.stringify({ type: "auth", token }));

        // Start client-side ping every 25s (server expects within 30s)
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "connected") {
            setIsConnected(true);
            reconnectAttempts.current = 0;
          } else if (data.type === "pong") {
            // Server responded to our ping -- connection alive
          } else if (data.type === "ping") {
            // Server-initiated ping -- respond with pong
            ws.send(JSON.stringify({ type: "pong" }));
          } else {
            onMessageRef.current?.(data);
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

        // Don't reconnect on auth failures (4001-4003)
        if (event.code >= 4001 && event.code <= 4003) return;

        // Exponential backoff reconnection
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          const jitter = Math.random() * 1000;
          reconnectAttempts.current++;
          reconnectTimeoutRef.current = setTimeout(connect, delay + jitter);
        }
      };

      ws.onerror = () => {
        // onclose will fire after onerror
      };
    } catch {
      // Connection failed -- onclose reconnect logic handles retry
    }
  }, [token, enabled]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on intentional close
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { isConnected, sendMessage };
}
