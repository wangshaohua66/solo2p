import http from './http'
import type {
  StudioBooking,
  Station,
  PagedResult,
  PagedQuery
} from '@/types'

export const studioApi = {
  getStations(type?: string): Promise<Station[]> {
    return http.get('/studio/stations', { params: { type } })
  },

  getStation(id: string): Promise<Station> {
    return http.get(`/studio/stations/${id}`)
  },

  createStation(data: Partial<Station>): Promise<Station> {
    return http.post('/studio/stations', data)
  },

  updateStation(id: string, data: Partial<Station>): Promise<Station> {
    return http.put(`/studio/stations/${id}`, data)
  },

  deleteStation(id: string): Promise<void> {
    return http.delete(`/studio/stations/${id}`)
  },

  getBookings(params?: {
    stationId?: string
    memberId?: string
    date?: string
    startDate?: string
    endDate?: string
    status?: string
  } & PagedQuery): Promise<PagedResult<StudioBooking>> {
    return http.get('/studio/bookings', { params })
  },

  getBooking(id: string): Promise<StudioBooking> {
    return http.get(`/studio/bookings/${id}`)
  },

  createBooking(data: { stationId: string; date: string; startTime: string; endTime: string }): Promise<StudioBooking> {
    return http.post('/studio/bookings', data)
  },

  cancelBooking(id: string): Promise<StudioBooking> {
    return http.post(`/studio/bookings/${id}/cancel`)
  },

  checkIn(id: string): Promise<StudioBooking> {
    return http.post(`/studio/bookings/${id}/check-in`)
  },

  checkOut(id: string): Promise<StudioBooking> {
    return http.post(`/studio/bookings/${id}/check-out`)
  },

  getAvailableSlots(stationId: string, date: string): Promise<{ startTime: string; endTime: string; available: boolean }[]> {
    return http.get(`/studio/stations/${stationId}/available-slots`, { params: { date } })
  },

  getWeeklyBookings(weekStart: string, stationId?: string): Promise<StudioBooking[]> {
    return http.get('/studio/bookings/weekly', { params: { weekStart, stationId } })
  },

  getMyBookings(status?: string): Promise<StudioBooking[]> {
    return http.get('/studio/bookings/my', { params: { status } })
  }
}
