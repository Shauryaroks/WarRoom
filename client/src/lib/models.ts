import { z } from "zod";

export const TeamStatusSchema = z.enum([
  "PENDING",
  "READY",
  "REJECTED",
  "PENDING_START",
  "PENDING_PURGE",
  "ACTIVE",
  "COOLDOWN",
  "BANKRUPT",
  "ELIMINATED",
]);
export type TeamStatus = z.infer<typeof TeamStatusSchema>;

export const SWOTProfileSchema = z.object({
  strengths: z.string(),
  weaknesses: z.string(),
  opportunities: z.string(),
  threats: z.string(),
});
export type SWOTProfile = z.infer<typeof SWOTProfileSchema>;

export const TeamProfileSchema = z.object({
  team_id: z.string().uuid(),
  name: z.string(),
  ticker: z.string(),
  status: TeamStatusSchema,
  swot: SWOTProfileSchema.optional(),
  portfolio_id: z.string().optional(),
});
export type TeamProfile = z.infer<typeof TeamProfileSchema>;

export const TeamFinancialsSchema = z.object({
  cash: z.number(),
  stock_price: z.number(),
  market_cap: z.number(),
  liquidity: z.number(),
  treasury_sale_limit_remaining: z.number(),
});
export type TeamFinancials = z.infer<typeof TeamFinancialsSchema>;

export const StockHoldingSchema = z.object({
  ticker: z.string(),
  shares: z.number(),
  current_price: z.number(),
  current_value: z.number(),
  cost_basis: z.number(),
  unrealized_pnl: z.number(),
  ownership_percentage: z.number(),
});
export type StockHolding = z.infer<typeof StockHoldingSchema>;

export const PortfolioSchema = z.object({
  holdings: z.array(StockHoldingSchema),
  total_portfolio_value: z.number(),
  total_unrealized_pnl: z.number(),
});
export type Portfolio = z.infer<typeof PortfolioSchema>;

export const DirectiveSummarySchema = z.object({
  id: z.string().uuid(),
  headline: z.string(),
  feedback: z.string(),
  submitted_at: z.string(),
  status: z.enum(["PROCESSING", "COMPLETED", "FAILED"]),
});
export type DirectiveSummary = z.infer<typeof DirectiveSummarySchema>;

export const CooldownStatusSchema = z.object({
  active: z.boolean(),
  started_at: z.string().optional(),
  ends_at: z.string().optional(),
  seconds_remaining: z.number().optional(),
});
export type CooldownStatus = z.infer<typeof CooldownStatusSchema>;

export const TeamDossierSchema = z.object({
  profile: TeamProfileSchema,
  financials: TeamFinancialsSchema,
  portfolio: PortfolioSchema,
  last_directive: DirectiveSummarySchema.optional(),
  cooldown_status: CooldownStatusSchema,
});
export type TeamDossier = z.infer<typeof TeamDossierSchema>;

export const DirectiveWithFeedbackSchema = DirectiveSummarySchema.extend({
  raw_markdown: z.string().optional(),
  character_count: z.number().optional(),
  extraction_confidence: z.number().optional(),
  vibe_scores: z
    .object({
      consistency: z.number(),
      macro_sensitivity: z.number(),
      aggression: z.number(),
      innovation: z.number(),
    })
    .optional(),
  financial_impact: z
    .object({
      cash_delta: z.number(),
      revenue_delta: z.number(),
      net_profit_impact: z.number(),
    })
    .optional(),
});
export type DirectiveWithFeedback = z.infer<typeof DirectiveWithFeedbackSchema>;

export const TeamSummarySchema = z.object({
  team_id: z.string().uuid(),
  name: z.string(),
  ticker: z.string(),
  status: TeamStatusSchema,
  stock_price: z.number(),
  market_cap: z.number(),
  portfolio_id: z.string(),
  eliminated_at: z.string().nullable().optional(),
  rank_at_elimination: z.number().nullable().optional(),
});
export type TeamSummary = z.infer<typeof TeamSummarySchema>;

export const OrderSchema = z.object({
  id: z.string().uuid(),
  side: z.enum(["BUY", "SELL"]),
  target_ticker: z.string(),
  shares: z.number(),
  shares_filled: z.number(),
  price_per_share: z.number().nullable(),
  status: z.enum(["PENDING", "PARTIAL", "FILLED", "CANCELLED", "FAILED"]),
  failure_reason: z.string().nullable().optional(),
  total_value: z.number().nullable(),
  created_at: z.string(),
  executed_at: z.string().nullable().optional(),
});
export type Order = z.infer<typeof OrderSchema>;

export const TickerSnapshotSchema = z.object({
  ticker: z.string(),
  price: z.number(),
  change_24h: z.number(),
  change_absolute: z.number(),
  volume_24h: z.number(),
  market_cap: z.number(),
  status: z.enum(["ACTIVE", "COOLDOWN", "HALTED", "ELIMINATED"]),
});
export type TickerSnapshot = z.infer<typeof TickerSnapshotSchema>;

export const NewsItemSchema = z.object({
  id: z.string().uuid(),
  headline: z.string(),
  content: z.string().nullable().optional(),
  source_type: z.enum(["GLOBAL", "TEAM_ACTION", "SYSTEM", "ADMIN_INJECTED"]),
  source_ticker: z.string().nullable().optional(),
  sentiment_score: z.number().nullable().optional(),
  affected_sectors: z.array(z.string()).optional(),
  affected_tickers: z.array(z.string()).optional(),
  created_at: z.string(),
  relevance_decay: z.number().optional(),
});
export type NewsItem = z.infer<typeof NewsItemSchema>;

export const GameStateSchema = z.object({
  status: z.enum(["SETUP", "ACTIVE", "PAUSED", "FINISHED"]),
  server_time: z.string(),
  started_at: z.string().nullable().optional(),
  elapsed_seconds: z.number().optional(),
  next_purge_at: z.string().nullable().optional(),
  current_round: z.number().optional(),
  teams_remaining: z.number().optional(),
  total_llm_cost_usd: z.number().optional(),
  llm_queue_depth: z.number().optional(),
});
export type GameState = z.infer<typeof GameStateSchema>;

export const AdminMetricsSchema = z.object({
  active_teams: z.number(),
  total_teams: z.number(),
  teams_by_status: z.record(z.string(), z.number()),
  aggregate_liquidity: z.number(),
  avg_market_cap: z.number(),
  market_cap_change_24h: z.number(),
  llm_queue_depth: z.number(),
  session_cost_usd: z.number(),
});
export type AdminMetrics = z.infer<typeof AdminMetricsSchema>;

export const LLMStatsSchema = z.object({
  total_requests: z.number(),
  total_cost_usd: z.number(),
  avg_latency_ms: z.number(),
  error_rate: z.number(),
  by_model: z
    .array(
      z.object({
        model: z.string(),
        requests: z.number(),
        cost_usd: z.number(),
        avg_latency_ms: z.number(),
      }),
    )
    .optional(),
});
export type LLMStats = z.infer<typeof LLMStatsSchema>;

export const MarketStatsSchema = z.object({
  total_trades: z.number(),
  trades_last_hour: z.number(),
  volume_by_ticker: z.record(z.string(), z.number()),
  anomaly_alerts: z
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

export const OrderResponseSchema = z.object({
  order_id: z.string(),
  status: z.string(),
  filled_shares: z.number(),
  remaining_shares: z.number(),
  execution_price: z.number(),
  total_value: z.number(),
  updated_cash: z.number(),
  updated_holdings: z.array(z.any()), // We can leave it loosely typed for now
});
export type OrderResponse = z.infer<typeof OrderResponseSchema>;

export const SubmitDirectiveResponseSchema = z.object({
  submission_id: z.string(),
  status: z.string(),
  cooldown_until: z.string(),
  seconds_remaining: z.number(),
  message: z.string(),
});
export type SubmitDirectiveResponse = z.infer<
  typeof SubmitDirectiveResponseSchema
>;

export const PurgeResponseSchema = z.object({
  purge_id: z.string().optional(),
  status: z.string(),
  eliminated_teams: z.array(z.string()).optional(),
  surviving_teams: z.number().optional(),
  new_treasury_limits: z.number().optional(),
});
export type PurgeResponse = z.infer<typeof PurgeResponseSchema>;
