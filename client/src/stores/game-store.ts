import { create } from "zustand";
import type { GameStatus, GameStatePayload, CrisisPayload } from "@/lib/types";

interface GameState {
  status: GameStatus;
  elapsedSeconds: number;
  currentRound: number;
  activeCrisis: CrisisPayload | null;
  teamStatus: string | null;

  setGameState: (payload: GameStatePayload) => void;
  setCrisis: (crisis: CrisisPayload) => void;
  clearCrisis: () => void;
  setTeamStatus: (status: string) => void;
  reset: () => void;
}

export const useGameStore = create<GameState>()((set) => ({
  status: "SETUP",
  elapsedSeconds: 0,
  currentRound: 0,
  activeCrisis: null,
  teamStatus: null,

  setGameState: (payload) =>
    set({
      status: payload.status,
      elapsedSeconds: payload.elapsed_seconds,
      currentRound: payload.current_round,
    }),
  setCrisis: (crisis) => set({ activeCrisis: crisis }),
  clearCrisis: () => set({ activeCrisis: null }),
  setTeamStatus: (status) => set({ teamStatus: status }),
  reset: () =>
    set({
      status: "SETUP",
      elapsedSeconds: 0,
      currentRound: 0,
      activeCrisis: null,
      teamStatus: null,
    }),
}));
