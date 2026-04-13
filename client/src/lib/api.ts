import {
  TeamSummary,
  TeamDossier,
  TeamDossierSchema,
  DirectiveWithFeedback,
  DirectiveWithFeedbackSchema,
  NewsItem,
  TickerSnapshot,
  AdminMetrics,
  LLMStats,
  MarketStats,
  GameState,
  GameStateSchema,
  OrderResponse,
  SubmitDirectiveResponse,
  PurgeResponse,
} from "./models";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:80/api/v1";

async function authFetch(endpoint: string, options: RequestInit = {}) {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("complex_api_key")
      : null;
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set("X-API-Key", token);
  }

  if (process.env.NEXT_PUBLIC_ADMIN_API_KEY) {
    headers.set("X-Admin-Key", process.env.NEXT_PUBLIC_ADMIN_API_KEY);
  }

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const errorData = await response.json();
      errorMessage = errorData?.detail || errorData?.message || errorMessage;
    } catch {
      // Ignore JSON parse error if response is not JSON
    }
    throw new Error(`API Error ${response.status}: ${errorMessage}`);
  }

  return response;
}

export const api = {
  // --- Auth ---
  async registerTeam(data: {
    team_name: string;
    ticker: string;
    email: string;
    password: string;
  }): Promise<{ message: string; registration_id: string }> {
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        let errMessage = res.statusText;
        try {
          const err = await res.json();
          errMessage = err?.detail || errMessage;
        } catch {}
        throw new Error(`Registration failed: ${errMessage}`);
      }
      return await res.json();
    } catch (error) {
      console.error("[API Error] registerTeam:", error);
      throw error;
    }
  },

  async login(data: { ticker: string; password: string }): Promise<{
    api_key: string;
    team_name: string;
    ticker: string;
    status: string;
    ws_endpoint: string;
  }> {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        let errMessage = res.statusText;
        try {
          const err = await res.json();
          errMessage = err?.detail || errMessage;
        } catch {}
        throw new Error(`Login failed: ${errMessage}`);
      }
      return await res.json();
    } catch (error) {
      console.error("[API Error] login:", error);
      throw error;
    }
  },

  // --- Game State ---
  async getGameState(): Promise<GameState> {
    try {
      const res = await authFetch("/game/state");
      const data = await res.json();
      return GameStateSchema.parse(data);
    } catch (error) {
      console.error("[API Error] getGameState:", error);
      throw error;
    }
  },

  // --- Teams ---
  async getTeams(filter?: string): Promise<TeamSummary[]> {
    try {
      const url = filter
        ? `/teams?filter=${encodeURIComponent(filter)}`
        : "/teams";
      const res = await authFetch(url);
      const data = await res.json();
      return data.teams || [];
    } catch (error) {
      console.error("[API Error] getTeams:", error);
      throw error;
    }
  },

  async getTeamByTicker(ticker: string): Promise<TeamSummary | null> {
    try {
      const url = `/teams?ticker=${encodeURIComponent(ticker)}`;
      const res = await authFetch(url);
      const data = await res.json();
      const teams = data.teams || [];
      return teams.length > 0 ? teams[0] : null;
    } catch (error) {
      console.error("[API Error] getTeamByTicker:", error);
      throw error;
    }
  },

  async getMyTeamDossier(): Promise<TeamDossier> {
    try {
      const res = await authFetch("/teams/me");
      const data = await res.json();
      return TeamDossierSchema.parse(data);
    } catch (error) {
      console.error("[API Error] getMyTeamDossier:", error);
      throw error;
    }
  },

  async getPendingTeams(): Promise<TeamSummary[]> {
    try {
      const res = await authFetch("/admin/teams/pending");
      const data = await res.json();
      return data.teams || [];
    } catch (error) {
      console.error("[API Error] getPendingTeams:", error);
      throw error;
    }
  },

  async approveTeam(teamId: string, portfolioId: string): Promise<unknown> {
    try {
      const res = await authFetch(`/teams/${teamId}/approve`, {
        method: "POST",
        body: JSON.stringify({ portfolio_id: portfolioId }),
      });
      return await res.json();
    } catch (error) {
      console.error("[API Error] approveTeam:", error);
      throw error;
    }
  },

  async rejectTeam(
    teamId: string,
    reason: string = "Admin Rejection",
  ): Promise<void> {
    try {
      await authFetch(`/teams/${teamId}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
    } catch (error) {
      console.error("[API Error] rejectTeam:", error);
      throw error;
    }
  },

  async forceBankruptTeam(
    teamId: string,
    reason: string = "Admin Override",
  ): Promise<unknown> {
    try {
      const res = await authFetch(`/teams/${teamId}/bankrupt`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      return await res.json();
    } catch (error) {
      console.error("[API Error] forceBankruptTeam:", error);
      throw error;
    }
  },

  // --- Directives ---
  async submitDirective(data: {
    directive_markdown: string;
    player_confidence_rating?: number;
  }): Promise<SubmitDirectiveResponse> {
    try {
      const res = await authFetch(`/directives`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch (error) {
      console.error("[API Error] submitDirective:", error);
      throw error;
    }
  },

  async getDirectives(): Promise<{
    directives: DirectiveWithFeedback[];
    total_count: number;
  }> {
    try {
      const res = await authFetch(`/teams/me/directives`);
      return await res.json();
    } catch (error) {
      console.error("[API Error] getDirectives:", error);
      throw error;
    }
  },

  // --- Market ---
  async getMarketTickers(): Promise<TickerSnapshot[]> {
    try {
      const res = await authFetch("/market/tickers");
      const data = await res.json();
      return data.tickers || [];
    } catch (error) {
      console.error("[API Error] getMarketTickers:", error);
      throw error;
    }
  },

  async getSectorHeatmap(): Promise<unknown[]> {
    try {
      const res = await authFetch("/market/sectors");
      const data = await res.json();
      return data.sectors || [];
    } catch (error) {
      console.error("[API Error] getSectorHeatmap:", error);
      throw error;
    }
  },

  async getMarketHistory(
    ticker: string,
    interval: string = "5m",
    limit: number = 100,
  ): Promise<any> {
    try {
      const res = await authFetch(
        `/market/history/${encodeURIComponent(ticker)}?interval=${interval}&limit=${limit}`,
      );
      return await res.json();
    } catch (error) {
      console.error("[API Error] getMarketHistory:", error);
      throw error;
    }
  },

  async executeTrade(data: {
    action: "buy" | "sell";
    target_ticker: string;
    shares: number;
    order_type: "MARKET" | "LIMIT";
  }): Promise<OrderResponse> {
    try {
      const res = await authFetch(`/orders`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch (error) {
      console.error("[API Error] executeTrade:", error);
      throw error;
    }
  },

  // --- News ---
  async getNewsItems(
    limit = 20,
  ): Promise<{ items: NewsItem[]; has_more: boolean }> {
    try {
      const res = await authFetch(`/news?limit=${limit}`);
      return await res.json();
    } catch (error) {
      console.error("[API Error] getNewsItems:", error);
      throw error;
    }
  },

  async injectNews(data: unknown): Promise<unknown> {
    try {
      const res = await authFetch(`/news/inject`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch (error) {
      console.error("[API Error] injectNews:", error);
      throw error;
    }
  },

  // --- Admin Game Control ---
  async startGame(
    data: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    try {
      const res = await authFetch("/game/start", {
        method: "POST",
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch (error) {
      console.error("[API Error] startGame:", error);
      throw error;
    }
  },

  async pauseGame(): Promise<Record<string, unknown>> {
    try {
      const res = await authFetch("/game/pause", { method: "POST" });
      return await res.json();
    } catch (error) {
      console.error("[API Error] pauseGame:", error);
      throw error;
    }
  },

  async resumeGame(): Promise<Record<string, unknown>> {
    try {
      const res = await authFetch("/game/resume", { method: "POST" });
      return await res.json();
    } catch (error) {
      console.error("[API Error] resumeGame:", error);
      throw error;
    }
  },

  async endGame(): Promise<Record<string, unknown>> {
    try {
      const res = await authFetch("/game/end", { method: "POST" });
      return await res.json();
    } catch (error) {
      console.error("[API Error] endGame:", error);
      throw error;
    }
  },

  async initiatePurge(data: {
    confirmation: "PURGE";
    force: boolean;
  }): Promise<PurgeResponse> {
    try {
      const res = await authFetch("/game/purge", {
        method: "POST",
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch (error) {
      console.error("[API Error] initiatePurge:", error);
      throw error;
    }
  },

  // --- Admin Metrics ---

  async adminGetPortfolios(): Promise<string[]> {
    try {
      const res = await authFetch("/admin/portfolios");
      const data = await res.json();
      return data.portfolios || [];
    } catch (error) {
      console.error("[API Error] adminGetPortfolios:", error);
      throw error;
    }
  },

  async adminGetMetrics(): Promise<AdminMetrics> {
    try {
      const res = await authFetch("/admin/metrics");
      return await res.json();
    } catch (error) {
      console.error("[API Error] adminGetMetrics:", error);
      throw error;
    }
  },

  async adminGetLLMStats(): Promise<LLMStats> {
    try {
      const res = await authFetch("/admin/llm-stats");
      return await res.json();
    } catch (error) {
      console.error("[API Error] adminGetLLMStats:", error);
      throw error;
    }
  },

  async adminGetMarketStats(): Promise<MarketStats> {
    try {
      const res = await authFetch("/admin/market-stats");
      return await res.json();
    } catch (error) {
      console.error("[API Error] adminGetMarketStats:", error);
      throw error;
    }
  },
};

export default api;
