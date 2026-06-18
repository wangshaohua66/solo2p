<script setup lang="ts">
import { ref, computed } from 'vue'

interface DriverInfo {
  id: string
  name: string
  shiftType: 'morning' | 'afternoon' | 'night' | 'off' | 'leave'
}

interface SwapSuggestion {
  driverA: string
  driverAName: string
  driverB: string
  driverBName: string
  reason: string
}

const currentMonth = ref(new Date())
const selectedDate = ref('')

const drivers = ['张伟', '李明', '王刚', '赵磊', '刘洋', '陈静', '周涛', '吴芳']
const shiftColors: Record<string, string> = {
  morning: '#4A90D9',
  afternoon: '#22C55E',
  night: '#8B5CF6',
  off: '#E5E7EB',
  leave: '#F59E0B',
}
const shiftLabels: Record<string, string> = {
  morning: '早班',
  afternoon: '中班',
  night: '晚班',
  off: '休息',
  leave: '请假',
}

const shiftTypes: DriverInfo['shiftType'][] = ['morning', 'afternoon', 'night', 'off', 'leave']

function generateMonthSchedule(year: number, month: number): Map<string, DriverInfo[]> {
  const map = new Map<string, DriverInfo[]>()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dayOfWeek = new Date(year, month, d).getDay()
    const list: DriverInfo[] = drivers.map((name, i) => {
      const seed = (d * 7 + i * 3 + dayOfWeek) % 5
      const type = shiftTypes[seed] as DriverInfo['shiftType']
      return { id: `d${i + 1}`, name, shiftType: type }
    })
    map.set(key, list)
  }
  return map
}

const scheduleMap = computed(() => {
  const y = currentMonth.value.getFullYear()
  const m = currentMonth.value.getMonth()
  return generateMonthSchedule(y, m)
})

const calendarDays = computed(() => {
  const y = currentMonth.value.getFullYear()
  const m = currentMonth.value.getMonth()
  const firstDay = new Date(y, m, 1).getDay()
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const days: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) days.push(null)
  for (let d = 1; d <= daysInMonth; d++) days.push(d)
  return days
})

const weekDays = ['日', '一', '二', '三', '四', '五', '六']

function dateKey(d: number): string {
  const y = currentMonth.value.getFullYear()
  const m = currentMonth.value.getMonth()
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function isToday(d: number): boolean {
  const now = new Date()
  return now.getDate() === d && now.getMonth() === currentMonth.value.getMonth() && now.getFullYear() === currentMonth.value.getFullYear()
}

function prevMonth() {
  const d = new Date(currentMonth.value)
  d.setMonth(d.getMonth() - 1)
  currentMonth.value = d
}

function nextMonth() {
  const d = new Date(currentMonth.value)
  d.setMonth(d.getMonth() + 1)
  currentMonth.value = d
}

const selectedDayDrivers = computed(() => {
  if (!selectedDate.value) return []
  return scheduleMap.value.get(selectedDate.value) || []
})

const swapSuggestions: SwapSuggestion[] = [
  { driverA: 'd3', driverAName: '王刚', driverB: 'd5', driverBName: '刘洋', reason: '王刚3日请假，刘洋可替早班' },
  { driverA: 'd1', driverAName: '张伟', driverB: 'd2', driverBName: '李明', reason: '张伟连续3天晚班，建议与李明对调中班' },
]

const leaveRequests = [
  { driverId: 'd3', driverName: '王刚', date: '2026-06-18', type: '事假' },
  { driverId: 'd7', driverName: '周涛', date: '2026-06-20', type: '年假' },
]
</script>

<template>
  <div class="flex flex-col h-full gap-4">
    <div class="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm">
      <div class="flex items-center gap-4">
        <el-button size="small" @click="prevMonth">&lt;</el-button>
        <span class="text-base font-semibold">{{ currentMonth.getFullYear() }}年{{ currentMonth.getMonth() + 1 }}月</span>
        <el-button size="small" @click="nextMonth">&gt;</el-button>
      </div>
      <div class="flex items-center gap-3 text-xs">
        <span v-for="(label, key) in shiftLabels" :key class="flex items-center gap-1">
          <span class="w-3 h-3 rounded-sm inline-block" :style="{ background: shiftColors[key] }"></span>
          {{ label }}
        </span>
      </div>
    </div>

    <div class="flex flex-1 gap-4 overflow-hidden">
      <div class="flex-1 bg-white rounded-lg shadow-sm overflow-auto">
        <div class="grid grid-cols-7 sticky top-0 z-10 bg-gray-50">
          <div v-for="wd in weekDays" :key="wd" class="text-center py-2 text-xs font-medium text-gray-500 border-b">{{ wd }}</div>
        </div>
        <div class="grid grid-cols-7">
          <div
            v-for="(day, idx) in calendarDays"
            :key="idx"
            class="min-h-[100px] border-b border-r p-1.5 cursor-pointer hover:bg-blue-50 transition-colors"
            :class="{ 'bg-blue-50': day && selectedDate === dateKey(day) }"
            @click="day && (selectedDate = dateKey(day))"
          >
            <div v-if="day" class="text-xs mb-1" :class="isToday(day) ? 'font-bold text-blue-600' : 'text-gray-700'">
              {{ day }}
            </div>
            <div v-if="day && scheduleMap.get(dateKey(day))" class="space-y-0.5">
              <div
                v-for="d in scheduleMap.get(dateKey(day))!.slice(0, 4)"
                :key="d.id"
                class="flex items-center gap-1 text-[10px] truncate"
              >
                <span class="w-1.5 h-1.5 rounded-full shrink-0" :style="{ background: shiftColors[d.shiftType] }"></span>
                <span class="truncate">{{ d.name }}</span>
              </div>
              <div v-if="scheduleMap.get(dateKey(day))!.length > 4" class="text-[10px] text-gray-400 pl-2.5">
                +{{ scheduleMap.get(dateKey(day))!.length - 4 }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="w-80 space-y-4 overflow-auto shrink-0">
        <el-card shadow="never">
          <template #header>
            <span class="text-sm font-semibold">{{ selectedDate || '请选择日期' }} 司机安排</span>
          </template>
          <div v-if="selectedDayDrivers.length" class="space-y-2">
            <div
              v-for="d in selectedDayDrivers"
              :key="d.id"
              class="flex items-center justify-between py-1.5 px-2 rounded text-sm"
              :style="{ background: shiftColors[d.shiftType] + '18' }"
            >
              <span>{{ d.name }}</span>
              <el-tag size="small" :color="shiftColors[d.shiftType]" effect="dark" style="border: none; color: white">
                {{ shiftLabels[d.shiftType] }}
              </el-tag>
            </div>
          </div>
          <div v-else class="text-center text-gray-400 text-sm py-4">点击日期查看详情</div>
        </el-card>

        <el-card shadow="never">
          <template #header>
            <span class="text-sm font-semibold">请假替班匹配</span>
          </template>
          <div class="space-y-2">
            <div v-for="req in leaveRequests" :key="req.driverId + req.date" class="p-2 rounded-lg bg-orange-50 text-sm">
              <div class="flex items-center justify-between mb-1">
                <span class="font-medium">{{ req.driverName }}</span>
                <el-tag size="small" type="warning">{{ req.type }}</el-tag>
              </div>
              <div class="text-xs text-gray-500">{{ req.date }}</div>
            </div>
          </div>
        </el-card>

        <el-card shadow="never">
          <template #header>
            <span class="text-sm font-semibold">调班建议</span>
          </template>
          <div class="space-y-2">
            <div v-for="s in swapSuggestions" :key="s.driverA + s.driverB" class="p-2 rounded-lg bg-blue-50 text-sm">
              <div class="font-medium text-xs mb-1">{{ s.driverAName }} ↔ {{ s.driverBName }}</div>
              <div class="text-xs text-gray-500 mb-2">{{ s.reason }}</div>
              <el-button size="small" type="primary" text>采纳建议</el-button>
            </div>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>
