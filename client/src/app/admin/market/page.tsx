"use client";

import { useState } from "react";

export default function MarketPage() {
  const [headline, setHeadline] = useState("");
  const [impactType, setImpactType] = useState("GLOBAL");
  const [sectors, setSectors] = useState<string[]>([]);
  const [targetTicker, setTargetTicker] = useState("");
  const [schedule, setSchedule] = useState("IMMEDIATE");
  const [scheduleMins, setScheduleMins] = useState("5");

  const handleInjectNews = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Injecting news:", {
      headline,
      impactType,
      sectors,
      targetTicker,
      schedule,
    });
    alert("News event injected successfully.");
    setHeadline("");
    setTargetTicker("");
    setSectors([]);
  };

  const toggleSector = (sector: string) => {
    if (sectors.includes(sector)) {
      setSectors(sectors.filter((s) => s !== sector));
    } else {
      setSectors([...sectors, sector]);
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-8 pt-4">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-[6px] flex flex-col">
        <div className="px-4 py-3 border-b border-[#2a2a2a]">
          <h2 className="text-[11px] font-['Inter',sans-serif] text-[#6b7280] uppercase tracking-wider font-normal">
            Inject Market News
          </h2>
        </div>

        <form onSubmit={handleInjectNews} className="p-6 flex flex-col gap-6">
          {/* Headline */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[12px] font-['Inter',sans-serif] text-[#9ca3af] uppercase">
                Headline
              </label>
              <span className="text-[11px] text-[#6b7280] font-['JetBrains_Mono',monospace]">
                {headline.length}/120
              </span>
            </div>
            <input
              type="text"
              required
              maxLength={120}
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-[4px] h-[40px] px-3 text-[13px] text-[#e5e5e5] focus:outline-none focus:border-[#0077b6] font-['Inter',sans-serif] transition-colors"
            />
          </div>

          {/* Impact Type */}
          <div>
            <label className="text-[12px] font-['Inter',sans-serif] text-[#9ca3af] uppercase block mb-2">
              Impact Type
            </label>
            <div className="flex gap-6">
              {["GLOBAL", "SECTOR", "TARGETED"].map((type) => (
                <label
                  key={type}
                  className="flex items-center gap-2 cursor-pointer group"
                  onClick={() => setImpactType(type)}
                >
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${impactType === type ? "border-[#0077b6]" : "border-[#6b7280] group-hover:border-[#9ca3af]"}`}
                  >
                    {impactType === type && (
                      <div className="w-2 h-2 rounded-full bg-[#0077b6]" />
                    )}
                  </div>
                  <span className="text-[13px] text-[#e5e5e5] font-['Inter',sans-serif] capitalize">
                    {type.toLowerCase()}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Affected Sectors */}
          <div
            className={`${impactType !== "SECTOR" ? "opacity-50 pointer-events-none" : ""} transition-opacity`}
          >
            <div className="flex justify-between items-center mb-2">
              <label className="text-[12px] font-['Inter',sans-serif] text-[#9ca3af] uppercase">
                Affected Sectors
              </label>
              <button
                type="button"
                onClick={() => setSectors([])}
                className="text-[11px] text-[#0077b6] hover:underline font-['Inter',sans-serif]"
              >
                Clear
              </button>
            </div>
            <div className="flex flex-wrap gap-4">
              {["Tech", "Finance", "Energy", "REIT", "Consumer"].map(
                (sector) => (
                  <label
                    key={sector}
                    className="flex items-center gap-2 cursor-pointer group"
                  >
                    <div
                      className={`w-4 h-4 rounded-[2px] border flex items-center justify-center transition-colors ${sectors.includes(sector) ? "border-[#0077b6] bg-[#0077b6]/10" : "border-[#6b7280] group-hover:border-[#9ca3af] bg-[#0a0a0a]"}`}
                    >
                      {sectors.includes(sector) && (
                        <span className="material-symbols-outlined text-[12px] text-[#0077b6] font-bold">
                          check
                        </span>
                      )}
                    </div>
                    <span className="text-[13px] text-[#e5e5e5] font-['Inter',sans-serif]">
                      {sector}
                    </span>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={sectors.includes(sector)}
                      onChange={() => toggleSector(sector)}
                    />
                  </label>
                ),
              )}
            </div>
          </div>

          {/* Target Ticker */}
          <div
            className={`${impactType !== "TARGETED" ? "opacity-50 pointer-events-none" : ""} transition-opacity`}
          >
            <label className="text-[12px] font-['Inter',sans-serif] text-[#9ca3af] uppercase block mb-1">
              Target Ticker (If Applicable)
            </label>
            <div className="relative w-48">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7280] font-['JetBrains_Mono',monospace]">
                $
              </span>
              <input
                type="text"
                value={targetTicker}
                onChange={(e) => setTargetTicker(e.target.value.toUpperCase())}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-[4px] h-[40px] pl-7 pr-3 text-[13px] text-[#0077b6] font-bold focus:outline-none focus:border-[#0077b6] font-['JetBrains_Mono',monospace] transition-colors"
              />
            </div>
          </div>

          {/* Schedule */}
          <div>
            <label className="text-[12px] font-['Inter',sans-serif] text-[#9ca3af] uppercase block mb-2">
              Schedule
            </label>
            <div className="flex gap-6 items-center">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${schedule === "IMMEDIATE" ? "border-[#0077b6]" : "border-[#6b7280] group-hover:border-[#9ca3af]"}`}
                >
                  {schedule === "IMMEDIATE" && (
                    <div className="w-2 h-2 rounded-full bg-[#0077b6]" />
                  )}
                </div>
                <span className="text-[13px] text-[#e5e5e5] font-['Inter',sans-serif]">
                  Immediate
                </span>
              </label>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${schedule === "DELAYED" ? "border-[#0077b6]" : "border-[#6b7280] group-hover:border-[#9ca3af]"}`}
                  >
                    {schedule === "DELAYED" && (
                      <div className="w-2 h-2 rounded-full bg-[#0077b6]" />
                    )}
                  </div>
                  <span className="text-[13px] text-[#e5e5e5] font-['Inter',sans-serif]">
                    In
                  </span>
                </label>
                <input
                  type="number"
                  value={scheduleMins}
                  onChange={(e) => {
                    setScheduleMins(e.target.value);
                    setSchedule("DELAYED");
                  }}
                  className="w-16 bg-[#0a0a0a] border border-[#2a2a2a] rounded-[4px] h-[32px] px-2 text-[13px] text-[#e5e5e5] focus:outline-none focus:border-[#0077b6] font-['JetBrains_Mono',monospace] text-center"
                />
                <span className="text-[13px] text-[#e5e5e5] font-['Inter',sans-serif]">
                  minutes
                </span>
              </div>
            </div>
          </div>

          {/* Preview Box */}
          <div className="mt-2">
            <label className="text-[12px] font-['Inter',sans-serif] text-[#9ca3af] uppercase block mb-1">
              Preview
            </label>
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-[4px] p-4 text-[13px] text-[#e5e5e5] font-['JetBrains_Mono',monospace] min-h-[60px] flex items-center">
              <span className="text-[#6b7280] mr-2">
                [
                {new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                ]
              </span>
              <span className="text-[#0077b6] mr-2">[{impactType}]</span>
              {headline || "Waiting for input..."}
            </div>
          </div>

          <button
            type="submit"
            className="w-full h-[48px] bg-[#0077b6] hover:bg-[#0077b6]/90 text-[#0a0a0a] rounded-[4px] font-bold text-[13px] tracking-widest font-['Inter',sans-serif] transition-all duration-200 mt-4 shadow-[0_0_15px_rgba(255,176,0,0.2)] uppercase"
          >
            BROADCAST TO ALL TEAMS
          </button>
        </form>
      </div>
    </div>
  );
}
