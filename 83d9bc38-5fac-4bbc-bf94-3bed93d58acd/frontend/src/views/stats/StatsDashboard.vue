<template>
  <div class="p-4 md:p-6">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">统计分析</h1>
      <p class="text-gray-500 mt-1">多维度数据分析和可视化展示</p>
    </div>

    <el-card class="mb-6">
      <el-form :inline="true" :model="filters" class="flex flex-wrap gap-4">
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 280px"
            @change="handleDateChange"
          />
        </el-form-item>
        <el-form-item label="中心">
          <el-select
            v-model="filters.centerId"
            placeholder="全部中心"
            clearable
            style="width: 150px"
            @change="loadAllData"
          >
            <el-option
              v-for="center in centerList"
              :key="center.id"
              :label="center.name"
              :value="center.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="类别">
          <el-select
            v-model="filters.category"
            placeholder="全部类别"
            clearable
            style="width: 150px"
            @change="loadAllData"
          >
            <el-option
              v-for="cat in categoryList"
              :key="cat"
              :label="cat"
              :value="cat"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadAllData">
            <el-icon><Refresh /></el-icon>
            刷新数据
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
      <el-card v-for="stat in overviewStats" :key="stat.title" class="stat-card">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-gray-500 text-sm">{{ stat.title }}</p>
            <p class="text-2xl font-bold mt-2" :class="stat.color">
              {{ stat.value }}
            </p>
            <p class="text-xs text-gray-400 mt-1">{{ stat.subtitle }}</p>
          </div>
          <div
            class="w-12 h-12 rounded-full flex items-center justify-center"
            :class="stat.bgColor"
          >
            <el-icon :size="24" :class="stat.iconColor">
              <component :is="stat.icon" />
            </el-icon>
          </div>
        </div>
      </el-card>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-6">
      <el-card>
        <template #header>
          <div class="flex items-center justify-between">
            <span>利用率趋势</span>
            <el-radio-group v-model="trendView" size="small" @change="loadTrendData">
              <el-radio-button value="day">日</el-radio-button>
              <el-radio-button value="week">周</el-radio-button>
              <el-radio-button value="month">月</el-radio-button>
            </el-radio-group>
          </div>
        </template>
        <div ref="trendChartRef" class="chart-container" style="height: 350px"></div>
      </el-card>

      <el-card>
        <template #header>
          <span>峰谷分布（24小时）</span>
        </template>
        <div ref="peakValleyChartRef" class="chart-container" style="height: 350px"></div>
      </el-card>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-6">
      <el-card>
        <template #header>
          <span>设备类别分布</span>
        </template>
        <div ref="categoryChartRef" class="chart-container" style="height: 350px"></div>
      </el-card>

      <el-card>
        <template #header>
          <span>设备利用率排名</span>
        </template>
        <div ref="rankingChartRef" class="chart-container" style="height: 350px"></div>
      </el-card>
    </div>

    <el-card>
      <template #header>
        <span>各中心统计</span>
      </template>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <el-card
          v-for="center in centerStats"
          :key="center.centerId"
          class="center-card cursor-pointer hover:shadow-md transition-shadow"
          @click="drillDownByCenter(center.centerId)"
        >
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <el-icon :size="20" class="text-blue-600"><Building /></el-icon>
            </div>
            <div>
              <h3 class="font-semibold text-gray-900">{{ center.centerName }}</h3>
              <p class="text-sm text-gray-500">{{ center.equipmentCount }} 台设备</p>
            </div>
          </div>
          <el-divider class="my-3" />
          <div class="space-y-3">
            <div class="flex justify-between items-center">
              <span class="text-gray-600 text-sm">使用时长</span>
              <span class="font-semibold">{{ center.bookedHours.toFixed(1) }} 小时</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-gray-600 text-sm">利用率</span>
              <span class="font-semibold" :class="getUtilizationColor(center.utilizationRate)">
                {{ center.utilizationRate.toFixed(1) }}%
              </span>
            </div>
            <el-progress
              :percentage="center.utilizationRate"
              :stroke-width="8"
              :color="getUtilizationProgressColor(center.utilizationRate)"
            />
          </div>
        </el-card>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import { Refresh, DataAnalysis, Monitor, Clock, TrendingUp, Building } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { stats as statsApi, equipment as equipmentApi } from '@/api'
import type { CenterStats, Equipment, DashboardStats } from '@/types'

const loading = ref(false)
const dateRange = ref<string[]>([])
const trendView = ref<'day' | 'week' | 'month'>('day')
const centerList = ref<Array<{ id: number; name: string }>>([])
const categoryList = ref<string[]>([])
const centerStats = ref<CenterStats[]>([])
const dashboardStats = ref<DashboardStats | null>(null)

const filters = ref({
  startDate: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
  endDate: dayjs().format('YYYY-MM-DD'),
  centerId: undefined as number | undefined,
  category: undefined as string | undefined
})

const overviewStats = computed(() => {
  return [
    {
      title: '设备总数',
      value: dashboardStats.value?.totalEquipment || 0,
      subtitle: '台设备',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      iconColor: 'text-blue-600',
      icon: Monitor
    },
    {
      title: '今日预约',
      value: dashboardStats.value?.todayBookings || 0,
      subtitle: '次预约',
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      iconColor: 'text-green-600',
      icon: DataAnalysis
    },
    {
      title: '本月利用率',
      value: `${(dashboardStats.value?.monthlyUtilization || 0).toFixed(1)}%`,
      subtitle: '平均利用率',
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      iconColor: 'text-orange-600',
      icon: TrendingUp
    },
    {
      title: '待处理',
      value: dashboardStats.value?.pendingCount || 0,
      subtitle: '条记录',
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      iconColor: 'text-red-600',
      icon: Clock
    }
  ]
})

const trendChartRef = ref<HTMLElement>()
const peakValleyChartRef = ref<HTMLElement>()
const categoryChartRef = ref<HTMLElement>()
const rankingChartRef = ref<HTMLElement>()

let trendChart: echarts.ECharts | null = null
let peakValleyChart: echarts.ECharts | null = null
let categoryChart: echarts.ECharts | null = null
let rankingChart: echarts.ECharts | null = null

const getUtilizationColor = (rate: number) => {
  if (rate >= 80) return 'text-green-600'
  if (rate >= 50) return 'text-orange-600'
  return 'text-red-600'
}

const getUtilizationProgressColor = (rate: number) => {
  if (rate >= 80) return '#67c23a'
  if (rate >= 50) return '#e6a23c'
  return '#f56c6c'
}

const initCharts = async () => {
  await nextTick()
  
  if (trendChartRef.value) {
    trendChart = echarts.init(trendChartRef.value)
    window.addEventListener('resize', () => trendChart?.resize())
  }
  
  if (peakValleyChartRef.value) {
    peakValleyChart = echarts.init(peakValleyChartRef.value)
    window.addEventListener('resize', () => peakValleyChart?.resize())
  }
  
  if (categoryChartRef.value) {
    categoryChart = echarts.init(categoryChartRef.value)
    window.addEventListener('resize', () => categoryChart?.resize())
  }
  
  if (rankingChartRef.value) {
    rankingChart = echarts.init(rankingChartRef.value)
    window.addEventListener('resize', () => rankingChart?.resize())
  }
}

const loadTrendData = async () => {
  if (!trendChart) return
  
  const days = trendView.value === 'day' ? 7 : trendView.value === 'week' ? 30 : 90
  
  try {
    const data = await statsApi.getTrend({ days })
    
    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          let result = `${params[0].axisValue}<br/>`
          params.forEach((item: any) => {
            result += `${item.marker} ${item.seriesName}: ${item.value}${item.seriesName.includes('率') ? '%' : ' 小时'}<br/>`
          })
          return result
        }
      },
      legend: {
        data: ['利用率', '使用时长'],
        bottom: 0
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: data.xAxis
      },
      yAxis: [
        {
          type: 'value',
          name: '利用率(%)',
          position: 'left',
          axisLabel: {
            formatter: '{value}%'
          }
        },
        {
          type: 'value',
          name: '时长(小时)',
          position: 'right',
          axisLabel: {
            formatter: '{value}h'
          }
        }
      ],
      series: data.series.map((s: any) => ({
        ...s,
        smooth: true,
        areaStyle: s.name.includes('率') ? {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(64, 158, 255, 0.3)' },
            { offset: 1, color: 'rgba(64, 158, 255, 0.05)' }
          ])
        } : undefined
      }))
    }
    
    trendChart.setOption(option)
  } catch (error) {
    console.error('Failed to load trend data:', error)
  }
}

const loadPeakValleyData = async () => {
  if (!peakValleyChart) return
  
  try {
    const data = await statsApi.getPeakValley({
      startDate: filters.value.startDate,
      endDate: filters.value.endDate
    })
    
    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        formatter: (params: any) => {
          return `${params[0].axisValue}:00 - ${params[0].axisValue + 1}:00<br/>
                  ${params[0].marker} 预约次数: ${params[0].value}`
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: data.xAxis.map((h: number) => `${h}:00`),
        axisLabel: {
          interval: 2
        }
      },
      yAxis: {
        type: 'value',
        name: '预约次数'
      },
      series: [{
        ...data.series[0],
        type: 'bar',
        itemStyle: {
          color: (params: any) => {
            const value = params.value
            if (value >= 20) return '#f56c6c'
            if (value >= 10) return '#e6a23c'
            return '#67c23a'
          },
          borderRadius: [4, 4, 0, 0]
        }
      }]
    }
    
    peakValleyChart.setOption(option)
  } catch (error) {
    console.error('Failed to load peak valley data:', error)
  }
}

const loadCategoryData = async () => {
  if (!categoryChart) return
  
  try {
    const data = await statsApi.getUtilization({
      dimension: 'category',
      startDate: filters.value.startDate,
      endDate: filters.value.endDate,
      centerId: filters.value.centerId?.toString()
    })
    
    const pieData = data.series.map((s: any) => ({
      name: s.name,
      value: s.data.reduce((a: number, b: number) => a + b, 0)
    }))
    
    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        left: 'left',
        top: 'center'
      },
      series: [{
        name: '设备类别',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['60%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 20,
            fontWeight: 'bold',
            formatter: '{b}\n{d}%'
          }
        },
        labelLine: {
          show: false
        },
        data: pieData
      }]
    }
    
    categoryChart.setOption(option)
    
    categoryChart.on('click', (params: any) => {
      filters.value.category = params.name
      loadAllData()
    })
  } catch (error) {
    console.error('Failed to load category data:', error)
  }
}

const loadRankingData = async () => {
  if (!rankingChart) return
  
  try {
    const data = await statsApi.getRanking({
      limit: 10,
      startDate: filters.value.startDate,
      endDate: filters.value.endDate
    })
    
    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        formatter: (params: any) => {
          return `${params[0].axisValue}<br/>
                  ${params[0].marker} 利用率: ${params[0].value}%<br/>
                  ${params[1].marker} 使用时长: ${params[1].value} 小时`
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'value',
        axisLabel: {
          formatter: '{value}%'
        }
      },
      yAxis: {
        type: 'category',
        data: data.xAxis,
        inverse: true
      },
      series: [
        {
          name: '利用率',
          type: 'bar',
          data: data.series[0]?.data || [],
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: '#67c23a' },
              { offset: 1, color: '#409eff' }
            ]),
            borderRadius: [0, 4, 4, 0]
          },
          label: {
            show: true,
            position: 'right',
            formatter: '{c}%'
          }
        },
        {
          name: '使用时长',
          type: 'bar',
          data: data.series[1]?.data || [],
          itemStyle: {
            color: '#e6a23c',
            borderRadius: [0, 4, 4, 0]
          }
        }
      ]
    }
    
    rankingChart.setOption(option)
  } catch (error) {
    console.error('Failed to load ranking data:', error)
  }
}

const loadCenterStats = async () => {
  try {
    const data = await statsApi.getCenterStats({
      startDate: filters.value.startDate,
      endDate: filters.value.endDate
    })
    
    centerStats.value = data.xAxis.map((name: string, index: number) => ({
      centerId: index + 1,
      centerName: name,
      equipmentCount: data.series[0]?.data[index] || 0,
      bookedHours: data.series[1]?.data[index] || 0,
      utilizationRate: data.series[2]?.data[index] || 0
    })).sort((a: CenterStats, b: CenterStats) => b.utilizationRate - a.utilizationRate)
  } catch (error) {
    console.error('Failed to load center stats:', error)
  }
}

const loadDashboardStats = async () => {
  try {
    dashboardStats.value = await statsApi.getDashboard()
  } catch (error) {
    console.error('Failed to load dashboard stats:', error)
  }
}

const loadFilters = async () => {
  try {
    const eqResponse = await equipmentApi.getList({ pageSize: 100 })
    const equipmentList = eqResponse.items
    
    const centerMap = new Map<number, string>()
    const categorySet = new Set<string>()
    
    equipmentList.forEach((eq: Equipment) => {
      if (eq.centerId && eq.centerName) {
        centerMap.set(eq.centerId, eq.centerName)
      }
      if (eq.category) {
        categorySet.add(eq.category)
      }
    })
    
    centerList.value = Array.from(centerMap.entries()).map(([id, name]) => ({ id, name }))
    categoryList.value = Array.from(categorySet)
  } catch (error) {
    console.error('Failed to load filters:', error)
  }
}

const handleDateChange = (val: string[]) => {
  if (val && val.length === 2) {
    filters.value.startDate = val[0]
    filters.value.endDate = val[1]
  }
  loadAllData()
}

const drillDownByCenter = (centerId: number) => {
  filters.value.centerId = centerId
  loadAllData()
}

const loadAllData = async () => {
  loading.value = true
  try {
    await Promise.all([
      loadDashboardStats(),
      loadTrendData(),
      loadPeakValleyData(),
      loadCategoryData(),
      loadRankingData(),
      loadCenterStats()
    ])
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  dateRange.value = [filters.value.startDate, filters.value.endDate]
  await initCharts()
  await loadFilters()
  await loadAllData()
})

onUnmounted(() => {
  trendChart?.dispose()
  peakValleyChart?.dispose()
  categoryChart?.dispose()
  rankingChart?.dispose()
  window.removeEventListener('resize', () => trendChart?.resize())
  window.removeEventListener('resize', () => peakValleyChart?.resize())
  window.removeEventListener('resize', () => categoryChart?.resize())
  window.removeEventListener('resize', () => rankingChart?.resize())
})
</script>

<style scoped>
.stat-card {
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.center-card {
  border: 1px solid #e4e7ed;
}

.center-card:hover {
  border-color: #409eff;
}

.chart-container {
  width: 100%;
  min-height: 300px;
}
</style>
