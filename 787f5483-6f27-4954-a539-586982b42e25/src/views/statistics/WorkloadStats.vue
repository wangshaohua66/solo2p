<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { WorkloadStats } from '@/types'
import { formatDate, formatDuration } from '@/utils'
import { getWorkloadStats, getProductionStats, getEfficiencyStats } from '@/api/statistics'
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

const loading = ref(false)
const activeTab = ref('workload')
const dateRange = ref<[string, string]>([
  formatDate(new Date(Date.now() - 30 * 24 * 3600 * 1000), 'YYYY-MM-DD'),
  formatDate(new Date(), 'YYYY-MM-DD')
])

const filters = reactive({
  groupBy: 'department' as 'department' | 'user',
  department: ''
})

const departmentOptions = [
  { value: 'news_center', label: '新闻中心' },
  { value: 'program_center', label: '节目中心' },
  { value: 'tech_department', label: '技术部' },
  { value: 'editorial_department', label: '总编室' },
  { value: 'broadcast_department', label: '播出部' }
]

const workloadData = ref<WorkloadStats[]>([])
const productionStats = ref<any>(null)
const efficiencyStats = ref<any>(null)

const departmentChart = computed(() => {
  const data = workloadData.value.filter(item => item.department)
  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#21262d',
      borderColor: '#30363d',
      textStyle: { color: '#e6edf3' },
      axisPointer: { type: 'shadow' }
    },
    legend: {
      data: ['选题数量', '素材数量'],
      textStyle: { color: '#8b949e' }
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
      data: data.map(d => d.department),
      axisLine: { lineStyle: { color: '#30363d' } },
      axisLabel: { color: '#8b949e', interval: 0, rotate: 0 }
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
        type: 'bar',
        data: data.map(d => d.topicCount),
        itemStyle: { color: '#409eff', borderRadius: [4, 4, 0, 0] },
        barWidth: '35%'
      },
      {
        name: '素材数量',
        type: 'bar',
        data: data.map(d => d.materialCount),
        itemStyle: { color: '#67c23a', borderRadius: [4, 4, 0, 0] },
        barWidth: '35%'
      }
    ]
  }
})

const durationChart = computed(() => {
  const data = workloadData.value.filter(item => item.department)
  return {
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
      data: data.map(d => d.department),
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
        data: data.map(d => (d.programDuration / 3600).toFixed(1)),
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#e6a23c' },
              { offset: 1, color: '#f56c6c' }
            ]
          }
        },
        barWidth: '50%'
      }
    ]
  }
})

const contentTypeChart = computed(() => {
  if (!productionStats.value) return { series: [] }
  const data = Object.entries(productionStats.value.byType || {}).map(([name, value]) => ({ name, value }))
  return {
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
        itemStyle: {
          borderRadius: 8,
          borderColor: '#1c2128',
          borderWidth: 2
        },
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 14, fontWeight: 'bold', color: '#e6edf3' }
        },
        data: data.map((item, index) => ({
          ...item,
          itemStyle: {
            color: ['#409eff', '#67c23a', '#e6a23c', '#f56c6c'][index % 4]
          }
        }))
      }
    ]
  }
})

const efficiencyChart = computed(() => {
  if (!efficiencyStats.value) return { series: [] }
  return {
    tooltip: {
      trigger: 'item'
    },
    series: [
      {
        type: 'gauge',
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max: 100,
        splitNumber: 5,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: '#f56c6c' },
              { offset: 0.5, color: '#e6a23c' },
              { offset: 1, color: '#67c23a' }
            ]
          },
          borderRadius: 10
        },
        progress: { show: true, width: 30 },
        pointer: { show: false },
        axisLine: { lineStyle: { width: 30, color: [[1, '#21262d']] } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        title: { show: false },
        detail: {
          valueAnimation: true,
          fontSize: 36,
          fontWeight: 'bold',
          color: '#e6edf3',
          formatter: '{value}%',
          offsetCenter: [0, '0%']
        },
        data: [{ value: Math.round(efficiencyStats.value.passRate * 100), name: '通过率' }]
      }
    ]
  }
})

const mockWorkloadData = (): WorkloadStats[] => [
  { department: '新闻中心', userId: 0, userName: '', topicCount: 45, materialCount: 180, programDuration: 54000, reviewCount: 90, period: '2024-01' },
  { department: '节目中心', userId: 0, userName: '', topicCount: 32, materialCount: 156, programDuration: 72000, reviewCount: 64, period: '2024-01' },
  { department: '技术部', userId: 0, userName: '', topicCount: 12, materialCount: 280, programDuration: 36000, reviewCount: 24, period: '2024-01' },
  { department: '总编室', userId: 0, userName: '', topicCount: 28, materialCount: 95, programDuration: 43200, reviewCount: 56, period: '2024-01' },
  { department: '播出部', userId: 0, userName: '', topicCount: 8, materialCount: 45, programDuration: 28800, reviewCount: 16, period: '2024-01' }
]

async function fetchData() {
  loading.value = true
  try {
    workloadData.value = mockWorkloadData()
    productionStats.value = {
      topicCount: 125,
      materialCount: 756,
      programCount: 48,
      totalDuration: 234000,
      byType: {
        '新闻': 45,
        '专题': 32,
        '综艺': 28,
        '电视剧': 20
      },
      byChannel: {
        '新闻综合': 50,
        '都市生活': 45,
        '公共频道': 30
      }
    }
    efficiencyStats.value = {
      avgReviewTime: 2.5,
      avgProductionCycle: 5.8,
      passRate: 0.87,
      rejectionRate: 0.13
    }
  } finally {
    loading.value = false
  }
}

function handleQuery() {
  fetchData()
}

function handleExport() {
  ElMessage.success('报表导出成功')
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="page-container workload-stats">
    <div class="page-header">
      <div class="page-header__title">工作量统计</div>
      <div class="page-header__actions">
        <el-button @click="handleExport">
          <el-icon><Download /></el-icon>导出报表
        </el-button>
      </div>
    </div>
    
    <div class="card filter-card">
      <el-form inline>
        <el-form-item label="统计范围">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        
        <el-form-item label="统计维度">
          <el-radio-group v-model="filters.groupBy">
            <el-radio-button value="department">按部门</el-radio-button>
            <el-radio-button value="user">按人员</el-radio-button>
          </el-radio-group>
        </el-form-item>
        
        <el-form-item label="部门筛选" v-if="filters.groupBy === 'user'">
          <el-select v-model="filters.department" placeholder="全部部门" clearable style="width: 160px">
            <el-option
              v-for="dept in departmentOptions"
              :key="dept.value"
              :label="dept.label"
              :value="dept.value"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item>
          <el-button type="primary" @click="handleQuery">
            <el-icon><Search /></el-icon>查询
          </el-button>
        </el-form-item>
      </el-form>
    </div>
    
    <el-tabs v-model="activeTab" class="stats-tabs">
      <el-tab-pane label="部门工作量" name="workload">
        <el-row :gutter="16" v-loading="loading">
          <el-col :lg="12" :md="24">
            <div class="card chart-card">
              <div class="card-header">
                <span class="card-title">选题与素材数量</span>
              </div>
              <v-chart :option="departmentChart" style="height: 350px" autoresize />
            </div>
          </el-col>
          <el-col :lg="12" :md="24">
            <div class="card chart-card">
              <div class="card-header">
                <span class="card-title">节目制作时长</span>
              </div>
              <v-chart :option="durationChart" style="height: 350px" autoresize />
            </div>
          </el-col>
        </el-row>
        
        <div class="card">
          <div class="card-header">
            <span class="card-title">详细数据</span>
          </div>
          <el-table :data="workloadData" stripe>
            <el-table-column prop="department" label="部门" width="140" />
            <el-table-column prop="topicCount" label="选题数量" width="100" align="center" />
            <el-table-column prop="materialCount" label="素材数量" width="100" align="center" />
            <el-table-column prop="programDuration" label="节目时长" width="140" align="center">
              <template #default="{ row }">
                {{ formatDuration(row.programDuration) }}
              </template>
            </el-table-column>
            <el-table-column prop="reviewCount" label="审核次数" width="100" align="center" />
            <el-table-column label="综合评分" width="120" align="center">
              <template #default="{ row }">
                <el-tag 
                  :type="row.topicCount > 30 ? 'success' : row.topicCount > 15 ? 'warning' : 'info'"
                  effect="dark"
                >
                  {{ Math.round((row.topicCount * 2 + row.materialCount * 0.5 + row.programDuration / 3600 * 10) / 3) }}分
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>
      
      <el-tab-pane label="生产统计" name="production">
        <el-row :gutter="16" v-loading="loading">
          <el-col :xs="12" :sm="6">
            <div class="stat-card">
              <div class="stat-icon icon-blue">
                <el-icon :size="24"><EditPen /></el-icon>
              </div>
              <div class="stat-content">
                <div class="stat-value">{{ productionStats?.topicCount || 0 }}</div>
                <div class="stat-label">选题总数</div>
              </div>
            </div>
          </el-col>
          <el-col :xs="12" :sm="6">
            <div class="stat-card">
              <div class="stat-icon icon-success">
                <el-icon :size="24"><Folder /></el-icon>
              </div>
              <div class="stat-content">
                <div class="stat-value">{{ productionStats?.materialCount || 0 }}</div>
                <div class="stat-label">素材总数</div>
              </div>
            </div>
          </el-col>
          <el-col :xs="12" :sm="6">
            <div class="stat-card">
              <div class="stat-icon icon-warning">
                <el-icon :size="24"><VideoPlay /></el-icon>
              </div>
              <div class="stat-content">
                <div class="stat-value">{{ productionStats?.programCount || 0 }}</div>
                <div class="stat-label">节目数量</div>
              </div>
            </div>
          </el-col>
          <el-col :xs="12" :sm="6">
            <div class="stat-card">
              <div class="stat-icon icon-danger">
                <el-icon :size="24"><Timer /></el-icon>
              </div>
              <div class="stat-content">
                <div class="stat-value">{{ formatDuration(productionStats?.totalDuration || 0) }}</div>
                <div class="stat-label">总制作时长</div>
              </div>
            </div>
          </el-col>
        </el-row>
        
        <el-row :gutter="16" style="margin-top: 16px">
          <el-col :lg="12" :md="24">
            <div class="card chart-card">
              <div class="card-header">
                <span class="card-title">内容类型分布</span>
              </div>
              <v-chart :option="contentTypeChart" style="height: 300px" autoresize />
            </div>
          </el-col>
          <el-col :lg="12" :md="24">
            <div class="card chart-card">
              <div class="card-header">
                <span class="card-title">频道播出分布</span>
              </div>
              <div class="channel-stats">
                <div
                  v-for="(value, name) in productionStats?.byChannel || {}"
                  :key="name"
                  class="channel-item"
                >
                  <span class="channel-name">{{ name }}</span>
                  <div class="channel-bar">
                    <div
                      class="channel-progress"
                      :style="{ width: `${(value as number / 50) * 100}%` }"
                    ></div>
                  </div>
                  <span class="channel-value">{{ value }} 小时</span>
                </div>
              </div>
            </div>
          </el-col>
        </el-row>
      </el-tab-pane>
      
      <el-tab-pane label="效率分析" name="efficiency">
        <el-row :gutter="16" v-loading="loading">
          <el-col :lg="8" :md="24">
            <div class="card chart-card">
              <div class="card-header">
                <span class="card-title">审核通过率</span>
              </div>
              <v-chart :option="efficiencyChart" style="height: 250px" autoresize />
              <p class="chart-desc">本期通过率</p>
            </div>
          </el-col>
          <el-col :lg="8" :md="24">
            <div class="card">
              <div class="card-header">
                <span class="card-title">平均审核时间</span>
              </div>
              <div class="big-stat">
                <span class="value">{{ efficiencyStats?.avgReviewTime || 0 }}</span>
                <span class="unit">小时</span>
              </div>
              <p class="chart-desc">从提交到完成审核的平均时间</p>
            </div>
          </el-col>
          <el-col :lg="8" :md="24">
            <div class="card">
              <div class="card-header">
                <span class="card-title">平均制作周期</span>
              </div>
              <div class="big-stat">
                <span class="value">{{ efficiencyStats?.avgProductionCycle || 0 }}</span>
                <span class="unit">天</span>
              </div>
              <p class="chart-desc">从选题到完成的平均周期</p>
            </div>
          </el-col>
        </el-row>
        
        <div class="card" style="margin-top: 16px">
          <div class="card-header">
            <span class="card-title">人员绩效排行榜</span>
          </div>
          <el-table
            :data="[
              { rank: 1, name: '张三', department: '新闻中心', topicCount: 25, materialCount: 89, score: 95 },
              { rank: 2, name: '李四', department: '节目中心', topicCount: 22, materialCount: 76, score: 92 },
              { rank: 3, name: '王五', department: '技术部', topicCount: 18, materialCount: 156, score: 89 },
              { rank: 4, name: '赵六', department: '新闻中心', topicCount: 20, materialCount: 71, score: 87 },
              { rank: 5, name: '钱七', department: '总编室', topicCount: 19, materialCount: 65, score: 85 }
            ]"
            stripe
          >
            <el-table-column prop="rank" label="排名" width="80" align="center">
              <template #default="{ row }">
                <el-tag
                  :type="row.rank === 1 ? 'danger' : row.rank === 2 ? 'warning' : row.rank === 3 ? 'primary' : 'info'"
                  effect="dark"
                  size="large"
                >
                  {{ row.rank }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="name" label="姓名" width="120" />
            <el-table-column prop="department" label="部门" width="140" />
            <el-table-column prop="topicCount" label="选题数量" width="100" align="center" />
            <el-table-column prop="materialCount" label="素材数量" width="100" align="center" />
            <el-table-column prop="score" label="综合得分" width="120" align="center">
              <template #default="{ row }">
                <span class="score">{{ row.score }}</span>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style lang="scss" scoped>
.workload-stats {
  .filter-card {
    margin-bottom: 16px;
  }
  
  .stats-tabs {
    :deep(.el-tabs__header) {
      background-color: var(--bg-color-card);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-md) var(--border-radius-md) 0 0;
      padding: 0 20px;
      margin: 0;
    }
    
    :deep(.el-tabs__item) {
      height: 48px;
      line-height: 48px;
    }
    
    :deep(.el-tabs__nav-wrap::after) {
      display: none;
    }
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
  
  .stat-card {
    display: flex;
    align-items: center;
    padding: 16px;
    background-color: var(--bg-color-card);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-md);
    margin-bottom: 16px;
  }
  
  .stat-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: var(--border-radius-sm);
    margin-right: 12px;
    color: #fff;
    
    &.icon-blue {
      background: linear-gradient(135deg, #667eea 0%, #409eff 100%);
    }
    
    &.icon-success {
      background: linear-gradient(135deg, #43e97b 0%, #67c23a 100%);
    }
    
    &.icon-warning {
      background: linear-gradient(135deg, #f093fb 0%, #e6a23c 100%);
    }
    
    &.icon-danger {
      background: linear-gradient(135deg, #fa709a 0%, #f56c6c 100%);
    }
  }
  
  .stat-value {
    font-size: 24px;
    font-weight: 600;
    color: var(--text-color-primary);
    line-height: 1.2;
  }
  
  .stat-label {
    font-size: 12px;
    color: var(--text-color-secondary);
    margin-top: 4px;
  }
  
  .channel-stats {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 8px 0;
  }
  
  .channel-item {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  
  .channel-name {
    width: 80px;
    font-size: 13px;
    color: var(--text-color-secondary);
  }
  
  .channel-bar {
    flex: 1;
    height: 24px;
    background-color: var(--bg-color-secondary);
    border-radius: 12px;
    overflow: hidden;
  }
  
  .channel-progress {
    height: 100%;
    background: linear-gradient(90deg, #409eff, #67c23a);
    border-radius: 12px;
    transition: width 0.5s ease;
  }
  
  .channel-value {
    width: 80px;
    text-align: right;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-color-primary);
  }
  
  .big-stat {
    display: flex;
    align-items: baseline;
    justify-content: center;
    margin: 20px 0;
    
    .value {
      font-size: 48px;
      font-weight: 700;
      color: var(--primary-color);
      line-height: 1;
    }
    
    .unit {
      margin-left: 8px;
      font-size: 16px;
      color: var(--text-color-secondary);
    }
  }
  
  .chart-desc {
    text-align: center;
    font-size: 12px;
    color: var(--text-color-tertiary);
    margin: 0;
  }
  
  .score {
    font-size: 18px;
    font-weight: 600;
    color: var(--warning-color);
  }
}
</style>
