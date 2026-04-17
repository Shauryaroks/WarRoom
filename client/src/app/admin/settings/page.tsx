"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useGameStore } from "@/stores/game-store";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { GameStatePayload, ArchetypeResponse } from "@/lib/types";

const CONFIG_ITEMS = [
  { label: "COOLDOWN_MINUTES", value: "10" },
  { label: "STARTING_CASH", value: "$1,000,000" },
  { label: "STARTING_PRICE", value: "$100.00" },
  { label: "STARTING_SHARES", value: "1,000,000" },
];

const RESTART_COUNTDOWN = 5;

export default function SettingsPage() {
  const { status, currentRound, setGameState, reset } = useGameStore();
  const [isAdvancing, setIsAdvancing] = useState(false);

  // Archetype state
  const [archetypes, setArchetypes] = useState<ArchetypeResponse[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Create form state
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formSector, setFormSector] = useState("FOODS");
  const [formDescription, setFormDescription] = useState("");
  const [formDossier, setFormDossier] = useState("");
  const [formMktShareMin, setFormMktShareMin] = useState("");
  const [formMktShareMax, setFormMktShareMax] = useState("");
  const [formMarginMin, setFormMarginMin] = useState("");
  const [formMarginMax, setFormMarginMax] = useState("");
  const [formGrowthMin, setFormGrowthMin] = useState("");
  const [formGrowthMax, setFormGrowthMax] = useState("");
  const [formOpsMin, setFormOpsMin] = useState("");
  const [formOpsMax, setFormOpsMax] = useState("");
  const [formCash, setFormCash] = useState("");
  const [formStockPrice, setFormStockPrice] = useState("");
  const [formShares, setFormShares] = useState("1000000");
  const [formStrengths, setFormStrengths] = useState("");
  const [formWeaknesses, setFormWeaknesses] = useState("");
  const [formOpportunities, setFormOpportunities] = useState("");
  const [formThreats, setFormThreats] = useState("");
  const [formInspiration, setFormInspiration] = useState("");

  // Restart state
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [countdown, setCountdown] = useState(RESTART_COUNTDOWN);
  const [isRestarting, setIsRestarting] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load game state and archetypes on mount
  useEffect(() => {
    api
      .getAdminGameState()
      .then((data) => {
        setGameState({
          status: data.status as GameStatePayload["status"],
          elapsed_seconds: data.elapsed_seconds,
          current_round: data.current_round,
        });
      })
      .catch(() => {});
    api
      .getArchetypes()
      .then(setArchetypes)
      .catch(() => {});
  }, [setGameState]);

  function loadArchetypes() {
    api
      .getArchetypes()
      .then(setArchetypes)
      .catch(() => {});
  }

  async function handleSeedArchetypes() {
    setIsSeeding(true);
    try {
      const result = await api.seedArchetypes();
      toast.success(
        `Seeded ${result.created.length} archetypes, skipped ${result.skipped.length}`,
      );
      loadArchetypes();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to seed archetypes",
      );
    } finally {
      setIsSeeding(false);
    }
  }

  async function handleDeleteArchetype(id: string) {
    try {
      await api.deleteArchetype(id);
      toast.success("Archetype deleted");
      loadArchetypes();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete archetype",
      );
    }
  }

  function resetCreateForm() {
    setFormName("");
    setFormSlug("");
    setFormSector("FOODS");
    setFormDescription("");
    setFormDossier("");
    setFormMktShareMin("");
    setFormMktShareMax("");
    setFormMarginMin("");
    setFormMarginMax("");
    setFormGrowthMin("");
    setFormGrowthMax("");
    setFormOpsMin("");
    setFormOpsMax("");
    setFormCash("");
    setFormStockPrice("");
    setFormShares("1000000");
    setFormStrengths("");
    setFormWeaknesses("");
    setFormOpportunities("");
    setFormThreats("");
    setFormInspiration("");
  }

  async function handleCreateArchetype() {
    if (
      !formName.trim() ||
      !formDossier.trim() ||
      !formCash ||
      !formStockPrice
    ) {
      toast.error("Name, dossier, starting cash, and stock price are required");
      return;
    }
    setIsCreating(true);
    try {
      const benchmarkBands = JSON.stringify({
        market_share: [
          Number(formMktShareMin) || 0,
          Number(formMktShareMax) || 0,
        ],
        margin: [Number(formMarginMin) || 0, Number(formMarginMax) || 0],
        growth: [Number(formGrowthMin) || 0, Number(formGrowthMax) || 0],
        ops_efficiency: [Number(formOpsMin) || 0, Number(formOpsMax) || 0],
      });
      await api.createArchetype({
        name: formName.trim(),
        slug:
          formSlug.trim() || formName.trim().toLowerCase().replace(/\s+/g, "-"),
        sector: formSector,
        description: formDescription.trim() || null,
        dossier_content: formDossier,
        benchmark_bands: benchmarkBands,
        starting_cash: formCash,
        starting_stock_price: formStockPrice,
        starting_shares: Number(formShares) || 1000000,
        swot_strengths: formStrengths.trim() || null,
        swot_weaknesses: formWeaknesses.trim() || null,
        swot_opportunities: formOpportunities.trim() || null,
        swot_threats: formThreats.trim() || null,
        real_world_inspiration: formInspiration.trim() || null,
      });
      toast.success("Archetype created");
      resetCreateForm();
      setShowCreateForm(false);
      loadArchetypes();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create archetype",
      );
    } finally {
      setIsCreating(false);
    }
  }

  // Countdown timer for restart confirmation
  useEffect(() => {
    if (showRestartConfirm && countdown > 0) {
      intervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [showRestartConfirm, countdown]);

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
        err instanceof Error ? err.message : "Failed to advance round",
      );
    } finally {
      setIsAdvancing(false);
    }
  }

  const handleRestartClick = useCallback(() => {
    setShowRestartConfirm(true);
    setCountdown(RESTART_COUNTDOWN);
  }, []);

  const handleAbort = useCallback(() => {
    setShowRestartConfirm(false);
    setCountdown(RESTART_COUNTDOWN);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const handleConfirmRestart = useCallback(async () => {
    setIsRestarting(true);
    try {
      await api.restartGame();
      reset();
      setShowRestartConfirm(false);
      toast.success("Game restarted successfully");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to restart game",
      );
    } finally {
      setIsRestarting(false);
    }
  }, [reset]);

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

      {/* Section C: Archetype Management */}
      <div className="bg-[#1c1b1b] p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold font-mono tracking-widest text-gray-500 uppercase">
            ARCHETYPE_MANAGEMENT
          </h3>
          <button
            onClick={handleSeedArchetypes}
            disabled={isSeeding}
            className="border border-[#2196f3]/40 text-[#2196f3] bg-[#2196f3]/10 px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-[#2196f3]/20 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isSeeding ? "SEEDING..." : "SEED_PRESETS"}
          </button>
        </div>

        {/* Existing archetypes list */}
        {archetypes.length > 0 ? (
          <div className="w-full overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  <th className="text-left text-xs text-gray-600 uppercase font-mono tracking-widest py-2 pr-4">
                    NAME
                  </th>
                  <th className="text-left text-xs text-gray-600 uppercase font-mono tracking-widest py-2 pr-4">
                    SECTOR
                  </th>
                  <th className="text-right text-xs text-gray-600 uppercase font-mono tracking-widest py-2 pr-4">
                    STARTING_CASH
                  </th>
                  <th className="text-right text-xs text-gray-600 uppercase font-mono tracking-widest py-2">
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody>
                {archetypes.map((a) => (
                  <tr
                    key={a.id}
                    className="hover:bg-[#2a2a2a] transition-colors"
                  >
                    <td className="py-3 pr-4 font-mono font-bold text-[#e5e2e1] text-sm">
                      {a.name}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="font-mono text-xs text-[#89919d] uppercase">
                        {a.sector}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-sm text-[#e5e2e1]">
                      {a.starting_cash}
                    </td>
                    <td className="py-3 text-right">
                      {a.is_preset ? (
                        <span className="font-mono text-[10px] text-[#2196f3]/60 uppercase px-2 py-1 bg-[#2196f3]/10">
                          PRESET
                        </span>
                      ) : (
                        <button
                          onClick={() => handleDeleteArchetype(a.id)}
                          className="font-mono text-xs font-bold px-3 py-1 text-[#FF1744] hover:bg-[#FF1744]/10 active:scale-95 transition-all"
                        >
                          DELETE
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6">
            <span className="font-mono text-xs text-gray-600 tracking-widest">
              NO_ARCHETYPES // CLICK SEED_PRESETS
            </span>
          </div>
        )}

        {/* Toggle create form */}
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="border border-[#2a2a2a] text-gray-400 bg-transparent px-4 py-2.5 font-mono text-xs font-bold uppercase hover:border-[#2196f3] hover:text-[#2196f3] active:scale-[0.98] transition-all w-full"
        >
          {showCreateForm ? "COLLAPSE" : "NEW_ARCHETYPE"}
        </button>

        {/* Create archetype form */}
        {showCreateForm && (
          <div className="border border-[#2a2a2a] p-4 flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block font-mono text-[10px] text-[#89919d] tracking-widest mb-1 uppercase">
                  NAME *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => {
                    setFormName(e.target.value);
                    setFormSlug(
                      e.target.value.toLowerCase().replace(/\s+/g, "-"),
                    );
                  }}
                  className="w-full bg-[#0e0e0e] border border-[#2a2a2a] text-[#e5e2e1] font-mono text-sm px-3 py-2 focus:border-[#2196f3] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] text-[#89919d] tracking-widest mb-1 uppercase">
                  SLUG
                </label>
                <input
                  type="text"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  className="w-full bg-[#0e0e0e] border border-[#2a2a2a] text-[#e5e2e1] font-mono text-sm px-3 py-2 focus:border-[#2196f3] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] text-[#89919d] tracking-widest mb-1 uppercase">
                  SECTOR
                </label>
                <select
                  value={formSector}
                  onChange={(e) => setFormSector(e.target.value)}
                  className="w-full bg-[#0e0e0e] border border-[#2a2a2a] text-[#e5e2e1] font-mono text-sm px-3 py-2 focus:border-[#2196f3] focus:outline-none"
                >
                  <option value="FOODS">FOODS</option>
                  <option value="BEVERAGES">BEVERAGES</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-mono text-[10px] text-[#89919d] tracking-widest mb-1 uppercase">
                DESCRIPTION
              </label>
              <input
                type="text"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="w-full bg-[#0e0e0e] border border-[#2a2a2a] text-[#e5e2e1] font-mono text-sm px-3 py-2 focus:border-[#2196f3] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-mono text-[10px] text-[#89919d] tracking-widest mb-1 uppercase">
                DOSSIER_CONTENT * // MARKDOWN
              </label>
              <textarea
                value={formDossier}
                onChange={(e) => setFormDossier(e.target.value)}
                rows={8}
                className="w-full bg-[#0e0e0e] border border-[#2a2a2a] text-[#e5e2e1] font-mono text-xs px-3 py-2 focus:border-[#2196f3] focus:outline-none resize-y"
              />
            </div>

            {/* Benchmark Bands */}
            <div>
              <label className="block font-mono text-[10px] text-[#89919d] tracking-widest mb-2 uppercase">
                BENCHMARK_BANDS
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  {
                    label: "MKT_SHARE",
                    min: formMktShareMin,
                    max: formMktShareMax,
                    setMin: setFormMktShareMin,
                    setMax: setFormMktShareMax,
                  },
                  {
                    label: "MARGIN",
                    min: formMarginMin,
                    max: formMarginMax,
                    setMin: setFormMarginMin,
                    setMax: setFormMarginMax,
                  },
                  {
                    label: "GROWTH",
                    min: formGrowthMin,
                    max: formGrowthMax,
                    setMin: setFormGrowthMin,
                    setMax: setFormGrowthMax,
                  },
                  {
                    label: "OPS_EFF",
                    min: formOpsMin,
                    max: formOpsMax,
                    setMin: setFormOpsMin,
                    setMax: setFormOpsMax,
                  },
                ].map((band) => (
                  <div key={band.label} className="flex flex-col gap-1">
                    <span className="font-mono text-[9px] text-[#89919d] uppercase">
                      {band.label}
                    </span>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        value={band.min}
                        onChange={(e) => band.setMin(e.target.value)}
                        placeholder="min"
                        className="w-full bg-[#0e0e0e] border border-[#2a2a2a] text-[#e5e2e1] font-mono text-xs px-2 py-1.5 focus:border-[#2196f3] focus:outline-none"
                      />
                      <input
                        type="number"
                        value={band.max}
                        onChange={(e) => band.setMax(e.target.value)}
                        placeholder="max"
                        className="w-full bg-[#0e0e0e] border border-[#2a2a2a] text-[#e5e2e1] font-mono text-xs px-2 py-1.5 focus:border-[#2196f3] focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block font-mono text-[10px] text-[#89919d] tracking-widest mb-1 uppercase">
                  STARTING_CASH *
                </label>
                <input
                  type="number"
                  value={formCash}
                  onChange={(e) => setFormCash(e.target.value)}
                  placeholder="e.g. 4000000000"
                  className="w-full bg-[#0e0e0e] border border-[#2a2a2a] text-[#e5e2e1] font-mono text-sm px-3 py-2 focus:border-[#2196f3] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] text-[#89919d] tracking-widest mb-1 uppercase">
                  STARTING_STOCK_PRICE *
                </label>
                <input
                  type="number"
                  value={formStockPrice}
                  onChange={(e) => setFormStockPrice(e.target.value)}
                  placeholder="e.g. 100"
                  className="w-full bg-[#0e0e0e] border border-[#2a2a2a] text-[#e5e2e1] font-mono text-sm px-3 py-2 focus:border-[#2196f3] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] text-[#89919d] tracking-widest mb-1 uppercase">
                  STARTING_SHARES
                </label>
                <input
                  type="number"
                  value={formShares}
                  onChange={(e) => setFormShares(e.target.value)}
                  className="w-full bg-[#0e0e0e] border border-[#2a2a2a] text-[#e5e2e1] font-mono text-sm px-3 py-2 focus:border-[#2196f3] focus:outline-none"
                />
              </div>
            </div>

            {/* SWOT fields */}
            <div>
              <label className="block font-mono text-[10px] text-[#89919d] tracking-widest mb-2 uppercase">
                SWOT_ANALYSIS
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  {
                    label: "STRENGTHS",
                    value: formStrengths,
                    set: setFormStrengths,
                  },
                  {
                    label: "WEAKNESSES",
                    value: formWeaknesses,
                    set: setFormWeaknesses,
                  },
                  {
                    label: "OPPORTUNITIES",
                    value: formOpportunities,
                    set: setFormOpportunities,
                  },
                  { label: "THREATS", value: formThreats, set: setFormThreats },
                ].map((swot) => (
                  <div key={swot.label}>
                    <span className="font-mono text-[9px] text-[#89919d] uppercase">
                      {swot.label}
                    </span>
                    <textarea
                      value={swot.value}
                      onChange={(e) => swot.set(e.target.value)}
                      rows={3}
                      className="w-full bg-[#0e0e0e] border border-[#2a2a2a] text-[#e5e2e1] font-mono text-xs px-2 py-1.5 focus:border-[#2196f3] focus:outline-none resize-y mt-1"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-mono text-[10px] text-[#89919d] tracking-widest mb-1 uppercase">
                REAL_WORLD_INSPIRATION
              </label>
              <input
                type="text"
                value={formInspiration}
                onChange={(e) => setFormInspiration(e.target.value)}
                placeholder="e.g. Inspired by Parle / Britannia"
                className="w-full bg-[#0e0e0e] border border-[#2a2a2a] text-[#e5e2e1] font-mono text-sm px-3 py-2 focus:border-[#2196f3] focus:outline-none"
              />
            </div>

            <button
              onClick={handleCreateArchetype}
              disabled={isCreating}
              className="bg-[#2196f3] text-white px-8 py-3 font-mono text-sm font-bold uppercase hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 w-full"
            >
              {isCreating ? "CREATING..." : "CREATE_ARCHETYPE"}
            </button>
          </div>
        )}
      </div>

      {/* Section D: Danger Zone - Restart Game */}
      <div className="bg-[#1c1b1b] p-6 flex flex-col gap-5 border border-[#FF1744]/20">
        <h3 className="text-sm font-bold font-mono tracking-widest text-[#FF1744]/60 uppercase">
          DANGER_ZONE
        </h3>

        <p className="text-xs font-mono text-gray-500 leading-relaxed">
          Restarting will delete all game data including transactions, holdings,
          directives, news, and activity history. Team registrations are
          preserved but reset to READY status with default financials.
        </p>

        {!showRestartConfirm ? (
          <button
            onClick={handleRestartClick}
            className="border border-[#FF1744]/40 text-[#FF1744] bg-[#FF1744]/10 px-8 py-3.5 font-mono text-sm font-bold uppercase hover:bg-[#FF1744]/20 active:scale-[0.98] transition-all w-full"
          >
            RESTART_GAME
          </button>
        ) : (
          <div className="border border-[#FF1744]/30 bg-[#FF1744]/5 p-4 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[#FF1744] uppercase tracking-widest">
                // THIS ACTION IS IRREVERSIBLE
              </span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleConfirmRestart}
                disabled={countdown > 0 || isRestarting}
                className={`flex-1 px-6 py-3 font-mono text-sm font-bold uppercase transition-all ${
                  countdown > 0 || isRestarting
                    ? "border border-[#FF1744]/20 text-[#FF1744]/40 bg-transparent cursor-not-allowed"
                    : "bg-[#FF1744] text-white hover:brightness-110 active:scale-[0.98]"
                }`}
              >
                {isRestarting
                  ? "RESTARTING..."
                  : countdown > 0
                    ? `WAIT... ${countdown}s`
                    : "CONFIRM_RESTART"}
              </button>

              <button
                onClick={handleAbort}
                disabled={isRestarting}
                className="px-6 py-3 border border-gray-600 text-gray-400 font-mono text-sm font-bold uppercase hover:border-gray-400 hover:text-gray-300 active:scale-[0.98] transition-all disabled:opacity-30"
              >
                ABORT
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
