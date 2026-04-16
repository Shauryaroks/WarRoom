import { create } from "zustand";
import type { GameStatus, GameStatePayload } from "@/lib/types";

interface GameState {
  status: GameStatus;
  elapsedSeconds: number;
  currentRound: number;

  setGameState: (payload: GameStatePayload) => void;
  reset: () => void;
}

export const useGameStore = create<GameState>()((set) => ({
  status: "SETUP",
  elapsedSeconds: 0,
  currentRound: 0,

  setGameState: (payload) =>
    set({
      status: payload.status,
      elapsedSeconds: payload.elapsed_seconds,
      currentRound: payload.current_round,
    }),
  reset: () =>
    set({
      status: "SETUP",
      elapsedSeconds: 0,
      currentRound: 0,
    }),
}));
