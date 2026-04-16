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
