"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function RegisterPage() {
  const [teamName, setTeamName] = useState("");
  const [ticker, setTicker] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [tickerError, setTickerError] = useState("");
  const { login } = useAuth();
  const router = useRouter();

  const handleTickerChange = (value: string) => {
    const filtered = value
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 4);
    setTicker(filtered);

    if (filtered.length > 0 && filtered.length < 3) {
      setTickerError("Ticker must be 3-4 characters");
    } else {
      setTickerError("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate ticker
    if (ticker.length < 3 || ticker.length > 4) {
      setTickerError("Ticker must be 3-4 characters");
      return;
    }

    // In real app, this would submit to API and wait for admin approval
    // For now, we'll simulate registration and redirect to game
    login({
      id: crypto.randomUUID(),
      teamName,
      ticker: `$${ticker.toUpperCase()}`,
      role: "player",
    });
    router.push("/game");
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0e0e0e] flex items-center justify-center p-8">
        <div className="max-w-md w-full border border-[#00c853]/30 bg-[#00c853]/5 p-8 space-y-4">
          <div className="flex items-center gap-3">
            <span
              className="material-symbols-outlined text-[#00c853]"
              style={{ fontVariationSettings: '"FILL" 1' }}
            >
              verified
            </span>
            <h3 className="text-sm font-bold text-[#00c853] uppercase tracking-widest">
              REGISTRATION_PENDING
            </h3>
          </div>
          <p className="text-xs text-[#00c853]/80 leading-relaxed">
            Your application has been queued for verification. The simulation
            protocol requires manual credential validation for all institutional
            entrants.
          </p>
          <div className="flex justify-between items-center pt-2">
            <span className="text-[0.6rem] text-[#00c853] font-bold uppercase tracking-tighter">
              Status: AWAITING_BOARD_APPROVAL
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Top Nav Bar */}
      <nav className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-[#0a0a0a]/80 backdrop-blur-md border-none">
        <div className="flex items-center gap-8">
          <span className="font-bold text-lg text-[#FFB000] tracking-widest">
            COMPLEX: REGISTRATION
          </span>
          <div className="hidden md:flex gap-6">
            <span className="text-sm text-[#00c853] font-bold uppercase tracking-tighter">
              EVENT_STATUS: ACCEPTING_TEAMS
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/admin")}
            className="text-sm text-[#FFB000]/70 hover:text-[#FFB000] hover:bg-[#2a2a2a] transition-colors duration-150 px-3 py-1 uppercase tracking-tighter"
          >
            ADMIN_PORTAL
          </button>
        </div>
      </nav>

      {/* Main Content: Split Screen */}
      <main className="min-h-screen pt-16 flex flex-col md:flex-row">
        {/* Left Panel: Brand Anchor */}
        <section className="w-full md:w-1/2 bg-[#0a0a0a] relative overflow-hidden flex flex-col p-8 md:p-16 border-r border-[#FFB000]/10">
          {/* Grid Pattern Background */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255, 176, 0, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 176, 0, 0.05) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          <div className="relative z-10 flex-grow flex flex-col justify-center">
            <div className="mb-2 text-[#FFB000] text-xs font-bold tracking-[0.3em] uppercase">
              INSTITUTIONAL ROUND: 2026
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold text-[#FFB000] leading-none mb-8 tracking-tighter">
              COMPLEX
            </h1>
            <p className="text-lg md:text-xl text-[#FFB000]/80 font-medium mb-12 max-w-md tracking-tight">
              PROSE OVER PARAMETERS. STRATEGY IS WRITTEN, NOT TOGGLED. 50 TEAMS.
              18 HOURS. ONE MARKET.
            </p>

            <div className="space-y-4 border-l-2 border-[#FFB000] pl-6 py-2 bg-[#FFB000]/5 max-w-sm">
              <div className="flex flex-col">
                <span className="text-[0.65rem] text-[#FFB000]/60 uppercase tracking-widest font-bold">
                  DATE
                </span>
                <span className="text-lg font-bold">APRIL 18, 2026</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[0.65rem] text-[#FFB000]/60 uppercase tracking-widest font-bold">
                  DURATION
                </span>
                <span className="text-lg font-bold">18 HOURS</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[0.65rem] text-[#FFB000]/60 uppercase tracking-widest font-bold">
                  FORMAT
                </span>
                <span className="text-lg font-bold uppercase">
                  Continuous Market Simulation
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[0.65rem] text-[#FFB000]/60 uppercase tracking-widest font-bold">
                  LOCATION
                </span>
                <span className="text-lg font-bold uppercase">LT-101</span>
              </div>
            </div>
          </div>

          {/* Decorative Data Ribbon */}
          <div className="relative z-10 mt-12 py-3 border-t border-b border-[#FFB000]/20 flex gap-12 overflow-hidden whitespace-nowrap text-[0.65rem] text-[#FFB000]/50 tracking-[0.2em]">
            <span>MKT_VOL: 1.2M ▲</span>
            <span>STRAT_DELTA: +4.2%</span>
            <span>SLOTS_REMAINING: 14/50</span>
            <span>SYSTEM_STATE: STABLE</span>
            <span>MKT_VOL: 1.2M ▲</span>
          </div>
        </section>

        {/* Right Panel: Registration Form */}
        <section className="w-full md:w-1/2 bg-[#0e0e0e] p-8 md:p-16 flex flex-col justify-center">
          <div className="max-w-md w-full mx-auto">
            <header className="mb-12">
              <h2 className="text-2xl font-bold text-[#FFB000] uppercase tracking-widest">
                TEAM_REGISTRATION
              </h2>
              <div className="h-1 w-12 bg-[#FFB000] mt-2"></div>
            </header>

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* TEAM_NAME */}
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <label className="text-[0.7rem] font-bold text-[#FFB000] tracking-widest uppercase">
                    TEAM_NAME
                  </label>
                  <span className="text-[0.6rem] text-[#FFB000]/40">
                    {teamName.length}/50
                  </span>
                </div>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value.slice(0, 50))}
                  maxLength={50}
                  required
                  className="w-full bg-transparent border-b-2 border-[#2a2a2a] focus:border-[#FFB000] outline-none py-3 text-lg transition-colors duration-150 placeholder:text-[#2a2a2a]"
                  placeholder="ENTER UNIQUE IDENTIFIER"
                />
              </div>

              {/* TICKER_SYMBOL */}
              <div className="space-y-2">
                <label className="text-[0.7rem] font-bold text-[#FFB000] tracking-widest uppercase">
                  TICKER_SYMBOL
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-0 text-xl font-bold text-[#FFB000]">
                    $
                  </span>
                  <input
                    type="text"
                    value={ticker}
                    onChange={(e) => handleTickerChange(e.target.value)}
                    maxLength={4}
                    required
                    className={`w-full bg-transparent border-b-2 focus:border-[#FFB000] outline-none py-3 pl-6 text-xl transition-colors duration-150 placeholder:text-[#2a2a2a] font-black uppercase ${tickerError ? "border-[#ff3333]" : "border-[#2a2a2a]"}`}
                    placeholder="ABBR"
                  />
                </div>
                {tickerError && (
                  <span className="text-[0.6rem] text-[#ff3333]">
                    {tickerError}
                  </span>
                )}
              </div>

              {/* CONTACT_EMAIL */}
              <div className="space-y-2">
                <label className="text-[0.7rem] font-bold text-[#FFB000] tracking-widest uppercase">
                  CONTACT_EMAIL
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-transparent border-b-2 border-[#2a2a2a] focus:border-[#FFB000] outline-none py-3 text-lg transition-colors duration-150 placeholder:text-[#2a2a2a]"
                  placeholder="ANALYST@THAPAR.EDU"
                />
              </div>

              {/* ACCESS_PASSWORD */}
              <div className="space-y-2">
                <label className="text-[0.7rem] font-bold text-[#FFB000] tracking-widest uppercase">
                  ACCESS_PASSWORD
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  className="w-full bg-transparent border-b-2 border-[#2a2a2a] focus:border-[#FFB000] outline-none py-3 text-lg transition-colors duration-150 placeholder:text-[#2a2a2a]"
                  placeholder="••••••••••••"
                />
                <div className="flex gap-1 pt-2">
                  <div
                    className={`h-1 flex-1 ${password.length >= 2 ? "bg-[#00c853]" : "bg-[#2a2a2a]"}`}
                  ></div>
                  <div
                    className={`h-1 flex-1 ${password.length >= 4 ? "bg-[#00c853]" : "bg-[#2a2a2a]"}`}
                  ></div>
                  <div
                    className={`h-1 flex-1 ${password.length >= 6 ? "bg-[#00c853]" : "bg-[#2a2a2a]"}`}
                  ></div>
                  <div
                    className={`h-1 flex-1 ${password.length >= 8 ? "bg-[#00c853]" : "bg-[#2a2a2a]"}`}
                  ></div>
                  {password.length >= 8 && (
                    <span className="text-[0.6rem] text-[#00c853] font-bold ml-2">
                      STRENGTH: STRONG
                    </span>
                  )}
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-16 bg-[#FFB000] text-[#0a0a0a] font-extrabold text-sm tracking-[0.2em] uppercase hover:bg-[#ffba43] active:opacity-80 transition-all duration-150 flex items-center justify-center gap-2"
              >
                SUBMIT_REGISTRATION
                <span className="material-symbols-outlined text-lg">
                  arrow_forward
                </span>
              </button>
            </form>
          </div>
        </section>
      </main>

      {/* Footer Shell */}
      <footer className="w-full flex flex-col md:flex-row justify-between items-center px-8 py-8 border-t border-[#FFB000]/10 bg-[#0e0e0e] gap-4">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <span className="font-semibold text-[#FFB000] uppercase tracking-widest text-sm">
            © 2026 HELIX TIET
          </span>
          <div className="flex gap-4">
            <a
              href="#"
              className="text-[0.75rem] tracking-widest text-[#FFB000]/60 hover:text-[#FFB000] transition-colors duration-150 uppercase"
            >
              DOCUMENTATION
            </a>
            <a
              href="#"
              className="text-[0.75rem] tracking-widest text-[#FFB000]/60 hover:text-[#FFB000] transition-colors duration-150 uppercase"
            >
              CONTACT_SUPPORT
            </a>
          </div>
        </div>
        <div className="text-[0.6rem] text-[#FFB000]/30 tracking-tighter uppercase text-center md:text-right">
          System ID: CX-990-ARENA | LATENCY: 14MS | ENCRYPTION: AES-256-GCM
        </div>
      </footer>
    </>
  );
}
