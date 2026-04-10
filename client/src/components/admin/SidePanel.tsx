interface SidePanelProps {
  pendingTeams?: string[];
}

export function SidePanel({
  pendingTeams = ["STARK_INDUSTRIES (PENDING)", "OSCORP_TECH (PENDING)"],
}: SidePanelProps) {
  return (
    <div className="w-80 bg-[#0f0f0f] border-l border-white/5 flex flex-col">
      {/* Portfolio Assignment */}
      <div className="p-6 border-b border-white/5">
        <h3 className="text-[10px] font-bold text-[#FFB000] mb-6 flex items-center gap-2 uppercase">
          <span className="material-symbols-outlined text-sm">
            assignment_ind
          </span>
          PORTFOLIO_ASSIGNMENT
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-[9px] text-zinc-500 mb-2 block uppercase">
              SELECT TEAM...
            </label>
            <select className="w-full bg-black border border-white/10 text-[10px] p-2 outline-none focus:border-[#00c853] uppercase cursor-pointer">
              <option>SELECT_TEAM...</option>
              {pendingTeams.map((team, i) => (
                <option key={i}>{team}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[9px] text-zinc-500 mb-2 block uppercase">
              ASSIGN_STARTING_PROFILE
            </label>
            <select className="w-full bg-black border border-white/10 text-[10px] p-2 outline-none focus:border-[#00c853] uppercase cursor-pointer">
              <option>Tech Startup</option>
              <option>Legacy Manufacturer</option>
              <option>D2C Disruptor</option>
              <option>Conglomerate</option>
            </select>
          </div>
          <button className="w-full bg-[#00c853] py-3 text-[10px] font-bold text-black border border-[#00c853]/20 hover:brightness-110 uppercase cursor-pointer">
            ACTIVATE_TEAM
          </button>
        </div>
      </div>

      {/* Game Controls */}
      <GameControls />
    </div>
  );
}

function GameControls() {
  return (
    <div className="p-6 flex-1 bg-black/20">
      <h3 className="text-[10px] font-bold text-[#FFB000] mb-6 flex items-center gap-2 uppercase">
        <span className="material-symbols-outlined text-sm">
          settings_remote
        </span>
        GAME_CONTROL
      </h3>
      <div className="space-y-3">
        <button className="w-full bg-[#00c853]/10 border border-[#00c853] text-[#00c853] py-4 text-[11px] font-bold hover:bg-[#00c853] hover:text-black transition-all flex items-center justify-center gap-2 uppercase cursor-pointer">
          <span className="material-symbols-outlined text-sm">play_circle</span>
          START_GAME_SESSION
        </button>
        <button className="w-full bg-[#FFB000]/10 border border-[#FFB000] text-[#FFB000] py-3 text-[10px] font-bold hover:bg-[#FFB000] hover:text-black transition-all flex items-center justify-center gap-2 uppercase cursor-pointer">
          <span className="material-symbols-outlined text-sm">
            pause_circle
          </span>
          PAUSE_TRADING
        </button>
        <button className="w-full bg-white/5 border border-white/20 text-zinc-400 py-3 text-[10px] font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2 uppercase cursor-pointer">
          <span className="material-symbols-outlined text-sm">cancel</span>
          END_EVENT
        </button>
        <div className="pt-6">
          <button className="w-full bg-[#ff3333] text-white py-5 text-[11px] font-bold border border-[#ff3333]/50 flex items-center justify-center gap-2 uppercase cursor-pointer">
            <span className="material-symbols-outlined text-sm">warning</span>
            INITIATE_PURGE
          </button>
        </div>
      </div>
    </div>
  );
}
