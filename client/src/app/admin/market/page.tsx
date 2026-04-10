"use client";

import { useState } from "react";

export default function MarketPage() {
  const [headline, setHeadline] = useState("");
  const [impact, setImpact] = useState("NEUTRAL");
  const [targetSectors, setTargetSectors] = useState("");

  const handleInjectNews = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Injecting news:", { headline, impact, targetSectors });
    alert("News event injected successfully.");
    setHeadline("");
    setTargetSectors("");
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto font-sans">
      <header className="pb-4 border-b border-gray-200">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
          Market Events
        </h1>
        <p className="text-gray-500 mt-1">
          Inject global events into the LLM simulation engine.
        </p>
      </header>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center">
          <span className="material-symbols-outlined text-blue-600 mr-2 font-bold">
            campaign
          </span>
          <h3 className="text-lg font-bold text-gray-900">Inject News Event</h3>
        </div>

        <form onSubmit={handleInjectNews} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Headline
            </label>
            <input
              type="text"
              required
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              className="w-full border-2 border-gray-300 rounded-md p-3 text-lg focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
              placeholder="e.g., GLOBAL_SUPPLY_CHAIN_DISRUPTION_DETECTED"
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Projected Impact
              </label>
              <select
                value={impact}
                onChange={(e) => setImpact(e.target.value)}
                className="w-full border-2 border-gray-300 rounded-md p-3 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors font-medium bg-white"
              >
                <option value="BULLISH">BULLISH (Positive)</option>
                <option value="BEARISH">BEARISH (Negative)</option>
                <option value="NEUTRAL">NEUTRAL (Volatile)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Sectors (Optional)
              </label>
              <input
                type="text"
                value={targetSectors}
                onChange={(e) => setTargetSectors(e.target.value)}
                className="w-full border-2 border-gray-300 rounded-md p-3 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                placeholder="e.g., TECH, ENERGY"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex justify-end">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-md shadow-sm transition-colors"
            >
              Inject to Wire
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-bold text-gray-900">
            Recent Wire Injections
          </h3>
        </div>
        <ul className="divide-y divide-gray-200">
          <li className="px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                FED_ANNOUNCES_UNEXPECTED_RATE_HIKE
              </p>
              <p className="text-xs text-red-600 font-bold mt-1">
                IMPACT: BEARISH
              </p>
            </div>
            <span className="text-xs text-gray-500">10 mins ago</span>
          </li>
          <li className="px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                NEW_AI_BREAKTHROUGH_REVEALED
              </p>
              <p className="text-xs text-green-600 font-bold mt-1">
                IMPACT: BULLISH
              </p>
            </div>
            <span className="text-xs text-gray-500">1 hour ago</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
