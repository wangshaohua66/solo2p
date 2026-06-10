import http from './http'
import type {
  Kiln,
  KilnSchedule,
  FiringType,
  ConflictResult,
  PagedResult,
  PagedQuery
} from '@/types'

export const kilnApi = {
  getKilns(): Promise<Kiln[]> {
    return http.get('/kilns')
  },

  getKiln(id: string): Promise<Kiln> {
    return http.get(`/kilns/${id}`)
  },

  createKiln(data: Partial<Kiln>): Promise<Kiln> {
    return http.post('/kilns', data)
  },

  updateKiln(id: string, data: Partial<Kiln>): Promise<Kiln> {
    return http.put(`/kilns/${id}`, data)
  },

  deleteKiln(id: string): Promise<void> {
    return http.delete(`/kilns/${id}`)
  },

  getSchedules(params?: {
    kilnId?: string
    startDate?: string
    endDate?: string
    firingType?: FiringType
    status?: string
  } & PagedQuery): Promise<KilnSchedule[]> {
    return http.get('/kilns/schedules', { params })
  },

  getSchedule(id: string): Promise<KilnSchedule> {
    return http.get(`/kilns/schedules/${id}`)
  },

  createSchedule(data: Partial<KilnSchedule>): Promise<KilnSchedule> {
    return http.post('/kilns/schedules', data)
  },

  updateSchedule(id: string, data: Partial<KilnSchedule>): Promise<KilnSchedule> {
    return http.put(`/kilns/schedules/${id}`, data)
  },

  deleteSchedule(id: string): Promise<void> {
    return http.delete(`/kilns/schedules/${id}`)
  },

  checkConflict(kilnId: string, startTime: string, endTime: string, excludeId?: string): Promise<ConflictResult> {
    return http.get('/kilns/schedules/check-conflict', {
      params: { kilnId, startTime, endTime, excludeId }
    })
  },

  forceOverrideSchedule(id: string): Promise<KilnSchedule> {
    return http.post(`/kilns/schedules/${id}/force-override`)
  },

  startFiring(id: string): Promise<KilnSchedule> {
    return http.post(`/kilns/schedules/${id}/start`)
  },

  completeFiring(id: string): Promise<KilnSchedule> {
    return http.post(`/kilns/schedules/${id}/complete`)
  },

  cancelSchedule(id: string): Promise<KilnSchedule> {
    return http.post(`/kilns/schedules/${id}/cancel`)
  },

  getFiringRecords(kilnId?: string, params?: PagedQuery): Promise<PagedResult<any>> {
    return http.get('/kilns/firing-records', { params: { kilnId, ...params } })
  }
}
