import { api } from './api';
import type { FinanceRecord, DepositRecord, MergeSettleResult } from '../types';
import { generateMockFinanceRecords, generateMockDeposits } from '../utils/mockData';

const USE_MOCK = true;

export const financeApi = {
  getRecords: async (params: Record<string, unknown> = {}) => {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const page = params.page as number || 1;
      const pageSize = params.pageSize as number || 20;
      const all = generateMockFinanceRecords(200);
      let filtered = all;
      if (params.type) {
        filtered = all.filter(r => r.type === params.type);
      }
      if (params.status) {
        filtered = filtered.filter(r => r.status === params.status);
      }
      const start = (page - 1) * pageSize;
      return {
        data: filtered.slice(start, start + pageSize),
        total: filtered.length,
        page,
        pageSize,
      };
    }
    return api.get('/finance/records', { params });
  },

  getDeposits: async (params: Record<string, unknown> = {}) => {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return generateMockDeposits(30);
    }
    return api.get<DepositRecord[]>('/finance/deposits', { params });
  },

  getSummary: async (params: Record<string, unknown> = {}): Promise<{
    totalIncome: number;
    totalExpense: number;
    totalDeposit: number;
    totalRefund: number;
    netProfit: number;
  }> => {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const records = generateMockFinanceRecords(200);
      const income = records.filter(r => r.type === 'income').reduce((sum, r) => sum + r.amount, 0);
      const expense = records.filter(r => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0);
      const deposit = records.filter(r => r.type === 'deposit').reduce((sum, r) => sum + r.amount, 0);
      const refund = records.filter(r => r.type === 'refund').reduce((sum, r) => sum + r.amount, 0);
      return {
        totalIncome: income,
        totalExpense: expense,
        totalDeposit: deposit,
        totalRefund: refund,
        netProfit: income - expense,
      };
    }
    return api.get('/finance/summary', { params });
  },

  createRecord: async (data: Partial<FinanceRecord>) => {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return {
        ...data,
        id: `fin-${Date.now()}`,
        status: data.status || 'pending',
        createdAt: new Date().toISOString(),
      } as FinanceRecord;
    }
    return api.post<FinanceRecord>('/finance/records', data);
  },

  updateRecord: async (id: string, data: Partial<FinanceRecord>) => {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const records = generateMockFinanceRecords(200);
      const record = records.find(r => r.id === id) || records[0];
      return { ...record, ...data };
    }
    return api.put<FinanceRecord>(`/finance/records/${id}`, data);
  },

  deleteRecord: async (id: string) => {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return { success: true };
    }
    return api.delete(`/finance/records/${id}`);
  },

  confirmRecord: async (id: string) => {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const records = generateMockFinanceRecords(200);
      const record = records.find(r => r.id === id) || records[0];
      return { 
        ...record, 
        status: 'confirmed',
        confirmedAt: new Date().toISOString(),
      } as FinanceRecord;
    }
    return api.post<FinanceRecord>(`/finance/records/${id}/confirm`);
  },

  refundDeposit: async (id: string, refundAmount: number, reason: string) => {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const deposits = generateMockDeposits(30);
      const deposit = deposits.find(d => d.id === id) || deposits[0];
      const newRefunded = deposit.refundedAmount + refundAmount;
      return {
        ...deposit,
        refundedAmount: newRefunded,
        refundDate: new Date().toISOString(),
        status: newRefunded >= deposit.refundableAmount ? 'refunded' : 'partial',
      } as DepositRecord;
    }
    return api.post<DepositRecord>(`/finance/deposit/${id}/refund`, { refundAmount, reason });
  },

  mergeSettle: async (scheduleIds: string[], includeDeposit: boolean) => {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const records = generateMockFinanceRecords(200);
      const filtered = records.filter(r => scheduleIds.includes(r.scheduleId));
      const income = filtered.filter(r => r.type === 'income').reduce((sum, r) => sum + r.amount, 0);
      const expense = filtered.filter(r => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0);
      const deposit = includeDeposit 
        ? filtered.filter(r => r.type === 'deposit').reduce((sum, r) => sum + r.amount, 0)
        : 0;
      return {
        totalAmount: income - expense + deposit,
        incomeAmount: income,
        expenseAmount: expense,
        depositAmount: deposit,
        records: filtered,
      } as MergeSettleResult;
    }
    return api.post<MergeSettleResult>('/finance/merge-settle', { scheduleIds, includeDeposit });
  },

  exportRecords: async (params: Record<string, unknown> = {}) => {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const content = '日期,类型,金额,状态,关联展会,备注\n';
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      return blob;
    }
    return api.download('/finance/records/export', { params });
  },
};
