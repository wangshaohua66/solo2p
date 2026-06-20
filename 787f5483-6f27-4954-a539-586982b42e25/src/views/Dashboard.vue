<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkflowStore } from '@/stores/workflow'
import { useScheduleStore } from '@/stores/schedule'
import { useUserStore } from '@/stores/user'
import * as echarts from 'echarts/core'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DatasetComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { formatDate, formatDuration } from '@/utils'

echarts.use([
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DatasetComponent,
  BarChart,
  LineChart,
  PieChart,
  CanvasRenderer
])

const router = useRouter()
const workflowStore = useWorkflowStore()
const scheduleStore = useScheduleStore()
const userStore = useUserStore()

const loading = ref(true)

const stats = ref({
  todayTopics: 12,
  pendingReviews: 5,
  todayMaterials: 28,
  todayBroadcast: 72
})

const topicTypeChart = computed(() => ({
  tooltip: {
    trigger: 'item',
    formatter: '{b}: {c} ({d}%)'
  },
  legend: {
    bottom: '5%',
    textStyle: { color: '#8b949e' }
  },
  series: [
    {
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['50%', '40%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 8,
        borderColor: '#1c2128',
        borderWidth: 2
      },
      label: {
        show: false
      },
      emphasis: {
        label: {
          show: true,
          fontSize: 14,
          fontWeight: 'bold',
          color: '#e6edf3'
        }
      },
      data: [
        { value: 35, name: '新闻', itemStyle: { color: '#409eff' } },
        { value: 25, name: '专题', itemStyle: { color: '#67c23a' } },
        { value: 20, name: '综艺', itemStyle: { color: '#e6a23c' } },
        { value: 20, name: '电视剧', itemStyle: { color: '#f56c6c' } }
      ]
    }
  ]
}))

const workflowTrendChart = computed(() => ({
  tooltip: {
    trigger: 'axis',
    backgroundColor: '#21262d',
    borderColor: '#30363d',
    textStyle: { color: '#e6edf3' }
  },
  legend: {
    data: ['选题数量', '素材数量'],
    textStyle: { color: '#8b949e' },
    top: 0
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
    data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    axisLine: { lineStyle: { color: '#30363d' } },
    axisLabel: { color: '#8b949e' }
  },
  yAxis: {
    type: 'value',
    axisLine: { lineStyle: { color: '#30363d' } },
    axisLabel: { color: '#8b949e' },
    splitLine: { lineStyle: { color: '#21262d' } }
  },
  series: [
    {
      name: '选题数量',
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 8,
      lineStyle: { color: '#409eff', width: 3 },
      itemStyle: { color: '#409eff' },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(64, 158, 255, 0.3)' },
            { offset: 1, color: 'rgba(64, 158, 255, 0.05)' }
          ]
        }
      },
      data: [12, 18, 15, 22, 19, 8, 10]
    },
    {
      name: '素材数量',
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 8,
      lineStyle: { color: '#67c23a', width: 3 },
      itemStyle: { color: '#67c23a' },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(103, 194, 58, 0.3)' },
            { offset: 1, color: 'rgba(103, 194, 58, 0.05)' }
          ]
        }
      },
      data: [28, 35, 42, 38, 45, 20, 25]
    }
  ]
}))

const channelLoadChart = computed(() => ({
  tooltip: {
    trigger: 'axis',
    backgroundColor: '#21262d',
    borderColor: '#30363d',
    textStyle: { color: '#e6edf3' }
  },
  grid: {
    left: '3%',
    right: '4%',
    bottom: '3%',
    top: '10%',
    containLabel: true
  },
  xAxis: {
    type: 'category',
    data: ['新闻综合', '都市生活', '公共频道'],
    axisLine: { lineStyle: { color: '#30363d' } },
    axisLabel: { color: '#8b949e' }
  },
  yAxis: {
    type: 'value',
    name: '小时',
    axisLine: { lineStyle: { color: '#30363d' } },
    axisLabel: { color: '#8b949e' },
    splitLine: { lineStyle: { color: '#21262d' } }
  },
  series: [
    {
      type: 'bar',
      barWidth: '50%',
      itemStyle: {
        borderRadius: [8, 8, 0, 0],
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: '#409eff' },
            { offset: 1, color: '#337ecc' }
          ]
        }
      },
      data: [72, 72, 72]
    }
  ]
}))

const recentTopics = ref([
  { id: 1, title: '城市轨道交通建设进展跟踪报道', status: 'reviewing', type: 'news', channel: 'news', createdAt: '2024-01-15 10:30' },
  { id: 2, title: '春节联欢晚会筹备专题', status: 'in_production', type: 'variety', channel: 'city', createdAt: '2024-01-15 09:15' },
  { id: 3, title: '乡村振兴系列报道之特色农业', status: 'approved', type: 'feature', channel: 'public', createdAt: '2024-01-14 16:45' },
  { id: 4, title: '冬季消防安全提示专题', status: 'submitted', type: 'news', channel: 'news', createdAt: '2024-01-14 14:20' },
  { id: 5, title: '《都市情缘》第125期', status: 'completed', type: 'drama', channel: 'city', createdAt: '2024-01-13 11:00' }
])

const statusMap: Record<string, { text: string; class: string }> = {
  draft: { text: '草稿', class: 'tag--info' },
  submitted: { text: '已提交', class: 'tag--primary' },
  reviewing: { text: '审核中', class: 'tag--warning' },
  approved: { text: '已通过', class: 'tag--success' },
  rejected: { text: '已退回', class: 'tag--danger' },
  in_production: { text: '制作中', class: 'tag--primary' },
  completed: { text: '已完成', class: 'tag--success' },
  archived: { text: '已归档', class: 'tag--info' }
}

const typeMap: Record<string, string> = {
  news: '新闻',
  feature: '专题',
  variety: '综艺',
  drama: '电视剧'
}

function handleQuickAction(action: string) {
  switch (action) {
    case 'create-topic':
      router.push('/topics?action=create')
      break
    case 'upload-material':
      router.push('/materials?action=upload')
      break
    case 'view-reviews':
      router.push('/workflow')
      break
    case 'edit-schedule':
      router.push('/schedule')
      break
  }
}

function viewTopic(id: number) {
  router.push(`/topics/${id}`)
}

onMounted(async () => {
  await Promise.all([
    workflowStore.fetchTopics({ page: 1, pageSize: 10 }),
    scheduleStore.fetchSchedule()
  ])
  loading.value = false
})
</script>

<template>
  <div class="page-container dashboard">
    <div class="page-header">
      <div class="page-header__title">
        工作台
        <span class="greeting">
          你好，{{ userStore.userInfo?.name }}，今天是 {{ formatDate(new Date(), 'YYYY年MM月DD日 dddd') }}
        </span>
      </div>
      <div class="page-header__actions">
        <el-button type="primary" @click="handleQuickAction('create-topic')">
          <el-icon><Plus /></el-icon>新建选题
        </el-button>
        <el-button @click="handleQuickAction('upload-material')">
          <el-icon><Upload /></el-icon>上传素材
        </el-button>
      </div>
    </div>
    
    <el-row :gutter="16" class="stats-row">
      <el-col :xs="12" :sm="6">
        <div class="stat-card" @click="handleQuickAction('create-topic')">
          <div class="stat-icon icon-blue">
            <el-icon :size="28"><EditPen /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.todayTopics }}</div>
            <div class="stat-label">今日选题</div>
          </div>
          <el-icon class="stat-arrow"><ArrowRight /></el-icon>
        </div>
      </el-col>
      <el-col :xs="12" :sm="6">
        <div class="stat-card" @click="handleQuickAction('view-reviews')">
          <div class="stat-icon icon-warning">
            <el-icon :size="28"><CircleCheck /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.pendingReviews }}</div>
            <div class="stat-label">待审核</div>
          </div>
          <el-icon class="stat-arrow"><ArrowRight /></el-icon>
        </div>
      </el-col>
      <el-col :xs="12" :sm="6">
        <div class="stat-card" @click="handleQuickAction('upload-material')">
          <div class="stat-icon icon-success">
            <el-icon :size="28"><Folder /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.todayMaterials }}</div>
            <div class="stat-label">今日素材</div>
          </div>
          <el-icon class="stat-arrow"><ArrowRight /></el-icon>
        </div>
      </el-col>
      <el-col :xs="12" :sm="6">
        <div class="stat-card" @click="handleQuickAction('edit-schedule')">
          <div class="stat-icon icon-danger">
            <el-icon :size="28"><VideoPlay /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ formatDuration(stats.todayBroadcast * 3600) }}</div>
            <div class="stat-label">今日播出时长</div>
          </div>
          <el-icon class="stat-arrow"><ArrowRight /></el-icon>
        </div>
      </el-col>
    </el-row>
    
    <el-row :gutter="16">
      <el-col :lg="16" :md="24">
        <div class="card chart-card">
          <div class="card-header">
            <span class="card-title">工作趋势</span>
            <span class="card-subtitle">近7天选题与素材数量</span>
          </div>
          <v-chart :option="workflowTrendChart" style="height: 300px" autoresize />
        </div>
      </el-col>
      <el-col :lg="8" :md="24">
        <div class="card chart-card">
          <div class="card-header">
            <span class="card-title">内容类型分布</span>
          </div>
          <v-chart :option="topicTypeChart" style="height: 300px" autoresize />
        </div>
      </el-col>
    </el-row>
    
    <el-row :gutter="16">
      <el-col :lg="12" :md="24">
        <div class="card">
          <div class="card-header">
            <span class="card-title">最近选题</span>
            <el-button type="primary" link @click="router.push('/topics')">查看全部</el-button>
          </div>
          <div class="topic-list">
            <div
              v-for="topic in recentTopics"
              :key="topic.id"
              class="topic-item"
              @click="viewTopic(topic.id)"
            >
              <div class="topic-info">
                <div class="topic-title">{{ topic.title }}</div>
                <div class="topic-meta">
                  <span class="tag" :class="'tag--' + (topic.type === 'news' ? 'primary' : topic.type === 'feature' ? 'success' : topic.type === 'variety' ? 'warning' : 'danger')">
                    {{ typeMap[topic.type] }}
                  </span>
                  <span class="topic-time">{{ topic.createdAt }}</span>
                </div>
              </div>
              <span class="tag" :class="statusMap[topic.status].class">
                {{ statusMap[topic.status].text }}
              </span>
            </div>
          </div>
        </div>
      </el-col>
      <el-col :lg="12" :md="24">
        <div class="card chart-card">
          <div class="card-header">
            <span class="card-title">频道播出负荷</span>
          </div>
          <v-chart :option="channelLoadChart" style="height: 300px" autoresize />
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<style lang="scss" scoped>
.dashboard {
  .greeting {
    margin-left: 12px;
    font-size: 14px;
    font-weight: normal;
    color: var(--text-color-secondary);
  }
}

.stats-row {
  margin-bottom: 16px;
}

.stat-card {
  display: flex;
  align-items: center;
  padding: 20px;
  background-color: var(--bg-color-card);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  
  &:hover {
    border-color: var(--primary-color);
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: var(--border-radius-md);
  margin-right: 16px;
  color: #fff;
  
  &.icon-blue {
    background: linear-gradient(135deg, #667eea 0%, #409eff 100%);
  }
  
  &.icon-warning {
    background: linear-gradient(135deg, #f093fb 0%, #e6a23c 100%);
  }
  
  &.icon-success {
    background: linear-gradient(135deg, #43e97b 0%, #67c23a 100%);
  }
  
  &.icon-danger {
    background: linear-gradient(135deg, #fa709a 0%, #f56c6c 100%);
  }
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: 600;
  color: var(--text-color-primary);
  line-height: 1.2;
}

.stat-label {
  font-size: 13px;
  color: var(--text-color-secondary);
  margin-top: 4px;
}

.stat-arrow {
  color: var(--text-color-tertiary);
  transition: transform var(--transition-fast);
}

.stat-card:hover .stat-arrow {
  transform: translateX(4px);
  color: var(--primary-color);
}

.chart-card {
  padding-bottom: 8px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color-primary);
}

.card-subtitle {
  font-size: 12px;
  color: var(--text-color-tertiary);
  margin-left: 8px;
}

.topic-list {
  max-height: 300px;
  overflow-y: auto;
}

.topic-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-color-light);
  cursor: pointer;
  transition: background-color var(--transition-fast);
  
  &:last-child {
    border-bottom: none;
  }
  
  &:hover {
    background-color: var(--bg-color-tertiary);
    margin: 0 -12px;
    padding-left: 12px;
    padding-right: 12px;
    border-radius: var(--border-radius-sm);
  }
}

.topic-info {
  flex: 1;
  min-width: 0;
}

.topic-title {
  font-size: 14px;
  color: var(--text-color-primary);
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topic-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.topic-time {
  font-size: 12px;
  color: var(--text-color-tertiary);
}
</style>
