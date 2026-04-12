"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const [tickerInput, setTickerInput] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [pendingApproval, setPendingApproval] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  const handleTickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase();
    if (val.startsWith("$")) {
      val = val.substring(1);
    }
    setTickerInput(val);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setPendingApproval(false);

    try {
      const formattedTicker = `$${tickerInput}`;
      const res = await api.login({ ticker: formattedTicker, password });

      if (res.status === "PENDING_APPROVAL") {
        setPendingApproval(true);
        setLoading(false);
        return;
      }

      login({
        id: "id-" + Date.now(),
        teamName: res.team_name,
        ticker: res.ticker,
        role: "player",
        token: res.api_key,
      });

      if (res.status === "PENDING_START") {
        router.push("/lobby");
      } else if (res.status === "ACTIVE") {
        router.push("/game");
      } else {
        // Fallback for other statuses if needed
        router.push("/lobby");
      }
    } catch (error: any) {
      console.error("Login failed:", error);
      setErrorMsg(error.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-primary)] font-mono flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md border border-[var(--color-outline)] p-6 bg-[var(--color-surface)]">
        <div className="mb-6 border-b border-[var(--color-outline)] pb-4">
          <h1 className="text-xl font-bold tracking-widest uppercase">
            &gt; TERMINAL_LOGIN
          </h1>
          <p className="text-xs text-[var(--color-muted)] mt-1">
            AUTHENTICATE TO ACCESS TERMINAL
          </p>
        </div>

        {pendingApproval ? (
          <div className="text-[var(--color-primary)] border border-[var(--color-primary)] p-4 text-center">
            <p className="font-bold">STATUS: PENDING_APPROVAL</p>
            <p className="text-sm mt-2">
              YOUR REGISTRATION IS PENDING ADMIN APPROVAL.
            </p>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1 relative">
              <label className="text-xs uppercase tracking-wider text-[var(--color-muted)] block">
                TICKER
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-primary)] opacity-70">
                  $
                </span>
                <input
                  type="text"
                  value={tickerInput}
                  onChange={handleTickerChange}
                  className="w-full bg-black border border-[var(--color-outline)] text-[var(--color-primary)] pl-7 pr-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] transition-colors uppercase"
                  required
                  autoFocus
                  maxLength={4}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wider text-[var(--color-muted)] block">
                PASSCODE
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black border border-[var(--color-outline)] text-[var(--color-primary)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                required
              />
            </div>

            {errorMsg && (
              <div className="text-[var(--color-error)] text-xs mt-2 border border-[var(--color-error)] p-2">
                &gt; ERROR: {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 border border-[var(--color-primary)] text-[var(--color-primary)] font-bold uppercase tracking-widest py-3 text-sm hover:bg-[var(--color-primary)] hover:text-black transition-colors disabled:opacity-50"
            >
              {loading ? "AUTHENTICATING..." : "INITIATE_SESSION"}
            </button>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => router.push("/auth/register")}
                className="text-xs text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors"
              >
                &gt; NO_ACCOUNT? REGISTER_HERE
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
