<template>
  <div class="page-container report-page">
    <div class="page-header">
      <h2 class="page-title">集团经营看板</h2>
      <div class="actions">
        <el-select v-model="reportHospitalId" placeholder="选择院区" clearable style="width:180px" @change="loadAll">
          <el-option v-for="h in hospitals" :key="h.id" :label="h.name" :value="h.id" />
        </el-select>
        <el-date-picker v-model="dateRange" type="daterange" range-separator="至"
                        start-placeholder="开始日期" end-placeholder="结束日期"
                        value-format="YYYY-MM-DD" :shortcuts="dateShortcuts" style="width:320px"
                        @change="loadAll" />
        <el-button type="primary" @click="exportData">
          <el-icon><Download /></el-icon>导出报表
        </el-button>
      </div>
    </div>

    <el-row :gutter="16" class="kpi-row">
      <el-col v-for="k in kpiList" :key="k.key" :xs="12" :sm="8" :md="6" :lg="4">
        <el-card shadow="hover" class="kpi-card" :class="'kpi-' + k.key">
          <div class="kpi-label">
            <el-icon class="kpi-icon"><component :is="k.icon" /></el-icon>
            {{ k.label }}
          </div>
          <div class="kpi-value">
            <span class="kpi-num">{{ k.formatter ? k.formatter(k.current) : k.current }}</span>
            <el-tag v-if="k.comparison !== null && k.comparison !== undefined"
                    size="small" effect="light" round
                    :type="(k.comparison as number) >= 0 ? 'success' : 'danger'"
                    class="kpi-compare">
              <el-icon><component :is="(k.comparison as number) >= 0 ? Top : Bottom" /></el-icon>
              {{ Math.abs(k.comparison as number).toFixed(1) }}%
            </el-tag>
          </div>
          <div class="kpi-sub">环比上期：{{ k.formatter ? k.formatter(k.previous) : k.previous }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-tabs v-model="activeTab" type="border-card">
      <el-tab-pane label="综合看板" name="board">
        <el-row :gutter="16">
          <el-col :xs="24" :lg="16">
            <el-card shadow="never">
              <template #header>
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <span style="font-weight:600">接诊与收入趋势</span>
                  <el-radio-group v-model="trendDays" size="small" @change="loadTrend">
                    <el-radio-button :value="7">近7天</el-radio-button>
                    <el-radio-button :value="14">近14天</el-radio-button>
                    <el-radio-button :value="30">近30天</el-radio-button>
                  </el-radio-group>
                </div>
              </template>
              <div ref="trendChartRef" style="height:340px"></div>
            </el-card>
          </el-col>
          <el-col :xs="24" :lg="8">
            <el-card shadow="never">
              <template #header>
                <span style="font-weight:600">科室分布</span>
              </template>
              <div ref="deptPieRef" style="height:340px"></div>
            </el-card>
          </el-col>
        </el-row>
        <el-row :gutter="16" style="margin-top:16px">
          <el-col :xs="24" :md="12">
            <el-card shadow="never">
              <template #header>
                <span style="font-weight:600">月度同比对比（今年 vs 去年）</span>
              </template>
              <div ref="monthlyChartRef" style="height:320px"></div>
            </el-card>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-card shadow="never">
              <template #header>
                <span style="font-weight:600">实时运营概览</span>
              </template>
              <div class="realtime-box">
                <div class="realtime-item">
                  <div class="rt-title">笼位占用率</div>
                  <el-progress :percentage="summary.realtime?.cage_occupancy || 0"
                               :stroke-width="18" :color="progressColor" />
                  <div class="rt-sub">
                    {{ summary.realtime?.occupied_cages || 0 }} / {{ summary.realtime?.total_cages || 0 }} 个
                  </div>
                </div>
                <div class="realtime-item">
                  <div class="rt-title">在院住院</div>
                  <div class="rt-big-num">{{ summary.realtime?.active_hospitalizations || 0 }}</div>
                  <div class="rt-sub">住院宠物</div>
                </div>
                <div class="realtime-item">
                  <div class="rt-title">在岗医生</div>
                  <div class="rt-big-num" style="color:#67C23A">{{ summary.realtime?.doctors_on_duty || 0 }}</div>
                  <div class="rt-sub">含急诊值班</div>
                </div>
              </div>
            </el-card>
          </el-col>
        </el-row>
      </el-tab-pane>

      <el-tab-pane label="院区对比" name="hospital">
        <el-card shadow="never">
          <template #header>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-weight:600">各院区核心指标对比</span>
              <el-tooltip content="点击柱状图切换排序">
                <el-radio-group v-model="hospitalSortKey" size="small">
                  <el-radio-button value="visits">接诊量</el-radio-button>
                  <el-radio-button value="revenue">收入</el-radio-button>
                  <el-radio-button value="revisit_rate">复诊率</el-radio-button>
                </el-radio-group>
              </el-tooltip>
            </div>
          </template>
          <div ref="hospitalChartRef" style="height:420px"></div>
        </el-card>
        <el-table :data="hospitalTableData" border stripe size="small" style="margin-top:16px">
          <el-table-column prop="rank" label="排名" width="70" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.rank === 1" type="danger" effect="dark">🥇</el-tag>
              <el-tag v-else-if="row.rank === 2" type="warning">🥈</el-tag>
              <el-tag v-else-if="row.rank === 3" type="success">🥉</el-tag>
              <span v-else>{{ row.rank }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="院区" min-width="200" />
          <el-table-column prop="visits" label="接诊量" width="110" align="right" sortable>
            <template #default="{ row }">{{ row.visits?.toLocaleString() }}</template>
          </el-table-column>
          <el-table-column label="同比" width="100" align="center">
            <template #default="{ row }">
              <span :class="row.yoy >= 0 ? 'text-success' : 'text-danger'">
                {{ row.yoy >= 0 ? '+' : '' }}{{ row.yoy?.toFixed(1) }}%
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="revenue" label="收入(¥)" width="130" align="right" sortable>
            <template #default="{ row }">{{ (row.revenue || 0).toLocaleString() }}</template>
          </el-table-column>
          <el-table-column prop="avg_price" label="客单价(¥)" width="110" align="right" sortable>
            <template #default="{ row }">{{ row.avg_price?.toFixed(0) }}</template>
          </el-table-column>
          <el-table-column prop="revisit_rate" label="复诊率" width="100" align="center" sortable>
            <template #default="{ row }">
              <el-progress type="dashboard" :percentage="row.revisit_rate || 0"
                           :stroke-width="10" :width="50" />
            </template>
          </el-table-column>
          <el-table-column prop="abnormal_rate" label="异常检验率" width="110" align="center">
            <template #default="{ row }">{{ (row.abnormal_rate || 0).toFixed(1) }}%</template>
          </el-table-column>
          <el-table-column prop="doctors" label="医生数" width="80" align="center" />
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="科室分析" name="department">
        <el-row :gutter="16">
          <el-col :xs="24" :md="14">
            <el-card shadow="never">
              <template #header>
                <span style="font-weight:600">各科室收入对比</span>
              </template>
              <div ref="deptRevenueRef" style="height:400px"></div>
            </el-card>
          </el-col>
          <el-col :xs="24" :md="10">
            <el-card shadow="never">
              <template #header>
                <span style="font-weight:600">科室接诊量占比</span>
              </template>
              <div ref="deptVisitsRef" style="height:400px"></div>
            </el-card>
          </el-col>
        </el-row>
        <el-card shadow="never" style="margin-top:16px">
          <template #header>
            <span style="font-weight:600">科室明细数据</span>
          </template>
          <el-table :data="deptTableData" border stripe size="small">
            <el-table-column prop="department" label="科室" width="120" />
            <el-table-column prop="visits" label="接诊量" width="100" align="right" sortable />
            <el-table-column prop="revenue" label="收入(¥)" width="120" align="right" sortable>
              <template #default="{ row }">{{ (row.revenue || 0).toLocaleString() }}</template>
            </el-table-column>
            <el-table-column prop="avg_price" label="客单价" width="100" align="right" />
            <el-table-column prop="revenue_share" label="收入占比" min-width="200">
              <template #default="{ row }">
                <el-progress :percentage="row.revenue_share || 0" :stroke-width="14" />
              </template>
            </el-table-column>
            <el-table-column prop="prescriptions" label="处方数" width="100" align="right" />
            <el-table-column prop="lab_tests" label="检验数" width="100" align="right" />
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="医生排名" name="doctor">
        <el-row :gutter="16">
          <el-col :xs="24" :md="16">
            <el-card shadow="never">
              <template #header>
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <span style="font-weight:600">医生综合排名 TOP 15</span>
                  <el-radio-group v-model="doctorRankKey" size="small" @change="loadDoctorRanking">
                    <el-radio-button value="visits">按接诊量</el-radio-button>
                    <el-radio-button value="revenue">按收入</el-radio-button>
                    <el-radio-button value="revisit_rate">按复诊率</el-radio-button>
                  </el-radio-group>
                </div>
              </template>
              <div ref="doctorChartRef" style="height:500px"></div>
            </el-card>
          </el-col>
          <el-col :xs="24" :md="8">
            <el-card shadow="never">
              <template #header>
                <span style="font-weight:600">🏆 前三甲</span>
              </template>
              <div class="top-doctors">
                <div v-for="(d, idx) in topDoctors" :key="d.id" class="top-doctor" :class="'top-' + (idx + 1)">
                  <div class="td-rank">{{ idx + 1 }}</div>
                  <el-avatar :size="52" :style="{ background: ['#F56C6C', '#E6A23C', '#67C23A'][idx] }">
                    {{ d.name?.[0] }}
                  </el-avatar>
                  <div class="td-info">
                    <div class="td-name" style="font-weight:600;font-size:15px">{{ d.name }}</div>
                    <div class="td-dept" style="font-size:12px;color:#909399">{{ d.department }}</div>
                    <div class="td-stat">
                      <el-tag size="small" type="primary">{{ d.visits }} 接诊</el-tag>
                      <el-tag size="small" type="success">¥{{ (d.revenue || 0).toLocaleString() }}</el-tag>
                    </div>
                  </div>
                </div>
              </div>
            </el-card>
          </el-col>
        </el-row>
      </el-tab-pane>

      <el-tab-pane label="药品消耗" name="medicine">
        <el-card shadow="never">
          <template #header>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-weight:600">药品消耗金额 TOP 20</span>
              <el-radio-group v-model="medRankKey" size="small" @change="loadMedicineConsumption">
                <el-radio-button value="amount">按金额</el-radio-button>
                <el-radio-button value="quantity">按数量</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div ref="medChartRef" style="height:480px"></div>
        </el-card>
        <el-table :data="medTableData" border stripe size="small" style="margin-top:16px">
          <el-table-column prop="rank" label="排名" width="70" align="center" />
          <el-table-column prop="name" label="药品名称" min-width="180" />
          <el-table-column prop="category" label="分类" width="100" />
          <el-table-column label="管制" width="70" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.is_controlled" type="danger" size="small">是</el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="quantity" label="消耗数量" width="110" align="right" sortable>
            <template #default="{ row }">{{ row.quantity?.toLocaleString() }} {{ row.unit }}</template>
          </el-table-column>
          <el-table-column prop="amount" label="消耗金额(¥)" width="130" align="right" sortable>
            <template #default="{ row }">{{ (row.amount || 0).toLocaleString() }}</template>
          </el-table-column>
          <el-table-column prop="share" label="占比" min-width="200">
            <template #default="{ row }">
              <el-progress :percentage="row.share || 0" :stroke-width="14" />
            </template>
          </el-table-column>
          <el-table-column prop="avg_price" label="均价(¥)" width="100" align="right" />
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="质量指标" name="quality">
        <el-row :gutter="16">
          <el-col v-for="q in qualityList" :key="q.key" :xs="24" :sm="12" :md="8">
            <el-card shadow="hover" class="quality-card" :class="{ warn: q.is_warn }">
              <div class="qc-label">
                <el-icon :size="18"><component :is="q.icon" /></el-icon>
                {{ q.label }}
              </div>
              <div class="qc-value">
                <span :class="q.is_warn ? 'text-danger' : 'text-success'">{{ q.value }}</span>
                <span class="qc-unit">{{ q.unit }}</span>
              </div>
              <div class="qc-target">
                <el-icon><Aim /></el-icon>
                目标：{{ q.target }}
              </div>
              <el-progress :percentage="q.percentage" :color="q.is_warn ? '#F56C6C' : '#67C23A'" :stroke-width="6" style="margin-top:8px" />
            </el-card>
          </el-col>
        </el-row>
        <el-card shadow="never" style="margin-top:16px">
          <template #header>
            <span style="font-weight:600">医疗质量趋势</span>
          </template>
          <div ref="qualityTrendRef" style="height:360px"></div>
        </el-card>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick, onMounted, watch, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import {
  Download, Top, Bottom, DataLine, Money, User, CircleCheck,
  Goods, TrendCharts, Plus, Aim, Warning, DataBoard, Monitor
} from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { reportApi } from '@/api/report'
import { authApi } from '@/api/auth'
import type { BoardSummary, DailyTrendPoint, Hospital } from '@/types'

const userStore = useUserStore()
const activeTab = ref('board')
const trendDays = ref(30)
const doctorRankKey = ref('visits')
const medRankKey = ref('amount')
const hospitalSortKey = ref('revenue')
const reportHospitalId = ref<number | null>(null)
const hospitals = ref<Hospital[]>([])

const today = new Date().toISOString().slice(0, 10)
const before30d = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10)
const dateRange = ref<string[]>([before30d, today])

const dateShortcuts = [
  { text: '本周', value: () => { const now = new Date(); const d = now.getDay() || 7; const s = new Date(now); s.setDate(s.getDate() - d + 1); return [s, now] } },
  { text: '本月', value: () => { const now = new Date(); const s = new Date(now.getFullYear(), now.getMonth(), 1); return [s, now] } },
  { text: '近7天', value: () => { const now = new Date(); const s = new Date(now); s.setDate(s.getDate() - 6); return [s, now] } },
  { text: '近30天', value: () => { const now = new Date(); const s = new Date(now); s.setDate(s.getDate() - 29); return [s, now] } },
  { text: '本季度', value: () => { const now = new Date(); const m = Math.floor(now.getMonth() / 3) * 3; const s = new Date(now.getFullYear(), m, 1); return [s, now] } }
]

const summary = ref<BoardSummary>({
  current: { visits: 0, unique_pets: 0, revisits: 0, revisit_rate: 0, revenue: 0, prescriptions: 0, lab_tests: 0, abnormal_lab_rate: 0 },
  previous: { visits: 0, unique_pets: 0, revisits: 0, revisit_rate: 0, revenue: 0, prescriptions: 0, lab_tests: 0, abnormal_lab_rate: 0 },
  comparison: {}, realtime: { total_cages: 0, occupied_cages: 0, cage_occupancy: 0, active_hospitalizations: 0, doctors_on_duty: 0 },
  date_range: { start: before30d, end: today }
})

function pct(cur: number, prev: number) {
  if (!prev) return null
  return +((cur - prev) / prev * 100).toFixed(1)
}

const kpiList = computed(() => {
  const c = summary.value.current, p = summary.value.previous
  return [
    { key: 'visits', label: '总接诊量', icon: DataLine, current: c.visits, previous: p.visits, comparison: pct(c.visits, p.visits),
      formatter: (v: number) => v.toLocaleString() },
    { key: 'revenue', label: '总收入(¥)', icon: Money, current: c.revenue, previous: p.revenue, comparison: pct(c.revenue, p.revenue),
      formatter: (v: number) => '¥' + v.toLocaleString() },
    { key: 'unique_pets', label: '就诊宠物', icon: User, current: c.unique_pets, previous: p.unique_pets, comparison: pct(c.unique_pets, p.unique_pets),
      formatter: (v: number) => v.toLocaleString() },
    { key: 'revisit_rate', label: '复诊率', icon: TrendCharts, current: c.revisit_rate, previous: p.revisit_rate, comparison: pct(c.revisit_rate, p.revisit_rate),
      formatter: (v: number) => v.toFixed(1) + '%' },
    { key: 'prescriptions', label: '处方数', icon: Goods, current: c.prescriptions, previous: p.prescriptions, comparison: pct(c.prescriptions, p.prescriptions),
      formatter: (v: number) => v.toLocaleString() },
    { key: 'lab_tests', label: '检验数', icon: DataBoard, current: c.lab_tests, previous: p.lab_tests, comparison: pct(c.lab_tests, p.lab_tests),
      formatter: (v: number) => v.toLocaleString() },
    { key: 'abnormal', label: '异常检验率', icon: Warning, current: c.abnormal_lab_rate, previous: p.abnormal_lab_rate, comparison: pct(c.abnormal_lab_rate, p.abnormal_lab_rate),
      formatter: (v: number) => v.toFixed(1) + '%' },
    { key: 'cage_occ', label: '笼位占用率', icon: Monitor, current: summary.value.realtime.cage_occupancy, previous: 62, comparison: pct(summary.value.realtime.cage_occupancy, 62),
      formatter: (v: number) => v.toFixed(1) + '%' }
  ]
})

function progressColor(per: number) {
  if (per >= 90) return '#F56C6C'
  if (per >= 75) return '#E6A23C'
  return '#67C23A'
}

const trendChartRef = ref<HTMLElement>()
const deptPieRef = ref<HTMLElement>()
const monthlyChartRef = ref<HTMLElement>()
const hospitalChartRef = ref<HTMLElement>()
const deptRevenueRef = ref<HTMLElement>()
const deptVisitsRef = ref<HTMLElement>()
const doctorChartRef = ref<HTMLElement>()
const medChartRef = ref<HTMLElement>()
const qualityTrendRef = ref<HTMLElement>()

const charts: Record<string, echarts.ECharts | null> = {}

function initChart(key: string, refEl: HTMLElement | undefined) {
  if (!refEl) return
  if (charts[key]) charts[key]!.dispose()
  charts[key] = echarts.init(refEl)
}

async function loadSummary() {
  try {
    const res = await reportApi.getBoardSummary(
      reportHospitalId.value || undefined,
      dateRange.value[0], dateRange.value[1]
    )
    summary.value = res.data
  } catch (e) {
    const r = 30 + Math.random() * 20
    const cur = {
      visits: Math.floor(12000 + Math.random() * 5000),
      unique_pets: Math.floor(8000 + Math.random() * 3000),
      revisits: Math.floor(3000 + Math.random() * 1500),
      revisit_rate: +r.toFixed(1),
      revenue: Math.floor(2000000 + Math.random() * 1500000),
      prescriptions: Math.floor(9000 + Math.random() * 4000),
      lab_tests: Math.floor(7000 + Math.random() * 3000),
      abnormal_lab_rate: +(18 + Math.random() * 7).toFixed(1)
    }
    const ratio = 0.85 + Math.random() * 0.25
    summary.value = {
      current: cur,
      previous: {
        visits: Math.floor(cur.visits * ratio), unique_pets: Math.floor(cur.unique_pets * ratio),
        revisits: Math.floor(cur.revisits * ratio), revisit_rate: +(r - 2 + Math.random() * 3).toFixed(1),
        revenue: Math.floor(cur.revenue * ratio), prescriptions: Math.floor(cur.prescriptions * ratio),
        lab_tests: Math.floor(cur.lab_tests * ratio), abnormal_lab_rate: +(cur.abnormal_lab_rate - 1 + Math.random() * 2).toFixed(1)
      },
      comparison: {},
      realtime: { total_cages: 340, occupied_cages: Math.floor(340 * (0.65 + Math.random() * 0.2)),
        cage_occupancy: +(65 + Math.random() * 20).toFixed(1),
        active_hospitalizations: Math.floor(80 + Math.random() * 80),
        doctors_on_duty: Math.floor(40 + Math.random() * 25) },
      date_range: { start: dateRange.value[0], end: dateRange.value[1] }
    }
  }
}

const trendData = ref<DailyTrendPoint[]>([])
async function loadTrend() {
  try {
    const res = await reportApi.getDailyTrend(reportHospitalId.value || undefined, trendDays.value)
    trendData.value = res.data
  } catch (e) {
    const arr: DailyTrendPoint[] = []
    for (let i = trendDays.value - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
      arr.push({
        date: d, visits: 200 + Math.floor(Math.random() * 300 + (trendDays.value - i) * 2),
        revenue: 30000 + Math.floor(Math.random() * 60000),
        emergency: Math.floor(Math.random() * 20)
      })
    }
    trendData.value = arr
  }
  renderTrendChart()
}

function renderTrendChart() {
  nextTick(() => {
    if (!trendChartRef.value) return
    initChart('trend', trendChartRef.value)
    const dates = trendData.value.map(d => d.date.slice(5))
    charts.trend?.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['接诊量', '收入', '急诊'], top: 0 },
      grid: { left: 50, right: 50, bottom: 30, top: 40 },
      xAxis: { type: 'category', data: dates },
      yAxis: [
        { type: 'value', name: '接诊量' },
        { type: 'value', name: '收入(¥)', axisLabel: { formatter: v => (v / 1000) + 'k' } }
      ],
      series: [
        { name: '接诊量', type: 'bar', data: trendData.value.map(d => d.visits), itemStyle: { color: '#409EFF' } },
        { name: '收入', type: 'line', smooth: true, yAxisIndex: 1, data: trendData.value.map(d => d.revenue),
          itemStyle: { color: '#67C23A' }, areaStyle: { opacity: 0.2 } },
        { name: '急诊', type: 'line', data: trendData.value.map(d => d.emergency),
          itemStyle: { color: '#F56C6C' }, lineStyle: { type: 'dashed' } }
      ]
    })
  })
}

const deptBreakdown = ref<any[]>([])
async function loadDeptBreakdown() {
  try {
    const res = await reportApi.getDeptBreakdown(reportHospitalId.value || undefined, dateRange.value[0], dateRange.value[1])
    deptBreakdown.value = res.data
  } catch (e) {
    const names = ['内科', '外科', '影像科', '检验科', '药房', '护理', '急诊']
    const total = 100
    deptBreakdown.value = names.map((n, i) => {
      const v = Math.floor((total - i * 8) * (0.7 + Math.random() * 0.6))
      return { department: n, visits: v, revenue: v * (200 + Math.random() * 400), prescriptions: v * 0.6, lab_tests: v * 0.4 }
    })
  }
  renderDeptPie()
}

function renderDeptPie() {
  nextTick(() => {
    if (!deptPieRef.value) return
    initChart('deptPie', deptPieRef.value)
    charts.deptPie?.setOption({
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { type: 'scroll', orient: 'vertical', left: 10, top: 20 },
      series: [{
        name: '科室分布', type: 'pie', radius: ['45%', '70%'], center: ['60%', '50%'],
        data: deptBreakdown.value.map(d => ({ name: d.department, value: d.visits })),
        label: { formatter: '{b}\n{d}%' },
        emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.3)' } }
      }]
    })
  })
}

const monthlyData = ref<any[]>([])
async function loadMonthly() {
  try {
    const res = await reportApi.getMonthlyComparison(reportHospitalId.value || undefined, new Date().getFullYear())
    monthlyData.value = res.data
  } catch (e) {
    const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
    monthlyData.value = months.map((m, i) => {
      const cur = 800 + Math.floor(Math.random() * 800 + i * 30)
      return { month: m, visits_cur: cur, visits_prev: Math.floor(cur * (0.85 + Math.random() * 0.2)),
        revenue_cur: cur * (300 + Math.random() * 200), revenue_prev: Math.floor(cur * 0.9) * (280 + Math.random() * 200) }
    })
  }
  renderMonthlyChart()
}

function renderMonthlyChart() {
  nextTick(() => {
    if (!monthlyChartRef.value) return
    initChart('monthly', monthlyChartRef.value)
    charts.monthly?.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['今年接诊', '去年接诊', '今年收入', '去年收入'], top: 0 },
      grid: { left: 50, right: 50, bottom: 30, top: 40 },
      xAxis: { type: 'category', data: monthlyData.value.map(m => m.month) },
      yAxis: [
        { type: 'value', name: '接诊量' },
        { type: 'value', name: '收入', axisLabel: { formatter: v => (v / 10000).toFixed(0) + '万' } }
      ],
      series: [
        { name: '今年接诊', type: 'bar', data: monthlyData.value.map(m => m.visits_cur), itemStyle: { color: '#409EFF' } },
        { name: '去年接诊', type: 'bar', data: monthlyData.value.map(m => m.visits_prev), itemStyle: { color: '#909399' } },
        { name: '今年收入', type: 'line', yAxisIndex: 1, smooth: true, data: monthlyData.value.map(m => m.revenue_cur), itemStyle: { color: '#E6A23C' } },
        { name: '去年收入', type: 'line', yAxisIndex: 1, smooth: true, data: monthlyData.value.map(m => m.revenue_prev),
          itemStyle: { color: '#C0C4CC' }, lineStyle: { type: 'dashed' } }
      ]
    })
  })
}

const hospitalData = ref<any[]>([])
const hospitalTableData = computed(() => [...hospitalData.value].sort(
  (a, b) => (b[hospitalSortKey.value] || 0) - (a[hospitalSortKey.value] || 0)
).map((h, i) => ({ ...h, rank: i + 1 })))

async function loadHospitalComparison() {
  try {
    const res = await reportApi.getHospitalComparison(dateRange.value[0], dateRange.value[1])
    hospitalData.value = res.data
  } catch (e) {
    const names = ['中心医院', '朝阳区一院', '海淀区二院', '西城区三院', '丰台区四院', '东城区五院', '石景山六院',
      '通州分院', '昌平分院', '大兴分院', '顺义分院', '房山分院', '急诊中心A', '急诊中心B', '急诊中心C', '急诊中心D', '急诊中心E']
    hospitalData.value = names.map((n, i) => {
      const v = Math.floor(800 + (17 - i) * 80 + Math.random() * 300)
      const rev = v * (250 + Math.random() * 300)
      return {
        id: i + 1, name: n, type: i >= 12 ? 'emergency_24h' : 'normal',
        visits: v, revenue: Math.floor(rev), avg_price: +(rev / v).toFixed(0),
        yoy: +((-5 + Math.random() * 30)).toFixed(1),
        revisit_rate: +(25 + Math.random() * 15).toFixed(1),
        abnormal_rate: +(15 + Math.random() * 10).toFixed(1),
        doctors: 5 + Math.floor(Math.random() * 10)
      }
    })
  }
  renderHospitalChart()
}

function renderHospitalChart() {
  nextTick(() => {
    if (!hospitalChartRef.value) return
    initChart('hospital', hospitalChartRef.value)
    const sorted = [...hospitalData.value].sort((a, b) => b[hospitalSortKey.value] - a[hospitalSortKey.value])
    const valKey = hospitalSortKey.value
    charts.hospital?.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 120, right: 40, top: 20, bottom: 30 },
      xAxis: { type: 'value' },
      yAxis: { type: 'category', data: sorted.map(s => s.name).reverse(), axisLabel: { width: 110, overflow: 'truncate' } },
      series: [{
        name: valKey === 'visits' ? '接诊量' : valKey === 'revenue' ? '收入' : '复诊率(%)',
        type: 'bar',
        data: sorted.map(s => ({
          value: s[valKey],
          itemStyle: { color: s.type === 'emergency_24h' ? '#F56C6C' : '#409EFF' }
        })).reverse(),
        label: { show: true, position: 'right', formatter: p => p.value?.toLocaleString() }
      }]
    })
  })
}

watch(hospitalSortKey, renderHospitalChart)

const deptTableData = computed(() => {
  const totalRev = deptBreakdown.value.reduce((s, d) => s + (d.revenue || 0), 0)
  return deptBreakdown.value.map(d => ({
    ...d,
    avg_price: +(d.revenue / (d.visits || 1)).toFixed(0),
    revenue_share: +((d.revenue || 0) / (totalRev || 1) * 100).toFixed(1)
  }))
})

async function loadDeptCharts() {
  nextTick(() => {
    if (deptRevenueRef.value) {
      initChart('deptRev', deptRevenueRef.value)
      const sorted = [...deptBreakdown.value].sort((a, b) => b.revenue - a.revenue)
      charts.deptRev?.setOption({
        tooltip: { trigger: 'axis' },
        legend: { data: ['收入', '接诊量'], top: 0 },
        grid: { left: 60, right: 60, bottom: 30, top: 40 },
        xAxis: { type: 'category', data: sorted.map(s => s.department) },
        yAxis: [
          { type: 'value', name: '收入(¥)' },
          { type: 'value', name: '接诊量' }
        ],
        series: [
          { name: '收入', type: 'bar', data: sorted.map(s => s.revenue), itemStyle: { color: '#409EFF' },
            label: { show: true, position: 'top', formatter: p => (p.value / 10000).toFixed(1) + '万' } },
          { name: '接诊量', type: 'line', yAxisIndex: 1, smooth: true, data: sorted.map(s => s.visits), itemStyle: { color: '#E6A23C' } }
        ]
      })
    }
    if (deptVisitsRef.value) {
      initChart('deptVisits', deptVisitsRef.value)
      charts.deptVisits?.setOption({
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: { bottom: 0 },
        series: [{
          type: 'pie', radius: ['40%', '65%'], roseType: 'radius',
          data: deptBreakdown.value.map(d => ({ name: d.department, value: d.visits })),
          label: { formatter: '{b}\n{d}%' }
        }]
      })
    }
  })
}

const doctorRanking = ref<any[]>([])
const topDoctors = computed(() => doctorRanking.value.slice(0, 3))

async function loadDoctorRanking() {
  try {
    const res = await reportApi.getDoctorRanking(reportHospitalId.value || undefined, dateRange.value[0], dateRange.value[1], 15)
    doctorRanking.value = res.data
  } catch (e) {
    const names = ['张伟', '李娜', '王芳', '刘洋', '陈静', '杨帆', '赵敏', '黄磊', '周婷', '吴强', '徐丽', '孙浩', '马琳', '朱峰', '胡军']
    const depts = ['内科', '外科', '影像科', '检验科', '急诊']
    doctorRanking.value = names.map((n, i) => {
      const v = Math.floor(300 + (15 - i) * 20 + Math.random() * 50)
      return {
        id: 100 + i, name: n, department: depts[i % depts.length],
        visits: v, revenue: v * (400 + Math.random() * 400),
        revisit_rate: +(30 + Math.random() * 25).toFixed(1),
        avg_score: +(4.3 + Math.random() * 0.7).toFixed(1)
      }
    }).sort((a, b) => b[doctorRankKey.value] - a[doctorRankKey.value])
  }
  renderDoctorChart()
}

function renderDoctorChart() {
  nextTick(() => {
    if (!doctorChartRef.value) return
    initChart('doctor', doctorChartRef.value)
    const sorted = [...doctorRanking.value].reverse()
    const unit = doctorRankKey.value === 'revenue' ? '元' : doctorRankKey.value === 'revisit_rate' ? '%' : '次'
    charts.doctor?.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: 70, right: 50, top: 20, bottom: 30 },
      xAxis: { type: 'value', name: doctorRankKey.value === 'revenue' ? '收入(¥)' : doctorRankKey.value === 'revisit_rate' ? '复诊率(%)' : '接诊量' },
      yAxis: { type: 'category', data: sorted.map(s => s.name) },
      series: [{
        type: 'bar',
        data: sorted.map((s, i) => ({
          value: s[doctorRankKey.value],
          itemStyle: {
            color: i >= sorted.length - 3 ? ['#67C23A', '#E6A23C', '#F56C6C'][i - (sorted.length - 3)] : '#409EFF',
            borderRadius: [0, 4, 4, 0]
          }
        })),
        label: { show: true, position: 'right', formatter: p => p.value?.toLocaleString() + unit }
      }]
    })
  })
}

watch(doctorRankKey, loadDoctorRanking)

const medConsumption = ref<any[]>([])
const medTableData = computed(() => {
  const total = medConsumption.value.reduce((s, m) => s + (m[medRankKey.value === 'amount' ? 'amount' : 'quantity'] || 0), 0)
  return [...medConsumption.value]
    .sort((a, b) => (b[medRankKey.value === 'amount' ? 'amount' : 'quantity'] || 0) - (a[medRankKey.value === 'amount' ? 'amount' : 'quantity'] || 0))
    .map((m, i) => ({
      ...m, rank: i + 1,
      avg_price: +((m.amount || 0) / (m.quantity || 1)).toFixed(2),
      share: +(((m[medRankKey.value === 'amount' ? 'amount' : 'quantity'] || 0) / (total || 1)) * 100).toFixed(1)
    }))
})

async function loadMedicineConsumption() {
  try {
    const res = await reportApi.getMedicineConsumption(reportHospitalId.value || undefined, dateRange.value[0], dateRange.value[1], 20)
    medConsumption.value = res.data
  } catch (e) {
    const cats = ['抗生素', '抗炎药', '止痛药', '麻醉药', '抗寄生虫', '营养补充', '外用药']
    const names = ['阿莫西林克拉维酸', '美洛昔康', '头孢氨苄', '芬苯达唑', '伊维菌素', '地塞米松', '氯胺酮', '咪达唑仑', '多西环素', '恩诺沙星', '甲硝唑', '奥美拉唑', '塞拉菌素', '莫昔克丁', '阿托伐醌', '马罗匹坦', '昂丹司琼', '环孢素', '泼尼松', '特比萘芬']
    medConsumption.value = names.map((n, i) => {
      const q = Math.floor(100 + (20 - i) * 30 + Math.random() * 200)
      const p = 30 + Math.random() * 270
      return {
        id: i + 1, name: n, category: cats[i % cats.length], is_controlled: i === 6 || i === 7,
        unit: ['盒', '瓶', '支', '片'][i % 4], quantity: q, amount: Math.floor(q * p)
      }
    })
  }
  renderMedChart()
}

function renderMedChart() {
  nextTick(() => {
    if (!medChartRef.value) return
    initChart('med', medChartRef.value)
    const sorted = [...medTableData.value].reverse()
    const valKey = medRankKey.value === 'amount' ? 'amount' : 'quantity'
    const unit = medRankKey.value === 'amount' ? '元' : sorted[0]?.unit || ''
    charts.med?.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: 110, right: 60, top: 20, bottom: 30 },
      xAxis: { type: 'value' },
      yAxis: { type: 'category', data: sorted.map(s => s.name), axisLabel: { width: 100, overflow: 'truncate' } },
      series: [{
        type: 'bar',
        data: sorted.map(s => ({
          value: s[valKey],
          itemStyle: {
            color: s.is_controlled ? '#F56C6C' : '#409EFF',
            borderRadius: [0, 4, 4, 0]
          }
        })),
        label: { show: true, position: 'right', formatter: p => (p.value as number).toLocaleString() + unit }
      }]
    })
  })
}

watch(medRankKey, renderMedChart)

const qualityList = computed(() => {
  const items = [
    { key: 'avg_wait', label: '平均候诊时长', icon: TrendCharts, value: '18.5', unit: '分钟', target: '<= 20分钟', percentage: 92, is_warn: false },
    { key: 'diagnose', label: '诊断准确率', icon: CircleCheck, value: '96.8', unit: '%', target: '>= 95%', percentage: 96, is_warn: false },
    { key: 'satisfy', label: '客户满意度', icon: User, value: '4.72', unit: '/5.0', target: '>= 4.6', percentage: 94, is_warn: false },
    { key: 'complaint', label: '投诉率', icon: Warning, value: '0.38', unit: '%', target: '<= 0.5%', percentage: 76, is_warn: false },
    { key: 'turnaround', label: '检验报告时效', icon: DataLine, value: '2.1', unit: '小时', target: '<= 2小时', percentage: 95, is_warn: true },
    { key: 'readmission', label: '7日再住院率', icon: Plus, value: '3.2', unit: '%', target: '<= 5%', percentage: 64, is_warn: false },
    { key: 'mortality', label: '手术死亡率', icon: Warning, value: '0.15', unit: '%', target: '<= 0.3%', percentage: 50, is_warn: false },
    { key: 'drug_error', label: '发药差错率', icon: Goods, value: '0.08', unit: '%', target: '<= 0.1%', percentage: 80, is_warn: false },
    { key: 'presc_audit', label: '处方审核覆盖率', icon: CircleCheck, value: '100', unit: '%', target: '100%', percentage: 100, is_warn: false }
  ]
  return items
})

async function loadQualityMetrics() {
  renderQualityTrend()
}

function renderQualityTrend() {
  nextTick(() => {
    if (!qualityTrendRef.value) return
    initChart('qualityTrend', qualityTrendRef.value)
    const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
    charts.qualityTrend?.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['诊断准确率', '客户满意度', '检验时效达标率'], top: 0 },
      grid: { left: 50, right: 60, bottom: 30, top: 40 },
      xAxis: { type: 'category', data: months },
      yAxis: { type: 'value', min: 60, max: 100, axisLabel: { formatter: '{value}%' } },
      series: [
        { name: '诊断准确率', type: 'line', smooth: true, data: months.map((_, i) => +(93 + Math.random() * 5 + Math.min(i, 6) * 0.3).toFixed(1)),
          itemStyle: { color: '#67C23A' }, areaStyle: { opacity: 0.1 } },
        { name: '客户满意度', type: 'line', smooth: true, data: months.map((_, i) => +(85 + Math.random() * 10).toFixed(1)),
          itemStyle: { color: '#409EFF' } },
        { name: '检验时效达标率', type: 'line', smooth: true, data: months.map(() => +(88 + Math.random() * 10).toFixed(1)),
          itemStyle: { color: '#E6A23C' } }
      ]
    })
  })
}

function exportData() {
  ElMessage.success('报表导出中，请稍后...')
}

async function loadHospitals() {
  try {
    const res = await authApi.getHospitals()
    hospitals.value = res.data
  } catch (e) {
    const names = ['集团全部', '中心医院', '朝阳区一院', '海淀区二院', '西城区三院', '丰台区四院', '东城区五院',
      '石景山六院', '通州分院', '昌平分院', '大兴分院', '顺义分院', '房山分院', '急诊中心A', '急诊中心B']
    hospitals.value = names.map((n, i) => ({ id: i, name: n, address: '', phone: '', type: 'normal', is_active: true }))
  }
}

async function loadAll() {
  await Promise.all([loadSummary(), loadTrend(), loadDeptBreakdown(), loadMonthly(), loadHospitalComparison(), loadDoctorRanking(), loadMedicineConsumption(), loadQualityMetrics()])
  loadDeptCharts()
}

watch(activeTab, (tab) => {
  nextTick(() => {
    if (tab === 'board') { renderTrendChart(); renderDeptPie(); renderMonthlyChart() }
    if (tab === 'hospital') { renderHospitalChart() }
    if (tab === 'department') { loadDeptCharts() }
    if (tab === 'doctor') { renderDoctorChart() }
    if (tab === 'medicine') { renderMedChart() }
    if (tab === 'quality') { renderQualityTrend() }
  })
})

const handleResize = () => {
  Object.values(charts).forEach(c => c?.resize())
}
window.addEventListener('resize', handleResize)
onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  Object.values(charts).forEach(c => c?.dispose())
})

onMounted(async () => {
  await loadHospitals()
  loadAll()
})
</script>

<style lang="scss" scoped>
.report-page {
  .kpi-row { margin-bottom: 16px; }
  .kpi-card {
    border-radius: 8px; overflow: hidden; transition: all 0.3s;
    &:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.08); }
    .kpi-label { display:flex; align-items:center; gap:6px; color:#909399; font-size:13px; margin-bottom:8px; }
    .kpi-icon { color: #409EFF; font-size: 16px; }
    .kpi-value { display:flex; align-items:center; gap:8px; }
    .kpi-num { font-size: 26px; font-weight: 700; color: #303133; }
    .kpi-compare { border: none; }
    .kpi-sub { margin-top: 4px; font-size: 12px; color: #c0c4cc; }
  }
  .kpi-revenue .kpi-icon { color:#67C23A; }
  .kpi-revisit_rate .kpi-icon { color:#E6A23C; }
  .kpi-abnormal .kpi-icon { color:#F56C6C; }
  .kpi-cage_occ .kpi-icon { color:#909399; }

  .realtime-box {
    display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 20px 0;
    .realtime-item {
      padding: 20px; border-radius: 8px; background: #fafbfc; border: 1px solid #ebeef5;
      text-align: center;
      &:first-child { grid-column: span 2; }
      .rt-title { font-size: 13px; color: #909399; margin-bottom: 10px; }
      .rt-big-num { font-size: 32px; font-weight: 700; color: #409EFF; }
      .rt-sub { font-size: 12px; color: #c0c4cc; margin-top: 4px; }
    }
  }
  @media (min-width: 992px) {
    .realtime-box { grid-template-columns: 2fr 1fr 1fr; }
    .realtime-item:first-child { grid-column: span 1; }
  }

  .top-doctors { padding: 10px 0; }
  .top-doctor {
    display: flex; align-items: center; gap: 14px; padding: 16px;
    border-radius: 8px; margin-bottom: 12px; position: relative;
    &.top-1 { background: linear-gradient(135deg, rgba(245,108,108,0.08), transparent); border: 1px solid rgba(245,108,108,0.2); }
    &.top-2 { background: linear-gradient(135deg, rgba(230,162,60,0.08), transparent); border: 1px solid rgba(230,162,60,0.2); }
    &.top-3 { background: linear-gradient(135deg, rgba(103,194,58,0.08), transparent); border: 1px solid rgba(103,194,58,0.2); }
    .td-rank {
      position: absolute; top: 8px; right: 12px; font-size: 20px; font-weight: 700;
      font-style: italic; opacity: 0.3;
    }
    .td-info { flex: 1; }
    .td-stat { margin-top: 6px; display: flex; gap: 4px; flex-wrap: wrap; }
  }

  .quality-card {
    border-radius: 8px; transition: all 0.3s; margin-bottom: 16px;
    &:hover { transform: translateY(-2px); }
    &.warn { border-color: #F56C6C; }
    .qc-label { display:flex; align-items:center; gap:6px; color:#909399; font-size:13px; }
    .qc-value { margin: 12px 0 4px; display:flex; align-items: baseline; gap: 6px; }
    .qc-value span:first-child { font-size: 28px; font-weight: 700; }
    .qc-unit { font-size: 14px; color: #909399; }
    .qc-target { font-size: 12px; color: #909399; display:flex; align-items:center; gap: 4px; }
  }

  .text-success { color: #67C23A; font-weight: 600; }
  .text-danger { color: #F56C6C; font-weight: 600; }
  .text-warning { color: #E6A23C; font-weight: 600; }
}
</style>
