<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between bg-port-card rounded-xl p-4 border border-port-card-border">
      <div class="flex items-center gap-2">
        <el-icon :size="22" color="#2979ff"><DataAnalysis /></el-icon>
        <h2 class="text-lg font-semibold text-white">吞吐量深度分析</h2>
      </div>
      <div class="flex items-center gap-3">
        <el-radio-group v-model="granularity" size="default" @change="updateCharts">
          <el-radio-button value="day">日</el-radio-button>
          <el-radio-button value="week">周</el-radio-button>
          <el-radio-button value="month">月</el-radio-button>
        </el-radio-group>
        <el-select v-model="selectedPortId" placeholder="全部港口" size="default" style="width: 160px" clearable @change="updateCharts">
          <el-option v-for="p in ports" :key="p.id" :label="p.name" :value="p.id" />
        </el-select>
      </div>
    </div>

    <div class="grid grid-cols-4 gap-4">
      <div class="stat-card rounded-xl p-5 flex items-center gap-4">
        <div class="w-14 h-14 rounded-xl flex items-center justify-center bg-gradient-to-br from-port-accent/30 to-port-accent/5">
          <el-icon :size="28" color="#2979ff"><TrendCharts /></el-icon>
        </div>
        <div class="flex-1">
          <div class="text-gray-400 text-sm">本期总吞吐量</div>
          <div class="text-white text-2xl font-bold mt-1">{{ formatWeight(totalThroughput) }}</div>
          <div class="flex items-center gap-1 mt-1 text-xs" :class="yoyChange >= 0 ? 'text-port-success' : 'text-port-danger'">
            <el-icon><component :is="yoyChange >= 0 ? 'Top' : 'Bottom'" /></el-icon>
            <span>同比 {{ Math.abs(yoyChange).toFixed(1) }}%</span>
          </div>
        </div>
      </div>
      <div class="stat-card rounded-xl p-5 flex items-center gap-4">
        <div class="w-14 h-14 rounded-xl flex items-center justify-center bg-gradient-to-br from-port-success/30 to-port-success/5">
          <el-icon :size="28" color="#00c853"><CircleCheck /></el-icon>
        </div>
        <div class="flex-1">
          <div class="text-gray-400 text-sm">环比增长</div>
          <div class="text-white text-2xl font-bold mt-1" :class="momChange >= 0 ? 'text-port-success' : 'text-port-danger'">
            {{ momChange >= 0 ? '+' : '' }}{{ momChange.toFixed(1) }}%
          </div>
          <div class="text-gray-500 text-xs mt-1">较上一周期</div>
        </div>
      </div>
      <div class="stat-card rounded-xl p-5 flex items-center gap-4">
        <div class="w-14 h-14 rounded-xl flex items-center justify-center bg-gradient-to-br from-port-warning/30 to-port-warning/5">
          <el-icon :size="28" color="#ff8c00"><Ship /></el-icon>
        </div>
        <div class="flex-1">
          <div class="text-gray-400 text-sm">作业船舶数</div>
          <div class="text-white text-2xl font-bold mt-1">{{ totalVessels }}</div>
          <div class="text-gray-500 text-xs mt-1">艘次</div>
        </div>
      </div>
      <div class="stat-card rounded-xl p-5 flex items-center gap-4">
        <div class="w-14 h-14 rounded-xl flex items-center justify-center bg-gradient-to-br from-purple-500/30 to-purple-500/5">
          <el-icon :size="28" color="#a855f7"><Histogram /></el-icon>
        </div>
        <div class="flex-1">
          <div class="text-gray-400 text-sm">平均泊位利用率</div>
          <div class="text-white text-2xl font-bold mt-1">{{ averageUtilization }}%</div>
          <el-progress :percentage="averageUtilization" :stroke-width="4" :show-text="false" class="mt-2"
            :color="averageUtilization > 80 ? '#ff8c00' : '#00c853'" />
        </div>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-4">
      <div class="col-span-2 bg-port-card rounded-xl p-5 border border-port-card-border">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <el-icon :size="18" color="#2979ff"><TrendCharts /></el-icon>
            <h3 class="text-base font-medium text-white">吞吐量趋势（堆叠柱状 + 折线）</h3>
          </div>
          <div class="flex items-center gap-3 text-xs">
            <span class="flex items-center gap-1">
              <span class="w-3 h-3 rounded-sm bg-port-accent"></span>
              <span class="text-gray-400">集装箱</span>
            </span>
            <span class="flex items-center gap-1">
              <span class="w-3 h-3 rounded-sm bg-port-success"></span>
              <span class="text-gray-400">散货</span>
            </span>
            <span class="flex items-center gap-1">
              <span class="w-3 h-3 rounded-sm bg-port-warning"></span>
              <span class="text-gray-400">液体散货</span>
            </span>
            <span class="flex items-center gap-1">
              <span class="w-3 h-3 rounded-sm bg-purple-500"></span>
              <span class="text-gray-400">件杂货</span>
            </span>
            <span class="flex items-center gap-1">
              <span class="w-3 h-3 rounded-sm bg-cyan-400"></span>
              <span class="text-gray-400">滚装</span>
            </span>
            <span class="flex items-center gap-1 ml-3">
              <span class="w-4 h-0.5 bg-white"></span>
              <span class="text-gray-400">同比曲线</span>
            </span>
          </div>
        </div>
        <div ref="trendChartRef" style="width: 100%; height: 360px;"></div>
      </div>

      <div class="bg-port-card rounded-xl p-5 border border-port-card-border">
        <div class="flex items-center gap-2 mb-4">
          <el-icon :size="18" color="#2979ff"><PieChart /></el-icon>
          <h3 class="text-base font-medium text-white">货类结构占比</h3>
        </div>
        <div ref="pieChartRef" style="width: 100%; height: 360px;"></div>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-4">
      <div class="bg-port-card rounded-xl p-5 border border-port-card-border">
        <div class="flex items-center gap-2 mb-4">
          <el-icon :size="18" color="#2979ff"><Rank /></el-icon>
          <h3 class="text-base font-medium text-white">港口吞吐量排名</h3>
        </div>
        <div ref="barChartRef" style="width: 100%; height: 320px;"></div>
      </div>

      <div class="bg-port-card rounded-xl p-5 border border-port-card-border">
        <div class="flex items-center gap-2 mb-4">
          <el-icon :size="18" color="#2979ff"><Odometer /></el-icon>
          <h3 class="text-base font-medium text-white">泊位利用率分布</h3>
        </div>
        <div ref="utilizationChartRef" style="width: 100%; height: 320px;"></div>
      </div>

      <div class="bg-port-card rounded-xl p-5 border border-port-card-border">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <el-icon :size="18" color="#2979ff"><Cpu /></el-icon>
            <h3 class="text-base font-medium text-white">作业效率指标</h3>
          </div>
        </div>
        <div class="space-y-4 mt-4">
          <div v-for="(metric, idx) in efficiencyMetrics" :key="idx" class="p-3 rounded-lg bg-port-panel/50">
            <div class="flex justify-between items-center mb-2">
              <span class="text-gray-300 text-sm">{{ metric.label }}</span>
              <span class="text-white font-semibold">{{ metric.value }}<span class="text-xs text-gray-400 ml-1">{{ metric.unit }}</span></span>
            </div>
            <el-progress :percentage="metric.percent" :stroke-width="6" :show-text="false" :color="metric.color" />
            <div class="flex justify-between mt-1 text-xs text-gray-500">
              <span>目标: {{ metric.target }}{{ metric.unit }}</span>
              <span :class="metric.percent >= 90 ? 'text-port-success' : metric.percent >= 70 ? 'text-port-warning' : 'text-port-danger'">
                达成率 {{ metric.percent }}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import dayjs from 'dayjs'
import * as echarts from 'echarts'
import type { ECharts } from 'echarts'
import {
  DataAnalysis, TrendCharts, CircleCheck, Ship, Histogram, PieChart, Rank, Odometer, Cpu, Top, Bottom
} from '@element-plus/icons-vue'
import { useScheduleStore } from '@/stores/schedule'
import { useVesselStore } from '@/stores/vessel'
import { CARGO_TYPE_LABELS } from '@/types'
import type { CargoType } from '@/types'

const scheduleStore = useScheduleStore()
const vesselStore = useVesselStore()
const { throughputStats, berths, schedules, averageUtilization } = scheduleStore
const { ports } = vesselStore

const granularity = ref('month')
const selectedPortId = ref<string | ''>('')

const trendChartRef = ref<HTMLElement>()
const pieChartRef = ref<HTMLElement>()
const barChartRef = ref<HTMLElement>()
const utilizationChartRef = ref<HTMLElement>()

let trendChart: ECharts | null = null
let pieChart: ECharts | null = null
let barChart: ECharts | null = null
let utilizationChart: ECharts | null = null

const CARGO_COLORS: Record<CargoType, string> = {
  container: '#2979ff',
  bulk: '#00c853',
  liquid: '#ff8c00',
  general: '#a855f7',
  'ro-ro': '#22d3ee'
}

const filteredStats = computed(() => {
  return throughputStats.filter(s => !selectedPortId.value || s.portId === selectedPortId.value)
})

const totalThroughput = computed(() => filteredStats.value.reduce((s, t) => s + t.weight, 0))
const totalVessels = computed(() => schedules.filter(s => s.status !== 'conflict').length)

const yoyChange = computed(() => {
  const current = totalThroughput.value
  const base = current * 0.88 + Math.random() * current * 0.2
  return ((current - base) / base) * 100
})

const momChange = computed(() => (Math.random() - 0.3) * 20)

const efficiencyMetrics = computed(() => [
  { label: '单机装卸效率', value: 32.5, target: 35, unit: '箱/小时', percent: 93, color: '#00c853' },
  { label: '船舶在港停时', value: 18.6, target: 20, unit: '小时', percent: 93, color: '#00c853' },
  { label: '泊位周转率', value: 2.8, target: 3, unit: '次/天', percent: 93, color: '#00c853' },
  { label: '集卡周转效率', value: 42, target: 50, unit: '箱/车·天', percent: 84, color: '#ff8c00' },
  { label: '计划兑现率', value: 89, target: 95, unit: '%', percent: 94, color: '#00c853' }
])

function formatWeight(tons: number) {
  if (tons >= 100000000) return (tons / 100000000).toFixed(2) + ' 亿吨'
  if (tons >= 10000) return (tons / 10000).toFixed(1) + ' 万吨'
  return tons.toLocaleString() + ' 吨'
}

function aggregateByPeriod() {
  const periods: string[] = []
  const cargoData: Record<CargoType, number[]> = {
    container: [], bulk: [], liquid: [], general: [], 'ro-ro': []
  }
  const yoyData: number[] = []

  if (granularity.value === 'month') {
    for (let m = 0; m < 12; m++) {
      const key = `2024-${String(m + 1).padStart(2, '0')}`
      periods.push(`${m + 1}月`)
      const monthStats = filteredStats.value.filter(s => s.date.startsWith(key))
      const cargoTypes: CargoType[] = ['container', 'bulk', 'liquid', 'general', 'ro-ro']
      for (const c of cargoTypes) {
        const sum = monthStats.filter(s => s.cargoType === c).reduce((s, t) => s + t.weight, 0)
        cargoData[c].push(Math.round(sum / 10000))
      }
      yoyData.push(Math.round(80 + Math.random() * 35))
    }
  } else if (granularity.value === 'week') {
    for (let w = 0; w < 12; w++) {
      periods.push(`第${w + 1}周`)
      const cargoTypes: CargoType[] = ['container', 'bulk', 'liquid', 'general', 'ro-ro']
      for (const c of cargoTypes) {
        cargoData[c].push(Math.round(30 + Math.random() * 80))
      }
      yoyData.push(Math.round(75 + Math.random() * 40))
    }
  } else {
    const today = dayjs()
    for (let d = 29; d >= 0; d--) {
      const date = today.subtract(d, 'day')
      periods.push(date.format('MM/DD'))
      const cargoTypes: CargoType[] = ['container', 'bulk', 'liquid', 'general', 'ro-ro']
      for (const c of cargoTypes) {
        cargoData[c].push(Math.round(5 + Math.random() * 25))
      }
      yoyData.push(Math.round(70 + Math.random() * 50))
    }
  }

  return { periods, cargoData, yoyData }
}

function initTrendChart() {
  if (!trendChartRef.value) return
  trendChart = echarts.init(trendChartRef.value)
  updateTrendChart()
}

function updateTrendChart() {
  if (!trendChart) return
  const { periods, cargoData, yoyData } = aggregateByPeriod()
  const cargoTypes: CargoType[] = ['container', 'bulk', 'liquid', 'general', 'ro-ro']

  trendChart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(21, 34, 56, 0.95)', borderColor: '#2a3f5f', textStyle: { color: '#fff' } },
    legend: { show: false },
    grid: { left: 50, right: 60, top: 20, bottom: 30 },
    xAxis: {
      type: 'category',
      data: periods,
      axisLine: { lineStyle: { color: '#2a3f5f' } },
      axisLabel: { color: '#9ca3af' }
    },
    yAxis: [
      {
        type: 'value',
        name: '万吨',
        nameTextStyle: { color: '#9ca3af' },
        axisLine: { show: false },
        axisLabel: { color: '#9ca3af' },
        splitLine: { lineStyle: { color: '#2a3f5f', type: 'dashed' } }
      },
      {
        type: 'value',
        name: '同比%',
        nameTextStyle: { color: '#9ca3af' },
        axisLine: { show: false },
        axisLabel: { color: '#9ca3af', formatter: '{value}%' },
        splitLine: { show: false }
      }
    ],
    series: [
      ...cargoTypes.map(c => ({
        name: CARGO_TYPE_LABELS[c],
        type: 'bar' as const,
        stack: 'total',
        barWidth: periods.length > 20 ? '40%' : '55%',
        itemStyle: { color: CARGO_COLORS[c], borderRadius: c === 'ro-ro' ? [4, 4, 0, 0] : [0, 0, 0, 0] },
        emphasis: { focus: 'series' as const },
        data: cargoData[c]
      })),
      {
        name: '同比',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: '#ffffff', width: 2 },
        itemStyle: { color: '#ffffff', borderColor: '#2979ff', borderWidth: 2 },
        data: yoyData
      }
    ]
  })
}

function initPieChart() {
  if (!pieChartRef.value) return
  pieChart = echarts.init(pieChartRef.value)
  updatePieChart()
}

function updatePieChart() {
  if (!pieChart) return
  const cargoTypes: CargoType[] = ['container', 'bulk', 'liquid', 'general', 'ro-ro']
  const data = cargoTypes.map(c => ({
    name: CARGO_TYPE_LABELS[c],
    value: filteredStats.value.filter(s => s.cargoType === c).reduce((s, t) => s + t.weight, 0)
  }))

  pieChart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', backgroundColor: 'rgba(21, 34, 56, 0.95)', borderColor: '#2a3f5f', textStyle: { color: '#fff' },
      formatter: (p: any) => `${p.name}: ${formatWeight(p.value)} (${p.percent}%)`
    },
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: { borderColor: '#152238', borderWidth: 3 },
      label: { color: '#e5e7eb', formatter: '{b}\n{d}%', fontSize: 11 },
      labelLine: { lineStyle: { color: '#2a3f5f' } },
      data: data.map((d, i) => ({ ...d, itemStyle: { color: CARGO_COLORS[cargoTypes[i]] } }))
    }]
  })
}

function initBarChart() {
  if (!barChartRef.value) return
  barChart = echarts.init(barChartRef.value)
  updateBarChart()
}

function updateBarChart() {
  if (!barChart) return
  const portData = ports.map(p => {
    const portThroughput = throughputStats.filter(s => s.portId === p.id).reduce((s, t) => s + t.weight, 0)
    return { name: p.name, value: Math.round(portThroughput / 10000) }
  }).sort((a, b) => a.value - b.value)

  barChart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(21, 34, 56, 0.95)', borderColor: '#2a3f5f', textStyle: { color: '#fff' },
      formatter: (p: any) => `${p[0].name}: ${p[0].value} 万吨`, axisPointer: { type: 'shadow' }
    },
    grid: { left: 90, right: 30, top: 10, bottom: 20 },
    xAxis: {
      type: 'value',
      name: '万吨',
      nameTextStyle: { color: '#9ca3af' },
      axisLine: { show: false },
      axisLabel: { color: '#9ca3af' },
      splitLine: { lineStyle: { color: '#2a3f5f', type: 'dashed' } }
    },
    yAxis: {
      type: 'category',
      data: portData.map(p => p.name),
      axisLine: { lineStyle: { color: '#2a3f5f' } },
      axisLabel: { color: '#e5e7eb' }
    },
    series: [{
      type: 'bar',
      data: portData.map((p, i) => ({
        value: p.value,
        itemStyle: {
          borderRadius: [0, 6, 6, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#2979ff' },
            { offset: 1, color: i === portData.length - 1 ? '#00c853' : '#1e40af' }
          ])
        }
      })),
      barWidth: '55%',
      label: { show: true, position: 'right', color: '#fff', formatter: '{c} 万' }
    }]
  })
}

function initUtilizationChart() {
  if (!utilizationChartRef.value) return
  utilizationChart = echarts.init(utilizationChartRef.value)
  updateUtilizationChart()
}

function updateUtilizationChart() {
  if (!utilizationChart) return
  const utilizationBuckets = [
    { name: '< 50%', min: 0, max: 50, color: '#ef4444' },
    { name: '50-70%', min: 50, max: 70, color: '#ff8c00' },
    { name: '70-85%', min: 70, max: 85, color: '#eab308' },
    { name: '85-95%', min: 85, max: 95, color: '#00c853' },
    { name: '> 95%', min: 95, max: 100, color: '#2979ff' }
  ]

  const portBerths = selectedPortId.value ? berths.filter(b => b.portId === selectedPortId.value) : berths
  const counts = utilizationBuckets.map(() => 0)
  for (let i = 0; i < portBerths.length; i++) {
    const util = 50 + Math.random() * 50
    const idx = utilizationBuckets.findIndex(b => util >= b.min && util < b.max)
    counts[idx >= 0 ? idx : utilizationBuckets.length - 1]++
  }

  utilizationChart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', backgroundColor: 'rgba(21, 34, 56, 0.95)', borderColor: '#2a3f5f', textStyle: { color: '#fff' } },
    series: [{
      type: 'pie',
      radius: ['40%', '72%'],
      center: ['50%', '52%'],
      roseType: 'radius',
      itemStyle: { borderRadius: 6, borderColor: '#152238', borderWidth: 2 },
      label: { color: '#e5e7eb', formatter: '{b}: {c}个', fontSize: 11 },
      labelLine: { lineStyle: { color: '#2a3f5f' } },
      data: utilizationBuckets.map((b, i) => ({
        name: b.name,
        value: counts[i],
        itemStyle: { color: b.color }
      }))
    }],
    graphic: [{
      type: 'text',
      left: 'center',
      top: '42%',
      style: { text: portBerths.length + '', fontSize: 28, fill: '#fff', fontWeight: 'bold' }
    }, {
      type: 'text',
      left: 'center',
      top: '55%',
      style: { text: '泊位总数', fontSize: 12, fill: '#9ca3af' }
    }]
  })
}

function updateCharts() {
  updateTrendChart()
  updatePieChart()
  updateBarChart()
  updateUtilizationChart()
}

let resizeObserver: ResizeObserver | null = null

onMounted(async () => {
  await nextTick()
  initTrendChart()
  initPieChart()
  initBarChart()
  initUtilizationChart()

  resizeObserver = new ResizeObserver(() => {
    trendChart?.resize()
    pieChart?.resize()
    barChart?.resize()
    utilizationChart?.resize()
  })
  const container = document.querySelector('.app-main-content')
  if (container) resizeObserver.observe(container)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  trendChart?.dispose()
  pieChart?.dispose()
  barChart?.dispose()
  utilizationChart?.dispose()
})
</script>
