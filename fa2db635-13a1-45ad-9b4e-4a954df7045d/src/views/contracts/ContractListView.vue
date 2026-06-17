<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { contractApi } from '@/api'
import { useAsync } from '@/composables/useAsync'
import { yuan, formatDate } from '@/utils/format'
import { CONTRACT_LABELS } from '@/constants'
import type { Contract, ContractStatus } from '@/types'
import PageHeader from '@/components/ui/PageHeader.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import { ArrowRight, FileSignature } from 'lucide-vue-next'

const router = useRouter()

const CONTRACT_BADGE: Record<ContractStatus, string> = {
  DRAFT: 'wine',
  PENDING: 'amber',
  SIGNED: 'green',
  VOID: 'gray',
}
const CONTRACT_PROGRESS: Record<ContractStatus, number> = {
  DRAFT: 30,
  PENDING: 65,
  SIGNED: 100,
  VOID: 0,
}
const STATUS_ORDER: ContractStatus[] = ['DRAFT', 'PENDING', 'SIGNED', 'VOID']

const status = ref<string>('')

const list = useAsync(() => contractApi.list({ status: status.value || undefined }), [] as Contract[])

watch(status, () => list.run())

function go(id: number) {
  router.push(`/contracts/${id}`)
}
</script>

<template>
  <div class="stagger">
    <PageHeader title="合同管理" subtitle="合同草稿、签署与归档">
      <template #actions>
        <div class="flex gap-1.5 overflow-x-auto">
          <button
            class="chip h-9 px-3 text-xs whitespace-nowrap transition"
            :class="status === '' ? 'bg-wine-600 text-white' : 'bg-wine-50 text-wine-500 hover:bg-wine-100'"
            @click="status = ''"
          >
            全部
          </button>
          <button
            v-for="s in STATUS_ORDER"
            :key="s"
            class="chip h-9 px-3 text-xs whitespace-nowrap transition"
            :class="status === s ? 'bg-wine-600 text-white' : 'bg-wine-50 text-wine-500 hover:bg-wine-100'"
            @click="status = s"
          >
            {{ CONTRACT_LABELS[s] }}
          </button>
        </div>
      </template>
    </PageHeader>

    <div v-if="list.loading.value" class="space-y-3">
      <div v-for="i in 5" :key="i" class="card p-5"><Skeleton :rows="2" /></div>
    </div>
    <EmptyState v-else-if="!list.data.value.length" text="暂无合同记录" />
    <div v-else class="space-y-3">
      <div
        v-for="c in list.data.value"
        :key="c.id"
        class="card p-4 sm:p-5 hover:shadow-lift transition cursor-pointer"
        @click="go(c.id)"
      >
        <div class="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div class="w-10 h-10 rounded-xl bg-wine-50 text-wine-600 flex items-center justify-center shrink-0">
            <FileSignature :size="18" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="font-medium text-wine-800 truncate">{{ c.coupleName }}</p>
              <StatusBadge :text="CONTRACT_LABELS[c.status]" :type="CONTRACT_BADGE[c.status]" />
            </div>
            <p class="text-xs text-wine-300 mt-0.5 truncate">{{ c.packageName }} · {{ c.clauses.length }} 条条款</p>
          </div>
          <div class="sm:w-48">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs text-wine-400">签署进度</span>
              <span class="text-xs text-wine-500">{{ c.signedAt ? formatDate(c.signedAt) : '待签署' }}</span>
            </div>
            <ProgressBar :value="CONTRACT_PROGRESS[c.status]" showLabel />
          </div>
          <div class="text-right sm:w-28">
            <p class="text-xs text-wine-300">合同金额</p>
            <p class="num font-semibold text-wine-700">{{ yuan(c.amount) }}</p>
          </div>
          <ArrowRight :size="15" class="text-wine-300 hidden sm:block" />
        </div>
      </div>
    </div>
  </div>
</template>
