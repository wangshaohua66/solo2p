<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import { ElCard } from 'element-plus'
import * as echarts from 'echarts/core'
import { LineChart, PieChart, BarChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { use } from 'echarts/core'
import { Calendar, Monitor, User, Picture, Plus, Upload, Reading, MagicStick } from '@element-plus/icons-vue'

use([
  LineChart,
  PieChart,
  BarChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  CanvasRenderer
])

const authStore = useAuthStore()
const router = useRouter()

const memberGrowthChartRef = ref<HTMLElement>()
const pieceStatusChartRef = ref<HTMLElement>()
const kilnUsageChartRef = ref<HTMLElement>()

let memberGrowthChart: echarts.ECharts | null = null
let pieceStatusChart: echarts.ECharts | null = null
let kilnUsageChart: echarts.ECharts | null = null

const stats = ref([
  { label: '今日排课', value: '3', icon: Calendar, color: '#5b8ff9', link: '/courses' },
  { label: '窑炉运行中', value: '1', icon: Monitor, color: '#c85a32', link: '/kiln' },
  { label: '活跃会员', value: '80', icon: User, color: '#52c41a', link: '/members' },
  { label: '作品总数', value: '256', icon: Picture, color: '#722ed1', link: '/pieces' }
])

const quickActions = [
  { label: '新建排程', icon: Plus, link: '/kiln', type: 'primary' },
  { label: '上传作品', icon: Upload, link: '/pieces', type: 'success' },
  { label: '发布课程', icon: Reading, link: '/courses', type: 'warning' },
  { label: '配方管理', icon: MagicStick, link: '/glaze-recipes', type: 'info' }
]

const memberGrowthData = {
  months: ['1月', '2月', '3月', '4月', '5月', '6月'],
  members: [45, 52, 58, 65, 72, 80],
  newMembers: [8, 7, 6, 9, 7, 8]
}

const pieceStatusData = [
  { value: 45, name: '泥坯阶段', color: '#d4a574' },
  { value: 68, name: '素烧完成', color: '#8c8c8c' },
  { value: 52, name: '施釉中', color: '#c85a32' },
  { value: 91, name: '成品', color: '#52c41a' }
]

const kilnUsageData = {
  days: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
  electricKiln: [6, 8, 7, 9, 10, 12, 8],
  gasKiln: [4, 5, 6, 7, 8, 10, 6],
  woodKiln: [2, 3, 2, 4, 5, 6, 3]
}

const recentPieces = ref([
  { id: '1', title: '青花瓷茶盏', author: '张小明', stage: 'finished', image: '', date: '2024-01-15' },
  { id: '2', title: '手工捏塑花瓶', author: '李雨晴', stage: 'glaze', image: '', date: '2024-01-14' },
  { id: '3', title: '拉坯碗', author: '王大伟', stage: 'bisque', image: '', date: '2024-01-13' },
  { id: '4', title: '釉下彩盘子', author: '陈思远', stage: 'clay', image: '', date: '2024-01-12' }
])

const upcomingSchedules = ref([
  { id: '1', kiln: '电窑A', title: '素烧 - 第24期课程作品', time: '今天 09:00 - 17:00', status: 'running' },
  { id: '2', kiln: '汽窑B', title: '釉烧 - 会员作品', time: '明天 08:00 - 20:00', status: 'pending' },
  { id: '3', kiln: '柴窑', title: '还原焰 - 大师班', time: '周六 10:00 - 周日 18:00', status: 'pending' }
])

const handleQuickAction = (action: any) => {
  router.push(action.link)
}

const getStageLabel = (stage: string) => {
  const map: Record<string, string> = {
    clay: '泥坯',
    bisque: '素烧',
    glaze: '施釉',
    finished: '成品'
  }
  return map[stage] || stage
}

const getStageColor = (stage: string) => {
  const map: Record<string, string> = {
    clay: '#d4a574',
    bisque: '#8c8c8c',
    glaze: '#c85a32',
    finished: '#52c41a'
  }
  return map[stage] || '#999'
}

const initCharts = () => {
  if (memberGrowthChartRef.value) {
    memberGrowthChart = echarts.init(memberGrowthChartRef.value)
    memberGrowthChart.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['会员总数', '新增会员'], bottom: 0 },
      grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
      xAxis: {
        type: 'category',
        data: memberGrowthData.months,
        axisLine: { lineStyle: { color: '#e8e0d5' } }
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: '#e8e0d5' } },
        splitLine: { lineStyle: { color: '#f0ebe3' } }
      },
      series: [
        {
          name: '会员总数',
          type: 'line',
          smooth: true,
          data: memberGrowthData.members,
          lineStyle: { color: '#c85a32', width: 2 },
          itemStyle: { color: '#c85a32' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(200, 90, 50, 0.3)' },
              { offset: 1, color: 'rgba(200, 90, 50, 0.05)' }
            ])
          }
        },
        {
          name: '新增会员',
          type: 'line',
          smooth: true,
          data: memberGrowthData.newMembers,
          lineStyle: { color: '#52c41a', width: 2 },
          itemStyle: { color: '#52c41a' }
        }
      ]
    })
  }

  if (pieceStatusChartRef.value) {
    pieceStatusChart = echarts.init(pieceStatusChartRef.value)
    pieceStatusChart.setOption({
      tooltip: { trigger: 'item', formatter: '{b}: {c}件 ({d}%)' },
      legend: { orient: 'vertical', left: 'left', top: 'center' },
      series: [
        {
          name: '作品状态',
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['65%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 6,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: { show: false },
          emphasis: {
            label: { show: true, fontSize: 14, fontWeight: 'bold' }
          },
          data: pieceStatusData.map(item => ({
            value: item.value,
            name: item.name,
            itemStyle: { color: item.color }
          }))
        }
      ]
    })
  }

  if (kilnUsageChartRef.value) {
    kilnUsageChart = echarts.init(kilnUsageChartRef.value)
    kilnUsageChart.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: ['电窑', '汽窑', '柴窑'], bottom: 0 },
      grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
      xAxis: {
        type: 'category',
        data: kilnUsageData.days,
        axisLine: { lineStyle: { color: '#e8e0d5' } }
      },
      yAxis: {
        type: 'value',
        name: '使用时长(h)',
        axisLine: { lineStyle: { color: '#e8e0d5' } },
        splitLine: { lineStyle: { color: '#f0ebe3' } }
      },
      series: [
        {
          name: '电窑',
          type: 'bar',
          stack: 'total',
          data: kilnUsageData.electricKiln,
          itemStyle: { color: '#5b8ff9', borderRadius: [0, 0, 0, 0] }
        },
        {
          name: '汽窑',
          type: 'bar',
          stack: 'total',
          data: kilnUsageData.gasKiln,
          itemStyle: { color: '#f6bd16' }
        },
        {
          name: '柴窑',
          type: 'bar',
          stack: 'total',
          data: kilnUsageData.woodKiln,
          itemStyle: { color: '#c85a32', borderRadius: [4, 4, 0, 0] }
        }
      ]
    })
  }
}

const handleResize = () => {
  memberGrowthChart?.resize()
  pieceStatusChart?.resize()
  kilnUsageChart?.resize()
}

onMounted(() => {
  setTimeout(() => {
    initCharts()
    window.addEventListener('resize', handleResize)
  }, 100)
})
</script>

<template>
  <div class="dashboard">
    <div class="welcome-card">
      <div class="welcome-text">
        <h2>你好，{{ authStore.user?.username || '陶艺爱好者' }} 👋</h2>
        <p>欢迎来到陶艺工坊管理系统，今天是创作的好日子！</p>
      </div>
      <div class="welcome-illustration">
        <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="60" cy="100" rx="35" ry="8" fill="#c85a32" opacity="0.2"/>
          <path d="M30 100C30 75 40 55 60 55C80 55 90 75 90 100" stroke="#c85a32" stroke-width="4" fill="none"/>
          <ellipse cx="60" cy="55" rx="18" ry="8" fill="#d4a574"/>
          <rect x="55" y="25" width="10" height="30" rx="3" fill="#c85a32"/>
          <ellipse cx="60" cy="25" rx="6" ry="3" fill="#e07a52"/>
          <circle cx="85" cy="40" r="6" fill="#faad14" opacity="0.6"/>
          <circle cx="35" cy="50" r="4" fill="#52c41a" opacity="0.6"/>
        </svg>
      </div>
    </div>

    <div class="stats-grid">
      <div 
        v-for="stat in stats" 
        :key="stat.label" 
        class="stat-card"
        @click="router.push(stat.link)"
      >
        <div class="stat-icon" :style="{ backgroundColor: stat.color + '20', color: stat.color }">
          <el-icon :size="28"><component :is="stat.icon" /></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stat.value }}</div>
          <div class="stat-label">{{ stat.label }}</div>
        </div>
      </div>
    </div>

    <div class="quick-actions">
      <h3 class="section-title">快捷操作</h3>
      <div class="action-grid">
        <el-button
          v-for="action in quickActions"
          :key="action.label"
          :type="action.type"
          size="large"
          @click="handleQuickAction(action)"
          class="action-btn"
        >
          <el-icon><component :is="action.icon" /></el-icon>
          <span>{{ action.label }}</span>
        </el-button>
      </div>
    </div>

    <div class="content-grid">
      <el-card class="section-card">
        <template #header>
          <div class="card-header">
            <span>近期作品</span>
            <el-button type="primary" link @click="router.push('/pieces')">查看全部 →</el-button>
          </div>
        </template>
        <div class="piece-list">
          <div 
            v-for="piece in recentPieces" 
            :key="piece.id" 
            class="piece-item"
            @click="router.push(`/pieces/${piece.id}`)"
          >
            <div class="piece-thumb">
              <svg viewBox="0 0 60 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                <ellipse cx="30" cy="72" rx="18" ry="4" fill="#c85a32" opacity="0.2"/>
                <path d="M15 72C15 50 20 30 30 30C40 30 45 50 45 72" :stroke="getStageColor(piece.stage)" stroke-width="2.5" fill="none"/>
                <ellipse cx="30" cy="30" rx="9" ry="4" :fill="getStageColor(piece.stage)" opacity="0.5"/>
              </svg>
            </div>
            <div class="piece-info">
              <div class="piece-title">{{ piece.title }}</div>
              <div class="piece-meta">
                <span>{{ piece.author }}</span>
                <el-tag size="small" :style="{ backgroundColor: getStageColor(piece.stage) + '20', color: getStageColor(piece.stage), border: 'none' }">
                  {{ getStageLabel(piece.stage) }}
                </el-tag>
              </div>
            </div>
          </div>
        </div>
      </el-card>

      <el-card class="section-card">
        <template #header>
          <div class="card-header">
            <span>窑炉排程</span>
            <el-button type="primary" link @click="router.push('/kiln')">查看全部 →</el-button>
          </div>
        </template>
        <div class="schedule-list">
          <div 
            v-for="schedule in upcomingSchedules" 
            :key="schedule.id" 
            class="schedule-item"
          >
            <div class="schedule-status" :class="schedule.status"></div>
            <div class="schedule-info">
              <div class="schedule-title">{{ schedule.title }}</div>
              <div class="schedule-meta">
                <el-tag size="small" type="info" effect="plain">{{ schedule.kiln }}</el-tag>
                <span class="schedule-time">{{ schedule.time }}</span>
              </div>
            </div>
          </div>
        </div>
      </el-card>
    </div>

    <div class="charts-grid">
      <el-card class="chart-card">
        <template #header>
          <div class="card-header">
            <span>会员增长趋势</span>
          </div>
        </template>
        <div ref="memberGrowthChartRef" class="chart-container"></div>
      </el-card>

      <el-card class="chart-card">
        <template #header>
          <div class="card-header">
            <span>作品状态分布</span>
          </div>
        </template>
        <div ref="pieceStatusChartRef" class="chart-container"></div>
      </el-card>

      <el-card class="chart-card chart-card-full">
        <template #header>
          <div class="card-header">
            <span>窑炉使用率（本周）</span>
          </div>
        </template>
        <div ref="kilnUsageChartRef" class="chart-container horizontal-chart"></div>
      </el-card>
    </div>
  </div>
</template>

<style scoped lang="scss">
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.welcome-card {
  background: linear-gradient(135deg, $color-primary 0%, $color-primary-light 100%);
  border-radius: $border-radius-lg;
  padding: 32px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: white;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -10%;
    width: 300px;
    height: 300px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 50%;
  }

  &::after {
    content: '';
    position: absolute;
    bottom: -30%;
    left: -5%;
    width: 200px;
    height: 200px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 50%;
  }

  @media (max-width: $breakpoint-mobile) {
    padding: 20px;
    flex-direction: column;
    text-align: center;
    gap: 20px;
  }
}

.welcome-text {
  position: relative;
  z-index: 1;

  h2 {
    font-size: 24px;
    margin: 0 0 8px 0;
  }

  p {
    margin: 0;
    opacity: 0.9;
    font-size: 14px;
  }
}

.welcome-illustration {
  width: 120px;
  height: 120px;
  position: relative;
  z-index: 1;

  svg {
    width: 100%;
    height: 100%;
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;

  @media (max-width: 1024px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: $breakpoint-mobile) {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
}

.stat-card {
  background: white;
  border-radius: $border-radius-md;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  cursor: pointer;
  transition: all $transition-normal;
  box-shadow: $shadow-sm;

  &:hover {
    transform: translateY(-2px);
    box-shadow: $shadow-md;
  }

  @media (max-width: $breakpoint-mobile) {
    padding: 16px;
    gap: 12px;
  }
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: $border-radius-md;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  @media (max-width: $breakpoint-mobile) {
    width: 48px;
    height: 48px;
  }
}

.stat-content {
  flex: 1;
  min-width: 0;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: $color-text-primary;
  line-height: 1.2;

  @media (max-width: $breakpoint-mobile) {
    font-size: 22px;
  }
}

.stat-label {
  font-size: 14px;
  color: $color-text-secondary;
  margin-top: 4px;

  @media (max-width: $breakpoint-mobile) {
    font-size: 13px;
  }
}

.quick-actions {
  background: white;
  border-radius: $border-radius-md;
  padding: 20px;
  box-shadow: $shadow-sm;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: $color-text-primary;
  margin: 0 0 16px 0;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;

  @media (max-width: 1024px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: $breakpoint-mobile) {
    grid-template-columns: repeat(2, 1fr);
  }
}

.action-btn {
  height: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 13px;

  .el-icon {
    font-size: 20px;
  }
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
}

.section-card {
  :deep(.el-card__body) {
    padding: 0;
  }

  :deep(.el-card__header) {
    padding: 16px 20px;
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
}

.piece-list {
  padding: 8px 0;
}

.piece-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  cursor: pointer;
  transition: background $transition-fast;

  &:hover {
    background: $color-bg;
  }
}

.piece-thumb {
  width: 50px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $color-bg;
  border-radius: $border-radius-sm;

  svg {
    width: 30px;
    height: 40px;
  }
}

.piece-info {
  flex: 1;
  min-width: 0;
}

.piece-title {
  font-size: 14px;
  font-weight: 500;
  color: $color-text-primary;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.piece-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: $color-text-secondary;
}

.schedule-list {
  padding: 8px 0;
}

.schedule-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 20px;
}

.schedule-status {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-top: 5px;
  flex-shrink: 0;

  &.running {
    background: $color-success;
    box-shadow: 0 0 8px $color-success;
    animation: pulse 2s infinite;
  }

  &.pending {
    background: $color-warning;
  }

  &.completed {
    background: $color-text-placeholder;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.schedule-info {
  flex: 1;
  min-width: 0;
}

.schedule-title {
  font-size: 14px;
  font-weight: 500;
  color: $color-text-primary;
  margin-bottom: 6px;
}

.schedule-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.schedule-time {
  font-size: 12px;
  color: $color-text-secondary;
}

.charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
}

.chart-card {
  :deep(.el-card__body) {
    padding: 16px 20px;
  }
}

.chart-card-full {
  grid-column: span 2;

  @media (max-width: 1024px) {
    grid-column: span 1;
  }
}

.chart-container {
  width: 100%;
  height: 300px;

  &.horizontal-chart {
    height: 280px;
  }

  @media (max-width: $breakpoint-mobile) {
    height: 250px;
  }
}
</style>
