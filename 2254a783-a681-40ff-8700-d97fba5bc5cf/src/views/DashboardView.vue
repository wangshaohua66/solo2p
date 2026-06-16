<script setup lang="ts">
import { computed, ref, onMounted, shallowRef, watch, nextTick } from 'vue'
import { useScheduleStore } from '@/stores/schedule'
import { useVesselStore } from '@/stores/vessel'
import { VESSEL_STATUS_LABELS, CARGO_TYPE_LABELS, type Vessel } from '@/types'
import dayjs from 'dayjs'
import * as echarts from 'echarts'
import TideTimeline from '@/components/TideTimeline.vue'
import BerthGantt from '@/components/BerthGantt.vue'

const scheduleStore = useScheduleStore()
const vesselStore = useVesselStore()

const stats = computed(() => [
  {
    label: '今日吞吐量',
    value: (scheduleStore.todayThroughput / 10000).toFixed(1),
    unit: '万吨',
    icon: 'DataLine',
    color: 'from-port-accent to-blue-600',
    trend: '+8.2%',
    trendUp: true
  },
  {
    label: '本月吞吐量',
    value: (scheduleStore.monthlyThroughput / 10000).toFixed(0),
    unit: '万吨',
    icon: 'Histogram',
    color: 'from-port-success to-green-600',
    trend: '+12.5%',
    trendUp: true
  },
  {
    label: '泊位利用率',
    value: scheduleStore.averageUtilization,
    unit: '%',
    icon: 'PieChart',
    color: 'from-port-warning to-orange-600',
    trend: '-3.1%',
    trendUp: false
  },
  {
    label: '待泊船舶',
    value: vesselStore.anchorageCount,
    unit: '艘',
    icon: 'Anchor',
    color: 'from-purple-500 to-pink-600',
    trend: '+2',
    trendUp: false
  }
])

const vesselList = computed(() => {
  return vesselStore.activeVessels
    .filter(v => ['anchorage', 'entering', 'berthed', 'loading', 'unloading', 'leaving'].includes(v.status))
    .slice(0, 20)
})

const selectedVessel = ref<Vessel | null>(null)

const throughputChartRef = ref<HTMLDivElement | null>(null)
const utilizationChartRef = ref<HTMLDivElement | null>(null)
const throughputChart = shallowRef<echarts.ECharts | null>(null)
const utilizationChart = shallowRef<echarts.ECharts | null>(null)

function initThroughputChart() {
  if (!throughputChartRef.value) return
  throughputChart.value = echarts.init(throughputChartRef.value)

  const months = []
  for (let i = 5; i >= 0; i--) {
    months.push(dayjs().subtract(i, 'month').format('MM月'))
  }

  const cargoData: Record<string, number[]> = {
    '集装箱': [],
    '散货': [],
    '液体散货': [],
    '件杂货': [],
    '滚装': []
  }

  for (let i = 5; i >= 0; i--) {
    const monthKey = dayjs().subtract(i, 'month').format('YYYY-MM')
    const monthData = scheduleStore.throughputStats.filter(s => s.date === monthKey)
    for (const type of Object.keys(cargoData)) {
      const labelMap: Record<string, string> = { '集装箱': 'container', '散货': 'bulk', '液体散货': 'liquid', '件杂货': 'general', '滚装': 'ro-ro' }
      cargoData[type].push(Math.round(
        monthData.filter(s => s.cargoType === labelMap[type]).reduce((sum, s) => sum + s.weight, 0) / 10000
      ))
    }
  }

  const colors = ['#2979ff', '#00c853', '#ff8c00', '#aa00ff', '#00bcd4']
  const series = Object.keys(cargoData).map((name, i) => ({
    name,
    type: 'bar',
    stack: 'total',
    emphasis: { focus: 'series' },
    itemStyle: { color: colors[i], borderRadius: [0, 0, 0, 0] },
    data: cargoData[name]
  }))

  throughputChart.value.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(21, 34, 56, 0.95)',
      borderColor: '#2979ff',
      textStyle: { color: '#e8eaf6' },
      axisPointer: { type: 'shadow' }
    },
    legend: {
      data: Object.keys(cargoData),
      textStyle: { color: '#90a4ae', fontSize: 10 },
      top: 0,
      right: 0,
      itemWidth: 10,
      itemHeight: 8
    },
    grid: { left: 40, right: 10, top: 30, bottom: 24 },
    xAxis: {
      type: 'category',
      data: months,
      axisLine: { lineStyle: { color: '#1e3a5f' } },
      axisLabel: { color: '#90a4ae', fontSize: 10 }
    },
    yAxis: {
      type: 'value',
      name: '万吨',
      nameTextStyle: { color: '#90a4ae', fontSize: 10 },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#1e3a5f', type: 'dashed' } },
      axisLabel: { color: '#90a4ae', fontSize: 10 }
    },
    series
  })
}

function initUtilizationChart() {
  if (!utilizationChartRef.value) return
  utilizationChart.value = echarts.init(utilizationChartRef.value)

  const berthIds = scheduleStore.berths.slice(0, 12).map(b => b.name.replace(/^.+?(?=\d)/, ''))
  const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}`)

  const data: [number, number, number][] = []
  const recentData = scheduleStore.utilizationData.filter(u =>
    u.date === dayjs().format('YYYY-MM-DD')
  )

  for (let bi = 0; bi < 12; bi++) {
    const berth = scheduleStore.berths[bi]
    for (let h = 0; h < 24; h++) {
      const entry = recentData.find(u => u.berthId === berth?.id && u.hour === h)
      data.push([h, bi, entry?.occupied ? Math.random() * 50 + 50 : Math.random() * 30])
    }
  }

  utilizationChart.value.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      position: 'top',
      backgroundColor: 'rgba(21, 34, 56, 0.95)',
      borderColor: '#2979ff',
      textStyle: { color: '#e8eaf6', fontSize: 11 },
      formatter: (p: any) => `${berthIds[p.data[1]]} ${hours[p.data[0]]}:00<br/>利用率: ${p.data[2].toFixed(0)}%`
    },
    grid: { left: 80, right: 20, top: 10, bottom: 30 },
    xAxis: {
      type: 'category',
      data: hours,
      splitArea: { show: true, areaStyle: { color: ['rgba(30,58,95,0.3)', 'transparent'] } },
      axisLabel: { color: '#90a4ae', fontSize: 9, interval: 2 },
      axisLine: { lineStyle: { color: '#1e3a5f' } }
    },
    yAxis: {
      type: 'category',
      data: berthIds,
      splitArea: { show: true, areaStyle: { color: ['rgba(30,58,95,0.2)', 'transparent'] } },
      axisLabel: { color: '#90a4ae', fontSize: 10 },
      axisLine: { lineStyle: { color: '#1e3a5f' } }
    },
    visualMap: {
      min: 0,
      max: 100,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      inRange: {
        color: ['#152238', '#1e3a5f', '#2979ff', '#00c853', '#ff8c00']
      },
      textStyle: { color: '#90a4ae', fontSize: 9 }
    },
    series: [{
      name: '利用率',
      type: 'heatmap',
      data,
      label: { show: false },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' } },
      itemStyle: { borderColor: '#0a1628', borderWidth: 1 }
    }]
  })
}

function vesselStatusTag(status: string) {
  switch (status) {
    case 'anchorage': return 'warning'
    case 'entering':
    case 'leaving': return 'primary'
    case 'berthed':
    case 'loading':
    case 'unloading': return 'success'
    default: return 'info'
  }
}

function handleResize() {
  throughputChart.value?.resize()
  utilizationChart.value?.resize()
}

watch([() => vesselStore.selectedPortId], () => {
  nextTick(() => {
    initThroughputChart()
    initUtilizationChart()
  })
})

onMounted(() => {
  nextTick(() => {
    initThroughputChart()
    initUtilizationChart()
  })
  window.addEventListener('resize', handleResize)
})
</script>

<template>
  <div class="w-full h-full flex flex-col gap-3">
    <div class="grid grid-cols-4 gap-3 flex-shrink-0">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="stat-card rounded-lg p-4"
      >
        <div class="flex items-start justify-between">
          <div>
            <div class="text-port-text-muted text-xs mb-2">{{ stat.label }}</div>
            <div class="flex items-baseline gap-1">
              <span class="text-port-text text-2xl font-bold">{{ stat.value }}</span>
              <span class="text-port-text-muted text-xs">{{ stat.unit }}</span>
            </div>
          </div>
          <div :class="['w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center shadow-lg', stat.color]">
            <el-icon :size="20" class="text-white"><component :is="stat.icon" /></el-icon>
          </div>
        </div>
        <div class="mt-3 flex items-center gap-1">
          <el-icon :size="12" :class="stat.trendUp ? 'text-port-success' : 'text-port-warning'">
            <component :is="stat.trendUp ? 'CaretTop' : 'CaretBottom'" />
          </el-icon>
          <span :class="['text-xs font-medium', stat.trendUp ? 'text-port-success' : 'text-port-warning']">
            {{ stat.trend }}
          </span>
          <span class="text-port-text-muted text-[10px] ml-1">较上周</span>
        </div>
      </div>
    </div>

    <div class="flex-1 min-h-0 grid grid-cols-12 gap-3">
      <div class="col-span-3 flex flex-col gap-3 min-h-0">
        <div class="flex-1 min-h-0 bg-port-card/40 rounded-lg border border-port-panel p-3">
          <TideTimeline :height="200" />
        </div>
        <div class="flex-1 min-h-0 bg-port-card/40 rounded-lg border border-port-panel p-3 flex flex-col">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-port-text text-sm font-semibold flex items-center gap-2">
              <el-icon class="text-port-warning"><PieChart /></el-icon>
              泊位利用率热力图
            </h3>
          </div>
          <div ref="utilizationChartRef" class="flex-1 min-h-0 w-full" />
        </div>
      </div>

      <div class="col-span-6 min-h-0 flex flex-col">
        <BerthGantt :compact="true" :days="3" />
      </div>

      <div class="col-span-3 flex flex-col gap-3 min-h-0">
        <div class="flex-1 min-h-0 bg-port-card/40 rounded-lg border border-port-panel p-3 flex flex-col">
          <div class="flex items-center justify-between mb-2 flex-shrink-0">
            <h3 class="text-port-text text-sm font-semibold flex items-center gap-2">
              <el-icon class="text-port-accent"><List /></el-icon>
              船舶动态
            </h3>
            <el-tag size="small" type="info" effect="plain">{{ vesselList.length }}艘</el-tag>
          </div>
          <div class="flex-1 overflow-y-auto space-y-1.5 pr-1">
            <div
              v-for="v in vesselList"
              :key="v.id"
              :class="[
                'p-2.5 rounded-lg border cursor-pointer transition-all',
                selectedVessel?.id === v.id
                  ? 'bg-port-accent/20 border-port-accent/50'
                  : 'bg-port-card/60 border-port-panel hover:border-port-accent/30 hover:bg-port-card/80'
              ]"
              @click="selectedVessel = v"
            >
              <div class="flex items-center justify-between mb-1">
                <span class="text-port-text text-xs font-semibold truncate max-w-[60%]">{{ v.name }}</span>
                <el-tag size="small" :type="vesselStatusTag(v.status)" effect="dark" class="!text-[10px] !h-4 !px-1">
                  {{ VESSEL_STATUS_LABELS[v.status] }}
                </el-tag>
              </div>
              <div class="flex items-center justify-between text-[10px] text-port-text-muted mb-1.5">
                <span>IMO {{ v.imo }}</span>
                <span>{{ CARGO_TYPE_LABELS[v.cargoType] }}</span>
              </div>
              <div class="flex items-center justify-between text-[10px]">
                <span class="text-port-text-muted">ETA: {{ dayjs(v.eta).format('MM-DD HH:mm') }}</span>
                <span class="text-port-accent font-mono">{{ (v.cargoWeight / 10000).toFixed(1) }}万t</span>
              </div>
              <el-progress
                v-if="v.progress && v.progress > 0"
                :percentage="v.progress"
                :stroke-width="3"
                :show-text="false"
                status="success"
                class="mt-1.5"
              />
            </div>
          </div>
        </div>

        <div class="flex-1 min-h-0 bg-port-card/40 rounded-lg border border-port-panel p-3 flex flex-col">
          <div class="flex items-center justify-between mb-2 flex-shrink-0">
            <h3 class="text-port-text text-sm font-semibold flex items-center gap-2">
              <el-icon class="text-port-success"><TrendCharts /></el-icon>
              吞吐量趋势
            </h3>
            <span class="text-[10px] text-port-text-muted">近6个月</span>
          </div>
          <div ref="throughputChartRef" class="flex-1 min-h-0 w-full" />
        </div>
      </div>
    </div>
  </div>
</template>
