"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

import { useAuthStore } from "@/stores/auth-store";
import { useGameStore } from "@/stores/game-store";
import { useAdminStore } from "@/stores/admin-store";
import { useWebSocket } from "@/hooks/use-websocket";
import { api } from "@/lib/api";
import { TeamTable } from "@/components/admin/team-table";
import { toast } from "sonner";
import type { ArchetypeResponse } from "@/lib/types";

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

  // Archetypes state
  const [archetypes, setArchetypes] = useState<ArchetypeResponse[]>([]);

  // Load teams and archetypes on mount
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
      api
        .getArchetypes()
        .then(setArchetypes)
        .catch(() => {});
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
    [setTeams, removeTeam],
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

  async function handleBankrupt(teamId: string) {
    try {
      const result = await api.bankruptTeam(teamId);
      updateTeamStatus(teamId, "BANKRUPT");
      toast.success(result.message);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to mark team bankrupt",
      );
    }
  }

  // Caseline assignment state
  const [caselineTeamId, setCaselineTeamId] = useState<string | null>(null);
  const [caselineDoc, setCaselineDoc] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [startingCash, setStartingCash] = useState("");
  const [initialStockPrice, setInitialStockPrice] = useState("");
  const [caselineSaving, setCaselineSaving] = useState(false);

  const caselineTeam = teams.find((t) => t.id === caselineTeamId);

  function handleCaseline(teamId: string) {
    setCaselineTeamId(teamId);
    setCaselineDoc("");
    setCompanyName("");
    setStartingCash("");
    setInitialStockPrice("");
  }

  function handleCaselineCancel() {
    setCaselineTeamId(null);
    setCaselineDoc("");
    setCompanyName("");
    setStartingCash("");
    setInitialStockPrice("");
  }

  async function handleCaselineSave() {
    if (!caselineTeamId) return;
    setCaselineSaving(true);
    try {
      await api.assignCaseline(caselineTeamId, {
        caseline_document: caselineDoc,
        company_display_name: companyName || undefined,
        starting_cash: startingCash ? parseFloat(startingCash) : undefined,
        initial_stock_price: initialStockPrice
          ? parseFloat(initialStockPrice)
          : undefined,
      });
      toast.success("Caseline assigned successfully");
      handleCaselineCancel();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to assign caseline",
      );
    } finally {
      setCaselineSaving(false);
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

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 mb-6">
        <div className="xl:col-span-3 bg-[#1c1b1b] p-6">
          <TeamTable
            teams={teams}
            gameStatus={status}
            compact={false}
            onApprove={handleApprove}
            onReject={handleReject}
            onRemove={handleRemove}
            onCaseline={handleCaseline}
            onBankrupt={handleBankrupt}
          />
        </div>
        <div className="xl:col-span-1 h-[400px] xl:h-auto">
          <BCGMatrixCard teams={teams} />
        </div>
      </div>

      {/* Caseline Assignment Panel */}
      {caselineTeamId && (
        <div className="mt-6 bg-[#1c1b1b] p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h3 className="font-mono text-sm font-bold text-[#9ecaff] tracking-widest uppercase">
                ASSIGN_CASELINE // {caselineTeam?.name ?? caselineTeamId}
              </h3>
              {caselineTeam?.archetype_name && (
                <span className="bg-[#2196f3]/20 text-[#2196f3] px-2 py-0.5 font-mono text-xs font-bold uppercase">
                  {caselineTeam.archetype_name}
                </span>
              )}
            </div>
            <button
              onClick={handleCaselineCancel}
              className="font-mono text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              CLOSE
            </button>
          </div>

          {/* Archetype Dropdown - only during SETUP */}
          {status === "SETUP" && archetypes.length > 0 && (
            <div className="mb-6">
              <label className="block font-mono text-xs text-gray-500 tracking-widest mb-2 uppercase">
                ARCHETYPE // SELECT TO AUTO-FILL
              </label>
              <select
                defaultValue=""
                onChange={async (e) => {
                  const archetypeId = e.target.value;
                  if (!archetypeId || !caselineTeamId) return;
                  const archetype = archetypes.find(
                    (a) => a.id === archetypeId,
                  );
                  if (!archetype) return;
                  try {
                    const result = await api.assignArchetype(
                      caselineTeamId,
                      archetypeId,
                    );
                    toast.success(
                      `Archetype assigned: ${result.archetype_name}`,
                    );
                    setCaselineDoc(archetype.dossier_content);
                    setCompanyName(archetype.name);
                    setStartingCash(archetype.starting_cash);
                    setInitialStockPrice(archetype.starting_stock_price);
                    // Refresh teams to show updated archetype_name
                    api
                      .getTeams()
                      .then(setTeams)
                      .catch(() => {});
                  } catch (err) {
                    toast.error(
                      err instanceof Error
                        ? err.message
                        : "Failed to assign archetype",
                    );
                  }
                }}
                className="w-full bg-[#0e0e0e] border border-[#2a2a2a] text-[#e5e2e1] font-mono text-sm px-3 py-2 focus:border-[#2196f3] focus:outline-none"
              >
                <option value="">-- No archetype --</option>
                {archetypes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} [{a.sector}]
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Markdown textarea */}
          <div className="mb-6">
            <label className="block font-mono text-xs text-gray-500 tracking-widest mb-2 uppercase">
              CASELINE_DOCUMENT // MARKDOWN
            </label>
            <textarea
              value={caselineDoc}
              onChange={(e) => setCaselineDoc(e.target.value)}
              placeholder="# Company Profile&#10;&#10;Paste or write the caseline document in Markdown format..."
              className="w-full min-h-[400px] bg-[#0e0e0e] border border-[#2a2a2a] text-[#e5e2e1] font-mono text-xs px-4 py-3 focus:border-[#2196f3] focus:outline-none resize-y"
            />
          </div>

          {/* Optional fields row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block font-mono text-xs text-gray-500 tracking-widest mb-2 uppercase">
                COMPANY_DISPLAY_NAME
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Acme Corp"
                className="w-full bg-[#0e0e0e] border border-[#2a2a2a] text-[#e5e2e1] font-mono text-sm px-3 py-2 focus:border-[#2196f3] focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-gray-500 tracking-widest mb-2 uppercase">
                STARTING_CASH
              </label>
              <input
                type="number"
                value={startingCash}
                onChange={(e) => setStartingCash(e.target.value)}
                placeholder="e.g. 100000"
                step="1000"
                min="0"
                className="w-full bg-[#0e0e0e] border border-[#2a2a2a] text-[#e5e2e1] font-mono text-sm px-3 py-2 focus:border-[#2196f3] focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-gray-500 tracking-widest mb-2 uppercase">
                INITIAL_STOCK_PRICE
              </label>
              <input
                type="number"
                value={initialStockPrice}
                onChange={(e) => setInitialStockPrice(e.target.value)}
                placeholder="e.g. 100.00"
                step="0.01"
                min="0"
                className="w-full bg-[#0e0e0e] border border-[#2a2a2a] text-[#e5e2e1] font-mono text-sm px-3 py-2 focus:border-[#2196f3] focus:outline-none"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleCaselineSave}
              disabled={caselineSaving || !caselineDoc.trim()}
              className="bg-[#2196f3] text-white px-6 py-2.5 font-mono text-sm font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {caselineSaving ? "SAVING..." : "SAVE"}
            </button>
            <button
              onClick={handleCaselineCancel}
              className="bg-[#2a2a2a] text-gray-400 px-6 py-2.5 font-mono text-sm font-bold hover:text-gray-300 active:scale-95 transition-all"
            >
              CANCEL
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
