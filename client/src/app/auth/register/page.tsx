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
              <Label htmlFor="team_name" className="text-xs">
                Team Name
              </Label>
              <Input
                id="team_name"
                name="team_name"
                placeholder="e.g. Apex Capital"
                value={formData.team_name}
                onChange={handleChange}
                onBlur={handleBlur}
                className="bg-secondary border border-input h-10 px-3 rounded-md"
                aria-invalid={!!getFieldError("team_name")}
              />
              {getFieldError("team_name") && (
                <p className="text-xs text-destructive">
                  {getFieldError("team_name")}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ticker" className="text-xs">
                Ticker Symbol
              </Label>
              <Input
                id="ticker"
                name="ticker"
                placeholder="e.g. APEX"
                value={formData.ticker}
                onChange={handleChange}
                onBlur={handleBlur}
                maxLength={5}
                className="bg-secondary border border-input h-10 px-3 rounded-md font-mono uppercase"
                aria-invalid={!!getFieldError("ticker")}
              />
              {getFieldError("ticker") && (
                <p className="text-xs text-destructive">
                  {getFieldError("ticker")}
                </p>
              )}
            </div>

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
                aria-invalid={!!getFieldError("email")}
              />
              {getFieldError("email") && (
                <p className="text-xs text-destructive">
                  {getFieldError("email")}
                </p>
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
                placeholder=""
                value={formData.password}
                onChange={handleChange}
                onBlur={handleBlur}
                className="bg-secondary border border-input h-10 px-3 rounded-md"
                aria-invalid={!!getFieldError("password")}
              />
              {getFieldError("password") && (
                <p className="text-xs text-destructive">
                  {getFieldError("password")}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary text-primary-foreground h-10 px-4 font-medium w-full rounded-md hover:bg-primary/90"
              style={isSubmitting ? { opacity: 0.7 } : undefined}
            >
              {isSubmitting ? "Registering..." : "Register Team"}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground text-center">
            Already registered?{" "}
            <Link href="/auth/login" className="text-[#2196F3] hover:underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
