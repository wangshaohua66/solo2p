import { request } from './apiClient'
import type { Booking, BookingStatus, PageResult } from '@/types'

export const bookingApi = {
  getAll: (params: {
    status?: BookingStatus
    page?: number
    size?: number
  }) => {
    return request<PageResult<Booking>>({
      url: '/bookings',
      method: 'GET',
      params,
    })
  },

  getById: (id: string) => {
    return request<Booking>({
      url: `/bookings/${id}`,
      method: 'GET',
    })
  },

  getMy: (params: { page?: number; size?: number }) => {
    return request<PageResult<Booking>>({
      url: '/bookings/my',
      method: 'GET',
      params,
    })
  },

  getByInheritor: (inheritorId: string, params: { page?: number; size?: number }) => {
    return request<PageResult<Booking>>({
      url: `/bookings/inheritor/${inheritorId}`,
      method: 'GET',
      params,
    })
  },

  getCalendar: (inheritorId: string, start: string, end: string) => {
    return request<Booking[]>({
      url: `/bookings/calendar/${inheritorId}`,
      method: 'GET',
      params: { start, end },
    })
  },

  checkConflict: (inheritorId: string, startTime: string, endTime: string) => {
    return request<{ hasConflict: boolean }>({
      url: '/bookings/check-conflict',
      method: 'POST',
      params: { inheritorId, startTime, endTime },
    })
  },

  create: (data: Partial<Booking>) => {
    return request<Booking>({
      url: '/bookings',
      method: 'POST',
      data,
    })
  },

  approve: (id: string, remark?: string) => {
    return request<Booking>({
      url: `/bookings/${id}/approve`,
      method: 'PUT',
      data: remark ? { remark } : {},
    })
  },

  reject: (id: string, remark?: string) => {
    return request<Booking>({
      url: `/bookings/${id}/reject`,
      method: 'PUT',
      data: remark ? { remark } : {},
    })
  },

  cancel: (id: string) => {
    return request<Booking>({
      url: `/bookings/${id}/cancel`,
      method: 'PUT',
    })
  },
}
