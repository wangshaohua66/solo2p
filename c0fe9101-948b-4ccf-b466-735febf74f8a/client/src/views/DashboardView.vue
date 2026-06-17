<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">工作台 <span style="font-size:14px;color:var(--text-secondary);font-weight:400"> 欢迎回来，{{ userStore.userInfo?.real_name }}</span></h2>
      <div>
        <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" size="default" value-format="YYYY-MM-DD" />
      </div>
    </div>
    <el-row :gutter="16" class="stat-row">
      <el-col :xs="12" :sm="12" :md="6" v-for="(s, i) in statCards" :key="i">
        <div class="stat-card">
          <div class="stat-label" :style="{color: s.color}"><el-icon :size="16"><component :is="s.icon" /></el-icon> {{ s.label }}</div>
          <div class="stat-value">{{ s.value }}</div>
          <div class="stat-change" :class="s.change >= 0 ? 'up' : 'down'">
            <el-icon><component :is="s.change >= 0 ? ArrowUp : ArrowDown" /></el-icon>
            {{ Math.abs(s.change) }}% 较上周期
          </div>
        </div>
      </el-col>
    </el-row>
    <el-row :gutter="16" class="chart-row">
      <el-col :xs="24" :md="16">
        <el-card shadow="never" class="chart-card">
          <template #header>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-weight:600">接诊趋势（近30天）</span>
              <el-radio-group v-model="trendType" size="small">
                <el-radio-button value="visits">接诊量</el-radio-button>
                <el-radio-button value="revenue">营收</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <VChart class="main-chart" :option="trendOption" :style="{height: chartHeight + 'px'}" autoresize />
        </el-card>
      </el-col>
      <el-col :xs="24" :md="8">
        <el-card shadow="never" class="chart-card">
          <template #header><span style="font-weight:600">科室分布</span></template>
          <VChart class="mini-chart" :option="deptPieOption" :style="{height: chartHeight + 'px'}" autoresize />
        </el-card>
      </el-col>
    </el-row>
    <el-row :gutter="16" class="chart-row">
      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="chart-card">
          <template #header>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-weight:600">笼位实时状态</span>
              <el-tag type="primary" effect="plain">实时更新</el-tag>
            </div>
          </template>
          <div class="cage-stats">
            <div v-for="(item, i) in cageStats" :key="i" class="cage-stat-item" :style="{borderLeftColor: item.color}">
              <div class="label">{{ item.label }}</div>
              <div class="count" :style="{color: item.color}">{{ item.count }}</div>
            </div>
          </div>
          <div class="cage-occupancy">
            <div class="label">
              <span>占用率</span>
              <span style="color:var(--primary-color);font-weight:600">{{ occupancy }}%</span>
            </div>
            <el-progress :percentage="occupancy" :color="occupancyColor" :stroke-width="14" />
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="chart-card">
          <template #header>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-weight:600">快速操作</span>
            </div>
          </template>
          <div class="quick-actions">
            <div class="action-item" v-for="a in quickActions" :key="a.label" @click="router.push(a.path)">
              <el-icon :size="26" :style="{color: a.color}"><component :is="a.icon" /></el-icon>
              <span>{{ a.label }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
    <el-row :gutter="16" class="chart-row" v-if="lowStockMeds.length || upcomingDischarges.length">
      <el-col :xs="24" :md="12" v-if="lowStockMeds.length">
        <el-card shadow="never" class="chart-card">
          <template #header>
            <span style="font-weight:600;color:var(--warning-color)"><el-icon><Warning /></el-icon> 库存预警药品</span>
          </template>
          <el-table :data="lowStockMeds.slice(0, 6)" size="small" style="width:100%">
            <el-table-column prop="name" label="药品名称" />
            <el-table-column prop="spec" label="规格" width="120" />
            <el-table-column label="库存" width="120">
              <template #default="{row}">
                <span style="color:var(--danger-color);font-weight:600">{{ row.stock_quantity }}</span> / {{ row.safety_stock }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12" v-if="upcomingDischarges.length">
        <el-card shadow="never" class="chart-card">
          <template #header>
            <span style="font-weight:600;color:var(--primary-color)"><el-icon><Clock /></el-icon> 即将出院 (3日内)</span>
          </template>
          <el-table :data="upcomingDischarges.slice(0, 6)" size="small" style="width:100%">
            <el-table-column prop="pet_name" label="宠物" width="90" />
            <el-table-column prop="cage_code" label="笼位" width="80" />
            <el-table-column label="预计出院" width="140">
              <template #default="{row}">{{ formatDateTime(row.expected_discharge_date, 'MM-DD HH:mm') }}</template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{row}"><el-tag size="small" type="warning">{{ HOSP_STATUS_LABELS[row.status] }}</el-tag></template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowUp, ArrowDown, User, Coin, Document, DataAnalysis, Warning, Clock, Plus, DocumentAdd, HomeFilled, Setting } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores'
import { reportApi, hospitalizationApi, pharmacyApi } from '@/api'
import { HOSP_STATUS_LABELS, type BoardSummary, type DailyTrendPoint, type Hospitalization, type Medicine } from '@/types'
import { formatDateTime, formatCurrency, formatNumber } from '@/utils'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'

const router = useRouter()
const userStore = useUserStore()
const dateRange = ref<[string, string]>([dayjs().subtract(29, 'day').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')])
const trendType = ref<'visits' | 'revenue'>('visits')
const summary = ref<BoardSummary | null>(null)
const trend = ref<DailyTrendPoint[]>([])
const deptBreakdown = ref<any[]>([])
const cageSummary = ref({ total_cages: 0, occupied_cages: 0, cage_occupancy: 0 })
const upcomingDischarges = ref<Hospitalization[]>([])
const lowStockMeds = ref<Medicine[]>([])
const isMobile = computed(() => userStore.isMobile || window.innerWidth < 768)
const chartHeight = computed(() => isMobile.value ? 240 : 280)

const quickActions = [
  { label: '新建病历', icon: DocumentAdd, color: '#409EFF', path: '/medical' },
  { label: '住院登记', icon: HomeFilled, color: '#67C23A', path: '/hospitalization' },
  { label: '检验申请', icon: DataAnalysis, color: '#E6A23C', path: '/lab' },
  { label: '排班管理', icon: Setting, color: '#909399', path: '/schedule' }
]

const statCards = computed(() => summary.value ? [
  { label: '接诊量', value: summary.value.current.visits, change: summary.value.mom_diff.visits_pct || 0, icon: User, color: '#409EFF' },
  { label: '营收(元)', value: formatCurrency(summary.value.current.revenue, ''), change: summary.value.mom_diff.revenue_pct || 0, icon: Coin, color: '#67C23A' },
  { label: '处方数', value: summary.value.current.prescriptions, change: summary.value.mom_diff.prescriptions_pct || 0, icon: Document, color: '#E6A23C' },
  { label: '检验数', value: summary.value.current.lab_tests, change: summary.value.mom_diff.lab_tests_pct || 0, icon: DataAnalysis, color: '#F56C6C' }
] : [])

const cageStats = computed(() => {
  const s = cageSummary.value
  return [
    { label: '总笼位', count: s.total_cages, color: '#909399' },
    { label: '使用中', count: s.occupied_cages, color: '#F56C6C' },
    { label: '空闲', count: s.total_cages - s.occupied_cages, color: '#67C23A' },
    { label: '占用率', count: `${s.cage_occupancy}%`, color: '#409EFF' }
  ]
})

const occupancy = computed(() => cageSummary.value.cage_occupancy || 0)
const occupancyColor = computed(() => occupancy.value > 85 ? '#F56C6C' : occupancy.value > 70 ? '#E6A23C' : '#67C23A')

const trendOption = computed(() => {
  const dates = trend.value.map(t => t.date.slice(5))
  const isRevenue = trendType.value === 'revenue'
  const data = trend.value.map(t => isRevenue ? t.revenue : t.visits)
  const mobile = isMobile.value
  return {
    tooltip: { trigger: 'axis', confine: true },
    grid: mobile ? { left: 35, right: 10, top: 10, bottom: 20 } : { left: 40, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: dates, boundaryGap: false, axisLine: { lineStyle: { color: '#dcdfe6' } }, axisLabel: { color: '#909399', fontSize: mobile ? 10 : 12 } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f0f2f5' } }, axisLabel: { color: '#909399', fontSize: mobile ? 10 : 12 } },
    series: [{
      data, type: 'line', smooth: true, symbol: mobile ? 'none' : 'circle', symbolSize: mobile ? 0 : 6,
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: isRevenue ? 'rgba(103,194,58,0.3)' : 'rgba(64,158,255,0.3)' }, { offset: 1, color: 'rgba(255,255,255,0)' }] } },
      lineStyle: { color: isRevenue ? '#67C23A' : '#409EFF', width: mobile ? 2 : 3 },
      itemStyle: { color: isRevenue ? '#67C23A' : '#409EFF' }
    }]
  }
})

const deptPieOption = computed(() => {
  const data = deptBreakdown.value.map(d => ({ name: d.department, value: d.visits }))
  const mobile = isMobile.value
  return {
    tooltip: { trigger: 'item', confine: true },
    legend: mobile ? { show: false } : { bottom: 0, icon: 'circle', textStyle: { fontSize: 12 } },
    series: [{
      type: 'pie', radius: mobile ? ['35%', '65%'] : ['40%', '70%'], center: ['50%', mobile ? '50%' : '42%'], avoidLabelOverlap: false,
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      data,
      color: ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#8B5CF6', '#909399']
    }]
  }
})

async function loadData() {
  const [start, end] = dateRange.value || []
  const hid = userStore.currentHospital?.id || undefined
  try {
    const [s, t, d, g] = await Promise.all([
      reportApi.getBoardSummary(hid, start, end),
      reportApi.getDailyTrend(hid, 30),
      reportApi.getDeptBreakdown(hid, start, end),
      hospitalizationApi.getCageGrid(hid)
    ])
    if (s.code === 200) summary.value = s.data
    if (t.code === 200) trend.value = t.data
    if (d.code === 200) deptBreakdown.value = d.data
    if (g.code === 200) cageSummary.value = g.data.summary
  } catch (e: any) {
    summary.value = null
    trend.value = []
    deptBreakdown.value = []
    cageSummary.value = { total_cages: 0, occupied_cages: 0, cage_occupancy: 0 }
    ElMessage.error(e.message || '加载经营概览失败')
  }

  try {
    const [discharges, meds] = await Promise.all([
      hospitalizationApi.upcomingDischarges(hid, 3),
      pharmacyApi.getLowStock(hid)
    ])
    if (discharges.code === 200) upcomingDischarges.value = discharges.data
    if (meds.code === 200) lowStockMeds.value = meds.data
  } catch (e: any) {
    upcomingDischarges.value = []
    lowStockMeds.value = []
    ElMessage.error(e.message || '加载住院和药品信息失败')
  }
}

watch(dateRange, loadData)
onMounted(loadData)
</script>

<style scoped lang="scss">
.stat-row { margin-bottom: 16px; }
.chart-row { margin-bottom: 16px; }
.chart-card { min-height: 320px; }
.main-chart { height: 280px; }
.mini-chart { height: 280px; }
.cage-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 24px;
  @include respond-to(mobile) { grid-template-columns: repeat(2, 1fr); }
  .cage-stat-item {
    padding: 14px;
    background: var(--bg-color);
    border-radius: var(--radius-base);
    border-left: 4px solid;
    .label { font-size: 13px; color: var(--text-secondary); }
    .count { font-size: 22px; font-weight: 700; margin-top: 4px; }
  }
}
.cage-occupancy {
  .label {
    display: flex;
    justify-content: space-between;
    margin-bottom: 10px;
    font-size: 14px;
    color: var(--text-regular);
  }
}
.quick-actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  padding: 12px 0;
  .action-item {
    @include flex-center;
    flex-direction: column;
    gap: 10px;
    padding: 24px 12px;
    border-radius: var(--radius-base);
    background: var(--bg-color);
    cursor: pointer;
    transition: all 0.2s;
    font-size: 14px;
    color: var(--text-regular);
    &:hover { transform: translateY(-4px); box-shadow: var(--box-shadow-light); background: #fff; }
  }
}
</style>
