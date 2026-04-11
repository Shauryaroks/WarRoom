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

// const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createMockUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const mockTeams: TeamSummary[] = [
  {
    team_id: createMockUUID(),
    name: "BARBIE INC",
    ticker: "$BRBE",
    status: "ACTIVE",
    stock_price: 142.09,
    market_cap: 142090000,
    portfolio_id: "PORT_D2C_01",
  }
];

const directives: DirectiveWithFeedback[] = [];
const newsItems: NewsItem[] = [];
let gameState: GameState = {
  status: "ACTIVE",
  server_time: new Date().toISOString(),
  elapsed_seconds: 15797,
  next_purge_at: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
  current_round: 2,
  teams_remaining: 42,
};

export const api = {
  async getGameState(): Promise<GameState> {
    await delay(100);
    return GameStateSchema.parse(gameState);
  },

  async getTeams(filter?: string): Promise<TeamSummary[]> {
    await delay(100);
    return filter ? mockTeams : mockTeams;
  },

  async getTeamByTicker(ticker: string): Promise<TeamSummary | null> {
    await delay(50);
    return mockTeams.find((t) => t.ticker === ticker) || null;
  },

  async getMyTeamDossier(): Promise<TeamDossier> {
    await delay(100);
    const mockDossier: TeamDossier = {
      profile: {
        team_id: createMockUUID(),
        name: "BARBIE INC",
        ticker: "$BRBE",
        status: "ACTIVE",
        portfolio_id: "PORT_D2C_01"
      },
      financials: {
        cash: 1000000,
        stock_price: 142.09,
        market_cap: 142090000,
        liquidity: 1000000,
        treasury_sale_limit_remaining: 10
      },
      portfolio: {
        holdings: [
          { ticker: "$TECH", shares: 150, current_price: 104, current_value: 15600, cost_basis: 100, unrealized_pnl: 4, ownership_percentage: 0.1 }
        ],
        total_portfolio_value: 15600,
        total_unrealized_pnl: 4
      },
      cooldown_status: { active: false }
    };
    return TeamDossierSchema.parse(mockDossier);
  },

  async getPendingTeams(): Promise<TeamSummary[]> {
    await delay(100);
    return mockTeams.filter((t) => t.status === "PENDING");
  },

  async approveTeam(teamId: string, portfolioId: string): Promise<unknown> {
    console.log(teamId, portfolioId);
    await delay(300);
    return {};
  },
  
  async rejectTeam(teamId: string): Promise<void> {
    console.log(teamId);
    await delay(200);
  },
  
  async forceBankruptTeam(teamId: string): Promise<unknown> {
    console.log(teamId);
    await delay(200);
    return {};
  },

  async submitDirective(
    teamId: string,
    data: unknown,
  ): Promise<DirectiveWithFeedback> {
    console.log(teamId, data);
    await delay(500);
    const directive: DirectiveWithFeedback = {
      id: createMockUUID(),
      headline: "Directive Submitted",
      feedback: "The board is reviewing.",
      submitted_at: new Date().toISOString(),
      status: "COMPLETED",
    };
    directives.push(directive);
    return DirectiveWithFeedbackSchema.parse(directive);
  },

  async getDirectives(teamId: string): Promise<DirectiveWithFeedback[]> {
    console.log(teamId);
    await delay(100);
    return directives;
  },

  async getMarketTickers(): Promise<TickerSnapshot[]> {
    await delay(50);
    return [
      { ticker: "$BRBE", price: 95.5, change_24h: -2.1, change_absolute: -2.1, volume_24h: 5000000, market_cap: 95500000, status: "ACTIVE" }
    ];
  },

  async getSectorHeatmap(): Promise<unknown[]> {
    await delay(50);
    return [];
  },

  async executeTrade(teamId: string, data: unknown): Promise<{success: boolean, transactionId: string}> {
    console.log(teamId, data);
    await delay(200);
    return { success: true, transactionId: "123" };
  },

  async getNewsItems(limit = 20): Promise<NewsItem[]> {
    await delay(50);
    return newsItems.slice(0, limit);
  },

  async injectNews(data: unknown): Promise<unknown> {
    console.log(data);
    await delay(200);
    return {};
  },

  async startGame(): Promise<GameState> {
    await delay(500);
    gameState = { ...gameState, status: "ACTIVE", started_at: new Date().toISOString() };
    return GameStateSchema.parse(gameState);
  },

  async pauseGame(): Promise<GameState> {
    await delay(300);
    gameState = { ...gameState, status: "PAUSED" };
    return GameStateSchema.parse(gameState);
  },

  async endGame(): Promise<GameState> {
    await delay(500);
    gameState = { ...gameState, status: "FINISHED" };
    return GameStateSchema.parse(gameState);
  },

  async initiatePurge(): Promise<{ eliminated: string[]; survivors: number }> {
    await delay(1000);
    return { eliminated: [], survivors: 42 };
  },

  async adminGetMetrics(): Promise<AdminMetrics> {
    await delay(100);
    return {
      active_teams: 42,
      total_teams: 50,
      teams_by_status: { ACTIVE: 42 },
      aggregate_liquidity: 4200000000,
      avg_market_cap: 350000000,
      market_cap_change_24h: 2.4,
      llm_queue_depth: 3,
      session_cost_usd: 4.23,
    };
  },

  async adminGetLLMStats(): Promise<LLMStats> {
    await delay(50);
    return {
      total_requests: 1240,
      total_cost_usd: 4.23,
      avg_latency_ms: 1200,
      error_rate: 0.05,
      by_model: [
        {
          model: "claude-3-haiku",
          requests: 1240,
          cost_usd: 4.23,
          avg_latency_ms: 1200,
        },
      ],
    };
  },

  async adminGetMarketStats(): Promise<MarketStats> {
    await delay(50);
    return {
      total_trades: 4200,
      trades_last_hour: 350,
      volume_by_ticker: { $APEX: 1500000, $BRBE: 1200000 },
      anomaly_alerts: [
        { type: "RAPID_TRADING", ticker: "$APEX", description: "High volume" },
      ],
    };
  }
};

export default api;
