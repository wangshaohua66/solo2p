import { create } from 'zustand';
import type { FiringCurve } from '@/types';
import * as curveApi from '@/api/curves';

interface CurveState {
  curves: FiringCurve[];
  selectedCurve: FiringCurve | null;
  templates: FiringCurve[];
  loading: boolean;
  fetchCurves: () => Promise<void>;
  fetchTemplates: () => Promise<void>;
  createCurve: (data: Partial<FiringCurve>) => Promise<void>;
  updateCurve: (id: number, data: Partial<FiringCurve>) => Promise<void>;
  deleteCurve: (id: number) => Promise<void>;
  selectCurve: (curve: FiringCurve | null) => void;
}

export const useCurveStore = create<CurveState>((set) => ({
  curves: [],
  selectedCurve: null,
  templates: [],
  loading: false,

  fetchCurves: async () => {
    set({ loading: true });
    try {
      const result = await curveApi.listCurves();
      set({ curves: result.content, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  fetchTemplates: async () => {
    try {
      const templates = await curveApi.listTemplates();
      set({ templates });
    } catch {
      // keep existing templates
    }
  },

  createCurve: async (data) => {
    const newCurve = await curveApi.createCurve(data);
    set((state) => ({ curves: [...state.curves, newCurve] }));
  },

  updateCurve: async (id, data) => {
    const updated = await curveApi.updateCurve(id, data);
    set((state) => ({
      curves: state.curves.map((c) => (c.id === id ? updated : c)),
      selectedCurve:
        state.selectedCurve?.id === id ? updated : state.selectedCurve,
    }));
  },

  deleteCurve: async (id) => {
    await curveApi.deleteCurve(id);
    set((state) => ({
      curves: state.curves.filter((c) => c.id !== id),
      selectedCurve:
        state.selectedCurve?.id === id ? null : state.selectedCurve,
    }));
  },

  selectCurve: (curve) => set({ selectedCurve: curve }),
}));
