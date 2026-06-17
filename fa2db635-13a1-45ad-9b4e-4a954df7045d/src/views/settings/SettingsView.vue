<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Component } from 'vue'
import { settingsApi } from '@/api'
import { useAsync } from '@/composables/useAsync'
import { yuan } from '@/utils/format'
import { ROLE_LABELS } from '@/constants'
import type { Store, Staff, Venue, Prop, Addon } from '@/types'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { Plus, Store as StoreIcon, Users, MapPin, Box, Gift } from 'lucide-vue-next'

interface SettingsData {
  stores: Store[]
  staff: Staff[]
  venues: Venue[]
  props: Prop[]
  addons: Addon[]
}

type TabKey = 'stores' | 'staff' | 'venues' | 'props' | 'addons'

const TABS: { key: TabKey; label: string; icon: Component }[] = [
  { key: 'stores', label: '门店', icon: StoreIcon },
  { key: 'staff', label: '人员', icon: Users },
  { key: 'venues', label: '场地', icon: MapPin },
  { key: 'props', label: '道具', icon: Box },
  { key: 'addons', label: '附加项', icon: Gift },
]

const settings = useAsync<SettingsData>(() => settingsApi.list(), {
  stores: [],
  staff: [],
  venues: [],
  props: [],
  addons: [],
})

const tab = ref<TabKey>('stores')
const loading = computed(() => settings.loading.value)

const storeMap = computed(() => {
  const m = new Map<number, string>()
  settings.data.value.stores.forEach((s) => m.set(s.id, s.name))
  return m
})
function storeName(id: number): string {
  return storeMap.value.get(id) ?? '-'
}
function countOf(key: TabKey): number {
  return settings.data.value[key].length
}

const showStore = ref(false)
const saving = ref(false)
const form = ref<{ id?: number; name: string; discountCoefficient: number }>({
  name: '',
  discountCoefficient: 1,
})

function openCreateStore() {
  form.value = { name: '', discountCoefficient: 1 }
  showStore.value = true
}
function editStore(s: Store) {
  form.value = { id: s.id, name: s.name, discountCoefficient: s.discountCoefficient }
  showStore.value = true
}
async function saveStore() {
  if (!form.value.name) return
  saving.value = true
  try {
    await settingsApi.saveStore({ ...form.value })
    showStore.value = false
    await settings.run()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="stagger">
    <PageHeader title="基础设置" subtitle="门店、人员、场地、道具与附加项维护" />

    <div class="flex flex-col sm:flex-row gap-5">
      <nav class="sm:w-44 shrink-0">
        <div class="card p-2 space-y-1">
          <button
            v-for="t in TABS"
            :key="t.key"
            class="w-full flex items-center gap-2.5 px-3 h-10 rounded-[10px] text-sm transition"
            :class="tab === t.key ? 'bg-wine-600 text-white font-medium' : 'text-wine-500 hover:bg-wine-50'"
            @click="tab = t.key"
          >
            <component :is="t.icon" :size="16" />
            {{ t.label }}
            <span class="ml-auto num text-xs" :class="tab === t.key ? 'text-white/70' : 'text-wine-300'">
              {{ countOf(t.key) }}
            </span>
          </button>
        </div>
      </nav>

      <div class="flex-1 min-w-0">
        <BaseCard v-if="tab === 'stores'" :padding="false">
          <div class="flex items-center justify-between px-5 py-4 border-b border-wine-100">
            <div>
              <h3 class="font-serif text-lg text-wine-800 font-semibold">门店管理</h3>
              <p class="text-xs text-wine-300">门店名称与折扣系数</p>
            </div>
            <button class="btn-primary h-9 px-3 text-sm" @click="openCreateStore">
              <Plus :size="15" /> 新增门店
            </button>
          </div>
          <div v-if="loading" class="p-5"><Skeleton :rows="5" /></div>
          <EmptyState v-else-if="!settings.data.value.stores.length" text="暂无门店" />
          <table v-else class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-wine-400 border-b border-wine-100">
                <th class="px-5 py-3 font-medium">门店名称</th>
                <th class="px-3 py-3 font-medium text-right">折扣系数</th>
                <th class="px-5 py-3 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="st in settings.data.value.stores"
                :key="st.id"
                class="border-b border-wine-50 hover:bg-cream/60 transition"
              >
                <td class="px-5 py-3 font-medium text-wine-800">{{ st.name }}</td>
                <td class="px-3 py-3 text-right num text-wine-600">{{ st.discountCoefficient.toFixed(2) }}</td>
                <td class="px-5 py-3 text-right">
                  <button class="text-xs text-wine-400 hover:text-wine-700 font-medium" @click="editStore(st)">
                    编辑
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </BaseCard>

        <BaseCard v-else-if="tab === 'staff'" :padding="false">
          <div class="px-5 py-4 border-b border-wine-100">
            <h3 class="font-serif text-lg text-wine-800 font-semibold">人员管理</h3>
            <p class="text-xs text-wine-300">策划师、主持人、化妆师等</p>
          </div>
          <div v-if="loading" class="p-5"><Skeleton :rows="6" /></div>
          <EmptyState v-else-if="!settings.data.value.staff.length" text="暂无人员" />
          <table v-else class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-wine-400 border-b border-wine-100">
                <th class="px-5 py-3 font-medium">姓名</th>
                <th class="px-3 py-3 font-medium">角色</th>
                <th class="px-3 py-3 font-medium hidden sm:table-cell">门店</th>
                <th class="px-5 py-3 font-medium text-right">电话</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="sf in settings.data.value.staff"
                :key="sf.id"
                class="border-b border-wine-50 hover:bg-cream/60 transition"
              >
                <td class="px-5 py-3 font-medium text-wine-800">{{ sf.name }}</td>
                <td class="px-3 py-3">
                  <span class="chip bg-wine-50 text-wine-600">{{ ROLE_LABELS[sf.role] }}</span>
                </td>
                <td class="px-3 py-3 text-xs text-wine-400 hidden sm:table-cell">{{ storeName(sf.storeId) }}</td>
                <td class="px-5 py-3 text-right num text-wine-500">{{ sf.phone }}</td>
              </tr>
            </tbody>
          </table>
        </BaseCard>

        <BaseCard v-else-if="tab === 'venues'" :padding="false">
          <div class="px-5 py-4 border-b border-wine-100">
            <h3 class="font-serif text-lg text-wine-800 font-semibold">场地管理</h3>
            <p class="text-xs text-wine-300">宴会厅与仪式场地</p>
          </div>
          <div v-if="loading" class="p-5"><Skeleton :rows="5" /></div>
          <EmptyState v-else-if="!settings.data.value.venues.length" text="暂无场地" />
          <table v-else class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-wine-400 border-b border-wine-100">
                <th class="px-5 py-3 font-medium">场地名称</th>
                <th class="px-3 py-3 font-medium text-right">容量(桌)</th>
                <th class="px-5 py-3 font-medium hidden sm:table-cell">门店</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="vn in settings.data.value.venues"
                :key="vn.id"
                class="border-b border-wine-50 hover:bg-cream/60 transition"
              >
                <td class="px-5 py-3 font-medium text-wine-800">{{ vn.name }}</td>
                <td class="px-3 py-3 text-right num text-wine-600">{{ vn.capacity }}</td>
                <td class="px-5 py-3 text-xs text-wine-400 hidden sm:table-cell">{{ storeName(vn.storeId) }}</td>
              </tr>
            </tbody>
          </table>
        </BaseCard>

        <BaseCard v-else-if="tab === 'props'" :padding="false">
          <div class="px-5 py-4 border-b border-wine-100">
            <h3 class="font-serif text-lg text-wine-800 font-semibold">道具管理</h3>
            <p class="text-xs text-wine-300">布景道具与库存</p>
          </div>
          <div v-if="loading" class="p-5"><Skeleton :rows="5" /></div>
          <EmptyState v-else-if="!settings.data.value.props.length" text="暂无道具" />
          <table v-else class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-wine-400 border-b border-wine-100">
                <th class="px-5 py-3 font-medium">道具名称</th>
                <th class="px-3 py-3 font-medium text-right">库存</th>
                <th class="px-5 py-3 font-medium hidden sm:table-cell">门店</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="pr in settings.data.value.props"
                :key="pr.id"
                class="border-b border-wine-50 hover:bg-cream/60 transition"
              >
                <td class="px-5 py-3 font-medium text-wine-800">{{ pr.name }}</td>
                <td class="px-3 py-3 text-right num text-wine-600">{{ pr.stock }}</td>
                <td class="px-5 py-3 text-xs text-wine-400 hidden sm:table-cell">{{ storeName(pr.storeId) }}</td>
              </tr>
            </tbody>
          </table>
        </BaseCard>

        <BaseCard v-else :padding="false">
          <div class="px-5 py-4 border-b border-wine-100">
            <h3 class="font-serif text-lg text-wine-800 font-semibold">附加项管理</h3>
            <p class="text-xs text-wine-300">可选加购服务与物料</p>
          </div>
          <div v-if="loading" class="p-5"><Skeleton :rows="5" /></div>
          <EmptyState v-else-if="!settings.data.value.addons.length" text="暂无附加项" />
          <table v-else class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-wine-400 border-b border-wine-100">
                <th class="px-5 py-3 font-medium">名称</th>
                <th class="px-3 py-3 font-medium text-right">成本</th>
                <th class="px-3 py-3 font-medium text-right">售价</th>
                <th class="px-5 py-3 font-medium text-right">单位</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="ad in settings.data.value.addons"
                :key="ad.id"
                class="border-b border-wine-50 hover:bg-cream/60 transition"
              >
                <td class="px-5 py-3 font-medium text-wine-800">{{ ad.name }}</td>
                <td class="px-3 py-3 text-right num text-wine-400">{{ yuan(ad.cost) }}</td>
                <td class="px-3 py-3 text-right num text-wine-600">{{ yuan(ad.price) }}</td>
                <td class="px-5 py-3 text-right text-xs text-wine-400">{{ ad.unit }}</td>
              </tr>
            </tbody>
          </table>
        </BaseCard>
      </div>
    </div>

    <BaseModal :show="showStore" :title="form.id ? '编辑门店' : '新增门店'" width="440px" @close="showStore = false">
      <div class="space-y-4">
        <div>
          <label class="field-label">门店名称</label>
          <input v-model="form.name" class="field-input" placeholder="请输入门店名称" />
        </div>
        <div>
          <label class="field-label">折扣系数</label>
          <input
            v-model.number="form.discountCoefficient"
            type="number"
            step="0.01"
            min="0"
            class="field-input"
            placeholder="1.00"
          />
          <p class="text-xs text-wine-300 mt-1">系数 1.00 为原价，越小折扣越多</p>
        </div>
      </div>
      <template #footer>
        <button class="btn-ghost h-10 px-4 text-sm" @click="showStore = false">取消</button>
        <button class="btn-primary h-10 px-4 text-sm" :disabled="saving || !form.name" @click="saveStore">
          <Plus :size="16" /> {{ saving ? '保存中…' : '保存' }}
        </button>
      </template>
    </BaseModal>
  </div>
</template>
