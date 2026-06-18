<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'

interface MetricCard {
  label: string
  value: number
  unit: string
  change: number
  trend: 'up' | 'down'
}

const metrics = ref<MetricCard[]>([
  { label: '日客运量', value: 12580, unit: '人次', change: 5.2, trend: 'up' },
  { label: '准点率', value: 94.6, unit: '%', change: -1.3, trend: 'down' },
  { label: '里程利用率', value: 87.3, unit: '%', change: 2.1, trend: 'up' },
])

const trendData = {
  ridership: [11200, 11800, 12100, 11900, 12400, 12580],
  punctuality: [95.2, 94.8, 96.1, 93.5, 95.9, 94.6],
  utilization: [85.1, 86.3, 84.8, 87.2, 86.9, 87.3],
  labels: ['06-11', '06-12', '06-13', '06-14', '06-15', '06-16'],
}

const chartW = 320
const chartH = 100
const chartPad = { top: 10, right: 10, bottom: 20, left: 10 }

function miniPath(data: number[]): string {
  const min = Math.min(...data) * 0.95
  const max = Math.max(...data) * 1.05
  const range = max - min || 1
  const innerW = chartW - chartPad.left - chartPad.right
  const innerH = chartH - chartPad.top - chartPad.bottom
  return data.map((v, i) => {
    const x = chartPad.left + (i / (data.length - 1)) * innerW
    const y = chartPad.top + innerH - ((v - min) / range) * innerH
    return `${i === 0 ? 'M' : 'L'}${x},${y}`
  }).join(' ')
}

function miniAreaPath(data: number[]): string {
  const min = Math.min(...data) * 0.95
  const max = Math.max(...data) * 1.05
  const range = max - min || 1
  const innerW = chartW - chartPad.left - chartPad.right
  const innerH = chartH - chartPad.top - chartPad.bottom
  const line = data.map((v, i) => {
    const x = chartPad.left + (i / (data.length - 1)) * innerW
    const y = chartPad.top + innerH - ((v - min) / range) * innerH
    return `${i === 0 ? 'M' : 'L'}${x},${y}`
  }).join(' ')
  const lastX = chartPad.left + innerW
  const bottomY = chartPad.top + innerH
  return `${line} L${lastX},${bottomY} L${chartPad.left},${bottomY} Z`
}

const metricColors = ['#4A90D9', '#22C55E', '#FF6B35']
const metricDataKeys = ['ridership', 'punctuality', 'utilization'] as const

const reportData = [
  { line: '1路', trips: 120, ridership: 4200, punctuality: 96.2, avgLoad: 72 },
  { line: '5路', trips: 95, ridership: 3500, punctuality: 91.8, avgLoad: 85 },
  { line: '12路', trips: 72, ridership: 2100, punctuality: 94.5, avgLoad: 68 },
  { line: '8路', trips: 88, ridership: 2780, punctuality: 95.0, avgLoad: 75 },
]

function handleExport(type: 'pdf' | 'excel') {
  ElMessage.success(`${type === 'pdf' ? 'PDF' : 'Excel'} 导出功能已触发`)
}
</script>

<template>
  <div class="flex flex-col h-full gap-4">
    <div class="grid grid-cols-3 gap-4">
      <el-card
        v-for="(metric, idx) in metrics"
        :key="metric.label"
        shadow="never"
        class="relative overflow-hidden"
      >
        <div class="flex items-start justify-between">
          <div>
            <div class="text-sm text-gray-500 mb-1">{{ metric.label }}</div>
            <div class="flex items-baseline gap-1">
              <span class="text-3xl font-bold font-num" :style="{ color: metricColors[idx] }">
                {{ metric.value >= 1000 ? metric.value.toLocaleString() : metric.value }}
              </span>
              <span class="text-sm text-gray-400">{{ metric.unit }}</span>
            </div>
            <div class="flex items-center gap-1 mt-2 text-xs">
              <span v-if="metric.trend === 'up'" class="text-green-500">↑</span>
              <span v-else class="text-red-500">↓</span>
              <span :class="metric.trend === 'up' ? 'text-green-500' : 'text-red-500'">
                {{ Math.abs(metric.change) }}%
              </span>
              <span class="text-gray-400">较昨日</span>
            </div>
          </div>
          <svg :width="chartW / 2" :height="chartH / 2" class="opacity-60">
            <defs>
              <linearGradient :id="'area' + idx" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" :stop-color="metricColors[idx]" stop-opacity="0.3" />
                <stop offset="100%" :stop-color="metricColors[idx]" stop-opacity="0.05" />
              </linearGradient>
            </defs>
            <path :d="miniAreaPath(trendData[metricDataKeys[idx]])" :fill="`url(#area${idx})`" />
            <path :d="miniPath(trendData[metricDataKeys[idx]])" fill="none" :stroke="metricColors[idx]" stroke-width="2" />
          </svg>
        </div>
      </el-card>
    </div>

    <div class="flex-1 grid grid-cols-3 gap-4 overflow-auto">
      <el-card shadow="never" class="col-span-2">
        <template #header>
          <div class="flex items-center justify-between">
            <span class="text-sm font-semibold">各线路运营详情</span>
            <div class="flex gap-2">
              <el-button size="small" @click="handleExport('pdf')">导出 PDF</el-button>
              <el-button size="small" type="primary" @click="handleExport('excel')">导出 Excel</el-button>
            </div>
          </div>
        </template>
        <el-table :data="reportData" stripe size="small">
          <el-table-column prop="line" label="线路" width="80">
            <template #default="{ row }">
              <span class="font-medium">{{ row.line }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="trips" label="发车班次" width="100" align="center">
            <template #default="{ row }">
              <span class="font-num">{{ row.trips }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="ridership" label="客运量" width="120" align="center">
            <template #default="{ row }">
              <span class="font-num">{{ row.ridership.toLocaleString() }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="punctuality" label="准点率" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="row.punctuality >= 95 ? 'success' : row.punctuality >= 92 ? 'warning' : 'danger'" size="small">
                {{ row.punctuality }}%
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="avgLoad" label="平均满载率" min-width="140">
            <template #default="{ row }">
              <el-progress
                :percentage="row.avgLoad"
                :color="row.avgLoad >= 85 ? '#EF4444' : row.avgLoad >= 70 ? '#F59E0B' : '#22C55E'"
                :stroke-width="12"
                :text-inside="true"
              />
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <el-card shadow="never">
        <template #header>
          <span class="text-sm font-semibold">趋势概览</span>
        </template>
        <div class="space-y-4">
          <div v-for="(metric, idx) in metrics" :key="'trend' + idx">
            <div class="text-xs text-gray-500 mb-1">{{ metric.label }}</div>
            <svg :width="chartW" :height="chartH" class="w-full">
              <defs>
                <linearGradient :id="'fullArea' + idx" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" :stop-color="metricColors[idx]" stop-opacity="0.2" />
                  <stop offset="100%" :stop-color="metricColors[idx]" stop-opacity="0.02" />
                </linearGradient>
              </defs>
              <path :d="miniAreaPath(trendData[metricDataKeys[idx]])" :fill="`url(#fullArea${idx})`" />
              <path :d="miniPath(trendData[metricDataKeys[idx]])" fill="none" :stroke="metricColors[idx]" stroke-width="2" />
              <circle
                v-for="(v, vi) in trendData[metricDataKeys[idx]]"
                :key="vi"
                :cx="chartPad.left + (vi / (trendData[metricDataKeys[idx]].length - 1)) * (chartW - chartPad.left - chartPad.right)"
                :cy="chartPad.top + (chartH - chartPad.top - chartPad.bottom) - ((v - Math.min(...trendData[metricDataKeys[idx]]) * 0.95) / ((Math.max(...trendData[metricDataKeys[idx]]) * 1.05 - Math.min(...trendData[metricDataKeys[idx]]) * 0.95) || 1)) * (chartH - chartPad.top - chartPad.bottom)"
                r="2.5"
                :fill="metricColors[idx]"
                stroke="white"
                stroke-width="1.5"
              />
              <text
                v-for="(label, li) in trendData.labels"
                :key="'lb' + li"
                :x="chartPad.left + (li / (trendData.labels.length - 1)) * (chartW - chartPad.left - chartPad.right)"
                :y="chartH - 4"
                text-anchor="middle"
                fill="#9CA3AF"
                font-size="9"
                font-family="DIN Alternate, monospace"
              >{{ label }}</text>
            </svg>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>
