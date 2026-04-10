"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Mock login
    setTimeout(() => {
      router.push("/lobby");
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#FFB000] font-mono flex items-center justify-center p-4">
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
              Operator_ID
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-black border border-[#333] text-[#FFB000] px-3 py-2 text-sm focus:outline-none focus:border-[#FFB000] transition-colors"
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
              className="w-full bg-black border border-[#333] text-[#FFB000] px-3 py-2 text-sm focus:outline-none focus:border-[#FFB000] transition-colors"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 bg-[#FFB000] text-black font-bold uppercase tracking-widest py-3 text-sm hover:bg-[#FFD000] transition-colors disabled:opacity-50"
          >
            {loading ? "AUTHENTICATING..." : "INITIATE_SESSION"}
          </button>
        </form>
      </div>
    </div>
  );
}
