import { get } from '@/utils/request'
import type { ApiResponse, UserInfo, BoardSummary, DailyTrendPoint } from '@/types'

export const reportApi = {
  getBoardSummary: (hospitalId?: number, startDate?: string, endDate?: string) =>
    get<ApiResponse<BoardSummary>>('/api/report/board/summary', {
      hospital_id: hospitalId, start_date: startDate, end_date: endDate
    }),
  getDailyTrend: (hospitalId?: number, days = 30) =>
    get<ApiResponse<DailyTrendPoint[]>>('/api/report/board/trend', {
      hospital_id: hospitalId, days
    }),
  getHospitalComparison: (startDate?: string, endDate?: string) =>
    get<ApiResponse<any[]>>('/api/report/hospital-comparison', { start_date: startDate, end_date: endDate }),
  getDeptBreakdown: (hospitalId?: number, startDate?: string, endDate?: string) =>
    get<ApiResponse<any[]>>('/api/report/department-breakdown', {
      hospital_id: hospitalId, start_date: startDate, end_date: endDate
    }),
  getDoctorRanking: (hospitalId?: number, startDate?: string, endDate?: string, limit = 10) =>
    get<ApiResponse<any[]>>('/api/report/doctor-ranking', {
      hospital_id: hospitalId, start_date: startDate, end_date: endDate, limit
    }),
  getMedicineConsumption: (hospitalId?: number, startDate?: string, endDate?: string, limit = 20) =>
    get<ApiResponse<any[]>>('/api/report/medicine-consumption', {
      hospital_id: hospitalId, start_date: startDate, end_date: endDate, limit
    }),
  getMonthlyComparison: (hospitalId?: number, year?: number) =>
    get<ApiResponse<any[]>>('/api/report/monthly-comparison', {
      hospital_id: hospitalId, year
    }),
  getQualityMetrics: (hospitalId?: number, startDate?: string, endDate?: string) =>
    get<ApiResponse<any>>('/api/report/quality-metrics', {
      hospital_id: hospitalId, start_date: startDate, end_date: endDate
    }),
  getUsers: (params?: { role?: string; hospital_id?: number; is_active?: boolean; keyword?: string }) =>
    get<ApiResponse<UserInfo[]>>('/api/report/users', params)
}
