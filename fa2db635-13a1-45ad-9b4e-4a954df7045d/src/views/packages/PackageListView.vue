<script setup lang="ts">
import { ref, computed } from 'vue'
import { packageApi } from '@/api'
import { useAsync } from '@/composables/useAsync'
import { yuan } from '@/utils/format'
import { calcPackageMargin, summarizePackage } from '@/utils/pricing'
import type { Package, PackageItem } from '@/types'
import PageHeader from '@/components/ui/PageHeader.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { Plus, Sparkles, Check } from 'lucide-vue-next'

const list = useAsync(() => packageApi.list(), [] as Package[])

const show = ref(false)
const editing = ref<Package | null>(null)
const saving = ref(false)

const margin = computed(() => (editing.value ? calcPackageMargin(editing.value).margin : 0))
const serviceItems = computed<PackageItem[]>(() => editing.value?.items.filter((i) => i.type === 'SERVICE') ?? [])
const costItems = computed<PackageItem[]>(() => editing.value?.items.filter((i) => i.type === 'COST') ?? [])

function marginOf(pkg: Package): number {
  return calcPackageMargin(pkg).margin
}

function serviceCount(pkg: Package): number {
  return summarizePackage(pkg).services.length
}

function openEdit(pkg: Package) {
  editing.value = JSON.parse(JSON.stringify(pkg))
  show.value = true
}

function openCreate() {
  editing.value = { id: 0, name: '', basePrice: 0, description: '', items: [] }
  show.value = true
}

async function save() {
  if (!editing.value) return
  saving.value = true
  try {
    await packageApi.save(editing.value)
    show.value = false
    await list.run()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="stagger">
    <PageHeader title="套餐模板" subtitle="标准化套餐与利润核算">
      <template #actions>
        <button class="btn-primary h-10 px-4 text-sm" @click="openCreate">
          <Plus :size="16" /> 新建套餐
        </button>
      </template>
    </PageHeader>

    <div v-if="list.loading.value" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
      <div v-for="i in 6" :key="i" class="card p-5"><Skeleton :rows="4" /></div>
    </div>
    <EmptyState v-else-if="!list.data.value.length" text="暂无套餐模板" />
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
      <div
        v-for="pkg in list.data.value"
        :key="pkg.id"
        class="card p-5 cursor-pointer hover:shadow-lift transition"
        @click="openEdit(pkg)"
      >
        <div class="flex items-start justify-between">
          <div class="w-10 h-10 rounded-xl bg-gold-grad flex items-center justify-center text-wine-800">
            <Sparkles :size="18" />
          </div>
          <span
            class="chip"
            :class="marginOf(pkg) >= 30 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-700'"
          >
            利润率 {{ marginOf(pkg) }}%
          </span>
        </div>
        <h3 class="mt-3 font-serif text-lg text-wine-800 font-semibold">{{ pkg.name }}</h3>
        <p class="mt-1 text-xs text-wine-400 min-h-[2.4em]">{{ pkg.description }}</p>
        <div class="mt-4 pt-4 border-t border-wine-50 flex items-center justify-between">
          <div>
            <p class="text-xs text-wine-300">基础报价</p>
            <p class="num font-semibold text-wine-700">{{ yuan(pkg.basePrice) }}</p>
          </div>
          <div class="text-right">
            <p class="text-xs text-wine-300">服务项</p>
            <p class="num font-medium text-wine-600">{{ serviceCount(pkg) }} 项</p>
          </div>
        </div>
      </div>
    </div>

    <BaseModal :show="show" :title="editing?.id ? '编辑套餐' : '新建套餐'" width="640px" @close="show = false">
      <template v-if="editing">
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="field-label">套餐名称</label>
              <input v-model="editing.name" class="field-input" placeholder="请输入套餐名称" />
            </div>
            <div>
              <label class="field-label">基础报价（元）</label>
              <input v-model.number="editing.basePrice" type="number" class="field-input" placeholder="0" />
            </div>
          </div>
          <div>
            <label class="field-label">套餐描述</label>
            <textarea v-model="editing.description" rows="2" class="field-input" placeholder="套餐说明"></textarea>
          </div>
          <div class="flex items-center justify-between rounded-xl bg-wine-50/60 px-4 py-3">
            <div>
              <p class="text-xs text-wine-400">当前利润率</p>
              <p class="num text-lg font-semibold" :class="margin >= 30 ? 'text-emerald-600' : 'text-amber-600'">
                {{ margin }}%
              </p>
            </div>
            <div class="text-right">
              <p class="text-xs text-wine-400">基础报价</p>
              <p class="num text-lg font-semibold text-wine-700">{{ yuan(editing.basePrice) }}</p>
            </div>
          </div>
          <div>
            <div class="flex items-center justify-between mb-2">
              <p class="text-xs font-medium text-wine-600">服务项（SERVICE）</p>
              <span class="text-xs text-wine-300">{{ serviceItems.length }} 项</span>
            </div>
            <div class="space-y-2">
              <label
                v-for="it in serviceItems"
                :key="it.id"
                class="flex items-center gap-3 p-3 rounded-xl border border-wine-50 hover:bg-cream/60 transition"
              >
                <input v-model="it.included" type="checkbox" class="w-4 h-4 accent-wine-600" />
                <div class="flex-1 min-w-0">
                  <p class="text-sm text-wine-800 truncate">{{ it.name }}</p>
                  <p class="text-xs text-wine-300">成本 {{ yuan(it.cost) }} · 售价 {{ yuan(it.price) }}</p>
                </div>
              </label>
              <p v-if="!serviceItems.length" class="text-xs text-wine-300 py-4 text-center">暂无服务项</p>
            </div>
          </div>
          <div>
            <p class="text-xs font-medium text-wine-600 mb-2">成本项（COST）</p>
            <div class="space-y-2">
              <label
                v-for="it in costItems"
                :key="it.id"
                class="flex items-center gap-3 p-3 rounded-xl border border-wine-50 hover:bg-cream/60 transition"
              >
                <input v-model="it.included" type="checkbox" class="w-4 h-4 accent-wine-600" />
                <div class="flex-1 min-w-0">
                  <p class="text-sm text-wine-800 truncate">{{ it.name }}</p>
                  <p class="text-xs text-wine-300">成本 {{ yuan(it.cost) }}</p>
                </div>
              </label>
              <p v-if="!costItems.length" class="text-xs text-wine-300 py-4 text-center">暂无成本项</p>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <button class="btn-ghost h-10 px-4 text-sm" @click="show = false">取消</button>
        <button class="btn-primary h-10 px-4 text-sm" :disabled="saving || !editing?.name" @click="save">
          <Check :size="16" /> {{ saving ? '保存中…' : '保存' }}
        </button>
      </template>
    </BaseModal>
  </div>
</template>
