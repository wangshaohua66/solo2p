<script setup lang="ts">
import { computed, ref } from 'vue'
import { reportApi, weddingApi, exportApi } from '@/api'
import { useAsync } from '@/composables/useAsync'
import { yuan, wan, pct, formatDate } from '@/utils/format'
import StatCard from '@/components/ui/StatCard.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BaseChart from '@/components/charts/BaseChart.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import type { EChartsOption } from 'echarts'
import { TrendingUp, Target, Star, FileSpreadsheet, FileText } from 'lucide-vue-next'
import type { Wedding, RevenuePoint, FunnelData, ScoreData } from '@/types'

const exporting = ref(false)
async function exportExcel() {
  exporting.value = true
  try {
    await exportApi.reportExcel()
  } finally {
    exporting.value = false
  }
}

const TABS = [
  { key: '7d', label: '近7天' },
  { key: '30d', label: '近30天' },
  { key: '90d', label: '近90天' },
  { key: 'year', label: '全年' },
]

const tab = ref('30d')
const summary = useAsync(() => reportApi.summary(), { revenue: 0, cost: 0, profit: 0, weddings: 0, signed: 0, conflictAlerts: 0, overdueReceivable: 0 })
const revenue = useAsync(() => reportApi.revenue({}), [] as RevenuePoint[])
const funnel = useAsync(() => reportApi.funnel(), [] as FunnelData[])
const satisfaction = useAsync(() => reportApi.satisfaction(), [] as ScoreData[])
const weddings = useAsync(() => weddingApi.list({}), [] as Wedding[])

const totalRevenue = computed(() => summary.data.value.revenue)
const conversionRate = computed(() => summary.data.value.weddings > 0 ? summary.data.value.signed / summary.data.value.weddings : 0)
const avgSatisfaction = computed(() => {
  const list = satisfaction.data.value || []
  if (!list.length) return 0
  return list.reduce((s, x) => s + x.score, 0) / list.length / 100
})

const revenueOpt = computed<EChartsOption>(() => {
  const list = revenue.data.value || []
  return {
    grid: { left: 8, right: 12, top: 16, bottom: 4, containLabel: true },
    tooltip: { trigger: 'axis', backgroundColor: '#fff', borderColor: '#e6c8d8', textStyle: { color: '#5b2a4e' } },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: list.map((r) => formatDate(r.date).slice(5)),
      axisLine: { lineStyle: { color: '#e6c8d8' } },
      axisLabel: { color: '#9c4d76', fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#f3e6ee' } },
      axisLabel: { color: '#b96f97', fontSize: 10, formatter: (v: number) => wan(v) },
    },
    series: [
      {
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        data: list.map((r) => r.amount),
        lineStyle: { width: 3, color: '#5b2a4e' },
        itemStyle: { color: '#c9a86a', borderColor: '#fff', borderWidth: 2 },
        areaStyle: {
          color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
            { offset: 0, color: 'rgba(91,42,78,0.2)' }, { offset: 1, color: 'rgba(91,42,78,0.02)' },
          ] },
        },
      },
    ],
  }
})

const funnelOpt = computed<EChartsOption>(() => {
  const list = funnel.data.value.length ? funnel.data.value : [
    { stage: '咨询', count: 120 }, { stage: '方案设计', count: 85 }, { stage: '合同签订', count: 62 },
    { stage: '筹备执行', count: 48 }, { stage: '现场督导', count: 35 }, { stage: '后期交付', count: 30 },
  ]
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 场' },
    series: [
      {
        type: 'funnel',
        left: '8%',
        width: '84%',
        gap: 3,
        label: { color: '#5b2a4e', fontSize: 11 },
        data: list.map((f, i) => ({ name: f.stage, value: f.count, itemStyle: { color: ['#5b2a4e', '#7a3a5c', '#9c4d76', '#b96f97', '#c9a86a', '#d29cba'][i % 6] } })),
      },
    ],
  }
})

const satisfactionOpt = computed<EChartsOption>(() => {
  const list = satisfaction.data.value.length ? satisfaction.data.value : [
    { dimension: '策划创意', score: 92 }, { dimension: '现场执行', score: 88 }, { dimension: '服务态度', score: 95 },
    { dimension: '物料品质', score: 86 }, { dimension: '性价比', score: 80 },
  ]
  return {
    tooltip: { backgroundColor: '#fff', borderColor: '#e6c8d8', textStyle: { color: '#5b2a4e' } },
    radar: {
      indicator: list.map((s) => ({ name: s.dimension, max: 100 })),
      axisName: { color: '#9c4d76', fontSize: 11 },
      splitLine: { lineStyle: { color: '#e6c8d8' } },
      splitArea: { areaStyle: { color: ['rgba(243,230,238,0.4)', 'rgba(243,230,238,0.1)'] } },
      axisLine: { lineStyle: { color: '#e6c8d8' } },
    },
    series: [
      {
        type: 'radar',
        symbol: 'circle',
        symbolSize: 6,
        data: [
          {
            value: list.map((s) => s.score),
            name: '满意度',
            lineStyle: { width: 2, color: '#5b2a4e' },
            itemStyle: { color: '#c9a86a' },
            areaStyle: { color: 'rgba(91,42,78,0.25)' },
          },
        ],
      },
    ],
  }
})

const storeOpt = computed<EChartsOption>(() => {
  const list = weddings.data.value || []
  const map = new Map<string, { name: string; amount: number }>()
  list.forEach((w) => {
    const key = String(w.storeId)
    if (!map.has(key)) map.set(key, { name: w.storeName || `门店${w.storeId}`, amount: 0 })
    map.get(key)!.amount += w.quoteTotal ?? 0
  })
  const data = Array.from(map.values())
  return {
    tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)', backgroundColor: '#fff', borderColor: '#e6c8d8', textStyle: { color: '#5b2a4e' } },
    legend: { bottom: 0, textStyle: { color: '#9c4d76', fontSize: 10 } },
    color: ['#5b2a4e', '#c9a86a', '#9c4d76', '#b96f97', '#d29cba'],
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 12, fontWeight: 'bold', color: '#5b2a4e' } },
        data,
      },
    ],
  }
})
</script>

<template>
  <div class="stagger">
    <PageHeader title="报表统计" subtitle="运营数据全景分析与趋势洞察">
      <template #actions>
        <button class="btn-ghost h-10 px-3 text-sm" :disabled="exporting" @click="exportExcel"><FileSpreadsheet :size="15" /> {{ exporting ? '导出中…' : '导出Excel' }}</button>
      </template>
    </PageHeader>

    <div class="card p-2 mb-5 inline-flex gap-1 flex-wrap">
      <button
        v-for="t in TABS"
        :key="t.key"
        class="chip h-9 px-4 text-sm transition"
        :class="tab === t.key ? 'bg-wine-600 text-white font-medium' : 'bg-transparent text-wine-500 hover:bg-wine-50'"
        @click="tab = t.key"
      >
        {{ t.label }}
      </button>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
      <template v-if="summary.loading.value">
        <div v-for="i in 3" :key="i" class="card p-5"><Skeleton :rows="3" /></div>
      </template>
      <template v-else>
        <StatCard label="总成交额" :value="totalRevenue" unit="元" :trend="15.8" trend-label="同比增长" :icon="TrendingUp" accent="wine" />
        <StatCard label="转化率" :value="pct(conversionRate)" :trend="3.2" trend-label="签约率提升" :icon="Target" accent="gold" />
        <StatCard label="平均满意度" :value="pct(avgSatisfaction, 0)" :trend="1.5" trend-label="客户口碑" :icon="Star" accent="green" />
      </template>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
      <BaseCard title="成交额趋势" subtitle="周期内每日成交额">
        <Skeleton v-if="revenue.loading.value" :rows="6" height="220px" />
        <BaseChart v-else :option="revenueOpt" height="240px" />
      </BaseCard>

      <BaseCard title="转化漏斗" subtitle="客户生命周期分布">
        <Skeleton v-if="funnel.loading.value" :rows="6" height="220px" />
        <BaseChart v-else :option="funnelOpt" height="240px" />
      </BaseCard>

      <BaseCard title="满意度雷达" subtitle="多维度客户评分">
        <Skeleton v-if="satisfaction.loading.value" :rows="6" height="220px" />
        <BaseChart v-else :option="satisfactionOpt" height="240px" />
      </BaseCard>

      <BaseCard title="门店贡献" subtitle="各门店成交额占比">
        <Skeleton v-if="weddings.loading.value" :rows="6" height="220px" />
        <EmptyState v-else-if="!weddings.data.value.length" text="暂无数据" />
        <BaseChart v-else :option="storeOpt" height="240px" />
      </BaseCard>
    </div>
  </div>
</template>
