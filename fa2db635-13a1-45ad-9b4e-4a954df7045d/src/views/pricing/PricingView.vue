<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { settingsApi, packageApi, addonApi, pricingApi, contractApi, weddingApi } from '@/api'
import { useAsync } from '@/composables/useAsync'
import { yuan } from '@/utils/format'
import type { Store, Package, Addon, Quote, PackageItem, Wedding } from '@/types'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { Calculator, Plus, Minus, FileSignature } from 'lucide-vue-next'

const router = useRouter()

const stores = useAsync(() => settingsApi.list().then((d) => d.stores as Store[]), [] as Store[])
const packages = useAsync(() => packageApi.list(), [] as Package[])
const addons = useAsync(() => addonApi.list(), [] as Addon[])
const weddings = useAsync(() => weddingApi.list({}), [] as Wedding[])

const storeId = ref<number | undefined>(undefined)
const packageId = ref<number | undefined>(undefined)
const guests = ref(12)
const serviceIds = ref<number[]>([])
const addonQtys = ref<Record<number, number>>({})
const quote = ref<Quote | null>(null)
const quoteLoading = ref(false)
const drafting = ref(false)
const showDraft = ref(false)
const draftResult = ref<{ id: number } | null>(null)

const selectedPackage = computed<Package | undefined>(() => packages.data.value.find((p) => p.id === packageId.value))
const selectedStore = computed<Store | undefined>(() => stores.data.value.find((s) => s.id === storeId.value))
const optionalServices = computed<PackageItem[]>(() => selectedPackage.value?.items.filter((i) => !i.included) ?? [])

const addonList = computed(() =>
  addons.data.value.map((a) => ({
    ...a,
    qty: addonQtys.value[a.id] ?? 0,
  })),
)

watch([stores, packages], () => {
  if (!storeId.value && stores.data.value.length) storeId.value = stores.data.value[0].id
  if (!packageId.value && packages.data.value.length) packageId.value = packages.data.value[0].id
})

let calcTimer: ReturnType<typeof setTimeout> | undefined
watch([storeId, packageId, guests, serviceIds, addonQtys], () => {
  if (calcTimer) clearTimeout(calcTimer)
  calcTimer = setTimeout(runCalc, 180)
}, { deep: true })

async function runCalc() {
  if (!storeId.value || !packageId.value) return
  quoteLoading.value = true
  try {
    const res = await pricingApi.calc({
      packageId: packageId.value,
      guests: guests.value,
      serviceIds: serviceIds.value,
      addons: addonList.value.filter((a) => a.qty > 0).map((a) => ({ addonId: a.id, qty: a.qty })),
      storeId: storeId.value,
    })
    quote.value = res
  } finally {
    quoteLoading.value = false
  }
}

function toggleService(id: number) {
  const idx = serviceIds.value.indexOf(id)
  if (idx >= 0) serviceIds.value.splice(idx, 1)
  else serviceIds.value.push(id)
}

function setAddonQty(id: number, delta: number) {
  const cur = addonQtys.value[id] ?? 0
  const next = Math.max(0, Math.min(10, cur + delta))
  addonQtys.value = { ...addonQtys.value, [id]: next }
}

async function draftContract() {
  if (!packageId.value) return
  const weddingId = weddings.data.value[0]?.id
  if (!weddingId) return
  drafting.value = true
  try {
    const res = await contractApi.draft({ weddingId, packageId: packageId.value })
    draftResult.value = { id: res.id }
    showDraft.value = true
  } finally {
    drafting.value = false
  }
}
</script>

<template>
  <div class="stagger">
    <PageHeader title="报价计算器" subtitle="套餐、人数、服务项、附加项实时计算总价" />

    <BaseCard class="mb-5">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="field-label">门店</label>
          <select v-model="storeId" class="field-input">
            <option :value="undefined">请选择门店</option>
            <option v-for="s in stores.data.value" :key="s.id" :value="s.id">
              {{ s.name }}（折扣 {{ s.discountCoefficient.toFixed(2) }}x）
            </option>
          </select>
        </div>
        <div>
          <label class="field-label">套餐</label>
          <select v-model="packageId" class="field-input">
            <option :value="undefined">请选择套餐</option>
            <option v-for="p in packages.data.value" :key="p.id" :value="p.id">
              {{ p.name }} · {{ yuan(p.basePrice) }}
            </option>
          </select>
        </div>
      </div>
    </BaseCard>

    <div class="grid grid-cols-1 lg:grid-cols-5 gap-5">
      <div class="lg:col-span-3 space-y-5">
        <BaseCard title="桌数设定" subtitle="超出 8 桌自动计算加位费">
          <div class="flex items-center gap-4">
            <input v-model.number="guests" type="range" min="5" max="60" class="flex-1 accent-wine-600" />
            <input v-model.number="guests" type="number" min="5" max="60" class="field-input w-24 text-center num" />
            <span class="text-sm text-wine-400">桌</span>
          </div>
        </BaseCard>

        <BaseCard title="可选服务项" subtitle="勾选追加可选服务">
          <Skeleton v-if="packages.loading.value" :rows="4" />
          <div v-else-if="!optionalServices.length" class="text-center py-8 text-wine-300 text-sm">
            该套餐无附加可选服务
          </div>
          <div v-else class="space-y-2">
            <label
              v-for="it in optionalServices"
              :key="it.id"
              class="flex items-center gap-3 p-3 rounded-xl border border-wine-50 hover:bg-cream/60 transition cursor-pointer"
            >
              <input
                :checked="serviceIds.includes(it.id)"
                type="checkbox"
                class="w-4 h-4 accent-wine-600"
                @change="toggleService(it.id)"
              />
              <div class="flex-1 min-w-0">
                <p class="text-sm text-wine-800">{{ it.name }}</p>
                <p class="text-xs text-wine-300">成本 {{ yuan(it.cost) }} · 售价 {{ yuan(it.price) }}</p>
              </div>
            </label>
          </div>
        </BaseCard>

        <BaseCard title="附加项" subtitle="加购物料与增值服务">
          <Skeleton v-if="addons.loading.value" :rows="4" />
          <div v-else-if="!addons.data.value.length" class="text-center py-8 text-wine-300 text-sm">
            暂无附加项
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="a in addonList"
              :key="a.id"
              class="flex items-center gap-3 p-3 rounded-xl border border-wine-50"
            >
              <div class="flex-1 min-w-0">
                <p class="text-sm text-wine-800">{{ a.name }}</p>
                <p class="text-xs text-wine-300">{{ yuan(a.price) }}/{{ a.unit }}</p>
              </div>
              <div class="flex items-center gap-2">
                <button
                  class="w-8 h-8 rounded-lg bg-wine-50 text-wine-500 flex items-center justify-center hover:bg-wine-100 transition"
                  @click="setAddonQty(a.id, -1)"
                >
                  <Minus :size="14" />
                </button>
                <span class="num w-8 text-center text-wine-700">{{ a.qty }}</span>
                <button
                  class="w-8 h-8 rounded-lg bg-wine-50 text-wine-500 flex items-center justify-center hover:bg-wine-100 transition"
                  @click="setAddonQty(a.id, 1)"
                >
                  <Plus :size="14" />
                </button>
              </div>
            </div>
          </div>
        </BaseCard>
      </div>

      <div class="lg:col-span-2">
        <div class="card p-5 sticky top-5">
          <div class="flex items-center gap-2 mb-4">
            <div class="w-9 h-9 rounded-xl bg-gold-grad text-wine-800 flex items-center justify-center">
              <Calculator :size="18" />
            </div>
            <div>
              <h3 class="font-serif text-lg text-wine-800 font-semibold">报价单</h3>
              <p class="text-xs text-wine-300">
                {{ selectedPackage?.name || '未选择' }} · {{ selectedStore ? selectedStore.discountCoefficient.toFixed(2) + 'x 折扣' : '未选择门店' }}
              </p>
            </div>
          </div>

          <Skeleton v-if="quoteLoading || packages.loading.value" :rows="6" />
          <div v-else-if="!quote" class="text-center py-12 text-wine-300 text-sm">
            选择门店、套餐后自动计算
          </div>
          <div v-else class="space-y-4">
            <div class="rounded-xl border border-wine-100 overflow-hidden">
              <table class="w-full text-xs">
                <thead class="bg-wine-50/60 text-wine-500">
                  <tr>
                    <th class="text-left font-medium px-3 py-2">项目</th>
                    <th class="text-right font-medium px-2 py-2">成本</th>
                    <th class="text-right font-medium px-2 py-2">售价</th>
                    <th class="text-right font-medium px-3 py-2">数量</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(it, i) in quote.items" :key="i" class="border-t border-wine-50">
                    <td class="px-3 py-2 text-wine-700 truncate">{{ it.name }}</td>
                    <td class="px-2 py-2 text-right num text-wine-400">{{ yuan(it.cost) }}</td>
                    <td class="px-2 py-2 text-right num text-wine-600">{{ yuan(it.price) }}</td>
                    <td class="px-3 py-2 text-right num text-wine-500">{{ it.qty }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="space-y-1.5 text-sm">
              <div class="flex justify-between text-wine-500">
                <span>原价</span>
                <span class="num">{{ yuan(quote.price) }}</span>
              </div>
              <div class="flex justify-between text-gold-600">
                <span>门店优惠</span>
                <span class="num">-{{ yuan(quote.discount) }}</span>
              </div>
              <div class="flex justify-between text-wine-400">
                <span>总成本</span>
                <span class="num">{{ yuan(quote.cost) }}</span>
              </div>
              <div class="flex justify-between text-emerald-600">
                <span>预计利润</span>
                <span class="num">{{ yuan(quote.profit) }}（{{ quote.margin }}%）</span>
              </div>
            </div>

            <div class="pt-3 border-t border-wine-100 flex items-end justify-between">
              <span class="text-wine-500 text-sm">总价</span>
              <span class="font-display text-3xl font-semibold text-wine-800 num">{{ yuan(quote.total) }}</span>
            </div>

            <button
              class="btn-primary w-full"
              :disabled="drafting || !quote"
              @click="draftContract"
            >
              <FileSignature :size="16" />
              {{ drafting ? '生成中…' : '生成合同草稿' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <BaseModal :show="showDraft" title="合同草稿已生成" width="420px" @close="showDraft = false">
      <div class="text-center py-2">
        <div class="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
          <FileSignature :size="28" />
        </div>
        <p class="mt-4 font-serif text-lg text-wine-800 font-semibold">创建成功</p>
        <p class="mt-1 text-sm text-wine-400">合同草稿已生成，可前往合同管理查看并签署</p>
      </div>
      <template #footer>
        <button class="btn-ghost h-10 px-4 text-sm" @click="showDraft = false">关闭</button>
        <button
          v-if="draftResult"
          class="btn-primary h-10 px-4 text-sm"
          @click="router.push(`/contracts/${draftResult.id}`)"
        >
          查看合同
        </button>
      </template>
    </BaseModal>
  </div>
</template>
