"use client";

import { useEffect, useRef } from "react";
import type { ActivityEvent } from "@/lib/types";

interface ActivityFeedProps {
  events: ActivityEvent[];
  maxHeight?: string;
}

const EVENT_TYPE_STYLES: Record<string, string> = {
  TEAM_APPROVED: "text-[#40e56c] bg-[#40e56c]/10",
  GAME_STARTED: "text-[#40e56c] bg-[#40e56c]/10",
  GAME_RESUMED: "text-[#40e56c] bg-[#40e56c]/10",
  TEAM_REJECTED: "text-[#FF1744] bg-[#FF1744]/10",
  TEAM_REMOVED: "text-[#FF1744] bg-[#FF1744]/10",
  GAME_PAUSED: "text-[#FF1744] bg-[#FF1744]/10",
  NEWS_INJECTED: "text-[#2196f3] bg-[#2196f3]/10",
  BROADCAST_SENT: "text-[#2196f3] bg-[#2196f3]/10",
  ROUND_ADVANCED: "text-[#9ecaff] bg-[#9ecaff]/10",
};

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "00:00:00";
  }
}

export function ActivityFeed({
  events,
  maxHeight = "calc(100vh - 200px)",
}: ActivityFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when events change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events]);

  if (events.length === 0) {
    return (
      <div
        className="bg-[#0e0e0e] font-mono text-sm flex items-center justify-center"
        style={{ maxHeight, minHeight: "200px" }}
      >
        <p className="text-gray-600">NO_EVENTS // AWAITING_ACTIVITY</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="bg-[#0e0e0e] font-mono text-sm overflow-y-auto"
      style={{ maxHeight }}
    >
      {events.map((event) => {
        const typeStyle =
          EVENT_TYPE_STYLES[event.event_type] || "text-gray-500 bg-gray-500/10";

        return (
          <div
            key={event.id}
            className="py-3 px-4 hover:bg-[#1c1b1b] transition-colors border-b border-[#1c1b1b] flex flex-col gap-1.5"
          >
            <div className="flex items-center gap-3">
              <span className="text-gray-600 text-xs font-mono shrink-0">
                {formatTimestamp(event.created_at)}
              </span>
              <span
                className={`text-xs font-mono px-2 py-0.5 uppercase shrink-0 ${typeStyle}`}
              >
                {event.event_type}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[#e5e2e1] text-sm">
                {event.description}
              </span>
              <span className="text-gray-600 text-xs shrink-0">
                {event.actor}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
