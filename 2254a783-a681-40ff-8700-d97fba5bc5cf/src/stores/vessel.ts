import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import dayjs from 'dayjs'
import type { Vessel, TideData, TideStation, User, Port, TideWindow } from '@/types'
import { generateAllMockData } from '@/mock/data'
import { generateTideForecast, findTideWindows } from '@/utils/tide'

const mockData = generateAllMockData()

export const useVesselStore = defineStore('vessel', () => {
  const vessels = ref<Vessel[]>(mockData.vessels)
  const ports = ref<Port[]>(mockData.ports)
  const tideStations = ref<TideStation[]>(mockData.tideStations)
  const currentUser = ref<User>(mockData.currentUser)
  const tideData = ref<TideData[]>([])
  const selectedTideStationId = ref<string>(mockData.tideStations[0].id)
  const selectedPortId = ref<string>(mockData.ports[0].id)

  const activeVessels = computed(() => {
    return vessels.value.filter(v => v.status !== 'departed')
  })

  const vesselsByStatus = computed(() => {
    const grouped: Record<string, Vessel[]> = {}
    for (const v of vessels.value) {
      if (!grouped[v.status]) grouped[v.status] = []
      grouped[v.status].push(v)
    }
    return grouped
  })

  const selectedTideStation = computed(() => {
    return tideStations.value.find(s => s.id === selectedTideStationId.value)
  })

  const tideForecast48h = computed(() => {
    if (!selectedTideStation.value) return []
    if (tideData.value.length === 0) {
      tideData.value = generateTideForecast(selectedTideStation.value, dayjs().toDate(), 48)
    }
    return tideData.value
  })

  const anchorageCount = computed(() => vessels.value.filter(v => v.status === 'anchorage').length)
  const inPortCount = computed(() => vessels.value.filter(v => ['berthed', 'loading', 'unloading'].includes(v.status)).length)
  const inTransitCount = computed(() => vessels.value.filter(v => ['entering', 'leaving'].includes(v.status)).length)

  function updateVesselStatus(vesselId: string, status: Vessel['status']) {
    const vessel = vessels.value.find(v => v.id === vesselId)
    if (vessel) {
      vessel.status = status
    }
  }

  function updateVesselPosition(vesselId: string, position: { x: number; y: number }) {
    const vessel = vessels.value.find(v => v.id === vesselId)
    if (vessel) {
      vessel.position = position
    }
  }

  function setSelectedTideStation(stationId: string) {
    selectedTideStationId.value = stationId
    const station = tideStations.value.find(s => s.id === stationId)
    if (station) {
      tideData.value = generateTideForecast(station, dayjs().toDate(), 48)
    }
  }

  function setSelectedPort(portId: string) {
    selectedPortId.value = portId
  }

  function getVesselById(id: string): Vessel | undefined {
    return vessels.value.find(v => v.id === id)
  }

  function calculateVesselTideWindows(vesselDraft: number, berthDepth: number): TideWindow[] {
    return findTideWindows(tideForecast48h.value, vesselDraft, berthDepth)
  }

  function setCurrentUser(user: User) {
    currentUser.value = user
  }

  return {
    vessels,
    ports,
    tideStations,
    currentUser,
    tideData,
    selectedTideStationId,
    selectedPortId,
    activeVessels,
    vesselsByStatus,
    selectedTideStation,
    tideForecast48h,
    anchorageCount,
    inPortCount,
    inTransitCount,
    updateVesselStatus,
    updateVesselPosition,
    setSelectedTideStation,
    setSelectedPort,
    getVesselById,
    calculateVesselTideWindows,
    setCurrentUser
  }
})
