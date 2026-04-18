import type { AdminTeam, BCGClassification } from "@/lib/types";

interface BCGMatrixCardProps {
  teams: AdminTeam[];
}

export function BCGMatrixCard({ teams }: BCGMatrixCardProps) {
  // Group teams by classification
  const groups: Record<NonNullable<BCGClassification>, AdminTeam[]> = {
    STAR: [],
    QUESTION_MARK: [],
    CASH_COW: [],
    DOG: [],
  };

  teams.forEach((team) => {
    if (team.bcg_classification && groups[team.bcg_classification]) {
      groups[team.bcg_classification].push(team);
    }
  });

  return (
    <div className="bg-[#1c1b1b] border border-[#2a2a2a] p-4 flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-mono text-sm font-bold text-[#9ecaff] tracking-widest uppercase">
          BCG_PORTFOLIO_MATRIX
        </h3>
        <span className="font-mono text-xs text-gray-500">
          ACTIVE_COMPANIES: {teams.filter((t) => t.bcg_classification).length}
        </span>
      </div>

      <div className="flex-1 relative border-l-2 border-b-2 border-gray-600/50 pt-2 pr-2">
        {/* Y Axis Label */}
        <div className="absolute -left-8 top-1/2 -translate-y-1/2 -rotate-90 font-mono text-[10px] text-gray-500 tracking-widest whitespace-nowrap">
          MARKET_GROWTH_RATE
        </div>
        {/* X Axis Label */}
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 font-mono text-[10px] text-gray-500 tracking-widest">
          RELATIVE_MARKET_SHARE
        </div>

        <div className="grid grid-cols-2 grid-rows-2 h-full gap-2 relative">
          {/* Quadrant Dividers */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-full h-px bg-gray-600/30 border-dashed border-b border-gray-600/50"></div>
            <div className="absolute h-full w-px bg-gray-600/30 border-dashed border-r border-gray-600/50"></div>
          </div>

          {/* Top Left: STAR */}
          <Quadrant
            title="STARS"
            teams={groups.STAR}
            color="text-[#ffeb3b]"
            bg="bg-[#ffeb3b]/10"
          />

          {/* Top Right: QUESTION MARK */}
          <Quadrant
            title="QUESTION_MARKS"
            teams={groups.QUESTION_MARK}
            color="text-[#ff9800]"
            bg="bg-[#ff9800]/10"
          />

          {/* Bottom Left: CASH COW */}
          <Quadrant
            title="CASH_COWS"
            teams={groups.CASH_COW}
            color="text-[#4caf50]"
            bg="bg-[#4caf50]/10"
          />

          {/* Bottom Right: DOG */}
          <Quadrant
            title="DOGS"
            teams={groups.DOG}
            color="text-[#f44336]"
            bg="bg-[#f44336]/10"
          />
        </div>
      </div>
    </div>
  );
}

function Quadrant({
  title,
  teams,
  color,
  bg,
}: {
  title: string;
  teams: AdminTeam[];
  color: string;
  bg: string;
}) {
  return (
    <div className={`p-2 flex flex-col ${bg} rounded overflow-hidden`}>
      <div className="flex justify-between items-center mb-2">
        <h4 className={`font-mono text-[10px] font-bold ${color}`}>{title}</h4>
        <span className={`font-mono text-[10px] ${color} opacity-70`}>
          [{teams.length}]
        </span>
      </div>
      <div className="flex-1 overflow-y-auto min-h-[60px] space-y-1 pr-1 custom-scrollbar">
        {teams.map((team) => (
          <div
            key={team.id}
            className="text-[10px] font-mono text-[#e5e2e1] truncate bg-black/20 px-1.5 py-0.5 rounded"
            title={team.name}
          >
            {team.name}
          </div>
        ))}
      </div>
    </div>
  );
}
