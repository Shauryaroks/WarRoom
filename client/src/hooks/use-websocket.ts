"use client";

import { useEffect, useCallback } from "react";
import { create } from "zustand";
import { useAuthStore } from "@/stores/auth-store";

type MessageHandler = (data: Record<string, unknown>) => void;

interface WebSocketState {
  isConnected: boolean;
  ws: WebSocket | null;
  listeners: Set<MessageHandler>;
  addListener: (handler: MessageHandler) => void;
  removeListener: (handler: MessageHandler) => void;
}

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080";

// Singleton state — one WebSocket connection shared across all components
const useWsStore = create<WebSocketState>((set, get) => ({
  isConnected: false,
  ws: null,
  listeners: new Set(),
  addListener: (handler) => {
    get().listeners.add(handler);
  },
  removeListener: (handler) => {
    get().listeners.delete(handler);
  },
}));

let reconnectAttempts = 0;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let pingInterval: ReturnType<typeof setInterval> | null = null;
let isConnecting = false;

function cleanup() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
}

function connectSingleton(token: string) {
  // Prevent duplicate connection attempts
  if (isConnecting) return;
  const existing = useWsStore.getState().ws;
  if (existing && (existing.readyState === WebSocket.CONNECTING || existing.readyState === WebSocket.OPEN)) {
    return;
  }

  isConnecting = true;

  try {
    const ws = new WebSocket(`${WS_BASE}/ws`);

    ws.onopen = () => {
      isConnecting = false;
      ws.send(JSON.stringify({ type: "auth", token }));

      pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 25000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "connected") {
          useWsStore.setState({ isConnected: true });
          reconnectAttempts = 0;
        } else if (data.type === "pong") {
          // keepalive response
        } else if (data.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        } else {
          // Broadcast to all registered listeners
          const { listeners } = useWsStore.getState();
          listeners.forEach((handler) => {
            try {
              handler(data);
            } catch {
              // Listener error — don't break other listeners
            }
          });
        }
      } catch {
        // malformed message
      }
    };

    ws.onclose = (event) => {
      isConnecting = false;
      useWsStore.setState({ isConnected: false, ws: null });
      cleanup();

      // Don't reconnect on auth failures
      if (event.code >= 4001 && event.code <= 4003) return;

      // Exponential backoff
      if (reconnectAttempts < 10) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        const jitter = Math.random() * 1000;
        reconnectAttempts++;
        reconnectTimeout = setTimeout(() => {
          const currentToken = useAuthStore.getState().token;
          if (currentToken) connectSingleton(currentToken);
        }, delay + jitter);
      }
    };

    ws.onerror = () => {
      isConnecting = false;
    };

    useWsStore.setState({ ws });
  } catch {
    isConnecting = false;
  }
}

function disconnectSingleton() {
  cleanup();
  const { ws } = useWsStore.getState();
  if (ws) {
    ws.onclose = null;
    ws.close();
    useWsStore.setState({ ws: null, isConnected: false });
  }
  reconnectAttempts = 0;
  isConnecting = false;
}

// --- Public hook ---

interface UseWebSocketOptions {
  onMessage?: MessageHandler;
  enabled?: boolean;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  sendMessage: (data: Record<string, unknown>) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const { onMessage, enabled = true } = options;
  const token = useAuthStore((s) => s.token);
  const isConnected = useWsStore((s) => s.isConnected);

  // Manage singleton connection lifecycle
  useEffect(() => {
    if (!token || !enabled) return;

    const { ws } = useWsStore.getState();
    if (!ws || ws.readyState === WebSocket.CLOSED) {
      connectSingleton(token);
    }

    // No cleanup — singleton persists across component mounts/unmounts
    // Disconnect happens on logout (auth store clear)
  }, [token, enabled]);

  // Register/unregister message listener
  useEffect(() => {
    if (!onMessage) return;

    useWsStore.getState().addListener(onMessage);
    return () => {
      useWsStore.getState().removeListener(onMessage);
    };
  }, [onMessage]);

  const sendMessage = useCallback((data: Record<string, unknown>) => {
    const { ws } = useWsStore.getState();
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }, []);

  return { isConnected, sendMessage };
}

// Disconnect on logout
useAuthStore.subscribe((state, prev) => {
  if (prev.token && !state.token) {
    disconnectSingleton();
  }
});
