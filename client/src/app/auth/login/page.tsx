"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { api } from "@/lib/api";
import { loginSchema } from "@/lib/schemas";

interface FieldErrors {
  email?: string;
  password?: string;
}

export default function LoginPage() {
  const router = useRouter();
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
      localStorage.setItem("token", response.token);
      router.push("/lobby");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Try again.";
      if (message.toLowerCase().includes("not yet approved") || message.toLowerCase().includes("not approved")) {
        toast.warning("Team not yet approved by admin.", {
          style: { borderLeft: "4px solid #FF9500" },
          duration: 5000,
        });
      } else if (message.toLowerCase().includes("invalid") || message.toLowerCase().includes("credentials")) {
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
    <div className="bg-background min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-[420px] rounded-none bg-card border border-border p-6 ring-0">
        <CardContent className="p-0 space-y-6">
          <div className="space-y-1">
            <h1 className="font-mono text-xl font-semibold text-primary">
              COMPLEX
            </h1>
            <p className="text-xs text-muted-foreground">
              Case Competition Platform
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="team@example.com"
                value={formData.email}
                onChange={handleChange}
                onBlur={handleBlur}
                className="bg-secondary border border-input h-10 px-3 rounded-md"
                aria-invalid={!!errors.email}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                onBlur={handleBlur}
                className="bg-secondary border border-input h-10 px-3 rounded-md"
                aria-invalid={!!errors.password}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Role</Label>
              <div className="flex w-full">
                <button
                  type="button"
                  onClick={() => setRole("strategist")}
                  className={`flex-1 h-10 text-sm font-medium transition-colors ${
                    role === "strategist"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  Strategist
                </button>
                <button
                  type="button"
                  onClick={() => setRole("trader")}
                  className={`flex-1 h-10 text-sm font-medium transition-colors ${
                    role === "trader"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  Trader
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary text-primary-foreground h-10 px-4 font-medium w-full rounded-md hover:bg-primary/90"
              style={isSubmitting ? { opacity: 0.7 } : undefined}
            >
              {isSubmitting ? "Logging in..." : "Log In"}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground text-center">
            No team yet?{" "}
            <Link href="/auth/register" className="text-[#2196F3] hover:underline">
              Register
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
