import { create } from "zustand";
import type { CandleData, CompanyInfo } from "@/lib/types";

interface CurrentPrice {
  price: string;
  change_pct: string;
  market_cap: string;
}

interface MarketState {
  companies: CompanyInfo[];
  selectedCompanyId: string | null;
  candles: Record<string, CandleData[]>;
  currentPrices: Record<string, CurrentPrice>;
  selectCompany: (teamId: string) => void;
  setCompanies: (companies: CompanyInfo[]) => void;
  setCandles: (teamId: string, candles: CandleData[]) => void;
  addCandle: (teamId: string, candle: CandleData) => void;
  updateCurrentPrice: (teamId: string, price: CurrentPrice) => void;
}

export const useMarketStore = create<MarketState>((set, get) => ({
  companies: [],
  selectedCompanyId: null,
  candles: {},
  currentPrices: {},

  selectCompany: (teamId: string) => {
    set({ selectedCompanyId: teamId });
  },

  setCompanies: (companies: CompanyInfo[]) => {
    const state = get();
    set({
      companies,
      selectedCompanyId:
        state.selectedCompanyId ?? (companies.length > 0 ? companies[0].team_id : null),
    });
  },

  setCandles: (teamId: string, candles: CandleData[]) => {
    set((state) => ({
      candles: { ...state.candles, [teamId]: candles },
    }));
  },

  addCandle: (teamId: string, candle: CandleData) => {
    set((state) => {
      const existing = state.candles[teamId] ?? [];
      const lastIdx = existing.length - 1;
      // If same time bucket, update the last candle; otherwise append
      if (lastIdx >= 0 && existing[lastIdx].time === candle.time) {
        const updated = [...existing];
        updated[lastIdx] = candle;
        return { candles: { ...state.candles, [teamId]: updated } };
      }
      return { candles: { ...state.candles, [teamId]: [...existing, candle] } };
    });
  },

  updateCurrentPrice: (teamId: string, price: CurrentPrice) => {
    set((state) => ({
      currentPrices: { ...state.currentPrices, [teamId]: price },
    }));
  },
}));
