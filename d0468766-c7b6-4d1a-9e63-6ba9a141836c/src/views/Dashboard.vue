<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import * as ElIcons from '@element-plus/icons-vue'
import StatCard from '@/components/StatCard.vue'
import SectionPanel from '@/components/SectionPanel.vue'
import BaseChart from '@/components/BaseChart.vue'
import { dashboardApi } from '@/api'
import type { DashboardMetrics, AlertItem } from '@/types'

const loading = ref(true)
const metrics = ref<DashboardMetrics | null>(null)
const alerts = ref<AlertItem[]>([])

onMounted(async () => {
  const [m, a] = await Promise.all([dashboardApi.getMetrics(), dashboardApi.getAlerts()])
  metrics.value = m
  alerts.value = a
  loading.value = false
})

const trendOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { top: 30, right: 24, bottom: 30, left: 50 },
  xAxis: {
    type: 'category',
    data: metrics.value?.boxOfficeTrend.map((d) => d.date) || [],
    axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
    axisLabel: { color: '#a0a3b1' }
  },
  yAxis: {
    type: 'value',
    axisLabel: { color: '#a0a3b1', formatter: (v: number) => `${v / 10000}万` },
    splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
  },
  series: [
    {
      type: 'line',
      smooth: true,
      data: metrics.value?.boxOfficeTrend.map((d) => d.value) || [],
      symbolSize: 8,
      lineStyle: { width: 3, color: '#E8B547' },
      itemStyle: { color: '#F0C75E', borderColor: '#E8B547', borderWidth: 2 },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(232,181,71,0.35)' },
            { offset: 1, color: 'rgba(232,181,71,0)' }
          ]
        }
      }
    }
  ]
}))

const shareOption = computed(() => ({
  tooltip: { trigger: 'item' },
  legend: { bottom: 0, textStyle: { color: '#a0a3b1', fontSize: 11 } },
  series: [
    {
      type: 'pie',
      radius: ['52%', '76%'],
      center: ['50%', '44%'],
      avoidLabelOverlap: true,
      itemStyle: { borderColor: '#16161f', borderWidth: 2 },
      label: { show: false },
      emphasis: { label: { show: true, color: '#F0C75E', fontWeight: 600 } },
      data: metrics.value?.movieShare.map((d) => ({ name: d.name, value: d.value })) || []
    }
  ]
}))

const rankOption = computed(() => ({
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  grid: { top: 20, right: 30, bottom: 20, left: 10, containLabel: true },
  xAxis: { type: 'value', axisLabel: { color: '#a0a3b1', formatter: (v: number) => `${v / 10000}万` }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
  yAxis: {
    type: 'category',
    data: (metrics.value?.cinemaRank || []).slice().reverse().map((d) => d.name),
    axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
    axisLabel: { color: '#a0a3b1', fontSize: 11 }
  },
  series: [
    {
      type: 'bar',
      data: (metrics.value?.cinemaRank || []).slice().reverse().map((d) => d.value),
      barWidth: 12,
      itemStyle: {
        borderRadius: [0, 6, 6, 0],
        color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#b8881f' }, { offset: 1, color: '#F0C75E' }] }
      }
    }
  ]
}))

const hourOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { top: 30, right: 20, bottom: 30, left: 45 },
  xAxis: { type: 'category', data: metrics.value?.hourFlow.map((d) => d.hour) || [], axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisLabel: { color: '#a0a3b1' } },
  yAxis: { type: 'value', axisLabel: { color: '#a0a3b1' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
  series: [
    {
      type: 'bar',
      data: metrics.value?.hourFlow.map((d) => d.value) || [],
      barWidth: 22,
      itemStyle: { borderRadius: [6, 6, 0, 0], color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#F0C75E' }, { offset: 1, color: 'rgba(200,54,79,0.7)' }] } }
    }
  ]
}))

const alertMeta: Record<string, { icon: string; color: string }> = {
  dcp: { icon: 'Box', color: '#C8364F' },
  concession: { icon: 'Goods', color: '#FBBF24' },
  schedule: { icon: 'Calendar', color: '#60A5FA' },
  device: { icon: 'WarnTriangleFilled', color: '#EF4444' }
}
const levelTag: Record<string, string> = { danger: 'danger', warning: 'warning', info: 'info' }
</script>

<template>
  <div class="dashboard">
    <div class="hero-strip">
      <div class="hero-text">
        <p class="hero-date">2026年6月19日 · 周五 · 端午档期</p>
        <h1 class="display">院线运营驾驶舱</h1>
        <p class="hero-sub">15家影院 · 120块银幕 · 实时数据聚合</p>
      </div>
      <div class="hero-beam" aria-hidden="true" />
    </div>

    <el-skeleton :loading="loading" animated :rows="6">
      <template #default>
        <div class="stat-row">
          <StatCard label="今日票房" :value="metrics!.todayBoxOffice" prefix="¥" unit="元" icon="Money" :trend="12.4" accent="gold" />
          <StatCard label="今日人次" :value="metrics!.todayAudience" unit="人" icon="User" :trend="8.1" accent="info" />
          <StatCard label="场均产出" :value="metrics!.avgPerShow" prefix="¥" unit="元" icon="Histogram" :trend="-2.3" accent="crimson" />
          <StatCard label="上座率" :value="metrics!.occupancy" unit="%" icon="DataAnalysis" :trend="5.6" accent="success" />
        </div>

        <div class="grid-2">
          <SectionPanel title="近7日票房趋势" subtitle="全院线票房汇总（元）">
            <BaseChart :option="trendOption" height="300px" />
          </SectionPanel>
          <SectionPanel title="影片票房占比" subtitle="今日在映影片结构">
            <BaseChart :option="shareOption" height="300px" />
          </SectionPanel>
        </div>

        <div class="grid-3">
          <SectionPanel title="影院票房排行" subtitle="今日各影院票房Top8">
            <BaseChart :option="rankOption" height="340px" />
          </SectionPanel>
          <SectionPanel title="时段客流分布" subtitle="今日各时段到场人次">
            <BaseChart :option="hourOption" height="340px" />
          </SectionPanel>
          <SectionPanel title="待办预警" subtitle="实时运营风险提醒">
            <ul class="alert-list">
              <li v-for="a in alerts" :key="a.id" class="alert-item" :class="a.level">
                <div class="alert-icon" :style="{ color: alertMeta[a.type].color }">
                  <component :is="(ElIcons as any)[alertMeta[a.type].icon]" />
                </div>
                <div class="alert-body">
                  <div class="alert-title">
                    {{ a.title }}
                    <el-tag size="small" :type="levelTag[a.level]" effect="dark" round>{{ a.level === 'danger' ? '紧急' : a.level === 'warning' ? '预警' : '提醒' }}</el-tag>
                  </div>
                  <p class="alert-desc">{{ a.desc }}</p>
                  <span class="alert-time">{{ a.time }}</span>
                </div>
              </li>
            </ul>
          </SectionPanel>
        </div>
      </template>
    </el-skeleton>
  </div>
</template>

<style scoped lang="scss">
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.hero-strip {
  position: relative;
  overflow: hidden;
  border-radius: $radius-lg;
  border: 1px solid $gold-line;
  background: linear-gradient(120deg, #1a1a26 0%, #12121c 60%, rgba(200, 54, 79, 0.12) 100%);
  padding: 26px 32px;
  @include film-grain;
}
.hero-text {
  position: relative;
  z-index: 1;
  .hero-date {
    font-size: 12px;
    color: $gold;
    letter-spacing: 0.1em;
    margin-bottom: 8px;
  }
  h1 {
    font-size: 30px;
    font-weight: 700;
    @include gold-text;
    letter-spacing: 0.04em;
  }
  .hero-sub {
    font-size: 13px;
    color: var(--c-text-secondary);
    margin-top: 6px;
  }
}
.hero-beam {
  position: absolute;
  top: 0;
  right: 0;
  width: 50%;
  height: 100%;
  background: radial-gradient(ellipse at right, rgba(232, 181, 71, 0.18), transparent 60%);
  pointer-events: none;
}

.stat-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 18px;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  gap: 20px;
}
.grid-3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 20px;
}

.alert-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 290px;
  overflow-y: auto;
  @include scrollbar-dark;
}
.alert-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
  border-left: 3px solid transparent;
  transition: all 0.2s ease;
  &:hover {
    background: rgba(232, 181, 71, 0.05);
  }
  &.danger {
    border-left-color: $danger;
  }
  &.warning {
    border-left-color: $warning;
  }
  &.info {
    border-left-color: $info;
  }
}
.alert-icon {
  font-size: 20px;
  flex-shrink: 0;
  margin-top: 2px;
}
.alert-body {
  flex: 1;
  min-width: 0;
}
.alert-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--c-text-primary);
}
.alert-desc {
  font-size: 12px;
  color: var(--c-text-secondary);
  margin-top: 4px;
  line-height: 1.5;
}
.alert-time {
  font-size: 11px;
  color: var(--c-text-tertiary);
  margin-top: 4px;
  display: inline-block;
}

@media (max-width: 1280px) {
  .stat-row {
    grid-template-columns: repeat(2, 1fr);
  }
  .grid-2,
  .grid-3 {
    grid-template-columns: 1fr;
  }
}
</style>
