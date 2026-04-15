"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      const message = err instanceof Error ? err.message : "Something went wrong. Try again.";
      if (message.toLowerCase().includes("access denied") || message.toLowerCase().includes("not admin") || message.toLowerCase().includes("forbidden")) {
        toast.error("Access denied.", {
          style: { borderLeft: "4px solid #FF1744" },
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
      <Card className="w-full max-w-[380px] rounded-none bg-card border border-border p-6 ring-0">
        <CardContent className="p-0 space-y-6">
          <div className="space-y-1">
            <h1 className="font-mono text-xl font-semibold text-primary">
              COMPLEX
            </h1>
            <p className="text-xs text-muted-foreground">
              Admin Panel
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
                placeholder="admin@example.com"
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

            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary text-primary-foreground h-10 px-4 font-medium w-full rounded-md hover:bg-primary/90"
              style={isSubmitting ? { opacity: 0.7 } : undefined}
            >
              {isSubmitting ? "Accessing..." : "Access Panel"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
