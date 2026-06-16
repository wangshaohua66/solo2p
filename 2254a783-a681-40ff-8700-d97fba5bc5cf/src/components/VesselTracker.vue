<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, shallowRef } from 'vue'
import { useScheduleStore } from '@/stores/schedule'
import { useVesselStore } from '@/stores/vessel'
import dayjs from 'dayjs'
import { VESSEL_STATUS_LABELS, CARGO_TYPE_LABELS, type Vessel } from '@/types'

const props = defineProps<{
  height?: number
}>()

const emit = defineEmits<{
  selectVessel: [vessel: Vessel]
}>()

const scheduleStore = useScheduleStore()
const vesselStore = useVesselStore()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const canvasWidth = ref(900)
const canvasHeight = computed(() => props.height || 500)
const resizeObserver = ref<ResizeObserver | null>(null)

const isPlaying = ref(false)
const playSpeed = ref(1)
const simulationProgress = ref(0)
const totalSimulationMinutes = ref(24 * 60)
const selectedVesselId = ref<string | null>(null)
const hoverVesselId = ref<string | null>(null)

const animFrame = shallowRef<number>(0)
const lastFrameTime = shallowRef<number>(0)

const displayedVessels = computed(() => {
  return vesselStore.vessels
    .filter(v => v.status !== 'departed' && v.position)
    .slice(0, 100)
})

const statusColors: Record<string, string> = {
  anchorage: '#ff8c00',
  entering: '#2979ff',
  berthed: '#00c853',
  loading: '#00e676',
  unloading: '#69f0ae',
  leaving: '#448aff'
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function getVesselDisplayPosition(v: Vessel): { x: number; y: number } {
  if (!v.route || v.route.length < 2) {
    return v.position || { x: 50, y: 50 }
  }
  const progress = Math.min(1, simulationProgress.value / totalSimulationMinutes.value)
  const totalPoints = v.route.length - 1
  const exactIndex = progress * totalPoints
  const idx = Math.floor(exactIndex)
  const frac = exactIndex - idx
  const nextIdx = Math.min(totalPoints, idx + 1)
  return {
    x: lerp(v.route[idx].x, v.route[nextIdx].x, frac),
    y: lerp(v.route[idx].y, v.route[nextIdx].y, frac)
  }
}

function draw(ctx: CanvasRenderingContext2D) {
  const W = canvasWidth.value
  const H = canvasHeight.value

  ctx.clearRect(0, 0, W, H)

  const waterGrad = ctx.createLinearGradient(0, 0, 0, H)
  waterGrad.addColorStop(0, '#0d1f3c')
  waterGrad.addColorStop(0.5, '#0a1b33')
  waterGrad.addColorStop(1, '#0a1628')
  ctx.fillStyle = waterGrad
  ctx.fillRect(0, 0, W, H)

  ctx.strokeStyle = 'rgba(41, 121, 255, 0.08)'
  ctx.lineWidth = 1
  const gridSize = 40
  for (let x = 0; x <= W; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
  }
  for (let y = 0; y <= H; y += gridSize) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }

  const scaleX = W / 1000
  const scaleY = H / 500

  ctx.fillStyle = '#1a3d5c'
  ctx.strokeStyle = '#2979ff'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(80 * scaleX, 100 * scaleY)
  ctx.lineTo(950 * scaleX, 100 * scaleY)
  ctx.lineTo(970 * scaleX, 140 * scaleY)
  ctx.lineTo(970 * scaleX, 260 * scaleY)
  ctx.lineTo(900 * scaleX, 300 * scaleY)
  ctx.lineTo(300 * scaleX, 300 * scaleY)
  ctx.lineTo(250 * scaleX, 340 * scaleY)
  ctx.lineTo(250 * scaleX, 420 * scaleY)
  ctx.lineTo(920 * scaleX, 420 * scaleY)
  ctx.lineTo(950 * scaleX, 460 * scaleY)
  ctx.lineTo(950 * scaleX, 480 * scaleY)
  ctx.lineTo(60 * scaleX, 480 * scaleY)
  ctx.lineTo(60 * scaleX, 120 * scaleY)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  for (const berth of scheduleStore.berths.slice(0, 38)) {
    const bx = berth.x * scaleX
    const by = berth.y * scaleY
    const bw = 50 * scaleX
    const bh = 10 * scaleY

    ctx.fillStyle = berth.status === 'maintenance' ? '#5d4037' : berth.status === 'occupied' ? '#ff8c00' : '#37474f'
    ctx.fillRect(bx, by, bw, bh)
    ctx.strokeStyle = '#546e7a'
    ctx.strokeRect(bx, by, bw, bh)

    ctx.fillStyle = 'rgba(232, 234, 246, 0.7)'
    ctx.font = `${9 * Math.min(scaleX, 1)}px sans-serif`
    ctx.textAlign = 'left'
    ctx.fillText(berth.name.split(/[#港]/).pop() || '', bx, by - 3)
  }

  ctx.strokeStyle = 'rgba(0, 200, 83, 0.4)'
  ctx.lineWidth = 2
  ctx.setLineDash([6, 4])
  ctx.beginPath()
  ctx.moveTo(40 * scaleX, 460 * scaleY)
  ctx.bezierCurveTo(200 * scaleX, 400 * scaleY, 150 * scaleX, 200 * scaleY, 350 * scaleX, 150 * scaleY)
  ctx.stroke()
  ctx.setLineDash([])

  const simulatedVessels = new Set<string>()

  for (const v of displayedVessels.value) {
    const pos = v.position || { x: 50, y: 50 }
    let px: number, py: number
    if (v.route && v.route.length >= 2 && isPlaying.value) {
      const dp = getVesselDisplayPosition(v)
      px = dp.x * scaleX
      py = dp.y * scaleY
      simulatedVessels.add(v.id)
    } else {
      px = pos.x * scaleX
      py = pos.y * scaleY
    }

    const isHover = hoverVesselId.value === v.id
    const isSelected = selectedVesselId.value === v.id
    const baseSize = (isHover || isSelected) ? 10 : 7
    const color = statusColors[v.status] || '#2979ff'

    if (v.route && v.route.length >= 2) {
      ctx.strokeStyle = `${color}40`
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      for (let i = 0; i < v.route.length; i++) {
        const wp = v.route[i]
        const wx = wp.x * scaleX
        const wy = wp.y * scaleY
        if (i === 0) ctx.moveTo(wx, wy)
        else ctx.lineTo(wx, wy)
      }
      ctx.stroke()
      ctx.setLineDash([])
    }

    const gradient = ctx.createRadialGradient(px, py, 0, px, py, baseSize * 2.5)
    gradient.addColorStop(0, `${color}80`)
    gradient.addColorStop(1, `${color}00`)
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(px, py, baseSize * 2.5, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(px, py, baseSize, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = isSelected ? '#fff' : 'rgba(255,255,255,0.6)'
    ctx.lineWidth = isSelected ? 2.5 : 1.5
    ctx.stroke()

    if (isHover || isSelected) {
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 11px sans-serif'
      ctx.textAlign = 'left'
      const label = v.name.length > 8 ? v.name.slice(0, 8) + '…' : v.name
      const tw = ctx.measureText(label).width + 10
      ctx.fillStyle = 'rgba(10, 22, 40, 0.9)'
      ctx.fillRect(px + baseSize + 4, py - 8, tw, 18)
      ctx.fillStyle = '#fff'
      ctx.fillText(label, px + baseSize + 9, py + 5)
    }
  }

  const progX = 40 * scaleX + (350 - 40) * scaleX * (simulationProgress.value / totalSimulationMinutes.value)
  const progY = 460 * scaleY + (150 - 460) * scaleY * (simulationProgress.value / totalSimulationMinutes.value)
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(progX, progY, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#2979ff'
  ctx.lineWidth = 2
  ctx.stroke()
}

function frameLoop(ts: number) {
  if (!canvasRef.value) return
  const ctx = canvasRef.value.getContext('2d')
  if (!ctx) return

  if (isPlaying.value) {
    const delta = (ts - (lastFrameTime.value || ts)) / 1000
    simulationProgress.value = Math.min(
      totalSimulationMinutes.value,
      simulationProgress.value + delta * playSpeed.value * 120
    )
    if (simulationProgress.value >= totalSimulationMinutes.value) {
      simulationProgress.value = 0
    }
  }
  lastFrameTime.value = ts

  draw(ctx)
  animFrame.value = requestAnimationFrame(frameLoop)
}

function handleCanvasClick(e: MouseEvent) {
  if (!canvasRef.value) return
  const rect = canvasRef.value.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  const scaleX = canvasWidth.value / 1000
  const scaleY = canvasHeight.value / 500

  for (const v of displayedVessels.value) {
    const pos = v.position || { x: 50, y: 50 }
    let px: number, py: number
    if (v.route && v.route.length >= 2 && isPlaying.value) {
      const dp = getVesselDisplayPosition(v)
      px = dp.x * scaleX
      py = dp.y * scaleY
    } else {
      px = pos.x * scaleX
      py = pos.y * scaleY
    }
    const dist = Math.hypot(mx - px, my - py)
    if (dist < 14) {
      selectedVesselId.value = v.id
      emit('selectVessel', v)
      return
    }
  }
  selectedVesselId.value = null
}

function handleCanvasMove(e: MouseEvent) {
  if (!canvasRef.value) return
  const rect = canvasRef.value.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  const scaleX = canvasWidth.value / 1000
  const scaleY = canvasHeight.value / 500

  let found = false
  for (const v of displayedVessels.value) {
    const pos = v.position || { x: 50, y: 50 }
    let px: number, py: number
    if (v.route && v.route.length >= 2 && isPlaying.value) {
      const dp = getVesselDisplayPosition(v)
      px = dp.x * scaleX
      py = dp.y * scaleY
    } else {
      px = pos.x * scaleX
      py = pos.y * scaleY
    }
    const dist = Math.hypot(mx - px, my - py)
    if (dist < 14) {
      hoverVesselId.value = v.id
      found = true
      break
    }
  }
  if (!found) hoverVesselId.value = null
}

function togglePlay() {
  isPlaying.value = !isPlaying.value
}

function resetProgress() {
  simulationProgress.value = 0
  isPlaying.value = false
}

watch(isPlaying, (playing) => {
  if (playing) {
    lastFrameTime.value = 0
  }
})

onMounted(() => {
  if (containerRef.value) {
    resizeObserver.value = new ResizeObserver(entries => {
      for (const entry of entries) {
        canvasWidth.value = Math.floor(entry.contentRect.width)
      }
    })
    resizeObserver.value.observe(containerRef.value)
  }
  animFrame.value = requestAnimationFrame(frameLoop)
})

onUnmounted(() => {
  if (resizeObserver.value) resizeObserver.value.disconnect()
  cancelAnimationFrame(animFrame.value)
})
</script>

<template>
  <div class="w-full h-full flex flex-col bg-port-card/40 rounded-lg border border-port-panel overflow-hidden">
    <div class="flex items-center justify-between px-4 py-2 border-b border-port-panel bg-port-card/60">
      <div class="flex items-center gap-3">
        <h3 class="text-port-text text-sm font-semibold flex items-center gap-2">
          <el-icon class="text-port-accent"><MapLocation /></el-icon>
          港口平面图 - 船舶实时监控
        </h3>
        <el-tag size="small" type="success" effect="dark">
          {{ displayedVessels.length }} 艘在港
        </el-tag>
      </div>
      <div class="flex items-center gap-1.5">
        <el-button size="small" :type="!isPlaying ? 'primary' : 'default'" @click="togglePlay">
          <el-icon class="mr-1"><component :is="isPlaying ? 'Pause' : 'VideoPlay'" /></el-icon>
          {{ isPlaying ? '暂停' : '播放' }}
        </el-button>
        <el-button size="small" @click="resetProgress">
          <el-icon class="mr-1"><RefreshRight /></el-icon>重置
        </el-button>
        <el-select v-model="playSpeed" size="small" class="w-20">
          <el-option label="1x" :value="1" />
          <el-option label="2x" :value="2" />
          <el-option label="4x" :value="4" />
          <el-option label="8x" :value="8" />
        </el-select>
      </div>
    </div>

    <div ref="containerRef" class="flex-1 relative min-h-0">
      <canvas
        ref="canvasRef"
        :width="canvasWidth"
        :height="canvasHeight"
        class="w-full h-full cursor-crosshair block"
        @click="handleCanvasClick"
        @mousemove="handleCanvasMove"
      />

      <div class="absolute top-3 left-3 bg-port-card/90 backdrop-blur-sm rounded-lg border border-port-panel px-3 py-2">
        <div class="text-xs text-port-text-muted mb-1.5 font-semibold">船舶状态</div>
        <div class="flex flex-col gap-1">
          <div v-for="(color, status) in statusColors" :key="status" class="flex items-center gap-2 text-xs">
            <div class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: color }" />
            <span class="text-port-text-muted">{{ VESSEL_STATUS_LABELS[status as keyof typeof VESSEL_STATUS_LABELS] }}</span>
          </div>
        </div>
      </div>

      <div
        v-if="selectedVesselId && vesselStore.getVesselById(selectedVesselId)"
        class="absolute top-3 right-3 w-64 bg-port-card/95 backdrop-blur-sm rounded-lg border border-port-accent/50 shadow-xl overflow-hidden"
      >
        <div class="px-3 py-2 bg-port-accent/20 border-b border-port-panel flex items-center justify-between">
          <span class="text-port-text text-sm font-semibold flex items-center gap-1.5">
            <el-icon class="text-port-accent"><Ship /></el-icon>
            {{ vesselStore.getVesselById(selectedVesselId)!.name }}
          </span>
          <el-icon class="text-port-text-muted cursor-pointer hover:text-port-danger" @click="selectedVesselId = null">
            <Close />
          </el-icon>
        </div>
        <div class="p-3 space-y-2 text-xs">
          <div class="flex justify-between">
            <span class="text-port-text-muted">IMO编号</span>
            <span class="text-port-text font-mono">{{ vesselStore.getVesselById(selectedVesselId)!.imo }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-port-text-muted">船长 / 吃水</span>
            <span class="text-port-text">{{ vesselStore.getVesselById(selectedVesselId)!.length }}m / {{ vesselStore.getVesselById(selectedVesselId)!.draft }}m</span>
          </div>
          <div class="flex justify-between">
            <span class="text-port-text-muted">货类</span>
            <span class="text-port-text">{{ CARGO_TYPE_LABELS[vesselStore.getVesselById(selectedVesselId)!.cargoType] }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-port-text-muted">货物重量</span>
            <span class="text-port-text">{{ (vesselStore.getVesselById(selectedVesselId)!.cargoWeight / 10000).toFixed(1) }}万吨</span>
          </div>
          <div class="flex justify-between">
            <span class="text-port-text-muted">状态</span>
            <el-tag size="small" :type="vesselStore.getVesselById(selectedVesselId)!.status === 'anchorage' ? 'warning' : 'success'" effect="dark">
              {{ VESSEL_STATUS_LABELS[vesselStore.getVesselById(selectedVesselId)!.status] }}
            </el-tag>
          </div>
          <div class="flex justify-between">
            <span class="text-port-text-muted">ETA</span>
            <span class="text-port-text font-mono">{{ dayjs(vesselStore.getVesselById(selectedVesselId)!.eta).format('MM-DD HH:mm') }}</span>
          </div>
          <div v-if="vesselStore.getVesselById(selectedVesselId)!.progress" class="pt-1">
            <div class="flex justify-between mb-1">
              <span class="text-port-text-muted">装卸进度</span>
              <span class="text-port-success font-semibold">{{ vesselStore.getVesselById(selectedVesselId)!.progress }}%</span>
            </div>
            <el-progress :percentage="vesselStore.getVesselById(selectedVesselId)!.progress || 0" :stroke-width="6" :show-text="false" status="success" />
          </div>
        </div>
      </div>
    </div>

    <div class="px-4 py-2 border-t border-port-panel bg-port-card/60">
      <div class="flex items-center gap-3">
        <span class="text-xs text-port-text-muted whitespace-nowrap">
          {{ dayjs().add(Math.floor(simulationProgress / 60), 'hour').add(Math.floor(simulationProgress % 60), 'minute').format('MM-DD HH:mm') }}
        </span>
        <el-slider
          v-model="simulationProgress"
          :min="0"
          :max="totalSimulationMinutes"
          :step="30"
          class="flex-1"
          size="small"
        />
        <span class="text-xs text-port-text-muted whitespace-nowrap">
          {{ dayjs().add(totalSimulationMinutes / 60, 'hour').format('MM-DD HH:mm') }}
        </span>
      </div>
    </div>
  </div>
</template>
