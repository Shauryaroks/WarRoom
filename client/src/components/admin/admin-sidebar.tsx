"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  TrendingUp,
  Newspaper,
  Settings,
  Activity,
  Gauge,
  LogOut,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";

interface AdminSidebarProps {
  activePath: string;
}

const NAV_ITEMS = [
  { href: "/admin", icon: LayoutDashboard, label: "DASHBOARD", exact: true },
  { href: "/admin/teams", icon: Users, label: "TEAMS", exact: false },
  { href: "/admin/evaluations", icon: ClipboardCheck, label: "EVALS", exact: false },
  { href: "/admin/fundamentals", icon: Gauge, label: "FUND", exact: false },
  { href: "/admin/markets", icon: TrendingUp, label: "MARKETS", exact: false },
  { href: "/admin/news", icon: Newspaper, label: "NEWS", exact: false },
  { href: "/admin/settings", icon: Settings, label: "SETTINGS", exact: false },
  { href: "/admin/activity", icon: Activity, label: "ACTIVITY", exact: false },
] as const;

export function AdminSidebar({ activePath }: AdminSidebarProps) {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  function handleLogout() {
    logout();
    router.push("/admin/login");
  }

  return (
    <aside className="fixed left-0 top-14 bottom-0 flex flex-col items-center py-4 z-40 bg-[#0e0e0e] w-20">
      <nav className="flex flex-col w-full gap-1 mt-2">
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact
            ? activePath === item.href
            : activePath.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`w-full py-5 flex flex-col items-center gap-2 transition-all active:scale-95 ${
                isActive
                  ? "bg-[#2196f3]/10 text-[#2196f3] border-l-2 border-[#2196f3]"
                  : "text-gray-600 hover:bg-[#2a2a2a] border-l-2 border-transparent"
              }`}
            >
              <Icon size={22} />
              <span className="font-mono text-[11px] uppercase">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col items-center w-full px-2 pb-4">
        <button
          onClick={handleLogout}
          className="text-gray-600 hover:text-[#FF1744] transition-colors p-2"
          title="Logout"
        >
          <LogOut size={22} />
        </button>
      </div>
    </aside>
  );
}
