interface HeaderBarProps {
  sessionElapsed?: string;
  timerSeq?: string;
  nextPurge?: string;
}

export function HeaderBar({
  sessionElapsed = "00:00:00",
  timerSeq = "00:00:00",
  nextPurge = "-- MIN",
}: HeaderBarProps) {
  return (
    <header className="fixed top-0 left-0 w-full px-4 h-10 z-50 bg-[#131313] flex justify-between items-center border-b border-[#353534]">
      <div className="flex items-center gap-6">
        <span className="font-bold text-lg text-[#FFB000] tracking-tighter">
          COMPLEX
        </span>
        <div className="h-4 w-px bg-[#353534]"></div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[9px] text-zinc-500 uppercase">
              SESSION ELAPSED
            </span>
            <span className="text-[#FFB000] font-bold">{sessionElapsed}</span>
          </div>
          <div className="flex flex-col border-l border-[#353534] pl-4">
            <span className="text-[9px] text-zinc-500 uppercase">
              TIMER_SEQ
            </span>
            <span className="text-white">{timerSeq}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-8">
        <div className="flex flex-col items-end">
          <span className="text-[9px] text-zinc-500 uppercase">NEXT PURGE</span>
          <span className="text-[#ff3333] font-bold">{nextPurge}</span>
        </div>
        <div className="flex items-center gap-2 bg-black px-3 py-1 border border-[#353534]">
          <div className="w-1.5 h-1.5 bg-[#00c853] animate-pulse"></div>
          <span className="text-[10px] uppercase">SYSTEM: STABLE</span>
        </div>
        <div className="flex gap-2">
          <button className="text-zinc-500 hover:text-white p-1">
            <span className="material-symbols-outlined">timer</span>
          </button>
          <button className="text-zinc-500 hover:text-white p-1">
            <span className="material-symbols-outlined">account_tree</span>
          </button>
          <button className="text-zinc-500 hover:text-white p-1">
            <span className="material-symbols-outlined">notifications</span>
          </button>
        </div>
      </div>
    </header>
  );
}
