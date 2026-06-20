import { create } from 'zustand';
import type { FinanceRecord, DepositRecord, MergeSettleResult, PageResult, FinanceType, FinanceStatus } from '../types';
import { financeApi } from '../services/financeApi';

interface FinanceState {
  records: FinanceRecord[];
  deposits: DepositRecord[];
  currentRecord: FinanceRecord | null;
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  filters: {
    type?: FinanceType;
    status?: FinanceStatus;
    startDate?: string;
    endDate?: string;
    keyword?: string;
  };
  summary: {
    totalIncome: number;
    totalExpense: number;
    totalDeposit: number;
    totalRefund: number;
    netProfit: number;
  };
  mergeResult: MergeSettleResult | null;

  fetchRecords: (params?: Record<string, unknown>) => Promise<void>;
  fetchDeposits: (params?: Record<string, unknown>) => Promise<void>;
  fetchSummary: (params?: Record<string, unknown>) => Promise<void>;
  createRecord: (data: Partial<FinanceRecord>) => Promise<FinanceRecord>;
  updateRecord: (id: string, data: Partial<FinanceRecord>) => Promise<FinanceRecord>;
  deleteRecord: (id: string) => Promise<void>;
  addRecord: (data: Partial<FinanceRecord>) => Promise<FinanceRecord>;
  confirmRecord: (id: string) => Promise<FinanceRecord>;
  refundDeposit: (id: string, refundAmount: number, reason?: string) => Promise<DepositRecord>;
  mergeSettle: (params: { scheduleIds: string[]; includeDeposit: boolean }) => Promise<MergeSettleResult>;
  exportRecords: (format?: string, params?: Record<string, unknown>) => Promise<Blob>;
  setFilters: (filters: Partial<FinanceState['filters']>) => void;
  setPagination: (page: number, pageSize: number) => void;
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  records: [],
  deposits: [],
  currentRecord: null,
  loading: false,
  total: 0,
  page: 1,
  pageSize: 20,
  filters: {},
  summary: {
    totalIncome: 0,
    totalExpense: 0,
    totalDeposit: 0,
    totalRefund: 0,
    netProfit: 0,
  },
  mergeResult: null,

  fetchRecords: async (params = {}) => {
    set({ loading: true });
    try {
      const { page, pageSize, filters } = get();
      const response = await financeApi.getRecords({
        page,
        pageSize,
        ...filters,
        ...params,
      }) as unknown as PageResult<FinanceRecord>;
      set({
        records: response.data,
        total: response.total,
        loading: false,
      });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  fetchDeposits: async (params = {}) => {
    set({ loading: true });
    try {
      const deposits = await financeApi.getDeposits(params);
      set({ deposits, loading: false });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  fetchSummary: async (params = {}) => {
    set({ loading: true });
    try {
      const summary = await financeApi.getSummary(params);
      set({ summary: {
        totalIncome: summary.totalIncome,
        totalExpense: summary.totalExpense,
        totalDeposit: summary.totalDeposit,
        totalRefund: summary.totalRefund,
        netProfit: summary.netProfit,
      }, loading: false });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  createRecord: async (data: Partial<FinanceRecord>) => {
    set({ loading: true });
    try {
      const record = await financeApi.createRecord(data);
      set((state) => ({
        records: [record, ...state.records],
        loading: false,
      }));
      return record;
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  updateRecord: async (id: string, data: Partial<FinanceRecord>) => {
    set({ loading: true });
    try {
      const record = await financeApi.updateRecord(id, data);
      set((state) => ({
        records: state.records.map((r) => (r.id === id ? record : r)),
        loading: false,
      }));
      return record;
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  deleteRecord: async (id: string) => {
    set({ loading: true });
    try {
      await financeApi.deleteRecord(id);
      set((state) => ({
        records: state.records.filter((r) => r.id !== id),
        loading: false,
      }));
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  confirmRecord: async (id: string) => {
    set({ loading: true });
    try {
      const record = await financeApi.confirmRecord(id);
      set((state) => ({
        records: state.records.map((r) => (r.id === id ? record : r)),
        loading: false,
      }));
      return record;
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  addRecord: async (data: Partial<FinanceRecord>) => {
    set({ loading: true });
    try {
      const record = await financeApi.createRecord(data);
      set((state) => ({
        records: [record, ...state.records],
        loading: false,
      }));
      return record;
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  refundDeposit: async (id: string, refundAmount: number, reason = '') => {
    set({ loading: true });
    try {
      const deposit = await financeApi.refundDeposit(id, refundAmount, reason);
      set((state) => ({
        deposits: state.deposits.map((d) => (d.id === id ? deposit : d)),
        loading: false,
      }));
      return deposit;
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  mergeSettle: async (params: { scheduleIds: string[]; includeDeposit: boolean }) => {
    set({ loading: true });
    try {
      const result = await financeApi.mergeSettle(params.scheduleIds, params.includeDeposit);
      set({ mergeResult: result, loading: false });
      return result;
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  exportRecords: async (format = 'xlsx', params = {}) => {
    try {
      return await financeApi.exportRecords({ format, ...params });
    } catch (error) {
      throw error;
    }
  },

  setFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
    }));
  },

  setPagination: (page: number, pageSize: number) => {
    set({ page, pageSize });
  },
}));
