import { get, post, put } from '@/utils/request'
import type { ApiResponse, PaginatedResponse, Cage, Hospitalization } from '@/types'

export const hospitalizationApi = {
  getCageGrid: (hospitalId?: number) =>
    get<ApiResponse<{ zones: any[]; summary: any }>>(
      '/api/hospitalization/cages/grid',
      hospitalId ? { hospital_id: hospitalId } : {}
    ),
  getCages: (hospitalId?: number, withPatient = true) =>
    get<ApiResponse<Cage[]>>(
      '/api/hospitalization/cages',
      { hospital_id: hospitalId, with_patient: withPatient }
    ),
  createCage: (data: any) => post<ApiResponse<Cage>>('/api/hospitalization/cages', data),
  updateCageStatus: (cageId: number, status: string, remark?: string) =>
    put<ApiResponse<Cage>>(`/api/hospitalization/cages/${cageId}/status`, { status, remark }),
  checkConflict: (cageId: number, startDate: string, endDate: string, excludeId?: number) =>
    get<ApiResponse<{ has_conflict: boolean; conflict_with: Hospitalization | null }>>(
      `/api/hospitalization/cages/${cageId}/check-conflict`,
      { start_date: startDate, end_date: endDate, exclude_id: excludeId }
    ),
  getList: (params?: { hospital_id?: number; status?: string; page?: number; per_page?: number }) =>
    get<ApiResponse<PaginatedResponse<Hospitalization>>>('/api/hospitalization/hospitalizations', params),
  create: (data: any) =>
    post<ApiResponse<Hospitalization>>('/api/hospitalization/hospitalizations', data),
  emergencyAdmission: (data: { hospital_id?: number; pet_id: number; medical_record_id?: number }) =>
    post<ApiResponse<Hospitalization>>('/api/hospitalization/hospitalizations/emergency', data),
  update: (id: number, data: any) =>
    put<ApiResponse<Hospitalization>>(`/api/hospitalization/hospitalizations/${id}`, data),
  upcomingDischarges: (hospitalId?: number, days = 3) =>
    get<ApiResponse<Hospitalization[]>>(
      '/api/hospitalization/hospitalizations/upcoming-discharges',
      { hospital_id: hospitalId, days }
    )
}
