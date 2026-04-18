import { create } from "zustand";
import type {
  CompanyInfo,
  CandleData,
  PriceTickData,
  PriceHistoryPoint,
} from "@/lib/types";

const CANDLE_INTERVAL = 60; // 1 minute bucket. Pairs with the 15s server tick
// (4 ticks per bucket) so each candle has a real OHLC body instead of rendering
// as a flat doji bar.

interface PriceTick {
  price: number;
  timestamp: number; // Unix seconds
}

interface CurrentPrice {
  price: string;
  change_pct: string;
  market_cap: string;
}

interface MarketState {
  // Company list
  companies: CompanyInfo[];
  selectedCompanyId: string | null;

  // Raw price ticks per company (for candle aggregation)
  priceTicks: Record<string, PriceTick[]>;

  // Aggregated 5-min candles per company
  candles: Record<string, CandleData[]>;

  // Current prices (latest from WebSocket)
  currentPrices: Record<string, CurrentPrice>;

  // Actions
  setCompanies: (companies: CompanyInfo[]) => void;
  selectCompany: (teamId: string) => void;
  handlePriceUpdate: (prices: PriceTickData[]) => void;
  loadPriceHistory: (teamId: string, history: PriceHistoryPoint[]) => void;
  reset: () => void;
}

function aggregateToCandles(ticks: PriceTick[]): CandleData[] {
  if (ticks.length === 0) return [];

  const buckets = new Map<number, PriceTick[]>();

  for (const tick of ticks) {
    const bucket =
      Math.floor(tick.timestamp / CANDLE_INTERVAL) * CANDLE_INTERVAL;
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket)!.push(tick);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([bucketTime, bucketTicks]) => {
      const prices = bucketTicks.map((t) => t.price);
      return {
        time: bucketTime,
        open: prices[0],
        high: Math.max(...prices),
        low: Math.min(...prices),
        close: prices[prices.length - 1],
      };
    });
}

const initialState = {
  companies: [] as CompanyInfo[],
  selectedCompanyId: null as string | null,
  priceTicks: {} as Record<string, PriceTick[]>,
  candles: {} as Record<string, CandleData[]>,
  currentPrices: {} as Record<string, CurrentPrice>,
};

export const useMarketStore = create<MarketState>()((set) => ({
  ...initialState,

  setCompanies: (companies) => set({ companies }),

  selectCompany: (teamId) => set({ selectedCompanyId: teamId }),

  handlePriceUpdate: (prices) =>
    set((state) => {
      const newPriceTicks = { ...state.priceTicks };
      const newCandles = { ...state.candles };
      const newCurrentPrices = { ...state.currentPrices };

      for (const priceData of prices) {
        const teamId = priceData.team_id;
        const tick: PriceTick = {
          price: parseFloat(priceData.price),
          timestamp: Math.floor(new Date(priceData.timestamp).getTime() / 1000),
        };

        // Append tick
        const existing = newPriceTicks[teamId] || [];
        newPriceTicks[teamId] = [...existing, tick];

        // Re-aggregate candles for this team
        newCandles[teamId] = aggregateToCandles(newPriceTicks[teamId]);

        // Update current price
        newCurrentPrices[teamId] = {
          price: priceData.price,
          change_pct: priceData.change_pct,
          market_cap: priceData.market_cap,
        };
      }

      return {
        priceTicks: newPriceTicks,
        candles: newCandles,
        currentPrices: newCurrentPrices,
      };
    }),

  loadPriceHistory: (teamId, history) =>
    set((state) => {
      // Convert REST history to ticks (oldest first)
      const ticks: PriceTick[] = history
        .map((point) => ({
          price: parseFloat(point.price),
          timestamp: Math.floor(new Date(point.calculated_at).getTime() / 1000),
        }))
        .sort((a, b) => a.timestamp - b.timestamp);

      const newPriceTicks = { ...state.priceTicks, [teamId]: ticks };
      const newCandles = {
        ...state.candles,
        [teamId]: aggregateToCandles(ticks),
      };

      return { priceTicks: newPriceTicks, candles: newCandles };
    }),

  reset: () => set(initialState),
}));
