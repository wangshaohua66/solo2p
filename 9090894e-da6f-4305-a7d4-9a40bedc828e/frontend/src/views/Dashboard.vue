<script setup lang="ts">
import { ref, computed } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import {
  LineChart,
  BarChart,
  PieChart
} from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent
} from 'echarts/components'
import VChart from 'vue-echarts'
import {
  DataAnalysis,
  Document,
  CircleCheck,
  Money,
  Warning,
  Download,
  Refresh
} from '@element-plus/icons-vue'

use([
  CanvasRenderer,
  LineChart,
  BarChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent
])

const dateRange = ref<[string, string] | null>(null)

const stats = computed(() => [
  {
    title: '申报总量',
    value: '1,286',
    unit: '票',
    trend: '+12.5%',
    trendUp: true,
    icon: Document,
    color: '#1e6fff'
  },
  {
    title: '通关通过率',
    value: '96.8',
    unit: '%',
    trend: '+1.2%',
    trendUp: true,
    icon: CircleCheck,
    color: '#52c41a'
  },
  {
    title: '退税金额',
    value: '2,856,420',
    unit: '元',
    trend: '+8.6%',
    trendUp: true,
    icon: Money,
    color: '#faad14'
  },
  {
    title: '异常案件',
    value: '23',
    unit: '件',
    trend: '-15.3%',
    trendUp: false,
    icon: Warning,
    color: '#ff4d4f'
  }
])

const trendOption = computed(() => ({
  title: {
    text: '申报量趋势（近30天）',
    left: 'left',
    textStyle: { fontSize: 14, fontWeight: 500 }
  },
  tooltip: { trigger: 'axis' },
  legend: { data: ['申报量', '通关量'], right: 0 },
  grid: { left: 50, right: 20, top: 50, bottom: 40 },
  xAxis: {
    type: 'category',
    data: Array.from({ length: 30 }, (_, i) => `${i + 1}日`)
  },
  yAxis: { type: 'value' },
  series: [
    {
      name: '申报量',
      type: 'line',
      smooth: true,
      data: [120, 132, 101, 134, 90, 230, 210, 182, 191, 234, 290, 330, 310, 123, 442, 321, 90, 149, 210, 122, 133, 334, 198, 123, 125, 220, 230, 210, 250, 290],
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(30,111,255,0.35)' },
            { offset: 1, color: 'rgba(30,111,255,0)' }
          ]
        }
      },
      itemStyle: { color: '#1e6fff' },
      lineStyle: { width: 2 }
    },
    {
      name: '通关量',
      type: 'line',
      smooth: true,
      data: [110, 128, 95, 128, 85, 220, 200, 175, 183, 225, 280, 318, 300, 118, 428, 310, 86, 142, 200, 117, 128, 320, 190, 118, 120, 212, 222, 203, 242, 280],
      itemStyle: { color: '#52c41a' },
      lineStyle: { width: 2 }
    }
  ]
}))

const categoryOption = computed(() => ({
  title: {
    text: '商品类目分布',
    left: 'center',
    textStyle: { fontSize: 14, fontWeight: 500 }
  },
  tooltip: { trigger: 'item', formatter: '{b}: {c} 票 ({d}%)' },
  legend: { bottom: 0, type: 'scroll' },
  series: [{
    type: 'pie',
    radius: ['40%', '65%'],
    center: ['50%', '45%'],
    avoidLabelOverlap: true,
    itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
    label: { show: false },
    data: [
      { value: 420, name: '电子产品' },
      { value: 310, name: '服装纺织' },
      { value: 198, name: '家居用品' },
      { value: 156, name: '玩具礼品' },
      { value: 132, name: '美妆个护' },
      { value: 70, name: '其他' }
    ]
  }]
}))

const countryOption = computed(() => ({
  title: {
    text: '目的国Top10',
    left: 'left',
    textStyle: { fontSize: 14, fontWeight: 500 }
  },
  tooltip: { trigger: 'axis' },
  grid: { left: 70, right: 20, top: 40, bottom: 20 },
  xAxis: { type: 'value' },
  yAxis: {
    type: 'category',
    data: ['日本', '澳大利亚', '加拿大', '俄罗斯', '法国', '意大利', '西班牙', '英国', '德国', '美国'].reverse()
  },
  series: [{
    type: 'bar',
    barWidth: 16,
    data: [85, 96, 110, 132, 148, 172, 198, 225, 290, 385].reverse(),
    itemStyle: {
      color: {
        type: 'linear',
        x: 0, y: 0, x2: 1, y2: 0,
        colorStops: [
          { offset: 0, color: '#1e6fff' },
          { offset: 1, color: '#4a8dff' }
        ]
      },
      borderRadius: [0, 4, 4, 0]
    }
  }]
}))

const platformOption = computed(() => ({
  title: {
    text: '平台销售占比',
    left: 'center',
    textStyle: { fontSize: 14, fontWeight: 500 }
  },
  tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
  legend: { orient: 'vertical', right: 10, top: 'center' },
  series: [{
    type: 'pie',
    radius: '60%',
    center: ['35%', '50%'],
    data: [
      { value: 4850000, name: '亚马逊' },
      { value: 2180000, name: '速卖通' },
      { value: 1560000, name: 'eBay' },
      { value: 980000, name: 'Wish' },
      { value: 650000, name: 'Shopee' },
      { value: 320000, name: '其他' }
    ],
    label: { formatter: '{b}\n{d}%' }
  }]
}))
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <div class="page-title">
          <el-icon style="margin-right: 8px"><DataAnalysis /></el-icon>
          企业数据看板
        </div>
        <div style="font-size: 13px; color: #909399; margin-top: 4px">
          数据更新时间：2024-06-22 14:30:00
        </div>
      </div>
      <div style="display: flex; gap: 10px; align-items: center">
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
        />
        <el-button :icon="Refresh">刷新</el-button>
        <el-button type="primary" :icon="Download">导出Excel</el-button>
      </div>
    </div>

    <el-row :gutter="16">
      <el-col :span="6" v-for="(s, idx) in stats" :key="idx">
        <div class="card stat-card">
          <div class="stat-header">
            <div class="stat-icon" :style="{ backgroundColor: s.color + '15', color: s.color }">
              <component :is="s.icon" />
            </div>
            <div
              class="stat-trend"
              :style="{ color: s.trendUp ? '#52c41a' : '#ff4d4f' }"
            >
              {{ s.trend }}
              <el-icon style="font-size: 12px">
                <component :is="s.trendUp ? 'CaretTop' : 'CaretBottom'" />
              </el-icon>
            </div>
          </div>
          <div class="stat-title">{{ s.title }}</div>
          <div class="stat-value">
            {{ s.value }}<span class="stat-unit">{{ s.unit }}</span>
          </div>
          <div class="stat-sub">较上月同期</div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :span="16">
        <div class="card" style="height: 360px">
          <v-chart class="chart" :option="trendOption" autoresize />
        </div>
      </el-col>
      <el-col :span="8">
        <div class="card" style="height: 360px">
          <v-chart class="chart" :option="categoryOption" autoresize />
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :span="12">
        <div class="card" style="height: 360px">
          <v-chart class="chart" :option="countryOption" autoresize />
        </div>
      </el-col>
      <el-col :span="12">
        <div class="card" style="height: 360px">
          <v-chart class="chart" :option="platformOption" autoresize />
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<style lang="scss" scoped>
.page-container {
  padding: 20px;
  height: 100%;
  overflow: auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;

  .page-title {
    font-size: $font-size-xl;
    font-weight: 600;
    display: flex;
    align-items: center;
  }
}

.stat-card {
  .stat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .stat-icon {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
  }

  .stat-trend {
    font-size: 13px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .stat-title {
    font-size: 13px;
    color: $text-secondary;
    margin-bottom: 6px;
  }

  .stat-value {
    font-size: 28px;
    font-weight: 700;
    color: $text-primary;
    line-height: 1.2;

    .stat-unit {
      font-size: 13px;
      font-weight: 400;
      color: $text-secondary;
      margin-left: 4px;
    }
  }

  .stat-sub {
    font-size: 12px;
    color: $text-secondary;
    margin-top: 4px;
  }
}

.chart {
  width: 100%;
  height: 100%;
}
</style>
