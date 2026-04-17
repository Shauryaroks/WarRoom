import { create } from "zustand";
import type { BudgetResponse, DecisionResponse } from "@/lib/types";

interface DecisionsState {
  budget: BudgetResponse | null;
  currentDecisions: DecisionResponse[];
  isSubmitting: boolean;
  lastSubmittedAt: string | null;

  setBudget: (b: BudgetResponse) => void;
  setCurrentDecisions: (d: DecisionResponse[]) => void;
  setSubmitting: (v: boolean) => void;
  setLastSubmitted: (at: string) => void;
  reset: () => void;
}

export const useDecisionsStore = create<DecisionsState>()((set) => ({
  budget: null,
  currentDecisions: [],
  isSubmitting: false,
  lastSubmittedAt: null,

  setBudget: (b) => set({ budget: b }),
  setCurrentDecisions: (d) => set({ currentDecisions: d }),
  setSubmitting: (v) => set({ isSubmitting: v }),
  setLastSubmitted: (at) => set({ lastSubmittedAt: at }),
  reset: () =>
    set({
      budget: null,
      currentDecisions: [],
      isSubmitting: false,
      lastSubmittedAt: null,
    }),
}));
