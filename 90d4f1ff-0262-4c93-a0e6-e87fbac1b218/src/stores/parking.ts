import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { get, post } from '@/utils/http'
import type { ParkingLot, ParkingSpot, ParkingRecord, PagedResult, PagedQuery, ParkingSpotStatus } from '@/types'

export const useParkingStore = defineStore('parking', () => {
  const parkingLots = ref<ParkingLot[]>([])
  const selectedLotId = ref<string>('')
  const selectedFloorId = ref<string>('')
  const currentRecords = ref<PagedResult<ParkingRecord>>({
    items: [],
    totalCount: 0,
    pageIndex: 1,
    pageSize: 20,
    totalPages: 0
  })
  const loading = ref(false)

  const selectedLot = computed(() =>
    parkingLots.value.find(l => l.id === selectedLotId.value) || null
  )

  const selectedFloor = computed(() =>
    selectedLot.value?.floors.find(f => f.id === selectedFloorId.value) || null
  )

  const allSpots = computed(() => {
    const spots: ParkingSpot[] = []
    if (selectedFloor.value) {
      spots.push(...selectedFloor.value.spots)
    } else if (selectedLot.value) {
      selectedLot.value.floors.forEach(f => spots.push(...f.spots))
    } else {
      parkingLots.value.forEach(l =>
        l.floors.forEach(f => spots.push(...f.spots))
      )
    }
    return spots
  })

  const spotsByStatus = computed(() => {
    const result: Record<ParkingSpotStatus, ParkingSpot[]> = {
      Available: [],
      Occupied: [],
      Reserved: [],
      Offline: []
    }
    allSpots.value.forEach(spot => {
      result[spot.status].push(spot)
    })
    return result
  })

  const totalStats = computed(() => {
    let total = 0
    let available = 0
    let occupied = 0
    let reserved = 0
    let offline = 0
    parkingLots.value.forEach(lot => {
      lot.floors.forEach(floor => {
        floor.spots.forEach(spot => {
          total++
          switch (spot.status) {
            case 'Available': available++; break
            case 'Occupied': occupied++; break
            case 'Reserved': reserved++; break
            case 'Offline': offline++; break
          }
        })
      })
    })
    return { total, available, occupied, reserved, offline, occupancyRate: total > 0 ? ((occupied + reserved) / total * 100).toFixed(1) : '0' }
  })

  const fetchParkingLots = async () => {
    loading.value = true
    try {
      const res = await get<ParkingLot[]>('/parking/lots')
      parkingLots.value = res.data
      if (!selectedLotId.value && res.data.length > 0) {
        selectedLotId.value = res.data[0].id
        if (res.data[0].floors.length > 0) {
          selectedFloorId.value = res.data[0].floors[0].id
        }
      }
    } finally {
      loading.value = false
    }
  }

  const fetchLotDetail = async (lotId: string) => {
    const res = await get<ParkingLot>(`/parking/lots/${lotId}`)
    const index = parkingLots.value.findIndex(l => l.id === lotId)
    if (index !== -1) {
      parkingLots.value[index] = res.data
    } else {
      parkingLots.value.push(res.data)
    }
    return res.data
  }

  const selectLot = (lotId: string) => {
    selectedLotId.value = lotId
    const lot = parkingLots.value.find(l => l.id === lotId)
    if (lot?.floors.length) {
      selectedFloorId.value = lot.floors[0].id
    }
  }

  const selectFloor = (floorId: string) => {
    selectedFloorId.value = floorId
  }

  const updateSpot = (spot: ParkingSpot) => {
    for (const lot of parkingLots.value) {
      for (const floor of lot.floors) {
        const idx = floor.spots.findIndex(s => s.id === spot.id)
        if (idx !== -1) {
          floor.spots[idx] = { ...floor.spots[idx], ...spot }
          const availableCount = floor.spots.filter(s => s.status === 'Available').length
          floor.availableSpots = availableCount
          const lotAvailableCount = lot.floors.reduce((sum, f) => sum + f.availableSpots, 0)
          lot.availableSpots = lotAvailableCount
          return
        }
      }
    }
  }

  const updateSpots = (spots: ParkingSpot[]) => {
    spots.forEach(spot => updateSpot(spot))
  }

  const entryParking = async (payload: { spotId: string; plateNumber: string }) => {
    const res = await post<ParkingRecord>('/parking/entry', payload)
    return res.data
  }

  const exitParking = async (payload: { recordId: string; plateNumber: string }) => {
    const res = await post<{ record: ParkingRecord; fee: number }>('/parking/exit', payload)
    return res.data
  }

  const fetchRecords = async (query: PagedQuery & { status?: string }) => {
    loading.value = true
    try {
      const res = await get<PagedResult<ParkingRecord>>('/parking/records', { params: query })
      currentRecords.value = res.data
      return res.data
    } finally {
      loading.value = false
    }
  }

  const getSpotById = (spotId: string): ParkingSpot | undefined => {
    for (const lot of parkingLots.value) {
      for (const floor of lot.floors) {
        const spot = floor.spots.find(s => s.id === spotId)
        if (spot) return spot
      }
    }
    return undefined
  }

  return {
    parkingLots,
    selectedLotId,
    selectedFloorId,
    currentRecords,
    loading,
    selectedLot,
    selectedFloor,
    allSpots,
    spotsByStatus,
    totalStats,
    fetchParkingLots,
    fetchLotDetail,
    selectLot,
    selectFloor,
    updateSpot,
    updateSpots,
    entryParking,
    exitParking,
    fetchRecords,
    getSpotById
  }
})
