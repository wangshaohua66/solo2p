import { create } from 'zustand';
import {
  getWorkOrders as apiGetWorkOrders,
  createWorkOrder as apiCreateWorkOrder,
  updateWorkOrderStatus as apiUpdateWorkOrderStatus,
  updateWorkOrderProgress as apiUpdateWorkOrderProgress,
  submitAcceptance as apiSubmitAcceptance,
  getTeamRecommendations as apiGetTeamRecommendations,
  type CreateWorkOrderParams,
  type SubmitAcceptanceParams,
  type GetWorkOrderListParams
} from '@/services/api';
import type { WorkOrder, TeamRecommendation, NotificationMessage } from '@/types';
import { WorkOrderStatus } from '@/types';
import { notifySocket } from '@/services/websocket';

interface WorkOrderState {
  workOrders: WorkOrder[];
  total: number;
  notifications: NotificationMessage[];
  unreadCount: number;
  teamRecommendations: TeamRecommendation[];
  loading: boolean;
  error: string | null;
  wsConnected: boolean;
  filters: GetWorkOrderListParams;

  fetchWorkOrders: (params?: GetWorkOrderListParams) => Promise<void>;
  createWorkOrder: (params: CreateWorkOrderParams) => Promise<WorkOrder | null>;
  updateStatus: (id: string, status: WorkOrderStatus) => Promise<WorkOrder | null>;
  updateProgress: (id: string, progress: number) => Promise<WorkOrder | null>;
  submitAcceptance: (params: SubmitAcceptanceParams) => Promise<any>;
  fetchTeamRecommendations: (disorderId: string) => Promise<void>;
  markNotificationsRead: () => void;
  connectNotifyWebSocket: () => void;
  disconnectNotifyWebSocket: () => void;
  setFilters: (filters: Partial<GetWorkOrderListParams>) => void;
  clearError: () => void;
}

export const useWorkOrderStore = create<WorkOrderState>((set, get) => ({
  workOrders: [],
  total: 0,
  notifications: [],
  unreadCount: 0,
  teamRecommendations: [],
  loading: false,
  error: null,
  wsConnected: false,
  filters: {
    page: 1,
    pageSize: 50
  },

  fetchWorkOrders: async (params) => {
    set({ loading: true, error: null });
    try {
      const mergedParams = { ...get().filters, ...params };
      const result = await apiGetWorkOrders(mergedParams);
      set({
        workOrders: result.list || [],
        total: result.total || 0,
        loading: false
      });
    } catch (e: any) {
      set({ error: e.message || '获取工单列表失败', loading: false });
    }
  },

  createWorkOrder: async (params) => {
    set({ loading: true, error: null });
    try {
      const wo = await apiCreateWorkOrder(params);
      const state = get();
      set({
        workOrders: [wo, ...state.workOrders],
        total: state.total + 1,
        loading: false
      });
      return wo;
    } catch (e: any) {
      set({ error: e.message || '创建工单失败', loading: false });
      return null;
    }
  },

  updateStatus: async (id, status) => {
    set({ loading: true, error: null });
    try {
      const updated = await apiUpdateWorkOrderStatus(id, status);
      const state = get();
      set({
        workOrders: state.workOrders.map((w) => (w.id === id ? updated : w)),
        loading: false
      });
      return updated;
    } catch (e: any) {
      set({ error: e.message || '更新工单状态失败', loading: false });
      return null;
    }
  },

  updateProgress: async (id, progress) => {
    set({ loading: true, error: null });
    try {
      const updated = await apiUpdateWorkOrderProgress(id, progress);
      const state = get();
      set({
        workOrders: state.workOrders.map((w) => (w.id === id ? updated : w)),
        loading: false
      });
      return updated;
    } catch (e: any) {
      set({ error: e.message || '更新进度失败', loading: false });
      return null;
    }
  },

  submitAcceptance: async (params) => {
    set({ loading: true, error: null });
    try {
      const record = await apiSubmitAcceptance(params);
      set({ loading: false });
      return record;
    } catch (e: any) {
      set({ error: e.message || '提交验收失败', loading: false });
      return null;
    }
  },

  fetchTeamRecommendations: async (disorderId) => {
    set({ loading: true, error: null });
    try {
      const list = await apiGetTeamRecommendations(disorderId);
      set({ teamRecommendations: list, loading: false });
    } catch (e: any) {
      set({ error: e.message || '获取推荐施工队失败', loading: false });
    }
  },

  markNotificationsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0
    }));
  },

  connectNotifyWebSocket: () => {
    notifySocket.connect();
    notifySocket.onConnection((connected) => {
      set({ wsConnected: connected });
    });
    notifySocket.onMessage((message) => {
      set((state) => ({
        notifications: [message, ...state.notifications].slice(0, 50),
        unreadCount: state.unreadCount + 1
      }));
    });
    if (notifySocket.isConnected()) {
      set({ wsConnected: true });
    }
  },

  disconnectNotifyWebSocket: () => {
    notifySocket.disconnect();
    set({ wsConnected: false });
  },

  setFilters: (filters) => {
    set((state) => ({ filters: { ...state.filters, ...filters } }));
  },

  clearError: () => set({ error: null })
}));
