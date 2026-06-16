<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useVesselStore } from '@/stores/vessel'
import { findTideWindows } from '@/utils/tide'
import dayjs from 'dayjs'
import type { TideWindow } from '@/types'

const props = defineProps<{
  vesselDraft?: number
  berthDepth?: number
  height?: number
}>()

const vesselStore = useVesselStore()
const containerRef = ref<HTMLDivElement | null>(null)
const containerWidth = ref(800)
const resizeObserver = ref<ResizeObserver | null>(null)

const chartHeight = computed(() => props.height || 220)
const padding = { top: 20, right: 60, bottom: 40, left: 50 }
const innerWidth = computed(() => Math.max(300, containerWidth.value - padding.left - padding.right))
const innerHeight = computed(() => chartHeight.value - padding.top - padding.bottom)

const tideWindows = computed<TideWindow[]>(() => {
  const draft = props.vesselDraft || 10
  const depth = props.berthDepth || 12
  return findTideWindows(vesselStore.tideForecast48h, draft, depth)
})

const minHeight = computed(() => {
  const heights = vesselStore.tideForecast48h.map(d => d.height)
  return Math.floor(Math.min(...heights, (props.berthDepth || 12) - (props.vesselDraft || 10)) - 0.5)
})

const maxHeight = computed(() => {
  const heights = vesselStore.tideForecast48h.map(d => d.height)
  return Math.ceil(Math.max(...heights) + 0.5)
})

const startTime = computed(() => vesselStore.tideForecast48h[0]?.timestamp || new Date())
const endTime = computed(() => vesselStore.tideForecast48h[vesselStore.tideForecast48h.length - 1]?.timestamp || new Date())
const totalMinutes = computed(() => dayjs(endTime.value).diff(startTime.value, 'minute'))

function xForTime(t: Date): number {
  const minutes = dayjs(t).diff(startTime.value, 'minute')
  return (minutes / totalMinutes.value) * innerWidth.value
}

function yForHeight(h: number): number {
  const range = maxHeight.value - minHeight.value
  return innerHeight.value - ((h - minHeight.value) / range) * innerHeight.value
}

const pathD = computed(() => {
  if (vesselStore.tideForecast48h.length === 0) return ''
  const points = vesselStore.tideForecast48h.map((d, i) => {
    const x = xForTime(d.timestamp)
    const y = yForHeight(d.height)
    return `${i === 0 ? 'M' : 'L'}${x},${y}`
  })
  return points.join(' ')
})

const areaD = computed(() => {
  if (vesselStore.tideForecast48h.length === 0) return ''
  const baseY = innerHeight.value
  const points = vesselStore.tideForecast48h.map((d, i) => {
    const x = xForTime(d.timestamp)
    const y = yForHeight(d.height)
    return `${i === 0 ? 'M' : 'L'}${x},${y}`
  })
  const lastX = xForTime(endTime.value)
  const firstX = xForTime(startTime.value)
  return `${points.join(' ')} L${lastX},${baseY} L${firstX},${baseY} Z`
})

const waterlineY = computed(() => {
  const req = (props.berthDepth || 12) - (props.vesselDraft || 10)
  return yForHeight(req)
})

const timeTicks = computed(() => {
  const ticks = []
  for (let h = 0; h <= 48; h += 6) {
    const t = dayjs(startTime.value).add(h, 'hour').toDate()
    ticks.push({
      x: xForTime(t),
      label: dayjs(t).format('MM-DD HH:mm')
    })
  }
  return ticks
})

const heightTicks = computed(() => {
  const ticks = []
  for (let h = minHeight.value; h <= maxHeight.value; h += 1) {
    ticks.push({
      y: yForHeight(h),
      label: `${h}m`
    })
  }
  return ticks
})

const windowRects = computed(() => {
  return tideWindows.value.map(w => ({
    x: xForTime(w.startTime),
    width: Math.max(2, xForTime(w.endTime) - xForTime(w.startTime)),
    minHeight: w.minHeight,
    type: w.type
  }))
})

const currentTimeX = computed(() => {
  const now = new Date()
  if (now < startTime.value || now > endTime.value) return null
  return xForTime(now)
})

watch([() => vesselStore.selectedTideStationId, () => props.vesselDraft, () => props.berthDepth], () => {
  // 响应式更新
})

onMounted(() => {
  if (containerRef.value) {
    resizeObserver.value = new ResizeObserver(entries => {
      for (const entry of entries) {
        containerWidth.value = entry.contentRect.width
      }
    })
    resizeObserver.value.observe(containerRef.value)
  }
})

onUnmounted(() => {
  if (resizeObserver.value) {
    resizeObserver.value.disconnect()
  }
})
</script>

<template>
  <div class="w-full h-full flex flex-col">
    <div class="flex items-center justify-between mb-2 px-1">
      <div class="flex items-center gap-3">
        <h3 class="text-port-text text-sm font-semibold flex items-center gap-2">
          <el-icon class="text-port-accent"><TrendCharts /></el-icon>
          潮汐预报 - {{ vesselStore.selectedTideStation?.name }}
        </h3>
        <el-select
          :model-value="vesselStore.selectedTideStationId"
          @update:model-value="vesselStore.setSelectedTideStation($event)"
          size="small"
          class="w-36"
        >
          <el-option
            v-for="s in vesselStore.tideStations"
            :key="s.id"
            :label="s.name"
            :value="s.id"
          />
        </el-select>
      </div>
      <div class="flex items-center gap-4 text-xs">
        <div class="flex items-center gap-1">
          <div class="w-3 h-3 rounded bg-port-success/60" />
          <span class="text-port-text-muted">可靠泊窗口</span>
        </div>
        <div class="flex items-center gap-1">
          <div class="w-8 h-px border-t-2 border-dashed border-port-warning" />
          <span class="text-port-text-muted">最低吃水线</span>
        </div>
      </div>
    </div>

    <div ref="containerRef" class="flex-1 min-h-0">
      <svg
        :width="containerWidth"
        :height="chartHeight"
        class="overflow-visible"
      >
        <defs>
          <linearGradient id="tideGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#2979ff" stop-opacity="0.6" />
            <stop offset="100%" stop-color="#2979ff" stop-opacity="0.05" />
          </linearGradient>
          <linearGradient id="windowGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#00c853" stop-opacity="0.5" />
            <stop offset="100%" stop-color="#00c853" stop-opacity="0.1" />
          </linearGradient>
        </defs>

        <g :transform="`translate(${padding.left},${padding.top})`">
          <rect
            v-for="(rect, i) in windowRects"
            :key="`win-${i}`"
            :x="rect.x"
            :y="0"
            :width="rect.width"
            :height="innerHeight"
            fill="url(#windowGradient)"
            rx="2"
            class="tide-window-highlight"
          />

          <line
            v-for="(tick, i) in timeTicks"
            :key="`vline-${i}`"
            :x1="tick.x"
            :y1="0"
            :x2="tick.x"
            :y2="innerHeight"
            stroke="#1e3a5f"
            stroke-width="1"
            stroke-dasharray="2,4"
          />

          <line
            v-for="(tick, i) in heightTicks"
            :key="`hline-${i}`"
            :x1="0"
            :y1="tick.y"
            :x2="innerWidth"
            :y2="tick.y"
            stroke="#1e3a5f"
            stroke-width="1"
            :opacity="i === 0 ? 0.5 : 0.3"
          />

          <path
            :d="areaD"
            fill="url(#tideGradient)"
          />

          <path
            :d="pathD"
            fill="none"
            stroke="#2979ff"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />

          <line
            :x1="0"
            :y1="waterlineY"
            :x2="innerWidth"
            :y2="waterlineY"
            stroke="#ff8c00"
            stroke-width="2"
            stroke-dasharray="6,4"
          />

          <text
            :x="innerWidth + 5"
            :y="waterlineY + 4"
            fill="#ff8c00"
            font-size="11"
            font-weight="500"
          >
            {{ ((berthDepth || 12) - (vesselDraft || 10)).toFixed(1) }}m
          </text>

          <line
            v-if="currentTimeX !== null"
            :x1="currentTimeX"
            :y1="0"
            :x2="currentTimeX"
            :y2="innerHeight"
            stroke="#ff3d00"
            stroke-width="1.5"
          />
          <circle
            v-if="currentTimeX !== null"
            :cx="currentTimeX"
            :cy="0"
            r="4"
            fill="#ff3d00"
          />

          <text
            v-for="(tick, i) in heightTicks"
            :key="`hlabel-${i}`"
            :x="-8"
            :y="tick.y + 4"
            fill="#90a4ae"
            font-size="10"
            text-anchor="end"
          >
            {{ tick.label }}
          </text>

          <text
            v-for="(tick, i) in timeTicks"
            :key="`tlabel-${i}`"
            :x="tick.x"
            :y="innerHeight + 18"
            fill="#90a4ae"
            font-size="10"
            text-anchor="middle"
          >
            {{ tick.label }}
          </text>
        </g>

        <text
          :x="10"
          :y="12"
          fill="#90a4ae"
          font-size="10"
        >
          潮高(m)
        </text>
      </svg>
    </div>

    <div v-if="tideWindows.length > 0" class="mt-2 pt-2 border-t border-port-panel/50">
      <div class="text-xs text-port-text-muted mb-1">可靠泊窗口 (共 {{ tideWindows.length }} 个)：</div>
      <div class="flex flex-wrap gap-1.5">
        <el-tag
          v-for="(w, i) in tideWindows.slice(0, 6)"
          :key="i"
          size="small"
          :type="w.type === 'high' ? 'success' : 'warning'"
          effect="dark"
          class="text-xs"
        >
          {{ dayjs(w.startTime).format('HH:mm') }} - {{ dayjs(w.endTime).format('HH:mm') }}
          (最低{{ w.minHeight.toFixed(1) }}m)
        </el-tag>
        <el-tag
          v-if="tideWindows.length > 6"
          size="small"
          type="info"
          effect="plain"
          class="text-xs"
        >
          +{{ tideWindows.length - 6 }} 更多
        </el-tag>
      </div>
    </div>
  </div>
</template>
