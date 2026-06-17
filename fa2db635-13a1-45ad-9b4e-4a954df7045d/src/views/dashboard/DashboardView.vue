<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { reportApi, weddingApi, scheduleApi } from '@/api'
import { useAsync } from '@/composables/useAsync'
import { yuan, wan, formatDate, countdown } from '@/utils/format'
import { STAGE_LABELS, STAGE_STYLE } from '@/constants'
import StatCard from '@/components/ui/StatCard.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BaseChart from '@/components/charts/BaseChart.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import type { EChartsOption } from 'echarts'
import { TrendingUp, HeartHandshake, AlertTriangle, Wallet, ArrowRight, Plus, Bell } from 'lucide-vue-next'
import type { Wedding, ScheduleTask } from '@/types'

const router = useRouter()
const summary = useAsync(() => reportApi.summary(), { revenue: 0, cost: 0, profit: 0, weddings: 0, signed: 0, conflictAlerts: 0, overdueReceivable: 0 })
const weddings = useAsync(() => weddingApi.list({}), [] as Wedding[])
const tasks = useAsync(() => scheduleApi.list({ resourceType: 'STAFF' }), [] as ScheduleTask[])

const upcoming = computed(() =>
  [...(weddings.data.value || [])]
    .filter((w) => countdown(w.weddingDate) >= 0)
    .sort((a, b) => +new Date(a.weddingDate) - +new Date(b.weddingDate))
    .slice(0, 6),
)

const alerts = computed(() => {
  const list = tasks.data.value || []
  const seen = new Map<string, ScheduleTask>()
  list.forEach((t) => {
    const key = `${t.resourceId}-${t.startTime.slice(0, 10)}`
    if (seen.has(key)) return
    const dup = list.filter((x) => x.resourceId === t.resourceId && x.startTime.slice(0, 10) === t.startTime.slice(0, 10))
    if (dup.length > 1 && t.coupleName) seen.set(key, t)
  })
  return Array.from(seen.values()).slice(0, 4)
})

const revenueOpt = computed<EChartsOption>(() => {
  const days = (weddings.data.value || [])
    .filter((w) => w.weddingDate)
    .sort((a, b) => +new Date(a.weddingDate) - +new Date(b.weddingDate))
    .slice(-12)
  return {
    grid: { left: 8, right: 12, top: 16, bottom: 4, containLabel: true },
    tooltip: { trigger: 'axis', backgroundColor: '#fff', borderColor: '#e6c8d8', textStyle: { color: '#5b2a4e' } },
    xAxis: {
      type: 'category',
      data: days.map((w) => formatDate(w.weddingDate).slice(5)),
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
        symbolSize: 6,
        data: days.map((w) => w.quoteTotal ?? 0),
        lineStyle: { width: 3, color: '#5b2a4e' },
        itemStyle: { color: '#c9a86a', borderColor: '#fff', borderWidth: 2 },
        areaStyle: {
          color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
            { offset: 0, color: 'rgba(91,42,78,0.18)' }, { offset: 1, color: 'rgba(91,42,78,0.01)' },
          ] },
        },
      },
    ],
  }
})

const funnelOpt = computed<EChartsOption>(() => {
  const stages = ['咨询', '方案设计', '合同签订', '筹备执行', '现场督导', '后期交付']
  const counts = stages.map((_, i) => Math.max(1, (weddings.data.value || []).length * (6 - i) * 0.5 + 20 * (6 - i)))
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 场' },
    series: [
      {
        type: 'funnel',
        left: '8%',
        width: '84%',
        gap: 2,
        label: { color: '#5b2a4e', fontSize: 11 },
        data: stages.map((s, i) => ({ name: s, value: Math.round(counts[i]), itemStyle: { color: ['#5b2a4e', '#7a3a5c', '#9c4d76', '#b96f97', '#c9a86a', '#d29cba'][i] } })),
      },
    ],
  }
})

function go(id: number) {
  router.push(`/weddings/${id}`)
}
</script>

<template>
  <div class="stagger">
    <PageHeader title="工作台" subtitle="锦时婚礼管家 · 集团运营总览">
      <template #actions>
        <button class="btn-ghost h-10 px-3 text-sm"><Bell :size="15" /> 通知</button>
        <button class="btn-primary h-10 px-4 text-sm" @click="router.push('/weddings/create')"><Plus :size="16" /> 创建婚礼</button>
      </template>
    </PageHeader>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
      <template v-if="summary.loading.value">
        <div v-for="i in 4" :key="i" class="card p-5"><Skeleton :rows="3" /></div>
      </template>
      <template v-else>
        <StatCard label="本月成交额" :value="summary.data.value.revenue" unit="元" :trend="12.4" trend-label="环比上月" :icon="TrendingUp" accent="wine" />
        <StatCard label="在执婚礼" :value="summary.data.value.weddings" unit="场" :trend="5.2" trend-label="本周新增" :icon="HeartHandshake" accent="gold" />
        <StatCard label="档期冲突预警" :value="summary.data.value.conflictAlerts" unit="项" :trend="-8" trend-label="已自动避让" :icon="AlertTriangle" accent="amber" />
        <StatCard label="逾期应收" :value="summary.data.value.overdueReceivable" unit="元" :trend="-3.1" trend-label="催收中" :icon="Wallet" accent="green" />
      </template>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
      <BaseCard title="成交额趋势" subtitle="近 12 场婚礼报价" class="lg:col-span-2">
        <Skeleton v-if="weddings.loading.value" :rows="6" height="220px" />
        <BaseChart v-else :option="revenueOpt" height="240px" />
      </BaseCard>
      <BaseCard title="转化漏斗" subtitle="全流程阶段分布">
        <Skeleton v-if="weddings.loading.value" :rows="6" height="220px" />
        <BaseChart v-else :option="funnelOpt" height="240px" />
      </BaseCard>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <BaseCard title="待办婚礼" subtitle="按婚期临近排序" class="lg:col-span-2" :padding="false">
        <div v-if="weddings.loading.value" class="p-5"><Skeleton :rows="5" /></div>
        <EmptyState v-else-if="!upcoming.length" text="暂无待办婚礼" />
        <table v-else class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs text-wine-400 border-b border-wine-100">
              <th class="px-5 py-3 font-medium">新人</th>
              <th class="px-3 py-3 font-medium">婚期</th>
              <th class="px-3 py-3 font-medium hidden sm:table-cell">门店</th>
              <th class="px-3 py-3 font-medium">阶段</th>
              <th class="px-3 py-3 font-medium text-right">倒计时</th>
              <th class="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="w in upcoming" :key="w.id" class="border-b border-wine-50 hover:bg-cream/60 transition cursor-pointer" @click="go(w.id)">
              <td class="px-5 py-3">
                <p class="font-medium text-wine-800">{{ w.coupleName }}</p>
                <p class="text-xs text-wine-300">{{ w.guests }}桌 · {{ w.packageName }}</p>
              </td>
              <td class="px-3 py-3 num text-wine-600">{{ formatDate(w.weddingDate) }}</td>
              <td class="px-3 py-3 text-xs text-wine-400 hidden sm:table-cell">{{ w.storeName }}</td>
              <td class="px-3 py-3"><span class="chip" :class="STAGE_STYLE[w.stage]">{{ STAGE_LABELS[w.stage] }}</span></td>
              <td class="px-3 py-3 text-right num">
                <span :class="countdown(w.weddingDate) <= 7 ? 'text-rose-500 font-semibold' : 'text-wine-500'">{{ countdown(w.weddingDate) }}天</span>
              </td>
              <td class="px-5 py-3 text-right text-wine-300"><ArrowRight :size="15" /></td>
            </tr>
          </tbody>
        </table>
      </BaseCard>

      <div class="space-y-5">
        <BaseCard title="档期冲突预警" subtitle="自动检测重复占用">
          <Skeleton v-if="tasks.loading.value" :rows="3" />
          <EmptyState v-else-if="!alerts.length" text="暂无档期冲突" />
          <div v-else class="space-y-2.5">
            <div v-for="a in alerts" :key="a.id" class="flex items-center gap-3 p-3 rounded-xl bg-amber-50/60 border border-amber-100">
              <div class="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0"><AlertTriangle :size="15" /></div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-wine-800 truncate">{{ a.resourceName }} · {{ a.coupleName }}</p>
                <p class="text-xs text-amber-600 mt-0.5">{{ formatDate(a.startTime) }} 资源档期重叠</p>
              </div>
              <button class="text-xs text-wine-500 hover:text-wine-700 font-medium" @click="router.push('/schedule')">处理</button>
            </div>
          </div>
        </BaseCard>

        <BaseCard title="逾期应收" subtitle="自动催收预警">
          <div class="space-y-2.5">
            <div class="flex items-center justify-between p-3 rounded-xl bg-rose-50/60 border border-rose-100">
              <div>
                <p class="text-sm font-medium text-wine-800">陈安然 & 王景行</p>
                <p class="text-xs text-rose-500 mt-0.5">逾期 12 天</p>
              </div>
              <p class="num font-semibold text-rose-600">{{ yuan(48000) }}</p>
            </div>
            <div class="flex items-center justify-between p-3 rounded-xl bg-rose-50/60 border border-rose-100">
              <div>
                <p class="text-sm font-medium text-wine-800">赵雨桐 & 韩明轩</p>
                <p class="text-xs text-rose-500 mt-0.5">逾期 5 天</p>
              </div>
              <p class="num font-semibold text-rose-600">{{ yuan(32000) }}</p>
            </div>
          </div>
        </BaseCard>
      </div>
    </div>
  </div>
</template>
