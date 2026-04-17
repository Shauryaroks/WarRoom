import { z } from "zod";

export const registerSchema = z.object({
  team_name: z
    .string()
    .min(3, "Team name must be at least 3 characters")
    .max(50, "Team name must be at most 50 characters"),
  ticker: z
    .string()
    .min(3, "Ticker must be 3-5 characters")
    .max(5, "Ticker must be 3-5 characters")
    .regex(/^[A-Z]+$/, "Ticker must be uppercase letters only")
    .transform((v) => v.toUpperCase()),
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
  role: z.enum(["strategist", "trader"]),
});

export const adminLoginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
