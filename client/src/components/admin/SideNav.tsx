type Tab = "register" | "teams" | "wire" | "purge" | "settings";

interface SideNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function SideNav({ activeTab, onTabChange }: SideNavProps) {
  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "register", label: "REGISTRATION_QUEUE", icon: "content_paste" },
    { id: "teams", label: "ACTIVE_TEAMS", icon: "groups" },
    { id: "wire", label: "MARKET_WIRE", icon: "newspaper" },
    { id: "purge", label: "PURGE_CONTROL", icon: "bomb" },
    { id: "settings", label: "SYSTEM_SETTINGS", icon: "settings" },
  ];

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-[#0a0a0a] flex flex-col py-8 z-40 border-r border-white/5">
      <div className="px-6 mb-12 mt-12">
        <div className="flex items-center gap-3 p-3 bg-[#1a1a1a] border border-white/5">
          <div className="w-2 h-2 rounded-full bg-[#00c853] animate-pulse"></div>
          <div>
            <div className="text-[11px] font-bold text-[#0077b6]">
              SYSTEM_STATUS: ONLINE
            </div>
            <div className="text-[9px] text-zinc-500 tracking-widest">
              VERSION_PROD_4.2
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 flex flex-col text-xs tracking-widest">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-4 px-6 py-4 transition-all cursor-pointer ${
              activeTab === tab.id
                ? "text-[#0077b6] bg-white/5 border-l-2 border-[#0077b6]"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <span className="material-symbols-outlined text-sm">
              {tab.icon}
            </span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      <div className="px-6 py-6 border-t border-white/5 space-y-4">
        <div className="p-3 bg-black/40 border border-white/5 text-[9px] text-zinc-500 space-y-1">
          <div className="flex justify-between">
            <span>CPU_LOAD:</span>
            <span className="text-[#00c853]">12%</span>
          </div>
          <div className="flex justify-between">
            <span>NET_LAT:</span>
            <span className="text-[#00c853]">4MS</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
