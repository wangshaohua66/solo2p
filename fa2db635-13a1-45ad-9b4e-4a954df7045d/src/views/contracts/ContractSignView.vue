<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { contractApi, exportApi } from '@/api'
import { useAsync } from '@/composables/useAsync'
import { yuan, formatDate, formatDateTime } from '@/utils/format'
import { CONTRACT_LABELS } from '@/constants'
import type { Contract, ContractStatus, ContractClause } from '@/types'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { FileSignature, Plus, X, Trash2, AlertTriangle, Download, ExternalLink, RefreshCw } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

const CONTRACT_BADGE: Record<ContractStatus, string> = {
  DRAFT: 'wine',
  PENDING: 'amber',
  SIGNED: 'green',
  VOID: 'gray',
}

const id = Number(route.params.id)
const contract = useAsync(() => contractApi.detail(id), {} as Contract)

const showAddon = ref(false)
const signature = ref('')
const signing = ref(false)
const voiding = ref(false)
const saving = ref(false)
const checking = ref(false)
const exporting = ref(false)
const signUrl = ref('')
const addonForm = ref<{ title: string; body: string }>({ title: '', body: '' })

const canEdit = computed(() => contract.data.value.status === 'DRAFT' || contract.data.value.status === 'PENDING')
const canSign = computed(() => (contract.data.value.status === 'DRAFT' || contract.data.value.status === 'PENDING') && signature.value.trim())

function openAddon() {
  addonForm.value = { title: '', body: '' }
  showAddon.value = true
}

async function saveAddon() {
  if (!addonForm.value.title.trim() || !addonForm.value.body.trim()) return
  saving.value = true
  try {
    const newClause: ContractClause = {
      id: 'addon-' + Date.now(),
      title: addonForm.value.title,
      body: addonForm.value.body,
      isAddon: true,
    }
    const clauses = [...(contract.data.value.clauses || []), newClause]
    const updated = await contractApi.update(id, { clauses })
    contract.data.value = updated
    showAddon.value = false
  } finally {
    saving.value = false
  }
}

async function removeClause(cid: string) {
  const clauses = (contract.data.value.clauses || []).filter((c) => c.id !== cid)
  const updated = await contractApi.update(id, { clauses })
  contract.data.value = updated
}

async function signContract() {
  if (!canSign.value) return
  signing.value = true
  try {
    const updated = await contractApi.sign(id, { signature: signature.value.trim() })
    contract.data.value = updated
    signUrl.value = updated.signUrl || ''
  } finally {
    signing.value = false
  }
}

async function checkSignStatus() {
  checking.value = true
  try {
    const res = await contractApi.querySignStatus(id, contract.data.value.flowId || '')
    if (res.status === 'SIGNED') {
      const updated = await contractApi.detail(id)
      contract.data.value = updated
    }
    if (res.signUrl) signUrl.value = res.signUrl
  } finally {
    checking.value = false
  }
}

async function exportPdf() {
  exporting.value = true
  try {
    await exportApi.contractPdf(id)
  } finally {
    exporting.value = false
  }
}

async function voidContract() {
  if (!confirm('确认作废该合同？此操作不可撤销。')) return
  voiding.value = true
  try {
    const updated = await contractApi.void(id)
    contract.data.value = updated
  } finally {
    voiding.value = false
  }
}
</script>

<template>
  <div class="stagger">
    <PageHeader title="合同签署" :subtitle="contract.loading.value ? '' : `合同编号：HT-${String(id).padStart(6, '0')}`">
      <template #actions>
        <button
          class="btn-ghost h-10 px-4 text-sm"
          :disabled="exporting || contract.loading.value"
          @click="exportPdf"
        >
          <Download :size="15" />
          {{ exporting ? '导出中…' : '导出PDF' }}
        </button>
        <button
          class="btn-ghost h-10 px-4 text-sm"
          :disabled="voiding || contract.data.value.status === 'VOID'"
          @click="voidContract"
        >
          <AlertTriangle :size="15" />
          {{ voiding ? '作废中…' : '作废合同' }}
        </button>
      </template>
    </PageHeader>

    <div v-if="contract.loading.value" class="grid grid-cols-1 lg:grid-cols-5 gap-5">
      <div class="lg:col-span-3"><div class="card p-5"><Skeleton :rows="12" /></div></div>
      <div class="lg:col-span-2"><div class="card p-5"><Skeleton :rows="8" /></div></div>
    </div>

    <template v-else>
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div class="lg:col-span-3">
          <div class="card p-6 sm:p-8">
            <header class="text-center pb-6 border-b border-wine-100">
              <h1 class="font-serif text-3xl text-wine-800 font-semibold">婚礼服务合同</h1>
              <div class="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm text-wine-400">
                <span>合同编号：HT-{{ String(contract.data.value.id).padStart(6, '0') }}</span>
                <span>新人：{{ contract.data.value.coupleName }}</span>
                <span class="num">金额：{{ yuan(contract.data.value.amount) }}</span>
              </div>
            </header>

            <div class="mt-6 space-y-5">
              <div
                v-for="(cl, idx) in contract.data.value.clauses"
                :key="cl.id"
                class="relative"
                :class="cl.isAddon ? 'pl-4 border-l-2 border-gold-400' : ''"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-medium text-wine-400">第 {{ idx + 1 }} 条{{ cl.isAddon ? ' · 附加协议' : '' }}</p>
                    <h3 class="mt-1 font-serif text-wine-800 font-semibold">{{ cl.title }}</h3>
                    <p class="mt-2 text-sm text-wine-600 leading-relaxed font-serif whitespace-pre-wrap">{{ cl.body }}</p>
                  </div>
                  <button
                    v-if="canEdit"
                    class="shrink-0 w-7 h-7 rounded-lg bg-wine-50 text-wine-400 hover:bg-rose-50 hover:text-rose-500 flex items-center justify-center transition"
                    @click="removeClause(cl.id)"
                  >
                    <X :size="14" />
                  </button>
                </div>
              </div>
              <p v-if="!contract.data.value.clauses?.length" class="text-center py-10 text-wine-300 text-sm">暂无条款</p>
            </div>

            <div
              v-if="contract.data.value.status === 'SIGNED'"
              class="mt-8 pt-6 border-t border-wine-100 flex items-center justify-between"
            >
              <div>
                <p class="text-xs text-wine-400">签署时间</p>
                <p class="num text-sm text-wine-600">{{ formatDateTime(contract.data.value.signedAt || '') }}</p>
              </div>
              <div class="relative">
                <div class="w-28 h-28 rounded-full border-4 border-gold-400/60 flex items-center justify-center bg-gold-50/50 rotate-[-8deg]">
                  <span class="font-display text-gold-600 text-xl font-semibold transform rotate-8">已签署</span>
                </div>
                <p class="absolute -bottom-1 left-0 right-0 text-center text-xs text-wine-400 font-serif">
                  {{ contract.data.value.signature }}
                </p>
              </div>
            </div>

            <div v-else-if="contract.data.value.status === 'VOID'" class="mt-8 pt-6 border-t border-wine-100 text-center">
              <span class="chip bg-gray-100 text-gray-500 text-sm px-4 py-1.5">本合同已作废</span>
            </div>
          </div>
        </div>

        <div class="lg:col-span-2 space-y-5">
          <BaseCard title="合同状态">
            <div class="flex items-center gap-3">
              <div class="w-11 h-11 rounded-xl bg-wine-50 text-wine-600 flex items-center justify-center">
                <FileSignature :size="20" />
              </div>
              <div>
                <StatusBadge
                  :text="CONTRACT_LABELS[contract.data.value.status]"
                  :type="CONTRACT_BADGE[contract.data.value.status]"
                />
                <p class="text-xs text-wine-300 mt-1">套餐：{{ contract.data.value.packageName }}</p>
              </div>
            </div>
          </BaseCard>

          <BaseCard title="条款编辑" subtitle="可插入附加协议条款">
            <button
              class="btn-soft w-full mb-3"
              :disabled="!canEdit"
              @click="openAddon"
            >
              <Plus :size="16" />
              插入附加协议
            </button>
            <div class="space-y-1.5">
              <div
                v-for="(cl, idx) in contract.data.value.clauses"
                :key="cl.id"
                class="flex items-center gap-2 text-sm p-2 rounded-lg hover:bg-wine-50 transition"
              >
                <span class="num text-xs text-wine-300 w-6">{{ idx + 1 }}</span>
                <span class="flex-1 min-w-0 truncate text-wine-700">{{ cl.title }}</span>
                <span v-if="cl.isAddon" class="chip bg-gold-50 text-gold-700">附加</span>
              </div>
              <p v-if="!contract.data.value.clauses?.length" class="text-center py-4 text-wine-300 text-xs">暂无条款</p>
            </div>
          </BaseCard>

          <BaseCard title="电子签名" subtitle="通过第三方电子签约平台完成签署">
            <div v-if="contract.data.value.status === 'SIGNED'" class="py-3 text-center">
              <p class="text-sm text-emerald-600 font-medium">{{ contract.data.value.signature }}</p>
              <p class="text-xs text-wine-300 mt-1">{{ formatDate(contract.data.value.signedAt || '') }} 已签署</p>
              <button class="btn-soft w-full mt-3 text-sm" @click="exportPdf">
                <Download :size="15" /> 下载签署文件
              </button>
            </div>
            <div v-else-if="contract.data.value.status === 'VOID'" class="py-3 text-center text-wine-300 text-sm">
              合同已作废，无法签署
            </div>
            <template v-else>
              <input
                v-model="signature"
                class="field-input font-serif text-lg text-center"
                placeholder="请输入签署人姓名"
              />
              <button
                class="btn-primary w-full mt-3"
                :disabled="!canSign || signing"
                @click="signContract"
              >
                <FileSignature :size="16" />
                {{ signing ? '发起中…' : '发起电子签署' }}
              </button>
              <template v-if="signUrl">
                <div class="mt-3 p-3 rounded-lg bg-gold-50 border border-gold-200">
                  <p class="text-xs text-gold-700 mb-2">签署链接已生成，请在新页面完成签署：</p>
                  <a :href="signUrl" target="_blank" rel="noopener" class="btn-soft w-full text-sm">
                    <ExternalLink :size="15" /> 前往签署
                  </a>
                </div>
                <button
                  class="btn-ghost w-full mt-2 text-sm"
                  :disabled="checking"
                  @click="checkSignStatus"
                >
                  <RefreshCw :size="15" />
                  {{ checking ? '查询中…' : '查询签署状态' }}
                </button>
              </template>
            </template>
          </BaseCard>
        </div>
      </div>
    </template>

    <BaseModal :show="showAddon" title="插入附加协议" width="480px" @close="showAddon = false">
      <div class="space-y-4">
        <div>
          <label class="field-label">条款标题</label>
          <input v-model="addonForm.title" class="field-input" placeholder="例如：摄影服务补充协议" />
        </div>
        <div>
          <label class="field-label">条款正文</label>
          <textarea v-model="addonForm.body" rows="5" class="field-input" placeholder="请输入条款详细内容…" />
        </div>
      </div>
      <template #footer>
        <button class="btn-ghost h-10 px-4 text-sm" @click="showAddon = false">取消</button>
        <button
          class="btn-primary h-10 px-4 text-sm"
          :disabled="saving || !addonForm.title.trim() || !addonForm.body.trim()"
          @click="saveAddon"
        >
          <Plus :size="16" />
          {{ saving ? '保存中…' : '确认插入' }}
        </button>
      </template>
    </BaseModal>
  </div>
</template>
