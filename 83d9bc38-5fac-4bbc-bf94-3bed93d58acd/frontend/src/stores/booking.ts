import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'
import type { Equipment } from './equipment'
import type { UserInfo } from './user'

export interface Booking {
  id: number
  equipmentId: number
  userId: number
  startTime: string
  endTime: string
  status: string
  isSeries: boolean
  seriesId?: string
  createdAt: string
  updatedAt: string
  equipment?: Equipment
  user?: UserInfo
}

export interface ConflictInfo {
  hasConflict: boolean
  conflictingBookings: Booking[]
}

export interface CreateBookingRequest {
  equipmentId: number
  startTime: string
  endTime: string
}

export interface CreateSeriesBookingRequest {
  equipmentId: number
  startTime: string
  endTime: string
  seriesWeeks: number
}

export interface AddWaitlistRequest {
  equipmentId: number
  startTime: string
  endTime: string
}

export const useBookingStore = defineStore('booking', () => {
  const bookingList = ref<Booking[]>([])
  const selectedEquipment = ref<Equipment | null>(null)
  const selectedDate = ref<string>('')
  const conflictInfo = ref<ConflictInfo | null>(null)
  const loading = ref<boolean>(false)

  const bookingsByDate = computed(() => (date: string) => {
    return bookingList.value.filter(booking => {
      const bookingDate = booking.startTime.split('T')[0]
      return bookingDate === date
    })
  })

  const conflictsForDate = computed(() => (date: string, equipmentId?: number) => {
    return bookingList.value.filter(booking => {
      const bookingDate = booking.startTime.split('T')[0]
      const dateMatch = bookingDate === date
      const equipmentMatch = equipmentId ? booking.equipmentId === equipmentId : true
      const statusMatch = booking.status !== 'cancelled'
      return dateMatch && equipmentMatch && statusMatch
    })
  })

  const fetchBookings = async (params?: {
    equipmentId?: number
    userId?: number
    startDate?: string
    endDate?: string
    status?: string
  }) => {
    loading.value = true
    try {
      const response = await axios.get<Booking[]>('/api/bookings', { params })
      bookingList.value = response.data
      return response.data
    } finally {
      loading.value = false
    }
  }

  const createBooking = async (data: CreateBookingRequest) => {
    loading.value = true
    try {
      const response = await axios.post<Booking>('/api/bookings', data)
      bookingList.value.push(response.data)
      return response.data
    } finally {
      loading.value = false
    }
  }

  const createSeriesBooking = async (data: CreateSeriesBookingRequest) => {
    loading.value = true
    try {
      const response = await axios.post<Booking[]>('/api/bookings/series', data)
      bookingList.value.push(...response.data)
      return response.data
    } finally {
      loading.value = false
    }
  }

  const cancelBooking = async (id: number, reason?: string) => {
    loading.value = true
    try {
      const response = await axios.post<Booking>(`/api/bookings/${id}/cancel`, { reason })
      const index = bookingList.value.findIndex(b => b.id === id)
      if (index !== -1) {
        bookingList.value[index] = response.data
      }
      return response.data
    } finally {
      loading.value = false
    }
  }

  const checkConflict = async (equipmentId: number, startTime: string, endTime: string) => {
    loading.value = true
    try {
      const response = await axios.get<ConflictInfo>('/api/bookings/conflict', {
        params: { equipmentId, startTime, endTime }
      })
      conflictInfo.value = response.data
      return response.data
    } finally {
      loading.value = false
    }
  }

  const addWaitlist = async (data: AddWaitlistRequest) => {
    loading.value = true
    try {
      const response = await axios.post('/api/waitlist', data)
      return response.data
    } finally {
      loading.value = false
    }
  }

  return {
    bookingList,
    selectedEquipment,
    selectedDate,
    conflictInfo,
    loading,
    bookingsByDate,
    conflictsForDate,
    fetchBookings,
    createBooking,
    createSeriesBooking,
    cancelBooking,
    checkConflict,
    addWaitlist
  }
})
