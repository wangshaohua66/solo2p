<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { weddingApi, settingsApi } from '@/api'
import { useAsync } from '@/composables/useAsync'
import { yuan, formatDate, countdown } from '@/utils/format'
import { STAGE_LABELS, STAGE_ORDER } from '@/constants'
import type { Wedding, WeddingStage, Store } from '@/types'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import { Plus, Search, Table2, LayoutGrid, ArrowRight } from 'lucide-vue-next'

const router = useRouter()

const STAGE_BADGE: Record<WeddingStage, string> = {
  CONSULT: 'wine',
  DESIGN: 'gold',
  CONTRACT: 'blue',
  PREPARE: 'purple',
  ONSITE: 'amber',
  DELIVERY: 'green',
}

const stage = ref<string>('')
const storeId = ref<number | undefined>(undefined)
const keyword = ref('')
const view = ref<'table' | 'card'>('table')

const stores = useAsync(() => settingsApi.list().then((d) => d.stores as Store[]), [] as Store[])

const list = useAsync(
  () =>
    weddingApi.list({
      stage: stage.value || undefined,
      storeId: storeId.value,
      keyword: keyword.value.trim() || undefined,
    }),
  [] as Wedding[],
)

let timer: ReturnType<typeof setTimeout> | undefined
watch([stage, storeId, keyword], () => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => list.run(), 220)
})

function go(id: number) {
  router.push(`/weddings/${id}`)
}

function daysLeft(d: string): number {
  return countdown(d)
}
</script>

<template>
  <div class="stagger">
    <PageHeader title="婚礼项目" subtitle="全部门店婚礼项目进度总览">
      <template #actions>
        <button class="btn-primary h-10 px-4 text-sm" @click="router.push('/weddings/create')">
          <Plus :size="16" /> 创建婚礼
        </button>
      </template>
    </PageHeader>

    <BaseCard class="mb-5">
      <div class="flex flex-col lg:flex-row lg:items-center gap-3">
        <div class="flex gap-1.5 overflow-x-auto pb-1">
          <button
            class="chip h-8 px-3 text-xs whitespace-nowrap transition"
            :class="stage === '' ? 'bg-wine-600 text-white' : 'bg-wine-50 text-wine-500 hover:bg-wine-100'"
            @click="stage = ''"
          >
            全部
          </button>
          <button
            v-for="s in STAGE_ORDER"
            :key="s"
            class="chip h-8 px-3 text-xs whitespace-nowrap transition"
            :class="stage === s ? 'bg-wine-600 text-white' : 'bg-wine-50 text-wine-500 hover:bg-wine-100'"
            @click="stage = s"
          >
            {{ STAGE_LABELS[s] }}
          </button>
        </div>
        <div class="flex-1" />
        <select v-model="storeId" class="field-input h-9 w-auto text-sm">
          <option :value="undefined">全部门店</option>
          <option v-for="s in stores.data.value" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
        <div class="relative">
          <Search :size="15" class="absolute left-3 top-1/2 -translate-y-1/2 text-wine-300" />
          <input v-model="keyword" class="field-input h-9 pl-9 w-48" placeholder="搜索新人姓名" />
        </div>
        <div class="flex rounded-[10px] border border-wine-100 overflow-hidden">
          <button
            class="h-9 w-9 flex items-center justify-center transition"
            :class="view === 'table' ? 'bg-wine-600 text-white' : 'text-wine-400 hover:bg-wine-50'"
            @click="view = 'table'"
          >
            <Table2 :size="15" />
          </button>
          <button
            class="h-9 w-9 flex items-center justify-center transition"
            :class="view === 'card' ? 'bg-wine-600 text-white' : 'text-wine-400 hover:bg-wine-50'"
            @click="view = 'card'"
          >
            <LayoutGrid :size="15" />
          </button>
        </div>
      </div>
    </BaseCard>

    <BaseCard :padding="false">
      <div v-if="list.loading.value" class="p-5"><Skeleton :rows="6" /></div>
      <EmptyState v-else-if="!list.data.value.length" text="暂无符合条件的婚礼项目" />
      <template v-else>
        <table v-if="view === 'table'" class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs text-wine-400 border-b border-wine-100">
              <th class="px-5 py-3 font-medium">新人</th>
              <th class="px-3 py-3 font-medium">婚期</th>
              <th class="px-3 py-3 font-medium hidden md:table-cell">门店</th>
              <th class="px-3 py-3 font-medium hidden lg:table-cell">套餐</th>
              <th class="px-3 py-3 font-medium">阶段</th>
              <th class="px-3 py-3 font-medium w-36">进度</th>
              <th class="px-3 py-3 font-medium text-right">报价</th>
              <th class="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="w in list.data.value"
              :key="w.id"
              class="border-b border-wine-50 hover:bg-cream/60 transition cursor-pointer"
              @click="go(w.id)"
            >
              <td class="px-5 py-3">
                <p class="font-medium text-wine-800">{{ w.coupleName }}</p>
                <p class="text-xs text-wine-300">{{ w.guests }}桌</p>
              </td>
              <td class="px-3 py-3 num text-wine-600">
                {{ formatDate(w.weddingDate) }}
                <p
                  class="text-xs"
                  :class="daysLeft(w.weddingDate) < 0 ? 'text-wine-300' : daysLeft(w.weddingDate) <= 7 ? 'text-rose-500' : 'text-wine-300'"
                >
                  {{ daysLeft(w.weddingDate) < 0 ? '已举行' : `剩${daysLeft(w.weddingDate)}天` }}
                </p>
              </td>
              <td class="px-3 py-3 text-xs text-wine-400 hidden md:table-cell">{{ w.storeName }}</td>
              <td class="px-3 py-3 text-xs text-wine-500 hidden lg:table-cell">{{ w.packageName }}</td>
              <td class="px-3 py-3">
                <StatusBadge :text="STAGE_LABELS[w.stage]" :type="STAGE_BADGE[w.stage]" />
              </td>
              <td class="px-3 py-3"><ProgressBar :value="w.progress ?? 0" showLabel /></td>
              <td class="px-3 py-3 text-right num font-medium text-wine-700">{{ yuan(w.quoteTotal ?? 0) }}</td>
              <td class="px-5 py-3 text-right text-wine-300"><ArrowRight :size="15" /></td>
            </tr>
          </tbody>
        </table>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 p-5">
          <div
            v-for="w in list.data.value"
            :key="w.id"
            class="card p-4 hover:shadow-lift transition cursor-pointer"
            @click="go(w.id)"
          >
            <div class="flex items-start justify-between">
              <div>
                <p class="font-medium text-wine-800">{{ w.coupleName }}</p>
                <p class="text-xs text-wine-300 mt-0.5">{{ w.storeName }} · {{ w.packageName }}</p>
              </div>
              <StatusBadge :text="STAGE_LABELS[w.stage]" :type="STAGE_BADGE[w.stage]" />
            </div>
            <div class="mt-3 flex items-center justify-between text-xs">
              <span class="num text-wine-500">{{ formatDate(w.weddingDate) }}</span>
              <span :class="daysLeft(w.weddingDate) <= 7 ? 'text-rose-500' : 'text-wine-400'">
                {{ daysLeft(w.weddingDate) < 0 ? '已举行' : `剩${daysLeft(w.weddingDate)}天` }}
              </span>
            </div>
            <ProgressBar :value="w.progress ?? 0" showLabel class="mt-3" />
            <div class="mt-3 flex items-center justify-between">
              <span class="text-xs text-wine-300">{{ w.guests }}桌</span>
              <span class="num font-semibold text-wine-700">{{ yuan(w.quoteTotal ?? 0) }}</span>
            </div>
          </div>
        </div>
      </template>
    </BaseCard>
  </div>
</template>
