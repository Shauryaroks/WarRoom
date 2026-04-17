"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { loginSchema } from "@/lib/schemas";
import { useAuthStore } from "@/stores/auth-store";

interface FieldErrors {
  email?: string;
  password?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, login: storeLogin } = useAuthStore();

  // If already authenticated, show option to continue or re-login
  // Don't auto-redirect — user may want to switch roles

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [role, setRole] = useState<"strategist" | "trader">("strategist");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateField(name: keyof typeof formData, value: string) {
    const testData = { ...formData, [name]: value, role };
    const result = loginSchema.safeParse(testData);
    if (result.success) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    } else {
      const fieldError = result.error.issues.find((issue) =>
        issue.path.includes(name),
      );
      setErrors((prev) => ({
        ...prev,
        [name]: fieldError?.message,
      }));
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FieldErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    validateField(name as keyof typeof formData, value);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const submitData = { ...formData, role };
    const result = loginSchema.safeParse(submitData);
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof FieldErrors;
        if (!fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.login(result.data);
      storeLogin(response);
      router.push("/lobby");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Try again.";
      if (
        message.toLowerCase().includes("not yet approved") ||
        message.toLowerCase().includes("not approved")
      ) {
        toast.warning("Team not yet approved by admin.", {
          style: { borderLeft: "4px solid #FF9500" },
          duration: 5000,
        });
      } else if (
        message.toLowerCase().includes("invalid") ||
        message.toLowerCase().includes("credentials")
      ) {
        toast.error("Invalid email or password.", {
          style: { borderLeft: "4px solid #FF1744" },
          duration: 5000,
        });
      } else {
        toast.error("Something went wrong. Try again.", {
          style: { borderLeft: "4px solid #FF1744" },
          duration: 5000,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="bg-[#131313] min-h-screen flex flex-col">
      {/* Top nav */}
      <nav className="flex justify-between items-center w-full px-4 h-12 bg-[#0e0e0e] fixed top-0 z-50">
        <div className="text-xl font-black tracking-tighter text-[#2196f3] uppercase">
          COMPLEX
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-[9px] font-medium text-[#40e56c] uppercase tracking-widest">
            SYSTEM_STABLE
          </span>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-grow flex items-center justify-center pt-12 pb-6 px-4">
        {/* Split grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 w-full max-w-6xl border border-[#404752]/20">
          {/* Left panel */}
          <div className="lg:col-span-5 bg-[#0e0e0e] p-8 flex flex-col justify-between border-r border-[#404752]/20">
            <div>
              <div className="font-mono text-[#2196f3] text-xs mb-4 tracking-tighter">
                ESTABLISHING SECURE_LINK...
              </div>
              <h1 className="text-4xl font-black uppercase tracking-tighter leading-none mb-6">
                COMPLEX
                <br />
                <span className="text-[#2196f3]">ARCHITECTURE</span>
              </h1>
              <p className="text-[#bfc7d4] text-sm max-w-xs mb-8 leading-relaxed">
                Precision Brutalism for high-frequency strategy execution.
                Access the kinetic ledger.
              </p>
            </div>
            <div className="space-y-4">
              <div className="bg-[#2a2a2a] p-4">
                <div className="font-mono text-[10px] text-[#40e56c] mb-1">
                  SYSTEM_STATUS
                </div>
                <div className="flex justify-between items-end">
                  <span className="font-mono text-xl">OPERATIONAL</span>
                  <span className="font-mono text-[10px] opacity-50">
                    99.98% UPTIME
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#201f1f] p-4">
                  <div className="font-mono text-[10px] text-[#bfc7d4] uppercase">
                    Latency
                  </div>
                  <div className="font-mono text-lg">14MS</div>
                </div>
                <div className="bg-[#201f1f] p-4">
                  <div className="font-mono text-[10px] text-[#bfc7d4] uppercase">
                    Nodes
                  </div>
                  <div className="font-mono text-lg">1,204</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className="lg:col-span-7 bg-[#131313] p-8 lg:p-16 flex flex-col justify-center">
            <div className="max-w-md mx-auto w-full">
              <div className="mb-10 text-center lg:text-left">
                <h2 className="text-2xl font-bold uppercase tracking-tight mb-2">
                  Initialize Session
                </h2>
                <p className="text-[#bfc7d4] text-xs font-mono uppercase">
                  Enter credentials to bypass terminal firewall
                </p>
              </div>

              {/* Already logged in banner */}
              {isAuthenticated && (
                <div className="mb-6 bg-[#2196f3]/10 border border-[#2196f3]/30 p-4 space-y-3">
                  <p className="font-mono text-xs text-[#2196f3] uppercase">
                    Active session detected — {role}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => router.push("/lobby")}
                      className="flex-1 bg-[#2196f3] text-white py-2 font-mono text-[10px] uppercase font-bold"
                    >
                      Continue to Lobby
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        useAuthStore.getState().logout();
                      }}
                      className="flex-1 border border-[#FF1744]/30 text-[#FF1744] py-2 font-mono text-[10px] uppercase font-bold hover:bg-[#FF1744]/10"
                    >
                      Logout &amp; Re-login
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Role toggle */}
                <div className="bg-[#0e0e0e] p-1 flex border border-[#404752]/30">
                  <button
                    type="button"
                    onClick={() => setRole("strategist")}
                    className={`flex-1 py-2 text-[10px] font-mono uppercase tracking-widest font-bold transition-colors ${
                      role === "strategist"
                        ? "bg-[#2196f3] text-white"
                        : "text-[#bfc7d4] hover:bg-[#2a2a2a]"
                    }`}
                  >
                    Strategist
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("trader")}
                    className={`flex-1 py-2 text-[10px] font-mono uppercase tracking-widest font-bold transition-colors ${
                      role === "trader"
                        ? "bg-[#2196f3] text-white"
                        : "text-[#bfc7d4] hover:bg-[#2a2a2a]"
                    }`}
                  >
                    Trader
                  </button>
                </div>

                {/* Email field */}
                <div className="space-y-1">
                  <label
                    htmlFor="email"
                    className="text-[10px] font-mono uppercase text-[#bfc7d4] ml-1"
                  >
                    Email Address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="USER@KINETIC.SYS"
                    value={formData.email}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="w-full bg-[#1c1b1b] border-0 border-l-2 border-transparent py-4 pl-4 font-mono text-sm placeholder:opacity-30 focus:border-l-[#2196f3] focus:bg-[#2a2a2a] transition-all"
                    aria-invalid={!!errors.email}
                  />
                  {errors.email && (
                    <p className="text-xs text-[#FF1744]">{errors.email}</p>
                  )}
                </div>

                {/* Password field */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center px-1">
                    <label
                      htmlFor="password"
                      className="text-[10px] font-mono uppercase text-[#bfc7d4]"
                    >
                      Access Token
                    </label>
                    <span className="text-[9px] font-mono uppercase text-[#2196f3]">
                      Forgot?
                    </span>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="w-full bg-[#1c1b1b] border-0 border-l-2 border-transparent py-4 pl-4 font-mono text-sm placeholder:opacity-30 focus:border-l-[#2196f3] focus:bg-[#2a2a2a] transition-all"
                    aria-invalid={!!errors.password}
                  />
                  {errors.password && (
                    <p className="text-xs text-[#FF1744]">{errors.password}</p>
                  )}
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#2196f3] text-white py-4 font-black uppercase tracking-[0.2em] text-sm hover:brightness-110 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? "INITIALIZING..." : "Login"}
                </button>

                {/* Register link */}
                <p className="text-[10px] font-mono uppercase text-[#bfc7d4] text-center pt-4">
                  Unauthorized access is logged.
                  <Link
                    href="/auth/register"
                    className="text-[#2196f3] font-bold hover:underline ml-2"
                  >
                    Register New Agent
                  </Link>
                </p>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
