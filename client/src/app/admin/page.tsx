"use client";

import { useState } from "react";
import Link from "next/link";

export default function AdminDashboard() {
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeConfirmText, setPurgeConfirmText] = useState("");

  const handlePurgeConfirm = () => {
    if (purgeConfirmText === "PURGE") {
      console.log("Executing purge...");
      alert("Market Purge Executed!");
      setShowPurgeModal(false);
      setPurgeConfirmText("");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans">
      <header className="flex justify-between items-center pb-4 border-b border-gray-200">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
          System Dashboard
        </h1>
        <div className="text-sm font-medium px-3 py-1 bg-green-100 text-green-800 rounded-full border border-green-200 shadow-sm">
          Status: Online
        </div>
      </header>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col justify-center items-center text-center">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Active Teams
          </h3>
          <p className="text-4xl font-bold text-slate-800">42</p>
          <p className="text-sm text-gray-400 mt-2">Out of 50</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col justify-center items-center text-center">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Total Liquidity
          </h3>
          <p className="text-4xl font-bold text-slate-800">$4.2B</p>
          <p className="text-sm text-green-500 mt-2 font-medium">
            ▲ +$12M since start
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col justify-center items-center text-center">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Avg Market Cap
          </h3>
          <p className="text-4xl font-bold text-slate-800">$350M</p>
          <p className="text-sm text-gray-400 mt-2">Stable</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900">
              Recent Activity
            </h3>
            <Link
              href="/admin/market"
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              View All →
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {[1, 2, 3].map((i) => (
              <div key={i} className="px-6 py-4 flex items-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Team ALPHA executed a massive trade
                  </p>
                  <p className="text-xs text-gray-500">2 minutes ago</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Critical Actions */}
        <div className="bg-white rounded-lg shadow-sm border border-red-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-red-200 bg-red-50 flex items-center">
            <span className="material-symbols-outlined text-red-600 mr-2 font-bold">
              warning
            </span>
            <h3 className="text-lg font-bold text-red-800">Critical Actions</h3>
          </div>
          <div className="p-6">
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              Use these controls with extreme caution. These actions permanently
              alter the game state and cannot be undone.
            </p>
            <button
              onClick={() => setShowPurgeModal(true)}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-4 rounded-lg shadow-md transition-colors flex justify-center items-center uppercase tracking-widest text-lg"
            >
              <span className="material-symbols-outlined mr-2 text-2xl">
                bomb
              </span>
              Initiate Market Purge
            </button>
          </div>
        </div>
      </div>

      {/* Purge Modal */}
      {showPurgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden ring-1 ring-red-500 ring-offset-4 ring-offset-white">
            <div className="bg-red-600 px-6 py-4 flex items-center">
              <span className="material-symbols-outlined text-white text-3xl mr-3">
                warning
              </span>
              <h2 className="text-2xl font-bold text-white tracking-wide">
                CONFIRM PURGE
              </h2>
            </div>
            <div className="p-6">
              <p className="text-gray-800 font-medium mb-4 text-lg">
                This action will eliminate the bottom 50% of active teams.
              </p>
              <p className="text-gray-600 text-sm mb-6 bg-red-50 p-3 border-l-4 border-red-500">
                All eliminated teams will have their stock delisted and holdings
                zeroed. This cannot be undone.
              </p>
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 uppercase mb-2">
                  Type PURGE to confirm:
                </label>
                <input
                  type="text"
                  value={purgeConfirmText}
                  onChange={(e) =>
                    setPurgeConfirmText(e.target.value.toUpperCase())
                  }
                  className="w-full border-2 border-gray-300 rounded-lg p-3 text-lg font-mono uppercase focus:ring-red-500 focus:border-red-500 outline-none transition-colors"
                  placeholder="PURGE"
                />
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setShowPurgeModal(false);
                    setPurgeConfirmText("");
                  }}
                  className="flex-1 bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50 font-bold py-3 px-4 rounded-lg transition-colors text-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePurgeConfirm}
                  disabled={purgeConfirmText !== "PURGE"}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-lg"
                >
                  Execute Purge
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
