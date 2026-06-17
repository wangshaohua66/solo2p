<script setup lang="ts">
import { computed, ref } from 'vue'
import { portalApi } from '@/api'
import { useAsync } from '@/composables/useAsync'
import { yuan, formatDate } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import { ROLE_LABELS } from '@/constants'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { CalendarDays, Briefcase, Upload, Link } from 'lucide-vue-next'
import type { SupplierOrder } from '@/types'

type TabKey = 'ALL' | 'PENDING' | 'CONFIRMED' | 'DONE'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'ALL', label: '全部' },
  { key: 'PENDING', label: '待确认' },
  { key: 'CONFIRMED', label: '已确认' },
  { key: 'DONE', label: '已完成' },
]

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'amber',
  CONFIRMED: 'blue',
  DONE: 'green',
}

const STATUS_TEXT: Record<string, string> = {
  PENDING: '待确认',
  CONFIRMED: '已确认',
  DONE: '已完成',
}

const auth = useAuthStore()
const tab = ref<TabKey>('ALL')
const orders = useAsync(() => portalApi.orders(auth.user?.id || 1), [] as SupplierOrder[])

const filteredOrders = computed(() => {
  const list = orders.data.value || []
  if (tab.value === 'ALL') return list
  return list.filter((o) => o.status === tab.value)
})

const showModal = ref(false)
const selectedOrder = ref<SupplierOrder | null>(null)
const fileUrl = ref('')
const submitting = ref(false)

function openVoucher(o: SupplierOrder) {
  selectedOrder.value = o
  fileUrl.value = o.voucherUrl || ''
  showModal.value = true
}

async function submitVoucher() {
  if (!selectedOrder.value || !fileUrl.value.trim()) return
  submitting.value = true
  try {
    await portalApi.submitVoucher(selectedOrder.value.id, { fileUrl: fileUrl.value.trim() })
    showModal.value = false
    await orders.run()
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="stagger">
    <PageHeader title="我的接单" subtitle="供应商订单与服务凭证管理" />

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

    <div v-if="orders.loading.value" class="space-y-4">
      <div v-for="i in 3" :key="i" class="card p-5"><Skeleton :rows="4" /></div>
    </div>
    <EmptyState v-else-if="!filteredOrders.length" text="暂无订单" />
    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <div v-for="o in filteredOrders" :key="o.id" class="card p-5 hover:shadow-lift transition">
        <div class="flex items-start justify-between mb-3">
          <div class="min-w-0">
            <p class="font-medium text-wine-800">{{ o.coupleName }}</p>
            <p class="text-xs text-wine-400 mt-0.5">{{ ROLE_LABELS[o.role] }}</p>
          </div>
          <StatusBadge :text="STATUS_TEXT[o.status] || o.status" :type="STATUS_BADGE[o.status]" />
        </div>
        <div class="space-y-2 text-sm">
          <div class="flex items-center gap-2 text-wine-500">
            <CalendarDays :size="14" />
            <span class="num">{{ formatDate(o.weddingDate) }}</span>
          </div>
          <div class="flex items-center gap-2 text-wine-500">
            <Briefcase :size="14" />
            <span class="truncate">{{ o.service }}</span>
          </div>
          <div class="flex items-center justify-between pt-2 border-t border-wine-50 mt-2">
            <span class="num font-semibold text-wine-700 text-lg">{{ yuan(o.amount) }}</span>
          </div>
        </div>
        <button
          v-if="o.status === 'CONFIRMED' || o.status === 'PENDING'"
          class="btn-soft w-full h-9 mt-4 text-sm text-wine-600"
          @click="openVoucher(o)"
        >
          <Upload :size="15" /> {{ o.voucherUrl ? '更新服务凭证' : '提交服务凭证' }}
        </button>
      </div>
    </div>

    <BaseModal :show="showModal" title="提交服务凭证" width="440px" @close="showModal = false">
      <div class="space-y-4">
        <div v-if="selectedOrder" class="p-3 rounded-xl bg-cream/60 border border-wine-100">
          <p class="font-medium text-wine-800 text-sm">{{ selectedOrder.coupleName }}</p>
          <p class="text-xs text-wine-400 mt-1">{{ formatDate(selectedOrder.weddingDate) }} · {{ selectedOrder.service }}</p>
        </div>
        <div>
          <label class="field-label">
            <Link :size="13" class="inline mr-1" />文件链接
          </label>
          <input v-model="fileUrl" class="field-input" placeholder="请输入凭证文件链接（如图片、PDF）" />
          <p class="text-xs text-wine-300 mt-1">支持上传至云盘后粘贴公开链接</p>
        </div>
      </div>
      <template #footer>
        <button class="btn-ghost h-10 px-4 text-sm" @click="showModal = false">取消</button>
        <button class="btn-primary h-10 px-4 text-sm" :disabled="submitting || !fileUrl.trim()" @click="submitVoucher">
          {{ submitting ? '提交中…' : '确认提交' }}
        </button>
      </template>
    </BaseModal>
  </div>
</template>
