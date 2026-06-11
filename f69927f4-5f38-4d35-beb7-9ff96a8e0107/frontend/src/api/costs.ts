import api from '@/api/index';
import type { CostRecord, MonthlyReportVO } from '@/types';

export async function getScheduleCost(
  scheduleId: number,
): Promise<CostRecord> {
  const { data } = await api.get<CostRecord>(`/costs/schedule/${scheduleId}`);
  return data;
}

export async function calculateScheduleCost(
  scheduleId: number,
): Promise<CostRecord> {
  const { data } = await api.post<CostRecord>(`/costs/schedule/${scheduleId}/calculate`);
  return data;
}

export async function getMonthlyReport(
  params: { year: number; month: number },
): Promise<MonthlyReportVO> {
  const { data } = await api.get<MonthlyReportVO>('/costs/monthly', { params });
  return data as MonthlyReportVO;
}

export async function exportMonthlyReport(
  params: { year: number; month: number },
): Promise<Blob> {
  const { data } = await api.get('/costs/monthly/export', {
    params,
    responseType: 'blob',
  });
  return data as Blob;
}

export async function exportMonthlyPdf(
  params: { year: number; month: number },
): Promise<Blob> {
  return exportMonthlyReport(params);
}
