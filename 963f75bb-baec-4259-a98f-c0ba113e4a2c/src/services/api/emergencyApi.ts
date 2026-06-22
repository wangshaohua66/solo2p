import apiClient from './apiClient';
import type { EmergencyPlan, EmergencyLog } from '@/types';

export interface TriggerEmergencyRequest {
  planId: string;
  triggeredBy: string;
  notes?: string;
}

export interface CompleteStepRequest {
  logId: string;
  stepId: string;
  completedBy: string;
  notes?: string;
}

export interface ResolveEmergencyRequest {
  logId: string;
  resolvedBy: string;
  resolutionNotes?: string;
}

export interface EmergencyReportResponse {
  reportUrl: string;
  reportName: string;
  generatedAt: Date;
  fileSize: number;
}

export interface ExportLogsParams {
  startDate?: string;
  endDate?: string;
  type?: string;
  status?: string;
  format?: 'pdf' | 'excel' | 'csv';
}

export const emergencyApi = {
  getPlans: (): Promise<EmergencyPlan[]> => {
    return apiClient.get('/emergency/plans').then(res => res.data);
  },

  getPlanById: (id: string): Promise<EmergencyPlan> => {
    return apiClient.get(`/emergency/plans/${id}`).then(res => res.data);
  },

  getLogs: (params?: { venueId?: string; startDate?: string; endDate?: string; status?: string; type?: string }): Promise<EmergencyLog[]> => {
    return apiClient.get('/emergency/logs', { params }).then(res => res.data);
  },

  getLogById: (id: string): Promise<EmergencyLog> => {
    return apiClient.get(`/emergency/logs/${id}`).then(res => res.data);
  },

  getActiveLog: (): Promise<EmergencyLog | null> => {
    return apiClient.get('/emergency/logs/active').then(res => res.data);
  },

  triggerEmergency: (data: TriggerEmergencyRequest): Promise<EmergencyLog> => {
    return apiClient.post('/emergency/trigger', data).then(res => res.data);
  },

  completeStep: (data: CompleteStepRequest): Promise<EmergencyLog> => {
    return apiClient.post('/emergency/complete-step', data).then(res => res.data);
  },

  resolveEmergency: async (
    data: ResolveEmergencyRequest,
    onProgress?: (progress: number) => void
  ): Promise<EmergencyReportResponse> => {
    const totalSteps = 6;
    let currentStep = 0;

    const updateProgress = () => {
      currentStep++;
      onProgress?.(Math.round((currentStep / totalSteps) * 100));
    };

    updateProgress();

    await apiClient.post('/emergency/resolve', data);
    updateProgress();

    await new Promise(resolve => setTimeout(resolve, 400));
    updateProgress();

    await new Promise(resolve => setTimeout(resolve, 300));
    updateProgress();

    await new Promise(resolve => setTimeout(resolve, 300));
    updateProgress();

    const reportResponse = await apiClient.get(`/emergency/logs/${data.logId}/report`);
    updateProgress();

    return reportResponse.data;
  },

  generateReport: (logId: string): Promise<EmergencyReportResponse> => {
    return apiClient.post(`/emergency/logs/${logId}/generate-report`).then(res => res.data);
  },

  exportLogs: (params: ExportLogsParams): Promise<Blob> => {
    return apiClient.get('/emergency/logs/export', {
      params,
      responseType: 'blob',
    }).then(res => res.data);
  },

  downloadReport: (logId: string): Promise<Blob> => {
    return apiClient.get(`/emergency/logs/${logId}/download`, {
      responseType: 'blob',
    }).then(res => res.data);
  },
};
