<template>
  <div class="page-container">
    <el-row :gutter="20" class="stat-row">
      <el-col :xs="12" :sm="6" v-for="card in statCards" :key="card.label">
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
            <el-radio-group v-model="trendDimension" size="small" @change="loadSalesTrend">
              <el-radio-button label="day">日</el-radio-button>
              <el-radio-button label="week">周</el-radio-button>
              <el-radio-button label="month">月</el-radio-button>
            </el-radio-group>
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

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :xs="24" :lg="12">
        <div class="card-box">
          <div class="card-header">
            <span class="card-title">热销商品TOP10</span>
          </div>
          <el-table :data="topProducts" stripe size="small">
            <el-table-column type="index" label="排名" width="60" />
            <el-table-column prop="productName" label="商品名称" />
            <el-table-column prop="soldCount" label="销量" width="100" sortable />
            <el-table-column prop="sellingPrice" label="价格" width="100">
              <template #default="{ row }">¥{{ row.sellingPrice }}</template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
      <el-col :xs="24" :lg="12">
        <div class="card-box">
          <div class="card-header">
            <span class="card-title">小区销售对比</span>
          </div>
          <div ref="communityChartRef" class="chart-container"></div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, onBeforeUnmount } from 'vue'
import * as echarts from 'echarts'
import { dashboardApi } from '@/api/community'

const trendChartRef = ref<HTMLElement>()
const categoryChartRef = ref<HTMLElement>()
const communityChartRef = ref<HTMLElement>()
let trendChart: echarts.ECharts
let categoryChart: echarts.ECharts
let communityChart: echarts.ECharts

const trendDimension = ref('day')
const topProducts = ref<any[]>([])
const statCards = ref([
  { label: '今日订单', value: 0, icon: 'ShoppingCart', bg: 'linear-gradient(135deg, #667eea, #764ba2)' },
  { label: '今日销售额', value: '¥0', icon: 'Money', bg: 'linear-gradient(135deg, #f093fb, #f5576c)' },
  { label: '商品总数', value: 0, icon: 'Goods', bg: 'linear-gradient(135deg, #4facfe, #00f2fe)' },
  { label: '注册用户', value: 0, icon: 'User', bg: 'linear-gradient(135deg, #43e97b, #38f9d7)' }
])

const loadOverview = async () => {
  try {
    const res: any = await dashboardApi.getOverview()
    statCards.value[0].value = res.data.todayOrders || 0
    statCards.value[1].value = '¥' + (res.data.todayRevenue || 0)
    statCards.value[2].value = res.data.totalProducts || 0
    statCards.value[3].value = res.data.totalUsers || 0
  } catch (e) {
    console.error(e)
  }
}

const loadSalesTrend = async () => {
  try {
    const res: any = await dashboardApi.getSalesTrend({ dimension: trendDimension.value })
    trendChart.setOption({
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: res.data.categories, axisLabel: { rotate: 30 } },
      yAxis: { type: 'value', name: '销售额(元)' },
      series: [{
        name: '销售额',
        type: 'line',
        smooth: true,
        data: res.data.values,
        areaStyle: { opacity: 0.3 },
        itemStyle: { color: '#409eff' }
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
    categoryChart.setOption({
      tooltip: { trigger: 'item' },
 legend: { bottom: 0, type: 'scroll' },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        data: res.data.categories.map((cat: any, i: number) => ({ name: '分类' + cat, value: res.data.counts[i] })),
        emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.5)' } }
      }]
    })
  } catch (e) {
    console.error(e)
  }
}

const loadTopProducts = async () => {
  try {
    const res: any = await dashboardApi.getTopProducts(10)
    topProducts.value = res.data.topProducts || []
  } catch (e) {
    console.error(e)
  }
}

const loadCommunityComparison = async () => {
  try {
    const res: any = await dashboardApi.getCommunityComparison()
    const communities = res.data.communities || []
    communityChart.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'category', data: communities.map((c: any) => c.communityName), axisLabel: { rotate: 45 } },
      yAxis: { type: 'value', name: '销售额(元)' },
      series: [{
        type: 'bar',
        data: communities.map((c: any) => c.sales),
        itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#83bff6' },
          { offset: 1, color: '#188df0' }
        ]) }
      }],
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true }
    })
  } catch (e) {
    console.error(e)
  }
}

const resizeCharts = () => {
  trendChart?.resize()
  categoryChart?.resize()
  communityChart?.resize()
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
  window.addEventListener('resize', resizeCharts)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCharts)
  trendChart?.dispose()
  categoryChart?.dispose()
  communityChart?.dispose()
})
</script>

<style scoped>
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
  margin-bottom: 0;
}
</style>
