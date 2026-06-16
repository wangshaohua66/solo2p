import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { get, post, put, del } from '@/utils/http'
import type {
  ChargingStation,
  ChargingReservation,
  ChargingSession,
  PagedResult,
  PagedQuery,
  ChargingStationStatus
} from '@/types'

export const useChargingStore = defineStore('charging', () => {
  const stations = ref<ChargingStation[]>([])
  const reservations = ref<PagedResult<ChargingReservation>>({
    items: [],
    totalCount: 0,
    pageIndex: 1,
    pageSize: 20,
    totalPages: 0
  })
  const sessions = ref<PagedResult<ChargingSession>>({
    items: [],
    totalCount: 0,
    pageIndex: 1,
    pageSize: 20,
    totalPages: 0
  })
  const loading = ref(false)

  const stationsByStatus = computed(() => {
    const result: Record<ChargingStationStatus, ChargingStation[]> = {
      Idle: [],
      Charging: [],
      Reserved: [],
      Faulty: [],
      Offline: []
    }
    stations.value.forEach(s => {
      result[s.status].push(s)
    })
    return result
  })

  const stationStats = computed(() => {
    const total = stations.value.length
    let idle = 0, charging = 0, reserved = 0, faulty = 0, offline = 0
    let totalKwh = 0, totalPower = 0
    stations.value.forEach(s => {
      switch (s.status) {
        case 'Idle': idle++; break
        case 'Charging':
          charging++
          totalPower += s.currentPower || 0
          totalKwh += s.chargedKwh || 0
          break
        case 'Reserved': reserved++; break
        case 'Faulty': faulty++; break
        case 'Offline': offline++; break
      }
    })
    return {
      total,
      idle,
      charging,
      reserved,
      faulty,
      offline,
      utilizationRate: total > 0 ? ((charging + reserved) / total * 100).toFixed(1) : '0',
      totalKwh: totalKwh.toFixed(1),
      totalPower: totalPower.toFixed(1)
    }
  })

  const fetchStations = async (params?: { parkingLotId?: string; status?: ChargingStationStatus }) => {
    loading.value = true
    try {
      const res = await get<ChargingStation[]>('/charging/stations', { params })
      stations.value = res.data
      return res.data
    } finally {
      loading.value = false
    }
  }

  const fetchStationDetail = async (stationId: string) => {
    const res = await get<ChargingStation>(`/charging/stations/${stationId}`)
    const idx = stations.value.findIndex(s => s.id === stationId)
    if (idx !== -1) {
      stations.value[idx] = res.data
    } else {
      stations.value.push(res.data)
    }
    return res.data
  }

  const updateStation = (station: ChargingStation) => {
    const idx = stations.value.findIndex(s => s.id === station.id)
    if (idx !== -1) {
      stations.value[idx] = { ...stations.value[idx], ...station }
    }
  }

  const updateStations = (updatedStations: ChargingStation[]) => {
    updatedStations.forEach(s => updateStation(s))
  }

  const createReservation = async (payload: { stationId: string; startTime: string; endTime: string }) => {
    const res = await post<ChargingReservation>('/charging/reservations', payload)
    return res.data
  }

  const cancelReservation = async (reservationId: string) => {
    await del(`/charging/reservations/${reservationId}`)
    reservations.value.items = reservations.value.items.filter(r => r.id !== reservationId)
    reservations.value.totalCount--
  }

  const removeExpiredReservation = (reservationId: string) => {
    const idx = reservations.value.items.findIndex(r => r.id === reservationId)
    if (idx !== -1) {
      reservations.value.items[idx].status = 'Expired'
    }
  }

  const fetchReservations = async (query: PagedQuery & { status?: string }) => {
    loading.value = true
    try {
      const res = await get<PagedResult<ChargingReservation>>('/charging/reservations', { params: query })
      reservations.value = res.data
      return res.data
    } finally {
      loading.value = false
    }
  }

  const startCharging = async (stationId: string) => {
    const res = await post<ChargingSession>(`/charging/stations/${stationId}/start`)
    return res.data
  }

  const stopCharging = async (sessionId: string) => {
    const res = await put<ChargingSession>(`/charging/sessions/${sessionId}/stop`)
    return res.data
  }

  const fetchSessions = async (query: PagedQuery & { status?: string }) => {
    loading.value = true
    try {
      const res = await get<PagedResult<ChargingSession>>('/charging/sessions', { params: query })
      sessions.value = res.data
      return res.data
    } finally {
      loading.value = false
    }
  }

  const getAvailableSlots = async (stationId: string, date: string) => {
    const res = await get<{ startTime: string; endTime: string; available: boolean }[]>(
      `/charging/stations/${stationId}/available-slots`,
      { params: { date } }
    )
    return res.data
  }

  return {
    stations,
    reservations,
    sessions,
    loading,
    stationsByStatus,
    stationStats,
    fetchStations,
    fetchStationDetail,
    updateStation,
    updateStations,
    createReservation,
    cancelReservation,
    removeExpiredReservation,
    fetchReservations,
    startCharging,
    stopCharging,
    fetchSessions,
    getAvailableSlots
  }
})
