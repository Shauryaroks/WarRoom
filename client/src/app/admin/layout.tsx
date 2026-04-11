"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { href: "/admin", label: "War Room", icon: "radar", count: null },
    { href: "/admin/teams", label: "Approvals", icon: "fact_check", count: 12 },
    {
      href: "/admin/market",
      label: "News Inject",
      icon: "campaign",
      count: null,
    },
    {
      href: "/admin/settings",
      label: "Metrics",
      icon: "monitoring",
      count: null,
    },
    { href: "/admin/logs", label: "Logs", icon: "receipt_long", count: null },
  ];

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-[#e5e5e5] font-['Inter',sans-serif] overflow-hidden">
      {/* Left Sidebar */}
      <aside className="w-[240px] flex-shrink-0 bg-[#0a0a0a] border-r border-[#2a2a2a] flex flex-col z-20">
        <div className="h-16 flex items-center px-6 border-b border-[#2a2a2a]">
          <span className="material-symbols-outlined text-[#ffb000] mr-3">
            bolt
          </span>
          <span className="font-bold text-base text-[#e5e5e5] tracking-widest font-['JetBrains_Mono',monospace]">
            COMPLEX
          </span>
        </div>

        <nav className="flex-1 py-6 flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href === "/admin" && pathname === "/admin/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-6 py-3 transition-colors duration-150 relative ${
                  isActive
                    ? "bg-[#1a1a1a] text-[#e5e5e5]"
                    : "text-[#9ca3af] hover:bg-[#161616] hover:text-[#e5e5e5]"
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#ffb000]"></div>
                )}
                <div className="flex items-center">
                  <span className="material-symbols-outlined text-[20px] mr-4 opacity-80">
                    {item.icon}
                  </span>
                  <span className="text-[13px] font-medium tracking-wide">
                    {item.label}
                  </span>
                </div>
                {item.count !== null && (
                  <span className="bg-[#141414] border border-[#2a2a2a] text-[#9ca3af] text-[10px] font-['JetBrains_Mono',monospace] px-2 py-0.5 rounded-full font-bold">
                    {item.count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t border-[#2a2a2a]">
          <Link
            href="/"
            className="flex items-center text-[13px] font-medium text-[#9ca3af] hover:text-[#ff3333] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px] mr-3">
              logout
            </span>
            Exit Console
          </Link>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Header */}
        <header className="h-16 flex-shrink-0 border-b border-[#2a2a2a] bg-[#0a0a0a] flex items-center justify-between px-6 z-10">
          <div className="flex items-center space-x-3 text-[12px] font-['JetBrains_Mono',monospace] font-bold">
            <span className="text-[#505050]">[SETUP]</span>
            <span className="text-[#505050]">→</span>
            <span className="text-[#ffb000]">[ACTIVE]</span>
            <span className="text-[#505050]">→</span>
            <span className="text-[#505050]">[PURGE]</span>
            <span className="text-[#505050]">→</span>
            <span className="text-[#505050]">[FINISHED]</span>
          </div>

          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 rounded-full bg-[#00c853] animate-pulse"></div>
            <span className="text-[12px] font-['JetBrains_Mono',monospace] text-[#00c853] uppercase font-bold tracking-wider">
              Connected
            </span>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 bg-[#0a0a0a]">
          {children}
        </main>

        {/* Footer Log */}
        <footer className="h-8 flex-shrink-0 border-t border-[#2a2a2a] bg-[#0a0a0a] flex items-center overflow-hidden z-10 group">
          <div
            className="whitespace-nowrap font-['JetBrains_Mono',monospace] text-[11px] text-[#6b7280] flex gap-4 animate-[ticker_20s_linear_infinite] group-hover:[animation-play-state:paused]"
            style={{ paddingLeft: "100%" }}
          >
            <span>SYS_INIT: OK</span>
            <span className="text-[#2a2a2a]">│</span>
            <span>LLM_QUEUE: 0</span>
            <span className="text-[#2a2a2a]">│</span>
            <span>$BARB REJECTED TRADE (LIMIT_EXCEEDED)</span>
            <span className="text-[#2a2a2a]">│</span>
            <span>$WAYN DIRECTIVE_PROCESSED (2.4s)</span>
            <span className="text-[#2a2a2a]">│</span>
            <span>GLOBAL_TICK: 14592</span>
            <span className="text-[#2a2a2a]">│</span>
            <span>AUTO_PURGE: DISABLED</span>
            <span className="text-[#2a2a2a]">│</span>
            <span>SYS_INIT: OK</span>
            <span className="text-[#2a2a2a]">│</span>
            <span>LLM_QUEUE: 0</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
