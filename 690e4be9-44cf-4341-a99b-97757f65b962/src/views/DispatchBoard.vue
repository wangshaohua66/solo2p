<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useDispatchStore } from '@/stores/dispatch'
import type { VehiclePosition } from '@/stores/dispatch'

const store = useDispatchStore()
const drawerVisible = ref(false)
const mapScale = ref(1)
const mapOffset = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const selectedVehicle = ref<VehiclePosition | null>(null)
const popoverVisible = ref<string | null>(null)

function getLoadColor(rate: number): string {
  if (rate >= 0.9) return '#EF4444'
  if (rate >= 0.7) return '#F59E0B'
  return '#22C55E'
}

function getLoadLabel(rate: number): string {
  if (rate >= 0.9) return '拥挤'
  if (rate >= 0.7) return '较满'
  return '宽松'
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  const delta = e.deltaY > 0 ? -0.1 : 0.1
  mapScale.value = Math.max(0.5, Math.min(3, mapScale.value + delta))
}

function onMapMouseDown(e: MouseEvent) {
  isDragging.value = true
  dragStart.value = { x: e.clientX - mapOffset.value.x, y: e.clientY - mapOffset.value.y }
}

function onMapMouseMove(e: MouseEvent) {
  if (!isDragging.value) return
  mapOffset.value = { x: e.clientX - dragStart.value.x, y: e.clientY - dragStart.value.y }
}

function onMapMouseUp() {
  isDragging.value = false
}

function showVehicleDetail(v: VehiclePosition) {
  selectedVehicle.value = v
  popoverVisible.value = v.id
}

function resetMap() {
  mapScale.value = 1
  mapOffset.value = { x: 0, y: 0 }
}

const mapTransform = computed(() =>
  `translate(${mapOffset.value.x}px, ${mapOffset.value.y}px) scale(${mapScale.value})`
)

let simulateTimer: ReturnType<typeof setInterval>
onMounted(() => {
  simulateTimer = setInterval(() => {
    store.vehicles.forEach(v => {
      if (v.status === 'running') {
        const dx = (Math.random() - 0.4) * 3
        const dy = (Math.random() - 0.4) * 2
        store.updateVehiclePosition(v.id, {
          x: Math.max(40, Math.min(920, v.x + dx)),
          y: Math.max(40, Math.min(520, v.y + dy)),
          loadRate: Math.max(0.1, Math.min(1.2, v.loadRate + (Math.random() - 0.5) * 0.05)),
        })
      }
    })
  }, 2000)
})

onUnmounted(() => clearInterval(simulateTimer))
</script>

<template>
  <div class="flex flex-col h-full gap-4">
    <div class="flex items-center gap-2 overflow-x-auto pb-1">
      <div
        v-for="line in store.lines"
        :key="line.id"
        class="shrink-0 px-4 py-2 rounded-full text-sm font-medium cursor-pointer transition-all border"
        :class="store.selectedLineId === line.id ? 'text-white shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'"
        :style="store.selectedLineId === line.id ? { background: line.color, borderColor: line.color } : {}"
        @click="store.selectLine(line.id)"
      >
        {{ line.name }}
      </div>
      <div class="ml-auto flex items-center gap-2 shrink-0">
        <el-button size="small" @click="resetMap">重置视图</el-button>
        <el-badge :value="store.alertCount" :max="99">
          <el-button size="small" type="warning" @click="drawerVisible = true">异常告警</el-button>
        </el-badge>
      </div>
    </div>

    <div class="flex-1 bg-white rounded-lg shadow-sm overflow-hidden relative" style="min-width: 960px">
      <div
        class="w-full h-full cursor-grab active:cursor-grabbing"
        @wheel="onWheel"
        @mousedown="onMapMouseDown"
        @mousemove="onMapMouseMove"
        @mouseup="onMapMouseUp"
        @mouseleave="onMapMouseUp"
      >
        <svg
          viewBox="0 0 960 540"
          class="w-full h-full"
          style="background: linear-gradient(135deg, #F0F4F8 0%, #E2E8F0 100%)"
        >
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#CBD5E1" stroke-width="0.5" opacity="0.5" />
            </pattern>
          </defs>
          <rect width="960" height="540" fill="url(#grid)" />

          <g :transform="mapTransform.replace('px', '').replace('px', '')">
            <g v-for="line in store.lines" :key="line.id" :opacity="store.selectedLineId === line.id ? 1 : 0.25">
              <path
                :d="line.path"
                fill="none"
                :stroke="line.color"
                stroke-width="4"
                stroke-linecap="round"
                opacity="0.6"
              />
              <circle
                v-for="(stop, i) in line.stops"
                :key="i"
                :cx="stop.x"
                :cy="stop.y"
                r="6"
                :fill="line.color"
                stroke="white"
                stroke-width="2"
              />
              <text
                v-for="(stop, i) in line.stops"
                :key="'t' + i"
                :x="stop.x"
                :y="stop.y - 14"
                text-anchor="middle"
                fill="#374151"
                font-size="11"
                font-family="PingFang SC, sans-serif"
              >{{ stop.name }}</text>
            </g>

            <g v-for="v in store.vehicles" :key="v.id" :opacity="store.selectedLineId === v.lineId ? 1 : 0.2" class="cursor-pointer" @click.stop="showVehicleDetail(v)">
              <el-popover
                :visible="popoverVisible === v.id"
                placement="top"
                :width="240"
                @update:visible="(val: boolean) => { if (!val) popoverVisible = null }"
              >
                <template #reference>
                  <g>
                    <circle :cx="v.x" :cy="v.y" r="14" :fill="getLoadColor(v.loadRate)" stroke="white" stroke-width="2.5" />
                    <polygon
                      :points="`${v.x},${v.y - 6} ${v.x + 5},${v.y + 3} ${v.x - 5},${v.y + 3}`"
                      fill="white"
                      :transform="`rotate(${v.angle}, ${v.x}, ${v.y})`"
                    />
                  </g>
                </template>
                <div class="text-sm">
                  <div class="font-semibold mb-2" style="color: var(--color-primary)">{{ v.plate }}</div>
                  <div class="flex justify-between mb-1">
                    <span class="text-gray-500">线路</span>
                    <span>{{ v.lineName }}</span>
                  </div>
                  <div class="flex justify-between mb-1">
                    <span class="text-gray-500">满载率</span>
                    <el-tag size="small" :type="v.loadRate >= 0.9 ? 'danger' : v.loadRate >= 0.7 ? 'warning' : 'success'">
                      {{ Math.round(v.loadRate * 100) }}% {{ getLoadLabel(v.loadRate) }}
                    </el-tag>
                  </div>
                  <div class="flex justify-between mb-1">
                    <span class="text-gray-500">速度</span>
                    <span class="font-num">{{ v.speed }} km/h</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">下一站</span>
                    <span>{{ v.nextStop }}</span>
                  </div>
                  <div class="mt-2 pt-2 border-t text-center">
                    <span class="text-gray-500 text-xs">到站预测</span>
                    <span class="ml-2 font-num text-lg font-bold" style="color: var(--color-info)">{{ v.etaMinutes }}</span>
                    <span class="text-xs text-gray-500">分钟</span>
                  </div>
                </div>
              </el-popover>
            </g>
          </g>
        </svg>
      </div>

      <div class="absolute bottom-3 right-3 flex flex-col gap-1">
        <el-button size="small" circle @click="mapScale = Math.min(3, mapScale + 0.2)">+</el-button>
        <el-button size="small" circle @click="mapScale = Math.max(0.5, mapScale - 0.2)">-</el-button>
      </div>
    </div>

    <div class="flex items-center gap-8 px-4 py-2 bg-white rounded-lg shadow-sm text-sm">
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-full bg-green-500"></span>
        <span class="text-gray-500">在线车辆</span>
        <span class="font-num font-bold" style="color: var(--color-primary)">{{ store.onlineCount }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-full" style="background: var(--color-accent)"></span>
        <span class="text-gray-500">异常数</span>
        <span class="font-num font-bold" style="color: var(--color-accent)">{{ store.alertCount }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-full" style="background: var(--color-info)"></span>
        <span class="text-gray-500">调度指令</span>
        <span class="font-num font-bold" style="color: var(--color-info)">{{ store.dispatchCount }}</span>
      </div>
      <div class="ml-auto flex items-center gap-4 text-gray-400 text-xs">
        <span>满载率: 🟢 &lt;70%</span>
        <span>🟡 70-90%</span>
        <span>🔴 &gt;90%</span>
      </div>
    </div>

    <el-drawer v-model="drawerVisible" title="异常告警" direction="rtl" size="380px">
      <div class="p-4 space-y-3">
        <div
          v-for="alert in store.unconfirmedAlerts"
          :key="alert.id"
          class="p-3 rounded-lg border-l-4"
          style="background: #FFF7ED; border-color: var(--color-accent)"
        >
          <div class="flex items-center justify-between mb-1">
            <el-tag size="small" type="warning">{{ alert.lineName }}</el-tag>
            <span class="text-xs text-gray-400">{{ alert.time }}</span>
          </div>
          <p class="text-sm text-gray-700 mb-2">{{ alert.reason }}</p>
          <div class="flex items-center justify-between">
            <span class="text-xs" style="color: var(--color-info)">💡 {{ alert.suggestion }}</span>
            <el-button size="small" type="primary" @click="store.confirmAlert(alert.id)">确认下发</el-button>
          </div>
        </div>
        <div v-if="store.unconfirmedAlerts.length === 0" class="text-center text-gray-400 py-8">
          暂无未处理告警
        </div>
      </div>
    </el-drawer>
  </div>
</template>
