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

export type BCGClassification = "STAR" | "CASH_COW" | "QUESTION_MARK" | "DOG";

export interface MeResponse {
  team_id: string;
  team_name: string;
  ticker: string;
  role: UserRole;
  status: string;
  bcg_classification?: BCGClassification | null;
}

export interface ApprovedTeam {
  id: string;
  name: string;
  ticker: string;
  bcg_classification?: BCGClassification | null;
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
  bcg_classification?: BCGClassification | null;
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
  solution_content: string | null;
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
  bcg_classification?: BCGClassification | null;
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

// === Phase 8: Decision Levers & Round Structure ===

export type GamePhase = "war_room" | "live_floor" | null;

export type LeverCategory = "MARKETING" | "SUPPLY_CHAIN" | "NEW_PRODUCT";

export interface MarketingDecision {
  atl_pct: number;
  digital_pct: number;
  influencer_pct: number;
  btl_pct: number;
  campaign_theme: "VALUE" | "PREMIUM" | "HEALTH" | "PATRIOTISM" | "NOSTALGIA";
}

export interface SupplyChainDecision {
  inventory_policy: "LEAN" | "BALANCED" | "STOCKED";
  distribution_expansion: ("TIER1" | "TIER2" | "RURAL")[];
  capacity_utilization: number; // 60 to 100
}

export interface NewProductDecision {
  launch_sku: boolean;
  sku_description?: string;
  target_category?: string;
}

export type DecisionPayload =
  | MarketingDecision
  | SupplyChainDecision
  | NewProductDecision;

export interface DecisionSubmitItem {
  lever_category: LeverCategory;
  decisions_json: DecisionPayload;
  budget_spent: number;
}

export interface BulkDecisionSubmitRequest {
  decisions: DecisionSubmitItem[];
}

export interface DecisionResponse {
  id: string;
  lever_category: LeverCategory;
  decisions_json: string; // JSON string
  budget_spent: string;
  submitted_at: string;
}

export interface BudgetResponse {
  total_budget: string;
  allocated: string;
  remaining: string;
  multiplier: number;
}

export interface GamePhaseResponse {
  game_phase: GamePhase;
  macro_brief: string | null;
  current_round: number;
}

export interface OperatingPlanResponse {
  id: string;
  content: string;
  submitted_at: string;
}

export interface GamePhaseChangedPayload {
  game_phase: GamePhase;
  macro_brief: string | null;
  current_round: number;
}

// === Phase 9: Fundamentals ===

export interface FundamentalDeltas {
  market_share_delta: number;
  margin_delta: number;
  growth_delta: number;
  ops_efficiency_delta: number;
}

export interface FundamentalEvalListItem {
  id: string;
  team_id: string;
  ticker: string;
  team_name: string;
  round_number: number;
  status:
    | "PROCESSING"
    | "PENDING_APPROVAL"
    | "APPROVED"
    | "REJECTED"
    | "FAILED";
  proposed_deltas: FundamentalDeltas;
  admin_edits: FundamentalDeltas | null;
  narrative: string | null;
  created_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
}

export interface FundamentalApproveResponse {
  evaluation_id: string;
  team_id: string;
  ticker: string;
  drift_target_pct: string;
  drift_floor_pct: string;
  narrative: string | null;
}

export interface FundamentalsUpdatedPayload {
  evaluation_id: string;
  team_id: string;
  ticker: string;
  drift_target_pct: string;
}
