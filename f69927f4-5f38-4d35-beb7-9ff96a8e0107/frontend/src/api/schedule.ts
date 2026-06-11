import api from '@/api/index';
import type { Schedule, PageResult } from '@/types';

export async function listSchedules(
  params?: Record<string, unknown>,
): Promise<PageResult<Schedule>> {
  const { data } = await api.get<PageResult<Schedule>>('/schedules', { params });
  return data;
}

export async function getSchedule(id: number): Promise<Schedule> {
  const { data } = await api.get<Schedule>(`/schedules/${id}`);
  return data;
}

export async function createSchedule(
  data: Partial<Schedule>,
): Promise<Schedule> {
  const resp = await api.post<Schedule>('/schedules', data);
  return resp.data;
}

export async function updateSchedule(
  id: number,
  data: Partial<Schedule>,
): Promise<Schedule> {
  const resp = await api.put<Schedule>(`/schedules/${id}`, data);
  return resp.data;
}

export async function deleteSchedule(id: number): Promise<void> {
  await api.delete(`/schedules/${id}`);
}

export async function overrideSchedule(
  id: number,
  reason: string,
): Promise<Schedule> {
  const resp = await api.post<Schedule>(`/schedules/${id}/override`, { reason });
  return resp.data;
}

export async function checkConflicts(
  kilnId: number,
  startTime: string,
  endTime: string,
): Promise<Schedule[]> {
  const { data } = await api.get<Schedule[]>('/schedules/conflicts', {
    params: { kilnId, startTime, endTime },
  });
  return data;
}
