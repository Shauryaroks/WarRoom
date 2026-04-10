"use client";

import { useState } from "react";

const mockTeams = [
  {
    id: 1,
    name: "BARBIE INC",
    ticker: "$BARB",
    status: "ACTIVE",
    liquidity: "$124.5M",
    mktCap: "$540.0M",
  },
  {
    id: 2,
    name: "STARK_INDUSTRIES",
    ticker: "$STRK",
    status: "PENDING",
    liquidity: "$0.00",
    mktCap: "$0.00",
  },
  {
    id: 3,
    name: "WAYNE_CORP",
    ticker: "$WAYN",
    status: "COOLDOWN",
    liquidity: "$89.2M",
    mktCap: "$210.0M",
  },
  {
    id: 4,
    name: "ACME_CO",
    ticker: "$ACME",
    status: "ELIMINATED",
    liquidity: "$0.0M",
    mktCap: "$0.0M",
  },
];

export default function TeamsPage() {
  const [filter, setFilter] = useState("ALL");

  const filteredTeams = mockTeams.filter(
    (t) => filter === "ALL" || t.status === filter,
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      <header className="flex justify-between items-center pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Team Management
          </h1>
          <p className="text-gray-500 mt-1">
            Manage active operators and enforce market rules.
          </p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-lg">
          {["ALL", "ACTIVE", "PENDING", "COOLDOWN", "ELIMINATED"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                filter === f
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Team
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Ticker
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Status
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Liquidity
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Market Cap
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredTeams.map((team) => (
              <tr key={team.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-semibold text-gray-900">{team.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-mono text-gray-600 font-bold">
                    {team.ticker}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      team.status === "ACTIVE"
                        ? "bg-green-100 text-green-800"
                        : team.status === "ELIMINATED"
                          ? "bg-red-100 text-red-800"
                          : team.status === "COOLDOWN"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {team.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {team.liquidity}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {team.mktCap}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-md transition-colors font-semibold">
                    Bankrupt
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredTeams.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No teams found matching filter: {filter}
          </div>
        )}
      </div>
    </div>
  );
}
