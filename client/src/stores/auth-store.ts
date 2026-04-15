import { create } from "zustand";
import { persist } from "zustand/middleware";
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
        localStorage.setItem("token", data.token);
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
        localStorage.setItem("token", token);
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
        localStorage.removeItem("token");
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
        localStorage.setItem("token", token);
        set({ token });
      },
    }),
    {
      name: "complex-auth",
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
