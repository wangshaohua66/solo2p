<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import { useScheduleStore } from '@/stores/schedule'
import { useVesselStore } from '@/stores/vessel'
import dayjs from 'dayjs'
import { CARGO_TYPE_LABELS, SCHEDULE_STATUS_LABELS, type BerthSchedule } from '@/types'

const props = defineProps<{
  editable?: boolean
  days?: number
  compact?: boolean
}>()

const emit = defineEmits<{
  selectSchedule: [schedule: BerthSchedule]
}>()

const scheduleStore = useScheduleStore()
const vesselStore = useVesselStore()

const containerRef = ref<HTMLDivElement | null>(null)
const scrollRef = ref<HTMLDivElement | null>(null)
const containerWidth = ref(1000)
const containerHeight = ref(600)
const resizeObserver = ref<ResizeObserver | null>(null)

const viewDays = computed(() => props.days || 7)
const rowHeight = computed(() => props.compact ? 36 : 48)
const headerHeight = 60
const leftColumnWidth = 160
const hourWidth = 40
const totalHours = computed(() => viewDays.value * 24)
const chartWidth = computed(() => Math.max(containerWidth.value - leftColumnWidth, totalHours.value * hourWidth / 2))
const pixelsPerHour = computed(() => chartWidth.value / totalHours.value)

const startTime = computed(() => dayjs().startOf('day'))
const endTime = computed(() => startTime.value.add(viewDays.value, 'day'))

const activeBerths = computed(() => {
  const result: { portId: string; berths: typeof scheduleStore.berths }[] = []
  for (const port of vesselStore.ports) {
    const portBerths = scheduleStore.berths.filter(b => b.portId === port.id)
    if (portBerths.length > 0) {
      result.push({ portId: port.id, berths: portBerths })
    }
  }
  return result
})

const allBerths = computed(() => {
  return activeBerths.value.flatMap(p => p.berths)
})

const totalHeight = computed(() => {
  const portHeaders = activeBerths.value.length * 28
  const berthRows = allBerths.value.length * rowHeight.value
  return headerHeight + portHeaders + berthRows + 20
})

const visibleSchedules = computed(() => {
  const berthIds = new Set(allBerths.value.map(b => b.id))
  return scheduleStore.schedules.filter(s => {
    if (!berthIds.has(s.berthId)) return false
    return dayjs(s.arrivalTime).isBefore(endTime.value) && dayjs(s.departureTime).isAfter(startTime.value)
  })
})

const berthRowMap = computed(() => {
  const map = new Map<string, number>()
  let offset = 0
  for (const port of activeBerths.value) {
    offset += 28
    for (let i = 0; i < port.berths.length; i++) {
      map.set(port.berths[i].id, headerHeight + offset + i * rowHeight.value)
    }
    offset += port.berths.length * rowHeight.value
  }
  return map
})

const dragging = shallowRef<{
  id: string
  mode: 'move' | 'resize-start' | 'resize-end'
  startX: number
  startY: number
  originalArrival: Date
  originalDeparture: Date
  originalBerthId: string
  currentBerthId: string
} | null>(null)

const hoverScheduleId = ref<string | null>(null)
const selectedScheduleId = ref<string | null>(null)

function xForTime(t: Date): number {
  const hours = dayjs(t).diff(startTime.value, 'minute') / 60
  return hours * pixelsPerHour.value
}

function timeForX(x: number): Date {
  const hours = x / pixelsPerHour.value
  return startTime.value.add(hours * 60, 'minute').toDate()
}

function scheduleBar(s: BerthSchedule) {
  const top = berthRowMap.value.get(s.berthId) ?? 0
  const left = Math.max(0, xForTime(s.arrivalTime))
  const right = Math.min(chartWidth.value, xForTime(s.departureTime))
  const width = Math.max(4, right - left)
  const height = rowHeight.value - 8
  return { top: top + 4, left, width, height }
}

function statusColor(s: BerthSchedule) {
  if (s.status === 'conflict') return { bg: 'rgba(255,140,0,0.85)', border: '#ff8c00' }
  if (s.status === 'completed') return { bg: 'rgba(144,164,174,0.6)', border: '#90a4ae' }
  if (s.status === 'in_progress') return { bg: 'rgba(0,200,83,0.85)', border: '#00c853' }
  if (s.status === 'pending') return { bg: 'rgba(41,121,255,0.75)', border: '#2979ff' }
  if (s.status === 'approved') return { bg: 'rgba(102,187,106,0.75)', border: '#66bb6a' }
  return { bg: 'rgba(41,121,255,0.5)', border: '#2979ff' }
}

function handleMouseDown(e: MouseEvent, s: BerthSchedule, mode: 'move' | 'resize-start' | 'resize-end') {
  if (!props.editable) return
  e.preventDefault()
  e.stopPropagation()
  dragging.value = {
    id: s.id,
    mode,
    startX: e.clientX,
    startY: e.clientY,
    originalArrival: new Date(s.arrivalTime),
    originalDeparture: new Date(s.departureTime),
    originalBerthId: s.berthId,
    currentBerthId: s.berthId
  }
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

function handleMouseMove(e: MouseEvent) {
  if (!dragging.value) return
  const dx = e.clientX - dragging.value.startX
  const dy = e.clientY - dragging.value.startY
  const dMinutes = Math.round((dx / pixelsPerHour.value) * 60 / 15) * 15

  const s = scheduleStore.getScheduleById(dragging.value.id)
  if (!s) return

  if (dragging.value.mode === 'move') {
    const newArrival = dayjs(dragging.value.originalArrival).add(dMinutes, 'minute').toDate()
    const newDeparture = dayjs(dragging.value.originalDeparture).add(dMinutes, 'minute').toDate()

    let newBerthId = dragging.value.originalBerthId
    const rowDelta = Math.round(dy / rowHeight.value)
    if (Math.abs(rowDelta) > 0) {
      const berthList = allBerths.value
      const currentId = dragging.value?.originalBerthId
      if (currentId) {
        const idx = berthList.findIndex(b => b.id === currentId)
        const newIdx = Math.max(0, Math.min(berthList.length - 1, idx + rowDelta))
        newBerthId = berthList[newIdx].id
      }
    }
    dragging.value.currentBerthId = newBerthId
    scheduleStore.updateSchedule(dragging.value.id, {
      arrivalTime: newArrival,
      departureTime: newDeparture,
      berthId: newBerthId
    })
  } else if (dragging.value.mode === 'resize-start') {
    const newArrival = dayjs(dragging.value.originalArrival).add(dMinutes, 'minute').toDate()
    if (dayjs(newArrival).isBefore(dragging.value.originalDeparture)) {
      scheduleStore.updateSchedule(dragging.value.id, { arrivalTime: newArrival })
    }
  } else if (dragging.value.mode === 'resize-end') {
    const newDeparture = dayjs(dragging.value.originalDeparture).add(dMinutes, 'minute').toDate()
    if (dayjs(newDeparture).isAfter(dragging.value.originalArrival)) {
      scheduleStore.updateSchedule(dragging.value.id, { departureTime: newDeparture })
    }
  }
}

function handleMouseUp() {
  dragging.value = null
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
}

function selectSchedule(s: BerthSchedule) {
  selectedScheduleId.value = s.id
  emit('selectSchedule', s)
}

const dayHeaders = computed(() => {
  const headers = []
  for (let d = 0; d < viewDays.value; d++) {
    const day = startTime.value.add(d, 'day')
    const x = (d * 24) * pixelsPerHour.value
    const w = 24 * pixelsPerHour.value
    headers.push({
      x,
      w,
      label: day.format('MM-DD dddd'),
      isToday: day.isSame(dayjs(), 'day')
    })
  }
  return headers
})

const hourHeaders = computed(() => {
  const headers = []
  for (let h = 0; h <= totalHours.value; h += 3) {
    headers.push({
      x: h * pixelsPerHour.value,
      label: `${String(h % 24).padStart(2, '0')}:00`
    })
  }
  return headers
})

function getVesselName(vesselId: string) {
  return vesselStore.getVesselById(vesselId)?.name || vesselId
}

watch(visibleSchedules, () => {}, { deep: false })

onMounted(() => {
  if (containerRef.value) {
    resizeObserver.value = new ResizeObserver(entries => {
      for (const entry of entries) {
        containerWidth.value = entry.contentRect.width
        containerHeight.value = entry.contentRect.height
      }
    })
    resizeObserver.value.observe(containerRef.value)
  }
})

onUnmounted(() => {
  if (resizeObserver.value) resizeObserver.value.disconnect()
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
})
</script>

<template>
  <div ref="containerRef" class="w-full h-full flex flex-col bg-port-card/40 rounded-lg border border-port-panel overflow-hidden">
    <div class="flex items-center justify-between px-4 py-2 border-b border-port-panel bg-port-card/60">
      <div class="flex items-center gap-3">
        <h3 class="text-port-text text-sm font-semibold flex items-center gap-2">
          <el-icon class="text-port-accent"><Grid /></el-icon>
          泊位靠泊甘特图
        </h3>
        <el-tag size="small" type="info" effect="dark">
          共 {{ visibleSchedules.length }} 条作业
        </el-tag>
        <el-tag
          v-if="scheduleStore.conflictSchedules.length > 0"
          size="small"
          type="warning"
          effect="dark"
        >
          {{ scheduleStore.conflictSchedules.length }} 条冲突
        </el-tag>
      </div>
      <div class="flex items-center gap-3 text-xs">
        <div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-port-success" /><span class="text-port-text-muted">作业中</span></div>
        <div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-port-accent" /><span class="text-port-text-muted">已批准</span></div>
        <div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-port-warning" /><span class="text-port-text-muted">冲突</span></div>
        <div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-gray-500" /><span class="text-port-text-muted">已完成</span></div>
      </div>
    </div>

    <div ref="scrollRef" class="flex-1 overflow-auto">
      <div
        class="relative"
        :style="{ width: leftColumnWidth + chartWidth + 'px', height: totalHeight + 'px' }"
      >
        <svg :width="leftColumnWidth + chartWidth" :height="totalHeight" class="block">
          <g>
            <rect :width="leftColumnWidth" :height="totalHeight" fill="#152238" />
            <line :x1="leftColumnWidth" :y1="0" :x2="leftColumnWidth" :y2="totalHeight" stroke="#1e3a5f" stroke-width="1" />

            <rect :width="leftColumnWidth" :height="headerHeight" fill="#1e3a5f" />
            <text :x="leftColumnWidth / 2" :y="headerHeight / 2 + 5" text-anchor="middle" fill="#90a4ae" font-size="12" font-weight="600">泊位</text>

            <g>
              <template v-for="(port, portIdx) in activeBerths" :key="port.portId">
                <template v-for="(b, i) in port.berths" :key="b.id">
                  <rect
                    :x="0"
                    :y="berthRowMap.get(b.id)! - 4"
                    :width="leftColumnWidth"
                    :height="rowHeight"
                    :fill="i % 2 === 0 ? '#152238' : '#192a42'"
                  />
                  <line
                    :x1="0"
                    :y1="berthRowMap.get(b.id)! + rowHeight - 4"
                    :x2="leftColumnWidth + chartWidth"
                    :y2="berthRowMap.get(b.id)! + rowHeight - 4"
                    stroke="#1e3a5f"
                    stroke-width="0.5"
                  />
                  <text
                    :x="12"
                    :y="berthRowMap.get(b.id)! + rowHeight / 2"
                    fill="#e8eaf6"
                    font-size="11"
                    dominant-baseline="middle"
                  >
                    {{ b.name }}
                  </text>
                  <text
                    :x="leftColumnWidth - 10"
                    :y="berthRowMap.get(b.id)! + rowHeight / 2"
                    fill="#90a4ae"
                    font-size="10"
                    text-anchor="end"
                    dominant-baseline="middle"
                  >
                    {{ b.depth }}m / {{ b.length }}m
                  </text>
                </template>
              </template>
            </g>
          </g>

          <g :transform="`translate(${leftColumnWidth},0)`">
            <rect :width="chartWidth" :height="headerHeight" fill="#1e3a5f" />

            <template v-for="dh in dayHeaders" :key="dh.label">
              <rect :x="dh.x" :y="0" :width="dh.w" :height="28" :fill="dh.isToday ? 'rgba(41,121,255,0.2)' : 'transparent'" stroke="#2a3f5f" stroke-width="0.5" />
              <text :x="dh.x + dh.w / 2" :y="18" text-anchor="middle" :fill="dh.isToday ? '#2979ff' : '#e8eaf6'" font-size="11" font-weight="600">
                {{ dh.label }}
              </text>
              <line v-if="dh.isToday" :x1="dh.x" :y1="28" :x2="dh.x" :y2="totalHeight" stroke="#2979ff" stroke-width="1" stroke-dasharray="4,4" opacity="0.5" />
            </template>

            <rect x="0" y="28" :width="chartWidth" :height="32" fill="#1a2d4a" />
            <template v-for="hh in hourHeaders" :key="hh.label + hh.x">
              <line :x1="hh.x" :y1="28" :x2="hh.x" :y2="totalHeight" stroke="#1e3a5f" stroke-width="0.5" stroke-dasharray="2,4" />
              <text :x="hh.x" :y="48" fill="#90a4ae" font-size="10" :transform="`translate(3,0)`">{{ hh.label }}</text>
            </template>

            <template v-for="(port, pIdx) in activeBerths" :key="'bg-' + port.portId">
              <template v-for="(b, i) in port.berths" :key="'bg-' + b.id">
                <rect
                  x="0"
                  :y="berthRowMap.get(b.id)! - 4"
                  :width="chartWidth"
                  :height="rowHeight"
                  :fill="(pIdx + i) % 2 === 0 ? 'rgba(21,34,56,0.3)' : 'rgba(26,45,74,0.3)'"
                />
              </template>
            </template>

            <line
              v-if="startTime.isBefore(dayjs()) && endTime.isAfter(dayjs())"
              :x1="Math.max(0, xForTime(new Date()))"
              y1="60"
              :x2="Math.max(0, xForTime(new Date()))"
              :y2="totalHeight"
              stroke="#ff3d00"
              stroke-width="2"
              opacity="0.8"
            />
          </g>

          <g :transform="`translate(${leftColumnWidth},0)`">
            <foreignObject
              v-for="s in visibleSchedules"
              :key="s.id"
              :x="scheduleBar(s).left"
              :y="scheduleBar(s).top"
              :width="scheduleBar(s).width"
              :height="scheduleBar(s).height"
              :style="{ zIndex: dragging?.id === s.id ? 100 : 10 }"
            >
              <div
                xmlns="http://www.w3.org/1999/xhtml"
                :class="['gantt-bar w-full h-full rounded-md flex flex-col justify-center px-2 overflow-hidden relative', { 'dragging': dragging?.id === s.id }]"
                :style="{
                  backgroundColor: statusColor(s).bg,
                  border: `1.5px solid ${statusColor(s).border}`,
                  boxShadow: selectedScheduleId === s.id ? `0 0 0 2px ${statusColor(s).border}, 0 4px 16px rgba(0,0,0,0.4)` : hoverScheduleId === s.id ? '0 2px 12px rgba(0,0,0,0.3)' : 'none'
                }"
                @mousedown="(e: any) => handleMouseDown(e, s, 'move')"
                @mouseenter="hoverScheduleId = s.id"
                @mouseleave="hoverScheduleId = null"
                @click="selectSchedule(s)"
              >
                <div v-if="s.progress > 0 && s.status !== 'completed'" class="absolute inset-y-0 left-0 bg-white/15" :style="{ width: s.progress + '%' }" />
                <div v-if="s.status === 'completed'" class="absolute inset-0 bg-black/10" />
                <div class="relative z-10 flex items-center justify-between gap-1 min-w-0">
                  <span class="text-white text-xs font-medium truncate">{{ getVesselName(s.vesselId) }}</span>
                </div>
                <div class="relative z-10 flex items-center gap-2 mt-0.5 min-w-0">
                  <span class="text-white/80 text-[10px] truncate">{{ CARGO_TYPE_LABELS[s.cargoType] }}</span>
                  <span v-if="s.conflicts && s.conflicts.length > 0" class="text-[10px] bg-black/30 px-1 rounded text-white flex-shrink-0">!</span>
                </div>

                <div
                  v-if="editable && hoverScheduleId === s.id"
                  class="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/50 rounded-l"
                  @mousedown.stop="(e: any) => handleMouseDown(e, s, 'resize-start')"
                />
                <div
                  v-if="editable && hoverScheduleId === s.id"
                  class="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/50 rounded-r"
                  @mousedown.stop="(e: any) => handleMouseDown(e, s, 'resize-end')"
                />

                <el-tooltip
                  v-if="s.conflicts?.length"
                  :content="s.conflicts.join('; ')"
                  placement="top"
                  :teleported="false"
                  popper-class="!text-xs"
                >
                  <div class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-port-warning flex items-center justify-center text-[9px] text-white font-bold">!</div>
                </el-tooltip>
              </div>
            </foreignObject>
          </g>
        </svg>
      </div>
    </div>

    <div v-if="selectedScheduleId" class="px-4 py-2 border-t border-port-panel bg-port-card/60 flex items-center justify-between">
      <template v-if="scheduleStore.getScheduleById(selectedScheduleId)">
        <div class="flex items-center gap-4 text-xs text-port-text-muted">
          <span>
            <el-icon class="text-port-accent mr-1"><Ship /></el-icon>
            {{ getVesselName(scheduleStore.getScheduleById(selectedScheduleId)!.vesselId) }}
          </span>
          <span>
            靠泊: {{ dayjs(scheduleStore.getScheduleById(selectedScheduleId)!.arrivalTime).format('MM-DD HH:mm') }}
          </span>
          <span>
            离泊: {{ dayjs(scheduleStore.getScheduleById(selectedScheduleId)!.departureTime).format('MM-DD HH:mm') }}
          </span>
          <el-tag size="small" :type="scheduleStore.getScheduleById(selectedScheduleId)!.status === 'conflict' ? 'warning' : 'info'">
            {{ SCHEDULE_STATUS_LABELS[scheduleStore.getScheduleById(selectedScheduleId)!.status] }}
          </el-tag>
        </div>
        <div class="flex items-center gap-2">
          <el-button
            v-if="editable && scheduleStore.getScheduleById(selectedScheduleId)!.status !== 'completed'"
            size="small"
            type="success"
            :disabled="scheduleStore.getScheduleById(selectedScheduleId)!.status === 'conflict'"
            @click="scheduleStore.approveSchedule(selectedScheduleId!)"
          >
            <el-icon class="mr-1"><Check /></el-icon>批准
          </el-button>
          <el-button
            v-if="editable"
            size="small"
            type="danger"
            :disabled="scheduleStore.getScheduleById(selectedScheduleId)!.status === 'completed'"
            @click="scheduleStore.deleteSchedule(selectedScheduleId!); selectedScheduleId = null"
          >
            <el-icon class="mr-1"><Delete /></el-icon>删除
          </el-button>
        </div>
      </template>
    </div>
  </div>
</template>
