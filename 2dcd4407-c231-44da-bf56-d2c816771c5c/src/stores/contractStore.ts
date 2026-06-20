import { create } from 'zustand';
import type { Contract, ContractTemplate, PageResult, ContractStatus } from '../types';
import { contractApi } from '../services/contractApi';

interface ContractState {
  contracts: Contract[];
  templates: ContractTemplate[];
  currentContract: Contract | null;
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  filters: {
    status?: ContractStatus;
    type?: string;
    keyword?: string;
  };

  fetchContracts: (params?: Record<string, unknown>) => Promise<void>;
  fetchTemplates: () => Promise<void>;
  fetchContractById: (id: string) => Promise<Contract>;
  createContract: (data: Partial<Contract>) => Promise<Contract>;
  updateContract: (id: string, data: Partial<Contract>) => Promise<Contract>;
  deleteContract: (id: string) => Promise<void>;
  submitApproval: (id: string) => Promise<Contract>;
  approveStep: (id: string, stepId: string, approved: boolean, comment: string) => Promise<Contract>;
  approveContract: (id: string, comment?: string) => Promise<Contract>;
  rejectContract: (id: string, comment: string) => Promise<Contract>;
  signContract: (id: string, signatureUrl?: string) => Promise<Contract>;
  archiveContract: (id: string) => Promise<Contract>;
  setCurrentContract: (contract: Contract | null) => void;
  setFilters: (filters: Partial<ContractState['filters']>) => void;
  setPagination: (page: number, pageSize: number) => void;
}

export const useContractStore = create<ContractState>((set, get) => ({
  contracts: [],
  templates: [],
  currentContract: null,
  loading: false,
  total: 0,
  page: 1,
  pageSize: 20,
  filters: {},

  fetchContracts: async (params = {}) => {
    set({ loading: true });
    try {
      const { page, pageSize, filters } = get();
      const response = await contractApi.getList({
        page,
        pageSize,
        ...filters,
        ...params,
      }) as unknown as PageResult<Contract>;
      set({
        contracts: response.data,
        total: response.total,
        loading: false,
      });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  fetchTemplates: async () => {
    set({ loading: true });
    try {
      const templates = await contractApi.getTemplates();
      set({ templates, loading: false });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  fetchContractById: async (id: string) => {
    set({ loading: true });
    try {
      const contract = await contractApi.getById(id);
      set({ currentContract: contract, loading: false });
      return contract;
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  createContract: async (data: Partial<Contract>) => {
    set({ loading: true });
    try {
      const contract = await contractApi.create(data);
      set((state) => ({
        contracts: [contract, ...state.contracts],
        loading: false,
      }));
      return contract;
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  updateContract: async (id: string, data: Partial<Contract>) => {
    set({ loading: true });
    try {
      const contract = await contractApi.update(id, data);
      set((state) => ({
        contracts: state.contracts.map((c) => (c.id === id ? contract : c)),
        currentContract: state.currentContract?.id === id ? contract : state.currentContract,
        loading: false,
      }));
      return contract;
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  deleteContract: async (id: string) => {
    set({ loading: true });
    try {
      await contractApi.delete(id);
      set((state) => ({
        contracts: state.contracts.filter((c) => c.id !== id),
        loading: false,
      }));
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  submitApproval: async (id: string) => {
    set({ loading: true });
    try {
      const contract = await contractApi.submitApproval(id);
      set((state) => ({
        contracts: state.contracts.map((c) => (c.id === id ? contract : c)),
        currentContract: state.currentContract?.id === id ? contract : state.currentContract,
        loading: false,
      }));
      return contract;
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  approveStep: async (id: string, stepId: string, approved: boolean, comment: string) => {
    set({ loading: true });
    try {
      const contract = await contractApi.approveStep(id, stepId, approved, comment);
      const typedContract = contract as Contract;
      set((state) => ({
        contracts: state.contracts.map((c) => (c.id === id ? typedContract : c)),
        currentContract: state.currentContract?.id === id ? typedContract : state.currentContract,
        loading: false,
      }));
      return typedContract;
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  approveContract: async (id: string, comment = '') => {
    set({ loading: true });
    try {
      const contract = await contractApi.approve(id, comment);
      set((state) => ({
        contracts: state.contracts.map((c) => (c.id === id ? contract : c)),
        currentContract: state.currentContract?.id === id ? contract : state.currentContract,
        loading: false,
      }));
      return contract;
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  rejectContract: async (id: string, comment: string) => {
    set({ loading: true });
    try {
      const contract = await contractApi.reject(id, comment);
      set((state) => ({
        contracts: state.contracts.map((c) => (c.id === id ? contract : c)),
        currentContract: state.currentContract?.id === id ? contract : state.currentContract,
        loading: false,
      }));
      return contract;
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  signContract: async (id: string, signatureUrl = '') => {
    set({ loading: true });
    try {
      const contract = await contractApi.sign(id, signatureUrl);
      set((state) => ({
        contracts: state.contracts.map((c) => (c.id === id ? contract : c)),
        currentContract: state.currentContract?.id === id ? contract : state.currentContract,
        loading: false,
      }));
      return contract;
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  archiveContract: async (id: string) => {
    set({ loading: true });
    try {
      const contract = await contractApi.archive(id);
      set((state) => ({
        contracts: state.contracts.map((c) => (c.id === id ? contract : c)),
        loading: false,
      }));
      return contract;
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  setCurrentContract: (contract: Contract | null) => {
    set({ currentContract: contract });
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
