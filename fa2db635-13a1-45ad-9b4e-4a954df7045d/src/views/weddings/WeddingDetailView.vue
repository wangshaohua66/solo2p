<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { weddingApi, followupApi, financeApi, contractApi } from '@/api'
import { useAsync } from '@/composables/useAsync'
import { yuan, formatDate, countdown } from '@/utils/format'
import { STAGE_LABELS, STAGE_ORDER, STAGE_STYLE, TASK_LABELS, TASK_STYLE } from '@/constants'
import type { Wedding, WeddingStage, FollowTask, FinanceDetail, Contract } from '@/types'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { Calendar, Heart, Users, MapPin, User, ChevronRight, FileText, Wallet, MessageSquare, Clock, ArrowRight, CheckCircle2 } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

const STAGE_BADGE: Record<WeddingStage, string> = {
  CONSULT: 'wine',
  DESIGN: 'gold',
  CONTRACT: 'blue',
  PREPARE: 'purple',
  ONSITE: 'amber',
  DELIVERY: 'green',
}

const id = Number(route.params.id)
type TabKey = 'schedule' | 'quote' | 'contract' | 'followup' | 'finance'

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'schedule', label: '档期', icon: Calendar },
  { key: 'quote', label: '报价', icon: Wallet },
  { key: 'contract', label: '合同', icon: FileText },
  { key: 'followup', label: '跟进', icon: MessageSquare },
  { key: 'finance', label: '财务', icon: Wallet },
]

const wedding = useAsync(() => weddingApi.detail(id), {} as Wedding)
const followup = useAsync(
  () => followupApi.detail(id),
  { wedding: undefined, countdown: 0, tasks: [] as FollowTask[] },
)
const finance = useAsync(() => financeApi.wedding(id), {} as FinanceDetail)
const contracts = useAsync(() => contractApi.list({}), [] as Contract[])

const tab = ref<TabKey>('schedule')
const advancing = ref(false)

const allLoading = computed(
  () => wedding.loading.value || followup.loading.value || finance.loading.value,
)

const stageIndex = computed(() => STAGE_ORDER.indexOf(wedding.data.value.stage))
const nextStage = computed<WeddingStage | null>(() => {
  if (stageIndex.value < 0 || stageIndex.value >= STAGE_ORDER.length - 1) return null
  return STAGE_ORDER[stageIndex.value + 1]
})
const canAdvance = computed(() => nextStage.value !== null && wedding.data.value.stage !== 'DELIVERY')

const recentTasks = computed(() => (followup.data.value.tasks || []).slice(0, 3))
const relatedContract = computed(() =>
  contracts.data.value.find((c) => c.weddingId === id),
)

async function advanceStage() {
  if (!canAdvance.value || !nextStage.value) return
  advancing.value = true
  try {
    const updated = await weddingApi.updateStage(id, nextStage.value)
    wedding.data.value = updated
  } finally {
    advancing.value = false
  }
}
</script>

<template>
  <div class="stagger">
    <PageHeader :title="wedding.loading.value ? '婚礼详情' : wedding.data.value.coupleName" subtitle="婚礼项目全流程管理" />

    <Skeleton v-if="allLoading" :rows="10" />

    <template v-else>
      <div class="card p-5 sm:p-6 mb-5">
        <div class="flex flex-col lg:flex-row lg:items-center gap-5">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <Heart :size="18" class="text-wine-500" />
              <h2 class="font-display text-2xl sm:text-3xl font-semibold text-wine-800 truncate">
                {{ wedding.data.value.coupleName }}
              </h2>
            </div>
            <p class="text-sm text-wine-400">
              新娘 {{ wedding.data.value.brideName || '-' }} · 新郎 {{ wedding.data.value.groomName || '-' }}
            </p>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm flex-1">
            <div class="flex items-center gap-2">
              <Calendar :size="16" class="text-gold-500" />
              <div>
                <p class="text-xs text-wine-300">婚期</p>
                <p class="num text-wine-700">{{ formatDate(wedding.data.value.weddingDate) }}</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <Users :size="16" class="text-gold-500" />
              <div>
                <p class="text-xs text-wine-300">桌数</p>
                <p class="num text-wine-700">{{ wedding.data.value.guests }} 桌</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <MapPin :size="16" class="text-gold-500" />
              <div>
                <p class="text-xs text-wine-300">门店</p>
                <p class="text-wine-700 truncate">{{ wedding.data.value.storeName || '-' }}</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <User :size="16" class="text-gold-500" />
              <div>
                <p class="text-xs text-wine-300">策划师</p>
                <p class="text-wine-700 truncate">{{ wedding.data.value.plannerName || '-' }}</p>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <div class="text-center">
              <p class="text-xs text-wine-300">倒计时</p>
              <p
                class="font-display text-3xl font-semibold num"
                :class="countdown(wedding.data.value.weddingDate) <= 7 ? 'text-rose-500' : 'text-wine-800'"
              >
                {{ countdown(wedding.data.value.weddingDate) }}
                <span class="text-sm font-sans text-wine-400 ml-1">天</span>
              </p>
            </div>
            <StatusBadge :text="STAGE_LABELS[wedding.data.value.stage]" :type="STAGE_BADGE[wedding.data.value.stage]" />
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div class="lg:col-span-2">
          <BaseCard title="执行阶段" subtitle="婚礼全流程进度">
            <div class="relative">
              <div class="absolute left-[15px] top-2 bottom-2 w-px bg-wine-100"></div>
              <div class="space-y-4">
                <div
                  v-for="(s, idx) in STAGE_ORDER"
                  :key="s"
                  class="flex items-start gap-3 relative"
                >
                  <div
                    class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 relative z-10"
                    :class="
                      idx < stageIndex
                        ? 'bg-wine-200 text-white'
                        : idx === stageIndex
                        ? 'bg-wine-grad text-white shadow-soft'
                        : 'bg-wine-50 text-wine-300'
                    "
                  >
                    <CheckCircle2 v-if="idx < stageIndex" :size="16" />
                    <span v-else class="num text-xs">{{ idx + 1 }}</span>
                  </div>
                  <div class="flex-1 pt-1">
                    <p
                      class="text-sm font-medium"
                      :class="
                        idx <= stageIndex ? 'text-wine-800' : 'text-wine-300'
                      "
                    >
                      {{ STAGE_LABELS[s] }}
                    </p>
                    <p
                      v-if="idx === stageIndex"
                      class="text-xs mt-0.5"
                      :class="STAGE_STYLE[s]"
                    >
                      当前阶段
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <button
              class="btn-soft w-full mt-5"
              :disabled="!canAdvance || advancing"
              @click="advanceStage"
            >
              <ChevronRight :size="16" />
              {{ advancing ? '推进中…' : canAdvance ? `推进到「${STAGE_LABELS[nextStage!]}」` : '已完成全部阶段' }}
            </button>
          </BaseCard>
        </div>

        <div class="lg:col-span-3">
          <BaseCard :padding="false">
            <div class="flex gap-1 p-2 border-b border-wine-100 overflow-x-auto">
              <button
                v-for="t in TABS"
                :key="t.key"
                class="flex items-center gap-1.5 h-9 px-3 rounded-[10px] text-sm whitespace-nowrap transition"
                :class="tab === t.key ? 'bg-wine-600 text-white font-medium' : 'text-wine-500 hover:bg-wine-50'"
                @click="tab = t.key"
              >
                <component :is="t.icon" :size="14" />
                {{ t.label }}
              </button>
            </div>
            <div class="p-5">
              <template v-if="tab === 'schedule'">
                <div v-if="followup.data.value.tasks?.length" class="space-y-2">
                  <div
                    v-for="tk in followup.data.value.tasks.slice(0, 5)"
                    :key="tk.id"
                    class="flex items-center gap-3 p-3 rounded-xl border border-wine-50"
                  >
                    <Clock :size="16" class="text-gold-500 shrink-0" />
                    <div class="flex-1 min-w-0">
                      <p class="text-sm text-wine-800 truncate">{{ tk.title }}</p>
                      <p class="text-xs text-wine-300 mt-0.5">负责人 {{ tk.owner }} · 婚期前 {{ tk.daysBefore }} 天</p>
                    </div>
                    <span class="chip" :class="TASK_STYLE[tk.status]">{{ TASK_LABELS[tk.status] }}</span>
                  </div>
                </div>
                <div v-else class="text-center py-10 text-wine-300 text-sm">暂无档期任务</div>
              </template>

              <template v-else-if="tab === 'quote'">
                <div class="rounded-xl bg-wine-50/50 p-5 text-center">
                  <p class="text-xs text-wine-400">婚礼报价</p>
                  <p class="font-display text-4xl font-semibold text-wine-800 num mt-2">
                    {{ yuan(wedding.data.value.quoteTotal ?? 0) }}
                  </p>
                  <p class="text-xs text-wine-300 mt-2">套餐：{{ wedding.data.value.packageName || '-' }}</p>
                </div>
                <div class="mt-4 grid grid-cols-2 gap-3">
                  <div class="rounded-xl border border-wine-50 p-4">
                    <p class="text-xs text-wine-400">桌数</p>
                    <p class="num text-xl text-wine-700 mt-1">{{ wedding.data.value.guests }} 桌</p>
                  </div>
                  <div class="rounded-xl border border-wine-50 p-4">
                    <p class="text-xs text-wine-400">阶段</p>
                    <p class="text-wine-700 mt-1">{{ STAGE_LABELS[wedding.data.value.stage] }}</p>
                  </div>
                </div>
              </template>

              <template v-else-if="tab === 'contract'">
                <div v-if="relatedContract" class="rounded-xl border border-wine-50 p-4 hover:bg-cream/60 transition cursor-pointer" @click="router.push(`/contracts/${relatedContract.id}`)">
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="font-medium text-wine-800">HT-{{ String(relatedContract.id).padStart(6, '0') }}</p>
                      <p class="text-xs text-wine-300 mt-0.5">{{ relatedContract.packageName }} · {{ relatedContract.clauses.length }} 条条款</p>
                    </div>
                    <div class="text-right">
                      <p class="num font-semibold text-wine-700">{{ yuan(relatedContract.amount) }}</p>
                      <button class="btn-soft h-8 px-3 text-xs mt-2">
                        查看合同
                        <ArrowRight :size="13" />
                      </button>
                    </div>
                  </div>
                </div>
                <div v-else class="text-center py-10">
                  <p class="text-wine-300 text-sm">暂未生成合同</p>
                  <button class="btn-soft h-9 px-4 text-sm mt-3" @click="router.push('/pricing')">
                    前往报价生成合同
                  </button>
                </div>
              </template>

              <template v-else-if="tab === 'followup'">
                <div v-if="recentTasks.length" class="space-y-2">
                  <div
                    v-for="tk in recentTasks"
                    :key="tk.id"
                    class="flex items-center gap-3 p-3 rounded-xl border border-wine-50"
                  >
                    <MessageSquare :size="16" class="text-wine-400 shrink-0" />
                    <div class="flex-1 min-w-0">
                      <p class="text-sm text-wine-800 truncate">{{ tk.title }}</p>
                      <p class="text-xs text-wine-300 mt-0.5">{{ formatDate(tk.dueDate) }} · {{ tk.owner }}</p>
                    </div>
                    <span class="chip" :class="TASK_STYLE[tk.status]">{{ TASK_LABELS[tk.status] }}</span>
                  </div>
                </div>
                <div v-else class="text-center py-10 text-wine-300 text-sm">暂无跟进任务</div>
              </template>

              <template v-else-if="tab === 'finance'">
                <div class="grid grid-cols-2 gap-3">
                  <div class="rounded-xl bg-wine-50/50 p-4">
                    <p class="text-xs text-wine-400">合同收入</p>
                    <p class="num text-xl font-semibold text-wine-700 mt-1">{{ yuan(finance.data.value.income ?? 0) }}</p>
                  </div>
                  <div class="rounded-xl bg-emerald-50/50 p-4">
                    <p class="text-xs text-emerald-600">已收款</p>
                    <p class="num text-xl font-semibold text-emerald-700 mt-1">{{ yuan(finance.data.value.received ?? 0) }}</p>
                  </div>
                  <div class="rounded-xl bg-rose-50/50 p-4">
                    <p class="text-xs text-rose-500">总成本</p>
                    <p class="num text-xl font-semibold text-rose-600 mt-1">{{ yuan(finance.data.value.cost ?? 0) }}</p>
                  </div>
                  <div class="rounded-xl bg-gold-50/50 p-4">
                    <p class="text-xs text-gold-700">已付款</p>
                    <p class="num text-xl font-semibold text-gold-800 mt-1">{{ yuan(finance.data.value.paid ?? 0) }}</p>
                  </div>
                </div>
                <div class="mt-4 rounded-xl bg-wine-grad p-5 text-white text-center">
                  <p class="text-xs text-white/70">预计利润</p>
                  <p class="font-display text-3xl font-semibold num mt-1">{{ yuan(finance.data.value.profit ?? 0) }}</p>
                </div>
                <div v-if="finance.data.value.suppliers?.length" class="mt-4 space-y-2">
                  <p class="text-xs font-medium text-wine-500 mb-2">供应商结算</p>
                  <div
                    v-for="sp in finance.data.value.suppliers"
                    :key="sp.name"
                    class="flex items-center justify-between p-3 rounded-xl border border-wine-50 text-sm"
                  >
                    <span class="text-wine-700">{{ sp.name }}</span>
                    <span class="flex items-center gap-2">
                      <span class="num text-wine-600">{{ yuan(sp.amount) }}</span>
                      <span
                        class="chip"
                        :class="sp.settled ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-700'"
                      >
                        {{ sp.settled ? '已结' : '待结' }}
                      </span>
                    </span>
                  </div>
                </div>
              </template>
            </div>
          </BaseCard>
        </div>
      </div>
    </template>
  </div>
</template>
