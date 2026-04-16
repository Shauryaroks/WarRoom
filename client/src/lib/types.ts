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
