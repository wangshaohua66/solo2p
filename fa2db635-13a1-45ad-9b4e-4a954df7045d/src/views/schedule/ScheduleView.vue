<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { scheduleApi, weddingApi, settingsApi } from '@/api'
import { useAsync } from '@/composables/useAsync'
import { formatDate, formatDateTime, countdown, monthLabel } from '@/utils/format'
import { RESOURCE_LABELS, RESOURCE_STYLE } from '@/constants'
import type { ScheduleTask, ResourceType, ConflictResult, Wedding, Store } from '@/types'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import {
  ChevronLeft, ChevronRight, Users, MapPin, Package as BoxIcon,
  AlertTriangle, CheckCircle2, GripVertical, Plus, CalendarDays,
} from 'lucide-vue-next'

const router = useRouter()

const view = ref<'month' | 'week'>('month')
const cursor = ref(new Date())
const resType = ref<ResourceType>('STAFF')
const storeId = ref<number | undefined>(undefined)

const stores = useAsync(() => settingsApi.list().then((d) => d.stores as Store[]), [] as Store[])
const tasks = useAsync<ScheduleTask[]>(
  () => scheduleApi.list({ resourceType: resType.value, storeId: storeId.value }),
  [],
)

watch([resType, storeId], () => tasks.run())

const firstWeek = computed(() => {
  const c = new Date(cursor.value)
  c.setDate(1)
  const wd = (c.getDay() + 6) % 7
  c.setDate(c.getDate() - wd)
  return c
})
const days = computed(() => {
  const arr: Date[] = []
  for (let i = 0; i < (view.value === 'month' ? 42 : 7); i++) {
    const d = new Date(firstWeek.value)
    d.setDate(d.getDate() + i)
    arr.push(d)
  }
  return arr
})
function inMonth(d: Date): boolean {
  return d.getMonth() === cursor.value.getMonth()
}
function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

const byDate = computed(() => {
  const m = new Map<string, ScheduleTask[]>()
  for (const t of tasks.data.value) {
    const ds = t.startTime.slice(0, 10)
    const de = t.endTime.slice(0, 10)
    for (const d of days.value) {
      const s = iso(d)
      if (s >= ds && s <= de) {
        if (!m.has(s)) m.set(s, [])
        m.get(s)!.push(t)
      }
    }
  }
  return m
})

const conflictMap = computed(() => {
  const res = new Map<number, Set<string>>()
  for (const t of tasks.data.value) {
    const key = `${t.resourceId}-${t.startTime.slice(0, 10)}`
    const dup = tasks.data.value.filter(
      (x) => x.resourceId === t.resourceId && x.startTime.slice(0, 10) === t.startTime.slice(0, 10),
    )
    if (dup.length > 1) {
      if (!res.has(t.resourceId)) res.set(t.resourceId, new Set())
      res.get(t.resourceId)!.add(key)
    }
  }
  return res
})

const drawer = ref<{ task?: ScheduleTask; conflict?: ConflictResult } | null>(null)
async function openConflict(task: ScheduleTask) {
  const r = await scheduleApi.check({
    resourceType: task.resourceType,
    resourceId: task.resourceId,
    storeId: stores.data.value[0]?.id ?? 1,
    start: task.startTime,
    end: task.endTime,
  })
  drawer.value = { task, conflict: r }
}

function prev() {
  const d = new Date(cursor.value)
  if (view.value === 'month') d.setMonth(d.getMonth() - 1)
  else d.setDate(d.getDate() - 7)
  cursor.value = d
}
function next() {
  const d = new Date(cursor.value)
  if (view.value === 'month') d.setMonth(d.getMonth() + 1)
  else d.setDate(d.getDate() + 7)
  cursor.value = d
}
function today() {
  cursor.value = new Date()
}

function hasConflict(task: ScheduleTask): boolean {
  return conflictMap.value.get(task.resourceId)?.has(`${task.resourceId}-${task.startTime.slice(0, 10)}`) ?? false
}

const weekHead = ['一', '二', '三', '四', '五', '六', '日']
</script>

<template>
  <div class="stagger">
    <PageHeader title="档期日历" subtitle="人员 / 场地 / 道具资源档期，自动冲突检测与替换推荐">
      <template #actions>
        <button class="btn-ghost h-10 px-3 text-sm" @click="tasks.run()">
          <CalendarDays :size="16" /> 刷新
        </button>
        <button class="btn-primary h-10 px-4 text-sm" @click="router.push('/weddings/create')">
          <Plus :size="16" /> 创建档期
        </button>
      </template>
    </PageHeader>

    <BaseCard>
      <div class="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between mb-5">
        <div class="flex flex-wrap items-center gap-2">
          <div class="flex gap-1">
            <button
              v-for="r in (['STAFF', 'VENUE', 'PROP'] as ResourceType[])"
              :key="r"
              @click="resType = r"
              class="btn-soft h-9 px-3 text-xs"
              :class="resType === r ? '!bg-wine-grad !text-white' : ''"
            >
              <component :is="r === 'STAFF' ? Users : r === 'VENUE' ? MapPin : BoxIcon" :size="14" />
              {{ RESOURCE_LABELS[r] }}
            </button>
          </div>
          <div class="h-6 w-px bg-wine-100"></div>
          <select v-model.number="storeId" class="field-input h-9 !w-auto pr-8 text-xs">
            <option :value="undefined">全部门店</option>
            <option v-for="s in stores.data.value" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </div>

        <div class="flex items-center gap-2">
          <div class="flex gap-1">
            <button
              v-for="v in (['month', 'week'] as const)"
              :key="v"
              class="btn-soft h-9 px-3 text-xs"
              :class="view === v ? '!bg-wine-grad !text-white' : ''"
              @click="view = v"
            >
              {{ v === 'month' ? '月视图' : '周视图' }}
            </button>
          </div>
          <div class="h-6 w-px bg-wine-100"></div>
          <button class="w-8 h-9 rounded-lg bg-white border border-wine-100 text-wine-500 hover:bg-wine-50 flex items-center justify-center" @click="prev">
            <ChevronLeft :size="16" />
          </button>
          <button class="btn-soft h-9 px-3 text-xs" @click="today">今天</button>
          <button class="w-8 h-9 rounded-lg bg-white border border-wine-100 text-wine-500 hover:bg-wine-50 flex items-center justify-center" @click="next">
            <ChevronRight :size="16" />
          </button>
          <p class="font-display text-lg font-semibold text-wine-800 ml-2 min-w-[120px]">{{ monthLabel(cursor) }}</p>
        </div>
      </div>

      <div v-if="tasks.loading.value" class="space-y-3">
        <Skeleton :rows="7" height="80px" />
      </div>

      <div v-else class="grid grid-cols-7 gap-px bg-wine-100 rounded-xl overflow-hidden border border-wine-100">
        <div
          v-for="w in weekHead"
          :key="w"
          class="bg-cream px-3 py-2 text-center text-[11px] tracking-widest text-wine-400 font-medium"
        >
          {{ w }}
        </div>

        <div
          v-for="(d, i) in days"
          :key="i"
          class="bg-white min-h-[108px] lg:min-h-[120px] p-1.5 hover:bg-cream/40 transition cursor-pointer"
          :class="{ 'bg-cream/60': !inMonth(d) }"
        >
          <div class="flex items-center justify-between px-1">
            <p
              class="num text-xs"
              :class="iso(d) === iso(new Date()) ? 'w-5 h-5 rounded-full bg-wine-grad text-white flex items-center justify-center' : inMonth(d) ? 'text-wine-700' : 'text-wine-200'"
            >
              {{ d.getDate() }}
            </p>
            <span v-if="(byDate.get(iso(d)) || []).length" class="text-[10px] text-wine-300 num">
              {{ (byDate.get(iso(d)) || []).length }}
            </span>
          </div>
          <div class="mt-1 space-y-1">
            <div
              v-for="t in (byDate.get(iso(d)) || []).slice(0, 3)"
              :key="t.id"
              class="group relative rounded-md px-1.5 py-1 text-[11px] text-white truncate cursor-pointer hover:ring-2 hover:ring-white/40 transition"
              :class="hasConflict(t) ? 'ring-2 ring-rose-400/70' : ''"
              :style="{ background: RESOURCE_STYLE[t.resourceType] }"
              @click="openConflict(t)"
            >
              <div class="flex items-center gap-1">
                <GripVertical :size="10" class="opacity-70" />
                <AlertTriangle v-if="hasConflict(t)" :size="10" />
                <span class="truncate">{{ t.resourceName }} · {{ t.coupleName }}</span>
              </div>
            </div>
            <p
              v-if="(byDate.get(iso(d)) || []).length > 3"
              class="text-[10px] text-wine-300 px-1"
            >
              还有 {{ (byDate.get(iso(d)) || []).length - 3 }} 项…
            </p>
          </div>
        </div>
      </div>
    </BaseCard>

    <div class="fixed bottom-4 right-4 lg:hidden">
      <button class="btn-primary h-12 px-5 rounded-full shadow-lift" @click="router.push('/weddings/create')">
        <Plus :size="18" /> 创建档期
      </button>
    </div>

    <BaseModal :show="!!drawer" :width="'520px'" :title="drawer?.conflict?.conflict ? '档期冲突' : '档期详情'" @close="drawer = null">
      <div v-if="drawer?.task" class="space-y-4">
        <div class="flex items-start gap-3 p-3 rounded-xl" :class="drawer.conflict?.conflict ? 'bg-rose-50' : 'bg-emerald-50'">
          <div
            class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            :class="drawer.conflict?.conflict ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'"
          >
            <component :is="drawer.conflict?.conflict ? AlertTriangle : CheckCircle2" :size="18" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="font-medium text-wine-800">{{ drawer.task.resourceName }}</p>
            <p class="text-xs mt-0.5" :class="drawer.conflict?.conflict ? 'text-rose-600' : 'text-emerald-600'">
              {{ drawer.conflict?.conflict ? '检测到档期冲突，请选择可替换资源' : '该资源档期可用' }}
            </p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p class="text-xs text-wine-400">新人</p>
            <p class="text-wine-800 font-medium mt-0.5">{{ drawer.task.coupleName || '-' }}</p>
          </div>
          <div>
            <p class="text-xs text-wine-400">资源类型</p>
            <p class="text-wine-800 font-medium mt-0.5">{{ RESOURCE_LABELS[drawer.task.resourceType] }}</p>
          </div>
          <div>
            <p class="text-xs text-wine-400">开始</p>
            <p class="num text-wine-800 mt-0.5">{{ formatDateTime(drawer.task.startTime) }}</p>
          </div>
          <div>
            <p class="text-xs text-wine-400">结束</p>
            <p class="num text-wine-800 mt-0.5">{{ formatDateTime(drawer.task.endTime) }}</p>
          </div>
        </div>

        <div v-if="drawer.conflict?.conflict">
          <p class="text-xs text-wine-400 mb-2">推荐可替换资源（共 {{ drawer.conflict.alternatives.length }} 个）</p>
          <EmptyState v-if="!drawer.conflict.alternatives.length" text="当前时段无可替换资源，请调整婚期" />
          <div v-else class="grid sm:grid-cols-2 gap-2">
            <div
              v-for="a in drawer.conflict.alternatives"
              :key="a.id"
              class="p-3 rounded-xl border border-wine-100 hover:border-gold-300 hover:bg-gold-50/40 transition cursor-pointer"
            >
              <p class="text-sm font-medium text-wine-800">{{ a.name }}</p>
              <p class="text-[11px] text-wine-300 mt-0.5">{{ RESOURCE_LABELS[a.type as ResourceType] }}{{ a.meta ? ' · ' + a.meta : '' }}</p>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn-ghost h-10 px-4 text-sm" @click="drawer = null">关闭</button>
        <button class="btn-primary h-10 px-4 text-sm" v-if="drawer?.task?.weddingId" @click="drawer?.task?.weddingId && router.push(`/weddings/${drawer.task.weddingId}`)">
          查看婚礼
        </button>
      </template>
    </BaseModal>
  </div>
</template>
