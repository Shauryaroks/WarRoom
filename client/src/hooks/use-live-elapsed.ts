"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/stores/game-store";

/**
 * Live-ticking elapsed seconds for the game timer display.
 *
 * The server pushes elapsed_seconds only on game_state_changed events (start,
 * pause, resume, etc.) — not every second. Without a client-side tick, the
 * header would freeze between syncs. This hook:
 *
 * - While status === "ACTIVE": returns elapsedSeconds + floor((now - syncedAt) / 1000),
 *   re-rendering every 1s via setInterval.
 * - Otherwise (PAUSED / FINISHED / SETUP): returns the frozen elapsedSeconds
 *   straight from the store with no interval, no re-render cost.
 *
 * Server remains the source of truth — on every game_state_changed broadcast,
 * elapsedSeconds + elapsedSyncedAtMs get refreshed in the store and this hook
 * snaps back to the canonical value.
 */
export function useLiveElapsed(): number {
  const status = useGameStore((s) => s.status);
  const elapsedSeconds = useGameStore((s) => s.elapsedSeconds);
  const elapsedSyncedAtMs = useGameStore((s) => s.elapsedSyncedAtMs);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status !== "ACTIVE") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [status]);

  if (status !== "ACTIVE" || elapsedSyncedAtMs == null) {
    return elapsedSeconds;
  }
  return elapsedSeconds + Math.max(0, Math.floor((now - elapsedSyncedAtMs) / 1000));
}
