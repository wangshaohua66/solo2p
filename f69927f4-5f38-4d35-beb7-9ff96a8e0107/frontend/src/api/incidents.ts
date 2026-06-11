import api from '@/api/index';
import type { Incident, PageResult, KilnOpenRecord, IncidentType, IncidentSeverity } from '@/types';

export async function listIncidents(
  params?: Record<string, unknown>,
): Promise<PageResult<Incident>> {
  const { data } = await api.get<Incident[]>('/incidents', { params });
  const list = data as Incident[];
  return {
    content: list,
    totalElements: list.length,
    totalPages: 1,
    size: list.length,
    number: 0,
  };
}

export async function getIncident(id: number): Promise<Incident> {
  const { data } = await api.get<Incident>(`/incidents/${id}`);
  return data;
}

export async function reportIncident(
  data: {
    kilnOpenRecordId?: number;
    memberId: number;
    type: IncidentType;
    severity: IncidentSeverity;
    description: string;
  },
): Promise<Incident> {
  const resp = await api.post<Incident>('/incidents', data);
  return resp.data;
}

export async function resolveIncident(id: number): Promise<Incident> {
  const resp = await api.post<Incident>(`/incidents/${id}/resolve`);
  return resp.data;
}

export async function deleteIncident(id: number): Promise<void> {
  await api.delete(`/incidents/${id}`);
}

export async function listKilnOpens(
  params?: Record<string, unknown>,
): Promise<PageResult<KilnOpenRecord>> {
  const { data } = await api.get<KilnOpenRecord[]>('/incidents/kiln-opens', { params });
  const list = data as KilnOpenRecord[];
  return {
    content: list,
    totalElements: list.length,
    totalPages: 1,
    size: list.length,
    number: 0,
  };
}

export async function recordKilnOpen(
  data: {
    kilnId: number;
    scheduleId: number;
    operatorId: number;
    temperatureAtOpen: number;
    note?: string;
  },
): Promise<KilnOpenRecord> {
  const resp = await api.post<KilnOpenRecord>('/incidents/kiln-opens', data);
  return resp.data;
}

export async function getKilnOpenRecord(id: number): Promise<KilnOpenRecord> {
  const { data } = await api.get<KilnOpenRecord>(`/incidents/kiln-opens/${id}`);
  return data;
}
