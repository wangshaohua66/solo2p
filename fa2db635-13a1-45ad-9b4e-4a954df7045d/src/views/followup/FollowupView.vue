<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Component } from 'vue'
import { followupApi, weddingApi } from '@/api'
import { useAsync } from '@/composables/useAsync'
import { formatDate, countdown } from '@/utils/format'
import { TASK_LABELS, TASK_STYLE } from '@/constants'
import type { FollowTask, TaskStatus, Wedding } from '@/types'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { CalendarClock, Circle, Clock, CheckCircle2 } from 'lucide-vue-next'

const TASK_ICON: Record<TaskStatus, Component> = {
  TODO: Circle,
  DOING: Clock,
  DONE: CheckCircle2,
}
const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  TODO: 'DOING',
  DOING: 'DONE',
  DONE: 'TODO',
}
const COLUMNS: TaskStatus[] = ['TODO', 'DOING', 'DONE']

const tasks = useAsync(() => followupApi.list(), [] as FollowTask[])
const weddings = useAsync(() => weddingApi.list({}), [] as Wedding[])

const selectedId = ref<number | undefined>(undefined)

const weddingsWithTasks = computed(() => {
  const ids = new Set((tasks.data.value || []).map((t) => t.weddingId))
  return (weddings.data.value || []).filter((w) => ids.has(w.id))
})

watch(
  () => [weddings.data.value, tasks.data.value],
  () => {
    if (selectedId.value === undefined && weddingsWithTasks.value.length) {
      selectedId.value = weddingsWithTasks.value[0].id
    }
  },
)

const selectedWedding = computed(() => weddings.data.value.find((w) => w.id === selectedId.value))
const days = computed(() => (selectedWedding.value ? countdown(selectedWedding.value.weddingDate) : 0))
const weddingTasks = computed(() => (tasks.data.value || []).filter((t) => t.weddingId === selectedId.value))

function tasksOf(status: TaskStatus): FollowTask[] {
  return weddingTasks.value.filter((t) => t.status === status)
}

async function cycle(t: FollowTask) {
  const next = NEXT_STATUS[t.status]
  await followupApi.updateTask(t.id, next)
  await tasks.run()
}
</script>

<template>
  <div class="stagger">
    <PageHeader title="客户跟进" subtitle="按婚礼倒计时任务清单">
      <template #actions>
        <select v-model="selectedId" class="field-input h-10 w-64 text-sm">
          <option v-for="w in weddingsWithTasks" :key="w.id" :value="w.id">
            {{ w.coupleName }} · {{ formatDate(w.weddingDate) }}
          </option>
        </select>
      </template>
    </PageHeader>

    <BaseCard class="mb-5">
      <div class="flex flex-col sm:flex-row sm:items-center gap-4">
        <div class="w-12 h-12 rounded-xl bg-wine-grad text-gold-300 flex items-center justify-center shrink-0">
          <CalendarClock :size="22" />
        </div>
        <div class="flex-1">
          <p class="text-xs text-wine-400">距离婚礼还有</p>
          <p class="font-display font-semibold text-wine-800 leading-none mt-1">
            <template v-if="days < 0">
              <span class="text-2xl text-wine-400">已举行</span>
            </template>
            <template v-else>
              <span class="text-5xl num text-wine-700">{{ days }}</span>
              <span class="text-lg text-gold-500 ml-1">天</span>
            </template>
          </p>
          <p class="text-sm text-wine-500 mt-2">
            {{ selectedWedding?.coupleName }} · {{ formatDate(selectedWedding?.weddingDate ?? '') }}
          </p>
        </div>
        <div class="hidden sm:flex gap-6">
          <div class="text-center">
            <p class="num font-display text-2xl text-wine-700">{{ tasksOf('TODO').length }}</p>
            <p class="text-xs text-wine-300 mt-0.5">待办</p>
          </div>
          <div class="text-center">
            <p class="num font-display text-2xl text-amber-600">{{ tasksOf('DOING').length }}</p>
            <p class="text-xs text-wine-300 mt-0.5">进行中</p>
          </div>
          <div class="text-center">
            <p class="num font-display text-2xl text-emerald-600">{{ tasksOf('DONE').length }}</p>
            <p class="text-xs text-wine-300 mt-0.5">已完成</p>
          </div>
        </div>
      </div>
    </BaseCard>

    <div v-if="tasks.loading.value" class="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div v-for="i in 3" :key="i" class="card p-4"><Skeleton :rows="4" /></div>
    </div>
    <EmptyState v-else-if="!weddingTasks.length" text="该婚礼暂无跟进任务" />
    <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div v-for="col in COLUMNS" :key="col" class="card p-4">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <component :is="TASK_ICON[col]" :size="15" class="text-wine-400" />
            <span class="chip" :class="TASK_STYLE[col]">{{ TASK_LABELS[col] }}</span>
          </div>
          <span class="num text-xs text-wine-300">{{ tasksOf(col).length }}</span>
        </div>
        <div class="space-y-2.5">
          <div
            v-for="t in tasksOf(col)"
            :key="t.id"
            class="p-3 rounded-xl border border-wine-50 hover:border-gold-200 hover:bg-cream/60 transition cursor-pointer"
            @click="cycle(t)"
          >
            <p class="text-sm font-medium text-wine-800">{{ t.title }}</p>
            <div class="mt-2 flex items-center justify-between text-xs">
              <span class="text-wine-400 num">{{ formatDate(t.dueDate) }}</span>
              <span class="text-wine-500">{{ t.owner }}</span>
            </div>
          </div>
          <p v-if="!tasksOf(col).length" class="text-xs text-wine-300 py-6 text-center">暂无任务</p>
        </div>
      </div>
    </div>
    <p class="text-center text-xs text-wine-300 mt-4">点击任务卡片可循环切换状态（待办 → 进行中 → 已完成）</p>
  </div>
</template>
