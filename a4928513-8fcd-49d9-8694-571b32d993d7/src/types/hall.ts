import type { ServiceItem } from './billing'

export interface FarewellHall {
  id: string
  name: string
  funeralHomeId: string
  funeralHomeName: string
  capacity: number
  facilities: string[]
  basePrice: number
  status: 'available' | 'maintenance' | 'closed'
  area?: number
  description?: string
  imageUrl?: string
}

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'

export interface Booking {
  id: string
  hallId: string
  hallName: string
  funeralHomeId: string
  remainsId: string
  remainsName: string
  date: string
  startTime: string
  endTime: string
  duration: number
  ritualistId?: string
  ritualistName?: string
  services: ServiceItem[]
  totalFee: number
  status: BookingStatus
  createTime: string
  confirmTime?: string
  cancelReason?: string
  remark?: string
  conflict?: boolean
}

export interface BookingCreateForm {
  hallId: string
  remainsId: string
  date: string
  startTime: string
  duration: number
  ritualistId?: string
  serviceIds: string[]
  remark?: string
}

export interface TimeSlot {
  start: string
  end: string
  available: boolean
  bookingId?: string
}

export interface HallDaySchedule {
  hallId: string
  hallName: string
  date: string
  bookings: Booking[]
  slots: TimeSlot[]
}
