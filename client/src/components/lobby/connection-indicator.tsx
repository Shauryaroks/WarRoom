"use client";

interface ConnectionIndicatorProps {
  isConnected: boolean;
}

export function ConnectionIndicator({ isConnected }: ConnectionIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 ${isConnected ? 'bg-[#40e56c]' : 'bg-[#FF1744]'}`} />
      <span className={`text-[10px] font-mono uppercase ${isConnected ? 'text-[#40e56c]' : 'text-[#FF1744]'}`}>
        {isConnected ? 'Connection stable' : 'Disconnected'}
      </span>
    </div>
  );
}
