import type { Incident, PageResult, KilnOpenRecord, IncidentType, IncidentSeverity } from '@/types';
import { mockIncidents, mockKilnOpenRecords } from '@/mocks';
import { delay } from '@/api/index';

export async function listIncidents(
  params?: Record<string, unknown>,
): Promise<PageResult<Incident>> {
  await delay(300);
  return Promise.resolve({
    content: mockIncidents,
    totalElements: mockIncidents.length,
    totalPages: 1,
    size: 20,
    number: 0,
  });
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
  await delay(300);
  const newIncident: Incident = {
    id: Date.now(),
    kilnOpenRecordId: data.kilnOpenRecordId ?? null,
    memberId: data.memberId,
    memberName: '',
    type: data.type,
    severity: data.severity,
    description: data.description,
    resolved: false,
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  };
  return Promise.resolve(newIncident);
}

export async function listKilnOpens(
  params?: Record<string, unknown>,
): Promise<PageResult<KilnOpenRecord>> {
  await delay(300);
  return Promise.resolve({
    content: mockKilnOpenRecords,
    totalElements: mockKilnOpenRecords.length,
    totalPages: 1,
    size: 20,
    number: 0,
  });
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
  await delay(300);
  const newRecord: KilnOpenRecord = {
    id: Date.now(),
    kilnId: data.kilnId,
    kilnName: '',
    scheduleId: data.scheduleId,
    operatorId: data.operatorId,
    operatorName: '',
    openTime: new Date().toISOString(),
    temperatureAtOpen: data.temperatureAtOpen,
    isViolation: false,
    note: data.note,
  };
  return Promise.resolve(newRecord);
}
