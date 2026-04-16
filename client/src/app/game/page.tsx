"use client";

import { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuthStore } from "@/stores/auth-store";
import { useGameStore } from "@/stores/game-store";
import { useMarketStore } from "@/stores/market-store";
import { useTradingStore } from "@/stores/trading-store";
import { useWebSocket } from "@/hooks/use-websocket";
import { api } from "@/lib/api";
import type { GameStatePayload, PriceTickData, NewsItem } from "@/lib/types";

import { GameHeader } from "@/components/game/GameHeader";
import { GameSidebar, type SidebarTab } from "@/components/game/GameSidebar";
import { CandlestickChart } from "@/components/game/CandlestickChart";
import { CompanyTabs } from "@/components/game/CompanyTabs";
import { PriceOverlay } from "@/components/game/PriceOverlay";
import { TradingPanel } from "@/components/game/TradingPanel";
import { PortfolioTable } from "@/components/game/PortfolioTable";
import { CaselinePanel } from "@/components/game/CaselinePanel";
import { SolutionsPanel } from "@/components/game/SolutionsPanel";
import { NewsOverlay } from "@/components/game/NewsOverlay";

export default function GamePage() {
  const router = useRouter();
  const { isAuthenticated, role } = useAuthStore();
  const status = useGameStore((s) => s.status);
  const selectedCompanyId = useMarketStore((s) => s.selectedCompanyId);
  const candles = useMarketStore((s) => s.candles);

  // Default tab based on role
  const [activeTab, setActiveTab] = useState<SidebarTab>(
    role === "trader" ? "TRADING" : "CASELINE"
  );
  const [newsOpen, setNewsOpen] = useState(false);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isAuthenticated, router]);

  // Load initial game state and redirect to lobby if game hasn't started
  const [gameStateLoaded, setGameStateLoaded] = useState(false);
  useEffect(() => {
    if (!isAuthenticated) return;
    api.getGameState()
      .then((state) => {
        useGameStore.getState().setGameState({
          status: state.status as GameStatePayload["status"],
          elapsed_seconds: state.elapsed_seconds,
          current_round: state.current_round,
        });
        setGameStateLoaded(true);
        if (state.status === "SETUP") {
          router.push("/lobby");
        }
      })
      .catch(() => setGameStateLoaded(true));
  }, [isAuthenticated, router]);

  // Load initial data on mount
  useEffect(() => {
    if (!isAuthenticated) return;

    // Fetch companies
    api.getCompanies()
      .then((companies) => {
        useMarketStore.getState().setCompanies(companies);
        // Auto-select first company if none selected
        if (!useMarketStore.getState().selectedCompanyId && companies.length > 0) {
          useMarketStore.getState().selectCompany(companies[0].team_id);
        }
      })
      .catch(() => { /* Market data unavailable */ });

    // Fetch portfolio
    api.getPortfolio()
      .then((data) => {
        useTradingStore.getState().setPortfolio(data);
      })
      .catch(() => { /* Portfolio unavailable */ });
  }, [isAuthenticated]);

  // Fetch price history when selected company changes
  useEffect(() => {
    if (!selectedCompanyId || !isAuthenticated) return;

    api.getPriceHistory(selectedCompanyId)
      .then((history) => {
        useMarketStore.getState().loadPriceHistory(selectedCompanyId, history);
      })
      .catch(() => { /* Price history unavailable */ });
  }, [selectedCompanyId, isAuthenticated]);

  // Handle WebSocket messages
  const handleMessage = useCallback((data: Record<string, unknown>) => {
    const type = data.type as string;

    switch (type) {
      case "price_update": {
        const payload = data.payload as { prices: PriceTickData[] };
        if (payload?.prices) {
          useMarketStore.getState().handlePriceUpdate(payload.prices);
        }
        break;
      }
      case "trade_executed": {
        // Refresh portfolio on any trade execution
        api.getPortfolio()
          .then((portfolio) => {
            useTradingStore.getState().setPortfolio(portfolio);
          })
          .catch(() => { /* Portfolio refresh failed */ });
        break;
      }
      case "game_state_changed":
      case "game_started": {
        const payload = data.payload as GameStatePayload;
        if (payload) {
          useGameStore.getState().setGameState(payload);
        }
        break;
      }
      case "news_injected":
      case "broadcast_message": {
        // Push to news overlay if it has the addItem handler registered
        const newsPayload = data.payload as NewsItem;
        if (newsPayload && typeof window !== "undefined") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const addItem = (window as any).__newsOverlayAddItem;
          if (typeof addItem === "function") {
            addItem(newsPayload);
          }
        }
        break;
      }
    }
  }, []);

  useWebSocket({
    onMessage: handleMessage,
    enabled: isAuthenticated,
  });

  if (!isAuthenticated || status === "SETUP") {
    return null;
  }

  // Get candle data for selected company
  const chartData = selectedCompanyId ? (candles[selectedCompanyId] || []) : [];

  // Render sidebar content based on active tab
  function renderSidebarContent() {
    switch (activeTab) {
      case "CASELINE":
        return <CaselinePanel />;
      case "TRADING":
        return (
          <div className="flex flex-col h-full overflow-y-auto">
            <TradingPanel />
            <div className="border-t border-[#404752]/20">
              <PortfolioTable />
            </div>
          </div>
        );
      case "SOLUTIONS":
        return <SolutionsPanel />;
      default:
        return null;
    }
  }

  return (
    <div className="bg-[#131313] min-h-screen flex flex-col">
      {/* Pause overlay */}
      {status === "PAUSED" && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="border border-[#9ecaff]/30 bg-[#131313] px-8 py-6 text-center">
            <div className="font-mono text-2xl font-bold text-[#9ecaff]">GAME PAUSED</div>
            <p className="mt-2 text-sm text-[#89919d]">Waiting for admin to resume...</p>
          </div>
        </div>
      )}

      {/* Header */}
      <GameHeader />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar -- 80px icon tabs */}
        <GameSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onToggleNews={() => setNewsOpen((prev) => !prev)}
          newsOpen={newsOpen}
          role={role}
        />

        {/* Sidebar content panel -- 256px on md, 320px on lg+ */}
        <div className="w-64 lg:w-80 bg-[#1c1b1b] border-r border-[#2a2a2a] overflow-y-auto shrink-0">
          {renderSidebarContent()}
        </div>

        {/* Chart area -- flex-1 */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Company tabs */}
          <CompanyTabs />

          {/* Chart with price overlay */}
          <div className="flex-1 relative">
            <PriceOverlay />
            <CandlestickChart data={chartData} />
          </div>
        </div>
      </div>

      {/* Floating news overlay */}
      <NewsOverlay isOpen={newsOpen} onClose={() => setNewsOpen(false)} />
    </div>
  );
}
