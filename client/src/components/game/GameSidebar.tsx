"use client";

import { BookOpen, TrendingUp, FileText, Newspaper } from "lucide-react";
import type { UserRole } from "@/lib/types";

export type SidebarTab = "CASELINE" | "TRADING" | "SOLUTIONS";

interface GameSidebarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  onToggleNews: () => void;
  newsOpen: boolean;
  role: UserRole | null;
}

interface TabConfig {
  id: SidebarTab;
  label: string;
  icon: typeof BookOpen;
  roles: UserRole[];
}

const TABS: TabConfig[] = [
  { id: "CASELINE", label: "CASELINE", icon: BookOpen, roles: ["strategist", "trader"] },
  { id: "TRADING", label: "TRADING", icon: TrendingUp, roles: ["trader"] },
  { id: "SOLUTIONS", label: "SOLUTIONS", icon: FileText, roles: ["strategist"] },
];

export function GameSidebar({ activeTab, onTabChange, onToggleNews, newsOpen, role }: GameSidebarProps) {
  const visibleTabs = TABS.filter((tab) => role && tab.roles.includes(role));

  return (
    <div className="flex flex-col w-20 bg-[#0e0e0e] border-r border-[#2a2a2a] shrink-0 h-full">
      <div className="flex flex-col flex-1 pt-2">
        {visibleTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center gap-1 py-3 px-1 transition-colors ${
                isActive
                  ? "bg-[#2196f3]/10 text-[#2196f3] border-l-2 border-[#2196f3]"
                  : "text-[#89919d] hover:bg-[#2a2a2a] border-l-2 border-transparent"
              }`}
            >
              <Icon size={18} />
              <span className="font-mono text-[9px] uppercase tracking-wide">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* News toggle -- not a tab, toggles overlay */}
      <button
        onClick={onToggleNews}
        className={`flex flex-col items-center justify-center gap-1 py-3 px-1 mb-2 transition-colors ${
          newsOpen
            ? "bg-[#2196f3]/10 text-[#2196f3]"
            : "text-[#89919d] hover:bg-[#2a2a2a]"
        }`}
      >
        <Newspaper size={18} />
        <span className="font-mono text-[9px] uppercase tracking-wide">NEWS</span>
      </button>
    </div>
  );
}
