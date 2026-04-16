import { create } from "zustand";
import type { SolutionResponse, CooldownResponse } from "@/lib/types";
import { api } from "@/lib/api";

interface SolutionsState {
  solutions: SolutionResponse[];
  cooldown: CooldownResponse | null;
  isSubmitting: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchSolutions: () => Promise<void>;
  fetchCooldown: () => Promise<void>;
  submitSolution: (
    content: string,
    solutionType: "INITIAL" | "MICROTWEAK"
  ) => Promise<void>;
  clearError: () => void;
}

export const useSolutionsStore = create<SolutionsState>()((set, get) => ({
  solutions: [],
  cooldown: null,
  isSubmitting: false,
  isLoading: false,
  error: null,

  fetchSolutions: async () => {
    set({ isLoading: true });
    try {
      const solutions = await api.getMySolutions();
      set({ solutions, isLoading: false });
    } catch (err) {
      set({
        error:
          err instanceof Error ? err.message : "Failed to load solutions",
        isLoading: false,
      });
    }
  },

  fetchCooldown: async () => {
    try {
      const cooldown = await api.getCooldown();
      set({ cooldown });
    } catch {
      // Silent fail -- cooldown display is non-critical
    }
  },

  submitSolution: async (content, solutionType) => {
    set({ isSubmitting: true, error: null });
    try {
      await api.submitSolution({ content, solution_type: solutionType });
      // Refresh solutions list and cooldown after submit
      await get().fetchSolutions();
      await get().fetchCooldown();
      set({ isSubmitting: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Submission failed",
        isSubmitting: false,
      });
      throw err; // Re-throw so UI can handle
    }
  },

  clearError: () => set({ error: null }),
}));
