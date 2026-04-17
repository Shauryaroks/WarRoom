"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { registerSchema } from "@/lib/schemas";

interface FieldErrors {
  team_name?: string;
  ticker?: string;
  email?: string;
  password?: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    team_name: "",
    ticker: "",
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateField(name: keyof typeof formData, value: string) {
    const testData = { ...formData, [name]: value };
    const result = registerSchema.safeParse(testData);
    if (result.success) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    } else {
      const fieldError = result.error.issues.find((issue) =>
        issue.path.includes(name)
      );
      setErrors((prev) => ({
        ...prev,
        [name]: fieldError?.message,
      }));
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    const newValue = name === "ticker" ? value.replace(/[^A-Za-z]/g, "").toUpperCase() : value;
    setFormData((prev) => ({ ...prev, [name]: newValue }));
    // Clear errors when user modifies the field
    if (errors[name as keyof FieldErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
    if (serverErrors[name as keyof FieldErrors]) {
      setServerErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    validateField(name as keyof typeof formData, value);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerErrors({});

    const result = registerSchema.safeParse(formData);
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
      await api.register(result.data);
      toast.success("Team registered. Awaiting admin approval.", {
        style: { borderLeft: "4px solid #00C853" },
      });
      setTimeout(() => router.push("/auth/login"), 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Try again.";
      if (message.toLowerCase().includes("ticker already taken")) {
        setServerErrors((prev) => ({ ...prev, ticker: "Ticker already taken" }));
      } else if (message.toLowerCase().includes("email already registered")) {
        setServerErrors((prev) => ({ ...prev, email: "Email already registered" }));
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

  function getFieldError(field: keyof FieldErrors): string | undefined {
    return serverErrors[field] || errors[field];
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#131313]">
      {/* Top header bar */}
      <header className="fixed top-0 left-0 w-full px-6 h-12 flex justify-between items-center bg-[#0e0e0e] z-50">
        <span className="text-xl font-black tracking-tighter text-[#2196f3]">COMPLEX</span>
        <span className="font-mono text-[9px] font-medium text-[#40e56c] uppercase tracking-widest">SYSTEM_STABLE // NO_ACTIVE_SESSION</span>
      </header>

      {/* Main card */}
      <main className="w-full max-w-[420px] bg-[#1c1b1b] relative shadow-2xl">
        {/* Blue top strip */}
        <div className="h-1 bg-[#2196f3] w-full" />

        <div className="p-8">
          {/* Card heading */}
          <div className="mb-10">
            <h1 className="font-sans font-extrabold text-2xl tracking-tight text-[#e5e2e1] mb-1">NEW_ENTITY_REGISTRATION</h1>
            <p className="font-mono text-[10px] text-[#89919d] uppercase tracking-widest">SECURE_NODE_ENTRY // GATE_ALPHA</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Field_01 // TEAM_NAME */}
            <div className="space-y-1">
              <label htmlFor="team_name" className="font-mono text-[10px] text-[#2196f3] uppercase font-bold tracking-tighter">
                Field_01 // TEAM_NAME
              </label>
              <input
                id="team_name"
                name="team_name"
                placeholder="Enter organizational name..."
                value={formData.team_name}
                onChange={handleChange}
                onBlur={handleBlur}
                className="w-full bg-[#201f1f] h-11 px-4 border-0 text-sm text-[#e5e2e1] placeholder:text-[#404752] font-sans focus:outline-none focus:border-l-2 focus:border-l-[#2196f3]"
                aria-invalid={!!getFieldError("team_name")}
              />
              {getFieldError("team_name") && (
                <p className="text-xs text-[#FF1744]">{getFieldError("team_name")}</p>
              )}
            </div>

            {/* Field_02 // TICKER_SYMBOL */}
            <div className="space-y-1">
              <label htmlFor="ticker" className="font-mono text-[10px] text-[#2196f3] uppercase font-bold tracking-tighter">
                Field_02 // TICKER_SYMBOL
              </label>
              <div className="relative">
                <input
                  id="ticker"
                  name="ticker"
                  placeholder="e.g. KNTIC"
                  value={formData.ticker}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  maxLength={5}
                  className="w-full bg-[#201f1f] h-11 px-4 border-0 text-sm text-[#40e56c] placeholder:text-[#404752] font-mono uppercase tracking-[0.2em] focus:outline-none focus:border-l-2 focus:border-l-[#2196f3]"
                  aria-invalid={!!getFieldError("ticker")}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[8px] text-[#404752]">
                  [3-5_CHARS]
                </div>
              </div>
              {getFieldError("ticker") && (
                <p className="text-xs text-[#FF1744]">{getFieldError("ticker")}</p>
              )}
            </div>

            {/* Field_03 // AUTH_EMAIL */}
            <div className="space-y-1">
              <label htmlFor="email" className="font-mono text-[10px] text-[#2196f3] uppercase font-bold tracking-tighter">
                Field_03 // AUTH_EMAIL
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="admin@terminal.local"
                value={formData.email}
                onChange={handleChange}
                onBlur={handleBlur}
                className="w-full bg-[#201f1f] h-11 px-4 border-0 text-sm text-[#e5e2e1] placeholder:text-[#404752] font-sans focus:outline-none focus:border-l-2 focus:border-l-[#2196f3]"
                aria-invalid={!!getFieldError("email")}
              />
              {getFieldError("email") && (
                <p className="text-xs text-[#FF1744]">{getFieldError("email")}</p>
              )}
            </div>

            {/* Field_04 // ACCESS_KEY */}
            <div className="space-y-1">
              <label htmlFor="password" className="font-mono text-[10px] text-[#2196f3] uppercase font-bold tracking-tighter">
                Field_04 // ACCESS_KEY
              </label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••••••"
                value={formData.password}
                onChange={handleChange}
                onBlur={handleBlur}
                className="w-full bg-[#201f1f] h-11 px-4 border-0 text-sm text-[#e5e2e1] placeholder:text-[#404752] font-sans focus:outline-none focus:border-l-2 focus:border-l-[#2196f3]"
                aria-invalid={!!getFieldError("password")}
              />
              {getFieldError("password") && (
                <p className="text-xs text-[#FF1744]">{getFieldError("password")}</p>
              )}
            </div>

            {/* Submit button */}
            <div className="pt-4 space-y-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="milled-metal-btn w-full h-12 text-white font-sans font-black text-xs uppercase tracking-[0.15em] transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? "REGISTERING..." : "Register Team"}
              </button>

              {/* Login link */}
              <div className="flex items-center justify-between pt-2 border-t border-[#404752]/20">
                <span className="font-mono text-[10px] text-[#89919d] uppercase">Existing entry?</span>
                <Link href="/auth/login" className="font-mono text-[10px] text-[#2196f3] hover:text-[#9ecaff] uppercase font-bold tracking-tight">
                  Execute_Login
                </Link>
              </div>
            </div>
          </form>
        </div>

        {/* Footer decoration */}
        <div className="flex justify-between items-center px-8 py-4 bg-[#0e0e0e] border-t border-[#404752]/10">
          <div className="flex gap-2">
            <div className="w-2 h-2 bg-[#40e56c]/20" />
            <div className="w-2 h-2 bg-[#40e56c]/40" />
            <div className="w-2 h-2 bg-[#40e56c]/80" />
          </div>
          <span className="font-mono text-[8px] text-[#404752] uppercase tracking-[0.3em]">ENCRYPTION_LAYER_AES256</span>
        </div>
      </main>
    </div>
  );
}
