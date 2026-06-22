import apiClient from './apiClient';
import type { TicketType, RevenueData, SalesAlert, DashboardStats } from '@/types';

export interface TicketSalesResponse {
  ticketId: string;
  ticketName: string;
  soldCount: number;
  totalCount: number;
  revenue: number;
  sellThroughRate: number;
}

export interface RevenueReportParams {
  startDate?: string;
  endDate?: string;
  venueId?: string;
  eventType?: string;
  format?: 'pdf' | 'excel' | 'csv';
}

export const ticketApi = {
  getTicketTypes: (eventId?: string): Promise<TicketType[]> => {
    const params = eventId ? { eventId } : {};
    return apiClient.get('/tickets/types', { params }).then(res => res.data);
  },

  getRevenueData: (params?: { venueId?: string; startDate?: string; endDate?: string; period?: string }): Promise<RevenueData[]> => {
    return apiClient.get('/tickets/revenue', { params }).then(res => res.data);
  },

  getSalesAlerts: (includeResolved?: boolean): Promise<SalesAlert[]> => {
    const params = includeResolved ? { includeResolved: true } : {};
    return apiClient.get('/tickets/alerts', { params }).then(res => res.data);
  },

  resolveSalesAlert: (alertId: string): Promise<SalesAlert> => {
    return apiClient.post(`/tickets/alerts/${alertId}/resolve`).then(res => res.data);
  },

  getTicketSales: (eventId: string): Promise<TicketSalesResponse[]> => {
    return apiClient.get(`/tickets/events/${eventId}/sales`).then(res => res.data);
  },

  getDashboardStats: (period?: string): Promise<DashboardStats> => {
    const params = period ? { period } : {};
    return apiClient.get('/tickets/dashboard-stats', { params }).then(res => res.data);
  },

  exportRevenueReport: async (
    params: RevenueReportParams,
    onProgress?: (progress: number) => void
  ): Promise<Blob> => {
    const totalSteps = 5;
    let currentStep = 0;

    const updateProgress = () => {
      currentStep++;
      onProgress?.(Math.round((currentStep / totalSteps) * 100));
    };

    updateProgress();

    await new Promise(resolve => setTimeout(resolve, 300));
    updateProgress();

    await new Promise(resolve => setTimeout(resolve, 400));
    updateProgress();

    await new Promise(resolve => setTimeout(resolve, 300));
    updateProgress();

    const response = await apiClient.get('/tickets/export/revenue', {
      params,
      responseType: 'blob',
    });

    updateProgress();

    return response.data;
  },

  downloadTicket: (ticketId: string): Promise<Blob> => {
    return apiClient.get(`/tickets/${ticketId}/download`, {
      responseType: 'blob',
    }).then(res => res.data);
  },
};
