import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface HeatmapCell {
  stopName: string
  hour: number
  value: number
}

export interface CapacityGap {
  lineName: string
  lineId: string
  gapValue: number
  currentCapacity: number
  demand: number
}

export interface HourlyRidership {
  hour: number
  actual: number
  planned: number
}

const stops = ['火车站', '人民广场', '市政府', '科技园', '大学城', '新区枢纽']
const hours = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]

function generateHeatmap(): HeatmapCell[] {
  const cells: HeatmapCell[] = []
  for (const stop of stops) {
    for (const hour of hours) {
      let base = 50
      if (hour >= 7 && hour <= 9) base = 180
      else if (hour >= 17 && hour <= 19) base = 160
      else if (hour >= 11 && hour <= 13) base = 100
      const variation = Math.floor(Math.random() * 60) - 30
      cells.push({ stopName: stop, hour, value: Math.max(10, base + variation) })
    }
  }
  return cells
}

const mockGaps: CapacityGap[] = [
  { lineName: '5路', lineId: '5', gapValue: 35, currentCapacity: 120, demand: 155 },
  { lineName: '1路', lineId: '1', gapValue: 22, currentCapacity: 200, demand: 222 },
  { lineName: '12路', lineId: '12', gapValue: 15, currentCapacity: 80, demand: 95 },
  { lineName: '8路', lineId: '8', gapValue: 8, currentCapacity: 150, demand: 158 },
  { lineName: '3路', lineId: '3', gapValue: 3, currentCapacity: 130, demand: 133 },
]

const mockHourlyData: HourlyRidership[] = [
  { hour: 6, actual: 320, planned: 300 },
  { hour: 7, actual: 850, planned: 800 },
  { hour: 8, actual: 1200, planned: 1000 },
  { hour: 9, actual: 980, planned: 900 },
  { hour: 10, actual: 650, planned: 700 },
  { hour: 11, actual: 720, planned: 750 },
  { hour: 12, actual: 880, planned: 850 },
  { hour: 13, actual: 760, planned: 800 },
  { hour: 14, actual: 680, planned: 700 },
  { hour: 15, actual: 720, planned: 750 },
  { hour: 16, actual: 820, planned: 850 },
  { hour: 17, actual: 1100, planned: 1000 },
  { hour: 18, actual: 1050, planned: 950 },
  { hour: 19, actual: 780, planned: 800 },
  { hour: 20, actual: 520, planned: 600 },
  { hour: 21, actual: 350, planned: 400 },
  { hour: 22, actual: 180, planned: 200 },
]

export const useRidershipStore = defineStore('ridership', () => {
  const heatmapData = ref<HeatmapCell[]>(generateHeatmap())
  const capacityGaps = ref<CapacityGap[]>(mockGaps)
  const hourlyData = ref<HourlyRidership[]>(mockHourlyData)
  const selectedLineId = ref('1')
  const stopsList = ref(stops)
  const hoursList = ref(hours)

  const maxHeatValue = computed(() => Math.max(...heatmapData.value.map(c => c.value)))

  function refreshHeatmap() {
    heatmapData.value = generateHeatmap()
  }

  return {
    heatmapData, capacityGaps, hourlyData, selectedLineId,
    stopsList, hoursList, maxHeatValue, refreshHeatmap,
  }
})
