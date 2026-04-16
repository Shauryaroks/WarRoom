"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

import { useAuthStore } from "@/stores/auth-store";
import { useGameStore } from "@/stores/game-store";
import { useAdminStore } from "@/stores/admin-store";
import { useWebSocket } from "@/hooks/use-websocket";
import { api } from "@/lib/api";
import { TeamTable } from "@/components/admin/team-table";
import { toast } from "sonner";

export default function TeamsPage() {
  const router = useRouter();
  const { isAuthenticated, role } = useAuthStore();
  const { status } = useGameStore();
  const { teams, setTeams, updateTeamStatus, removeTeam } = useAdminStore();

  // Redirect non-admin users
  useEffect(() => {
    if (!isAuthenticated || role !== "admin") {
      router.push("/admin/login");
    }
  }, [isAuthenticated, role, router]);

  // Load teams on mount
  useEffect(() => {
    if (isAuthenticated && role === "admin") {
      api
        .getTeams()
        .then((data) => {
          setTeams(data);
        })
        .catch(() => {
          // Will retry via WebSocket events
        });
    }
  }, [isAuthenticated, role, setTeams]);

  // Handle WebSocket messages for real-time updates
  const handleMessage = useCallback(
    (data: Record<string, unknown>) => {
      if (data.type === "team_registered") {
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
    },
    [setTeams, removeTeam]
  );

  useWebSocket({
    onMessage: handleMessage,
    enabled: isAuthenticated && role === "admin",
  });

  async function handleApprove(teamId: string) {
    try {
      await api.approveTeam(teamId);
      updateTeamStatus(teamId, "READY");
      toast.success("Team approved");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to approve team"
      );
    }
  }

  async function handleReject(teamId: string) {
    try {
      await api.rejectTeam(teamId);
      updateTeamStatus(teamId, "REJECTED");
      toast.success("Team rejected");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to reject team"
      );
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
      toast.error(
        err instanceof Error ? err.message : "Failed to remove team"
      );
    }
  }

  if (!isAuthenticated || role !== "admin") {
    return null;
  }

  return (
    <div className="w-full">
      <h2 className="text-base font-black font-mono tracking-widest text-[#9ecaff] uppercase mb-6">
        TEAM_MANAGEMENT_CONSOLE
      </h2>
      <div className="bg-[#1c1b1b] p-6">
        <TeamTable
          teams={teams}
          gameStatus={status}
          compact={false}
          onApprove={handleApprove}
          onReject={handleReject}
          onRemove={handleRemove}
        />
      </div>
    </div>
  );
}
