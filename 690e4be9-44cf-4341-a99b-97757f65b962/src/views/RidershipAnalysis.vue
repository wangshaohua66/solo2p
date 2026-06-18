<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRidershipStore } from '@/stores/ridership'

const store = useRidershipStore()
const selectedLine = ref('1')

const cellSize = { width: 42, height: 36 }
const labelWidth = 80
const headerHeight = 28

function heatColor(value: number, max: number): string {
  const ratio = value / max
  if (ratio < 0.3) return '#DBEAFE'
  if (ratio < 0.5) return '#93C5FD'
  if (ratio < 0.7) return '#F59E0B'
  if (ratio < 0.85) return '#F97316'
  return '#EF4444'
}

const chartWidth = 800
const chartHeight = 260
const chartPadding = { top: 20, right: 30, bottom: 40, left: 50 }

const maxRidership = computed(() => Math.max(...store.hourlyData.map(d => Math.max(d.actual, d.planned))))

function lineX(hour: number): number {
  const innerWidth = chartWidth - chartPadding.left - chartPadding.right
  return chartPadding.left + ((hour - 6) / 16) * innerWidth
}

function lineY(value: number): number {
  const innerHeight = chartHeight - chartPadding.top - chartPadding.bottom
  return chartPadding.top + innerHeight - (value / maxRidership.value) * innerHeight
}

const actualPath = computed(() =>
  store.hourlyData.map((d, i) => `${i === 0 ? 'M' : 'L'}${lineX(d.hour)},${lineY(d.actual)}`).join(' ')
)

const plannedPath = computed(() =>
  store.hourlyData.map((d, i) => `${i === 0 ? 'M' : 'L'}${lineX(d.hour)},${lineY(d.planned)}`).join(' ')
)

const maxGap = computed(() => Math.max(...store.capacityGaps.map(g => g.gapValue)))
</script>

<template>
  <div class="flex flex-col h-full gap-4">
    <div class="flex items-center gap-4 bg-white p-4 rounded-lg shadow-sm">
      <span class="text-sm text-gray-500">线路选择</span>
      <el-select v-model="selectedLine" style="width: 140px">
        <el-option label="1路" value="1" />
        <el-option label="5路" value="5" />
        <el-option label="12路" value="12" />
      </el-select>
      <el-button size="small" @click="store.refreshHeatmap">刷新数据</el-button>
    </div>

    <div class="flex-1 grid grid-cols-2 gap-4 overflow-auto">
      <el-card shadow="never" class="flex flex-col">
        <template #header>
          <span class="text-sm font-semibold">OD热力图</span>
        </template>
        <div class="overflow-auto">
          <svg :width="labelWidth + store.hoursList.length * cellSize.width" :height="headerHeight + store.stopsList.length * cellSize.height">
            <g>
              <text
                v-for="(hour, hi) in store.hoursList"
                :key="'h' + hour"
                :x="labelWidth + hi * cellSize.width + cellSize.width / 2"
                :y="16"
                text-anchor="middle"
                fill="#6B7280"
                font-size="10"
                font-family="DIN Alternate, monospace"
              >{{ hour }}</text>
            </g>
            <g>
              <g v-for="(stop, si) in store.stopsList" :key="'s' + si">
                <text
                  :x="labelWidth - 6"
                  :y="headerHeight + si * cellSize.height + cellSize.height / 2 + 4"
                  text-anchor="end"
                  fill="#374151"
                  font-size="11"
                >{{ stop }}</text>
                <rect
                  v-for="(hour, hi) in store.hoursList"
                  :key="'c' + hi"
                  :x="labelWidth + hi * cellSize.width + 1"
                  :y="headerHeight + si * cellSize.height + 1"
                  :width="cellSize.width - 2"
                  :height="cellSize.height - 2"
                  :fill="heatColor(store.heatmapData.find(c => c.stopName === stop && c.hour === hour)?.value || 0, store.maxHeatValue)"
                  rx="3"
                />
                <text
                  v-for="(hour, hi) in store.hoursList"
                  :key="'v' + hi"
                  :x="labelWidth + hi * cellSize.width + cellSize.width / 2"
                  :y="headerHeight + si * cellSize.height + cellSize.height / 2 + 3"
                  text-anchor="middle"
                  fill="#374151"
                  font-size="9"
                  font-family="DIN Alternate, monospace"
                >{{ store.heatmapData.find(c => c.stopName === stop && c.hour === hour)?.value || '' }}</text>
              </g>
            </g>
          </svg>
        </div>
      </el-card>

      <el-card shadow="never" class="flex flex-col">
        <template #header>
          <span class="text-sm font-semibold">运力缺口排行</span>
        </template>
        <div class="flex-1 p-4 space-y-3">
          <div v-for="gap in store.capacityGaps" :key="gap.lineId" class="flex items-center gap-3">
            <span class="w-12 text-sm font-medium shrink-0">{{ gap.lineName }}</span>
            <div class="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden relative">
              <div
                class="h-full rounded-full transition-all"
                :style="{
                  width: (gap.gapValue / maxGap * 100) + '%',
                  background: gap.gapValue / maxGap > 0.6 ? '#EF4444' : gap.gapValue / maxGap > 0.3 ? '#F59E0B' : '#4A90D9',
                }"
              />
            </div>
            <span class="text-sm font-num w-14 text-right shrink-0" :style="{ color: gap.gapValue / maxGap > 0.6 ? '#EF4444' : '#374151' }">
              +{{ gap.gapValue }}
            </span>
          </div>
          <div class="mt-4 pt-4 border-t text-xs text-gray-400 space-y-1">
            <div>缺口 = 需求 - 现有运力</div>
            <div v-for="gap in store.capacityGaps" :key="'detail' + gap.lineId" class="flex justify-between">
              <span>{{ gap.lineName }}</span>
              <span class="font-num">{{ gap.demand }} - {{ gap.currentCapacity }} = {{ gap.gapValue }}</span>
            </div>
          </div>
        </div>
      </el-card>

      <el-card shadow="never" class="col-span-2">
        <template #header>
          <div class="flex items-center justify-between">
            <span class="text-sm font-semibold">时段对比折线图</span>
            <div class="flex items-center gap-4 text-xs">
              <span class="flex items-center gap-1"><span class="w-3 h-0.5 inline-block" style="background: #4A90D9"></span> 实际客流</span>
              <span class="flex items-center gap-1"><span class="w-3 h-0.5 inline-block" style="background: #94A3B8; opacity: 0.6"></span> 计划运力</span>
            </div>
          </div>
        </template>
        <svg :width="chartWidth" :height="chartHeight" class="w-full">
          <g>
            <line
              v-for="i in 5"
              :key="'gl' + i"
              :x1="chartPadding.left"
              :x2="chartWidth - chartPadding.right"
              :y1="chartPadding.top + (i - 1) * (chartHeight - chartPadding.top - chartPadding.bottom) / 4"
              :y2="chartPadding.top + (i - 1) * (chartHeight - chartPadding.top - chartPadding.bottom) / 4"
              stroke="#E5E7EB"
              stroke-dasharray="4,4"
            />
          </g>
          <g>
            <text
              v-for="i in 5"
              :key="'yl' + i"
              :x="chartPadding.left - 8"
              :y="chartPadding.top + (i - 1) * (chartHeight - chartPadding.top - chartPadding.bottom) / 4 + 4"
              text-anchor="end"
              fill="#9CA3AF"
              font-size="10"
              font-family="DIN Alternate, monospace"
            >{{ Math.round(maxRidership * (5 - i) / 4) }}</text>
          </g>
          <g>
            <text
              v-for="d in store.hourlyData"
              :key="'xl' + d.hour"
              :x="lineX(d.hour)"
              :y="chartHeight - 12"
              text-anchor="middle"
              fill="#9CA3AF"
              font-size="10"
              font-family="DIN Alternate, monospace"
            >{{ d.hour }}</text>
          </g>
          <path :d="plannedPath" fill="none" stroke="#94A3B8" stroke-width="2" stroke-dasharray="6,3" opacity="0.6" />
          <path :d="actualPath" fill="none" stroke="#4A90D9" stroke-width="2.5" />
          <circle
            v-for="d in store.hourlyData"
            :key="'p' + d.hour"
            :cx="lineX(d.hour)"
            :cy="lineY(d.actual)"
            r="3.5"
            fill="#4A90D9"
            stroke="white"
            stroke-width="2"
          />
        </svg>
      </el-card>
    </div>
  </div>
</template>
