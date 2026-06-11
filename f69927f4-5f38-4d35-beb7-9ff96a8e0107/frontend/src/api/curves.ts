import type { FiringCurve, PageResult } from '@/types';
import { mockCurves } from '@/mocks';
import { delay } from '@/api/index';

export async function listCurves(
  params?: Record<string, unknown>,
): Promise<PageResult<FiringCurve>> {
  await delay(300);
  return Promise.resolve({
    content: mockCurves,
    totalElements: mockCurves.length,
    totalPages: 1,
    size: 20,
    number: 0,
  });
}

export async function createCurve(
  data: Partial<FiringCurve>,
): Promise<FiringCurve> {
  await delay(300);
  const newCurve: FiringCurve = {
    id: Date.now(),
    name: data.name ?? '新曲线',
    segments: data.segments ?? [],
    isTemplate: false,
    createdBy: data.createdBy ?? 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return Promise.resolve(newCurve);
}

export async function updateCurve(
  id: number,
  data: Partial<FiringCurve>,
): Promise<FiringCurve> {
  await delay(300);
  const existing = mockCurves.find((c) => c.id === id);
  return Promise.resolve({
    ...(existing ?? mockCurves[0]),
    ...data,
    id,
    updatedAt: new Date().toISOString(),
  } as FiringCurve);
}

export async function deleteCurve(id: number): Promise<void> {
  await delay(300);
  return Promise.resolve();
}

export async function duplicateCurve(
  id: number,
  name: string,
): Promise<FiringCurve> {
  await delay(300);
  const existing = mockCurves.find((c) => c.id === id);
  return Promise.resolve({
    ...(existing ?? mockCurves[0]),
    id: Date.now(),
    name,
    isTemplate: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as FiringCurve);
}

export async function listTemplates(): Promise<FiringCurve[]> {
  await delay(300);
  return Promise.resolve(mockCurves.filter((c) => c.isTemplate));
}
