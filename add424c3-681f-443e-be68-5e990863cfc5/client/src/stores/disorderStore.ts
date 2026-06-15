import { create } from 'zustand';
import {
  reportDisorder as apiReportDisorder,
  getDisorderList as apiGetDisorderList,
  getDisorderDetail as apiGetDisorderDetail,
  gradeDisorder as apiGradeDisorder,
  type GetDisorderListParams,
  type GradeDisorderParams,
  type ReportDisorderParams
} from '@/services/api';
import type { Disorder, PaginatedResponse } from '@/types';

interface DisorderState {
  disorders: Disorder[];
  total: number;
  currentDisorder: Disorder | null;
  priorityScore: number;
  isUrgent: boolean;
  loading: boolean;
  error: string | null;
  filters: GetDisorderListParams;

  fetchDisorders: (params?: GetDisorderListParams) => Promise<void>;
  fetchDisorderDetail: (id: string) => Promise<void>;
  reportDisorder: (params: ReportDisorderParams) => Promise<Disorder | null>;
  gradeDisorder: (id: string, params: GradeDisorderParams) => Promise<Disorder | null>;
  setFilters: (filters: Partial<GetDisorderListParams>) => void;
  clearError: () => void;
}

export const useDisorderStore = create<DisorderState>((set, get) => ({
  disorders: [],
  total: 0,
  currentDisorder: null,
  priorityScore: 0,
  isUrgent: false,
  loading: false,
  error: null,
  filters: {
    page: 1,
    pageSize: 10
  },

  fetchDisorders: async (params) => {
    set({ loading: true, error: null });
    try {
      const mergedParams = { ...get().filters, ...params };
      const result: PaginatedResponse<Disorder> = await apiGetDisorderList(mergedParams);
      set({
        disorders: result.list || [],
        total: result.total || 0,
        loading: false
      });
    } catch (e: any) {
      set({ error: e.message || '获取病害列表失败', loading: false });
    }
  },

  fetchDisorderDetail: async (id) => {
    set({ loading: true, error: null });
    try {
      const detail = await apiGetDisorderDetail(id);
      set({
        currentDisorder: detail,
        priorityScore: (detail as any).priorityScore || 0,
        isUrgent: (detail as any).isUrgent || false,
        loading: false
      });
    } catch (e: any) {
      set({ error: e.message || '获取病害详情失败', loading: false });
    }
  },

  reportDisorder: async (params) => {
    set({ loading: true, error: null });
    try {
      const disorder = await apiReportDisorder(params);
      const state = get();
      set({
        disorders: [disorder, ...state.disorders],
        total: state.total + 1,
        loading: false
      });
      return disorder;
    } catch (e: any) {
      set({ error: e.message || '上报病害失败', loading: false });
      return null;
    }
  },

  gradeDisorder: async (id, params) => {
    set({ loading: true, error: null });
    try {
      const updated = await apiGradeDisorder(id, params);
      const state = get();
      set({
        disorders: state.disorders.map((d) => (d.id === id ? updated : d)),
        currentDisorder: state.currentDisorder?.id === id ? updated : state.currentDisorder,
        loading: false
      });
      return updated;
    } catch (e: any) {
      set({ error: e.message || '审核病害失败', loading: false });
      return null;
    }
  },

  setFilters: (filters) => {
    set((state) => ({ filters: { ...state.filters, ...filters } }));
  },

  clearError: () => set({ error: null })
}));
