"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function RegisterPage() {
  const [teamName, setTeamName] = useState("");
  const [tickerInput, setTickerInput] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [success, setSuccess] = useState(false);

  const router = useRouter();

  const handleTickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase();
    if (val.startsWith("$")) {
      val = val.substring(1);
    }
    setTickerInput(val);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      if (teamName.length < 3 || teamName.length > 50) {
        throw new Error("Team Name must be 3-50 characters.");
      }
      if (!/^[a-zA-Z0-9 ]+$/.test(teamName)) {
        throw new Error("Team Name must be alphanumeric.");
      }
      if (tickerInput.length < 3 || tickerInput.length > 4) {
        throw new Error("Ticker must be 3-4 characters.");
      }
      if (password.length < 8) {
        throw new Error("Password must be at least 8 characters.");
      }

      await api.registerTeam({
        team_name: teamName,
        ticker: tickerInput.toUpperCase(),
        email: email,
        password: password,
      });

      setSuccess(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error("Registration failed:", error);
      setErrorMsg(error.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-primary)] font-mono flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md border border-[var(--color-outline)] p-6 bg-[var(--color-surface)]">
        <div className="mb-6 border-b border-[var(--color-outline)] pb-4">
          <h1 className="text-xl font-bold tracking-widest uppercase">
            &gt; TERMINAL_REGISTER
          </h1>
          <p className="text-xs text-[var(--color-muted)] mt-1">
            REQUEST NEW TERMINAL ACCESS
          </p>
        </div>

        {success ? (
          <div className="text-[var(--color-success)] border border-[var(--color-success)] p-4 text-center">
            <p className="font-bold">REGISTRATION PENDING ADMIN APPROVAL</p>
            <p className="text-sm mt-2 text-[var(--color-muted)]">
              YOUR ACCESS REQUEST IS BEING REVIEWED. YOU WILL BE NOTIFIED.
            </p>
            <button
              onClick={() => router.push("/auth/login")}
              className="mt-6 border border-[var(--color-success)] text-[var(--color-success)] hover:bg-[var(--color-success)] hover:text-black py-2 px-4 transition-colors text-sm uppercase"
            >
              &gt; RETURN_TO_LOGIN
            </button>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wider text-[var(--color-muted)] block">
                TEAM NAME (3-50 CHARS)
              </label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full bg-black border border-[var(--color-outline)] text-[var(--color-primary)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                required
                maxLength={50}
                minLength={3}
                pattern="[a-zA-Z0-9 ]+"
                title="Alphanumeric characters and spaces only"
              />
            </div>

            <div className="space-y-1 relative">
              <label className="text-xs uppercase tracking-wider text-[var(--color-muted)] block">
                TICKER (3-4 CHARS)
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
                  maxLength={4}
                  minLength={3}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wider text-[var(--color-muted)] block">
                CONTACT EMAIL
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black border border-[var(--color-outline)] text-[var(--color-primary)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wider text-[var(--color-muted)] block">
                PASSCODE (MIN 8)
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black border border-[var(--color-outline)] text-[var(--color-primary)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                required
                minLength={8}
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
              {loading ? "PROCESSING..." : "SUBMIT_REGISTRATION"}
            </button>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => router.push("/auth/login")}
                className="text-xs text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors"
              >
                &gt; EXISTING_ACCOUNT? LOGIN_HERE
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
