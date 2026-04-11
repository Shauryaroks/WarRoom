import { z } from "zod";

export const TeamStatusSchema = z.enum([
  "PENDING",
  "ACTIVE",
  "COOLDOWN",
  "BANKRUPT",
  "ELIMINATED",
]);
export type TeamStatus = z.infer<typeof TeamStatusSchema>;

export const PortfolioTypeSchema = z.enum([
  "Tech Startup",
  "Legacy Manufacturer",
  "D2C Disruptor",
  "Conglomerate",
]);
export type PortfolioType = z.infer<typeof PortfolioTypeSchema>;

export const SWOTProfileSchema = z.object({
  strengths: z.string(),
  weaknesses: z.string(),
  opportunities: z.string(),
  threats: z.string(),
});
export type SWOTProfile = z.infer<typeof SWOTProfileSchema>;

export const PortfolioSchema = z.object({
  id: z.string(),
  name: PortfolioTypeSchema,
  swot: SWOTProfileSchema,
});
export type Portfolio = z.infer<typeof PortfolioSchema>;

export const TeamSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(3).max(50),
  ticker: z.string().regex(/^\$[A-Z]{3,4}$/),
  apiKey: z.string().uuid().optional(),
  status: TeamStatusSchema,
  portfolioId: z.string().nullable(),
  swotProfile: SWOTProfileSchema.nullable(),
  cash: z.number().default(1000000),
  stockPrice: z.number().default(100),
  sharesOutstanding: z.number().default(1000000),
  publicFloat: z.number().default(100000),
  maxTreasurySalePct: z.number().default(10),
  cooldownUntil: z.string().datetime().nullable(),
  liquidity: z.number().optional(),
  marketCap: z.number().optional(),
  lastDirective: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Team = z.infer<typeof TeamSchema>;

export const ExtractionSchema = z.object({
  pricingStrategy: z.string().nullable(),
  pricingMagnitude: z.number().nullable(),
  marketingSpend: z.number().nullable(),
  rdSpend: z.number().nullable(),
  expansionGeographic: z.string().nullable(),
  treasuryAction: z
    .object({
      action: z.enum(["sell", "buy", "hold"]).nullable(),
      percentage: z.number().nullable(),
    })
    .nullable(),
  confidence: z.number().min(0).max(1),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

export const VibeScoresSchema = z.object({
  consistency: z.number().min(0).max(1),
  macroSensitivity: z.number().min(0).max(1),
  aggression: z.number().min(0).max(1),
  innovation: z.number().min(0).max(1),
});
export type VibeScores = z.infer<typeof VibeScoresSchema>;

export const FinancialImpactSchema = z.object({
  cashDelta: z.number(),
  revenueDelta: z.number(),
  cogsDelta: z.number(),
  marketingCost: z.number(),
  treasuryProceeds: z.number(),
  netProfitDelta: z.number(),
  explanation: z.string(),
});
export type FinancialImpact = z.infer<typeof FinancialImpactSchema>;

export const BoardFeedbackSchema = z.object({
  tone: z.enum(["supportive", "neutral", "skeptical", "critical"]),
  narrative: z.string(),
  headline: z.string().max(120),
});
export type BoardFeedback = z.infer<typeof BoardFeedbackSchema>;

export const DirectiveStatusSchema = z.enum([
  "PROCESSING",
  "COMPLETED",
  "FAILED",
]);
export type DirectiveStatus = z.infer<typeof DirectiveStatusSchema>;

export const DirectiveSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  rawMarkdown: z.string(),
  characterCount: z.number(),
  extractionConfidence: z.number().min(0).max(1).nullable(),
  vibeScores: VibeScoresSchema.nullable(),
  financialImpact: FinancialImpactSchema.nullable(),
  boardFeedback: BoardFeedbackSchema.nullable(),
  publicHeadline: z.string().max(120).nullable(),
  status: DirectiveStatusSchema,
  errorMessage: z.string().nullable(),
  processingTimeMs: z.number().nullable(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
});
export type Directive = z.infer<typeof DirectiveSchema>;

export const TransactionTypeSchema = z.enum([
  "MARKET_BUY",
  "MARKET_SELL",
  "TREASURY_SALE",
]);
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

export const TransactionSchema = z.object({
  id: z.string().uuid(),
  buyerTeamId: z.string().uuid().nullable(),
  sellerTeamId: z.string().uuid().nullable(),
  targetTeamId: z.string().uuid(),
  shares: z.number(),
  pricePerShare: z.number(),
  totalValue: z.number(),
  transactionType: TransactionTypeSchema,
  executedAt: z.string().datetime(),
});
export type Transaction = z.infer<typeof TransactionSchema>;

export const StockHoldingSchema = z.object({
  id: z.string().uuid(),
  ownerTeamId: z.string().uuid(),
  targetTeamId: z.string().uuid(),
  sharesOwned: z.number(),
  averageCostBasis: z.number(),
  updatedAt: z.string().datetime(),
});
export type StockHolding = z.infer<typeof StockHoldingSchema>;

export const NewsSourceTypeSchema = z.enum(["GLOBAL", "TEAM_ACTION", "SYSTEM"]);
export type NewsSourceType = z.infer<typeof NewsSourceTypeSchema>;

export const NewsItemSchema = z.object({
  id: z.string().uuid(),
  headline: z.string().max(120),
  content: z.string().nullable(),
  sourceType: NewsSourceTypeSchema,
  sourceTeamId: z.string().uuid().nullable(),
  metadata: z
    .object({
      ticker: z.string(),
      priceChange: z.number().optional(),
    })
    .optional(),
  createdAt: z.string().datetime(),
});
export type NewsItem = z.infer<typeof NewsItemSchema>;

export const MarketTickerSchema = z.object({
  ticker: z.string(),
  price: z.number(),
  changePct: z.number(),
  volume: z.number(),
});
export type MarketTicker = z.infer<typeof MarketTickerSchema>;

export const TeamFinancialsSchema = z.object({
  cash: z.number(),
  liquidity: z.number(),
  stockPrice: z.number(),
  marketCap: z.number(),
  holdings: z.array(
    z.object({
      ticker: z.string(),
      shares: z.number(),
      currentValue: z.number(),
    }),
  ),
});
export type TeamFinancials = z.infer<typeof TeamFinancialsSchema>;

export const LLMStatsSchema = z.object({
  totalRequests: z.number(),
  totalCostUsd: z.number(),
  avgLatencyMs: z.number(),
  errorRate: z.number(),
  byModel: z
    .array(
      z.object({
        model: z.string(),
        requests: z.number(),
        costUsd: z.number(),
        avgLatencyMs: z.number(),
      }),
    )
    .optional(),
});
export type LLMStats = z.infer<typeof LLMStatsSchema>;

export const MarketStatsSchema = z.object({
  totalTrades: z.number(),
  tradesLastHour: z.number(),
  volumeByTicker: z.record(z.string(), z.number()),
  anomalyAlerts: z
    .array(
      z.object({
        type: z.enum([
          "PRICE_DIVERGENCE",
          "RAPID_TRADING",
          "COLLUSION_PATTERN",
        ]),
        ticker: z.string(),
        description: z.string(),
      }),
    )
    .optional(),
});
export type MarketStats = z.infer<typeof MarketStatsSchema>;

export const AdminMetricsSchema = z.object({
  activeTeams: z.number(),
  totalTeams: z.number(),
  teamsByStatus: z.record(z.string(), z.number()),
  aggregateLiquidity: z.number(),
  avgMarketCap: z.number(),
  marketCapChange24h: z.number(),
  llmQueueDepth: z.number(),
  sessionCostUsd: z.number(),
});
export type AdminMetrics = z.infer<typeof AdminMetricsSchema>;

export const SectorHeatmapSchema = z.object({
  name: z.string(),
  change: z.number(),
});
export type SectorHeatmap = z.infer<typeof SectorHeatmapSchema>;

export const GameStateSchema = z.object({
  status: z.enum(["SETUP", "ACTIVE", "PAUSED", "ENDED"]),
  sessionStartTime: z.string().datetime().nullable(),
  nextPurgeTime: z.string().datetime().nullable(),
  currentPhase: z.string().nullable(),
  survivingTeams: z.number().optional(),
});
export type GameState = z.infer<typeof GameStateSchema>;

export const RegisterRequestSchema = z.object({
  teamName: z.string().min(3).max(50),
  ticker: z.string().regex(/^[A-Z]{3,4}$/),
  email: z.string().email(),
  password: z.string().min(8),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const DirectiveSubmitRequestSchema = z.object({
  directiveMarkdown: z.string().max(2000),
  playerConfidenceRating: z.number().min(0).max(1).optional(),
});
export type DirectiveSubmitRequest = z.infer<
  typeof DirectiveSubmitRequestSchema
>;

export const TradeRequestSchema = z.object({
  action: z.enum(["buy", "sell"]),
  targetTicker: z.string(),
  shares: z.number().positive(),
});
export type TradeRequest = z.infer<typeof TradeRequestSchema>;

export const NewsInjectRequestSchema = z.object({
  headline: z.string().max(120),
  impact: z.enum(["bullish", "bearish"]),
});
export type NewsInjectRequest = z.infer<typeof NewsInjectRequestSchema>;

export const PurgeRequestSchema = z.object({
  confirmText: z.literal("PURGE"),
});
export type PurgeRequest = z.infer<typeof PurgeRequestSchema>;
