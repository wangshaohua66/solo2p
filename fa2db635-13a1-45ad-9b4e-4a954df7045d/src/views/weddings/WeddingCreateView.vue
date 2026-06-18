<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { weddingApi, settingsApi, packageApi, scheduleApi } from '@/api'
import { useAsync } from '@/composables/useAsync'
import { yuan, formatDate } from '@/utils/format'
import { RESOURCE_LABELS } from '@/constants'
import type {
  Store,
  Staff,
  Venue,
  Prop,
  Package,
  Addon,
  ResourceType,
  ConflictResult,
} from '@/types'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import {
  CheckCircle2, ArrowLeft, ArrowRight, UserPlus, Sparkles,
  Users, MapPin, Package as BoxIcon, Calculator, AlertTriangle,
  Check, Minus, Plus as PlusIcon,
} from 'lucide-vue-next'
import { ROLE_LABELS } from '@/constants'

const router = useRouter()

const step = ref(1)
const STEPS = [
  { k: 1, label: '新人信息', icon: UserPlus },
  { k: 2, label: '选择套餐', icon: Sparkles },
  { k: 3, label: '资源匹配', icon: Users },
  { k: 4, label: '报价预览', icon: Calculator },
]

const form = ref({
  groomName: '',
  brideName: '',
  phone: '',
  weddingDate: '',
  guests: 12,
  storeId: 1,
  packageId: 1,
  plannerId: 0,
  staffIds: [] as number[],
  venueId: 0,
  propIds: [] as number[],
  serviceIds: [] as number[],
  addons: [] as { addonId: number; qty: number }[],
})

const settings = useAsync(() => settingsApi.list(), {} as any)
const packages = useAsync<Package[]>(() => packageApi.list(), [])

const stores = computed<Store[]>(() => settings.data.value.stores || [])
const staff = computed<Staff[]>(() => settings.data.value.staff || [])
const venues = computed<Venue[]>(() => settings.data.value.venues || [])
const props = computed<Prop[]>(() => settings.data.value.props || [])
const addons = computed<Addon[]>(() => settings.data.value.addons || [])

const selectedPkg = computed(() => packages.data.value.find((p) => p.id === form.value.packageId))
const storeStaff = computed(() => staff.value.filter((s) => s.storeId === form.value.storeId))
const storeVenues = computed(() => venues.value.filter((v) => v.storeId === form.value.storeId))
const storeProps = computed(() => props.value.filter((p) => p.storeId === form.value.storeId))
const optionalItems = computed(() => selectedPkg.value?.items.filter((i) => !i.included) || [])

const conflictCache = ref(new Map<string, ConflictResult | null>())
const checking = ref(false)

function timeRangeOf(dateStr: string) {
  return { start: `${dateStr}T08:00:00`, end: `${dateStr}T20:00:00` }
}

async function runCheck(type: ResourceType, ids: number[]) {
  if (!form.value.weddingDate || ids.length === 0) return
  const { start, end } = timeRangeOf(form.value.weddingDate)
  for (const id of ids) {
    const key = `${type}-${id}-${form.value.weddingDate}`
    if (conflictCache.value.has(key)) continue
    conflictCache.value.set(key, null)
    const r = await scheduleApi.check({
      resourceType: type,
      resourceId: id,
      storeId: form.value.storeId,
      start,
      end,
    })
    conflictCache.value.set(key, r)
  }
}

function getConflict(type: ResourceType, id: number) {
  return conflictCache.value.get(`${type}-${id}-${form.value.weddingDate}`)
}
function anyConflict(): boolean {
  for (const id of form.value.staffIds) if (getConflict('STAFF', id)?.conflict) return true
  if (form.value.venueId && getConflict('VENUE', form.value.venueId)?.conflict) return true
  for (const id of form.value.propIds) if (getConflict('PROP', id)?.conflict) return true
  return false
}

watch([() => form.value.weddingDate, () => form.value.storeId, () => form.value.staffIds, () => form.value.venueId, () => form.value.propIds],
  async () => {
    if (!form.value.weddingDate) return
    checking.value = true
    try {
      await Promise.all([
        runCheck('STAFF', form.value.staffIds),
        form.value.venueId ? runCheck('VENUE', [form.value.venueId]) : Promise.resolve(),
        runCheck('PROP', form.value.propIds),
      ])
    } finally {
      checking.value = false
    }
  }, { immediate: true },
)

const quote = ref<any>(null)
const quoteLoading = ref(false)
async function computeQuote() {
  quoteLoading.value = true
  try {
    const { pricingApi } = await import('@/api')
    quote.value = await pricingApi.calc({
      packageId: form.value.packageId,
      guests: form.value.guests,
      serviceIds: form.value.serviceIds,
      addons: form.value.addons,
      storeId: form.value.storeId,
    })
  } finally {
    quoteLoading.value = false
  }
}

watch(
  [() => form.value.packageId, () => form.value.guests, () => form.value.serviceIds, () => form.value.addons, () => form.value.storeId, () => step],
  async () => {
    if (step.value >= 4) await computeQuote()
  },
  { deep: true },
)

function toggleStaff(id: number) {
  const i = form.value.staffIds.indexOf(id)
  if (i === -1) form.value.staffIds.push(id)
  else form.value.staffIds.splice(i, 1)
}
function toggleProp(id: number) {
  const i = form.value.propIds.indexOf(id)
  if (i === -1) form.value.propIds.push(id)
  else form.value.propIds.splice(i, 1)
}
function toggleService(id: number) {
  const i = form.value.serviceIds.indexOf(id)
  if (i === -1) form.value.serviceIds.push(id)
  else form.value.serviceIds.splice(i, 1)
}
function addonQty(id: number, delta: number) {
  let a = form.value.addons.find((x) => x.addonId === id)
  if (!a) {
    a = { addonId: id, qty: 0 }
    form.value.addons.push(a)
  }
  a.qty = Math.max(0, a.qty + delta)
  if (a.qty === 0) form.value.addons = form.value.addons.filter((x) => x.addonId !== id)
}
function addonCount(id: number) {
  return form.value.addons.find((x) => x.addonId === id)?.qty ?? 0
}

function canNext() {
  if (step.value === 1) return form.value.brideName && form.value.groomName && form.value.weddingDate && form.value.phone
  if (step.value === 2) return true
  if (step.value === 3) return form.value.plannerId > 0 && form.value.venueId > 0 && !anyConflict()
  return false
}

const creating = ref(false)
const success = ref<{ id: number; coupleName: string } | null>(null)

async function submit() {
  creating.value = true
  try {
    const resources: { type: string; id: number }[] = [
      ...form.value.staffIds.map((id) => ({ type: 'STAFF', id })),
      ...(form.value.venueId ? [{ type: 'VENUE', id: form.value.venueId }] : []),
      ...form.value.propIds.map((id) => ({ type: 'PROP', id })),
    ]
    const w = await weddingApi.create({
      coupleName: form.value.groomName + ' & ' + form.value.brideName,
      groomName: form.value.groomName,
      brideName: form.value.brideName,
      phone: form.value.phone,
      weddingDate: form.value.weddingDate,
      guests: form.value.guests,
      storeId: form.value.storeId,
      packageId: form.value.packageId,
      plannerId: form.value.plannerId,
      quoteTotal: quote.value?.total,
      resources,
    })
    success.value = { id: w.id, coupleName: w.coupleName }
  } finally {
    creating.value = false
  }
}

const valid = computed(() => form.value.brideName && form.value.groomName && form.value.weddingDate)
</script>

<template>
  <div class="stagger">
    <PageHeader title="创建婚礼项目" subtitle="四步完成：新人信息 → 套餐 → 资源匹配 → 报价生成">
      <template #actions>
        <button class="btn-ghost h-10 px-4 text-sm" @click="router.back()">取消</button>
      </template>
    </PageHeader>

    <BaseCard class="mb-5">
      <div class="flex items-center">
        <template v-for="(s, idx) in STEPS" :key="s.k">
          <div class="flex items-center gap-2">
            <div
              class="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              :class="step >= s.k ? 'bg-wine-grad text-white shadow-soft' : 'bg-wine-50 text-wine-300'"
            >
              <component :is="s.icon" :size="16" />
            </div>
            <div class="hidden sm:block">
              <p class="text-xs" :class="step >= s.k ? 'text-wine-700 font-medium' : 'text-wine-300'">{{ s.label }}</p>
              <p class="num text-[10px]" :class="step >= s.k ? 'text-gold-500' : 'text-wine-200'">Step 0{{ s.k }}</p>
            </div>
          </div>
          <div v-if="idx < STEPS.length - 1" class="flex-1 h-px mx-3" :class="step > s.k ? 'bg-gold-300' : 'bg-wine-100'"></div>
        </template>
      </div>
    </BaseCard>

    <BaseCard>
      <!-- STEP 1 -->
      <div v-if="step === 1" class="grid md:grid-cols-2 gap-5">
        <div>
          <p class="font-display text-lg text-wine-800 font-semibold">新人基础信息</p>
          <p class="text-xs text-wine-300 mt-1">请填写新人姓名、联系电话与预计婚期</p>
          <div class="mt-5 space-y-4">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="field-label">新郎姓名 *</label>
                <input v-model="form.groomName" class="field-input" placeholder="请输入" />
              </div>
              <div>
                <label class="field-label">新娘姓名 *</label>
                <input v-model="form.brideName" class="field-input" placeholder="请输入" />
              </div>
            </div>
            <div>
              <label class="field-label">联系电话 *</label>
              <input v-model="form.phone" class="field-input" placeholder="13xxxxxxxx" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="field-label">预计婚期 *</label>
                <input v-model="form.weddingDate" type="date" class="field-input" />
              </div>
              <div>
                <label class="field-label">预计桌数</label>
                <input v-model.number="form.guests" type="number" min="5" max="100" class="field-input" />
              </div>
            </div>
            <div>
              <label class="field-label">所属门店</label>
              <select v-model.number="form.storeId" class="field-input">
                <option v-for="s in stores" :key="s.id" :value="s.id">
                  {{ s.name }}（折扣 {{ s.discountCoefficient.toFixed(2) }}）
                </option>
              </select>
            </div>
          </div>
        </div>

        <div class="p-6 rounded-2xl bg-gradient-to-br from-wine-50 to-gold-50 border border-gold-200/60">
          <p class="font-display text-2xl font-semibold text-wine-800">温馨提示</p>
          <ul class="mt-4 space-y-3 text-sm text-wine-600">
            <li class="flex gap-2">
              <CheckCircle2 :size="16" class="text-gold-500 mt-0.5 shrink-0" />
              <span>系统将在下一步自动校验该婚期资源占用情况，建议避开旺季高峰期</span>
            </li>
            <li class="flex gap-2">
              <CheckCircle2 :size="16" class="text-gold-500 mt-0.5 shrink-0" />
              <span>门店折扣系数会影响最终报价，请确认选择正确门店</span>
            </li>
            <li class="flex gap-2">
              <CheckCircle2 :size="16" class="text-gold-500 mt-0.5 shrink-0" />
              <span>创建完成后可随时在「婚礼详情」中修改信息与推进阶段</span>
            </li>
          </ul>
          <div class="mt-6 p-4 rounded-xl bg-white/70 border border-wine-100">
            <p class="text-xs text-wine-400">婚期倒计时</p>
            <p v-if="form.weddingDate" class="font-display text-3xl font-semibold text-wine-700 mt-1">
              {{ Math.ceil((new Date(form.weddingDate).getTime() - Date.now()) / 86400000) }}
              <span class="text-sm text-wine-400 ml-1 font-sans font-normal">天</span>
            </p>
            <p v-else class="font-display text-3xl font-semibold text-wine-200 mt-1">—</p>
          </div>
        </div>
      </div>

      <!-- STEP 2 -->
      <div v-else-if="step === 2">
        <div class="flex items-end justify-between mb-4">
          <div>
            <p class="font-display text-lg text-wine-800 font-semibold">选择套餐与附加服务</p>
            <p class="text-xs text-wine-300 mt-1">基础套餐 + 可选服务项 + 附加物料</p>
          </div>
        </div>
        <div class="mb-6 grid lg:grid-cols-3 gap-3">
          <div
            v-for="p in packages.data"
            :key="p.id"
            @click="form.packageId = p.id"
            class="p-4 rounded-2xl border transition cursor-pointer"
            :class="form.packageId === p.id ? 'border-wine-600 bg-wine-50/60 shadow-soft' : 'border-wine-100 bg-white hover:border-gold-300'"
          >
            <div class="flex items-start justify-between">
              <div>
                <p class="font-serif text-base text-wine-800 font-semibold">{{ p.name }}</p>
                <p class="text-xs text-wine-300 mt-1 line-clamp-2">{{ p.description }}</p>
              </div>
              <div
                v-if="form.packageId === p.id"
                class="w-6 h-6 rounded-full bg-wine-grad flex items-center justify-center text-white"
              >
                <Check :size="14" />
              </div>
            </div>
            <div class="mt-4 flex items-end justify-between">
              <p class="num font-display text-2xl font-semibold text-wine-700">{{ yuan(p.basePrice) }}</p>
              <span class="chip bg-gold-50 text-gold-700">含 {{ p.items.filter((i) => i.included).length }} 项服务</span>
            </div>
          </div>
        </div>

        <div v-if="selectedPkg" class="mb-6">
          <p class="text-sm font-medium text-wine-700 mb-3">可选服务项（勾选加入）</p>
          <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <label
              v-for="it in optionalItems"
              :key="it.id"
              class="flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer"
              :class="form.serviceIds.includes(it.id) ? 'border-gold-400 bg-gold-50/60' : 'border-wine-100 hover:border-wine-200'"
            >
              <input type="checkbox" :checked="form.serviceIds.includes(it.id)" @change="toggleService(it.id)" class="mt-1 accent-wine-600" />
              <div class="min-w-0 flex-1">
                <p class="text-sm text-wine-800">{{ it.name }}</p>
                <p class="text-xs text-wine-400 mt-0.5 num">售价 {{ yuan(it.price) }} · 成本 {{ yuan(it.cost) }}</p>
              </div>
            </label>
          </div>
        </div>

        <div>
          <p class="text-sm font-medium text-wine-700 mb-3">附加项（数量步进）</p>
          <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <div
              v-for="a in addons"
              :key="a.id"
              class="flex items-center justify-between p-3 rounded-xl border border-wine-100"
            >
              <div>
                <p class="text-sm text-wine-800">{{ a.name }}</p>
                <p class="text-xs text-wine-400 mt-0.5 num">{{ yuan(a.price) }} / {{ a.unit }}</p>
              </div>
              <div class="flex items-center gap-1.5">
                <button class="w-7 h-7 rounded-lg bg-wine-50 text-wine-600 flex items-center justify-center" @click="addonQty(a.id, -1)">
                  <Minus :size="13" />
                </button>
                <span class="num text-sm w-6 text-center">{{ addonCount(a.id) }}</span>
                <button class="w-7 h-7 rounded-lg bg-wine-grad text-white flex items-center justify-center" @click="addonQty(a.id, 1)">
                  <PlusIcon :size="13" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- STEP 3 -->
      <div v-else-if="step === 3">
        <div class="mb-4 flex items-center justify-between">
          <div>
            <p class="font-display text-lg text-wine-800 font-semibold">资源匹配与档期校验</p>
            <p class="text-xs text-wine-300 mt-1">为「{{ formatDate(form.weddingDate) }}」自动检测档期冲突</p>
          </div>
          <StatusBadge v-if="checking" text="检测中…" type="gold" />
          <StatusBadge v-else-if="anyConflict()" :text="'存在冲突 · 共 ' + (Array.from(conflictCache.values()).filter((x) => x?.conflict).length) + ' 项'" type="red" />
          <StatusBadge v-else text="全部可用" type="green" />
        </div>

        <div class="mb-5">
          <p class="text-sm font-medium text-wine-700 mb-3"><Users :size="14" class="inline mr-1" /> 策划师 *</p>
          <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <button
              v-for="s in storeStaff.filter((x) => x.role === 'PLANNER')"
              :key="s.id"
              class="p-3 rounded-xl border text-left transition"
              :class="form.plannerId === s.id ? 'border-wine-600 bg-wine-50/60' : 'border-wine-100 hover:border-gold-300'"
              @click="form.plannerId = s.id"
            >
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-full bg-wine-grad text-white text-xs flex items-center justify-center">{{ s.name.charAt(0) }}</div>
                <div>
                  <p class="text-sm font-medium text-wine-800">{{ s.name }}</p>
                  <p class="text-[10px] text-wine-300">{{ ROLE_LABELS[s.role] }}</p>
                </div>
              </div>
              <div v-if="getConflict('STAFF', s.id)?.conflict" class="mt-2 flex items-center gap-1 text-[11px] text-rose-600">
                <AlertTriangle :size="12" /> 档期冲突
              </div>
            </button>
          </div>
        </div>

        <div class="mb-5">
          <p class="text-sm font-medium text-wine-700 mb-3"><Users :size="14" class="inline mr-1" /> 服务团队（可多选）</p>
          <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <button
              v-for="s in storeStaff.filter((x) => x.role !== 'PLANNER')"
              :key="s.id"
              class="p-3 rounded-xl border text-left transition"
              :class="form.staffIds.includes(s.id) ? 'border-wine-600 bg-wine-50/60' : 'border-wine-100 hover:border-gold-300'"
              @click="toggleStaff(s.id)"
            >
              <div class="flex items-center justify-between">
                <p class="text-sm font-medium text-wine-800">{{ s.name }}</p>
                <span class="chip bg-wine-50 text-wine-600">{{ ROLE_LABELS[s.role] }}</span>
              </div>
              <div v-if="getConflict('STAFF', s.id)?.conflict" class="mt-2 flex items-center gap-1 text-[11px] text-rose-600">
                <AlertTriangle :size="12" /> 档期冲突
                <div v-if="getConflict('STAFF', s.id)?.alternatives?.length" class="ml-auto text-[10px] text-wine-500 num">
                  {{ getConflict('STAFF', s.id)!.alternatives.length }} 可替换
                </div>
              </div>
            </button>
          </div>
        </div>

        <div class="mb-5">
          <p class="text-sm font-medium text-wine-700 mb-3"><MapPin :size="14" class="inline mr-1" /> 场地 *</p>
          <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <button
              v-for="v in storeVenues"
              :key="v.id"
              class="p-3 rounded-xl border text-left transition"
              :class="form.venueId === v.id ? 'border-wine-600 bg-wine-50/60' : 'border-wine-100 hover:border-gold-300'"
              @click="form.venueId = v.id"
            >
              <p class="text-sm font-medium text-wine-800">{{ v.name }}</p>
              <p class="text-xs text-wine-400 mt-0.5 num">容量 {{ v.capacity }} 桌</p>
              <div v-if="getConflict('VENUE', v.id)?.conflict" class="mt-2 flex items-center gap-1 text-[11px] text-rose-600">
                <AlertTriangle :size="12" /> 档期冲突
              </div>
            </button>
          </div>
        </div>

        <div>
          <p class="text-sm font-medium text-wine-700 mb-3"><BoxIcon :size="14" class="inline mr-1" /> 道具（可多选）</p>
          <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <button
              v-for="p in storeProps"
              :key="p.id"
              class="p-3 rounded-xl border text-left transition"
              :class="form.propIds.includes(p.id) ? 'border-wine-600 bg-wine-50/60' : 'border-wine-100 hover:border-gold-300'"
              @click="toggleProp(p.id)"
            >
              <p class="text-sm font-medium text-wine-800">{{ p.name }}</p>
              <p class="text-xs text-wine-400 mt-0.5 num">库存 {{ p.stock }}</p>
              <div v-if="getConflict('PROP', p.id)?.conflict" class="mt-2 flex items-center gap-1 text-[11px] text-rose-600">
                <AlertTriangle :size="12" /> 档期冲突
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- STEP 4 -->
      <div v-else>
        <div class="mb-4 flex items-center justify-between">
          <div>
            <p class="font-display text-lg text-wine-800 font-semibold">报价预览</p>
            <p class="text-xs text-wine-300 mt-1">{{ form.groomName }} & {{ form.brideName }} · {{ formatDate(form.weddingDate) }}</p>
          </div>
        </div>

        <Skeleton v-if="quoteLoading || !quote" :rows="10" />
        <div v-else class="grid lg:grid-cols-3 gap-5">
          <div class="lg:col-span-2">
            <div class="rounded-2xl border border-wine-100 overflow-hidden">
              <div class="px-5 py-3 bg-wine-50 border-b border-wine-100">
                <p class="font-serif text-sm text-wine-700 font-medium">{{ selectedPkg?.name }} · 报价明细</p>
              </div>
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-xs text-wine-400">
                    <th class="px-5 py-2.5 text-left font-medium">项目</th>
                    <th class="px-3 py-2.5 text-right font-medium">数量</th>
                    <th class="px-3 py-2.5 text-right font-medium">成本</th>
                    <th class="px-5 py-2.5 text-right font-medium">售价</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(it, i) in quote.items" :key="i" class="border-t border-wine-50">
                    <td class="px-5 py-2.5 text-wine-800">{{ it.name }}</td>
                    <td class="px-3 py-2.5 text-right num text-wine-500">×{{ it.qty }}</td>
                    <td class="px-3 py-2.5 text-right num text-wine-400">{{ yuan(it.cost) }}</td>
                    <td class="px-5 py-2.5 text-right num text-wine-700">{{ yuan(it.price) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="p-5 rounded-2xl bg-gradient-to-br from-wine-700 to-wine-900 text-white shadow-lift">
            <p class="text-[11px] tracking-widest text-gold-200">FINAL QUOTE</p>
            <p class="mt-1 font-display text-4xl font-semibold num">{{ yuan(quote.total) }}</p>
            <div class="mt-4 space-y-2 text-sm">
              <div class="flex justify-between text-white/70">
                <span>原价</span>
                <span class="num">{{ yuan(quote.price) }}</span>
              </div>
              <div class="flex justify-between text-gold-200">
                <span>门店折扣</span>
                <span class="num">- {{ yuan(quote.discount) }}</span>
              </div>
              <div class="flex justify-between text-white/70">
                <span>总成本</span>
                <span class="num">{{ yuan(quote.cost) }}</span>
              </div>
              <div class="flex justify-between text-gold-300">
                <span>预计毛利</span>
                <span class="num">{{ yuan(quote.profit) }}</span>
              </div>
              <div class="flex justify-between text-gold-300 font-medium pt-2 border-t border-white/10 mt-2">
                <span>毛利率</span>
                <span class="num">{{ quote.margin }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </BaseCard>

    <div class="mt-5 flex justify-between">
      <button class="btn-ghost h-10 px-5 text-sm" :disabled="step === 1" @click="step--">
        <ArrowLeft :size="15" /> 上一步
      </button>
      <template v-if="step < 4">
        <button class="btn-primary h-10 px-5 text-sm" :disabled="!canNext()" @click="step++">
          下一步 <ArrowRight :size="15" />
        </button>
      </template>
      <template v-else>
        <button class="btn-primary h-10 px-6 text-sm" :disabled="creating || quoteLoading" @click="submit">
          {{ creating ? '创建中…' : '提交并创建婚礼项目' }}
        </button>
      </template>
    </div>

    <BaseModal :show="!!success" title="创建成功" width="480px" @close="success = null">
      <div class="text-center py-4">
        <div class="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
          <CheckCircle2 :size="32" class="text-emerald-500" />
        </div>
        <p class="mt-4 font-serif text-xl text-wine-800 font-semibold">婚礼项目已创建</p>
        <p class="mt-1 text-sm text-wine-400">{{ success?.coupleName }}</p>
      </div>
      <template #footer>
        <button class="btn-ghost h-10 px-4 text-sm" @click="success = null">留在本页</button>
        <button class="btn-primary h-10 px-5 text-sm" @click="router.push(`/weddings/${success?.id}`)">进入婚礼详情</button>
      </template>
    </BaseModal>
  </div>
</template>
