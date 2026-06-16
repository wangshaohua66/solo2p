import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import dayjs from 'dayjs'
import type {
  Berth, BerthSchedule, PendingApplication, ThroughputStats,
  UtilizationData, ScheduleStatus
} from '@/types'
import { generateAllMockData } from '@/mock/data'
import { useVesselStore } from './vessel'

const mockData = generateAllMockData()

export const useScheduleStore = defineStore('schedule', () => {
  const berths = ref<Berth[]>(mockData.berths)
  const schedules = ref<BerthSchedule[]>(mockData.schedules)
  const pendingApplications = ref<PendingApplication[]>(mockData.pendingApplications)
  const throughputStats = ref<ThroughputStats[]>(mockData.throughputStats)
  const utilizationData = ref<UtilizationData[]>(mockData.utilizationData)
  const selectedDateRange = ref<[Date, Date]>([dayjs().toDate(), dayjs().add(7, 'day').toDate()])

  const berthsByPort = computed(() => {
    const grouped: Record<string, Berth[]> = {}
    const vesselStore = useVesselStore()
    for (const berth of berths.value) {
      if (vesselStore.selectedPortId && berth.portId !== vesselStore.selectedPortId) continue
      if (!grouped[berth.portId]) grouped[berth.portId] = []
      grouped[berth.portId].push(berth)
    }
    return grouped
  })

  const schedulesByBerth = computed(() => {
    const grouped: Record<string, BerthSchedule[]> = {}
    const vesselStore = useVesselStore()
    const [start, end] = selectedDateRange.value
    for (const schedule of schedules.value) {
      if (dayjs(schedule.arrivalTime).isBefore(end) && dayjs(schedule.departureTime).isAfter(start)) {
        if (!grouped[schedule.berthId]) grouped[schedule.berthId] = []
        grouped[schedule.berthId].push(schedule)
      }
    }
    return grouped
  })

  const conflictSchedules = computed(() => {
    return schedules.value.filter(s => s.status === 'conflict')
  })

  const todayThroughput = computed(() => {
    const today = dayjs().format('YYYY-MM-DD')
    return schedules.value
      .filter(s => dayjs(s.arrivalTime).format('YYYY-MM-DD') === today && s.status !== 'conflict')
      .reduce((sum, s) => sum + s.cargoWeight, 0)
  })

  const monthlyThroughput = computed(() => {
    const month = dayjs().format('YYYY-MM')
    return schedules.value
      .filter(s => dayjs(s.arrivalTime).format('YYYY-MM') === month && s.status !== 'conflict')
      .reduce((sum, s) => sum + s.cargoWeight, 0)
  })

  const averageUtilization = computed(() => {
    const vesselStore = useVesselStore()
    const portBerths = berths.value.filter(b => !vesselStore.selectedPortId || b.portId === vesselStore.selectedPortId)
    if (portBerths.length === 0) return 0
    const totalHours = portBerths.length * 24 * 7
    const occupiedHours = utilizationData.value.filter(u =>
      portBerths.some(b => b.id === u.berthId) && u.occupied
    ).length
    return Math.round((occupiedHours / totalHours) * 100)
  })

  const pendingCount = computed(() => pendingApplications.value.length)

  function getBerthById(id: string): Berth | undefined {
    return berths.value.find(b => b.id === id)
  }

  function getScheduleById(id: string): BerthSchedule | undefined {
    return schedules.value.find(s => s.id === id)
  }

  function validateConstraints(schedule: BerthSchedule): string[] {
    const conflicts: string[] = []
    const berth = getBerthById(schedule.berthId)
    const vesselStore = useVesselStore()
    const vessel = vesselStore.getVesselById(schedule.vesselId)

    if (!berth || !vessel) return conflicts

    if (vessel.draft > berth.depth) {
      conflicts.push(`吃水不足：船舶吃水${vessel.draft}m > 泊位水深${berth.depth}m`)
    }

    if (vessel.length > berth.length) {
      conflicts.push(`泊位长度不够：船长${vessel.length}m > 泊位长度${berth.length}m`)
    }

    if (!berth.cargoTypes.includes(vessel.cargoType)) {
      conflicts.push(`货类不兼容：泊位不支持${vessel.cargoType}`)
    }

    const overlapping = schedules.value.filter(s =>
      s.id !== schedule.id &&
      s.berthId === schedule.berthId &&
      dayjs(s.arrivalTime).isBefore(schedule.departureTime) &&
      dayjs(s.departureTime).isAfter(schedule.arrivalTime)
    )
    if (overlapping.length > 0) {
      conflicts.push('时间冲突：与其他作业重叠')
    }

    return conflicts
  }

  function createSchedule(data: Partial<BerthSchedule>): BerthSchedule {
    const newSchedule: BerthSchedule = {
      id: `schedule-${Date.now()}`,
      vesselId: data.vesselId || '',
      berthId: data.berthId || '',
      arrivalTime: data.arrivalTime || new Date(),
      departureTime: data.departureTime || new Date(),
      operationType: data.operationType || 'unload',
      status: 'pending',
      progress: 0,
      cargoWeight: data.cargoWeight || 0,
      cargoType: data.cargoType || 'container'
    }
    const conflicts = validateConstraints(newSchedule)
    newSchedule.conflicts = conflicts.length > 0 ? conflicts : undefined
    newSchedule.status = conflicts.length > 0 ? 'conflict' : 'pending'
    schedules.value.push(newSchedule)
    return newSchedule
  }

  function updateSchedule(id: string, updates: Partial<BerthSchedule>) {
    const index = schedules.value.findIndex(s => s.id === id)
    if (index !== -1) {
      const updated = { ...schedules.value[index], ...updates } as BerthSchedule
      const conflicts = validateConstraints(updated)
      updated.conflicts = conflicts.length > 0 ? conflicts : undefined
      if (conflicts.length > 0 && updated.status !== 'completed') {
        updated.status = 'conflict'
      } else if (updated.status === 'conflict' && conflicts.length === 0) {
        updated.status = 'approved'
      }
      schedules.value[index] = updated
    }
  }

  function deleteSchedule(id: string) {
    const index = schedules.value.findIndex(s => s.id === id)
    if (index !== -1) {
      schedules.value.splice(index, 1)
    }
  }

  function approveSchedule(id: string) {
    const schedule = getScheduleById(id)
    if (schedule) {
      const conflicts = validateConstraints(schedule)
      if (conflicts.length === 0) {
        schedule.status = 'approved'
        schedule.conflicts = undefined
      }
    }
  }

  function rejectSchedule(id: string) {
    const schedule = getScheduleById(id)
    if (schedule) {
      schedule.status = 'rejected'
    }
  }

  function approveApplication(applicationId: string) {
    const app = pendingApplications.value.find(a => a.id === applicationId)
    if (app) {
      const vesselStore = useVesselStore()
      let vessel = vesselStore.vessels.find(v => v.imo === app.imo)
      if (!vessel) {
        vessel = {
          id: `vessel-${Date.now()}`,
          name: app.vesselName,
          imo: app.imo,
          length: app.length,
          draft: app.draft,
          cargoType: app.cargoType,
          cargoWeight: app.cargoWeight,
          status: 'anchorage',
          eta: app.eta
        }
        vesselStore.vessels.push(vessel)
      }

      const berthId = app.recommendedBerthId || berths.value[0].id
      const startTime = app.recommendedTime?.start || app.eta
      const endTime = app.recommendedTime?.end || dayjs(startTime).add(24, 'hour').toDate()

      createSchedule({
        vesselId: vessel.id,
        berthId,
        arrivalTime: startTime,
        departureTime: endTime,
        operationType: app.operationType,
        cargoWeight: app.cargoWeight,
        cargoType: app.cargoType,
        applicant: app.applicant
      })

      const idx = pendingApplications.value.findIndex(a => a.id === applicationId)
      if (idx !== -1) pendingApplications.value.splice(idx, 1)
    }
  }

  function rejectApplication(applicationId: string) {
    const idx = pendingApplications.value.findIndex(a => a.id === applicationId)
    if (idx !== -1) pendingApplications.value.splice(idx, 1)
  }

  function setDateRange(start: Date, end: Date) {
    selectedDateRange.value = [start, end]
  }

  function addApplication(app: Omit<PendingApplication, 'id' | 'submittedAt'>) {
    pendingApplications.value.push({
      ...app,
      id: `app-${Date.now()}`,
      submittedAt: new Date()
    })
  }

  return {
    berths,
    schedules,
    pendingApplications,
    throughputStats,
    utilizationData,
    selectedDateRange,
    berthsByPort,
    schedulesByBerth,
    conflictSchedules,
    todayThroughput,
    monthlyThroughput,
    averageUtilization,
    pendingCount,
    getBerthById,
    getScheduleById,
    validateConstraints,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    approveSchedule,
    rejectSchedule,
    approveApplication,
    rejectApplication,
    setDateRange,
    addApplication
  }
})
