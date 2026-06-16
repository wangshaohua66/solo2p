import request from '@/utils/request';
import { Incident, IncidentReportRequest, PageResult } from '@/types';

export const getIncidentList = (params: any): Promise<PageResult<Incident>> => {
  return request.get('/incident/incidents', { params });
};

export const getIncidentDetail = (id: number): Promise<Incident> => {
  return request.get(`/incident/incidents/${id}`);
};

export const reportIncident = (data: IncidentReportRequest): Promise<Incident> => {
  return request.post('/incident/incidents/report', data);
};

export const updateIncident = (id: number, data: Partial<Incident>): Promise<Incident> => {
  return request.put(`/incident/incidents/${id}`, data);
};

export const updateIncidentStatus = (id: number, status: number, remark?: string): Promise<Incident> => {
  return request.put(`/incident/incidents/${id}/status`, { status, remark });
};

export const upgradeIncidentLevel = (id: number, newLevel: number, reason: string): Promise<Incident> => {
  return request.put(`/incident/incidents/${id}/upgrade`, { newLevel, reason });
};

export const getNearbyIncidents = (lng: number, lat: number, radius: number): Promise<Incident[]> => {
  return request.get('/incident/incidents/nearby', { params: { lng, lat, radius } });
};

export const getIncidentStatistics = (params?: any): Promise<any> => {
  return request.get('/incident/incidents/statistics', { params });
};

export const getIncidentTimeline = (id: number): Promise<any[]> => {
  return request.get(`/incident/incidents/${id}/timeline`);
};
