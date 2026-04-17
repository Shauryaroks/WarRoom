"use client";

interface Team {
  id: string;
  name: string;
  ticker: string;
}

interface TeamListProps {
  teams: Team[];
  currentTicker?: string | null;
}

export function TeamList({ teams, currentTicker }: TeamListProps) {
  if (teams.length === 0) {
    return (
      <div className="p-6 text-center font-mono text-xs text-gray-600 uppercase">NO_TEAMS_REGISTERED</div>
    );
  }

  return (
    <div className="overflow-y-auto max-h-64">
      <table className="w-full text-left border-collapse">
        <thead className="sticky top-0 bg-[#1c1b1b] text-[10px] uppercase font-bold text-[#bfc7d4] font-mono border-b border-[#404752]">
          <tr>
            <th className="py-3 px-6">Rank</th>
            <th className="py-3 px-6">Team Entity Name</th>
            <th className="py-3 px-6">Ticker ID</th>
            <th className="py-3 px-6">Auth Status</th>
          </tr>
        </thead>
        <tbody className="font-mono text-xs">
          {teams.map((team, i) => {
            const isCurrentTeam = currentTicker && team.ticker === currentTicker;
            return (
              <tr
                key={team.id}
                className={isCurrentTeam
                  ? "bg-[#2196f3]/5 hover:bg-[#2196f3]/10 transition-colors border-l-2 border-[#2196f3]"
                  : "hover:bg-[#2a2a2a] transition-colors"
                }
              >
                <td className="py-3 px-6 text-[#bfc7d4]">{String(i + 1).padStart(3, '0')}</td>
                <td className="py-3 px-6 font-bold text-white uppercase">{team.name}</td>
                <td className="py-3 px-6">
                  <span className={`px-2 py-0.5 ${isCurrentTeam ? 'bg-[#2196f3] text-white' : 'bg-[#2a2a2a] text-[#2196f3]'}`}>
                    {team.ticker}
                  </span>
                </td>
                <td className="py-3 px-6 text-[#40e56c]">APPROVED</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
