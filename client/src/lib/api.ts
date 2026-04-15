import type {
  RegisterResponse,
  LoginResponse,
  AdminLoginResponse,
  MeResponse,
  ApprovedTeam,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

class ApiClient {
  private getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("token");
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const error = await res
        .json()
        .catch(() => ({ detail: "Something went wrong. Try again." }));
      throw new Error(
        error.detail || `Request failed with status ${res.status}`
      );
    }

    return res.json();
  }

  async register(data: {
    team_name: string;
    ticker: string;
    email: string;
    password: string;
  }): Promise<RegisterResponse> {
    return this.request<RegisterResponse>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async login(data: {
    email: string;
    password: string;
    role: string;
  }): Promise<LoginResponse> {
    return this.request<LoginResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async adminLogin(data: {
    email: string;
    password: string;
  }): Promise<AdminLoginResponse> {
    return this.request<AdminLoginResponse>("/api/v1/admin/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async me(): Promise<MeResponse> {
    return this.request<MeResponse>("/api/v1/auth/me");
  }

  async getApprovedTeams(): Promise<ApprovedTeam[]> {
    return this.request<ApprovedTeam[]>("/api/v1/teams/approved");
  }
}

export const api = new ApiClient();
