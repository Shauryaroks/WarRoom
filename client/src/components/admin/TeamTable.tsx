export type TeamStatus =
  | "ACTIVE"
  | "PENDING"
  | "COOLDOWN"
  | "BANKRUPT"
  | "ELIMINATED";

export interface Team {
  name: string;
  ticker: string;
  status: TeamStatus;
  liquidity: string;
  mktCap: string;
  lastDirective: string;
}

interface TeamTableProps {
  teams: Team[];
  filter: string;
  onFilterChange: (filter: string) => void;
}

export function TeamTable({ teams, filter, onFilterChange }: TeamTableProps) {
  const filters = [
    "ALL",
    "ACTIVE",
    "COOLDOWN",
    "BANKRUPT",
    "ELIMINATED",
    "PENDING_APPROVAL",
  ];

  const getStatusBadge = (status: TeamStatus) => {
    const styles: Record<TeamStatus, string> = {
      ACTIVE: "text-[#00c853] border border-[#00c853]/30 bg-[#00c853]/10",
      PENDING: "text-zinc-400 border border-white/10 bg-white/5",
      COOLDOWN: "text-[#FFB000] border border-[#FFB000]/30 bg-[#FFB000]/10",
      ELIMINATED: "text-[#ff3333] border border-[#ff3333]/30 bg-[#ff3333]/10",
      BANKRUPT: "text-[#ff3333] border border-[#ff3333]/30 bg-[#ff3333]/10",
    };
    return styles[status];
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0a0a0a] overflow-hidden">
      <div className="p-4 bg-[#0f0f0f] border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex gap-4">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => onFilterChange(f.toLowerCase())}
                className={`text-[11px] py-1 cursor-pointer ${
                  filter === f.toLowerCase()
                    ? "text-[#FFB000] font-bold border-b-2 border-[#FFB000]"
                    : "text-zinc-600 hover:text-zinc-400"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="flex items-center bg-black px-2 py-1 border border-white/10 gap-2">
              <span className="material-symbols-outlined text-xs text-zinc-500">
                search
              </span>
              <input
                className="bg-transparent border-none focus:ring-0 text-[10px] w-32 outline-none uppercase"
                placeholder="FILTER_TEAM..."
                type="text"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-[#1a1a1a] z-10">
            <tr className="text-[10px] text-zinc-500 font-bold border-b border-white/5 uppercase">
              <th className="px-4 py-3">TEAM_NAME</th>
              <th className="px-4 py-3">TICKER</th>
              <th className="px-4 py-3">STATUS</th>
              <th className="px-4 py-3 text-right">LIQUIDITY</th>
              <th className="px-4 py-3 text-right">MKT_CAP</th>
              <th className="px-4 py-3">LAST_DIRECTIVE</th>
              <th className="px-4 py-3 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="text-[10px]">
            {teams.map((team, i) => (
              <tr
                key={i}
                className={`border-b border-white/5 hover:bg-white/5 ${team.status === "ELIMINATED" ? "opacity-40" : ""}`}
              >
                <td className="px-4 py-3 font-bold text-white">{team.name}</td>
                <td className="px-4 py-3 text-[#FFB000] font-bold">
                  {team.ticker}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`border px-2 py-0.5 text-[9px] ${getStatusBadge(team.status)}`}
                  >
                    {team.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">{team.liquidity}</td>
                <td className="px-4 py-3 text-right">{team.mktCap}</td>
                <td className="px-4 py-3 text-zinc-500 italic truncate max-w-[150px]">
                  {team.lastDirective}
                </td>
                <td className="px-4 py-3 text-right space-x-1">
                  <button className="bg-[#2196F3]/10 text-[#2196F3] border border-[#2196F3]/30 px-2 py-1 hover:bg-[#2196F3] hover:text-white text-[9px] uppercase cursor-pointer">
                    VIEW DOSSIER
                  </button>
                  {team.status === "ACTIVE" && (
                    <>
                      <button className="bg-[#FFB000]/10 text-[#FFB000] border border-[#FFB000]/30 px-2 py-1 hover:bg-[#FFB000] hover:text-black text-[9px] uppercase cursor-pointer">
                        FORCE BANKRUPT
                      </button>
                      <button className="bg-[#ff3333]/10 text-[#ff3333] border border-[#ff3333]/30 px-2 py-1 hover:bg-[#ff3333] hover:text-white text-[9px] uppercase cursor-pointer">
                        ELIMINATE
                      </button>
                    </>
                  )}
                  {team.status === "PENDING" && (
                    <>
                      <button className="bg-[#00c853]/10 text-[#00c853] border border-[#00c853]/30 px-2 py-1 hover:bg-[#00c853] hover:text-white text-[9px] uppercase cursor-pointer">
                        APPROVE
                      </button>
                      <button className="bg-[#ff3333]/10 text-[#ff3333] border border-[#ff3333]/30 px-2 py-1 hover:bg-[#ff3333] hover:text-white text-[9px] uppercase cursor-pointer">
                        REJECT
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
