"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [llmEngine, setLlmEngine] = useState("GPT-4o");
  const [tickRate, setTickRate] = useState("5000");
  const [maxLiquidity, setMaxLiquidity] = useState("1000000000");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    alert("System Settings Saved.");
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto font-sans">
      <header className="pb-4 border-b border-gray-200">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
          System Settings
        </h1>
        <p className="text-gray-500 mt-1">
          Configure global simulation parameters.
        </p>
      </header>

      <form
        onSubmit={handleSave}
        className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center">
          <span className="material-symbols-outlined text-gray-600 mr-2 font-bold">
            settings
          </span>
          <h3 className="text-lg font-bold text-gray-900">
            Simulation Configuration
          </h3>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Evaluation LLM Engine
              </label>
              <select
                value={llmEngine}
                onChange={(e) => setLlmEngine(e.target.value)}
                className="w-full border-2 border-gray-300 rounded-md p-3 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors font-medium bg-white"
              >
                <option value="GPT-4o">
                  OpenAI GPT-4o (High Cost / High Accuracy)
                </option>
                <option value="Claude-3.5-Sonnet">
                  Anthropic Claude 3.5 Sonnet (Balanced)
                </option>
                <option value="Llama-3-70B">
                  Meta Llama-3-70B (Fast / Low Cost)
                </option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Simulation Tick Rate (ms)
              </label>
              <input
                type="number"
                value={tickRate}
                onChange={(e) => setTickRate(e.target.value)}
                className="w-full border-2 border-gray-300 rounded-md p-3 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                min="1000"
                step="1000"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Max Starting Liquidity ($)
              </label>
              <input
                type="number"
                value={maxLiquidity}
                onChange={(e) => setMaxLiquidity(e.target.value)}
                className="w-full border-2 border-gray-300 rounded-md p-3 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                min="0"
                step="1000000"
              />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-md shadow-sm transition-colors"
          >
            Save Configuration
          </button>
        </div>
      </form>
    </div>
  );
}
