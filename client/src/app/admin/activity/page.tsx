"use client";

import { useEffect, useCallback } from "react";
import { useAdminStore } from "@/stores/admin-store";
import { useAuthStore } from "@/stores/auth-store";
import { useWebSocket } from "@/hooks/use-websocket";
import { api } from "@/lib/api";
import { ActivityFeed } from "@/components/admin/activity-feed";

function mapWsTypeToEventType(wsType: string): string {
  const mapping: Record<string, string> = {
    team_removed: "TEAM_REMOVED",
    news_injected: "NEWS_INJECTED",
    round_advanced: "ROUND_ADVANCED",
    game_started: "GAME_STARTED",
    broadcast_sent: "BROADCAST_SENT",
  };
  return mapping[wsType] || wsType.toUpperCase();
}

function deriveDescription(data: Record<string, unknown>): string {
  const payload = data.payload as Record<string, unknown> | undefined;

  switch (data.type) {
    case "team_removed":
      return `Team removed: ${payload?.team_id || "unknown"}`;
    case "news_injected":
      return `News injected: ${payload?.headline || "untitled"}`;
    case "round_advanced":
      return `Round advanced to Q${payload?.current_round || "?"}`;
    case "game_started":
      return "Game started";
    case "game_state_changed": {
      const status = payload?.status as string | undefined;
      if (status === "PAUSED") return "Game paused";
      if (status === "ACTIVE") return "Game resumed";
      if (status === "FINISHED") return "Game finished";
      return `Game state changed to ${status || "unknown"}`;
    }
    case "broadcast_sent":
      return `Broadcast sent: ${payload?.message || ""}`;
    default:
      return `Event: ${String(data.type)}`;
  }
}

export default function ActivityPage() {
  const { activityLog, setActivityLog, addActivity } = useAdminStore();
  const { isAuthenticated, role } = useAuthStore();

  // Load activity log on mount
  useEffect(() => {
    api
      .getActivityLog()
      .then((events) => setActivityLog(events))
      .catch(() => {});
  }, [setActivityLog]);

  // Handle WebSocket messages for real-time updates
  const handleMessage = useCallback(
    (data: Record<string, unknown>) => {
      const relevantTypes = [
        "team_removed",
        "news_injected",
        "round_advanced",
        "game_started",
        "game_state_changed",
        "broadcast_sent",
      ];

      if (relevantTypes.includes(data.type as string)) {
        addActivity({
          id: crypto.randomUUID(),
          event_type: mapWsTypeToEventType(data.type as string),
          actor: "admin",
          description: deriveDescription(data),
          metadata_json: null,
          created_at: new Date().toISOString(),
        });
      }
    },
    [addActivity],
  );

  useWebSocket({
    onMessage: handleMessage,
    enabled: isAuthenticated && role === "admin",
  });

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-black font-mono tracking-widest text-[#9ecaff] uppercase">
          ACTIVITY_LOG
        </h2>
        <span className="text-sm font-mono text-gray-500">
          {activityLog.length} EVENT{activityLog.length !== 1 ? "S" : ""}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-mono text-gray-500">
          REAL_TIME_EVENT_FEED
        </span>
        <span className="w-2 h-2 bg-[#40e56c] animate-pulse" />
      </div>

      <ActivityFeed events={activityLog} />
    </div>
  );
}
