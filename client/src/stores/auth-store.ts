import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import type { UserRole } from "@/lib/types";

interface AuthState {
  token: string | null;
  teamId: string | null;
  teamName: string | null;
  ticker: string | null;
  role: UserRole | null;
  isAuthenticated: boolean;

  login: (data: {
    token: string;
    team_id: string;
    team_name: string;
    ticker: string;
    role: UserRole;
  }) => void;
  adminLogin: (token: string) => void;
  logout: () => void;
  setToken: (token: string) => void;
}

// Path-aware localStorage: admin pages use `complex-auth-admin`, team pages use
// `complex-auth-team`. Lets the same browser hold an admin session AND a team
// session simultaneously without overwriting each other (critical for dev testing
// and for the admin/strategist/trader split during a live competition).
function authStorageKey(): string {
  if (typeof window === "undefined") return "complex-auth-team";
  return window.location.pathname.startsWith("/admin")
    ? "complex-auth-admin"
    : "complex-auth-team";
}

const pathAwareStorage: StateStorage = {
  getItem: (_name: string) => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(authStorageKey());
  },
  setItem: (_name: string, value: string) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(authStorageKey(), value);
  },
  removeItem: (_name: string) => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(authStorageKey());
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      teamId: null,
      teamName: null,
      ticker: null,
      role: null,
      isAuthenticated: false,

      login: (data) => {
        set({
          token: data.token,
          teamId: data.team_id,
          teamName: data.team_name,
          ticker: data.ticker,
          role: data.role,
          isAuthenticated: true,
        });
      },

      adminLogin: (token) => {
        set({
          token,
          teamId: null,
          teamName: null,
          ticker: null,
          role: "admin",
          isAuthenticated: true,
        });
      },

      logout: () => {
        set({
          token: null,
          teamId: null,
          teamName: null,
          ticker: null,
          role: null,
          isAuthenticated: false,
        });
      },

      setToken: (token) => {
        set({ token });
      },
    }),
    {
      // `name` is ignored by pathAwareStorage (kept for Zustand compat)
      name: "complex-auth",
      storage: createJSONStorage(() => pathAwareStorage),
      partialize: (state) => ({
        token: state.token,
        teamId: state.teamId,
        teamName: state.teamName,
        ticker: state.ticker,
        role: state.role,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
