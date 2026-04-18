import { create } from "zustand";
import type {
  GameStatus,
  GameStatePayload,
  CrisisPayload,
  GamePhase,
} from "@/lib/types";

interface GameState {
  status: GameStatus;
  elapsedSeconds: number;
  // Wall-clock ms at the moment elapsedSeconds was last synced from the server.
  // Client-side `useLiveElapsed()` uses this to advance the displayed timer
  // every second instead of only when the server pushes a new game_state_changed.
  elapsedSyncedAtMs: number | null;
  currentRound: number;
  activeCrisis: CrisisPayload | null;
  teamStatus: string | null;
  gamePhase: GamePhase;
  macroBrief: string | null;

  setGameState: (payload: GameStatePayload) => void;
  setCrisis: (crisis: CrisisPayload) => void;
  clearCrisis: () => void;
  setTeamStatus: (status: string) => void;
  setGamePhase: (phase: GamePhase, macroBrief?: string | null) => void;
  reset: () => void;
}

export const useGameStore = create<GameState>()((set) => ({
  status: "SETUP",
  elapsedSeconds: 0,
  elapsedSyncedAtMs: null,
  currentRound: 0,
  activeCrisis: null,
  teamStatus: null,
  gamePhase: null,
  macroBrief: null,

  setGameState: (payload) =>
    set({
      status: payload.status,
      elapsedSeconds: payload.elapsed_seconds,
      elapsedSyncedAtMs: Date.now(),
      currentRound: payload.current_round,
    }),
  setCrisis: (crisis) => set({ activeCrisis: crisis }),
  clearCrisis: () => set({ activeCrisis: null }),
  setTeamStatus: (status) => set({ teamStatus: status }),
  setGamePhase: (phase, macroBrief) =>
    set({ gamePhase: phase, macroBrief: macroBrief ?? null }),
  reset: () =>
    set({
      status: "SETUP",
      elapsedSeconds: 0,
      elapsedSyncedAtMs: null,
      currentRound: 0,
      activeCrisis: null,
      teamStatus: null,
      gamePhase: null,
      macroBrief: null,
    }),
}));
