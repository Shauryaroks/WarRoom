import type {
  RegisterResponse,
  LoginResponse,
  AdminLoginResponse,
  MeResponse,
  ApprovedTeam,
  GameStateResponse,
  AdminTeam,
  NewsItem,
  ActivityEvent,
  TeamRemoveResponse,
  NewsInjectResponse,
  BroadcastResponse,
  RoundAdvanceResponse,
  CompanyInfo,
  PriceHistoryPoint,
  TradePreviewRequest,
  TradePreview,
  TradeRequest,
  TradeResult,
  PortfolioResponse,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

class ApiClient {
  private getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("token");
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const error = await res
        .json()
        .catch(() => ({ detail: "Something went wrong. Try again." }));
      throw new Error(
        error.detail || `Request failed with status ${res.status}`
      );
    }

    return res.json();
  }

  async register(data: {
    team_name: string;
    ticker: string;
    email: string;
    password: string;
  }): Promise<RegisterResponse> {
    return this.request<RegisterResponse>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async login(data: {
    email: string;
    password: string;
    role: string;
  }): Promise<LoginResponse> {
    return this.request<LoginResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async adminLogin(data: {
    email: string;
    password: string;
  }): Promise<AdminLoginResponse> {
    return this.request<AdminLoginResponse>("/api/v1/admin/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async me(): Promise<MeResponse> {
    return this.request<MeResponse>("/api/v1/auth/me");
  }

  async getApprovedTeams(): Promise<ApprovedTeam[]> {
    return this.request<ApprovedTeam[]>("/api/v1/teams/approved");
  }

  async startGame(): Promise<GameStateResponse> {
    return this.request<GameStateResponse>("/api/v1/admin/game/start", {
      method: "POST",
    });
  }

  async pauseGame(): Promise<GameStateResponse> {
    return this.request<GameStateResponse>("/api/v1/admin/game/pause", {
      method: "POST",
    });
  }

  async resumeGame(): Promise<GameStateResponse> {
    return this.request<GameStateResponse>("/api/v1/admin/game/resume", {
      method: "POST",
    });
  }

  async getGameState(): Promise<GameStateResponse> {
    return this.request<GameStateResponse>("/api/v1/admin/game/state");
  }

  // Team management
  async getTeams(status?: string): Promise<AdminTeam[]> {
    const query = status ? `?status=${status}` : "";
    return this.request<AdminTeam[]>(`/api/v1/admin/teams${query}`);
  }

  async approveTeam(
    teamId: string
  ): Promise<{ message: string; team_id: string; new_status: string }> {
    return this.request(`/api/v1/admin/teams/${teamId}/approve`, {
      method: "POST",
    });
  }

  async rejectTeam(
    teamId: string
  ): Promise<{ message: string; team_id: string; new_status: string }> {
    return this.request(`/api/v1/admin/teams/${teamId}/reject`, {
      method: "POST",
    });
  }

  async removeTeam(teamId: string): Promise<TeamRemoveResponse> {
    return this.request<TeamRemoveResponse>(
      `/api/v1/admin/teams/${teamId}/remove`,
      { method: "POST" }
    );
  }

  // News
  async injectNews(data: {
    headline: string;
    body: string;
    news_type: string;
    affected_tickers: string[];
  }): Promise<NewsInjectResponse> {
    return this.request<NewsInjectResponse>("/api/v1/admin/news/inject", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getNewsHistory(): Promise<NewsItem[]> {
    return this.request<NewsItem[]>("/api/v1/admin/news/history");
  }

  // Broadcast
  async broadcast(message: string): Promise<BroadcastResponse> {
    return this.request<BroadcastResponse>("/api/v1/admin/broadcast", {
      method: "POST",
      body: JSON.stringify({ message }),
    });
  }

  // Activity
  async getActivityLog(): Promise<ActivityEvent[]> {
    return this.request<ActivityEvent[]>("/api/v1/admin/activity");
  }

  // Game restart
  async restartGame(): Promise<GameStateResponse> {
    return this.request<GameStateResponse>("/api/v1/admin/game/restart", {
      method: "POST",
    });
  }

  // Round management
  async advanceRound(): Promise<RoundAdvanceResponse> {
    return this.request<RoundAdvanceResponse>(
      "/api/v1/admin/game/advance-round",
      { method: "POST" }
    );
  }

  // Market data
  async getCompanies(): Promise<CompanyInfo[]> {
    return this.request<CompanyInfo[]>("/api/v1/market/companies");
  }

  async getPriceHistory(
    teamId: string,
    limit = 100
  ): Promise<PriceHistoryPoint[]> {
    return this.request<PriceHistoryPoint[]>(
      `/api/v1/market/prices/${teamId}?limit=${limit}`
    );
  }

  // Trading
  async previewTrade(data: TradePreviewRequest): Promise<TradePreview> {
    return this.request<TradePreview>("/api/v1/trading/preview", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async buyShares(data: TradeRequest): Promise<TradeResult> {
    return this.request<TradeResult>("/api/v1/trading/buy", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async sellShares(data: TradeRequest): Promise<TradeResult> {
    return this.request<TradeResult>("/api/v1/trading/sell", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getPortfolio(): Promise<PortfolioResponse> {
    return this.request<PortfolioResponse>("/api/v1/trading/portfolio");
  }
}

export const api = new ApiClient();
