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
  SolutionResponse,
  CooldownResponse,
  CaselineResponse,
  EvaluationListItem,
  EvaluationActionResponse,
  CaselineAssignResponse,
  LeaderboardEntry,
  ArchetypeResponse,
  ArchetypeAssignResponse,
  ArchetypeSeedResponse,
  BulkDecisionSubmitRequest,
  DecisionResponse,
  OperatingPlanResponse,
  GamePhaseResponse,
  BudgetResponse,
  FundamentalEvalListItem,
  FundamentalApproveResponse,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

class ApiClient {
  private getToken(path?: string): string | null {
    if (typeof window === "undefined") return null;
    // Admin API calls use the admin-scoped localStorage key; everything else uses team-scoped.
    // Separate keys = admin + team sessions can coexist in the same browser.
    const pathHint = path ?? window.location.pathname;
    const isAdminContext =
      pathHint.startsWith("/api/v1/admin") || pathHint.startsWith("/admin");
    const storageKey = isAdminContext
      ? "complex-auth-admin"
      : "complex-auth-team";
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed?.state?.token || null;
      }
    } catch {
      // Parse error
    }
    return null;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const token = this.getToken(path);
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

      // 401/403 on authenticated admin endpoints = stale/wrong admin token. Nuke ONLY the
      // admin-scoped storage (leave team session untouched) and bounce to the admin login.
      if (
        typeof window !== "undefined" &&
        (res.status === 401 || res.status === 403) &&
        path.startsWith("/api/v1/admin/") &&
        path !== "/api/v1/admin/login" &&
        path !== "/api/v1/admin/seed"
      ) {
        try {
          localStorage.removeItem("complex-auth-admin");
        } catch {}
        if (!window.location.pathname.startsWith("/admin/login")) {
          window.location.href = "/admin/login";
        }
      }

      throw new Error(
        error.detail || `Request failed with status ${res.status}`,
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
    return this.request<GameStateResponse>("/api/v1/teams/game-state");
  }

  async getAdminGameState(): Promise<GameStateResponse> {
    return this.request<GameStateResponse>("/api/v1/admin/game/state");
  }

  async getMarketBias(): Promise<{ bias: "BULLISH" | "BEARISH" | null }> {
    return this.request("/api/v1/admin/game/market-bias");
  }

  async setMarketBias(
    bias: "BULLISH" | "BEARISH" | null,
  ): Promise<{ bias: "BULLISH" | "BEARISH" | null }> {
    return this.request("/api/v1/admin/game/market-bias", {
      method: "POST",
      body: JSON.stringify({ bias }),
    });
  }

  // Team management
  async getTeams(status?: string): Promise<AdminTeam[]> {
    const query = status ? `?status=${status}` : "";
    return this.request<AdminTeam[]>(`/api/v1/admin/teams${query}`);
  }

  async approveTeam(
    teamId: string,
  ): Promise<{ message: string; team_id: string; new_status: string }> {
    return this.request(`/api/v1/admin/teams/${teamId}/approve`, {
      method: "POST",
    });
  }

  async rejectTeam(
    teamId: string,
  ): Promise<{ message: string; team_id: string; new_status: string }> {
    return this.request(`/api/v1/admin/teams/${teamId}/reject`, {
      method: "POST",
    });
  }

  async removeTeam(teamId: string): Promise<TeamRemoveResponse> {
    return this.request<TeamRemoveResponse>(
      `/api/v1/admin/teams/${teamId}/remove`,
      { method: "POST" },
    );
  }

  async bankruptTeam(teamId: string): Promise<TeamRemoveResponse> {
    return this.request<TeamRemoveResponse>(
      `/api/v1/admin/teams/${teamId}/bankrupt`,
      { method: "POST" },
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
    // Team-facing news feed; admin overlay can also use this since admins authenticate as both.
    return this.request<NewsItem[]>("/api/v1/market/news");
  }

  async deleteNews(
    newsId: string,
  ): Promise<{ success: boolean; deleted_id: string }> {
    return this.request(`/api/v1/admin/news/${newsId}`, {
      method: "DELETE",
    });
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
      { method: "POST" },
    );
  }

  // Market data
  async getCompanies(): Promise<CompanyInfo[]> {
    return this.request<CompanyInfo[]>("/api/v1/market/companies");
  }

  async getPriceHistory(
    teamId: string,
    limit = 100,
  ): Promise<PriceHistoryPoint[]> {
    return this.request<PriceHistoryPoint[]>(
      `/api/v1/market/prices/${teamId}?limit=${limit}`,
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

  // Solutions (team-facing)
  async submitSolution(data: {
    content: string;
    solution_type: string;
  }): Promise<SolutionResponse> {
    return this.request<SolutionResponse>("/api/v1/solutions/submit", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getMySolutions(): Promise<SolutionResponse[]> {
    return this.request<SolutionResponse[]>("/api/v1/solutions/my-solutions");
  }

  async getCooldown(): Promise<CooldownResponse> {
    return this.request<CooldownResponse>("/api/v1/solutions/cooldown");
  }

  async getCaseline(): Promise<CaselineResponse> {
    return this.request<CaselineResponse>("/api/v1/solutions/caseline");
  }

  // Evaluations (admin-facing)
  async getEvaluations(status?: string): Promise<EvaluationListItem[]> {
    const query = status && status !== "ALL" ? `?status=${status}` : "";
    return this.request<EvaluationListItem[]>(
      `/api/v1/admin/evaluations${query}`,
    );
  }

  async getEvaluation(evaluationId: string): Promise<EvaluationListItem> {
    return this.request<EvaluationListItem>(
      `/api/v1/admin/evaluations/${evaluationId}`,
    );
  }

  async editEvaluation(
    evaluationId: string,
    data: Partial<{
      overall_score: number;
      scoring_metrics: string;
      news_headline: string;
      news_body: string;
      news_sentiment: number;
      price_timeline: string;
    }>,
  ): Promise<EvaluationActionResponse> {
    return this.request<EvaluationActionResponse>(
      `/api/v1/admin/evaluations/${evaluationId}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
    );
  }

  async approveEvaluation(
    evaluationId: string,
  ): Promise<EvaluationActionResponse> {
    return this.request<EvaluationActionResponse>(
      `/api/v1/admin/evaluations/${evaluationId}/approve`,
      {
        method: "POST",
      },
    );
  }

  async rejectEvaluation(
    evaluationId: string,
    adminNotes?: string,
  ): Promise<EvaluationActionResponse> {
    return this.request<EvaluationActionResponse>(
      `/api/v1/admin/evaluations/${evaluationId}/reject`,
      {
        method: "POST",
        body: JSON.stringify({ admin_notes: adminNotes || "" }),
      },
    );
  }

  // Leaderboard
  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    return this.request<LeaderboardEntry[]>("/api/v1/market/leaderboard");
  }

  // === Phase 9: Fundamentals Queue ===

  async listFundamentalsQueue(
    status?: string,
  ): Promise<FundamentalEvalListItem[]> {
    const q = status ? `?status_filter=${encodeURIComponent(status)}` : "";
    return this.request<FundamentalEvalListItem[]>(
      `/api/v1/admin/fundamentals-queue${q}`,
    );
  }

  async approveFundamental(
    evaluationId: string,
  ): Promise<FundamentalApproveResponse> {
    return this.request<FundamentalApproveResponse>(
      `/api/v1/admin/fundamentals-queue/${evaluationId}/approve`,
      { method: "POST" },
    );
  }

  async rejectFundamental(evaluationId: string, adminNotes?: string) {
    return this.request(
      `/api/v1/admin/fundamentals-queue/${evaluationId}/reject`,
      {
        method: "POST",
        body: JSON.stringify({ admin_notes: adminNotes || "" }),
      },
    );
  }

  async computeFundamentals(roundNumber: number) {
    return this.request("/api/v1/admin/fundamentals-queue/compute", {
      method: "POST",
      body: JSON.stringify({ round_number: roundNumber }),
    });
  }

  async assignCaseline(
    teamId: string,
    data: {
      caseline_document: string;
      company_display_name?: string;
      starting_cash?: number;
      initial_stock_price?: number;
    },
  ): Promise<CaselineAssignResponse> {
    return this.request<CaselineAssignResponse>(
      `/api/v1/admin/teams/${teamId}/caseline`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
    );
  }

  // === Phase 7: Archetype CRUD ===

  async getArchetypes(): Promise<ArchetypeResponse[]> {
    return this.request<ArchetypeResponse[]>("/api/v1/admin/archetypes");
  }

  async createArchetype(
    data: Omit<ArchetypeResponse, "id" | "is_preset" | "created_at">,
  ): Promise<ArchetypeResponse> {
    return this.request<ArchetypeResponse>("/api/v1/admin/archetypes", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async deleteArchetype(archetypeId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(
      `/api/v1/admin/archetypes/${archetypeId}`,
      { method: "DELETE" },
    );
  }

  async assignArchetype(
    teamId: string,
    archetypeId: string,
  ): Promise<ArchetypeAssignResponse> {
    return this.request<ArchetypeAssignResponse>(
      `/api/v1/admin/teams/${teamId}/assign-archetype`,
      {
        method: "POST",
        body: JSON.stringify({ archetype_id: archetypeId }),
      },
    );
  }

  async seedArchetypes(): Promise<ArchetypeSeedResponse> {
    return this.request<ArchetypeSeedResponse>(
      "/api/v1/admin/archetypes/seed",
      { method: "POST" },
    );
  }

  // === Phase 8: Decisions & Game Phase ===

  async submitDecisions(body: BulkDecisionSubmitRequest) {
    return this.request<{
      message: string;
      decisions: DecisionResponse[];
      total_budget_spent: string;
    }>("/api/v1/decisions/submit", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async getCurrentDecisions() {
    return this.request<DecisionResponse[]>("/api/v1/decisions/current");
  }

  async submitOperatingPlan(content: string) {
    return this.request<{ message: string; plan_id: string }>(
      "/api/v1/decisions/operating-plan",
      { method: "POST", body: JSON.stringify({ content }) },
    );
  }

  async getOperatingPlan() {
    return this.request<OperatingPlanResponse>(
      "/api/v1/decisions/operating-plan",
    );
  }

  async enterWarRoom(macroBrief: string) {
    return this.request<GamePhaseResponse>("/api/v1/admin/game/war-room", {
      method: "POST",
      body: JSON.stringify({ phase: "war_room", macro_brief: macroBrief }),
    });
  }

  async openLiveFloor() {
    return this.request<GamePhaseResponse>("/api/v1/admin/game/live-floor", {
      method: "POST",
    });
  }

  async getGamePhase() {
    return this.request<GamePhaseResponse>("/api/v1/game/phase");
  }

  async getBudget() {
    return this.request<BudgetResponse>("/api/v1/game/budget");
  }
}

export const api = new ApiClient();
