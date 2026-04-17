"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { adminLoginSchema } from "@/lib/schemas";
import { useAuthStore } from "@/stores/auth-store";

interface FieldErrors {
  email?: string;
  password?: string;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateField(name: keyof typeof formData, value: string) {
    const testData = { ...formData, [name]: value };
    const result = adminLoginSchema.safeParse(testData);
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

    const result = adminLoginSchema.safeParse(formData);
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
      const response = await api.adminLogin(result.data);
      useAuthStore.getState().adminLogin(response.token);
      router.push("/admin");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Try again.";
      if (
        message.toLowerCase().includes("access denied") ||
        message.toLowerCase().includes("not admin") ||
        message.toLowerCase().includes("forbidden")
      ) {
        toast.error("Access denied.", {
          style: { borderLeft: "4px solid #FF1744" },
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
    <div className="bg-[#131313] min-h-screen flex flex-col items-center justify-center p-4">
      {/* Top header */}
      <header className="fixed top-0 left-0 w-full px-6 h-12 flex justify-between items-center bg-[#0e0e0e] z-50">
        <span className="text-xl font-black tracking-tighter text-[#2196f3]">
          COMPLEX
        </span>
        <span className="font-mono text-[9px] font-medium text-[#89919d] uppercase tracking-widest">
          ADMIN_ACCESS_PORTAL
        </span>
      </header>

      {/* Main card */}
      <main className="w-full max-w-[380px] bg-[#1c1b1b] relative shadow-2xl">
        {/* Red top strip (admin differentiation) */}
        <div className="h-1 bg-[#FF1744] w-full" />

        <div className="p-8">
          {/* Card heading */}
          <div className="mb-10">
            <h1 className="font-sans font-extrabold text-2xl tracking-tight text-[#e5e2e1] mb-1">
              ADMIN_ACCESS
            </h1>
            <p className="font-mono text-[10px] text-[#89919d] uppercase tracking-widest">
              ELEVATED_PRIVILEGES // ROOT_GATE
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* AUTH_EMAIL */}
            <div className="space-y-1">
              <label
                htmlFor="email"
                className="font-mono text-[10px] text-[#FF1744] uppercase font-bold tracking-tighter"
              >
                AUTH_EMAIL
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="admin@terminal.local"
                value={formData.email}
                onChange={handleChange}
                onBlur={handleBlur}
                className="w-full bg-[#201f1f] h-11 px-4 border-0 text-sm text-[#e5e2e1] placeholder:text-[#404752] font-sans focus:outline-none focus:border-l-2 focus:border-l-[#FF1744]"
                aria-invalid={!!errors.email}
              />
              {errors.email && (
                <p className="text-xs text-[#FF1744]">{errors.email}</p>
              )}
            </div>

            {/* ACCESS_KEY */}
            <div className="space-y-1">
              <label
                htmlFor="password"
                className="font-mono text-[10px] text-[#FF1744] uppercase font-bold tracking-tighter"
              >
                ACCESS_KEY
              </label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••••••"
                value={formData.password}
                onChange={handleChange}
                onBlur={handleBlur}
                className="w-full bg-[#201f1f] h-11 px-4 border-0 text-sm text-[#e5e2e1] placeholder:text-[#404752] font-sans focus:outline-none focus:border-l-2 focus:border-l-[#FF1744]"
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
              className="w-full h-12 bg-[#FF1744] text-white font-sans font-black text-xs uppercase tracking-[0.15em] transition-all active:scale-[0.98] hover:brightness-110 disabled:opacity-50"
            >
              {isSubmitting ? "AUTHENTICATING..." : "Access Control Panel"}
            </button>
          </form>
        </div>

        {/* Footer decoration */}
        <div className="flex justify-between items-center px-8 py-4 bg-[#0e0e0e] border-t border-[#404752]/10">
          <div className="flex gap-2">
            <div className="w-2 h-2 bg-[#FF1744]/20" />
            <div className="w-2 h-2 bg-[#FF1744]/40" />
            <div className="w-2 h-2 bg-[#FF1744]/80" />
          </div>
          <span className="font-mono text-[8px] text-[#404752] uppercase tracking-[0.3em]">
            ENCRYPTION_LAYER_AES256
          </span>
        </div>
      </main>
    </div>
  );
}
