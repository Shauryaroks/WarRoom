"use client";

import { useState, useEffect } from "react";
import type { CrisisPayload } from "@/lib/types";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

interface CrisisOverlayProps {
  crisis: CrisisPayload;
}

export function CrisisOverlay({ crisis }: CrisisOverlayProps) {
  const [remaining, setRemaining] = useState(() => {
    const elapsed = Math.floor(
      (Date.now() - new Date(crisis.started_at).getTime()) / 1000
    );
    return Math.max(0, crisis.timer_seconds - elapsed);
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor(
        (Date.now() - new Date(crisis.started_at).getTime()) / 1000
      );
      const next = Math.max(0, crisis.timer_seconds - elapsed);
      setRemaining(next);
      if (next <= 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [crisis.started_at, crisis.timer_seconds]);

  return (
    <div className="fixed inset-0 z-50 bg-red-950/80 backdrop-blur-sm flex items-center justify-center">
      <div className="border border-red-500/50 bg-[#131313] px-10 py-8 max-w-2xl w-full mx-4 space-y-6">
        {/* Title */}
        <div className="text-center">
          <div className="font-mono text-3xl font-bold text-red-400 tracking-wider">
            CRISIS EVENT
          </div>
        </div>

        {/* Timer */}
        <div className="text-center">
          <div className="font-mono text-lg text-red-200/80 tabular-nums">
            {formatTime(remaining)}
          </div>
        </div>

        {/* Scenario text */}
        <div className="text-sm text-[#e5e2e1] leading-relaxed text-center">
          {crisis.scenario}
        </div>

        {/* Instruction */}
        <div className="text-center">
          <p className="text-xs text-[#89919d]">
            Submit your crisis response in the Solutions tab
          </p>
        </div>
      </div>
    </div>
  );
}
