import { create } from "zustand";
import type { HoldingDetail, PortfolioResponse } from "@/lib/types";

interface PendingTrade {
  targetTeamId: string;
  targetTicker: string;
  shares: number;
  pricePerShare: string;
  totalCost: string;
  tradeType: "BUY" | "SELL";
}

interface TradingState {
  // Portfolio
  cash: string;
  holdings: HoldingDetail[];
  totalHoldingsValue: string;
  netWorth: string;

  // Trade confirmation flow (per D-06)
  pendingTrade: PendingTrade | null;

  // Loading states
  isLoadingPortfolio: boolean;
  isExecutingTrade: boolean;
  tradeError: string | null;

  // Actions
  setPortfolio: (data: PortfolioResponse) => void;
  setPendingTrade: (trade: PendingTrade | null) => void;
  clearPendingTrade: () => void;
  setTradeError: (error: string | null) => void;
  setLoadingPortfolio: (loading: boolean) => void;
  setExecutingTrade: (loading: boolean) => void;
  updateCashBalance: (newBalance: string) => void;
  reset: () => void;
}

const initialState = {
  cash: "0",
  holdings: [] as HoldingDetail[],
  totalHoldingsValue: "0",
  netWorth: "0",
  pendingTrade: null as PendingTrade | null,
  isLoadingPortfolio: false,
  isExecutingTrade: false,
  tradeError: null as string | null,
};

export const useTradingStore = create<TradingState>()((set) => ({
  ...initialState,

  setPortfolio: (data) =>
    set({
      cash: data.cash,
      holdings: data.holdings,
      totalHoldingsValue: data.total_holdings_value,
      netWorth: data.net_worth,
    }),

  setPendingTrade: (trade) => set({ pendingTrade: trade, tradeError: null }),

  clearPendingTrade: () => set({ pendingTrade: null, tradeError: null }),

  setTradeError: (error) => set({ tradeError: error }),

  setLoadingPortfolio: (loading) => set({ isLoadingPortfolio: loading }),

  setExecutingTrade: (loading) => set({ isExecutingTrade: loading }),

  updateCashBalance: (newBalance) => set({ cash: newBalance }),

  reset: () => set(initialState),
}));
