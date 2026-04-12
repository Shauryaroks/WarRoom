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
} from "./models";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:80/api/v1";

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
    name: string;
    ticker: string;
    portfolio_id: string;
  }): Promise<{ api_key: string }> {
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

  async login(ticker: string): Promise<{ api_key: string }> {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
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
      return await res.json();
    } catch (error) {
      console.error("[API Error] getTeams:", error);
      throw error;
    }
  },

  async getTeamByTicker(ticker: string): Promise<TeamSummary | null> {
    try {
      const url = `/teams?ticker=${encodeURIComponent(ticker)}`;
      const res = await authFetch(url);
      const teams = await res.json();
      return teams.length > 0 ? teams[0] : null;
    } catch (error) {
      console.error("[API Error] getTeamByTicker:", error);
      throw error;
    }
  },

  async getMyTeamDossier(): Promise<TeamDossier> {
    try {
      const res = await authFetch("/teams/me/dossier");
      const data = await res.json();
      return TeamDossierSchema.parse(data);
    } catch (error) {
      console.error("[API Error] getMyTeamDossier:", error);
      throw error;
    }
  },

  async getPendingTeams(): Promise<TeamSummary[]> {
    try {
      const res = await authFetch("/teams/pending");
      return await res.json();
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

  async rejectTeam(teamId: string): Promise<void> {
    try {
      await authFetch(`/teams/${teamId}/reject`, { method: "POST" });
    } catch (error) {
      console.error("[API Error] rejectTeam:", error);
      throw error;
    }
  },

  async forceBankruptTeam(teamId: string): Promise<unknown> {
    try {
      const res = await authFetch(`/teams/${teamId}/bankrupt`, {
        method: "POST",
      });
      return await res.json();
    } catch (error) {
      console.error("[API Error] forceBankruptTeam:", error);
      throw error;
    }
  },

  // --- Directives ---
  async submitDirective(
    teamId: string,
    data: unknown,
  ): Promise<DirectiveWithFeedback> {
    try {
      // teamId might be inferred from auth, but we pass it anyway
      const res = await authFetch(`/directives`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      const result = await res.json();
      return DirectiveWithFeedbackSchema.parse(result);
    } catch (error) {
      console.error("[API Error] submitDirective:", error);
      throw error;
    }
  },

  async getDirectives(teamId: string): Promise<DirectiveWithFeedback[]> {
    try {
      const res = await authFetch(`/directives`);
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
      return await res.json();
    } catch (error) {
      console.error("[API Error] getMarketTickers:", error);
      throw error;
    }
  },

  async getSectorHeatmap(): Promise<unknown[]> {
    try {
      const res = await authFetch("/market/heatmap");
      return await res.json();
    } catch (error) {
      console.error("[API Error] getSectorHeatmap:", error);
      throw error;
    }
  },

  async executeTrade(
    teamId: string,
    data: unknown,
  ): Promise<{ success: boolean; transactionId: string }> {
    try {
      const res = await authFetch(`/market/trade`, {
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
  async getNewsItems(limit = 20): Promise<NewsItem[]> {
    try {
      const res = await authFetch(`/market/news?limit=${limit}`);
      return await res.json();
    } catch (error) {
      console.error("[API Error] getNewsItems:", error);
      throw error;
    }
  },

  async injectNews(data: unknown): Promise<unknown> {
    try {
      const res = await authFetch(`/market/news/inject`, {
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
  async startGame(): Promise<GameState> {
    try {
      const res = await authFetch("/game/start", { method: "POST" });
      const data = await res.json();
      return GameStateSchema.parse(data);
    } catch (error) {
      console.error("[API Error] startGame:", error);
      throw error;
    }
  },

  async pauseGame(): Promise<GameState> {
    try {
      const res = await authFetch("/game/pause", { method: "POST" });
      const data = await res.json();
      return GameStateSchema.parse(data);
    } catch (error) {
      console.error("[API Error] pauseGame:", error);
      throw error;
    }
  },

  async endGame(): Promise<GameState> {
    try {
      const res = await authFetch("/game/end", { method: "POST" });
      const data = await res.json();
      return GameStateSchema.parse(data);
    } catch (error) {
      console.error("[API Error] endGame:", error);
      throw error;
    }
  },

  async initiatePurge(): Promise<{ eliminated: string[]; survivors: number }> {
    try {
      const res = await authFetch("/game/purge", { method: "POST" });
      return await res.json();
    } catch (error) {
      console.error("[API Error] initiatePurge:", error);
      throw error;
    }
  },

  // --- Admin Metrics ---
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
      const res = await authFetch("/admin/metrics/llm");
      return await res.json();
    } catch (error) {
      console.error("[API Error] adminGetLLMStats:", error);
      throw error;
    }
  },

  async adminGetMarketStats(): Promise<MarketStats> {
    try {
      const res = await authFetch("/admin/metrics/market");
      return await res.json();
    } catch (error) {
      console.error("[API Error] adminGetMarketStats:", error);
      throw error;
    }
  },
};

export default api;
