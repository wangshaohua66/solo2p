import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { booking as bookingApi } from '@/api'
import type { Equipment } from './equipment'
import type { UserInfo } from './user'

export interface Booking {
  id: number
  equipmentId: number
  equipmentName?: string
  userId: number
  userName?: string
  startTime: string
  endTime: string
  status: string
  isSeries: boolean
  seriesId?: string
  waitlistPosition?: number
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
      const result = await bookingApi.getList({
        equipmentId: params?.equipmentId,
        userId: params?.userId,
        startTime: params?.startDate,
        endTime: params?.endDate,
        status: params?.status
      })
      bookingList.value = result.items as Booking[]
      return result.items
    } finally {
      loading.value = false
    }
  }

  const createBooking = async (data: CreateBookingRequest) => {
    loading.value = true
    try {
      const result = await bookingApi.create(data)
      bookingList.value.push(result as Booking)
      return result
    } finally {
      loading.value = false
    }
  }

  const createSeriesBooking = async (data: CreateSeriesBookingRequest) => {
    loading.value = true
    try {
      const result = await bookingApi.createSeries(data)
      bookingList.value.push(...(result as Booking[]))
      return result
    } finally {
      loading.value = false
    }
  }

  const cancelBooking = async (id: number, reason?: string) => {
    loading.value = true
    try {
      const result = await bookingApi.cancel(id, reason)
      const index = bookingList.value.findIndex(b => b.id === id)
      if (index !== -1) {
        bookingList.value[index].status = 'cancelled'
      }
      return result
    } finally {
      loading.value = false
    }
  }

  const checkConflict = async (equipmentId: number, startTime: string, endTime: string) => {
    loading.value = true
    try {
      const result = await bookingApi.checkConflict({ equipmentId, startTime, endTime })
      conflictInfo.value = result as unknown as ConflictInfo
      return result
    } finally {
      loading.value = false
    }
  }

  const addWaitlist = async (data: AddWaitlistRequest) => {
    loading.value = true
    try {
      const result = await bookingApi.addWaitlist(data)
      return result
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
