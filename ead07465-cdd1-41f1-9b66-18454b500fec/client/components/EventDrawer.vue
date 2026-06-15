<template>
  <div class="fixed top-14 right-0 bottom-0 w-[420px] bg-secondary border-l border-color z-40 flex flex-col shadow-2xl">
    <div class="flex items-center justify-between px-4 py-3 border-b border-color">
      <div>
        <div class="font-semibold text-primary flex items-center gap-2">
          <span class="badge" :class="severityBadge">{{ severityLabel }}</span>
          {{ event?.eventNo }}
        </div>
        <div class="text-xs text-muted mt-0.5">{{ relativeTime(event?.detectedAt || null) }} 检测</div>
      </div>
      <button class="w-8 h-8 rounded-md hover:bg-hover flex items-center justify-center" @click="$emit('close')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div class="p-4 border-b border-color">
        <div class="flex gap-2 mb-3">
          <span class="badge" :class="statusBadge">{{ statusLabel }}</span>
          <span v-if="event?.relatedWorkOrderId" class="badge badge-info">已关联工单</span>
        </div>
        <div class="text-sm text-secondary">{{ event?.description || '暂无描述' }}</div>
      </div>

      <div class="p-4 border-b border-color">
        <div class="text-xs font-medium text-muted mb-3">定位信息</div>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div class="text-xs text-muted">经度</div>
            <div class="text-primary font-medium">{{ event?.longitude.toFixed(5) }}</div>
          </div>
          <div>
            <div class="text-xs text-muted">纬度</div>
            <div class="text-primary font-medium">{{ event?.latitude.toFixed(5) }}</div>
          </div>
          <div>
            <div class="text-xs text-muted">置信度</div>
            <div class="text-primary font-medium">{{ ((event?.confidence || 0) * 100).toFixed(1) }}%</div>
          </div>
          <div>
            <div class="text-xs text-muted">预估半径</div>
            <div class="text-primary font-medium">{{ event?.estimatedRadius?.toFixed(0) || '-' }} m</div>
          </div>
        </div>

        <div class="mt-3">
          <div class="text-xs text-muted mb-1">置信度</div>
          <div class="h-2 bg-tertiary rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all" :style="{ width: ((event?.confidence || 0) * 100) + '%', background: severityColor }"></div>
          </div>
        </div>
      </div>

      <div class="p-4 border-b border-color">
        <div class="text-xs font-medium text-muted mb-3">关联监测点</div>
        <div v-if="abnormalNodes.length === 0" class="text-sm text-muted">暂无</div>
        <div v-else class="flex flex-col gap-2">
          <div v-for="node in abnormalNodes" :key="node.id" class="flex items-center justify-between p-2 rounded-md bg-tertiary/50">
            <div>
              <div class="text-sm text-primary">{{ node.name }}</div>
              <div class="text-xs text-muted">{{ node.code }} · {{ node.scadaStation }}</div>
            </div>
            <div class="text-right">
              <div class="text-sm font-medium" :class="node.hasAlarm ? 'text-danger' : 'text-success'">
                {{ node.currentPressure?.toFixed(3) || '-' }} MPa
              </div>
              <div class="text-xs text-muted">{{ relativeTime(node.lastReadingTime) }}</div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="relatedOrder" class="p-4 border-b border-color">
        <div class="text-xs font-medium text-muted mb-3">关联工单</div>
        <div class="card p-3">
          <div class="flex items-center justify-between mb-2">
            <span class="font-medium text-primary">{{ relatedOrder.orderNo }}</span>
            <span class="badge badge-info">{{ statusBadgeForOrder }}</span>
          </div>
          <div class="text-sm text-secondary mb-2 truncate">{{ relatedOrder.title }}</div>
          <div class="grid grid-cols-2 gap-2 text-xs text-muted">
            <div>派发: {{ relatedOrder.assignedTeam?.teamName || '-' }}</div>
            <div>优先级: {{ '★'.repeat(relatedOrder.priority) }}</div>
            <div>创建: {{ formatDateTime(relatedOrder.createdAt) }}</div>
            <div>到场: {{ relatedOrder.onSiteAt ? formatDateTime(relatedOrder.onSiteAt) : '-' }}</div>
          </div>
        </div>
      </div>

      <div v-if="event?.status === 'Detected' || event?.status === 'Confirmed'" class="p-4 border-b border-color">
        <div class="text-xs font-medium text-muted mb-3">概率热力图</div>
        <div class="h-32 rounded-md bg-tertiary/30 flex items-center justify-center relative overflow-hidden">
          <div
            v-for="(pt, i) in (event?.candidatePoints || []).slice(0, 80)"
            :key="i"
            class="absolute rounded-full"
            :style="{
              left: ((pt.longitude - minLng) / (maxLng - minLng) * 100) + '%',
              top: (100 - (pt.latitude - minLat) / (maxLat - minLat) * 100) + '%',
              width: (4 + pt.probability * 12) + 'px',
              height: (4 + pt.probability * 12) + 'px',
              background: heatColor(pt.probability),
              opacity: 0.3 + pt.probability * 0.7,
              transform: 'translate(-50%, -50%)'
            }"
          ></div>
          <span class="text-xs text-muted">热力预览（地图查看完整效果）</span>
        </div>
      </div>
    </div>

    <div class="p-4 border-t border-color flex gap-2">
      <template v-if="event?.status === 'Detected'">
        <button class="btn btn-secondary flex-1" @click="$emit('close')">稍后处理</button>
        <button class="btn btn-primary flex-1" @click="confirmAndCreate">确认并创建工单</button>
      </template>
      <template v-else-if="event?.status === 'Confirmed' && !relatedOrder">
        <button class="btn btn-secondary flex-1" @click="$emit('close')">关闭</button>
        <button class="btn btn-primary flex-1" @click="createWorkOrder">创建抢修工单</button>
      </template>
      <template v-else>
        <button class="btn btn-secondary flex-1" @click="goToOrder" v-if="relatedOrder">查看工单</button>
        <button class="btn btn-primary flex-1" @click="$emit('close')">关闭</button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDispatchStore } from '~/stores/dispatch'
import { getSeverityLabel, getStatusLabel, relativeTime, formatDateTime } from '~/utils/api'
import type { LeakEvent } from '~/types'

const props = defineProps<{ event: LeakEvent | null }>()
defineEmits<{ (e: 'close'): void }>()

const dispatch = useDispatchStore()
const router = useRouter()

const severityLabel = computed(() => props.event ? getSeverityLabel(props.event.severity) : '')
const statusLabel = computed(() => props.event ? getStatusLabel(props.event.status) : '')
const severityColor = computed(() => {
  if (!props.event) return '#6b7280'
  const map: Record<string, string> = { Critical: '#dc2626', High: '#ea580c', Medium: '#d97706', Low: '#16a34a' }
  return map[props.event.severity] || '#6b7280'
})

const severityBadge = computed(() => {
  if (!props.event) return 'badge-default'
  const s = props.event.severity
  return s === 'Critical' ? 'badge-danger' : s === 'High' ? 'badge-warning' : s === 'Medium' ? 'badge-info' : 'badge-default'
})

const statusBadge = computed(() => {
  if (!props.event) return 'badge-default'
  const s = props.event.status
  return s === 'Detected' ? 'badge-danger' : s === 'Confirmed' ? 'badge-warning' : s === 'Repairing' ? 'badge-info' : 'badge-success'
})

const abnormalNodes = computed(() =>
  (props.event?.abnormalNodeIds || [])
    .map(id => dispatch.monitorNodes.find(n => n.id === id))
    .filter(Boolean) as any[]
)

const relatedOrder = computed(() =>
  props.event?.relatedWorkOrderId ? dispatch.workOrders.find(w => w.id === props.event!.relatedWorkOrderId) : null
)

const statusBadgeForOrder = computed(() => {
  if (!relatedOrder.value) return 'badge-default'
  const s = relatedOrder.value.status
  if (['Created', 'Dispatched'].includes(s)) return 'badge-warning'
  if (['Accepted', 'OnSite', 'Repairing'].includes(s)) return 'badge-info'
  if (['Completed', 'AcceptedClosed'].includes(s)) return 'badge-success'
  return 'badge-default'
})

const minLng = computed(() => Math.min(...(props.event?.candidatePoints || []).map(p => p.longitude), props.event?.longitude || 0))
const maxLng = computed(() => Math.max(...(props.event?.candidatePoints || []).map(p => p.longitude), props.event?.longitude || 0))
const minLat = computed(() => Math.min(...(props.event?.candidatePoints || []).map(p => p.latitude), props.event?.latitude || 0))
const maxLat = computed(() => Math.max(...(props.event?.candidatePoints || []).map(p => p.latitude), props.event?.latitude || 0))

function heatColor(p: number): string {
  if (p < 0.3) return 'rgba(34,197,94,0.6)'
  if (p < 0.6) return 'rgba(234,179,8,0.7)'
  if (p < 0.85) return 'rgba(249,115,22,0.8)'
  return 'rgba(239,68,68,0.9)'
}

async function confirmAndCreate() {
  if (!props.event) return
  await dispatch.createWorkOrderFromLeak(props.event.id, `抢修 ${props.event.eventNo}`, props.event.description || undefined)
  dispatch.addToast({ type: 'success', title: '工单已创建', message: '请尽快派发至抢修队' })
}

async function createWorkOrder() {
  if (!props.event) return
  await dispatch.createWorkOrderFromLeak(props.event.id, `抢修 ${props.event.eventNo}`, props.event.description || undefined)
}

function goToOrder() {
  if (relatedOrder.value) router.push('/repair')
}
</script>
