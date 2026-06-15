<template>
  <div class="quality-dashboard">
    <div class="page-header">
      <h2>质控考核报表</h2>
      <div class="header-actions">
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          :shortcuts="dateShortcuts"
          @change="loadDashboardData"
        />
        <el-button type="primary" @click="openSamplingDialog">
          <el-icon><Refresh /></el-icon>
          随机抽样
        </el-button>
        <el-button @click="exportReport">
          <el-icon><Download /></el-icon>
          导出报表
        </el-button>
      </div>
    </div>

    <el-card class="metrics-card">
      <el-row :gutter="20">
        <el-col :span="4">
          <div class="metric-item">
            <div class="metric-icon primary"><el-icon><DocumentChecked /></el-icon></div>
            <div class="metric-info">
              <div class="metric-value">{{ dashboardData?.keyMetrics?.totalReviews || 0 }}</div>
              <div class="metric-label">总抽查数</div>
            </div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="metric-item">
            <div class="metric-icon warning"><el-icon><Clock /></el-icon></div>
            <div class="metric-info">
              <div class="metric-value">{{ dashboardData?.keyMetrics?.pendingReviews || 0 }}</div>
              <div class="metric-label">待复核</div>
            </div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="metric-item">
            <div class="metric-icon success"><el-icon><CircleCheck /></el-icon></div>
            <div class="metric-info">
              <div class="metric-value">{{ dashboardData?.keyMetrics?.completedReviews || 0 }}</div>
              <div class="metric-label">已完成</div>
            </div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="metric-item">
            <div class="metric-icon info"><el-icon><Trophy /></el-icon></div>
            <div class="metric-info">
              <div class="metric-value">{{ (dashboardData?.keyMetrics?.averageScore || 0).toFixed(1) }}</div>
              <div class="metric-label">平均得分</div>
            </div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="metric-item">
            <div class="metric-icon success2"><el-icon><TrendCharts /></el-icon></div>
            <div class="metric-info">
              <div class="metric-value">{{ (dashboardData?.keyMetrics?.passRate || 0).toFixed(1) }}%</div>
              <div class="metric-label">合格率</div>
            </div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="metric-item">
            <div class="metric-icon danger"><el-icon><Warning /></el-icon></div>
            <div class="metric-info">
              <div class="metric-value">{{ dashboardData?.keyMetrics?.overdueCount || 0 }}</div>
              <div class="metric-label">超时预警</div>
            </div>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <el-row :gutter="20" class="charts-row">
      <el-col :span="16">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <span>时间指标分析</span>
              <el-radio-group v-model="activeMetric" size="small" @change="updateTimeChart">
                <el-radio-button value="RESPONSE_TIME">反应时间</el-radio-button>
                <el-radio-button value="ON_SCENE_DURATION">现场处置</el-radio-button>
                <el-radio-button value="TRANSIT_DURATION">转运时长</el-radio-button>
                <el-radio-button value="TOTAL_CYCLE_TIME">总周期</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div ref="timeChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="chart-card">
          <template #header>
            <span>病种分布TOP10</span>
          </template>
          <div ref="diseaseChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="charts-row">
      <el-col :span="12">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <span>质量趋势分析</span>
              <el-radio-group v-model="trendType" size="small" @change="updateTrendChart">
                <el-radio-button value="score">平均分</el-radio-button>
                <el-radio-button value="passRate">合格率</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div ref="trendChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card class="chart-card">
          <template #header>
            <span>各区域反应时间对比</span>
          </template>
          <div ref="regionChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="table-card">
      <template #header>
        <div class="card-header">
          <span>近期抽查记录</span>
          <el-tag v-if="pendingReviews.length > 0" type="warning" size="small">
            {{ pendingReviews.length }} 条待复核
          </el-tag>
        </div>
      </template>
      <el-table :data="dashboardData?.recentReviews || []" v-loading="loading">
        <el-table-column prop="recordNo" label="病历编号" width="140" />
        <el-table-column prop="patientName" label="患者姓名" width="100" />
        <el-table-column prop="preliminaryDiagnosis" label="初步诊断" min-width="150" show-overflow-tooltip />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getReviewStatusType(row.reviewStatus)" size="small">
              {{ getReviewStatusText(row.reviewStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="得分" width="80">
          <template #default="{ row }">
            <span :class="getScoreClass(row.score, row.maxScore)">
              {{ row.score !== undefined ? row.score : '-' }}/{{ row.maxScore }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="reviewerName" label="审核人" width="100" />
        <el-table-column label="截止日期" width="120">
          <template #default="{ row }">
            <span :class="{ 'text-danger': row.isOverdue }">
              {{ formatDate(row.dueDate) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="160">
          <template #default="{ row }">
            {{ formatDateTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="viewReview(row)">
              查看
            </el-button>
            <el-button type="warning" link size="small" v-if="row.reviewStatus === 'PENDING'" @click="editReview(row)">
              审核
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="samplingDialogVisible" title="随机抽样配置" width="500px">
      <el-form :model="samplingForm" label-width="100px">
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="samplingForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item label="抽样数量">
          <el-input-number v-model="samplingForm.sampleSize" :min="1" :max="100" />
        </el-form-item>
        <el-form-item label="病情分级">
          <el-checkbox-group v-model="samplingForm.severityFilters">
            <el-checkbox label="CRITICAL">危重</el-checkbox>
            <el-checkbox label="SEVERE">重症</el-checkbox>
            <el-checkbox label="MODERATE">中症</el-checkbox>
            <el-checkbox label="MINOR">轻症</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="samplingDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="runSampling">执行抽样</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="reviewDialogVisible" title="质控审核" width="800px">
      <el-form v-if="currentReview" :model="reviewForm" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="病历编号">
              <span>{{ currentReview.recordNo }}</span>
            </el-form-item>
            <el-form-item label="患者姓名">
              <span>{{ currentReview.patientName }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="审核状态">
              <el-select v-model="reviewForm.reviewStatus">
                <el-option label="审核中" value="IN_PROGRESS" />
                <el-option label="需整改" value="NEEDS_REVISION" />
                <el-option label="已通过" value="APPROVED" />
              </el-select>
            </el-form-item>
            <el-form-item label="得分">
              <el-input-number v-model="reviewForm.score" :min="0" :max="currentReview.maxScore" />
              <span> / {{ currentReview.maxScore }}</span>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="审核意见">
          <el-input v-model="reviewForm.reviewNotes" type="textarea" :rows="3" />
        </el-form-item>
        <el-divider>缺陷标注</el-divider>
        <div class="defect-list">
          <div v-for="(defect, index) in reviewForm.defects" :key="index" class="defect-item">
            <el-row :gutter="10">
              <el-col :span="6">
                <el-input v-model="defect.fieldName" placeholder="字段名称" />
              </el-col>
              <el-col :span="8">
                <el-input v-model="defect.defectDescription" placeholder="缺陷描述" />
              </el-col>
              <el-col :span="6">
                <el-select v-model="defect.severity" placeholder="严重程度">
                  <el-option label="轻微" value="MINOR" />
                  <el-option label="严重" value="MAJOR" />
                  <el-option label="危重" value="CRITICAL" />
                </el-select>
              </el-col>
              <el-col :span="3">
                <el-button type="danger" link @click="removeDefect(index)">删除</el-button>
              </el-col>
            </el-row>
          </div>
          <el-button type="primary" link @click="addDefect">
            <el-icon><Plus /></el-icon>
            添加缺陷
          </el-button>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="reviewDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveReview">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as echarts from 'echarts'
import {
  DocumentChecked,
  Clock,
  CircleCheck,
  Trophy,
  TrendCharts,
  Warning,
  Refresh,
  Download,
  Plus
} from '@element-plus/icons-vue'
import {
  getQualityDashboard,
  runSampling as apiRunSampling,
  updateReview,
  exportQualityReport
} from '@/api/quality'
import type {
  QualityDashboardData,
  QualityControlReview,
  ReviewUpdateRequest,
  SamplingRequest,
  TimeMetrics,
  QualityDefect,
  ReviewStatus,
  DefectSeverity
} from '@/types/quality'

const loading = ref(false)
const dashboardData = ref<QualityDashboardData | null>(null)
const dateRange = ref<string[]>([])
const activeMetric = ref('RESPONSE_TIME')
const trendType = ref('score')

const timeChartRef = ref<HTMLElement>()
const diseaseChartRef = ref<HTMLElement>()
const trendChartRef = ref<HTMLElement>()
const regionChartRef = ref<HTMLElement>()

let timeChart: echarts.ECharts | null = null
let diseaseChart: echarts.ECharts | null = null
let trendChart: echarts.ECharts | null = null
let regionChart: echarts.ECharts | null = null

const samplingDialogVisible = ref(false)
const samplingForm = reactive({
  dateRange: [] as string[],
  sampleSize: 20,
  severityFilters: [] as string[]
})

const reviewDialogVisible = ref(false)
const currentReview = ref<QualityControlReview | null>(null)
const reviewForm = reactive<ReviewUpdateRequest>({
  reviewStatus: undefined,
  score: undefined,
  reviewNotes: '',
  defects: [] as QualityDefect[]
})

const dateShortcuts = [
  {
    text: '本周',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - start.getDay())
      return [start, end]
    }
  },
  {
    text: '本月',
    value: () => {
      const end = new Date()
      const start = new Date(end.getFullYear(), end.getMonth(), 1)
      return [start, end]
    }
  },
  {
    text: '近30天',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - 30)
      return [start, end]
    }
  }
]

const pendingReviews = computed(() => {
  return dashboardData.value?.recentReviews?.filter(r => r.reviewStatus === 'PENDING') || []
})

function getReviewStatusType(status: ReviewStatus): string {
  const map: Record<string, string> = {
    PENDING: 'warning',
    IN_PROGRESS: 'primary',
    COMPLETED: 'success',
    NEEDS_REVISION: 'danger',
    APPROVED: 'success'
  }
  return map[status] || 'info'
}

function getReviewStatusText(status: ReviewStatus): string {
  const map: Record<string, string> = {
    PENDING: '待审核',
    IN_PROGRESS: '审核中',
    COMPLETED: '已完成',
    NEEDS_REVISION: '需整改',
    APPROVED: '已通过'
  }
  return map[status] || status
}

function getScoreClass(score?: number, maxScore?: number): string {
  if (score === undefined || !maxScore) return ''
  const percentage = (score / maxScore) * 100
  if (percentage >= 90) return 'text-success'
  if (percentage >= 70) return 'text-warning'
  return 'text-danger'
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('zh-CN')
}

function formatDateTime(date: string): string {
  return new Date(date).toLocaleString('zh-CN')
}

async function loadDashboardData() {
  loading.value = true
  try {
    const params: Record<string, string> = {}
    if (dateRange.value && dateRange.value.length === 2) {
      params.startDate = dateRange.value[0]
      params.endDate = dateRange.value[1]
    }
    dashboardData.value = await getQualityDashboard()
    await nextTick()
    initCharts()
  } catch (error) {
    ElMessage.error('加载质控数据失败')
  } finally {
    loading.value = false
  }
}

function initCharts() {
  initTimeChart()
  initDiseaseChart()
  initTrendChart()
  initRegionChart()
}

function initTimeChart() {
  if (!timeChartRef.value || !dashboardData.value?.timeMetrics) return
  
  if (timeChart) {
    timeChart.dispose()
  }
  
  timeChart = echarts.init(timeChartRef.value)
  updateTimeChart()
  
  window.addEventListener('resize', handleResize)
}

function updateTimeChart() {
  if (!timeChart || !dashboardData.value?.timeMetrics) return
  
  const metric = dashboardData.value.timeMetrics.find(
    (m: TimeMetrics) => m.metricType === activeMetric.value
  )
  
  if (!metric) return
  
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: ['平均', '中位数', 'P95', '最小', '最大'],
      axisLabel: { interval: 0 }
    },
    yAxis: {
      type: 'value',
      name: '分钟'
    },
    series: [
      {
        name: '时间(分钟)',
        type: 'bar',
        data: [
          metric.averageMinutes,
          metric.medianMinutes,
          metric.p95Minutes,
          metric.minMinutes,
          metric.maxMinutes
        ],
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#409eff' },
            { offset: 1, color: '#66b1ff' }
          ])
        },
        markLine: {
          silent: true,
          data: [{ yAxis: metric.thresholdMinutes, name: '阈值' }],
          lineStyle: { color: '#f56c6c', type: 'dashed' }
        }
      }
    ]
  }
  
  timeChart.setOption(option)
}

function initDiseaseChart() {
  if (!diseaseChartRef.value || !dashboardData.value?.diseaseDistribution) return
  
  if (diseaseChart) {
    diseaseChart.dispose()
  }
  
  diseaseChart = echarts.init(diseaseChartRef.value)
  
  const data = dashboardData.value.diseaseDistribution.map((item: any) => ({
    value: item.count,
    name: item.diagnosis
  }))
  
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
      textStyle: { fontSize: 12 }
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 5,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: { show: false },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold'
          }
        },
        data
      }
    ]
  }
  
  diseaseChart.setOption(option)
}

function initTrendChart() {
  if (!trendChartRef.value || !dashboardData.value?.trendData) return
  
  if (trendChart) {
    trendChart.dispose()
  }
  
  trendChart = echarts.init(trendChartRef.value)
  updateTrendChart()
}

function updateTrendChart() {
  if (!trendChart || !dashboardData.value?.trendData) return
  
  const dates = dashboardData.value.trendData.map((item: any) => item.date)
  const data = trendType.value === 'score'
    ? dashboardData.value.trendData.map((item: any) => item.averageScore)
    : dashboardData.value.trendData.map((item: any) => item.passRate)
  
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis'
    },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false
    },
    yAxis: {
      type: 'value',
      name: trendType.value === 'score' ? '得分' : '百分比(%)'
    },
    series: [
      {
        name: trendType.value === 'score' ? '平均得分' : '合格率(%)',
        type: 'line',
        smooth: true,
        data,
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(103, 194, 58, 0.5)' },
            { offset: 1, color: 'rgba(103, 194, 58, 0.05)' }
          ])
        },
        lineStyle: { color: '#67c23a', width: 2 },
        itemStyle: { color: '#67c23a' }
      }
    ]
  }
  
  trendChart.setOption(option)
}

function initRegionChart() {
  if (!regionChartRef.value || !dashboardData.value?.responseTimeByRegion) return
  
  if (regionChart) {
    regionChart.dispose()
  }
  
  regionChart = echarts.init(regionChartRef.value)
  
  const regions = dashboardData.value.responseTimeByRegion.map((item: any) => item.region)
  const responseTimes = dashboardData.value.responseTimeByRegion.map(
    (item: any) => item.averageResponseMinutes
  )
  const passRates = dashboardData.value.responseTimeByRegion.map(
    (item: any) => item.passRate
  )
  
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' }
    },
    legend: {
      data: ['平均反应时间(分钟)', '合格率(%)']
    },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: regions,
      axisLabel: { interval: 0, rotate: 30 }
    },
    yAxis: [
      {
        type: 'value',
        name: '分钟',
        position: 'left'
      },
      {
        type: 'value',
        name: '百分比(%)',
        position: 'right',
        min: 0,
        max: 100
      }
    ],
    series: [
      {
        name: '平均反应时间(分钟)',
        type: 'bar',
        data: responseTimes,
        itemStyle: { color: '#409eff' }
      },
      {
        name: '合格率(%)',
        type: 'line',
        yAxisIndex: 1,
        data: passRates,
        lineStyle: { color: '#e6a23c', width: 2 },
        itemStyle: { color: '#e6a23c' }
      }
    ]
  }
  
  regionChart.setOption(option)
}

function handleResize() {
  timeChart?.resize()
  diseaseChart?.resize()
  trendChart?.resize()
  regionChart?.resize()
}

function openSamplingDialog() {
  samplingDialogVisible.value = true
}

async function runSampling() {
  if (!samplingForm.dateRange || samplingForm.dateRange.length !== 2) {
    ElMessage.warning('请选择时间范围')
    return
  }
  
  const request: SamplingRequest = {
    startDate: samplingForm.dateRange[0],
    endDate: samplingForm.dateRange[1],
    sampleSize: samplingForm.sampleSize,
    severityFilters: samplingForm.severityFilters
  }
  
  try {
    const result = await apiRunSampling(request)
    ElMessage.success(`抽样完成，共抽取 ${result.sampledCount} 份病历`)
    samplingDialogVisible.value = false
    loadDashboardData()
  } catch (error) {
    ElMessage.error('抽样失败')
  }
}

function viewReview(row: QualityControlReview) {
  currentReview.value = row
  reviewForm.reviewStatus = row.reviewStatus
  reviewForm.score = row.score
  reviewForm.reviewNotes = row.reviewNotes || ''
  reviewForm.defects = [...(row.defects || [])]
  reviewDialogVisible.value = true
}

function editReview(row: QualityControlReview) {
  viewReview(row)
}

function addDefect() {
  reviewForm.defects?.push({
    fieldName: '',
    defectDescription: '',
    severity: 'MINOR' as DefectSeverity
  })
}

function removeDefect(index: number) {
  reviewForm.defects?.splice(index, 1)
}

async function saveReview() {
  if (!currentReview.value) return
  
  try {
    await updateReview(currentReview.value.id, reviewForm)
    ElMessage.success('保存成功')
    reviewDialogVisible.value = false
    loadDashboardData()
  } catch (error) {
    ElMessage.error('保存失败')
  }
}

async function exportReport() {
  if (!dateRange.value || dateRange.value.length !== 2) {
    ElMessage.warning('请先选择时间范围')
    return
  }
  
  try {
    const blob = await exportQualityReport(dateRange.value[0], dateRange.value[1])
    const url = window.URL.createObjectURL(new Blob([blob]))
    const link = document.createElement('a')
    link.href = url
    link.download = `质控报表_${dateRange.value[0]}_${dateRange.value[1]}.xlsx`
    link.click()
    window.URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (error) {
    ElMessage.error('导出失败')
  }
}

onMounted(() => {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 30)
  dateRange.value = [
    start.toISOString().split('T')[0],
    end.toISOString().split('T')[0]
  ]
  loadDashboardData()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  timeChart?.dispose()
  diseaseChart?.dispose()
  trendChart?.dispose()
  regionChart?.dispose()
})
</script>

<style scoped lang="scss">
.quality-dashboard {
  padding: 20px;

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;

    h2 {
      margin: 0;
      font-size: 20px;
      color: #303133;
    }

    .header-actions {
      display: flex;
      gap: 10px;
      align-items: center;
    }
  }

  .metrics-card {
    margin-bottom: 20px;

    .metric-item {
      display: flex;
      align-items: center;
      gap: 15px;
      padding: 10px;

      .metric-icon {
        width: 50px;
        height: 50px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        color: #fff;

        &.primary { background: linear-gradient(135deg, #409eff, #66b1ff); }
        &.warning { background: linear-gradient(135deg, #e6a23c, #f0c78a); }
        &.success { background: linear-gradient(135deg, #67c23a, #85ce61); }
        &.info { background: linear-gradient(135deg, #909399, #a6a9ad); }
        &.success2 { background: linear-gradient(135deg, #2f54eb, #597ef7); }
        &.danger { background: linear-gradient(135deg, #f56c6c, #f89898); }
      }

      .metric-info {
        .metric-value {
          font-size: 24px;
          font-weight: 600;
          color: #303133;
          line-height: 1.2;
        }

        .metric-label {
          font-size: 13px;
          color: #909399;
          margin-top: 4px;
        }
      }
    }
  }

  .charts-row {
    margin-bottom: 20px;
  }

  .chart-card {
    height: 350px;

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .chart-container {
      height: calc(100% - 40px);
    }
  }

  .table-card {
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  }

  .text-danger {
    color: #f56c6c;
  }

  .text-success {
    color: #67c23a;
    font-weight: 600;
  }

  .text-warning {
    color: #e6a23c;
    font-weight: 600;
  }

  .defect-list {
    .defect-item {
      margin-bottom: 10px;
      padding: 10px;
      background: #f5f7fa;
      border-radius: 4px;
    }
  }
}
</style>
