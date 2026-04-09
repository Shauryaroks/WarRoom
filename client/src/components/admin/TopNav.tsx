interface TopNavProps {
  serverTime?: string;
  eventId?: string;
}

export function TopNav({
  serverTime = "--:--:-- UTC",
  eventId = "CAMPUS_2026_Q2",
}: TopNavProps) {
  return (
    <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-[#0a0a0a] border-b border-white/5">
      <div className="flex items-center gap-8">
        <span className="text-xl font-bold tracking-tighter text-[#FFB000] font-mono">
          COMPLEX: ADMIN_CONSOLE
        </span>
        <nav className="hidden md:flex gap-1 text-[11px] items-center">
          <a
            className="px-3 py-1 bg-white/5 border border-white/10 text-white"
            href="#"
          >
            REGISTER
          </a>
          <span className="text-zinc-700">|</span>
          <a className="px-3 py-1 text-zinc-500 hover:text-white" href="#">
            AUDIT
          </a>
          <span className="text-zinc-700">|</span>
          <a className="px-3 py-1 text-zinc-500 hover:text-white" href="#">
            LIQUIDATE
          </a>
          <span className="text-zinc-700">|</span>
          <a className="px-3 py-1 text-zinc-500 hover:text-white" href="#">
            PURGE
          </a>
        </nav>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-zinc-500">
            SERVER_TIME: {serverTime}
          </span>
          <span className="text-[10px] text-[#FFB000]">
            EVENT_ID: {eventId}
          </span>
        </div>
        <div className="flex gap-4">
          <span className="material-symbols-outlined text-zinc-500 hover:text-[#FFB000] cursor-pointer text-xl">
            database
          </span>
          <span className="material-symbols-outlined text-zinc-500 hover:text-[#FFB000] cursor-pointer text-xl">
            shield
          </span>
        </div>
      </div>
    </header>
  );
}
