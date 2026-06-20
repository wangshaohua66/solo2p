<template>
  <div class="report-page">
    <div class="top-bar panel">
      <div class="top-row">
        <div class="filter-item">
          <span class="filter-label">时间范围</span>
          <el-radio-group v-model="timeRange" class="range-group">
            <el-radio-button value="year">按年</el-radio-button>
            <el-radio-button value="quarter">按季度</el-radio-button>
            <el-radio-button value="month">按月</el-radio-button>
            <el-radio-button value="custom">自定义</el-radio-button>
          </el-radio-group>
          <el-date-picker
            v-if="timeRange === 'custom'"
            v-model="customDateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始"
            end-placeholder="结束"
            value-format="YYYY-MM-DD"
            class="custom-date"
          />
        </div>
        <div class="filter-item">
          <span class="filter-label">殡仪馆</span>
          <el-select v-model="selectedHome" placeholder="全部殡仪馆" clearable class="home-select">
            <el-option label="全部殡仪馆" value="" />
            <el-option label="第一殡仪馆" value="home1" />
            <el-option label="第二殡仪馆" value="home2" />
            <el-option label="第三殡仪馆" value="home3" />
          </el-select>
        </div>
        <div class="filter-item flex-1" />
        <div class="filter-item">
          <el-button :icon="Refresh" @click="handleRefresh">刷新</el-button>
          <el-button type="primary" :icon="Download" class="export-btn" @click="handleExport">
            导出Excel
          </el-button>
        </div>
      </div>
    </div>

    <div class="big-stats-row">
      <StatCard title="遗体处理量" :value="bigStats.remainsCount" icon="Document" :trend="bigStats.remainsTrend" />
      <StatCard title="火化数" :value="bigStats.cremations" icon="Flame" :trend="bigStats.cremationTrend" />
      <StatCard title="告别厅场次" :value="bigStats.bookings" icon="Calendar" :trend="bigStats.bookingTrend" />
      <StatCard title="墓位销售" :value="bigStats.plotSales" icon="House" :trend="bigStats.plotTrend" />
      <StatCard title="营收(万元)" :value="bigStats.revenue" icon="Money" :trend="bigStats.revenueTrend" />
      <StatCard title="满意度" :value="bigStats.satisfaction + '%'" icon="Star" :trend="bigStats.satisfactionTrend" />
    </div>

    <div class="chart-row row-2">
      <div class="chart-panel panel chart-main">
        <div class="panel-header">
          <h3 class="panel-title">
            <el-icon><TrendCharts /></el-icon>
            月业务量趋势
          </h3>
          <div class="chart-legend">
            <span class="legend-dot remains-dot"></span>遗体处理
            <span class="legend-dot cremation-dot"></span>火化
            <span class="legend-dot booking-dot"></span>告别场次
          </div>
        </div>
        <div class="panel-body no-padding">
          <div ref="trendChartRef" class="chart-box"></div>
        </div>
      </div>

      <div class="chart-panel panel chart-side">
        <div class="panel-header">
          <h3 class="panel-title">
            <el-icon><PieChart /></el-icon>
            服务收入构成
          </h3>
        </div>
        <div class="panel-body no-padding">
          <div ref="categoryChartRef" class="chart-box"></div>
        </div>
      </div>
    </div>

    <div class="chart-row row-3">
      <div class="chart-panel panel">
        <div class="panel-header">
          <h3 class="panel-title">
            <el-icon><OfficeBuilding /></el-icon>
            殡仪馆对比分析
          </h3>
        </div>
        <div class="panel-body no-padding">
          <div ref="homeChartRef" class="chart-box"></div>
        </div>
      </div>

      <div class="chart-panel panel">
        <div class="panel-header">
          <h3 class="panel-title">
            <el-icon><House /></el-icon>
            墓位销售结构
          </h3>
        </div>
        <div class="panel-body no-padding">
          <div ref="cemeteryChartRef" class="chart-box"></div>
        </div>
      </div>
    </div>

    <div class="alert-section">
      <div class="section-header">
        <h3 class="section-title">
          <el-icon class="warn-icon"><WarningFilled /></el-icon>
          异常预警
        </h3>
        <el-tag type="danger" effect="dark" size="small">{{ alerts.length }} 条预警</el-tag>
      </div>

      <div class="alert-cards-row">
        <div
          v-for="alert in alerts"
          :key="alert.id"
          class="alert-card"
          :class="alert.level"
        >
          <div class="alert-card-header">
            <el-icon class="alert-card-icon">
              <WarningFilled v-if="alert.level === 'error'" />
              <Warning v-else-if="alert.level === 'warning'" />
              <InfoFilled v-else />
            </el-icon>
            <el-tag :type="alert.level === 'error' ? 'danger' : 'warning'" size="small" effect="dark">
              {{ alert.level === 'error' ? '严重' : '警告' }}
            </el-tag>
            <span class="alert-card-time">{{ alert.time }}</span>
          </div>
          <div class="alert-card-title">{{ alert.title }}</div>
          <div class="alert-card-desc">{{ alert.description }}</div>
          <div class="alert-card-meta">
            <span v-for="(v, k) in alert.meta" :key="k" class="alert-meta-item">
              <b>{{ v.label }}</b>
              <span :class="v.valueClass">{{ v.value }}</span>
            </span>
          </div>
          <div class="alert-card-footer">
            <el-button size="small" type="primary" link @click="handleAlertDetail(alert)">查看详情</el-button>
            <el-button size="small" link @click="handleAlertResolve(alert)">标记处理</el-button>
          </div>
        </div>
      </div>

      <div class="panel alert-trend-panel">
        <div class="panel-header">
          <h3 class="panel-title">
            <el-icon><DataAnalysis /></el-icon>
            异常趋势监控
          </h3>
          <div class="chart-legend">
            <span class="legend-dot remains-dot"></span>业务量波动
            <span class="legend-dot cremation-dot"></span>价格偏离度
            <span class="legend-dot alert-dot"></span>预警阈值
          </div>
        </div>
        <div class="panel-body no-padding">
          <div ref="alertTrendChartRef" class="chart-box small"></div>
        </div>
      </div>
    </div>

    <div class="report-table-section panel">
      <div class="panel-header">
        <h3 class="panel-title">
          <el-icon><Grid /></el-icon>
          监管报表数据
        </h3>
        <div class="table-actions">
          <el-button size="small" :icon="Filter">筛选</el-button>
          <el-button size="small" type="primary" :icon="Download" @click="handleExport">导出</el-button>
        </div>
      </div>
      <div class="panel-body no-padding">
        <el-table :data="reportTableData" border class="report-table">
          <el-table-column prop="period" label="统计周期" width="120" fixed="left" />
          <el-table-column prop="home" label="所属殡仪馆" width="130" />
          <el-table-column prop="remainsCount" label="遗体登记" align="right" width="100" />
          <el-table-column prop="cremationCount" label="火化数" align="right" width="100" />
          <el-table-column prop="farewellCount" label="告别场次" align="right" width="100" />
          <el-table-column prop="subsidyCount" label="惠民补贴" align="right" width="110">
            <template #default="{ row }">{{ row.subsidyCount }} 笔</template>
          </el-table-column>
          <el-table-column prop="revenue" label="营收(元)" align="right" width="130">
            <template #default="{ row }">¥{{ row.revenue.toLocaleString() }}</template>
          </el-table-column>
          <el-table-column prop="subsidyAmount" label="补贴金额(元)" align="right" width="130">
            <template #default="{ row }" class="green-text">¥{{ row.subsidyAmount.toLocaleString() }}</template>
          </el-table-column>
          <el-table-column prop="plotSales" label="墓位销售" align="right" width="100" />
          <el-table-column prop="avgSatisfaction" label="满意度" align="right" width="100">
            <template #default="{ row }">
              <span :class="row.avgSatisfaction >= 95 ? 'ok' : 'warn'">{{ row.avgSatisfaction }}%</span>
            </template>
          </el-table-column>
          <el-table-column prop="complaintCount" label="投诉数" align="right" width="90">
            <template #default="{ row }">
              <span :class="row.complaintCount > 0 ? 'warn' : ''">{{ row.complaintCount }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="100" align="center" fixed="right">
            <template #default="{ row }">
              <el-tag v-if="row.status === 'normal'" type="success" size="small">正常</el-tag>
              <el-tag v-else-if="row.status === 'warning'" type="warning" size="small">关注</el-tag>
              <el-tag v-else type="danger" size="small">异常</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div class="table-pagination">
        <el-pagination
          v-model:current-page="tablePagination.page"
          v-model:page-size="tablePagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="reportTableData.length"
          layout="total, sizes, prev, pager, next, jumper"
          background
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import * as echarts from 'echarts'
import {
  Refresh,
  Download,
  Document,
  Flame,
  Calendar,
  House,
  Money,
  Star,
  TrendCharts,
  PieChart,
  OfficeBuilding,
  Warning,
  WarningFilled,
  InfoFilled,
  DataAnalysis,
  Grid,
  Filter
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import StatCard from '@/components/common/StatCard.vue'
import {
  generateMonthlyTrend,
  generateServiceCategory,
  generateFuneralHomeStats,
  generateCemeterySales
} from '@/mock/statistics'

const timeRange = ref('month')
const customDateRange = ref<string[]>([])
const selectedHome = ref('')

const trendChartRef = ref<HTMLElement>()
const categoryChartRef = ref<HTMLElement>()
const homeChartRef = ref<HTMLElement>()
const cemeteryChartRef = ref<HTMLElement>()
const alertTrendChartRef = ref<HTMLElement>()

let trendChart: echarts.ECharts | null = null
let categoryChart: echarts.ECharts | null = null
let homeChart: echarts.ECharts | null = null
let cemeteryChart: echarts.ECharts | null = null
let alertTrendChart: echarts.ECharts | null = null

const monthlyTrend = generateMonthlyTrend()
const serviceCategory = generateServiceCategory()
const funeralHomeStats = generateFuneralHomeStats()
const cemeterySales = generateCemeterySales()

const bigStats = computed(() => {
  const totalRemains = monthlyTrend.reduce((s, m) => s + m.remains, 0)
  const totalCremations = monthlyTrend.reduce((s, m) => s + m.cremations, 0)
  const totalBookings = monthlyTrend.reduce((s, m) => s + m.bookings, 0)
  const totalRevenue = monthlyTrend.reduce((s, m) => s + m.revenue, 0)
  const totalPlotSales = cemeterySales.reduce((s, q) => s + q.standard + q.double + q.premium + q.family, 0)
  return {
    remainsCount: totalRemains,
    cremations: totalCremations,
    bookings: totalBookings,
    plotSales: totalPlotSales,
    revenue: totalRevenue.toFixed(1),
    satisfaction: 96.3,
    remainsTrend: 8.2,
    cremationTrend: 7.6,
    bookingTrend: 12.4,
    plotTrend: -2.8,
    revenueTrend: 9.1,
    satisfactionTrend: 1.2
  }
})

interface AlertItem {
  id: string
  level: 'error' | 'warning' | 'info'
  title: string
  description: string
  time: string
  meta: { label: string; value: string; valueClass?: string }[]
}

const alerts = ref<AlertItem[]>([
  {
    id: 'AL001',
    level: 'error',
    title: '第二殡仪馆业务量异常下降',
    description: '本月遗体登记量较上月下降 18.7%，远超正常波动范围(-5%)，需排查是否存在分流或服务问题。',
    time: '2026-06-18 09:30',
    meta: [
      { label: '本月登记', value: '3,105', valueClass: 'bad' },
      { label: '上月登记', value: '3,820' },
      { label: '环比变化', value: '-18.7%', valueClass: 'bad' }
    ]
  },
  {
    id: 'AL002',
    level: 'warning',
    title: '豪华型整容价格严重偏离标准',
    description: '检测到3笔"修复型整容"订单价格高于政府指导价 285%，超过物价局备案的浮动区间(+50%)，需复核。',
    time: '2026-06-17 16:45',
    meta: [
      { label: '涉及笔数', value: '3 笔', valueClass: 'warn' },
      { label: '均价', value: '¥5,860', valueClass: 'warn' },
      { label: '指导价', value: '¥1,530' }
    ]
  },
  {
    id: 'AL003',
    level: 'warning',
    title: '标准型骨灰盒库存不足',
    description: '骨灰盒(标准)当前库存仅 18 个，低于安全库存阈值(50个)，建议立即采购补货。',
    time: '2026-06-16 14:20',
    meta: [
      { label: '当前库存', value: '18', valueClass: 'bad' },
      { label: '安全库存', value: '50' },
      { label: '月均消耗', value: '62' }
    ]
  },
  {
    id: 'AL004',
    level: 'warning',
    title: '家属满意度明显下滑',
    description: '第一殡仪馆近两周满意度 91.2%，低于月度目标 95%，主要投诉集中在告别厅预约与等待时间。',
    time: '2026-06-15 10:05',
    meta: [
      { label: '近两周', value: '91.2%', valueClass: 'bad' },
      { label: '月度目标', value: '95%' },
      { label: '投诉数', value: '12', valueClass: 'warn' }
    ]
  }
])

const tablePagination = reactive({
  page: 1,
  pageSize: 10
})

const reportTableData = computed(() => {
  const homes = ['第一殡仪馆', '第二殡仪馆', '第三殡仪馆']
  const data = []
  for (let i = 5; i >= 0; i--) {
    for (const home of homes) {
      const m = 6 - i
      const rc = 800 + Math.floor(Math.random() * 500) + (home === '第一殡仪馆' ? 200 : 0)
      const status = Math.random() > 0.8 ? (Math.random() > 0.5 ? 'warning' : 'abnormal') : 'normal'
      data.push({
        period: `2026-${String(m).padStart(2, '0')}`,
        home,
        remainsCount: rc,
        cremationCount: Math.floor(rc * (0.85 + Math.random() * 0.1)),
        farewellCount: 200 + Math.floor(Math.random() * 300),
        subsidyCount: 80 + Math.floor(Math.random() * 120),
        revenue: 1800000 + Math.floor(Math.random() * 3000000),
        subsidyAmount: 120000 + Math.floor(Math.random() * 180000),
        plotSales: 40 + Math.floor(Math.random() * 60),
        avgSatisfaction: (92 + Math.random() * 7).toFixed(1),
        complaintCount: status === 'abnormal' ? 5 + Math.floor(Math.random() * 6) : (status === 'warning' ? 2 + Math.floor(Math.random() * 3) : Math.floor(Math.random() * 2)),
        status
      })
    }
  }
  return data
})

const goldPalette = ['#C9A86C', '#D4B87C', '#B8956A', '#8B7355', '#A89070', '#E0CB9E', '#B19A72', '#9D8560']

function getTrendOption(): echarts.EChartsOption {
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#2E2E36',
      borderColor: '#C9A86C',
      textStyle: { color: '#FFFFFF' },
      axisPointer: { type: 'cross', lineStyle: { color: '#C9A86C', type: 'dashed' } }
    },
    legend: { show: false },
    grid: { left: '3%', right: '4%', bottom: '8%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: monthlyTrend.map((m) => m.month),
      axisLine: { lineStyle: { color: '#3A3A44' } },
      axisLabel: { color: '#B0B0B8', fontSize: 12 },
      axisTick: { show: false }
    },
    yAxis: [
      {
        type: 'value',
        name: '业务量',
        nameTextStyle: { color: '#6B6B74' },
        axisLine: { lineStyle: { color: '#3A3A44' } },
        axisLabel: { color: '#B0B0B8' },
        splitLine: { lineStyle: { color: 'rgba(58,58,68,0.6)', type: 'dashed' } }
      },
      {
        type: 'value',
        name: '营收(万)',
        nameTextStyle: { color: '#6B6B74' },
        axisLine: { show: false },
        axisLabel: { color: '#B0B0B8' },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: '遗体处理',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        data: monthlyTrend.map((m) => m.remains),
        lineStyle: { width: 3, color: '#C9A86C' },
        itemStyle: { color: '#C9A86C', borderColor: '#1A1A1F', borderWidth: 2 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(201,168,108,0.35)' },
            { offset: 1, color: 'rgba(201,168,108,0.02)' }
          ])
        }
      },
      {
        name: '火化',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        data: monthlyTrend.map((m) => m.cremations),
        lineStyle: { width: 2.5, color: '#D4B87C', type: 'dashed' },
        itemStyle: { color: '#D4B87C', borderColor: '#1A1A1F', borderWidth: 2 }
      },
      {
        name: '告别场次',
        type: 'bar',
        yAxisIndex: 0,
        barWidth: 16,
        data: monthlyTrend.map((m) => m.bookings),
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(201,168,108,0.8)' },
            { offset: 1, color: 'rgba(139,115,85,0.5)' }
          ]),
          borderRadius: [4, 4, 0, 0]
        }
      },
      {
        name: '营收(万)',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        symbol: 'diamond',
        symbolSize: 6,
        data: monthlyTrend.map((m) => m.revenue.toFixed(1)),
        lineStyle: { width: 2, color: '#52C41A' },
        itemStyle: { color: '#52C41A' }
      }
    ]
  }
}

function getCategoryOption(): echarts.EChartsOption {
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: '#2E2E36',
      borderColor: '#C9A86C',
      textStyle: { color: '#FFFFFF' },
      formatter: '{b}<br/>金额: ¥{c.toLocaleString()} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      right: '3%',
      top: 'center',
      textStyle: { color: '#B0B0B8', fontSize: 12 },
      itemWidth: 10,
      itemHeight: 10
    },
    series: [
      {
        name: '服务收入',
        type: 'pie',
        radius: ['30%', '72%'],
        center: ['38%', '50%'],
        roseType: 'area',
        itemStyle: {
          borderRadius: 6,
          borderColor: '#24242B',
          borderWidth: 2
        },
        label: { show: false },
        labelLine: { show: false },
        data: serviceCategory.map((s, i) => ({
          value: s.value,
          name: s.name,
          itemStyle: { color: goldPalette[i % goldPalette.length] }
        }))
      }
    ]
  }
}

function getHomeOption(): echarts.EChartsOption {
  const homeNames = funeralHomeStats.map((h) => h.name)
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#2E2E36',
      borderColor: '#C9A86C',
      textStyle: { color: '#FFFFFF' },
      axisPointer: { type: 'shadow' }
    },
    legend: {
      top: '0',
      textStyle: { color: '#B0B0B8' },
      itemWidth: 14,
      itemHeight: 10
    },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '18%', containLabel: true },
    xAxis: {
      type: 'category',
      data: homeNames,
      axisLine: { lineStyle: { color: '#3A3A44' } },
      axisLabel: { color: '#B0B0B8' },
      axisTick: { show: false }
    },
    yAxis: [
      {
        type: 'value',
        name: '业务量',
        nameTextStyle: { color: '#6B6B74' },
        axisLine: { lineStyle: { color: '#3A3A44' } },
        axisLabel: { color: '#B0B0B8' },
        splitLine: { lineStyle: { color: 'rgba(58,58,68,0.6)', type: 'dashed' } }
      },
      {
        type: 'value',
        name: '营收(万)',
        nameTextStyle: { color: '#6B6B74' },
        max: 100,
        axisLine: { show: false },
        axisLabel: { color: '#B0B0B8' },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: '遗体处理',
        type: 'bar',
        barGap: 0,
        barWidth: 16,
        data: funeralHomeStats.map((h) => h.remains),
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#C9A86C' },
            { offset: 1, color: '#8B7355' }
          ]),
          borderRadius: [4, 4, 0, 0]
        }
      },
      {
        name: '火化数',
        type: 'bar',
        barWidth: 16,
        data: funeralHomeStats.map((h) => h.cremations),
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#D4B87C' },
            { offset: 1, color: '#A89070' }
          ]),
          borderRadius: [4, 4, 0, 0]
        }
      },
      {
        name: '满意度(%)',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        data: funeralHomeStats.map((h) => h.satisfaction),
        lineStyle: { width: 3, color: '#52C41A' },
        itemStyle: { color: '#52C41A', borderColor: '#1A1A1F', borderWidth: 2 }
      },
      {
        name: '营收(万)',
        type: 'bar',
        yAxisIndex: 1,
        barWidth: 16,
        data: funeralHomeStats.map((h) => h.revenue / 100),
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(82,196,26,0.9)' },
            { offset: 1, color: 'rgba(82,196,26,0.3)' }
          ]),
          borderRadius: [4, 4, 0, 0]
        }
      }
    ]
  }
}

function getCemeteryOption(): echarts.EChartsOption {
  const quarters = cemeterySales.map((c) => c.quarter)
  const colors = ['#C9A86C', '#D4B87C', '#A89070', '#8B7355', '#E0CB9E']
  const names = ['标准型', '双穴型', '豪华型', '家族型', '骨灰墙']
  const keys: (keyof typeof cemeterySales[0])[] = ['standard', 'double', 'premium', 'family', 'ashesWall']
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#2E2E36',
      borderColor: '#C9A86C',
      textStyle: { color: '#FFFFFF' },
      axisPointer: { type: 'shadow' }
    },
    legend: {
      top: '0',
      textStyle: { color: '#B0B0B8' },
      itemWidth: 14,
      itemHeight: 10
    },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '18%', containLabel: true },
    xAxis: {
      type: 'category',
      data: quarters,
      axisLine: { lineStyle: { color: '#3A3A44' } },
      axisLabel: { color: '#B0B0B8' },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      name: '销售数量(个/座)',
      nameTextStyle: { color: '#6B6B74' },
      axisLine: { lineStyle: { color: '#3A3A44' } },
      axisLabel: { color: '#B0B0B8' },
      splitLine: { lineStyle: { color: 'rgba(58,58,68,0.6)', type: 'dashed' } }
    },
    series: keys.map((k, i) => ({
      name: names[i],
      type: 'bar',
      stack: 'total',
      barWidth: 36,
      emphasis: { focus: 'series' },
      data: cemeterySales.map((c) => c[k] as number),
      itemStyle: {
        color: colors[i],
        borderRadius: i === keys.length - 1 ? [4, 4, 0, 0] : (i === 0 ? [0, 0, 4, 4] : [0, 0, 0, 0])
      }
    }))
  }
}

function getAlertTrendOption(): echarts.EChartsOption {
  const weeks = ['W-8', 'W-7', 'W-6', 'W-5', 'W-4', 'W-3', 'W-2', 'W-1', '本周']
  const base = 100
  const biz = weeks.map(() => base + Math.floor((Math.random() - 0.5) * 35))
  const price = weeks.map(() => 10 + Math.floor((Math.random() - 0.3) * 15))
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#2E2E36',
      borderColor: '#C9A86C',
      textStyle: { color: '#FFFFFF' }
    },
    legend: { show: false },
    grid: { left: '3%', right: '4%', bottom: '10%', top: '8%', containLabel: true },
    xAxis: {
      type: 'category',
      data: weeks,
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#3A3A44' } },
      axisLabel: { color: '#B0B0B8' },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#3A3A44' } },
      axisLabel: { color: '#B0B0B8' },
      splitLine: { lineStyle: { color: 'rgba(58,58,68,0.5)', type: 'dashed' } }
    },
    series: [
      {
        name: '业务量波动',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: biz,
        lineStyle: { width: 2.5, color: '#C9A86C' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(201,168,108,0.2)' },
            { offset: 1, color: 'rgba(201,168,108,0)' }
          ])
        },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: '#FF4D4F', type: 'dashed', width: 1.5 },
          data: [
            { yAxis: 115, label: { formatter: '预警上限', color: '#FF4D4F', position: 'insideEndTop' } },
            { yAxis: 85, label: { formatter: '预警下限', color: '#FF4D4F', position: 'insideEndBottom' } }
          ]
        }
      },
      {
        name: '价格偏离度',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: price,
        lineStyle: { width: 2, color: '#D4B87C' }
      }
    ]
  }
}

function initCharts() {
  nextTick(() => {
    if (trendChartRef.value) {
      trendChart = echarts.init(trendChartRef.value)
      trendChart.setOption(getTrendOption())
    }
    if (categoryChartRef.value) {
      categoryChart = echarts.init(categoryChartRef.value)
      categoryChart.setOption(getCategoryOption())
    }
    if (homeChartRef.value) {
      homeChart = echarts.init(homeChartRef.value)
      homeChart.setOption(getHomeOption())
    }
    if (cemeteryChartRef.value) {
      cemeteryChart = echarts.init(cemeteryChartRef.value)
      cemeteryChart.setOption(getCemeteryOption())
    }
    if (alertTrendChartRef.value) {
      alertTrendChart = echarts.init(alertTrendChartRef.value)
      alertTrendChart.setOption(getAlertTrendOption())
    }
  })
}

function resizeCharts() {
  trendChart?.resize()
  categoryChart?.resize()
  homeChart?.resize()
  cemeteryChart?.resize()
  alertTrendChart?.resize()
}

function handleRefresh() {
  ElMessage.success('数据已刷新')
  initCharts()
}

function handleExport() {
  ElMessage.success('报表导出任务已提交，请稍后下载')
}

function handleAlertDetail(alert: AlertItem) {
  ElMessage.info(`查看预警详情: ${alert.title}`)
}

function handleAlertResolve(alert: AlertItem) {
  const idx = alerts.value.findIndex((a) => a.id === alert.id)
  if (idx >= 0) {
    alerts.value.splice(idx, 1)
    ElMessage.success('预警已标记为处理')
  }
}

watch(timeRange, () => {
  initCharts()
})

onMounted(() => {
  initCharts()
  window.addEventListener('resize', resizeCharts)
})

onBeforeUnmount(() => {
  trendChart?.dispose()
  categoryChart?.dispose()
  homeChart?.dispose()
  cemeteryChart?.dispose()
  alertTrendChart?.dispose()
  window.removeEventListener('resize', resizeCharts)
})
</script>

<style lang="scss" scoped>
.report-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0;
}

.top-bar {
  padding: 14px 20px;

  .top-row {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 10px;

  &.flex-1 {
    flex: 1;
  }
}

.filter-label {
  font-size: 13px;
  color: $color-funeral-text-secondary;
  white-space: nowrap;
}

.range-group {
  :deep(.el-radio-button__inner) {
    background: $color-funeral-deepest;
    border-color: $color-funeral-border;
    color: $color-funeral-text-secondary;
  }

  :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
    background: $color-funeral-gold;
    border-color: $color-funeral-gold;
    color: #1A1A1F;
    font-weight: 600;
    box-shadow: none;
  }
}

.custom-date {
  margin-left: 8px;
  width: 280px;
}

.home-select {
  width: 180px;
}

.export-btn {
  background: linear-gradient(135deg, $color-funeral-gold, $color-funeral-gold-dark);
  border: none;
  color: #1A1A1F;
  font-weight: 600;

  &:hover {
    box-shadow: $shadow-gold-glow;
  }
}

.big-stats-row {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 16px;

  @media (max-width: 1600px) {
    grid-template-columns: repeat(3, 1fr);
  }

  @media (max-width: 900px) {
    grid-template-columns: repeat(2, 1fr);
  }
}

.chart-row {
  display: grid;
  gap: 16px;

  &.row-2 {
    grid-template-columns: 60% 40%;

    @media (max-width: 1400px) {
      grid-template-columns: 1fr;
    }
  }

  &.row-3 {
    grid-template-columns: 1fr 1fr;

    @media (max-width: 1200px) {
      grid-template-columns: 1fr;
    }
  }
}

.panel {
  background: $color-funeral-card;
  border: 1px solid $color-funeral-border;
  border-radius: $radius-md;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid $color-funeral-border;
  background: rgba(255, 255, 255, 0.02);
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: $color-funeral-text-primary;
  margin: 0;

  :deep(.el-icon) {
    width: 18px;
    height: 18px;
    color: $color-funeral-gold;
  }
}

.panel-body {
  padding: 16px 20px;

  &.no-padding {
    padding: 0;
  }
}

.chart-legend {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 12px;
  color: $color-funeral-text-secondary;
}

.legend-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 4px;
  vertical-align: middle;

  &.remains-dot {
    background: #C9A86C;
  }

  &.cremation-dot {
    background: #D4B87C;
  }

  &.booking-dot {
    background: #52C41A;
  }

  &.alert-dot {
    background: #FF4D4F;
  }
}

.chart-box {
  width: 100%;
  height: 360px;
  padding: 4px 8px 16px;

  &.small {
    height: 260px;
  }
}

.alert-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 4px 0;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 700;
  color: $color-funeral-text-primary;
  margin: 0;

  :deep(.warn-icon) {
    color: #FF4D4F;
    width: 20px;
    height: 20px;
  }
}

.alert-cards-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;

  @media (max-width: 1500px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 800px) {
    grid-template-columns: 1fr;
  }
}

.alert-card {
  background: $color-funeral-card;
  border: 1px solid $color-funeral-border;
  border-radius: $radius-md;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: relative;
  overflow: hidden;
  transition: all 0.3s;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 4px;
    height: 100%;
  }

  &.error {
    border-color: rgba(255, 77, 79, 0.3);
    &::before { background: linear-gradient(180deg, #FF4D4F, rgba(255,77,79,0.2)); }
    &:hover { box-shadow: 0 8px 24px rgba(255,77,79,0.15); }
  }

  &.warning {
    border-color: rgba(250, 140, 22, 0.3);
    &::before { background: linear-gradient(180deg, #FA8C16, rgba(250,140,22,0.2)); }
    &:hover { box-shadow: 0 8px 24px rgba(250,140,22,0.15); }
  }

  &:hover {
    transform: translateY(-2px);
  }
}

.alert-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.alert-card-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;

  :deep(.el-icon) {
    width: 20px;
    height: 20px;
  }

  .error & { color: #FF4D4F; }
  .warning & { color: #FA8C16; }
}

.alert-card-time {
  margin-left: auto;
  font-size: 11px;
  color: $color-funeral-text-muted;
  font-family: 'SF Mono', Monaco, monospace;
}

.alert-card-title {
  font-size: 14px;
  font-weight: 600;
  color: $color-funeral-text-primary;
  line-height: 1.4;
}

.alert-card-desc {
  font-size: 12px;
  color: $color-funeral-text-secondary;
  line-height: 1.6;
  flex: 1;
}

.alert-card-meta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  padding: 8px 10px;
  background: rgba(255,255,255,0.02);
  border-radius: $radius-sm;
  font-size: 11px;
}

.alert-meta-item {
  display: flex;
  align-items: baseline;
  gap: 4px;
  color: $color-funeral-text-muted;

  b {
    font-weight: 500;
  }

  .bad {
    color: #FF4D4F;
    font-weight: 600;
  }

  .warn {
    color: #FA8C16;
    font-weight: 600;
  }
}

.alert-card-footer {
  display: flex;
  justify-content: space-between;
  padding-top: 6px;
  border-top: 1px solid $color-funeral-border;
}

.alert-trend-panel {
  margin-top: 0;
}

.report-table-section {
  .table-actions {
    display: flex;
    gap: 8px;
  }
}

.report-table {
  :deep(.el-table__header th) {
    background: $color-funeral-deepest !important;
  }

  .green-text {
    color: $color-status-success !important;
  }
}

.table-pagination {
  padding: 12px 20px;
  border-top: 1px solid $color-funeral-border;
  display: flex;
  justify-content: flex-end;
}

:deep(.el-radio-button__inner) {
  padding: 9px 16px !important;
}
</style>
