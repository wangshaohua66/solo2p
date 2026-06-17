<script setup lang="ts">
import { computed, ref } from 'vue'
import { portalApi } from '@/api'
import { useAsync } from '@/composables/useAsync'
import { yuan, formatDate, monthLabel, todayISO } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import BaseCard from '@/components/ui/BaseCard.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { CalendarDays, CheckCircle2, Clock, MapPin } from 'lucide-vue-next'
import type { ScheduleTask, SupplierOrder } from '@/types'

const auth = useAuthStore()
const today = new Date()
const viewMonth = ref(new Date(today.getFullYear(), today.getMonth(), 1))

const schedule = useAsync(() => portalApi.schedule(auth.user?.id || 1), [] as ScheduleTask[])
const orders = useAsync(() => portalApi.orders(auth.user?.id || 1), [] as SupplierOrder[])

const pendingOrders = computed(() => (orders.data.value || []).filter((o) => o.status === 'PENDING'))

const calendarDays = computed(() => {
  const year = viewMonth.value.getFullYear()
  const month = viewMonth.value.getMonth()
  const first = new Date(year, month, 1)
  const startDay = first.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days: { date: string; day: number; inMonth: boolean; isToday: boolean; hasTask: boolean }[] = []
  const prevMonthDays = new Date(year, month, 0).getDate()
  for (let i = startDay - 1; i >= 0; i--) {
    const d = prevMonthDays - i
    days.push({ date: formatDate(new Date(year, month - 1, d)), day: d, inMonth: false, isToday: false, hasTask: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = formatDate(new Date(year, month, d))
    const isToday = dateStr === todayISO()
    const hasTask = (schedule.data.value || []).some((s) => s.startTime.slice(0, 10) === dateStr)
    days.push({ date: dateStr, day: d, inMonth: true, isToday, hasTask })
  }
  const remaining = 42 - days.length
  for (let d = 1; d <= remaining; d++) {
    days.push({ date: formatDate(new Date(year, month + 1, d)), day: d, inMonth: false, isToday: false, hasTask: false })
  }
  return days
})

function prevMonth() {
  viewMonth.value = new Date(viewMonth.value.getFullYear(), viewMonth.value.getMonth() - 1, 1)
}
function nextMonth() {
  viewMonth.value = new Date(viewMonth.value.getFullYear(), viewMonth.value.getMonth() + 1, 1)
}

async function confirmOrder(id: number) {
  await portalApi.confirmOrder(id)
  await orders.run()
}
</script>

<template>
  <div class="stagger">
    <div class="card p-6 mb-5 relative overflow-hidden bg-gradient-to-br from-wine-700 to-wine-900">
      <div class="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-gold-400/10"></div>
      <div class="absolute right-20 bottom-0 w-32 h-32 rounded-full bg-wine-500/20"></div>
      <div class="relative">
        <p class="text-gold-400 text-sm font-medium tracking-wide">锦时 · 供应商工作台</p>
        <h1 class="font-display text-3xl text-white mt-1 font-semibold">你好，{{ auth.user?.name || '服务商' }}</h1>
        <p class="font-display text-2xl text-wine-100 mt-2">今日档期</p>
        <div class="mt-4 flex items-center gap-4">
          <div class="flex items-center gap-2 text-white/80 text-sm">
            <CalendarDays :size="16" />
            <span>{{ formatDate(todayISO()) }}</span>
          </div>
          <div class="flex items-center gap-2 text-gold-400 text-sm">
            <Clock :size="16" />
            <span>{{ (schedule.data.value || []).filter((s) => s.startTime.slice(0, 10) === todayISO()).length }} 项任务</span>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-5 gap-5">
      <BaseCard class="lg:col-span-3">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="font-serif text-lg text-wine-800 font-semibold">个人档期月历</h3>
            <p class="text-xs text-wine-300 mt-0.5">{{ monthLabel(viewMonth) }}</p>
          </div>
          <div class="flex items-center gap-2">
            <button class="btn-soft h-8 w-8 flex items-center justify-center text-wine-500" @click="prevMonth">‹</button>
            <button class="btn-soft h-8 w-8 flex items-center justify-center text-wine-500" @click="nextMonth">›</button>
          </div>
        </div>
        <Skeleton v-if="schedule.loading.value" :rows="6" />
        <template v-else>
          <div class="grid grid-cols-7 gap-1 mb-2">
            <div v-for="d in ['日', '一', '二', '三', '四', '五', '六']" :key="d" class="text-center text-xs text-wine-400 py-2 font-medium">{{ d }}</div>
          </div>
          <div class="grid grid-cols-7 gap-1">
            <div
              v-for="c in calendarDays"
              :key="c.date"
              class="aspect-square rounded-lg flex flex-col items-center justify-center text-sm relative transition"
              :class="[
                !c.inMonth ? 'text-wine-200' : 'text-wine-700',
                c.isToday ? 'ring-2 ring-gold-400 bg-gold-50/60 font-semibold' : '',
                c.inMonth && !c.isToday ? 'hover:bg-wine-50' : '',
              ]"
            >
              <span>{{ c.day }}</span>
              <span v-if="c.hasTask && c.inMonth" class="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-gold-400"></span>
            </div>
          </div>
        </template>
      </BaseCard>

      <BaseCard title="待确认接单" subtitle="请及时确认档期" class="lg:col-span-2" :padding="false">
        <div v-if="orders.loading.value" class="p-5"><Skeleton :rows="4" /></div>
        <EmptyState v-else-if="!pendingOrders.length" text="暂无待确认订单" />
        <div v-else class="divide-y divide-wine-50">
          <div v-for="o in pendingOrders" :key="o.id" class="p-4 hover:bg-cream/40 transition">
            <div class="flex items-start justify-between">
              <div class="min-w-0">
                <p class="font-medium text-wine-800">{{ o.coupleName }}</p>
                <div class="flex items-center gap-2 mt-1 text-xs text-wine-400">
                  <CalendarDays :size="12" />
                  <span>{{ formatDate(o.weddingDate) }}</span>
                </div>
                <div class="flex items-center gap-2 mt-1 text-xs text-wine-400">
                  <MapPin :size="12" />
                  <span>{{ o.service }}</span>
                </div>
              </div>
              <div class="text-right shrink-0 ml-3">
                <p class="num font-semibold text-wine-700">{{ yuan(o.amount) }}</p>
                <StatusBadge text="待确认" type="amber" class="mt-1" />
              </div>
            </div>
            <button class="btn-primary w-full h-9 mt-3 text-sm" @click="confirmOrder(o.id)">
              <CheckCircle2 :size="15" /> 确认档期
            </button>
          </div>
        </div>
      </BaseCard>
    </div>
  </div>
</template>
