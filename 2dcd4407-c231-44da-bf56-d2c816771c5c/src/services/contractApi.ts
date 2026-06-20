import { api } from './api';
import type { Contract, ContractTemplate, ContractStatus } from '../types';
import { generateMockContracts, generateMockTemplates } from '../utils/mockData';

const USE_MOCK = true;

export const contractApi = {
  getList: async (params: Record<string, unknown> = {}) => {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const page = params.page as number || 1;
      const pageSize = params.pageSize as number || 20;
      const all = generateMockContracts(50);
      let filtered = all;
      if (params.status) {
        filtered = all.filter(c => c.status === params.status);
      }
      if (params.keyword) {
        const keyword = (params.keyword as string).toLowerCase();
        filtered = filtered.filter(c => 
          c.scheduleName?.toLowerCase().includes(keyword) ||
          c.partyB.toLowerCase().includes(keyword)
        );
      }
      const start = (page - 1) * pageSize;
      return {
        data: filtered.slice(start, start + pageSize),
        total: filtered.length,
        page,
        pageSize,
      };
    }
    return api.get('/contracts', { params });
  },

  getTemplates: async () => {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return generateMockTemplates();
    }
    return api.get<ContractTemplate[]>('/contracts/templates');
  },

  getById: async (id: string) => {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 150));
      const contracts = generateMockContracts(50);
      return contracts.find(c => c.id === id) || contracts[0];
    }
    return api.get<Contract>(`/contracts/${id}`);
  },

  create: async (data: Partial<Contract>) => {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const templates = generateMockTemplates();
      const template = templates.find(t => t.id === data.templateId) || templates[0];
      return {
        ...data,
        id: `ctr-${Date.now()}`,
        status: 'draft' as ContractStatus,
        currentStep: 0,
        depositRate: data.depositRate ?? template.defaultDepositRate,
        depositAmount: data.depositAmount ?? (data.amount ?? 0) * (template.defaultDepositRate / 100),
        approvalFlow: template.defaultDepositRate > 0 ? [
          { id: '1', name: '业务审核', approverId: '', status: 'pending', comment: '', order: 1 },
          { id: '2', name: '财务审核', approverId: '', status: 'pending', comment: '', order: 2 },
          { id: '3', name: '法务审核', approverId: '', status: 'pending', comment: '', order: 3 },
          { id: '4', name: '总经理审批', approverId: '', status: 'pending', comment: '', order: 4 },
        ] : [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Contract;
    }
    return api.post<Contract>('/contracts', data);
  },

  update: async (id: string, data: Partial<Contract>) => {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const contracts = generateMockContracts(50);
      const contract = contracts.find(c => c.id === id) || contracts[0];
      return { ...contract, ...data, updatedAt: new Date().toISOString() };
    }
    return api.put<Contract>(`/contracts/${id}`, data);
  },

  delete: async (id: string) => {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return { success: true };
    }
    return api.delete(`/contracts/${id}`);
  },

  submitApproval: async (id: string) => {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const contracts = generateMockContracts(50);
      const contract = contracts.find(c => c.id === id) || contracts[0];
      return { 
        ...contract, 
        status: 'reviewing' as ContractStatus,
        currentStep: 1,
        updatedAt: new Date().toISOString() 
      };
    }
    return api.post<Contract>(`/contracts/${id}/submit-approval`);
  },

  approveStep: async (id: string, stepId: string, approved: boolean, comment: string) => {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const contracts = generateMockContracts(50);
      const contract = contracts.find(c => c.id === id) || contracts[0];
      const newFlow = contract.approvalFlow.map(step => 
        step.id === stepId 
          ? { ...step, status: approved ? 'approved' : 'rejected', comment, approvedAt: new Date().toISOString() }
          : step
      );
      const currentStep = approved 
        ? contract.currentStep + 1 
        : contract.currentStep;
      const status = !approved 
        ? 'rejected' as ContractStatus
        : currentStep >= newFlow.length 
          ? 'approved' as ContractStatus
          : 'reviewing' as ContractStatus;
      return { 
        ...contract, 
        approvalFlow: newFlow,
        currentStep,
        status,
        updatedAt: new Date().toISOString() 
      };
    }
    return api.post<Contract>(`/contracts/${id}/approve-step`, { stepId, approved, comment });
  },

  sign: async (id: string, signatureUrl: string) => {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const contracts = generateMockContracts(50);
      const contract = contracts.find(c => c.id === id) || contracts[0];
      return { 
        ...contract, 
        signedUrl: signatureUrl,
        status: 'signed' as ContractStatus,
        archiveNo: `AR-${Date.now()}`,
        updatedAt: new Date().toISOString() 
      };
    }
    return api.post<Contract>(`/contracts/${id}/sign`, { signatureUrl });
  },

  archive: async (id: string) => {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const contracts = generateMockContracts(50);
      const contract = contracts.find(c => c.id === id) || contracts[0];
      return { 
        ...contract, 
        status: 'archived' as ContractStatus,
        updatedAt: new Date().toISOString() 
      };
    }
    return api.post<Contract>(`/contracts/${id}/archive`);
  },

  approve: async (id: string, comment = '') => {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const contracts = generateMockContracts(50);
      const contract = contracts.find(c => c.id === id) || contracts[0];
      const newFlow = contract.approvalFlow.map(step => ({
        ...step,
        status: 'approved' as const,
        comment,
        approvedAt: new Date().toISOString(),
      }));
      return { 
        ...contract, 
        approvalFlow: newFlow,
        status: 'approved' as ContractStatus,
        currentStep: newFlow.length,
        updatedAt: new Date().toISOString() 
      };
    }
    return api.post<Contract>(`/contracts/${id}/approve`, { comment });
  },

  reject: async (id: string, comment: string) => {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const contracts = generateMockContracts(50);
      const contract = contracts.find(c => c.id === id) || contracts[0];
      const newFlow = contract.approvalFlow.map(step => 
        step.order === contract.currentStep
          ? { ...step, status: 'rejected' as const, comment, approvedAt: new Date().toISOString() }
          : step
      );
      return { 
        ...contract, 
        approvalFlow: newFlow,
        status: 'rejected' as ContractStatus,
        updatedAt: new Date().toISOString() 
      };
    }
    return api.post<Contract>(`/contracts/${id}/reject`, { comment });
  },
};
