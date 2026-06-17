import { get, post, del } from '@/utils/request'
import type { ApiResponse, Schedule } from '@/types'

export const scheduleApi = {
  getList: (params?: any) =>
    get<ApiResponse<Schedule[]>>('/api/schedule/', params),
  getWeekMatrix: (hospitalId?: number, startDate?: string, department?: string) =>
    get<ApiResponse<{ dates: any[]; matrix: any[]; daily_summary: any }>>(
      '/api/schedule/week-matrix',
      { hospital_id: hospitalId, start_date: startDate, department }
    ),
  generate: (data?: { hospital_id?: number; start_date?: string }) =>
    post<ApiResponse<{ created: number; existing: number; dates: string[] }>>(
      '/api/schedule/generate', data || {}
    ),
  publish: (data?: { hospital_id?: number; start_date?: string }) =>
    post<ApiResponse<{ message: string }>>('/api/schedule/publish', data || {}),
  createOrUpdate: (data: any) =>
    post<ApiResponse<Schedule>>('/api/schedule/', data),
  swap: (id: number, swapWithId: number) =>
    post<ApiResponse<Schedule>>(`/api/schedule/${id}/swap`, { swap_with_id: swapWithId }),
  deleteSchedule: (id: number) =>
    del<ApiResponse<void>>(`/api/schedule/${id}`),
  getEmergencyOnCall: (hospitalId?: number) =>
    get<ApiResponse<Schedule[]>>('/api/schedule/emergency-on-call', { hospital_id: hospitalId }),
  findNearestEmergency: (lat: number, lng: number, radius = 20) =>
    get<ApiResponse<any[]>>('/api/schedule/nearest-emergency', { lat, lng, radius })
}
