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
          <VChart class="main-chart" :option="trendOption" autoresize />
        </el-card>
      </el-col>
      <el-col :xs="24" :md="8">
        <el-card shadow="never" class="chart-card">
          <template #header><span style="font-weight:600">科室分布</span></template>
          <VChart class="mini-chart" :option="deptPieOption" autoresize />
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
import { ArrowUp, ArrowDown, User, Coin, Document, Microscope, Warning, Clock, Plus, DocumentAdd, HomeFilled, Setting } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores'
import { reportApi, hospitalizationApi, pharmacyApi } from '@/api'
import { HOSP_STATUS_LABELS, type BoardSummary, type DailyTrendPoint, type Hospitalization, type Medicine } from '@/types'
import { formatDateTime, formatCurrency, formatNumber } from '@/utils'
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

const quickActions = [
  { label: '新建病历', icon: DocumentAdd, color: '#409EFF', path: '/medical' },
  { label: '住院登记', icon: HomeFilled, color: '#67C23A', path: '/hospitalization' },
  { label: '检验申请', icon: Microscope, color: '#E6A23C', path: '/lab' },
  { label: '排班管理', icon: Setting, color: '#909399', path: '/schedule' }
]

const statCards = computed(() => summary.value ? [
  { label: '接诊量', value: summary.value.current.visits, change: summary.value.comparison.visits_yoy || 0, icon: User, color: '#409EFF' },
  { label: '营收(元)', value: formatCurrency(summary.value.current.revenue, ''), change: summary.value.comparison.revenue_yoy || 0, icon: Coin, color: '#67C23A' },
  { label: '处方数', value: summary.value.current.prescriptions, change: summary.value.comparison.prescriptions_yoy || 0, icon: Document, color: '#E6A23C' },
  { label: '检验数', value: summary.value.current.lab_tests, change: summary.value.comparison.lab_tests_yoy || 0, icon: Microscope, color: '#F56C6C' }
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
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: dates, boundaryGap: false, axisLine: { lineStyle: { color: '#dcdfe6' } }, axisLabel: { color: '#909399' } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f0f2f5' } }, axisLabel: { color: '#909399' } },
    series: [{
      data, type: 'line', smooth: true, symbol: 'circle', symbolSize: 6,
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: isRevenue ? 'rgba(103,194,58,0.3)' : 'rgba(64,158,255,0.3)' }, { offset: 1, color: 'rgba(255,255,255,0)' }] } },
      lineStyle: { color: isRevenue ? '#67C23A' : '#409EFF', width: 3 },
      itemStyle: { color: isRevenue ? '#67C23A' : '#409EFF' }
    }]
  }
})

const deptPieOption = computed(() => {
  const data = deptBreakdown.value.map(d => ({ name: d.department, value: d.visits }))
  return {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, icon: 'circle', textStyle: { fontSize: 12 } },
    series: [{
      type: 'pie', radius: ['40%', '70%'], center: ['50%', '42%'], avoidLabelOverlap: false,
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
  } catch (e) { /* mock */ }

  if (!summary.value) {
    summary.value = generateMockSummary()
    trend.value = generateMockTrend()
    deptBreakdown.value = generateMockDepts()
    cageSummary.value = { total_cages: 340, occupied_cages: 218, cage_occupancy: 64 }
  }

  try {
    const [discharges, meds] = await Promise.all([
      hospitalizationApi.upcomingDischarges(hid, 3),
      pharmacyApi.getLowStock(hid)
    ])
    if (discharges.code === 200) upcomingDischarges.value = discharges.data
    if (meds.code === 200) lowStockMeds.value = meds.data
  } catch {
    upcomingDischarges.value = generateMockDischarges()
    lowStockMeds.value = generateMockLowStock()
  }
}

function generateMockSummary(): BoardSummary {
  return {
    current: { visits: 2856, unique_pets: 1923, revisits: 842, revisit_rate: 43.8, revenue: 586420.5, prescriptions: 2156, lab_tests: 3892, abnormal_lab_rate: 18.6 },
    previous: { visits: 2612, unique_pets: 1780, revisits: 756, revisit_rate: 42.5, revenue: 523180.2, prescriptions: 1980, lab_tests: 3512, abnormal_lab_rate: 17.2 },
    comparison: { visits_yoy: 9.3, unique_pets_yoy: 8.0, revisits_yoy: 11.4, revisit_rate_yoy: 3.1, revenue_yoy: 12.1, prescriptions_yoy: 8.9, lab_tests_yoy: 10.8, abnormal_lab_rate_yoy: 8.1 },
    realtime: { total_cages: 340, occupied_cages: 218, cage_occupancy: 64, active_hospitalizations: 86, doctors_on_duty: 48 },
    date_range: { start: dateRange.value[0], end: dateRange.value[1] }
  }
}
function generateMockTrend() {
  return Array.from({ length: 30 }, (_, i) => ({
    date: dayjs().subtract(29 - i, 'day').format('YYYY-MM-DD'),
    visits: 80 + Math.floor(Math.random() * 50),
    revenue: 15000 + Math.floor(Math.random() * 8000),
    emergency: Math.floor(Math.random() * 10)
  }))
}
function generateMockDepts() {
  return [
    { department: '内科', visits: 1024 },
    { department: '外科', visits: 680 },
    { department: '影像科', visits: 512 },
    { department: '检验科', visits: 640 }
  ]
}
function generateMockDischarges(): Hospitalization[] {
  return [
    { id: 1, pet_name: '豆豆', cage_code: 'A05', status: 'admitted', expected_discharge_date: dayjs().add(1, 'day').toISOString() } as Hospitalization,
    { id: 2, pet_name: '毛毛', cage_code: 'B02', status: 'admitted', expected_discharge_date: dayjs().add(2, 'day').toISOString() } as Hospitalization,
    { id: 3, pet_name: '小白', cage_code: 'C01', status: 'admitted', expected_discharge_date: dayjs().add(1, 'day').toISOString() } as Hospitalization,
  ]
}
function generateMockLowStock(): Medicine[] {
  return [
    { id: 1, name: '地西泮', spec: '5mg*100片', stock_quantity: 8, safety_stock: 10, is_low_stock: true } as Medicine,
    { id: 2, name: '胰岛素', spec: '40IU/ml 10ml', stock_quantity: 3, safety_stock: 5, is_low_stock: true } as Medicine,
    { id: 3, name: '布洛芬', spec: '200mg*24片', stock_quantity: 5, safety_stock: 15, is_low_stock: true } as Medicine,
  ]
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
