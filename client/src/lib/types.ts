export type UserRole = "strategist" | "trader" | "admin";

export interface RegisterResponse {
  message: string;
  team_id: string;
}

export interface LoginResponse {
  token: string;
  team_id: string;
  team_name: string;
  ticker: string;
  role: UserRole;
}

export interface AdminLoginResponse {
  token: string;
  role: "admin";
}

export interface MeResponse {
  team_id: string;
  team_name: string;
  ticker: string;
  role: UserRole;
  status: string;
}

export interface ApprovedTeam {
  id: string;
  name: string;
  ticker: string;
}

export interface ApiError {
  detail: string;
}

export type GameStatus = "SETUP" | "ACTIVE" | "PAUSED" | "FINISHED";

export interface GameStatePayload {
  status: GameStatus;
  elapsed_seconds: number;
  current_round: number;
}

export interface GameStateResponse {
  status: string;
  elapsed_seconds: number;
  current_round: number;
}

export interface AdminTeam {
  id: string;
  name: string;
  ticker: string;
  status: string;
  strategist_email: string;
  trader_email: string;
  created_at: string;
  archetype_id: string | null;
  archetype_name: string | null;
}

export interface NewsItem {
  id: string;
  headline: string;
  content: string | null;
  source_type: string;
  news_type?: string;
  affected_tickers: string[];
  created_at: string;
}

export interface ActivityEvent {
  id: string;
  event_type: string;
  actor: string;
  description: string;
  metadata_json: string | null;
  created_at: string;
}

export interface TeamRemoveResponse {
  message: string;
  team_id: string;
  remove_type: string;
}

export interface NewsInjectResponse {
  message: string;
  news_id: string;
}

export interface BroadcastResponse {
  message: string;
  news_id: string;
}

export interface RoundAdvanceResponse {
  message: string;
  current_round: number;
}

// === Market & Trading Types (Phase 4) ===

// WebSocket message: price_update
export interface PriceTickData {
  team_id: string;
  ticker: string;
  price: string;
  change_pct: string;
  market_cap: string;
  timestamp: string;
}

export interface PriceUpdateMessage {
  type: "price_update";
  payload: { prices: PriceTickData[] };
}

// WebSocket message: trade_executed
export interface TradeExecutedMessage {
  type: "trade_executed";
  payload: {
    buyer_team_id: string;
    target_ticker: string;
    shares: number;
    price_per_share: string;
    total_value: string;
    transaction_type: "BUY" | "SELL";
  };
}

// Candlestick data for lightweight-charts
export interface CandleData {
  time: number; // Unix seconds (5-min bucket start)
  open: number;
  high: number;
  low: number;
  close: number;
}

// REST: GET /api/v1/market/companies
export interface CompanyInfo {
  team_id: string;
  name: string;
  ticker: string;
  stock_price: string;
  market_cap: string;
  change_pct: string;
}

// REST: GET /api/v1/market/prices/{team_id}
export interface PriceHistoryPoint {
  price: string;
  market_cap: string;
  calculated_at: string;
}

// REST: POST /api/v1/trading/preview
export interface TradePreviewRequest {
  target_team_id: string;
  shares: number;
  trade_type: "BUY" | "SELL";
}

export interface TradePreview {
  target_ticker: string;
  shares: number;
  price_per_share: string;
  total_cost: string;
  available_cash: string;
  shares_available: number;
  current_holding: number;
}

// REST: POST /api/v1/trading/buy or /sell
export interface TradeRequest {
  target_team_id: string;
  shares: number;
}

export interface TradeResult {
  transaction_id: string;
  message: string;
  new_cash_balance: string;
  shares_owned: number;
}

// REST: GET /api/v1/trading/portfolio
export interface HoldingDetail {
  target_team_id: string;
  ticker: string;
  shares_owned: number;
  avg_buy_price: string;
  current_price: string;
  market_value: string;
  pnl: string;
  pnl_pct: string;
  ownership_pct: string;
}

export interface PortfolioResponse {
  cash: string;
  holdings: HoldingDetail[];
  total_holdings_value: string;
  net_worth: string;
}

// === Solution & Evaluation Types (Phase 5) ===

export interface SolutionResponse {
  id: string;
  content: string;
  solution_type: "INITIAL" | "MICROTWEAK";
  created_at: string;
  evaluation_status: string | null;
}

export interface CooldownResponse {
  cooldown_active: boolean;
  cooldown_until: string | null;
  seconds_remaining: number;
}

export interface CaselineResponse {
  caseline_document: string | null;
  company_display_name: string | null;
  archetype_name: string | null;
  archetype_slug: string | null;
  sector: string | null;
  benchmark_bands: string | null;
  swot_strengths: string | null;
  swot_weaknesses: string | null;
  swot_opportunities: string | null;
  swot_threats: string | null;
}

export interface EvaluationListItem {
  id: string;
  team_id: string;
  team_name: string;
  team_ticker: string;
  solution_type: string;
  status: string;
  overall_score: number | null;
  scoring_metrics: string | null;
  news_headline: string | null;
  news_body: string | null;
  news_sentiment: number | null;
  price_timeline: string | null;
  llm_model: string | null;
  admin_notes: string | null;
  created_at: string;
}

export interface EvaluationActionResponse {
  message: string;
  evaluation_id: string;
}

export interface CaselineAssignResponse {
  message: string;
  team_id: string;
}

// === Phase 6: Crisis, Elimination, Leaderboard ===

export interface CrisisPayload {
  crisis_id: string;
  scenario: string;
  timer_seconds: number;
  started_at: string;
}

export interface CrisisResolvedPayload {
  crisis_id: string;
}

export interface TeamEliminatedPayload {
  team_id: string;
  ticker: string;
  rank: number;
}

export interface LeaderboardEntry {
  rank: number;
  team_id: string;
  name: string;
  ticker: string;
  stock_price: string;
  change_pct: string;
  status: string;
}

// === Phase 7: Archetype Types ===

export interface ArchetypeResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sector: string;
  dossier_content: string;
  benchmark_bands: string; // JSON
  starting_cash: string;
  starting_stock_price: string;
  starting_shares: number;
  swot_strengths: string | null;
  swot_weaknesses: string | null;
  swot_opportunities: string | null;
  swot_threats: string | null;
  real_world_inspiration: string | null;
  is_preset: boolean;
  created_at: string;
}

export interface ArchetypeAssignResponse {
  message: string;
  team_id: string;
  archetype_name: string;
}

export interface ArchetypeSeedResponse {
  message: string;
  created: string[];
  skipped: string[];
}

// Parsed benchmark bands for display
export interface BenchmarkBands {
  market_share: [number, number];
  margin: [number, number];
  growth: [number, number];
  ops_efficiency: [number, number];
}
