"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import { useAuthStore } from "@/stores/auth-store";
import { useGameStore } from "@/stores/game-store";
import { useAdminStore } from "@/stores/admin-store";
import { useWebSocket } from "@/hooks/use-websocket";
import { api } from "@/lib/api";
import { TeamTable } from "@/components/admin/team-table";
import { toast } from "sonner";
import type {
  GameStatePayload,
  GamePhase,
  GamePhaseChangedPayload,
} from "@/lib/types";

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function AdminPage() {
  const router = useRouter();
  const { isAuthenticated, role } = useAuthStore();
  const { status, elapsedSeconds, currentRound, setGameState } = useGameStore();
  const { teams, setTeams, updateTeamStatus, removeTeam } = useAdminStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gamePhase, setGamePhase] = useState<GamePhase>(null);
  const [showMacroBriefModal, setShowMacroBriefModal] = useState(false);
  const [macroBriefText, setMacroBriefText] = useState("");

  // Redirect non-admin users
  useEffect(() => {
    if (!isAuthenticated || role !== "admin") {
      router.push("/admin/login");
    }
  }, [isAuthenticated, role, router]);

  // Load initial game state and teams on mount
  useEffect(() => {
    if (isAuthenticated && role === "admin") {
      api
        .getAdminGameState()
        .then((data) => {
          setGameState({
            status: data.status as GameStatePayload["status"],
            elapsed_seconds: data.elapsed_seconds,
            current_round: data.current_round,
          });
        })
        .catch(() => {
          // Will populate via WebSocket
        });

      api
        .getTeams()
        .then((data) => {
          setTeams(data);
        })
        .catch(() => {
          // Will retry via WebSocket events
        });

      // Fetch current game phase
      api
        .getGamePhase()
        .then((data) => {
          setGamePhase(data.game_phase);
        })
        .catch(() => {
          // Phase not available yet
        });
    }
  }, [isAuthenticated, role, setGameState, setTeams]);

  // Handle WebSocket messages
  const handleMessage = useCallback(
    (data: Record<string, unknown>) => {
      if (data.type === "game_state_changed" || data.type === "game_started") {
        const payload = data.payload as GameStatePayload;
        if (payload) {
          useGameStore.getState().setGameState(payload);
        }
      }

      if (data.type === "team_registered") {
        // Refresh the full team list
        api
          .getTeams()
          .then((freshTeams) => {
            setTeams(freshTeams);
          })
          .catch(() => {});
      }

      if (data.type === "team_removed") {
        const payload = data.payload as { team_id: string } | undefined;
        if (payload?.team_id) {
          removeTeam(payload.team_id);
        }
      }

      if (data.type === "game_phase_changed") {
        const payload = data.payload as GamePhaseChangedPayload | undefined;
        if (payload) {
          setGamePhase(payload.game_phase);
        }
      }
    },
    [setTeams, removeTeam],
  );

  useWebSocket({
    onMessage: handleMessage,
    enabled: isAuthenticated && role === "admin",
  });

  async function handleStart() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.startGame();
      setGameState({
        status: data.status as GameStatePayload["status"],
        elapsed_seconds: data.elapsed_seconds,
        current_round: data.current_round,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start game");
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePause() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.pauseGame();
      setGameState({
        status: data.status as GameStatePayload["status"],
        elapsed_seconds: data.elapsed_seconds,
        current_round: data.current_round,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to pause game");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResume() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.resumeGame();
      setGameState({
        status: data.status as GameStatePayload["status"],
        elapsed_seconds: data.elapsed_seconds,
        current_round: data.current_round,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resume game");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleApprove(teamId: string) {
    try {
      await api.approveTeam(teamId);
      updateTeamStatus(teamId, "READY");
      toast.success("Team approved");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to approve team",
      );
    }
  }

  async function handleReject(teamId: string) {
    try {
      await api.rejectTeam(teamId);
      updateTeamStatus(teamId, "REJECTED");
      toast.success("Team rejected");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject team");
    }
  }

  async function handleRemove(teamId: string) {
    try {
      const result = await api.removeTeam(teamId);
      if (result.remove_type === "hard") {
        removeTeam(teamId);
      } else {
        updateTeamStatus(teamId, "BANKRUPT");
      }
      toast.success(result.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove team");
    }
  }

  async function handleEnterWarRoom() {
    if (!macroBriefText.trim()) {
      toast.error("Macro brief is required before entering War Room");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.enterWarRoom(macroBriefText.trim());
      setGamePhase(data.game_phase);
      setShowMacroBriefModal(false);
      setMacroBriefText("");
      toast.success("Entered War Room");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to enter War Room");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleOpenLiveFloor() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.openLiveFloor();
      setGamePhase(data.game_phase);
      toast.success("Live Floor opened");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to open Live Floor",
      );
    } finally {
      setIsLoading(false);
    }
  }

  if (!isAuthenticated || role !== "admin") {
    return null;
  }

  const statusStyles =
    status === "ACTIVE"
      ? "text-[#40e56c] bg-[#40e56c]/10 border border-[#40e56c]/30"
      : status === "PAUSED"
        ? "text-[#9ecaff] bg-[#9ecaff]/10 border border-[#9ecaff]/30"
        : status === "FINISHED"
          ? "text-[#FF1744] bg-[#FF1744]/10 border border-[#FF1744]/30"
          : "text-[#89919d] bg-[#89919d]/10 border border-[#89919d]/30";

  const totalTeams = teams.length;
  const pendingCount = teams.filter((t) => t.status === "PENDING").length;
  const activeCount = teams.filter(
    (t) =>
      t.status !== "BANKRUPT" &&
      t.status !== "ELIMINATED" &&
      t.status !== "REJECTED" &&
      t.status !== "PENDING",
  ).length;

  return (
    <div className="grid grid-cols-12 gap-6 w-full">
      {/* Game Control Station */}
      <div className="col-span-12 lg:col-span-5 bg-[#1c1b1b] p-6 flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-black font-mono tracking-widest text-[#9ecaff] uppercase">
            GAME_CONTROL_STATION
          </h2>
          <span className="flex items-center gap-2 font-mono text-[11px] text-[#40e56c]">
            <span className="w-2 h-2 bg-[#40e56c] animate-pulse" /> SYSTEM_LIVE
          </span>
        </div>

        {/* Control buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={handleStart}
            disabled={isLoading || status !== "SETUP"}
            className="bg-[#02c953] text-[#003912] py-5 flex flex-col items-center justify-center gap-1 hover:brightness-110 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <span className="text-xl">&#9654;</span>
            <span className="font-mono text-[13px] font-bold">START</span>
          </button>
          <button
            onClick={handlePause}
            disabled={isLoading || status !== "ACTIVE"}
            className="bg-[#2a2a2a] text-[#e5e2e1] py-5 flex flex-col items-center justify-center gap-1 hover:brightness-125 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <span className="text-xl">&#9646;&#9646;</span>
            <span className="font-mono text-[13px] font-bold">PAUSE</span>
          </button>
          <button
            onClick={handleResume}
            disabled={isLoading || status !== "PAUSED"}
            className="bg-[#2a2a2a] text-[#e5e2e1] py-5 flex flex-col items-center justify-center gap-1 hover:brightness-125 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <span className="text-xl">&#8635;</span>
            <span className="font-mono text-[13px] font-bold">RESUME</span>
          </button>
        </div>

        {/* War Room / Live Floor controls */}
        {status === "ACTIVE" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[11px] text-gray-500 uppercase tracking-tighter">
                PHASE_CONTROL
              </span>
              {gamePhase === "war_room" && (
                <span className="font-mono text-[11px] font-bold px-2 py-0.5 text-[#f59e0b] bg-[#f59e0b]/10 border border-[#f59e0b]/30">
                  WAR ROOM
                </span>
              )}
              {gamePhase === "live_floor" && (
                <span className="font-mono text-[11px] font-bold px-2 py-0.5 text-[#4caf50] bg-[#4caf50]/10 border border-[#4caf50]/30">
                  LIVE FLOOR
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowMacroBriefModal(true)}
                disabled={isLoading || gamePhase === "war_room"}
                className="border border-[#f59e0b]/50 bg-[#f59e0b]/5 text-[#f59e0b] py-3 flex flex-col items-center justify-center gap-1 hover:bg-[#f59e0b]/10 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <span className="font-mono text-[12px] font-bold">
                  ENTER WAR ROOM
                </span>
              </button>
              <button
                onClick={handleOpenLiveFloor}
                disabled={isLoading || gamePhase === "live_floor"}
                className="border border-[#4caf50]/50 bg-[#4caf50]/5 text-[#4caf50] py-3 flex flex-col items-center justify-center gap-1 hover:bg-[#4caf50]/10 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <span className="font-mono text-[12px] font-bold">
                  OPEN LIVE FLOOR
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Broadcast input */}
        <div className="flex flex-col gap-2">
          <label className="font-mono text-[11px] text-gray-500 uppercase tracking-tighter">
            GLOBAL_BROADCAST_CHANNEL
          </label>
          <div className="relative">
            <textarea
              className="w-full bg-[#0e0e0e] border-l-2 border-[#2196f3] text-sm font-mono p-4 text-[#2196f3] h-24 placeholder:text-gray-800 focus:outline-none focus:ring-0"
              placeholder="ENTER MESSAGE TO ALL TEAMS..."
              disabled
            />
            <span className="absolute bottom-4 right-4 font-mono text-[9px] text-gray-600 uppercase">
              COMING_SOON
            </span>
          </div>
        </div>
      </div>

      {/* Status + Timer panel */}
      <div className="col-span-12 lg:col-span-7 bg-[#1c1b1b] p-6">
        <h2 className="text-base font-black font-mono tracking-widest text-[#9ecaff] uppercase mb-6">
          GAME_STATE_MONITOR
        </h2>

        {/* Status badge row */}
        <div className="flex items-center justify-between mb-6">
          <span className="font-mono text-[11px] text-gray-500 uppercase tracking-widest">
            STATUS
          </span>
          <div className="flex items-center gap-2">
            {gamePhase === "war_room" && (
              <span className="font-mono text-[11px] font-bold px-2 py-1 text-[#f59e0b] bg-[#f59e0b]/10 border border-[#f59e0b]/30">
                WAR ROOM
              </span>
            )}
            {gamePhase === "live_floor" && (
              <span className="font-mono text-[11px] font-bold px-2 py-1 text-[#4caf50] bg-[#4caf50]/10 border border-[#4caf50]/30">
                LIVE FLOOR
              </span>
            )}
            <div
              className={`font-mono text-[13px] font-bold px-3 py-1 ${statusStyles}`}
            >
              {status}
            </div>
          </div>
        </div>

        {/* Timer display */}
        <div className="text-center py-8">
          <div className="font-mono text-[11px] text-gray-500 uppercase tracking-widest mb-2">
            ELAPSED_TIME
          </div>
          <div className="font-mono text-7xl font-black text-[#e5e2e1] tabular-nums">
            {formatElapsed(elapsedSeconds)}
          </div>
        </div>

        {/* Quarter display */}
        <div className="flex items-center justify-between border-t border-[#404752] pt-4">
          <span className="font-mono text-[11px] text-gray-500 uppercase tracking-widest">
            CURRENT_QUARTER
          </span>
          <span className="font-mono text-3xl font-bold text-[#e5e2e1]">
            Q{currentRound}
          </span>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="col-span-12 border border-[#FF1744]/30 bg-[#FF1744]/10 px-4 py-3">
          <p className="font-mono text-[13px] text-[#FF1744]">{error}</p>
        </div>
      )}

      {/* Team Summary Stats */}
      <div className="col-span-12 grid grid-cols-3 gap-4">
        <div className="bg-[#1c1b1b] p-5">
          <div className="text-sm font-mono text-gray-500 uppercase tracking-widest mb-1">
            TOTAL_TEAMS
          </div>
          <div className="text-3xl font-bold font-mono text-[#e5e2e1]">
            {totalTeams}
          </div>
        </div>
        <div className="bg-[#1c1b1b] p-5">
          <div className="text-sm font-mono text-gray-500 uppercase tracking-widest mb-1">
            PENDING
          </div>
          <div className="text-3xl font-bold font-mono text-[#e5e2e1]">
            {pendingCount}
          </div>
        </div>
        <div className="bg-[#1c1b1b] p-5">
          <div className="text-sm font-mono text-gray-500 uppercase tracking-widest mb-1">
            ACTIVE
          </div>
          <div className="text-3xl font-bold font-mono text-[#e5e2e1]">
            {activeCount}
          </div>
        </div>
      </div>

      {/* Team Performance Ledger */}
      <div className="col-span-12 bg-[#1c1b1b] p-6">
        <h2 className="text-base font-black font-mono tracking-widest text-[#9ecaff] uppercase mb-6">
          TEAM_PERFORMANCE_LEDGER
        </h2>
        <TeamTable
          teams={teams}
          gameStatus={status}
          compact={true}
          onApprove={handleApprove}
          onReject={handleReject}
          onRemove={handleRemove}
        />
      </div>

      {/* Macro Brief Modal for War Room */}
      {showMacroBriefModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="bg-[#1c1b1b] border border-[#f59e0b]/30 p-6 w-full max-w-lg">
            <h3 className="font-mono text-sm font-bold text-[#f59e0b] uppercase tracking-widest mb-4">
              WAR_ROOM_MACRO_BRIEF
            </h3>
            <p className="font-mono text-[11px] text-[#89919d] mb-3">
              Enter the problem statement / macro brief for this quarter. Teams
              will see this during War Room.
            </p>
            <textarea
              value={macroBriefText}
              onChange={(e) => setMacroBriefText(e.target.value)}
              className="w-full bg-[#0e0e0e] border-l-2 border-[#f59e0b] text-sm font-mono p-4 text-[#e5e2e1] h-40 placeholder:text-gray-700 focus:outline-none focus:ring-0 mb-4"
              placeholder="Describe the macro environment, key challenges, and strategic questions for this quarter..."
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowMacroBriefModal(false);
                  setMacroBriefText("");
                }}
                className="px-4 py-2 font-mono text-[12px] text-[#89919d] border border-[#404752] hover:bg-[#2a2a2a] transition-all"
              >
                CANCEL
              </button>
              <button
                onClick={handleEnterWarRoom}
                disabled={isLoading || !macroBriefText.trim()}
                className="px-4 py-2 font-mono text-[12px] font-bold text-[#f59e0b] border border-[#f59e0b]/50 bg-[#f59e0b]/10 hover:bg-[#f59e0b]/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isLoading ? "ENTERING..." : "ENTER WAR ROOM"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
