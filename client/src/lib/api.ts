import type {
  Team,
  TeamFinancials,
  Directive,
  DirectiveSubmitRequest,
  NewsItem,
  MarketTicker,
  Portfolio,
  PortfolioType,
  AdminMetrics,
  LLMStats,
  MarketStats,
  SectorHeatmap,
  GameState,
  RegisterRequest,
  TradeRequest,
  NewsInjectRequest,
} from "./models";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

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

const mockPortfolios: Record<PortfolioType, Portfolio> = {
  "Tech Startup": {
    id: "PORT_TECH_01",
    name: "Tech Startup",
    swot: {
      strengths: "Proprietary LLM, PhD team, AI patents",
      weaknesses: "$500k/month burn rate, dependency on cloud providers",
      opportunities: "Enterprise AI adoption, vertical integration",
      threats: "Regulatory scrutiny, compute costs",
    },
  },
  "Legacy Manufacturer": {
    id: "PORT_LEG_01",
    name: "Legacy Manufacturer",
    swot: {
      strengths: "Established supply chain, brand recognition",
      weaknesses: "Outdated technology, high labor costs",
      opportunities: "Digital transformation, emerging markets",
      threats: "Automation disruption, environmental regs",
    },
  },
  "D2C Disruptor": {
    id: "PORT_D2C_01",
    name: "D2C Disruptor",
    swot: {
      strengths: "Direct customer relationships, viral marketing",
      weaknesses: "Thin margins, inventory risk",
      opportunities: "International expansion, product line extension",
      threats: "Platform fees, customer acquisition costs",
    },
  },
  Conglomerate: {
    id: "PORT_CONG_01",
    name: "Conglomerate",
    swot: {
      strengths: "Diversified revenue, capital reserves",
      weaknesses: "Slow decision-making, legacy systems",
      opportunities: "M&A opportunities, cross-brand synergies",
      threats: "Antitrust scrutiny, market volatility",
    },
  },
};

const mockTeams: Team[] = [
  {
    id: createMockUUID(),
    name: "BARBIE INC",
    ticker: "$BARB",
    status: "ACTIVE",
    portfolioId: "PORT_D2C_01",
    swotProfile: mockPortfolios["D2C Disruptor"].swot,
    cash: 1245000,
    stockPrice: 142.09,
    sharesOutstanding: 1000000,
    publicFloat: 100000,
    maxTreasurySalePct: 10,
    cooldownUntil: null,
    liquidity: 1245000,
    marketCap: 142090000,
    lastDirective: "EXPAND_MARKET_SHARE_EMEA...",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: createMockUUID(),
    name: "STARK_INDUSTRIES",
    ticker: "$STRK",
    status: "PENDING",
    portfolioId: null,
    swotProfile: null,
    cash: 0,
    stockPrice: 0,
    sharesOutstanding: 1000000,
    publicFloat: 0,
    maxTreasurySalePct: 10,
    cooldownUntil: null,
    liquidity: 0,
    marketCap: 0,
    lastDirective: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: createMockUUID(),
    name: "WAYNE_CORP",
    ticker: "$WAYN",
    status: "COOLDOWN",
    portfolioId: "PORT_CONG_01",
    swotProfile: mockPortfolios.Conglomerate.swot,
    cash: 892000,
    stockPrice: 89.5,
    sharesOutstanding: 1000000,
    publicFloat: 120000,
    maxTreasurySalePct: 10,
    cooldownUntil: new Date(Date.now() + 6 * 60 * 1000).toISOString(),
    liquidity: 892000,
    marketCap: 89500000,
    lastDirective: "RESTRUCTURING_V4...",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: createMockUUID(),
    name: "ACME_CO",
    ticker: "$ACME",
    status: "ELIMINATED",
    portfolioId: null,
    swotProfile: null,
    cash: 0,
    stockPrice: 0,
    sharesOutstanding: 1000000,
    publicFloat: 0,
    maxTreasurySalePct: 10,
    cooldownUntil: null,
    liquidity: 0,
    marketCap: 0,
    lastDirective: "LIQUIDATED_SYSTEM",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: createMockUUID(),
    name: "TECH_CORP",
    ticker: "$TECH",
    status: "BANKRUPT",
    portfolioId: null,
    swotProfile: null,
    cash: -50000,
    stockPrice: 0,
    sharesOutstanding: 1000000,
    publicFloat: 0,
    maxTreasurySalePct: 10,
    cooldownUntil: null,
    liquidity: -50000,
    marketCap: 0,
    lastDirective: "FIRED_WORKERS...",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

for (let i = 0; i < 15; i++) {
  const dummyNames = [
    "GLOBAL_UNIFIED",
    "PRIME_LOGISTICS",
    "SECURE_TRUST",
    "APEX_GROUP",
    "ZENITH_HOLDINGS",
    "NOVA_SYSTEMS",
    "CORE_DYNAMICS",
    "OMEGA_CORP",
  ];
  const teamName = dummyNames[i % dummyNames.length] + "_" + (i + 100);
  const ticker = "$" + teamName.substring(0, 4);
  mockTeams.push({
    id: createMockUUID(),
    name: teamName,
    ticker: ticker,
    status: "ACTIVE",
    portfolioId: "PORT_TECH_01",
    swotProfile: mockPortfolios["Tech Startup"].swot,
    cash: Math.random() * 1000000 + 500000,
    stockPrice: Math.random() * 50 + 80,
    sharesOutstanding: 1000000,
    publicFloat: 100000 + Math.floor(Math.random() * 50000),
    maxTreasurySalePct: 10,
    cooldownUntil: null,
    liquidity: Math.random() * 1000000 + 500000,
    marketCap: (Math.random() * 50 + 80) * 1000000,
    lastDirective: "MAINTAIN_CURRENT_TRAJECTORY...",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

const mockNewsItems: NewsItem[] = [
  {
    id: createMockUUID(),
    headline:
      "Fed announces 0.25% rate hike. Markets reacting to hawk-ish stance.",
    content:
      "Fed announces 0.25% rate hike. Markets reacting to hawk-ish stance.",
    sourceType: "GLOBAL",
    sourceTeamId: null,
    metadata: { ticker: "$MARKET", priceChange: -1.2 },
    createdAt: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
  },
  {
    id: createMockUUID(),
    headline:
      "$APEX acquires logistics firm for $420M, stock surges 12% in pre-market.",
    content:
      "$APEX acquires logistics firm for $420M, stock surges 12% in pre-market.",
    sourceType: "TEAM_ACTION",
    sourceTeamId: null,
    metadata: { ticker: "$APEX", priceChange: 12 },
    createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
  },
  {
    id: createMockUUID(),
    headline:
      "Barbie Inc ($BRBE) announces Asian expansion plans following Q2 beat.",
    content:
      "Barbie Inc ($BRBE) announces Asian expansion plans following Q2 beat.",
    sourceType: "TEAM_ACTION",
    sourceTeamId: null,
    metadata: { ticker: "$BRBE", priceChange: 3.5 },
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
];

const mockMarketTickers: MarketTicker[] = [
  { ticker: "$CORP", price: 142.09, changePct: 2.41, volume: 12400000 },
  { ticker: "$TECH", price: 89.33, changePct: -1.24, volume: 890000 },
  { ticker: "$SOLA", price: 12.44, changePct: 0.08, volume: 2100000 },
  { ticker: "$AERO", price: 205.12, changePct: -4.82, volume: 4500000 },
  { ticker: "$BRBE", price: 95.5, changePct: -2.1, volume: 5000000 },
  { ticker: "$APEX", price: 104.0, changePct: 2.4, volume: 15000000 },
];

const mockSectors: SectorHeatmap[] = [
  { name: "TECH", change: 2.5 },
  { name: "FIN", change: -1.8 },
  { name: "REIT", change: 0.5 },
  { name: "ENG", change: -3.2 },
  { name: "CONS", change: 1.2 },
];

const mockGameState: GameState = {
  status: "ACTIVE",
  sessionStartTime: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(),
  nextPurgeTime: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
  currentPhase: "ACTIVE_GAMEPLAY",
  survivingTeams: 42,
};

const mockAdminMetrics: AdminMetrics = {
  activeTeams: 42,
  totalTeams: 50,
  teamsByStatus: { ACTIVE: 42, PENDING: 8 },
  aggregateLiquidity: 4200000000,
  avgMarketCap: 350000000,
  marketCapChange24h: 2.4,
  llmQueueDepth: 3,
  sessionCostUsd: 4.23,
};

const mockLLMStats: LLMStats = {
  totalRequests: 1240,
  totalCostUsd: 4.23,
  avgLatencyMs: 1200,
  errorRate: 0.05,
  byModel: [
    {
      model: "claude-3-haiku",
      requests: 1240,
      costUsd: 4.23,
      avgLatencyMs: 1200,
    },
  ],
};

const mockMarketStats: MarketStats = {
  totalTrades: 4200,
  tradesLastHour: 350,
  volumeByTicker: {
    $APEX: 1500000,
    $BRBE: 1200000,
  },
  anomalyAlerts: [
    {
      type: "RAPID_TRADING",
      ticker: "$APEX",
      description:
        "High volume of small trades detected in the last 5 minutes.",
    },
  ],
};

const mockTeamFinancials: TeamFinancials = {
  cash: 850000,
  liquidity: 1200000,
  stockPrice: 95.5,
  marketCap: 95500000,
  holdings: [
    { ticker: "$APEX", shares: 50, currentValue: 5200 },
    { ticker: "$TECH", shares: 100, currentValue: 8933 },
  ],
};

const teams = [...mockTeams];
const directives: Directive[] = [];
const newsItems = [...mockNewsItems];
let gameState = { ...mockGameState };

export const api = {
  async getGameState(): Promise<GameState> {
    await delay(100);
    return GameStateSchema.parse(gameState);
  },

  async getTeams(filter?: string): Promise<Team[]> {
    await delay(100);
    if (filter && filter !== "all") {
      return teams.filter((t) => t.status.toLowerCase() === filter);
    }
    return teams;
  },

  async getTeamByTicker(ticker: string): Promise<Team | null> {
    await delay(50);
    return teams.find((t) => t.ticker === ticker) || null;
  },

  async getTeamFinancials(teamId: string): Promise<TeamFinancials> {
    await delay(100);
    return mockTeamFinancials;
  },

  async registerTeam(data: RegisterRequest): Promise<Team> {
    await delay(500);
    const newTeam: Team = {
      id: createMockUUID(),
      name: data.teamName,
      ticker: `$${data.ticker.toUpperCase()}`,
      status: "PENDING",
      portfolioId: null,
      swotProfile: null,
      cash: 1000000,
      stockPrice: 100,
      sharesOutstanding: 1000000,
      publicFloat: 100000,
      maxTreasurySalePct: 10,
      cooldownUntil: null,
      lastDirective: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    teams.push(newTeam);
    return TeamSchema.parse(newTeam);
  },

  async approveTeam(teamId: string, portfolioId: string): Promise<Team> {
    await delay(300);
    const idx = teams.findIndex((t) => t.id === teamId);
    if (idx === -1) throw new Error("Team not found");

    teams[idx] = {
      ...teams[idx],
      status: "ACTIVE",
      portfolioId: portfolioId,
      swotProfile: null, // Removed mock port
      cash: 1000000,
      stockPrice: 100,
    };
    return TeamSchema.parse(teams[idx]);
  },

  async rejectTeam(teamId: string): Promise<void> {
    await delay(200);
    const idx = teams.findIndex((t) => t.id === teamId);
    if (idx === -1) throw new Error("Team not found");
    teams[idx] = { ...teams[idx], status: "ELIMINATED" };
  },

  async forceBankruptTeam(teamId: string): Promise<Team> {
    await delay(200);
    const idx = teams.findIndex((t) => t.id === teamId);
    if (idx === -1) throw new Error("Team not found");
    teams[idx] = {
      ...teams[idx],
      status: "BANKRUPT",
      cash: -1,
      stockPrice: 0,
    };
    return TeamSchema.parse(teams[idx]);
  },

  async submitDirective(
    teamId: string,
    data: DirectiveSubmitRequest,
  ): Promise<Directive> {
    await delay(500);
    const idx = teams.findIndex((t) => t.id === teamId);
    if (idx === -1) throw new Error("Team not found");

    teams[idx] = {
      ...teams[idx],
      status: "COOLDOWN",
      cooldownUntil: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };

    const directive: Directive = {
      id: createMockUUID(),
      teamId: teamId,
      rawMarkdown: data.directiveMarkdown,
      characterCount: data.directiveMarkdown.length,
      extractionConfidence: 0.92,
      vibeScores: {
        consistency: 0.85,
        macroSensitivity: 0.4,
        aggression: 0.9,
        innovation: 0.6,
      },
      financialImpact: {
        cashDelta: -200000,
        revenueDelta: 450000,
        cogsDelta: 320000,
        marketingCost: 150000,
        treasuryProceeds: 477500,
        netProfitDelta: -20000,
        explanation:
          "Price cut reduces margins but volume increases. Marketing spend offsets margin loss. Treasury sale of 5% raises $477.5k.",
      },
      boardFeedback: {
        tone: "skeptical",
        narrative:
          "Your 15% price slash is bold, but you failed to address the rising interest rate environment in your justification. The Board questions your macro awareness. Execution proceeds with caution.",
        headline:
          "Barbie Inc ($BRBE) slashes prices 15% in aggressive market share grab, dilutes equity 5% to fund marketing blitz.",
      },
      publicHeadline:
        "Barbie Inc ($BRBE) slashes prices 15% in aggressive market share grab, dilutes equity 5% to fund marketing blitz.",
      status: "COMPLETED",
      errorMessage: null,
      processingTimeMs: 1500,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    directives.push(directive);
    teams[idx].lastDirective = directive.publicHeadline || null;

    newsItems.unshift({
      id: createMockUUID(),
      headline: directive.publicHeadline || "",
      content: directive.boardFeedback?.narrative || null,
      sourceType: "TEAM_ACTION",
      sourceTeamId: teamId,
      metadata: { ticker: teams[idx].ticker },
      createdAt: new Date().toISOString(),
    });

    return DirectiveSchema.parse(directive);
  },

  async getDirectives(teamId: string): Promise<Directive[]> {
    await delay(100);
    return directives.filter((d) => d.teamId === teamId);
  },

  async executeTrade(
    teamId: string,
    data: TradeRequest,
  ): Promise<{ success: boolean; transactionId: string }> {
    await delay(200);
    const teamIdx = teams.findIndex((t) => t.id === teamId);
    if (teamIdx === -1) throw new Error("Team not found");

    const tickerIdx = mockMarketTickers.findIndex(
      (t) => t.ticker === data.targetTicker,
    );
    if (tickerIdx === -1) throw new Error("Ticker not found");

    const price = mockMarketTickers[tickerIdx].price;
    const totalCost = data.shares * price;

    if (data.action === "buy") {
      if (teams[teamIdx].cash < totalCost) {
        throw new Error("Insufficient cash");
      }
      teams[teamIdx].cash -= totalCost;
    } else {
      teams[teamIdx].cash += totalCost;
    }

    return { success: true, transactionId: createMockUUID() };
  },

  async getMarketTickers(): Promise<MarketTicker[]> {
    await delay(50);
    return mockMarketTickers;
  },

  async getNewsItems(limit = 20): Promise<NewsItem[]> {
    await delay(50);
    return newsItems.slice(0, limit);
  },

  async getSectorHeatmap(): Promise<SectorHeatmap[]> {
    await delay(50);
    return mockSectors;
  },

  async injectNews(data: NewsInjectRequest): Promise<NewsItem> {
    await delay(200);
    const newItem: NewsItem = {
      id: createMockUUID(),
      headline: data.headline,
      content: null,
      sourceType: "GLOBAL",
      sourceTeamId: null,
      metadata: {
        ticker: "$MARKET",
        priceChange: data.impact === "bullish" ? 1 : -1,
      },
      createdAt: new Date().toISOString(),
    };
    newsItems.unshift(newItem);
    return newItem;
  },

  async adminGetMetrics(): Promise<AdminMetrics> {
    await delay(100);
    const activeTeams = teams.filter((t) => t.status === "ACTIVE").length;
    return {
      ...mockAdminMetrics,
      activeTeams,
      llmQueueDepth: directives.filter((d) => d.status === "PROCESSING").length,
    };
  },

  async adminGetLLMStats(): Promise<LLMStats> {
    await delay(50);
    return mockLLMStats;
  },

  async adminGetMarketStats(): Promise<MarketStats> {
    await delay(50);
    return mockMarketStats;
  },

  async getPortfolios(): Promise<Portfolio[]> {
    await delay(50);
    return Object.values(mockPortfolios).map((p) => PortfolioSchema.parse(p));
  },

  async getPendingTeams(): Promise<Team[]> {
    await delay(100);
    return teams.filter((t) => t.status === "PENDING");
  },

  async startGame(): Promise<GameState> {
    await delay(500);
    gameState = {
      ...gameState,
      status: "ACTIVE",
      sessionStartTime: new Date().toISOString(),
    };
    return GameStateSchema.parse(gameState);
  },

  async pauseGame(): Promise<GameState> {
    await delay(300);
    gameState = { ...gameState, status: "PAUSED" };
    return GameStateSchema.parse(gameState);
  },

  async endGame(): Promise<GameState> {
    await delay(500);
    gameState = { ...gameState, status: "ENDED" };
    return GameStateSchema.parse(gameState);
  },

  async initiatePurge(): Promise<{ eliminated: string[]; survivors: number }> {
    await delay(1000);
    const activeTeams = teams.filter((t) => t.status === "ACTIVE");
    const toEliminate = Math.floor(activeTeams.length / 2);

    const sorted = [...activeTeams].sort((a, b) => {
      const aScore = (a.marketCap || 0) + (a.liquidity || 0);
      const bScore = (b.marketCap || 0) + (b.liquidity || 0);
      return bScore - aScore;
    });

    const eliminated = sorted.slice(0, toEliminate).map((t) => t.ticker);
    const survivors = activeTeams.length - toEliminate;

    sorted.slice(0, toEliminate).forEach((t) => {
      const idx = teams.findIndex((team) => team.id === t.id);
      if (idx !== -1) {
        teams[idx] = { ...teams[idx], status: "ELIMINATED", stockPrice: 0 };
      }
    });

    gameState = { ...gameState, survivingTeams: survivors };

    return { eliminated, survivors };
  },
};

export default api;
