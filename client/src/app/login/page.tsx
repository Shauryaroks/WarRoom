"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // The API uses 'ticker' for login
      const res = await api.login(username);

      // Mocking user object since we don't have a /users/me endpoint yet
      login({
        id: "mock-id-" + Date.now(),
        teamName: username,
        ticker: username,
        role: username.toLowerCase() === "admin" ? "admin" : "player",
        token: res.api_key,
      });

      router.push("/game");
    } catch (error) {
      console.error("Login failed:", error);
      alert("Login failed. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#0077b6] font-mono flex items-center justify-center p-4">
      <div className="w-full max-w-md border border-[#333] p-6 bg-[#111]">
        <div className="mb-6 border-b border-[#333] pb-4">
          <h1 className="text-xl font-bold tracking-widest uppercase">
            &gt; SYSTEM_LOGIN
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Authenticate to access COMPLEX
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wider text-gray-400 block">
              Operator_ID / Ticker
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-black border border-[#333] text-[#0077b6] px-3 py-2 text-sm focus:outline-none focus:border-[#0077b6] transition-colors"
              required
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wider text-gray-400 block">
              Passcode
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black border border-[#333] text-[#0077b6] px-3 py-2 text-sm focus:outline-none focus:border-[#0077b6] transition-colors"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 bg-[#0077b6] text-black font-bold uppercase tracking-widest py-3 text-sm hover:bg-[#FFD000] transition-colors disabled:opacity-50"
          >
            {loading ? "AUTHENTICATING..." : "INITIATE_SESSION"}
          </button>
        </form>
      </div>
    </div>
  );
}
