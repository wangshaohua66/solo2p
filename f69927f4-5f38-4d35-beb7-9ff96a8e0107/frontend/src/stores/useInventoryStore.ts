import { create } from 'zustand';
import type { Batch, InventoryWarning } from '@/types';
import * as inventoryApi from '@/api/inventory';

interface InventoryState {
  batches: Batch[];
  warnings: InventoryWarning[];
  loading: boolean;
  fetchBatches: (params?: Record<string, unknown>) => Promise<void>;
  createBatch: (data: Partial<Batch>) => Promise<void>;
  checkoutBatch: (
    id: number,
    data: { quantity: number; operatorId: number; note?: string },
  ) => Promise<void>;
  fetchWarnings: () => Promise<void>;
}

export const useInventoryStore = create<InventoryState>((set) => ({
  batches: [],
  warnings: [],
  loading: false,

  fetchBatches: async (params) => {
    set({ loading: true });
    try {
      const result = await inventoryApi.listBatches(params);
      set({ batches: result.content, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  createBatch: async (data) => {
    const newBatch = await inventoryApi.createBatch(data);
    set((state) => ({ batches: [...state.batches, newBatch] }));
  },

  checkoutBatch: async (id, data) => {
    const updated = await inventoryApi.checkoutBatch(id, data);
    set((state) => ({
      batches: state.batches.map((b) => (b.id === id ? updated : b)),
    }));
  },

  fetchWarnings: async () => {
    try {
      const warnings = await inventoryApi.listWarnings();
      set({ warnings });
    } catch {
      // keep existing warnings
    }
  },
}));
