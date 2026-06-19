<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import * as ElIcons from '@element-plus/icons-vue'
import SectionPanel from '@/components/SectionPanel.vue'
import BaseChart from '@/components/BaseChart.vue'
import StatCard from '@/components/StatCard.vue'
import { dashboardApi, movieApi } from '@/api'
import type { DashboardMetrics, Cinema, Movie } from '@/types'

const loading = ref(true)
const metrics = ref<DashboardMetrics | null>(null)
const cinemas = ref<Cinema[]>([])
const movies = ref<Movie[]>([])
const dateRange = ref('week')
const dim = ref('movie')

onMounted(async () => {
  const [m, cs, mv] = await Promise.all([dashboardApi.getMetrics(), dashboardApi.getCinemas(), movieApi.getMovies()])
  metrics.value = m
  cinemas.value = cs
  movies.value = mv
  loading.value = false
})

const trendOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  legend: { data: ['票房', '人次'], textStyle: { color: '#a0a3b1' }, top: 0 },
  grid: { top: 40, right: 50, bottom: 30, left: 50 },
  xAxis: { type: 'category', data: metrics.value?.boxOfficeTrend.map((d) => d.date) || [], axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisLabel: { color: '#a0a3b1' } },
  yAxis: [
    { type: 'value', name: '票房', axisLabel: { color: '#a0a3b1', formatter: (v: number) => `${v / 10000}万` }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
    { type: 'value', name: '人次', axisLabel: { color: '#a0a3b1' }, splitLine: { show: false } }
  ],
  series: [
    { name: '票房', type: 'line', smooth: true, data: metrics.value?.boxOfficeTrend.map((d) => d.value) || [], lineStyle: { width: 3, color: '#E8B547' }, itemStyle: { color: '#F0C75E' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(232,181,71,0.3)' }, { offset: 1, color: 'rgba(232,181,71,0)' }] } } },
    { name: '人次', type: 'line', smooth: true, yAxisIndex: 1, data: metrics.value?.boxOfficeTrend.map((d) => Math.round(d.value / 45)) || [], lineStyle: { width: 2, color: '#C8364F' }, itemStyle: { color: '#e0445e' } }
  ]
}))

const movieRankOption = computed(() => {
  const sorted = [...movies.value].sort((a, b) => b.boxOffice - a.boxOffice).slice(0, 8)
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { top: 20, right: 30, bottom: 20, left: 10, containLabel: true },
    xAxis: { type: 'value', axisLabel: { color: '#a0a3b1', formatter: (v: number) => `${(v / 10000000).toFixed(1)}千万` }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
    yAxis: { type: 'category', data: sorted.map((m) => m.name).reverse(), axisLabel: { color: '#a0a3b1', fontSize: 11 }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } } },
    series: [{ type: 'bar', data: sorted.map((m) => m.boxOffice).reverse(), barWidth: 14, itemStyle: { borderRadius: [0, 6, 6, 0], color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#b8881f' }, { offset: 1, color: '#F0C75E' }] } } }]
  }
})

const radarOption = computed(() => ({
  tooltip: {},
  legend: { data: ['本周', '上周'], textStyle: { color: '#a0a3b1' }, bottom: 0 },
  radar: {
    indicator: [
      { name: '上座率', max: 100 },
      { name: '场均', max: 100 },
      { name: '客单价', max: 100 },
      { name: '卖品占比', max: 100 },
      { name: '会员复购', max: 100 },
      { name: '满意度', max: 100 }
    ],
    axisName: { color: '#a0a3b1' },
    splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
    splitArea: { areaStyle: { color: ['rgba(232,181,71,0.02)', 'rgba(232,181,71,0.05)'] } }
  },
  series: [{ type: 'radar', data: [{ value: [78, 65, 72, 45, 58, 88], name: '本周', areaStyle: { color: 'rgba(232,181,71,0.25)' }, lineStyle: { color: '#E8B547' } }, { value: [70, 60, 68, 40, 52, 82], name: '上周', areaStyle: { color: 'rgba(200,54,79,0.15)' }, lineStyle: { color: '#C8364F' } }] }]
}))

const heatData = Array.from({ length: 7 }, (_, i) =>
  Array.from({ length: 15 }, (_, j) => [j, i, Math.round(Math.random() * 100)])
)
const heatOption = {
  tooltip: { position: 'top' },
  grid: { top: 20, right: 20, bottom: 30, left: 50 },
  xAxis: { type: 'category', data: Array.from({ length: 15 }, (_, i) => `${i + 9}时`), axisLabel: { color: '#a0a3b1', fontSize: 10 }, splitArea: { show: false } },
  yAxis: { type: 'category', data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'], axisLabel: { color: '#a0a3b1' }, splitArea: { show: false } },
  visualMap: { min: 0, max: 100, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, textStyle: { color: '#a0a3b1' }, inRange: { color: ['#1a1a26', '#b8881f', '#F0C75E'] } },
  series: [{ type: 'heatmap', data: heatData, label: { show: false }, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(232,181,71,0.5)' } } }]
}

const rankList = computed(() => (metrics.value?.cinemaRank || []).slice(0, 8))
</script>

<template>
  <div class="analytics-page" v-loading="loading">
    <div class="filter-bar">
      <el-radio-group v-model="dateRange">
        <el-radio-button value="day">日报</el-radio-button>
        <el-radio-button value="week">周报</el-radio-button>
        <el-radio-button value="month">月报</el-radio-button>
      </el-radio-group>
      <el-radio-group v-model="dim">
        <el-radio-button value="movie">按影片</el-radio-button>
        <el-radio-button value="cinema">按影院</el-radio-button>
        <el-radio-button value="hour">按时段</el-radio-button>
      </el-radio-group>
      <div class="spacer" />
      <el-button :icon="(ElIcons as any).Download">导出报表</el-button>
      <el-button type="primary" :icon="(ElIcons as any).Document">生成周报</el-button>
    </div>

    <div class="stat-row">
      <StatCard label="周期总票房" :value="metrics?.todayBoxOffice || 0" prefix="¥" unit="元" icon="Money" :trend="12.4" accent="gold" />
      <StatCard label="周期总人次" :value="metrics?.todayAudience || 0" unit="人" icon="User" :trend="8.1" accent="info" />
      <StatCard label="场均产出" :value="metrics?.avgPerShow || 0" prefix="¥" unit="元" icon="Histogram" :trend="5.6" accent="success" />
      <StatCard label="平均上座率" :value="metrics?.occupancy || 0" unit="%" icon="DataAnalysis" :trend="3.2" accent="crimson" />
    </div>

    <div class="grid-2">
      <SectionPanel title="票房与人次趋势" subtitle="双轴对比 · 近7日">
        <BaseChart :option="trendOption" height="300px" />
      </SectionPanel>
      <SectionPanel title="运营能力雷达" subtitle="本周 vs 上周多维对比">
        <BaseChart :option="radarOption" height="300px" />
      </SectionPanel>
    </div>

    <div class="grid-2">
      <SectionPanel title="影片票房排行" subtitle="Top8 票房贡献">
        <BaseChart :option="movieRankOption" height="300px" />
      </SectionPanel>
      <SectionPanel title="影院业绩榜" subtitle="按票房排序">
        <ul class="rank-list">
          <li v-for="(r, i) in rankList" :key="i" class="rank-item">
            <span class="rank-no" :class="{ top: i < 3 }">{{ i + 1 }}</span>
            <span class="rank-name">{{ r.name }}</span>
            <div class="rank-bar"><i :style="{ width: `${(r.value / rankList[0].value) * 100}%` }" /></div>
            <span class="rank-value num">¥{{ (r.value / 10000).toFixed(1) }}万</span>
            <span class="rank-growth" :class="r.growth >= 0 ? 'up' : 'down'">
              <component :is="(ElIcons as any)[r.growth >= 0 ? 'CaretTop' : 'CaretBottom']" />{{ Math.abs(r.growth) }}%
            </span>
          </li>
        </ul>
      </SectionPanel>
    </div>

    <SectionPanel title="客流热力图" subtitle="各时段 × 星期 客流密度">
      <BaseChart :option="heatOption" height="320px" />
    </SectionPanel>
  </div>
</template>

<style scoped lang="scss">
.analytics-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  .spacer {
    flex: 1;
  }
}
.stat-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 18px;
}
.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}
.rank-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 300px;
  overflow-y: auto;
  @include scrollbar-dark;
}
.rank-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 4px;
  border-bottom: 1px solid var(--c-border);
  &:last-child {
    border-bottom: none;
  }
}
.rank-no {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--c-text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  font-family: var(--font-num);
  flex-shrink: 0;
  &.top {
    background: $grad-gold;
    color: #1a1305;
  }
}
.rank-name {
  width: 90px;
  font-size: 13px;
  color: var(--c-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rank-bar {
  flex: 1;
  height: 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  overflow: hidden;
  i {
    display: block;
    height: 100%;
    background: $grad-gold;
    border-radius: 4px;
  }
}
.rank-value {
  font-size: 13px;
  color: $gold;
  font-weight: 600;
  width: 70px;
  text-align: right;
}
.rank-growth {
  width: 50px;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  &.up {
    color: $success;
  }
  &.down {
    color: $crimson-bright;
  }
}
</style>
