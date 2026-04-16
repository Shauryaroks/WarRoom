"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/stores/game-store";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { GameStatePayload } from "@/lib/types";

const CONFIG_ITEMS = [
  { label: "COOLDOWN_MINUTES", value: "10" },
  { label: "STARTING_CASH", value: "$1,000,000" },
  { label: "STARTING_PRICE", value: "$100.00" },
  { label: "STARTING_SHARES", value: "1,000,000" },
];

export default function SettingsPage() {
  const { status, currentRound, setGameState } = useGameStore();
  const [isAdvancing, setIsAdvancing] = useState(false);

  // Load game state on mount
  useEffect(() => {
    api
      .getGameState()
      .then((data) => {
        setGameState({
          status: data.status as GameStatePayload["status"],
          elapsed_seconds: data.elapsed_seconds,
          current_round: data.current_round,
        });
      })
      .catch(() => {});
  }, [setGameState]);

  async function handleAdvanceRound() {
    setIsAdvancing(true);
    try {
      const result = await api.advanceRound();
      setGameState({
        status: status,
        elapsed_seconds: 0,
        current_round: result.current_round,
      });
      toast.success(`Advanced to Q${result.current_round}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to advance round"
      );
    } finally {
      setIsAdvancing(false);
    }
  }

  const statusStyles =
    status === "ACTIVE"
      ? "text-[#40e56c] bg-[#40e56c]/10 border border-[#40e56c]/30"
      : status === "PAUSED"
        ? "text-[#9ecaff] bg-[#9ecaff]/10 border border-[#9ecaff]/30"
        : status === "FINISHED"
          ? "text-[#FF1744] bg-[#FF1744]/10 border border-[#FF1744]/30"
          : "text-[#89919d] bg-[#89919d]/10 border border-[#89919d]/30";

  const advanceDisabled =
    isAdvancing || status === "SETUP" || status === "FINISHED";

  return (
    <div className="flex flex-col gap-6 w-full">
      <h2 className="text-base font-black font-mono tracking-widest text-[#9ecaff] uppercase">
        GAME_SETTINGS
      </h2>

      {/* Section A: Round Management */}
      <div className="bg-[#1c1b1b] p-6 flex flex-col gap-6">
        <h3 className="text-sm font-bold font-mono tracking-widest text-gray-500 uppercase">
          ROUND_MANAGEMENT
        </h3>

        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-mono text-gray-500 uppercase tracking-widest">
              CURRENT_QUARTER
            </span>
            <span className="text-5xl font-bold font-mono text-[#e5e2e1]">
              Q{currentRound}
            </span>
          </div>

          <div className="flex flex-col items-end gap-2">
            <span className="text-sm font-mono text-gray-500 uppercase tracking-widest">
              STATUS
            </span>
            <span
              className={`font-mono text-sm font-bold px-3 py-1 ${statusStyles}`}
            >
              {status}
            </span>
          </div>
        </div>

        <button
          onClick={handleAdvanceRound}
          disabled={advanceDisabled}
          className="bg-[#2196f3] text-white px-8 py-3.5 font-mono text-sm font-bold uppercase hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed w-full"
        >
          {isAdvancing ? "ADVANCING..." : "ADVANCE_QUARTER"}
        </button>
      </div>

      {/* Section B: Game Configuration */}
      <div className="bg-[#1c1b1b] p-6 flex flex-col gap-5">
        <h3 className="text-sm font-bold font-mono tracking-widest text-gray-500 uppercase">
          GAME_CONFIGURATION
        </h3>

        <div className="flex flex-col gap-4">
          {CONFIG_ITEMS.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between py-3 border-b border-[#2a2a2a] last:border-b-0"
            >
              <span className="text-sm font-mono text-gray-500">
                {item.label}
              </span>
              <span className="text-base font-mono text-[#e5e2e1]">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
