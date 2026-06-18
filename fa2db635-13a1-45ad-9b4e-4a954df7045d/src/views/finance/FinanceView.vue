<script setup lang="ts">
import { computed, ref } from 'vue'
import { reportApi, weddingApi, financeApi, exportApi } from '@/api'
import { useAsync } from '@/composables/useAsync'
import { yuan, wan, formatDate, monthLabel } from '@/utils/format'
import StatCard from '@/components/ui/StatCard.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BaseChart from '@/components/charts/BaseChart.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import type { EChartsOption } from 'echarts'
import { Wallet, TrendingUp, TrendingDown, AlertTriangle, ArrowRight, Download } from 'lucide-vue-next'
import type { Wedding, FinanceDetail, OverdueItem } from '@/types'

const exporting = ref(false)
async function exportExcel() {
  exporting.value = true
  try {
    await exportApi.financeExcel()
  } finally {
    exporting.value = false
  }
}

const summary = useAsync(() => reportApi.summary(), { revenue: 0, cost: 0, profit: 0, weddings: 0, signed: 0, conflictAlerts: 0, overdueReceivable: 0 })
const weddings = useAsync(() => weddingApi.list({}), [] as Wedding[])
const overdue = useAsync(() => financeApi.overdue(), [] as OverdueItem[])

const topWeddings = computed(() => (weddings.data.value || []).slice(0, 10))

const financeDetails = useAsync(
  () => Promise.all(topWeddings.value.slice(0, 6).map((w) => financeApi.wedding(w.id).catch(() => null))).then((r) => r.filter(Boolean) as FinanceDetail[]),
  [] as FinanceDetail[],
)

const monthRevenue = computed<EChartsOption>(() => {
  const list = weddings.data.value || []
  const months = new Map<string, { revenue: number; cost: number; profit: number }>()
  list.forEach((w) => {
    const d = new Date(w.weddingDate)
    const label = monthLabel(d)
    if (!months.has(label)) months.set(label, { revenue: 0, cost: 0, profit: 0 })
    const m = months.get(label)!
    const revenue = w.quoteTotal ?? 0
    const cost = Math.round(revenue * 0.55)
    m.revenue += revenue
    m.cost += cost
    m.profit += revenue - cost
  })
  const sorted = Array.from(months.entries())
    .sort((a, b) => +new Date(a[0]) - +new Date(b[0]))
    .slice(-8)
  return {
    grid: { left: 8, right: 12, top: 28, bottom: 4, containLabel: true },
    tooltip: { trigger: 'axis', backgroundColor: '#fff', borderColor: '#e6c8d8', textStyle: { color: '#5b2a4e' } },
    legend: { data: ['营收', '成本', '毛利'], textStyle: { color: '#9c4d76', fontSize: 11 }, top: 0, right: 0 },
    xAxis: {
      type: 'category',
      data: sorted.map(([k]) => k.slice(5)),
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
        name: '营收',
        type: 'bar',
        data: sorted.map(([, v]) => v.revenue),
        itemStyle: { color: '#5b2a4e', borderRadius: [4, 4, 0, 0] },
        barWidth: 14,
      },
      {
        name: '成本',
        type: 'bar',
        data: sorted.map(([, v]) => v.cost),
        itemStyle: { color: '#c9a86a', borderRadius: [4, 4, 0, 0] },
        barWidth: 14,
      },
      {
        name: '毛利',
        type: 'bar',
        data: sorted.map(([, v]) => v.profit),
        itemStyle: { color: '#9c4d76', borderRadius: [4, 4, 0, 0] },
        barWidth: 14,
      },
    ],
  }
})

const overdueReceivable = computed(() => overdue.data.value.filter((o) => o.type === 'RECEIVABLE'))
const overduePayable = computed(() => overdue.data.value.filter((o) => o.type === 'PAYABLE'))

function profitColor(n: number): string {
  return n >= 0 ? 'text-emerald-600' : 'text-rose-500'
}
</script>

<template>
  <div class="stagger">
    <PageHeader title="财务核算" subtitle="每场婚礼收入成本明细与应收应付">
      <template #actions>
        <button class="btn-ghost h-9 px-4 text-sm" :disabled="exporting" @click="exportExcel">
          <Download :size="15" /> {{ exporting ? '导出中…' : '导出Excel' }}
        </button>
      </template>
    </PageHeader>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
      <template v-if="summary.loading.value">
        <div v-for="i in 4" :key="i" class="card p-5"><Skeleton :rows="3" /></div>
      </template>
      <template v-else>
        <StatCard label="本月营收" :value="summary.data.value.revenue" unit="元" :trend="8.6" trend-label="环比上月" :icon="TrendingUp" accent="wine" />
        <StatCard label="本月成本" :value="summary.data.value.cost" unit="元" :trend="-2.1" trend-label="成本管控" :icon="TrendingDown" accent="gold" />
        <StatCard label="本月毛利" :value="summary.data.value.profit" unit="元" :trend="11.3" trend-label="毛利率提升" :icon="Wallet" accent="green" />
        <StatCard label="逾期应收" :value="summary.data.value.overdueReceivable" unit="元" :trend="-5.7" trend-label="催收中" :icon="AlertTriangle" accent="amber" />
      </template>
    </div>

    <BaseCard title="月度营收趋势" subtitle="近 8 个月营收/成本/毛利" class="mb-5">
      <Skeleton v-if="weddings.loading.value" :rows="6" height="220px" />
      <BaseChart v-else :option="monthRevenue" height="260px" />
    </BaseCard>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <BaseCard title="收支明细" subtitle="按婚礼项目" class="lg:col-span-2" :padding="false">
        <div v-if="financeDetails.loading.value" class="p-5"><Skeleton :rows="5" /></div>
        <EmptyState v-else-if="!financeDetails.data.value.length" text="暂无收支明细" />
        <table v-else class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs text-wine-400 border-b border-wine-100">
              <th class="px-5 py-3 font-medium">新人</th>
              <th class="px-3 py-3 font-medium text-right">收入</th>
              <th class="px-3 py-3 font-medium text-right">已收</th>
              <th class="px-3 py-3 font-medium text-right hidden md:table-cell">成本</th>
              <th class="px-3 py-3 font-medium text-right hidden md:table-cell">已付</th>
              <th class="px-5 py-3 font-medium text-right">毛利</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="f in financeDetails.data.value" :key="f.weddingId" class="border-b border-wine-50 hover:bg-cream/60 transition">
              <td class="px-5 py-3">
                <p class="font-medium text-wine-800">{{ f.coupleName }}</p>
              </td>
              <td class="px-3 py-3 text-right num text-wine-600">{{ yuan(f.income) }}</td>
              <td class="px-3 py-3 text-right num">
                <StatusBadge :text="yuan(f.received)" :type="f.received >= f.income ? 'green' : 'amber'" />
              </td>
              <td class="px-3 py-3 text-right num text-wine-400 hidden md:table-cell">{{ yuan(f.cost) }}</td>
              <td class="px-3 py-3 text-right num hidden md:table-cell">
                <StatusBadge :text="yuan(f.paid)" :type="f.paid >= f.cost ? 'wine' : 'gold'" />
              </td>
              <td class="px-5 py-3 text-right num font-semibold" :class="profitColor(f.profit)">{{ yuan(f.profit) }}</td>
            </tr>
          </tbody>
        </table>
      </BaseCard>

      <div class="space-y-5">
        <BaseCard title="逾期应收" subtitle="未按时回款">
          <Skeleton v-if="overdue.loading.value" :rows="3" />
          <EmptyState v-else-if="!overdueReceivable.length" text="暂无逾期应收" />
          <div v-else class="space-y-2.5">
            <div v-for="o in overdueReceivable" :key="o.id" class="p-3 rounded-xl bg-rose-50/60 border border-rose-100">
              <div class="flex items-center justify-between">
                <p class="text-sm font-medium text-wine-800">{{ o.party }}</p>
                <p class="num font-semibold text-rose-600">{{ yuan(o.amount) }}</p>
              </div>
              <p class="text-xs text-rose-500 mt-1">逾期 {{ o.days }} 天 <ArrowRight :size="11" class="inline" /></p>
            </div>
          </div>
        </BaseCard>

        <BaseCard title="逾期应付" subtitle="待结算供应商">
          <Skeleton v-if="overdue.loading.value" :rows="3" />
          <EmptyState v-else-if="!overduePayable.length" text="暂无逾期应付" />
          <div v-else class="space-y-2.5">
            <div v-for="o in overduePayable" :key="o.id" class="p-3 rounded-xl bg-amber-50/60 border border-amber-100">
              <div class="flex items-center justify-between">
                <p class="text-sm font-medium text-wine-800">{{ o.party }}</p>
                <p class="num font-semibold text-amber-700">{{ yuan(o.amount) }}</p>
              </div>
              <p class="text-xs text-amber-600 mt-1">逾期 {{ o.days }} 天</p>
            </div>
          </div>
        </BaseCard>
      </div>
    </div>
  </div>
</template>
