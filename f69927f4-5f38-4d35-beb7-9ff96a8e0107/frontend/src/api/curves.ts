import api from '@/api/index';
import type { FiringCurve, PageResult } from '@/types';

export async function listCurves(
  params?: Record<string, unknown>,
): Promise<PageResult<FiringCurve>> {
  const { data } = await api.get<PageResult<FiringCurve>>('/curves', { params });
  return data;
}

export async function getCurve(id: number): Promise<FiringCurve> {
  const { data } = await api.get<FiringCurve>(`/curves/${id}`);
  return data;
}

export async function createCurve(
  data: Partial<FiringCurve>,
): Promise<FiringCurve> {
  const resp = await api.post<FiringCurve>('/curves', data);
  return resp.data;
}

export async function updateCurve(
  id: number,
  data: Partial<FiringCurve>,
): Promise<FiringCurve> {
  const resp = await api.put<FiringCurve>(`/curves/${id}`, data);
  return resp.data;
}

export async function deleteCurve(id: number): Promise<void> {
  await api.delete(`/curves/${id}`);
}

export async function duplicateCurve(
  id: number,
  name?: string,
): Promise<FiringCurve> {
  const resp = await api.post<FiringCurve>(`/curves/${id}/duplicate`, null, {
    params: name ? { name } : undefined,
  });
  return resp.data;
}

export async function listTemplates(): Promise<FiringCurve[]> {
  const { data } = await api.get<FiringCurve[]>('/curves/templates');
  return data;
}
