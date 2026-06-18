import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface SchedulePlan {
  id: string
  lineId: string
  lineName: string
  date: string
  shifts: ShiftItem[]
  status: 'draft' | 'pending' | 'approved' | 'rejected'
}

export interface ShiftItem {
  id: string
  vehiclePlate: string
  driverName: string
  driverId: string
  startTime: number
  endTime: number
  direction: 'up' | 'down'
  lineId: string
  row: number
}

export interface ConstraintConflict {
  id: string
  type: 'overtime' | 'vehicle_overlap' | 'rest_insufficient' | 'qualification'
  description: string
  severity: 'error' | 'warning'
  relatedShiftIds: string[]
}

const mockSchedules: SchedulePlan[] = [
  {
    id: 's1', lineId: '1', lineName: '1路', date: '2026-06-16',
    status: 'pending',
    shifts: [
      { id: 'sh1', vehiclePlate: '京A·12345', driverName: '张伟', driverId: 'd1', startTime: 6, endTime: 10, direction: 'up', lineId: '1', row: 0 },
      { id: 'sh2', vehiclePlate: '京A·12345', driverName: '张伟', driverId: 'd1', startTime: 10.5, endTime: 14, direction: 'down', lineId: '1', row: 0 },
      { id: 'sh3', vehiclePlate: '京A·12346', driverName: '李明', driverId: 'd2', startTime: 6.5, endTime: 11, direction: 'up', lineId: '1', row: 1 },
      { id: 'sh4', vehiclePlate: '京A·12346', driverName: '李明', driverId: 'd2', startTime: 13, endTime: 18, direction: 'down', lineId: '1', row: 1 },
      { id: 'sh5', vehiclePlate: '京A·12347', driverName: '王刚', driverId: 'd3', startTime: 7, endTime: 12, direction: 'up', lineId: '1', row: 2 },
      { id: 'sh6', vehiclePlate: '京A·12347', driverName: '王刚', driverId: 'd3', startTime: 14, endTime: 20, direction: 'down', lineId: '1', row: 2 },
      { id: 'sh7', vehiclePlate: '京A·12348', driverName: '赵磊', driverId: 'd4', startTime: 8, endTime: 13, direction: 'up', lineId: '1', row: 3 },
      { id: 'sh8', vehiclePlate: '京A·12348', driverName: '赵磊', driverId: 'd4', startTime: 15, endTime: 22, direction: 'down', lineId: '1', row: 3 },
    ],
  },
]

const mockConflicts: ConstraintConflict[] = [
  { id: 'c1', type: 'overtime', description: '司机赵磊连续工时超过8小时(7小时)', severity: 'warning', relatedShiftIds: ['sh7', 'sh8'] },
  { id: 'c2', type: 'rest_insufficient', description: '司机李明休息间隔不足1小时(2小时)', severity: 'error', relatedShiftIds: ['sh3', 'sh4'] },
]

export const useScheduleStore = defineStore('schedule', () => {
  const schedules = ref<SchedulePlan[]>(mockSchedules)
  const currentSchedule = ref<SchedulePlan | null>(mockSchedules[0])
  const conflicts = ref<ConstraintConflict[]>(mockConflicts)
  const selectedDate = ref('2026-06-16')
  const selectedLineId = ref('1')

  const errorCount = computed(() => conflicts.value.filter(c => c.severity === 'error').length)
  const warningCount = computed(() => conflicts.value.filter(c => c.severity === 'warning').length)

  function updateShift(shiftId: string, data: Partial<ShiftItem>) {
    if (!currentSchedule.value) return
    const idx = currentSchedule.value.shifts.findIndex(s => s.id === shiftId)
    if (idx !== -1) {
      currentSchedule.value.shifts[idx] = { ...currentSchedule.value.shifts[idx], ...data }
    }
  }

  function generateSchedule() {
    currentSchedule.value = { ...mockSchedules[0], id: `s_${Date.now()}`, status: 'draft' }
    schedules.value.push(currentSchedule.value)
  }

  function approveSchedule() {
    if (currentSchedule.value) {
      currentSchedule.value.status = 'approved'
    }
  }

  function rejectSchedule() {
    if (currentSchedule.value) {
      currentSchedule.value.status = 'rejected'
    }
  }

  return {
    schedules, currentSchedule, conflicts, selectedDate, selectedLineId,
    errorCount, warningCount,
    updateShift, generateSchedule, approveSchedule, rejectSchedule,
  }
})
