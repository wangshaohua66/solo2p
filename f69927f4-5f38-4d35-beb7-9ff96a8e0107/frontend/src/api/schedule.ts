import type { Schedule, PageResult } from '@/types';
import { mockSchedules } from '@/mocks';
import { delay } from '@/api/index';

export async function listSchedules(
  params?: Record<string, unknown>,
): Promise<PageResult<Schedule>> {
  await delay(300);
  return Promise.resolve({
    content: mockSchedules,
    totalElements: mockSchedules.length,
    totalPages: 1,
    size: 20,
    number: 0,
  });
}

export async function createSchedule(
  data: Partial<Schedule>,
): Promise<Schedule> {
  await delay(300);
  const newSchedule: Schedule = {
    id: Date.now(),
    kilnId: data.kilnId ?? 0,
    kilnName: data.kilnName ?? '',
    memberId: data.memberId ?? 0,
    memberName: data.memberName ?? '',
    curveId: data.curveId ?? 0,
    curveName: data.curveName ?? '',
    startTime: data.startTime ?? new Date().toISOString(),
    endTime: data.endTime ?? new Date().toISOString(),
    status: 'PENDING',
    workpieceCount: data.workpieceCount ?? 1,
    note: data.note,
    createdAt: new Date().toISOString(),
  };
  return Promise.resolve(newSchedule);
}

export async function updateSchedule(
  id: number,
  data: Partial<Schedule>,
): Promise<Schedule> {
  await delay(300);
  const existing = mockSchedules.find((s) => s.id === id);
  return Promise.resolve({
    ...(existing ?? mockSchedules[0]),
    ...data,
    id,
  } as Schedule);
}

export async function deleteSchedule(id: number): Promise<void> {
  await delay(300);
  return Promise.resolve();
}

export async function overrideSchedule(
  id: number,
  reason: string,
): Promise<Schedule> {
  await delay(300);
  const existing = mockSchedules.find((s) => s.id === id);
  return Promise.resolve({
    ...(existing ?? mockSchedules[0]),
    id,
    status: 'CANCELLED',
    note: reason,
  } as Schedule);
}
