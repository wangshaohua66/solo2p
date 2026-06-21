import { create } from 'zustand';
import type { Appointment, OverviewStats, Patient, User, Warning, WarningStats } from '@/types';
import { mockApi } from '@/api/mock';

interface AppState {
  user: User | null;
  token: string | null;
  sidebarCollapsed: boolean;
  overviewStats: OverviewStats | null;
  warningStats: WarningStats | null;
  pendingWarningCount: number;
  appointments: Appointment[];
  patients: Patient[];
  warnings: Warning[];
  loading: Record<string, boolean>;

  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  toggleSidebar: () => void;
  loadOverview: () => Promise<void>;
  loadWarningStats: () => Promise<void>;
  loadAppointments: (params?: { status?: string; date?: string }) => Promise<void>;
  loadPatients: (params?: { keyword?: string; riskLevel?: string }) => Promise<void>;
  loadWarnings: (params?: { status?: string; riskLevel?: string }) => Promise<void>;
  setLoading: (key: string, v: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  token: localStorage.getItem('auth_token'),
  sidebarCollapsed: false,
  overviewStats: null,
  warningStats: null,
  pendingWarningCount: 0,
  appointments: [],
  patients: [],
  warnings: [],
  loading: {},

  login: async (username, password) => {
    const res = await mockApi.login(username, password);
    if (res.token) {
      localStorage.setItem('auth_token', res.token);
      set({ user: res.user, token: res.token });
      return true;
    }
    return false;
  },
  logout: () => {
    localStorage.removeItem('auth_token');
    set({ user: null, token: null });
  },
  toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),

  loadOverview: async () => {
    set({ loading: { ...get().loading, overview: true } });
    const stats = await mockApi.getOverviewStats();
    set({ overviewStats: stats, loading: { ...get().loading, overview: false } });
  },

  loadWarningStats: async () => {
    const stats = await mockApi.getWarningStats();
    set({ warningStats: stats, pendingWarningCount: stats.pending + stats.processing });
  },

  loadAppointments: async (params) => {
    set({ loading: { ...get().loading, appointments: true } });
    const data = await mockApi.listAppointments(params);
    set({ appointments: data, loading: { ...get().loading, appointments: false } });
  },

  loadPatients: async (params) => {
    set({ loading: { ...get().loading, patients: true } });
    const data = await mockApi.listPatients(params);
    set({ patients: data, loading: { ...get().loading, patients: false } });
  },

  loadWarnings: async (params) => {
    set({ loading: { ...get().loading, warnings: true } });
    const data = await mockApi.listWarnings(params);
    set({ warnings: data, loading: { ...get().loading, warnings: false } });
  },

  setLoading: (key, v) => set({ loading: { ...get().loading, [key]: v } }),
}));
