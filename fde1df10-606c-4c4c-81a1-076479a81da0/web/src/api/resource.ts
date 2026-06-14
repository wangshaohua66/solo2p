import request from '@/utils/request'
import type { Venue, Equipment, RehearsalBooking } from '@/types'

export const getVenues = (params?: { type?: string }) => {
  return request.get<any, Venue[]>('/venues', { params })
}

export const getVenue = (id: number) => {
  return request.get<any, Venue>(`/venues/${id}`)
}

export const createVenue = (data: Partial<Venue>) => {
  return request.post<any, Venue>('/venues', data)
}

export const updateVenue = (id: number, data: Partial<Venue>) => {
  return request.put<any, Venue>(`/venues/${id}`, data)
}

export const setVenueMaintenance = (id: number, data: { StartTime: string; EndTime: string }) => {
  return request.put<any, void>(`/venues/${id}/maintenance`, data)
}

export const getEquipments = (params?: { category?: string; status?: string }) => {
  return request.get<any, Equipment[]>('/equipments', { params })
}

export const getEquipment = (id: number) => {
  return request.get<any, Equipment>(`/equipments/${id}`)
}

export const createEquipment = (data: Partial<Equipment>) => {
  return request.post<any, Equipment>('/equipments', data)
}

export const updateEquipment = (id: number, data: Partial<Equipment>) => {
  return request.put<any, Equipment>(`/equipments/${id}`, data)
}

export const setEquipmentMaintenance = (id: number) => {
  return request.put<any, void>(`/equipments/${id}/maintenance`)
}

export const getAvailableEquipments = (params: { start_time: string; end_time: string; category?: string }) => {
  return request.get<any, Equipment[]>('/equipments/available', { params })
}

export const bindEquipmentsToBooking = (bookingId: number, equipmentIds: number[]) => {
  return request.post<any, void>(`/bookings/${bookingId}/equipments`, { equipment_ids: equipmentIds })
}

export const unbindEquipment = (bookingId: number, equipmentId: number) => {
  return request.delete<any, void>(`/bookings/${bookingId}/equipments/${equipmentId}`)
}

export const createRehearsalBooking = (data: Partial<RehearsalBooking>) => {
  return request.post<any, RehearsalBooking>('/rehearsals', data)
}

export const getRehearsalBookings = (params?: { week_start?: string; venue_id?: number }) => {
  return request.get<any, RehearsalBooking[]>('/rehearsals', { params })
}

export const cancelRehearsalBooking = (id: number) => {
  return request.delete<any, void>(`/rehearsals/${id}`)
}
