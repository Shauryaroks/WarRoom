"use client";

interface ConnectionIndicatorProps {
  isConnected: boolean;
}

export function ConnectionIndicator({ isConnected }: ConnectionIndicatorProps) {
  return (
    <div className="fixed bottom-4 left-4 flex items-center gap-2">
      <div
        className={`w-1.5 h-1.5 rounded-full ${
          isConnected ? "bg-[#00C853]" : "bg-[#FF1744]"
        }`}
      />
      <span className="font-mono text-xs text-muted-foreground">
        {isConnected ? "Connected" : "Reconnecting..."}
      </span>
    </div>
  );
}
