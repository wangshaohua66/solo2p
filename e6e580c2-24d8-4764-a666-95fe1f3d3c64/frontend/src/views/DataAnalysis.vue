<template>
  <div class="page-container">
    <div class="card-box analysis-toolbar">
      <div class="toolbar-left">
        <span class="toolbar-label">时间范围：</span>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          :clearable="false"
          @change="loadSalesTrend"
        />
        <el-divider direction="vertical" />
        <span class="toolbar-label">统计维度：</span>
        <el-radio-group v-model="dimension" size="default" @change="loadSalesTrend">
          <el-radio-button label="day">日</el-radio-button>
          <el-radio-button label="week">周</el-radio-button>
          <el-radio-button label="month">月</el-radio-button>
          <el-radio-button label="year">年</el-radio-button>
        </el-radio-group>
      </div>
      <div class="toolbar-right">
        <el-button type="success" :icon="Download" @click="handleExport('excel')">导出Excel</el-button>
        <el-button type="danger" :icon="Printer" @click="handleExport('pdf')">导出PDF</el-button>
      </div>
    </div>

    <el-row :gutter="20" class="stat-row">
      <el-col :xs="12" :sm="6" v-for="card in deliveryStats" :key="card.label">
        <div class="stat-card" :style="{ background: card.bg }">
          <div>
            <div class="stat-value">{{ card.value }}</div>
            <div class="stat-label">{{ card.label }}</div>
          </div>
          <el-icon class="stat-icon">
            <component :is="card.icon" />
          </el-icon>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :xs="24" :lg="16">
        <div class="card-box">
          <div class="card-header">
            <span class="card-title">销售趋势</span>
            <el-tag size="small" type="info">维度：{{ dimensionText }}</el-tag>
          </div>
          <div ref="trendChartRef" class="chart-container"></div>
        </div>
      </el-col>
      <el-col :xs="24" :lg="8">
        <div class="card-box">
          <div class="card-header">
            <span class="card-title">商品分类分布</span>
          </div>
          <div ref="categoryChartRef" class="chart-container"></div>
        </div>
      </el-col>
    </el-row>

    <div class="card-box" style="margin-top: 20px;">
      <div class="card-header">
        <span class="card-title">商品销量排行 TOP50</span>
        <el-radio-group v-model="topViewMode" size="small" @change="handleTopViewChange">
          <el-radio-button label="table">表格视图</el-radio-button>
          <el-radio-button label="chart">柱状图视图</el-radio-button>
        </el-radio-group>
      </div>
      <div v-show="topViewMode === 'table'">
        <el-table :data="topProducts" stripe size="small" max-height="480">
          <el-table-column type="index" label="排名" width="70" fixed />
          <el-table-column prop="productName" label="商品名称" min-width="180" show-overflow-tooltip />
          <el-table-column prop="soldCount" label="销量" width="110" sortable />
          <el-table-column prop="totalStock" label="总库存" width="100" sortable />
          <el-table-column prop="sellingPrice" label="销售单价" width="110" sortable>
            <template #default="{ row }">¥{{ row.sellingPrice }}</template>
          </el-table-column>
          <el-table-column label="销量占比" min-width="180">
            <template #default="{ row }">
              <el-progress
                :percentage="soldPercent(row)"
                :stroke-width="14"
                :color="barColor(row.soldCount)"
              />
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div v-show="topViewMode === 'chart'">
        <div ref="topBarChartRef" class="chart-container" style="height: 480px;"></div>
      </div>
    </div>

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :xs="24" :lg="12">
        <div class="card-box">
          <div class="card-header">
            <span class="card-title">小区销售对比</span>
            <el-radio-group v-model="communitySort" size="small" @change="renderCommunityChart">
              <el-radio-button label="sales">按销售额排序</el-radio-button>
              <el-radio-button label="residentCount">按居民数排序</el-radio-button>
            </el-radio-group>
          </div>
          <div ref="communityChartRef" class="chart-container"></div>
        </div>
      </el-col>
      <el-col :xs="24" :lg="12">
        <div class="card-box">
          <div class="card-header">
            <span class="card-title">库存周转率预警</span>
            <el-tag size="small" type="danger">剩余库存 &lt; 20%</el-tag>
          </div>
          <el-table :data="inventoryWarnings" stripe size="small" max-height="400">
            <el-table-column type="index" label="序号" width="55" />
            <el-table-column prop="productName" label="商品名称" min-width="140" show-overflow-tooltip />
            <el-table-column prop="totalStock" label="总库存" width="80" sortable />
            <el-table-column prop="soldCount" label="已售" width="80" sortable />
            <el-table-column prop="remaining" label="剩余" width="80" sortable />
            <el-table-column label="剩余比例" width="120">
              <template #default="{ row }">
                <el-progress
                  :percentage="remainingPercent(row)"
                  :stroke-width="12"
                  :color="remainingColor(row)"
                />
              </template>
            </el-table-column>
            <el-table-column label="紧急程度" width="90" fixed="right">
              <template #default="{ row }">
                <el-tag :type="urgencyType(row)" :effect="urgencyEffect(row)" size="small">
                  {{ urgencyText(row) }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { Download, Printer } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import { dashboardApi } from '@/api/community'

const trendChartRef = ref<HTMLElement>()
const categoryChartRef = ref<HTMLElement>()
const communityChartRef = ref<HTMLElement>()
const topBarChartRef = ref<HTMLElement>()

let trendChart: echarts.ECharts
let categoryChart: echarts.ECharts
let communityChart: echarts.ECharts
let topBarChart: echarts.ECharts | null = null

const dateRange = ref<[string, string] | null>(null)
const dimension = ref('day')
const topViewMode = ref<'table' | 'chart'>('table')
const communitySort = ref<'sales' | 'residentCount'>('sales')

const topProducts = ref<any[]>([])
const inventoryWarnings = ref<any[]>([])
const communities = ref<any[]>([])

const deliveryStats = ref([
  { label: '配送准时率', value: '0%', icon: 'Timer', bg: 'linear-gradient(135deg, #667eea, #764ba2)' },
  { label: '投诉率', value: '0%', icon: 'Warning', bg: 'linear-gradient(135deg, #f093fb, #f5576c)' },
  { label: '平均配送时长', value: '0min', icon: 'Van', bg: 'linear-gradient(135deg, #4facfe, #00f2fe)' },
  { label: '配送完成率', value: '0%', icon: 'CircleCheck', bg: 'linear-gradient(135deg, #43e97b, #38f9d7)' }
])

const dimensionText = computed(() => {
  const map: Record<string, string> = { day: '按日', week: '按周', month: '按月', year: '按年' }
  return map[dimension.value] || '按日'
})

const loadOverview = async () => {
  try {
    const res: any = await dashboardApi.getOverview()
    const d = res.data || {}
    deliveryStats.value[0].value = (Number(d.onTimeRate ?? 0)).toFixed(1) + '%'
    deliveryStats.value[1].value = (Number(d.complaintRate ?? 0)).toFixed(2) + '%'
    deliveryStats.value[2].value = (Number(d.avgDeliveryTime ?? 0)).toFixed(0) + 'min'
    deliveryStats.value[3].value = (Number(d.deliveryCompletionRate ?? 0)).toFixed(1) + '%'
  } catch (e) {
    console.error(e)
  }
}

const loadSalesTrend = async () => {
  try {
    const params: any = { dimension: dimension.value }
    if (dateRange.value && dateRange.value.length === 2) {
      params.startDate = dateRange.value[0]
      params.endDate = dateRange.value[1]
    }
    const res: any = await dashboardApi.getSalesTrend(params)
    trendChart.setOption({
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: res.data.categories || [], axisLabel: { rotate: 30 }, boundaryGap: false },
      yAxis: { type: 'value', name: '销售额(元)' },
      series: [{
        name: '销售额',
        type: 'line',
        smooth: true,
        data: res.data.values || [],
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(64,158,255,0.5)' },
            { offset: 1, color: 'rgba(64,158,255,0.02)' }
          ])
        },
        itemStyle: { color: '#409eff' },
        lineStyle: { width: 3 }
      }],
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true }
    })
  } catch (e) {
    console.error(e)
  }
}

const loadCategoryDistribution = async () => {
  try {
    const res: any = await dashboardApi.getCategoryDistribution()
    const categories = res.data.categories || []
    const counts = res.data.counts || []
    categoryChart.setOption({
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: 0, type: 'scroll' },
      series: [{
        name: '分类占比',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        data: categories.map((cat: any, i: number) => ({ name: String(cat), value: counts[i] })),
        label: { show: true, formatter: '{b}\n{d}%' },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.5)' },
          label: { show: true, fontSize: 14, fontWeight: 'bold' }
        }
      }]
    })
  } catch (e) {
    console.error(e)
  }
}

const loadTopProducts = async () => {
  try {
    const res: any = await dashboardApi.getTopProducts(50)
    topProducts.value = res.data.topProducts || []
    if (topViewMode.value === 'chart') {
      await nextTick()
      renderTopBarChart()
    }
  } catch (e) {
    console.error(e)
  }
}

const soldPercent = (row: any) => {
  const max = topProducts.value.reduce((m: number, r: any) => Math.max(m, r.soldCount || 0), 1)
  return row.soldCount ? Math.round((row.soldCount / max) * 100) : 0
}

const barColor = (sold: number) => {
  const max = topProducts.value.reduce((m: number, r: any) => Math.max(m, r.soldCount || 0), 1)
  const p = sold / max
  if (p > 0.7) return '#f56c6c'
  if (p > 0.4) return '#e6a23c'
  return '#67c23a'
}

const renderTopBarChart = () => {
  if (!topBarChartRef.value) return
  if (!topBarChart) {
    topBarChart = echarts.init(topBarChartRef.value)
  }
  const list = topProducts.value
  topBarChart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '6%', bottom: '3%', containLabel: true },
    xAxis: { type: 'value', name: '销量' },
    yAxis: {
      type: 'category',
      inverse: true,
      data: list.map((p: any) => p.productName),
      axisLabel: { width: 120, overflow: 'truncate' }
    },
    dataZoom: [{ type: 'slider', yAxisIndex: 0, start: 0, end: 30, width: 12 }],
    series: [{
      name: '销量',
      type: 'bar',
      data: list.map((p: any) => p.soldCount),
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: '#83bff6' },
          { offset: 1, color: '#188df0' }
        ]),
        borderRadius: [0, 4, 4, 0]
      },
      label: { show: true, position: 'right' }
    }]
  })
}

const handleTopViewChange = async () => {
  if (topViewMode.value === 'chart') {
    await nextTick()
    renderTopBarChart()
    topBarChart?.resize()
  }
}

const loadCommunityComparison = async () => {
  try {
    const res: any = await dashboardApi.getCommunityComparison()
    communities.value = res.data.communities || []
    renderCommunityChart()
  } catch (e) {
    console.error(e)
  }
}

const renderCommunityChart = () => {
  if (!communityChart) return
  const list = [...communities.value].sort((a, b) => {
    return communitySort.value === 'sales'
      ? (b.sales || 0) - (a.sales || 0)
      : (b.residentCount || 0) - (a.residentCount || 0)
  })
  const values = communitySort.value === 'sales'
    ? list.map((c: any) => c.sales)
    : list.map((c: any) => c.residentCount)
  const name = communitySort.value === 'sales' ? '销售额(元)' : '居民数(人)'
  communityChart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'category', data: list.map((c: any) => c.communityName), axisLabel: { rotate: 35 } },
    yAxis: { type: 'value', name },
    series: [{
      name,
      type: 'bar',
      data: values,
      barMaxWidth: 36,
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#83bff6' },
          { offset: 1, color: '#188df0' }
        ]),
        borderRadius: [4, 4, 0, 0]
      }
    }],
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true }
  })
}

const loadInventoryWarning = async () => {
  try {
    const res: any = await dashboardApi.getInventoryWarning()
    inventoryWarnings.value = res.data.warnings || []
  } catch (e) {
    console.error(e)
  }
}

const remainingPercent = (row: any) => {
  if (!row.totalStock) return 0
  return Math.round((row.remaining / row.totalStock) * 100)
}

const remainingColor = (row: any) => {
  const p = remainingPercent(row)
  if (p <= 5) return '#f56c6c'
  if (p <= 10) return '#ff9800'
  return '#e6a23c'
}

const urgencyType = (row: any) => {
  const p = remainingPercent(row)
  if (p <= 10) return 'danger'
  return 'warning'
}

const urgencyEffect = (row: any) => {
  return remainingPercent(row) <= 5 ? 'dark' : 'light'
}

const urgencyText = (row: any) => {
  const p = remainingPercent(row)
  if (p <= 5) return '紧急'
  if (p <= 10) return '严重'
  return '警告'
}

const handleExport = (type: 'excel' | 'pdf') => {
  if (type === 'excel') {
    ElMessage.success('正在导出 Excel 报表，请稍候...')
  } else {
    ElMessage.success('正在生成 PDF 报表，请稍候...')
  }
}

const resizeCharts = () => {
  trendChart?.resize()
  categoryChart?.resize()
  communityChart?.resize()
  topBarChart?.resize()
}

onMounted(async () => {
  await nextTick()
  trendChart = echarts.init(trendChartRef.value!)
  categoryChart = echarts.init(categoryChartRef.value!)
  communityChart = echarts.init(communityChartRef.value!)
  loadOverview()
  loadSalesTrend()
  loadCategoryDistribution()
  loadTopProducts()
  loadCommunityComparison()
  loadInventoryWarning()
  window.addEventListener('resize', resizeCharts)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCharts)
  trendChart?.dispose()
  categoryChart?.dispose()
  communityChart?.dispose()
  topBarChart?.dispose()
})
</script>

<style scoped>
.analysis-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.toolbar-right {
  display: flex;
  gap: 8px;
}

.toolbar-label {
  font-size: 14px;
  color: var(--text-regular);
  white-space: nowrap;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.stat-row {
  margin-top: 20px;
}

@media (max-width: 768px) {
  .analysis-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .toolbar-left,
  .toolbar-right {
    justify-content: flex-start;
  }
}
</style>
