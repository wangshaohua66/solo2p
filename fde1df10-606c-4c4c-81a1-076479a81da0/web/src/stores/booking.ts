import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import dayjs from 'dayjs'
import type { Booking, Venue, StatsData } from '@/types'
import {
  getBookings,
  createBooking as apiCreateBooking,
  updateBooking as apiUpdateBooking,
  deleteBooking as apiDeleteBooking,
  approveBooking as apiApproveBooking,
  getBookingStats
} from '@/api/booking'
import { getVenues } from '@/api/resource'

export const useBookingStore = defineStore('booking', () => {
  const bookings = ref<Booking[]>([])
  const venues = ref<Venue[]>([])
  const selectedVenueIds = ref<number[]>([])
  const currentMonth = ref(dayjs())
  const stats = ref<StatsData | null>(null)
  const loading = ref(false)

  const performanceVenues = computed(() =>
    venues.value.filter(v => v.Type !== 'rehearsal_room')
  )

  const rehearsalVenues = computed(() =>
    venues.value.filter(v => v.Type === 'rehearsal_room')
  )

  const filteredBookings = computed(() => {
    let result = bookings.value
    if (selectedVenueIds.value.length > 0) {
      result = result.filter(b => selectedVenueIds.value.includes(b.VenueID))
    }
    return result
  })

  const fetchVenues = async () => {
    venues.value = await getVenues()
    if (selectedVenueIds.value.length === 0) {
      selectedVenueIds.value = performanceVenues.value.map(v => v.ID)
    }
  }

  const fetchBookings = async (params?: { start_date?: string; end_date?: string }) => {
    loading.value = true
    try {
      const start = params?.start_date || currentMonth.value.startOf('month').format('YYYY-MM-DD')
      const end = params?.end_date || currentMonth.value.endOf('month').format('YYYY-MM-DD')
      bookings.value = await getBookings({ start_date: start, end_date: end, ...params })
    } finally {
      loading.value = false
    }
  }

  const fetchStats = async () => {
    stats.value = await getBookingStats()
  }

  const createBooking = async (data: Partial<Booking>) => {
    return await apiCreateBooking(data)
  }

  const updateBooking = async (id: number, data: Partial<Booking>) => {
    const result = await apiUpdateBooking(id, data)
    const idx = bookings.value.findIndex(b => b.ID === id)
    if (idx !== -1) {
      bookings.value[idx] = { ...bookings.value[idx], ...result }
    }
    return result
  }

  const deleteBooking = async (id: number) => {
    await apiDeleteBooking(id)
    bookings.value = bookings.value.filter(b => b.ID !== id)
  }

  const approveBooking = async (id: number, action: 'approve' | 'reject') => {
    const result = await apiApproveBooking(id, { action })
    const idx = bookings.value.findIndex(b => b.ID === id)
    if (idx !== -1) {
      bookings.value[idx] = { ...bookings.value[idx], ...result }
    }
    return result
  }

  const setMonth = (month: dayjs.Dayjs) => {
    currentMonth.value = month
    fetchBookings()
  }

  const toggleVenue = (venueId: number) => {
    const idx = selectedVenueIds.value.indexOf(venueId)
    if (idx === -1) {
      selectedVenueIds.value.push(venueId)
    } else {
      selectedVenueIds.value.splice(idx, 1)
    }
  }

  const getBookingsByVenue = (venueId: number) => {
    return filteredBookings.value.filter(b => b.VenueID === venueId)
  }

  return {
    bookings,
    venues,
    selectedVenueIds,
    currentMonth,
    stats,
    loading,
    performanceVenues,
    rehearsalVenues,
    filteredBookings,
    fetchVenues,
    fetchBookings,
    fetchStats,
    createBooking,
    updateBooking,
    deleteBooking,
    approveBooking,
    setMonth,
    toggleVenue,
    getBookingsByVenue
  }
})
