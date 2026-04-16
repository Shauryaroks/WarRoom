import { create } from "zustand";
import type { AdminTeam, NewsItem, ActivityEvent } from "@/lib/types";

interface AdminState {
  teams: AdminTeam[];
  news: NewsItem[];
  activityLog: ActivityEvent[];

  setTeams: (teams: AdminTeam[]) => void;
  updateTeamStatus: (teamId: string, status: string) => void;
  removeTeam: (teamId: string) => void;
  setNews: (news: NewsItem[]) => void;
  addNews: (item: NewsItem) => void;
  setActivityLog: (events: ActivityEvent[]) => void;
  addActivity: (event: ActivityEvent) => void;
}

export const useAdminStore = create<AdminState>()((set) => ({
  teams: [],
  news: [],
  activityLog: [],

  setTeams: (teams) => set({ teams }),
  updateTeamStatus: (teamId, status) =>
    set((s) => ({
      teams: s.teams.map((t) => (t.id === teamId ? { ...t, status } : t)),
    })),
  removeTeam: (teamId) =>
    set((s) => ({ teams: s.teams.filter((t) => t.id !== teamId) })),
  setNews: (news) => set({ news }),
  addNews: (item) =>
    set((s) => ({
      news: s.news.some((n) => n.id === item.id)
        ? s.news
        : [item, ...s.news],
    })),
  setActivityLog: (events) => set({ activityLog: events }),
  addActivity: (event) =>
    set((s) => ({
      activityLog: [event, ...s.activityLog].slice(0, 200),
    })),
}));
