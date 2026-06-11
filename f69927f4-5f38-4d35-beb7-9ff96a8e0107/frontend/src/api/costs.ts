import type { CostRecord, MonthlyReportVO } from '@/types';
import { mockCostRecords, mockMonthlyReport } from '@/mocks';
import { delay } from '@/api/index';

export async function getScheduleCost(
  scheduleId: number,
): Promise<CostRecord> {
  await delay(300);
  const existing = mockCostRecords.find((c) => c.scheduleId === scheduleId);
  return Promise.resolve(existing ?? mockCostRecords[0]);
}

export async function getMonthlyReport(
  params?: Record<string, unknown>,
): Promise<MonthlyReportVO> {
  await delay(300);
  return Promise.resolve(mockMonthlyReport);
}

export async function exportMonthlyPdf(
  params?: Record<string, unknown>,
): Promise<Blob> {
  await delay(500);
  return Promise.resolve(new Blob(['mock-pdf-content'], { type: 'application/pdf' }));
}
