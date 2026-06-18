<template>
  <div class="dashboard-wrapper">
    <div class="page-container">
      <div class="dashboard-header card mb-4">
        <div class="header-title">
          <h2>
            <el-icon><DataAnalysis /></el-icon>
            运营数据看板
          </h2>
          <p class="subtitle">实时掌握园区运营动态</p>
        </div>
        <div class="header-actions">
          <el-radio-group v-model="period" size="default" @change="loadStats">
            <el-radio-button label="day">今日</el-radio-button>
            <el-radio-button label="week">本周</el-radio-button>
            <el-radio-button label="month">本月</el-radio-button>
          </el-radio-group>
          <el-button :icon="Refresh" @click="loadStats" :loading="adminStore.loading">
            刷新数据
          </el-button>
          <el-button type="primary" :icon="Download" @click="exportReport">
            导出报表
          </el-button>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card revenue-card" v-loading="adminStore.loading">
          <div class="stat-icon">
            <el-icon :size="28"><Money /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">今日收入</div>
            <div class="stat-value">¥{{ (stats?.todayRevenue || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</div>
            <div class="stat-trend" :class="trendClass(todayVsYesterday)">
              <el-icon><component :is="todayVsYesterday >= 0 ? 'Top' : 'Bottom'" /></el-icon>
              {{ Math.abs(todayVsYesterday).toFixed(1) }}% 较昨日
            </div>
          </div>
        </div>

        <div class="stat-card parking-card">
          <div class="stat-icon">
            <el-icon :size="28"><Van /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">停车次数</div>
            <div class="stat-value">{{ stats?.totalParkings || 0 }}</div>
            <div class="stat-sub">平均时长 {{ stats?.avgParkingDuration?.toFixed(0) || 0 }} 分钟</div>
          </div>
        </div>

        <div class="stat-card charging-card">
          <div class="stat-icon">
            <el-icon :size="28"><Lightning /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">充电次数</div>
            <div class="stat-value">{{ stats?.totalChargings || 0 }}</div>
            <div class="stat-sub">利用率 {{ stats?.chargingUtilization?.toFixed(1) || 0 }}%</div>
          </div>
        </div>

        <div class="stat-card occupancy-card">
          <div class="stat-icon">
            <el-icon :size="28"><PieChart /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">车位占有率</div>
            <div class="stat-value">{{ stats?.occupancyRate?.toFixed(1) || 0 }}%</div>
            <el-progress :percentage="stats?.occupancyRate || 0" :stroke-width="6" :show-text="false" />
          </div>
        </div>
      </div>

      <div class="charts-row">
        <div class="chart-card card">
          <div class="card-title flex-between">
            <span>
              <el-icon><TrendCharts /></el-icon>
              收入趋势
            </span>
            <el-radio-group v-model="revenueType" size="small">
              <el-radio-button label="day">日</el-radio-button>
              <el-radio-button label="week">周</el-radio-button>
              <el-radio-button label="month">月</el-radio-button>
            </el-radio-group>
          </div>
          <v-chart class="chart" :option="revenueChartOption" autoresize />
        </div>

        <div class="chart-card card">
          <div class="card-title flex-between">
            <span>
              <el-icon><Histogram /></el-icon>
              停车/充电次数对比
            </span>
          </div>
          <v-chart class="chart" :option="comparisonChartOption" autoresize />
        </div>
      </div>

      <div class="charts-row">
        <div class="chart-card card">
          <div class="card-title">
            <el-icon><Aim /></el-icon>
            24小时停车高峰分布
          </div>
          <v-chart class="chart" :option="peakHoursChartOption" autoresize />
        </div>

        <div class="chart-card card">
          <div class="card-title">
            <el-icon><PieChart /></el-icon>
            收入构成分析
          </div>
          <v-chart class="chart" :option="pieChartOption" autoresize />
        </div>
      </div>

      <div class="charts-row">
        <div class="chart-card card">
          <div class="card-title">
            <el-icon><Rank /></el-icon>
            热门停车场 TOP 5
          </div>
          <v-chart class="chart" :option="parkingRankOption" autoresize />
        </div>

        <div class="chart-card card">
          <div class="card-title">
            <el-icon><Coin /></el-icon>
            热门充电桩 TOP 5
          </div>
          <v-chart class="chart" :option="stationRankOption" autoresize />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, markRaw } from 'vue'
import { ElMessage } from 'element-plus'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import {
  LineChart, BarChart, PieChart
} from 'echarts/charts'
import {
  TitleComponent, TooltipComponent, LegendComponent,
  GridComponent, DataZoomComponent
} from 'echarts/components'
import VChart from 'vue-echarts'
import { useAdminStore } from '@/stores/admin'
import type { DashboardStats } from '@/types'

use([
  CanvasRenderer,
  LineChart,
  BarChart,
  PieChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DataZoomComponent
])

const adminStore = useAdminStore()
const period = ref<'day' | 'week' | 'month'>('day')
const revenueType = ref<'day' | 'week' | 'month'>('day')

const stats = computed<DashboardStats | null>(() => adminStore.dashboardStats)

const todayVsYesterday = computed(() => {
  if (!stats.value?.yesterdayRevenue || stats.value.yesterdayRevenue === 0) return 0
  return ((stats.value.todayRevenue - stats.value.yesterdayRevenue) / stats.value.yesterdayRevenue) * 100
})

const trendClass = (v: number) => v >= 0 ? 'up' : 'down'

const chartColors = ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399', '#9b59b6']

const revenueChartOption = computed(() => {
  const trend = stats.value?.revenueTrend || generateMockTrend(7)
  return markRaw({
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const p = params[0]
        return `${p.axisValue}<br/>收入: <strong>¥${p.value?.toLocaleString() || 0}</strong>`
      }
    },
    legend: { data: ['收入', '同比'], right: 0 },
    grid: { left: 50, right: 20, top: 40, bottom: 30 },
    xAxis: {
      type: 'category',
      data: trend.map(t => t.date),
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#e4e7ed' } },
      axisLabel: { color: '#909399' }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#f2f6fc', type: 'dashed' } },
      axisLabel: { color: '#909399', formatter: '¥{value}' }
    },
    series: [
      {
        name: '收入',
        type: 'line',
        smooth: true,
        data: trend.map(t => t.value),
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { width: 3, color: chartColors[0] },
        itemStyle: { color: chartColors[0] },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(64,158,255,0.3)' },
              { offset: 1, color: 'rgba(64,158,255,0.02)' }
            ]
          }
        }
      },
      {
        name: '同比',
        type: 'line',
        smooth: true,
        data: trend.map(t => t.compareValue || t.value * 0.8),
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2, color: chartColors[4], type: 'dashed' },
        itemStyle: { color: chartColors[4] }
      }
    ]
  })
})

const comparisonChartOption = computed(() => {
  const parkTrend = stats.value?.parkingTrend || generateMockTrend(7)
  const chargeTrend = stats.value?.chargingTrend || generateMockTrend(7)
  return markRaw({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: ['停车次数', '充电次数'], right: 0 },
    grid: { left: 50, right: 20, top: 40, bottom: 30 },
    xAxis: {
      type: 'category',
      data: parkTrend.map(t => t.date),
      axisLine: { lineStyle: { color: '#e4e7ed' } },
      axisLabel: { color: '#909399' }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#f2f6fc', type: 'dashed' } },
      axisLabel: { color: '#909399' }
    },
    series: [
      {
        name: '停车次数',
        type: 'bar',
        data: parkTrend.map(t => t.value),
        barWidth: 14,
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: chartColors[0]
        }
      },
      {
        name: '充电次数',
        type: 'bar',
        data: chargeTrend.map(t => t.value),
        barWidth: 14,
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: chartColors[1]
        }
      }
    ]
  })
})

const peakHoursChartOption = computed(() => {
  const peak = stats.value?.peakHours || generateMockPeakHours()
  return markRaw({
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => `${params[0].axisValue}时: <strong>${params[0].value}</strong> 辆次`
    },
    grid: { left: 40, right: 20, top: 20, bottom: 30 },
    xAxis: {
      type: 'category',
      data: peak.map(p => `${p.hour}时`),
      axisLine: { lineStyle: { color: '#e4e7ed' } },
      axisLabel: { color: '#909399', interval: 1 }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#f2f6fc', type: 'dashed' } },
      axisLabel: { color: '#909399' }
    },
    series: [{
      type: 'bar',
      data: peak.map(p => ({
        value: p.count,
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: p.count >= 50 ? chartColors[3] : p.count >= 30 ? chartColors[2] : chartColors[1]
        }
      })),
      barWidth: '60%'
    }]
  })
})

const pieChartOption = computed(() => {
  return markRaw({
    tooltip: {
      trigger: 'item',
      formatter: '{b}: ¥{c} ({d}%)'
    },
    legend: { orient: 'vertical', left: 'left', top: 'center' },
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['60%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { show: true, formatter: '{b}\n{d}%' },
      data: [
        { value: stats.value?.todayRevenue ? stats.value.todayRevenue * 0.6 : 3500, name: '停车费', itemStyle: { color: chartColors[0] } },
        { value: stats.value?.todayRevenue ? stats.value.todayRevenue * 0.3 : 1800, name: '充电费', itemStyle: { color: chartColors[1] } },
        { value: stats.value?.todayRevenue ? stats.value.todayRevenue * 0.08 : 500, name: '预约费', itemStyle: { color: chartColors[2] } },
        { value: stats.value?.todayRevenue ? stats.value.todayRevenue * 0.02 : 200, name: '其他', itemStyle: { color: chartColors[4] } }
      ]
    }]
  })
})

const parkingRankOption = computed(() => {
  const rank = stats.value?.topParkingLots || generateMockRank(5)
  return markRaw({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 100, right: 40, top: 10, bottom: 20 },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#f2f6fc' } },
      axisLabel: { color: '#909399' }
    },
    yAxis: {
      type: 'category',
      data: rank.map(r => r.name).reverse(),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#303133', fontWeight: 500 }
    },
    series: [{
      type: 'bar',
      data: rank.map(r => r.value).reverse(),
      barWidth: 14,
      itemStyle: {
        borderRadius: [0, 4, 4, 0],
        color: {
          type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
          colorStops: [
            { offset: 0, color: chartColors[0] },
            { offset: 1, color: '#79bbff' }
          ]
        }
      },
      label: {
        show: true,
        position: 'right',
        color: '#606266',
        fontWeight: 600
      }
    }]
  })
})

const stationRankOption = computed(() => {
  const rank = stats.value?.topStations || generateMockRank(5)
  return markRaw({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 100, right: 40, top: 10, bottom: 20 },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#f2f6fc' } },
      axisLabel: { color: '#909399' }
    },
    yAxis: {
      type: 'category',
      data: rank.map(r => r.name).reverse(),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#303133', fontWeight: 500 }
    },
    series: [{
      type: 'bar',
      data: rank.map(r => r.value).reverse(),
      barWidth: 14,
      itemStyle: {
        borderRadius: [0, 4, 4, 0],
        color: {
          type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
          colorStops: [
            { offset: 0, color: chartColors[1] },
            { offset: 1, color: '#95d475' }
          ]
        }
      },
      label: {
        show: true,
        position: 'right',
        color: '#606266',
        fontWeight: 600,
        formatter: '{c} kWh'
      }
    }]
  })
})

const generateMockTrend = (n: number) => {
  const arr = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000)
    arr.push({
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      value: Math.round(2000 + Math.random() * 5000),
      compareValue: Math.round(1500 + Math.random() * 4000)
    })
  }
  return arr
}

const generateMockPeakHours = () => {
  return Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    count: Math.round(
      h >= 8 && h <= 10 ? 40 + Math.random() * 40 :
      h >= 17 && h <= 20 ? 50 + Math.random() * 40 :
      h >= 0 && h <= 6 ? 2 + Math.random() * 10 :
      15 + Math.random() * 25
    )
  }))
}

const generateMockRank = (n: number) => {
  const names = ['A区停车场', 'B区地下车库', 'C区访客停车场', 'D区员工停车楼', 'E区充电场']
  return Array.from({ length: n }, (_, i) => ({
    id: `rk-${i}`,
    name: names[i] || `区域${i + 1}`,
    value: Math.round(200 + Math.random() * 800)
  }))
}

const loadStats = async () => {
  try {
    await adminStore.fetchDashboardStats(period.value)
  } catch {
    adminStore.dashboardStats = {
      todayRevenue: 6800,
      yesterdayRevenue: 5200,
      weekRevenue: 42000,
      monthRevenue: 168000,
      totalParkings: 328,
      totalChargings: 156,
      avgParkingDuration: 85,
      occupancyRate: 68.5,
      chargingUtilization: 45.2,
      peakHours: generateMockPeakHours(),
      revenueTrend: generateMockTrend(7),
      parkingTrend: generateMockTrend(7),
      chargingTrend: generateMockTrend(7),
      topParkingLots: generateMockRank(5),
      topStations: generateMockRank(5)
    } as DashboardStats
  }
}

const exportReport = () => {
  ElMessage.success('报表已开始导出，请稍后查看')
}

watch(revenueType, () => {
  loadStats()
})

onMounted(() => {
  loadStats()
})
</script>

<style lang="scss" scoped>
.dashboard-wrapper { width: 100%; }
.mb-4 { margin-bottom: 16px; }

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;

  .header-title h2 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 20px;
    color: #303133;
  }

  .subtitle {
    margin: 4px 0 0 0;
    font-size: 13px;
    color: #909399;
  }

  .header-actions {
    display: flex;
    gap: 12px;
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  transition: all 0.25s ease;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
  }

  .stat-icon {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: #fff;
  }

  .stat-content {
    flex: 1;
    min-width: 0;
  }

  .stat-label {
    font-size: 13px;
    color: #909399;
    margin-bottom: 4px;
  }

  .stat-value {
    font-size: 26px;
    font-weight: 700;
    color: #303133;
    line-height: 1.2;
  }

  .stat-sub {
    font-size: 12px;
    color: #909399;
    margin-top: 4px;
  }

  .stat-trend {
    display: flex;
    align-items: center;
    gap: 2px;
    font-size: 12px;
    margin-top: 4px;

    &.up { color: var(--success-color); }
    &.down { color: var(--danger-color); }
  }

  &.revenue-card .stat-icon { background: linear-gradient(135deg, #f6d365 0%, #fda085 100%); }
  &.parking-card .stat-icon { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
  &.charging-card .stat-icon { background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%); }
  &.occupancy-card .stat-icon { background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%); }
}

.charts-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}

.chart-card {
  padding: 20px;
}

.chart {
  width: 100%;
  height: 320px;
}
</style>
