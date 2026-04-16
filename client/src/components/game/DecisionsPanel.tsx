"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronDown, ChevronRight, Lock, ArrowRight } from "lucide-react";
import { useDecisionsStore } from "@/stores/decisions-store";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type {
  PricingDecision,
  MarketingDecision,
  SupplyChainDecision,
  NewProductDecision,
  DecisionSubmitItem,
} from "@/lib/types";

// === Budget cost constants ===
const SUPPLY_CHAIN_COST: Record<string, number> = {
  TIER1: 5,
  TIER2: 3,
  RURAL: 2,
};
const NEW_PRODUCT_RD_COST = 10;

// === Default state for each lever ===
const DEFAULT_PRICING: PricingDecision = {
  list_price_change: 0,
  promo_depth: 0,
  channel_pricing: "GT",
};

const DEFAULT_MARKETING: MarketingDecision = {
  atl_pct: 25,
  digital_pct: 25,
  influencer_pct: 25,
  btl_pct: 25,
  campaign_theme: "VALUE",
};

const DEFAULT_SUPPLY_CHAIN: SupplyChainDecision = {
  inventory_policy: "BALANCED",
  distribution_expansion: [],
  capacity_utilization: 80,
};

const DEFAULT_NEW_PRODUCT: NewProductDecision = {
  launch_sku: false,
  sku_description: "",
  target_category: "",
};

// === Collapsible Section ===
function LeverSection({
  title,
  cost,
  open,
  onToggle,
  children,
}: {
  title: string;
  cost: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-[#2a2a2a] bg-[#0e0e0e]">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-[#1c1b1b] transition-colors"
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="w-3 h-3 text-[#89919d]" />
          ) : (
            <ChevronRight className="w-3 h-3 text-[#89919d]" />
          )}
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#e5e2e1]">
            {title}
          </span>
        </div>
        <span className="font-mono text-[10px] text-[#89919d]">
          Rs {cost} Cr
        </span>
      </button>
      {open && <div className="px-3 pb-3 space-y-3">{children}</div>}
    </div>
  );
}

// === Shared input label ===
function InputLabel({ label }: { label: string }) {
  return (
    <div className="text-[9px] text-[#89919d] uppercase font-bold tracking-widest mb-1">
      {label}
    </div>
  );
}

// === Slider component ===
function LeverSlider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <InputLabel label={label} />
        <span className="font-mono text-xs text-[#2196f3]">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-[#2a2a2a] appearance-none cursor-pointer accent-[#2196f3] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#2196f3] [&::-webkit-slider-thumb]:rounded-none"
      />
    </div>
  );
}

// === Select dropdown ===
function LeverSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <InputLabel label={label} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#1c1b1b] border border-[#2a2a2a] text-xs text-[#e5e2e1] font-mono px-2 py-1.5 focus:border-[#2196f3]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function DecisionsPanel() {
  const role = useAuthStore((s) => s.role);
  const { budget, isSubmitting, lastSubmittedAt, setBudget, setSubmitting, setLastSubmitted, setCurrentDecisions } =
    useDecisionsStore();

  // Lever state
  const [pricing, setPricing] = useState<PricingDecision>({ ...DEFAULT_PRICING });
  const [marketing, setMarketing] = useState<MarketingDecision>({ ...DEFAULT_MARKETING });
  const [supplyChain, setSupplyChain] = useState<SupplyChainDecision>({ ...DEFAULT_SUPPLY_CHAIN });
  const [newProduct, setNewProduct] = useState<NewProductDecision>({ ...DEFAULT_NEW_PRODUCT });

  // Section open state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    PRICING: true,
    MARKETING: false,
    SUPPLY_CHAIN: false,
    NEW_PRODUCT: false,
    TRADING: false,
  });

  const [submitted, setSubmitted] = useState(false);

  const toggleSection = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // Fetch budget and existing decisions on mount
  useEffect(() => {
    api.getBudget().then(setBudget).catch(() => {});
    api.getCurrentDecisions().then((decisions) => {
      setCurrentDecisions(decisions);
      if (decisions.length > 0) {
        setSubmitted(true);
        setLastSubmitted(decisions[0].submitted_at);
        // Hydrate form from existing decisions
        for (const d of decisions) {
          try {
            const json = typeof d.decisions_json === "string" ? JSON.parse(d.decisions_json) : d.decisions_json;
            switch (d.lever_category) {
              case "PRICING":
                setPricing(json as PricingDecision);
                break;
              case "MARKETING":
                setMarketing(json as MarketingDecision);
                break;
              case "SUPPLY_CHAIN":
                setSupplyChain(json as SupplyChainDecision);
                break;
              case "NEW_PRODUCT":
                setNewProduct(json as NewProductDecision);
                break;
            }
          } catch {
            // Skip malformed
          }
        }
      }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Budget calculations
  const totalBudget = budget ? parseFloat(budget.total_budget) : 0;

  const marketingCost = useMemo(() => {
    // Marketing spend is 30% of total budget (matching server calculation)
    return totalBudget > 0 ? totalBudget * 0.3 : 0;
  }, [totalBudget]);

  const supplyChainCost = useMemo(() => {
    return supplyChain.distribution_expansion.reduce(
      (sum, tier) => sum + (SUPPLY_CHAIN_COST[tier] || 0),
      0
    );
  }, [supplyChain.distribution_expansion]);

  const newProductCost = newProduct.launch_sku ? NEW_PRODUCT_RD_COST : 0;

  const totalAllocated = marketingCost + supplyChainCost + newProductCost;
  const remaining = totalBudget - totalAllocated;
  const budgetExceeded = remaining < 0;

  // Marketing sum validation
  const marketingSum =
    marketing.atl_pct + marketing.digital_pct + marketing.influencer_pct + marketing.btl_pct;
  const marketingValid = marketingSum === 100;

  const canSubmit = !budgetExceeded && marketingValid && !isSubmitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    const decisions: DecisionSubmitItem[] = [
      { lever_category: "PRICING", decisions_json: pricing, budget_spent: 0 },
      { lever_category: "MARKETING", decisions_json: marketing, budget_spent: marketingCost },
      { lever_category: "SUPPLY_CHAIN", decisions_json: supplyChain, budget_spent: supplyChainCost },
      { lever_category: "NEW_PRODUCT", decisions_json: newProduct, budget_spent: newProductCost },
    ];

    try {
      const result = await api.submitDecisions({ decisions });
      setCurrentDecisions(result.decisions);
      setLastSubmitted(new Date().toISOString());
      setSubmitted(true);
      // Refresh budget after submit
      api.getBudget().then(setBudget).catch(() => {});
      toast.success("Decisions submitted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, pricing, marketing, supplyChain, newProduct, marketingCost, supplyChainCost, newProductCost, setBudget, setSubmitting, setLastSubmitted, setCurrentDecisions]);

  // Trader view
  if (role === "trader") {
    return (
      <div className="p-4 space-y-6">
        <div className="text-[10px] text-[#89919d] uppercase font-bold tracking-widest">
          DECISIONS
        </div>
        <div className="flex-1 flex flex-col items-center justify-center py-12 space-y-4">
          <div className="font-mono text-xs text-[#404752] uppercase tracking-widest text-center">
            STRATEGIST_ONLY
          </div>
          <p className="text-xs text-[#89919d] text-center max-w-[240px] leading-relaxed">
            Decision levers are managed by the strategist role.
          </p>
        </div>
      </div>
    );
  }

  // Submitted (locked) view
  if (submitted && lastSubmittedAt) {
    return (
      <div className="p-4 space-y-4">
        <div className="text-[10px] text-[#89919d] uppercase font-bold tracking-widest">
          DECISIONS
        </div>

        {/* Locked badge */}
        <div className="bg-[#1c1b1b] border-l-2 border-[#f59e0b] p-3 flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-[#f59e0b]" />
          <span className="font-mono text-[10px] text-[#f59e0b] uppercase tracking-widest">
            DECISIONS_LOCKED
          </span>
        </div>

        {/* Submitted summary */}
        <div className="space-y-2">
          <div className="bg-[#0e0e0e] border border-[#2a2a2a] p-3 space-y-2">
            <div className="text-[9px] text-[#89919d] uppercase font-bold tracking-widest">
              PRICING
            </div>
            <div className="font-mono text-[10px] text-[#e5e2e1] space-y-0.5">
              <div>List Price: {pricing.list_price_change > 0 ? "+" : ""}{pricing.list_price_change}%</div>
              <div>Promo Depth: {pricing.promo_depth}%</div>
              <div>Channel: {pricing.channel_pricing}</div>
            </div>
          </div>

          <div className="bg-[#0e0e0e] border border-[#2a2a2a] p-3 space-y-2">
            <div className="text-[9px] text-[#89919d] uppercase font-bold tracking-widest">
              MARKETING
            </div>
            <div className="font-mono text-[10px] text-[#e5e2e1] space-y-0.5">
              <div>ATL: {marketing.atl_pct}% / Digital: {marketing.digital_pct}% / Influencer: {marketing.influencer_pct}% / BTL: {marketing.btl_pct}%</div>
              <div>Theme: {marketing.campaign_theme}</div>
            </div>
          </div>

          <div className="bg-[#0e0e0e] border border-[#2a2a2a] p-3 space-y-2">
            <div className="text-[9px] text-[#89919d] uppercase font-bold tracking-widest">
              SUPPLY_CHAIN
            </div>
            <div className="font-mono text-[10px] text-[#e5e2e1] space-y-0.5">
              <div>Policy: {supplyChain.inventory_policy}</div>
              <div>Expansion: {supplyChain.distribution_expansion.length > 0 ? supplyChain.distribution_expansion.join(", ") : "None"}</div>
              <div>Utilization: {supplyChain.capacity_utilization}%</div>
            </div>
          </div>

          <div className="bg-[#0e0e0e] border border-[#2a2a2a] p-3 space-y-2">
            <div className="text-[9px] text-[#89919d] uppercase font-bold tracking-widest">
              NEW_PRODUCT
            </div>
            <div className="font-mono text-[10px] text-[#e5e2e1] space-y-0.5">
              <div>Launch SKU: {newProduct.launch_sku ? "YES" : "NO"}</div>
              {newProduct.launch_sku && newProduct.sku_description && (
                <div>SKU: {newProduct.sku_description}</div>
              )}
            </div>
          </div>
        </div>

        {/* Resubmit option */}
        <button
          onClick={() => setSubmitted(false)}
          className="w-full py-2 text-[10px] font-bold uppercase tracking-widest transition-colors bg-[#1c1b1b] text-[#89919d] hover:bg-[#2a2a2a] border border-[#2a2a2a] flex items-center justify-center gap-1"
        >
          MODIFY_DECISIONS <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="text-[10px] text-[#89919d] uppercase font-bold tracking-widest">
        DECISIONS
      </div>

      {/* Budget bar */}
      <div className="bg-[#0e0e0e] border border-[#2a2a2a] p-2">
        <div className="font-mono text-[10px] space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[#89919d]">OPERATING_BUDGET:</span>
            <span className="text-[#e5e2e1]">Rs {totalBudget.toFixed(1)} Cr</span>
            <span className="text-[#404752]">|</span>
            <span className="text-[#89919d]">ALLOCATED:</span>
            <span className="text-[#e5e2e1]">Rs {totalAllocated.toFixed(1)} Cr</span>
            <span className="text-[#404752]">|</span>
            <span className="text-[#89919d]">REMAINING:</span>
            <span className={remaining >= 0 ? "text-[#4caf50]" : "text-[#ef4444]"}>
              Rs {remaining.toFixed(1)} Cr
            </span>
          </div>
          {budgetExceeded && (
            <div className="text-[#ef4444] font-bold mt-1">
              BUDGET_EXCEEDED -- reduce allocations by Rs {Math.abs(remaining).toFixed(1)} Cr
            </div>
          )}
        </div>
      </div>

      {/* Lever sections */}
      <div className="space-y-1">
        {/* PRICING */}
        <LeverSection
          title="PRICING"
          cost={0}
          open={openSections.PRICING}
          onToggle={() => toggleSection("PRICING")}
        >
          <LeverSlider
            label="List Price Change"
            value={pricing.list_price_change}
            min={-15}
            max={15}
            step={0.5}
            format={(v) => `${v > 0 ? "+" : ""}${v}%`}
            onChange={(v) => setPricing((p) => ({ ...p, list_price_change: v }))}
          />
          <LeverSlider
            label="Promo Depth"
            value={pricing.promo_depth}
            min={0}
            max={40}
            step={1}
            format={(v) => `${v}%`}
            onChange={(v) => setPricing((p) => ({ ...p, promo_depth: v }))}
          />
          <LeverSelect
            label="Channel Pricing"
            value={pricing.channel_pricing}
            options={[
              { value: "GT", label: "GT (General Trade)" },
              { value: "MT", label: "MT (Modern Trade)" },
              { value: "QCOM", label: "QCom (Quick Commerce)" },
              { value: "D2C", label: "D2C (Direct to Consumer)" },
            ]}
            onChange={(v) => setPricing((p) => ({ ...p, channel_pricing: v as PricingDecision["channel_pricing"] }))}
          />
        </LeverSection>

        {/* MARKETING */}
        <LeverSection
          title="MARKETING"
          cost={marketingCost}
          open={openSections.MARKETING}
          onToggle={() => toggleSection("MARKETING")}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <InputLabel label="Budget Allocation (must total 100%)" />
              <span
                className={`font-mono text-[10px] ${
                  marketingValid ? "text-[#4caf50]" : "text-[#f59e0b]"
                }`}
              >
                {marketingSum}%
              </span>
            </div>
            {!marketingValid && (
              <div className="text-[9px] text-[#f59e0b] font-mono">
                Must total 100%
              </div>
            )}
            {(["atl_pct", "digital_pct", "influencer_pct", "btl_pct"] as const).map((key) => {
              const labels: Record<string, string> = {
                atl_pct: "ATL",
                digital_pct: "Digital",
                influencer_pct: "Influencer",
                btl_pct: "BTL",
              };
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-[#89919d] w-16">{labels[key]}</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={marketing[key]}
                    onChange={(e) =>
                      setMarketing((m) => ({
                        ...m,
                        [key]: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)),
                      }))
                    }
                    className="w-16 bg-[#1c1b1b] border border-[#2a2a2a] text-xs text-[#e5e2e1] font-mono px-2 py-1 text-right"
                  />
                  <span className="font-mono text-[10px] text-[#89919d]">%</span>
                </div>
              );
            })}
          </div>
          <LeverSelect
            label="Campaign Theme"
            value={marketing.campaign_theme}
            options={[
              { value: "VALUE", label: "Value" },
              { value: "PREMIUM", label: "Premium" },
              { value: "HEALTH", label: "Health" },
              { value: "PATRIOTISM", label: "Patriotism" },
              { value: "NOSTALGIA", label: "Nostalgia" },
            ]}
            onChange={(v) =>
              setMarketing((m) => ({ ...m, campaign_theme: v as MarketingDecision["campaign_theme"] }))
            }
          />
        </LeverSection>

        {/* SUPPLY CHAIN */}
        <LeverSection
          title="SUPPLY_CHAIN"
          cost={supplyChainCost}
          open={openSections.SUPPLY_CHAIN}
          onToggle={() => toggleSection("SUPPLY_CHAIN")}
        >
          <div>
            <InputLabel label="Inventory Policy" />
            <div className="flex gap-1">
              {(["LEAN", "BALANCED", "STOCKED"] as const).map((policy) => (
                <button
                  key={policy}
                  onClick={() => setSupplyChain((s) => ({ ...s, inventory_policy: policy }))}
                  className={`flex-1 py-1.5 font-mono text-[10px] uppercase border transition-colors ${
                    supplyChain.inventory_policy === policy
                      ? "border-[#2196f3] bg-[#2196f3]/10 text-[#2196f3]"
                      : "border-[#2a2a2a] bg-[#1c1b1b] text-[#89919d] hover:bg-[#2a2a2a]"
                  }`}
                >
                  {policy}
                </button>
              ))}
            </div>
          </div>
          <div>
            <InputLabel label="Distribution Expansion" />
            <div className="flex gap-2">
              {(["TIER1", "TIER2", "RURAL"] as const).map((tier) => {
                const checked = supplyChain.distribution_expansion.includes(tier);
                return (
                  <label
                    key={tier}
                    className="flex items-center gap-1.5 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSupplyChain((s) => ({
                          ...s,
                          distribution_expansion: checked
                            ? s.distribution_expansion.filter((t) => t !== tier)
                            : [...s.distribution_expansion, tier],
                        }))
                      }
                      className="w-3 h-3 accent-[#2196f3] bg-[#1c1b1b] border-[#2a2a2a]"
                    />
                    <span className="font-mono text-[10px] text-[#e5e2e1]">
                      {tier === "TIER1" ? "Tier-1" : tier === "TIER2" ? "Tier-2" : "Rural"}
                    </span>
                    <span className="font-mono text-[9px] text-[#89919d]">
                      (Rs {SUPPLY_CHAIN_COST[tier]} Cr)
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
          <LeverSlider
            label="Capacity Utilization"
            value={supplyChain.capacity_utilization}
            min={60}
            max={100}
            step={1}
            format={(v) => `${v}%`}
            onChange={(v) => setSupplyChain((s) => ({ ...s, capacity_utilization: v }))}
          />
        </LeverSection>

        {/* NEW PRODUCT */}
        <LeverSection
          title="NEW_PRODUCT"
          cost={newProductCost}
          open={openSections.NEW_PRODUCT}
          onToggle={() => toggleSection("NEW_PRODUCT")}
        >
          <div>
            <InputLabel label="Launch New SKU" />
            <button
              onClick={() =>
                setNewProduct((p) => ({ ...p, launch_sku: !p.launch_sku }))
              }
              className={`px-3 py-1.5 font-mono text-[10px] uppercase border transition-colors ${
                newProduct.launch_sku
                  ? "border-[#2196f3] bg-[#2196f3]/10 text-[#2196f3]"
                  : "border-[#2a2a2a] bg-[#1c1b1b] text-[#89919d] hover:bg-[#2a2a2a]"
              }`}
            >
              {newProduct.launch_sku ? "YES -- Rs 10 Cr R&D" : "NO"}
            </button>
          </div>
          {newProduct.launch_sku && (
            <>
              <div>
                <InputLabel label="SKU Description (required)" />
                <input
                  type="text"
                  value={newProduct.sku_description || ""}
                  onChange={(e) =>
                    setNewProduct((p) => ({ ...p, sku_description: e.target.value }))
                  }
                  placeholder="Describe the new product..."
                  className="w-full bg-[#1c1b1b] border border-[#2a2a2a] text-xs text-[#e5e2e1] font-mono px-2 py-1.5 placeholder:text-[#404752]"
                />
              </div>
              <LeverSelect
                label="Target Category"
                value={newProduct.target_category || ""}
                options={[
                  { value: "", label: "Select category..." },
                  { value: "SNACKS", label: "Snacks" },
                  { value: "BEVERAGES", label: "Beverages" },
                  { value: "PERSONAL_CARE", label: "Personal Care" },
                  { value: "HOME_CARE", label: "Home Care" },
                  { value: "DAIRY", label: "Dairy" },
                ]}
                onChange={(v) => setNewProduct((p) => ({ ...p, target_category: v }))}
              />
            </>
          )}
        </LeverSection>

        {/* TRADING info card */}
        <LeverSection
          title="TRADING"
          cost={0}
          open={openSections.TRADING}
          onToggle={() => toggleSection("TRADING")}
        >
          <div className="bg-[#1c1b1b] p-2 border-l-2 border-[#2196f3]">
            <div className="font-mono text-[10px] text-[#89919d]">
              Trading decisions are made in the TRADING panel
            </div>
          </div>
        </LeverSection>
      </div>

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-[#2196f3] text-white hover:bg-[#1976d2]"
      >
        {isSubmitting ? "SUBMITTING..." : "SUBMIT_DECISIONS"}
      </button>
    </div>
  );
}
