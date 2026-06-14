import request from '@/utils/request'
import type { Booking, ConflictInfo, StatsData } from '@/types'

export const createBooking = (data: Partial<Booking>) => {
  return request.post<any, Booking | ConflictInfo>('/bookings', data)
}

export const getBookings = (params?: {
  venue_id?: number
  start_date?: string
  end_date?: string
  status?: string
}) => {
  return request.get<any, Booking[]>('/bookings', { params })
}

export const getBooking = (id: number) => {
  return request.get<any, Booking>(`/bookings/${id}`)
}

export const updateBooking = (id: number, data: Partial<Booking>) => {
  return request.put<any, Booking>(`/bookings/${id}`, data)
}

export const deleteBooking = (id: number) => {
  return request.delete<any, void>(`/bookings/${id}`)
}

export const approveBooking = (id: number, data: { action: 'approve' | 'reject' }) => {
  return request.put<any, Booking>(`/bookings/${id}/approve`, data)
}

export const getBookingStats = () => {
  return request.get<any, StatsData>('/bookings/stats')
}
