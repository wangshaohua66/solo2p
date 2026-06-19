<template>
  <div class="dashboard">
    <el-row :gutter="16" class="stats-row">
      <el-col :span="6" v-for="s in statsCards" :key="s.label">
        <div class="stat-card" :style="{ borderColor: s.color }">
          <div class="stat-left">
            <div class="stat-icon" :style="{ background: s.bg }">
              <el-icon :size="24"><component :is="s.icon" /></el-icon>
            </div>
          </div>
          <div class="stat-right">
            <div class="stat-value">{{ s.value }}</div>
            <div class="stat-label">{{ s.label }}</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <el-col :span="16">
        <div class="card charts-card">
          <div class="card-header">
            <h3>案件趋势</h3>
            <el-radio-group v-model="chartType" size="small">
              <el-radio-button label="type">按类型</el-radio-button>
              <el-radio-button label="status">按状态</el-radio-button>
              <el-radio-button label="month">月度分布</el-radio-button>
            </el-radio-group>
          </div>
          <v-chart class="chart" :option="chartOption" autoresize />
        </div>
      </el-col>
      <el-col :span="8">
        <div class="card">
          <div class="card-header">
            <h3>诉讼时效预警</h3>
            <el-tag type="danger" effect="dark" round>{{ stats.urgent_warning || 0 }} 紧急</el-tag>
          </div>
          <div class="warning-list">
            <div class="empty-tip" v-if="!stats.warning_cases?.length">暂无预警</div>
            <div v-for="w in stats.warning_cases" :key="w.id" class="warning-item" @click="goCase(w.id)">
              <div class="warning-level" :class="getLevelClass(w.days_left)">
                {{ w.days_left < 0 ? '已过期' : w.days_left + '天' }}
              </div>
              <div class="warning-body">
                <p class="warning-title">{{ w.case_no }} {{ w.case_name }}</p>
                <p class="warning-date">截止：{{ w.limit_date }}</p>
              </div>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top:16px">
      <el-col :span="12">
        <div class="card">
          <div class="card-header">
            <h3>今日庭审</h3>
            <el-button type="primary" link @click="router.push('/calendar')">查看全部</el-button>
          </div>
          <el-table :data="todayTrials" v-if="todayTrials.length" size="small">
            <el-table-column label="时间" width="140">
              <template #default="{ row }">
                <span style="color:#1e3a5f;font-weight:500">{{ formatTime(row.start_time) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="case_info.case_no" label="案号" width="140" />
            <el-table-column prop="case_info.case_name" label="案件名称" show-overflow-tooltip />
            <el-table-column label="地点" prop="location" show-overflow-tooltip />
            <el-table-column label="状态" width="80">
              <template #default="{ row }">
                <el-tag size="small" :type="getResultType(row.result)">
                  {{ row.result_display }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="今日无庭审安排" :image-size="80" />
        </div>
      </el-col>
      <el-col :span="12">
        <div class="card">
          <div class="card-header">
            <h3>待确认工时</h3>
            <el-button type="primary" link @click="router.push('/billing')">去处理</el-button>
          </div>
          <el-table :data="pendingLogs" v-if="pendingLogs.length" size="small">
            <el-table-column prop="work_date" label="日期" width="110" />
            <el-table-column label="人员" width="110">
              <template #default="{ row }">{{ row.worker_info?.full_name }}</template>
            </el-table-column>
            <el-table-column prop="work_type_display" label="类型" width="100" />
            <el-table-column prop="duration" label="工时" width="70" />
            <el-table-column prop="actual_amount" label="金额" width="90" />
          </el-table>
          <el-empty v-else description="暂无待确认工时" :image-size="80" />
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { PieChart, BarChart, LineChart } from 'echarts/charts'
import {
  TitleComponent, TooltipComponent, LegendComponent,
  GridComponent, DatasetComponent
} from 'echarts/components'
import * as echarts from 'echarts'
import {
  Document, Calendar, Warning, Money, User, Files, FolderOpened
} from '@element-plus/icons-vue'
import { useCaseStore } from '@/stores/case'
import { useTrialStore } from '@/stores/trial'
import { useBillingStore } from '@/stores/billing'
import dayjs from 'dayjs'
import type { EChartsOption } from 'echarts'

use([CanvasRenderer, PieChart, BarChart, LineChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent, DatasetComponent])
echarts;

const router = useRouter()
const caseStore = useCaseStore()
const trialStore = useTrialStore()
const billingStore = useBillingStore()

const chartType = ref<'type' | 'status' | 'month'>('month')
const todayTrials = ref<any[]>([])
const pendingLogs = ref<any[]>([])

const stats = computed(() => caseStore.statistics || {})

const statsCards = computed(() => [
  { label: '案件总数', value: stats.value.total || 0, icon: 'Document', color: '#4299e1', bg: '#ebf8ff' },
  { label: '本月新增', value: 12, icon: 'Files', color: '#38a169', bg: '#f0fff4' },
  { label: '待处理庭审', value: 5, icon: 'Calendar', color: '#d69e2e', bg: '#fffff0' },
  { label: '待结算金额', value: '¥' + (billingStore.settlementStats?.total_unpaid || 0).toLocaleString(),
    icon: 'Money', color: '#e53e3e', bg: '#fff5f5' }
])

const chartOption = computed<EChartsOption>(() => {
  if (chartType.value === 'type') {
    const data = (stats.value.by_type || []).map((t: any) => ({
      name: ({civil: '民商事', criminal: '刑事', administrative: '行政', non_litigation: '非诉'} as any)[t.case_type] || t.case_type,
      value: t.count
    }))
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: 0 },
      series: [{
        type: 'pie', radius: ['45%', '70%'],
        label: { formatter: '{b}\n{d}%' },
        data,
        color: ['#4299e1', '#e53e3e', '#38a169', '#d69e2e', '#805ad5']
      }]
    }
  }
  if (chartType.value === 'status') {
    const data = stats.value.by_status || []
    const map: any = {
      consulting: '咨询', conflict_check: '冲突审查', filing: '立案',
      assigned: '已分配', handling: '办理中', trial: '庭审', execution: '执行',
      closing: '结案中', closed: '已结案', suspended: '中止'
    }
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 40, right: 20, top: 30, bottom: 40 },
      xAxis: { type: 'category', data: data.map((s: any) => map[s.status] || s.status),
        axisLabel: { rotate: 30, fontSize: 11 } },
      yAxis: { type: 'value' },
      series: [{
        type: 'bar', barWidth: 30,
        data: data.map((s: any) => s.count),
        itemStyle: { color: '#4299e1', borderRadius: [4, 4, 0, 0] }
      }]
    }
  }
  const data = stats.value.by_month || []
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 30, bottom: 40 },
    xAxis: { type: 'category',
      data: data.map((m: any) => dayjs(m.month).format('M月')),
      boundaryGap: false },
    yAxis: { type: 'value' },
    series: [{
      type: 'line', smooth: true,
      data: data.map((m: any) => m.count),
      areaStyle: { color: 'rgba(66,153,225,0.15)' },
      itemStyle: { color: '#1e3a5f' },
      lineStyle: { width: 3, color: '#4299e1' }
    }]
  }
})

function getLevelClass(days: number) {
  if (days < 0) return 'expired'
  if (days <= 3) return 'critical'
  if (days <= 7) return 'urgent'
  if (days <= 15) return 'warning'
  return 'notice'
}

function getResultType(r: string) {
  return ({ pending: 'warning', ongoing: 'primary', completed: 'success',
    postponed: 'info', cancelled: 'danger' } as any)[r] || ''
}

function formatTime(t: string) {
  return dayjs(t).format('HH:mm')
}

function goCase(id: number) {
  router.push(`/cases/${id}`)
}

onMounted(async () => {
  await Promise.all([
    caseStore.fetchStatistics(),
    billingStore.fetchSettlementStats()
  ])
  const today = dayjs().format('YYYY-MM-DD')
  try {
    const tr = await trialStore.fetchTrials({
      start: dayjs(today).startOf('day').toISOString(),
      end: dayjs(today).endOf('day').toISOString(),
      page_size: 100
    })
    todayTrials.value = (tr as any).results || []
  } catch (e) {}
  try {
    const logs = await billingStore.fetchWorkLogs({ approval_status: 'submitted', page_size: 10 })
    pendingLogs.value = (logs as any).results || []
  } catch (e) {}
})
</script>

<style lang="scss" scoped>
.dashboard {
  .stats-row { margin-bottom: 16px; }
  .stat-card {
    background: #fff;
    border-radius: 10px;
    padding: 20px;
    display: flex;
    gap: 16px;
    align-items: center;
    border-left: 4px solid;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    transition: transform 0.2s;
    &:hover { transform: translateY(-2px); }
    .stat-icon {
      width: 52px;
      height: 52px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #1e3a5f;
    }
    .stat-value {
      font-size: 24px;
      font-weight: 600;
      color: #2d3748;
      line-height: 1.2;
    }
    .stat-label {
      font-size: 13px;
      color: #718096;
      margin-top: 4px;
    }
  }
  .card {
    background: #fff;
    border-radius: 10px;
    padding: 20px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 1px solid #edf2f7;
    h3 { margin: 0; font-size: 15px; color: #2d3748; font-weight: 600; }
  }
  .charts-card { min-height: 360px; }
  .chart { height: 280px; }
  .warning-list {
    max-height: 300px;
    overflow-y: auto;
    .empty-tip {
      text-align: center;
      padding: 40px 0;
      color: #a0aec0;
      font-size: 13px;
    }
    .warning-item {
      display: flex;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid #edf2f7;
      cursor: pointer;
      &:last-child { border-bottom: none; }
      &:hover { background: #f7fafc; border-radius: 6px; padding: 12px; margin: 0 -12px; }
      .warning-level {
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        min-width: 56px;
        text-align: center;
        flex-shrink: 0;
        align-self: flex-start;
        &.expired { background: #fed7d7; color: #c53030; animation: pulse-danger 1.5s infinite; }
        &.critical { background: #fed7d7; color: #e53e3e; }
        &.urgent { background: #feebc8; color: #c05621; }
        &.warning { background: #fefcbf; color: #975a16; }
        &.notice { background: #bee3f8; color: #2b6cb0; }
      }
      .warning-body {
        flex: 1;
        min-width: 0;
        .warning-title {
          font-size: 13px;
          color: #2d3748;
          margin: 0 0 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .warning-date {
          font-size: 12px;
          color: #a0aec0;
          margin: 0;
        }
      }
    }
  }
}
@keyframes pulse-danger { 50% { opacity: 0.7; } }
</style>
