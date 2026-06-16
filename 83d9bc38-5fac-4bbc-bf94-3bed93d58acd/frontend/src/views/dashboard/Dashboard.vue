<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts'
import { useStatsStore } from '@/stores/stats'
import {
  Cpu,
  Calendar,
  TrendingUp,
  Clock,
  AlertCircle,
  Wrench,
  Bell,
  Award,
  ChevronRight,
  Activity
} from 'lucide-vue-next'
import dayjs from 'dayjs'

const statsStore = useStatsStore()

const trendChartRef = ref<HTMLDivElement>()
const pieChartRef = ref<HTMLDivElement>()
let trendChart: echarts.ECharts | null = null
let pieChart: echarts.ECharts | null = null

const initTrendChart = () => {
  if (!trendChartRef.value) return
  trendChart = echarts.init(trendChartRef.value)

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      borderColor: 'rgba(59, 130, 246, 0.3)',
      textStyle: { color: '#fff' },
      axisPointer: {
        type: 'cross',
        crossStyle: { color: '#3b82f6' }
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: statsStore.utilizationTrend?.xAxis || [],
      axisLine: { lineStyle: { color: '#475569' } },
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: {
        color: '#94a3b8',
        fontSize: 11,
        formatter: '{value}%'
      },
      splitLine: { lineStyle: { color: 'rgba(71, 85, 105, 0.3)', type: 'dashed' } }
    },
    series: [
      {
        name: '利用率',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: {
          width: 3,
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#3b82f6' },
            { offset: 1, color: '#8b5cf6' }
          ])
        },
        itemStyle: {
          color: '#3b82f6',
          borderColor: '#fff',
          borderWidth: 2
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
            { offset: 1, color: 'rgba(59, 130, 246, 0.02)' }
          ])
        },
        data: statsStore.utilizationTrend?.series[0]?.data || []
      }
    ]
  }

  trendChart.setOption(option)
}

const initPieChart = () => {
  if (!pieChartRef.value) return
  pieChart = echarts.init(pieChartRef.value)

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      borderColor: 'rgba(59, 130, 246, 0.3)',
      textStyle: { color: '#fff' },
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'center',
      textStyle: { color: '#94a3b8', fontSize: 12 },
      itemWidth: 12,
      itemHeight: 12,
      itemGap: 16
    },
    series: [
      {
        name: '设备类别',
        type: 'pie',
        radius: ['45%', '75%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: '#0f172a',
          borderWidth: 3
        },
        label: { show: false },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold',
            color: '#fff'
          },
          itemStyle: {
            shadowBlur: 20,
            shadowOffsetX: 0,
            shadowColor: 'rgba(59, 130, 246, 0.5)'
          }
        },
        labelLine: { show: false },
        data: statsStore.categoryDistribution.map((item, index) => ({
          value: item.value,
          name: item.name,
          itemStyle: {
            color: [
              '#3b82f6',
              '#8b5cf6',
              '#06b6d4',
              '#10b981',
              '#f59e0b',
              '#ef4444'
            ][index % 6]
          }
        }))
      }
    ]
  }

  pieChart.setOption(option)
}

const handleResize = () => {
  trendChart?.resize()
  pieChart?.resize()
}

const formatTime = (time: string) => {
  return dayjs(time).format('HH:mm')
}

const formatDate = (date: string) => {
  return dayjs(date).format('MM-DD HH:mm')
}

const getStatusText = (status: string) => {
  const map: Record<string, string> = {
    confirmed: '已确认',
    completed: '已完成',
    cancelled: '已取消',
    scheduled: '待处理',
    in_progress: '进行中'
  }
  return map[status] || status
}

const getStatusClass = (status: string) => {
  const map: Record<string, string> = {
    confirmed: 'bg-blue-500/20 text-blue-400',
    completed: 'bg-green-500/20 text-green-400',
    cancelled: 'bg-red-500/20 text-red-400',
    scheduled: 'bg-yellow-500/20 text-yellow-400',
    in_progress: 'bg-purple-500/20 text-purple-400'
  }
  return map[status] || 'bg-gray-500/20 text-gray-400'
}

watch(
  () => statsStore.utilizationTrend,
  () => {
    if (statsStore.utilizationTrend) {
      initTrendChart()
    }
  }
)

watch(
  () => statsStore.categoryDistribution,
  () => {
    if (statsStore.categoryDistribution.length > 0) {
      initPieChart()
    }
  }
)

onMounted(async () => {
  await statsStore.fetchAllDashboardData()
  initTrendChart()
  initPieChart()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  trendChart?.dispose()
  pieChart?.dispose()
})
</script>

<template>
  <div class="dashboard-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">数据仪表盘</h1>
        <p class="page-subtitle">实时监控系统运行状态</p>
      </div>
      <div class="header-time">
        <Clock class="w-4 h-4" />
        <span>{{ dayjs().format('YYYY年MM月DD日 HH:mm:ss') }}</span>
      </div>
    </div>

    <div class="stats-grid">
      <div
        v-for="(card, index) in [
          {
            icon: Cpu,
            label: '设备总数',
            value: statsStore.dashboardStats?.totalEquipment || 0,
            unit: '台',
            color: 'from-blue-500 to-blue-600',
            bgColor: 'bg-blue-500/10',
            iconColor: 'text-blue-400'
          },
          {
            icon: Calendar,
            label: '今日预约',
            value: statsStore.dashboardStats?.todayBookings || 0,
            unit: '次',
            color: 'from-emerald-500 to-emerald-600',
            bgColor: 'bg-emerald-500/10',
            iconColor: 'text-emerald-400'
          },
          {
            icon: TrendingUp,
            label: '本月利用率',
            value: statsStore.dashboardStats?.monthlyUtilization || 0,
            unit: '%',
            color: 'from-purple-500 to-purple-600',
            bgColor: 'bg-purple-500/10',
            iconColor: 'text-purple-400'
          },
          {
            icon: AlertCircle,
            label: '待办数量',
            value: statsStore.dashboardStats?.pendingCount || 0,
            unit: '项',
            color: 'from-amber-500 to-amber-600',
            bgColor: 'bg-amber-500/10',
            iconColor: 'text-amber-400'
          }
        ]"
        :key="index"
        class="stat-card"
        :style="{ animationDelay: `${index * 0.1}s` }"
      >
        <div class="stat-skeleton" v-if="statsStore.loading">
          <div class="skeleton-icon"></div>
          <div class="skeleton-content">
            <div class="skeleton-label"></div>
            <div class="skeleton-value"></div>
          </div>
        </div>
        <template v-else>
          <div class="stat-icon" :class="[card.bgColor, card.iconColor]">
            <component :is="card.icon" class="w-6 h-6" />
          </div>
          <div class="stat-content">
            <p class="stat-label">{{ card.label }}</p>
            <div class="stat-value-wrapper">
              <span class="stat-value">{{ card.value }}</span>
              <span class="stat-unit">{{ card.unit }}</span>
            </div>
          </div>
          <div class="stat-gradient" :class="card.color"></div>
        </template>
      </div>
    </div>

    <div class="charts-grid">
      <div class="chart-card">
        <div class="card-header">
          <div class="card-title">
            <Activity class="w-5 h-5 text-blue-400" />
            <span>利用率趋势（最近30天）</span>
          </div>
        </div>
        <div class="chart-skeleton" v-if="statsStore.loading">
          <div class="skeleton-chart"></div>
        </div>
        <div ref="trendChartRef" class="chart-container" v-else></div>
      </div>

      <div class="chart-card">
        <div class="card-header">
          <div class="card-title">
            <Cpu class="w-5 h-5 text-purple-400" />
            <span>设备类别分布</span>
          </div>
        </div>
        <div class="chart-skeleton" v-if="statsStore.loading">
          <div class="skeleton-chart"></div>
        </div>
        <div ref="pieChartRef" class="chart-container" v-else></div>
      </div>
    </div>

    <div class="content-grid">
      <div class="content-card">
        <div class="card-header">
          <div class="card-title">
            <Calendar class="w-5 h-5 text-emerald-400" />
            <span>今日预约</span>
          </div>
          <a href="#" class="card-more">
            查看全部 <ChevronRight class="w-4 h-4" />
          </a>
        </div>
        <div class="list-skeleton" v-if="statsStore.loading">
          <div v-for="i in 5" :key="i" class="skeleton-item">
            <div class="skeleton-dot"></div>
            <div class="skeleton-line-group">
              <div class="skeleton-line w-32"></div>
              <div class="skeleton-line w-24"></div>
            </div>
          </div>
        </div>
        <div class="content-list" v-else>
          <div
            v-for="booking in statsStore.todayBookings.slice(0, 5)"
            :key="booking.id"
            class="list-item"
          >
            <div class="item-icon bg-emerald-500/20 text-emerald-400">
              <Calendar class="w-4 h-4" />
            </div>
            <div class="item-content">
              <p class="item-title">{{ booking.equipmentName }}</p>
              <p class="item-desc">
                {{ formatTime(booking.startTime) }} - {{ formatTime(booking.endTime) }}
                · {{ booking.userName }}
              </p>
            </div>
            <span :class="['item-badge', getStatusClass(booking.status)]">
              {{ getStatusText(booking.status) }}
            </span>
          </div>
          <div v-if="statsStore.todayBookings.length === 0" class="empty-state">
            今日暂无预约
          </div>
        </div>
      </div>

      <div class="content-card">
        <div class="card-header">
          <div class="card-title">
            <AlertCircle class="w-5 h-5 text-amber-400" />
            <span>待办事项</span>
          </div>
        </div>
        <div class="list-skeleton" v-if="statsStore.loading">
          <div v-for="i in 3" :key="i" class="skeleton-item">
            <div class="skeleton-dot"></div>
            <div class="skeleton-line-group">
              <div class="skeleton-line w-32"></div>
              <div class="skeleton-line w-24"></div>
            </div>
          </div>
        </div>
        <div class="tabs-list" v-else>
          <div class="tab-section">
            <div class="tab-title">
              <Calendar class="w-4 h-4 text-blue-400" />
              <span>待审核预约</span>
              <span class="tab-count bg-blue-500/20 text-blue-400">
                {{ statsStore.pendingBookings.length }}
              </span>
            </div>
            <div class="tab-content">
              <div
                v-for="booking in statsStore.pendingBookings.slice(0, 3)"
                :key="booking.id"
                class="tab-item"
              >
                <span class="tab-item-title">{{ booking.equipmentName }}</span>
                <span class="tab-item-time">{{ formatDate(booking.startTime) }}</span>
              </div>
              <div v-if="statsStore.pendingBookings.length === 0" class="tab-empty">
                暂无待审核预约
              </div>
            </div>
          </div>

          <div class="tab-section">
            <div class="tab-title">
              <Wrench class="w-4 h-4 text-orange-400" />
              <span>待处理维护</span>
              <span class="tab-count bg-orange-500/20 text-orange-400">
                {{ statsStore.pendingMaintenance.length }}
              </span>
            </div>
            <div class="tab-content">
              <div
                v-for="maintenance in statsStore.pendingMaintenance.slice(0, 3)"
                :key="maintenance.id"
                class="tab-item"
              >
                <span class="tab-item-title">{{ maintenance.equipmentName }}</span>
                <span class="tab-item-time">{{ formatDate(maintenance.startTime) }}</span>
              </div>
              <div v-if="statsStore.pendingMaintenance.length === 0" class="tab-empty">
                暂无待处理维护
              </div>
            </div>
          </div>

          <div class="tab-section">
            <div class="tab-title">
              <Bell class="w-4 h-4 text-purple-400" />
              <span>未读通知</span>
              <span class="tab-count bg-purple-500/20 text-purple-400">
                {{ statsStore.unreadNotifications.length }}
              </span>
            </div>
            <div class="tab-content">
              <div
                v-for="notification in statsStore.unreadNotifications.slice(0, 3)"
                :key="notification.id"
                class="tab-item"
              >
                <span class="tab-item-title">{{ notification.title }}</span>
                <span class="tab-item-time">{{ formatDate(notification.createdAt) }}</span>
              </div>
              <div v-if="statsStore.unreadNotifications.length === 0" class="tab-empty">
                暂无未读通知
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="content-card">
        <div class="card-header">
          <div class="card-title">
            <Award class="w-5 h-5 text-yellow-400" />
            <span>各中心利用率排行</span>
          </div>
        </div>
        <div class="list-skeleton" v-if="statsStore.loading">
          <div v-for="i in 5" :key="i" class="skeleton-item">
            <div class="skeleton-rank"></div>
            <div class="skeleton-line-group">
              <div class="skeleton-line w-24"></div>
              <div class="skeleton-progress"></div>
            </div>
          </div>
        </div>
        <div class="ranking-list" v-else>
          <div
            v-for="(center, index) in statsStore.centerRanking"
            :key="center.centerId"
            class="ranking-item"
          >
            <div
              :class="[
                'ranking-number',
                index === 0 ? 'bg-yellow-500 text-white' :
                index === 1 ? 'bg-gray-400 text-white' :
                index === 2 ? 'bg-amber-600 text-white' :
                'bg-slate-700 text-slate-300'
              ]"
            >
              {{ index + 1 }}
            </div>
            <div class="ranking-content">
              <div class="ranking-header">
                <span class="ranking-name">{{ center.centerName }}</span>
                <span class="ranking-value">{{ center.utilizationRate.toFixed(1) }}%</span>
              </div>
              <div class="ranking-bar">
                <div
                  class="ranking-progress"
                  :style="{
                    width: `${Math.min(center.utilizationRate, 100)}%`,
                    background: `linear-gradient(90deg, ${
                      index === 0 ? '#eab308' :
                      index === 1 ? '#9ca3af' :
                      index === 2 ? '#d97706' :
                      '#3b82f6'
                    }, ${
                      index === 0 ? '#fbbf24' :
                      index === 1 ? '#d1d5db' :
                      index === 2 ? '#f59e0b' :
                      '#60a5fa'
                    })`
                  }"
                ></div>
              </div>
            </div>
          </div>
          <div v-if="statsStore.centerRanking.length === 0" class="empty-state">
            暂无数据
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-container {
  padding: 24px;
  background: #0f172a;
  min-height: 100vh;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  color: #f1f5f9;
  margin: 0 0 4px 0;
}

.page-subtitle {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

.header-time {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #94a3b8;
  font-size: 14px;
  background: rgba(30, 41, 59, 0.5);
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid rgba(71, 85, 105, 0.3);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 24px;
}

.stat-card {
  position: relative;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(71, 85, 105, 0.3);
  border-radius: 16px;
  padding: 24px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  animation: fadeInUp 0.6s ease-out backwards;
}

.stat-card:hover {
  transform: translateY(-4px);
  border-color: rgba(59, 130, 246, 0.5);
  box-shadow:
    0 20px 40px -12px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(59, 130, 246, 0.2);
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  transition: all 0.3s ease;
}

.stat-card:hover .stat-icon {
  transform: scale(1.1);
}

.stat-content {
  position: relative;
  z-index: 1;
}

.stat-label {
  font-size: 14px;
  color: #94a3b8;
  margin: 0 0 8px 0;
}

.stat-value-wrapper {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: #f1f5f9;
  line-height: 1;
}

.stat-unit {
  font-size: 14px;
  color: #64748b;
}

.stat-gradient {
  position: absolute;
  top: 0;
  right: 0;
  width: 120px;
  height: 120px;
  opacity: 0.1;
  border-radius: 50%;
  filter: blur(40px);
  transform: translate(30%, -30%);
  transition: all 0.3s ease;
}

.stat-card:hover .stat-gradient {
  opacity: 0.2;
  transform: translate(20%, -20%) scale(1.2);
}

.charts-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 20px;
  margin-bottom: 24px;
}

.chart-card,
.content-card {
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(71, 85, 105, 0.3);
  border-radius: 16px;
  padding: 24px;
  transition: all 0.3s ease;
}

.chart-card:hover,
.content-card:hover {
  border-color: rgba(59, 130, 246, 0.3);
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.3);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #f1f5f9;
}

.card-more {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #64748b;
  text-decoration: none;
  transition: color 0.3s ease;
}

.card-more:hover {
  color: #3b82f6;
}

.chart-container {
  width: 100%;
  height: 320px;
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 20px;
}

.content-list,
.ranking-list,
.tabs-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.list-item,
.ranking-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(30, 41, 59, 0.5);
  transition: all 0.3s ease;
}

.list-item:hover,
.ranking-item:hover {
  background: rgba(59, 130, 246, 0.1);
  transform: translateX(4px);
}

.item-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-title {
  font-size: 14px;
  font-weight: 500;
  color: #e2e8f0;
  margin: 0 0 4px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-desc {
  font-size: 12px;
  color: #64748b;
  margin: 0;
}

.item-badge {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  flex-shrink: 0;
}

.ranking-number {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
}

.ranking-content {
  flex: 1;
  min-width: 0;
}

.ranking-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.ranking-name {
  font-size: 14px;
  font-weight: 500;
  color: #e2e8f0;
}

.ranking-value {
  font-size: 14px;
  font-weight: 600;
  color: #3b82f6;
}

.ranking-bar {
  height: 6px;
  background: rgba(71, 85, 105, 0.3);
  border-radius: 3px;
  overflow: hidden;
}

.ranking-progress {
  height: 100%;
  border-radius: 3px;
  transition: width 0.8s ease;
}

.tab-section {
  margin-bottom: 16px;
}

.tab-section:last-child {
  margin-bottom: 0;
}

.tab-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #94a3b8;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(71, 85, 105, 0.2);
}

.tab-count {
  margin-left: auto;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tab-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(30, 41, 59, 0.3);
  transition: all 0.3s ease;
}

.tab-item:hover {
  background: rgba(59, 130, 246, 0.1);
}

.tab-item-title {
  font-size: 13px;
  color: #cbd5e1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.tab-item-time {
  font-size: 12px;
  color: #64748b;
  flex-shrink: 0;
  margin-left: 12px;
}

.tab-empty,
.empty-state {
  text-align: center;
  padding: 20px;
  color: #64748b;
  font-size: 13px;
}

.skeleton-icon,
.skeleton-dot,
.skeleton-rank,
.skeleton-label,
.skeleton-value,
.skeleton-line,
.skeleton-progress,
.skeleton-chart {
  background: linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: 8px;
}

@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.stat-skeleton {
  display: flex;
  align-items: center;
  gap: 16px;
}

.skeleton-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
}

.skeleton-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-label {
  height: 14px;
  width: 60px;
}

.skeleton-value {
  height: 32px;
  width: 100px;
}

.chart-skeleton {
  padding: 16px 0;
}

.skeleton-chart {
  width: 100%;
  height: 320px;
  border-radius: 12px;
}

.list-skeleton {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.skeleton-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.skeleton-dot {
  width: 36px;
  height: 36px;
  border-radius: 10px;
}

.skeleton-rank {
  width: 28px;
  height: 28px;
  border-radius: 8px;
}

.skeleton-line-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-line {
  height: 14px;
}

.skeleton-progress {
  height: 6px;
  width: 100%;
}

@media (max-width: 1280px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .charts-grid {
    grid-template-columns: 1fr;
  }

  .content-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .dashboard-container {
    padding: 16px;
  }

  .stats-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .page-title {
    font-size: 22px;
  }

  .stat-value {
    font-size: 24px;
  }

  .chart-container {
    height: 280px;
  }
}
</style>
