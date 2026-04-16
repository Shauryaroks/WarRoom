"use client";

export function EliminatedBanner() {
  return (
    <div className="bg-red-900/50 border-b border-red-500/30 px-4 py-2 text-center">
      <span className="font-mono text-sm text-red-400 font-bold tracking-wider">
        ELIMINATED
      </span>
      <span className="mx-3 text-red-500/30">|</span>
      <span className="text-xs text-red-300/60">
        Read-only mode -- you can observe but cannot trade or submit
      </span>
    </div>
  );
}
