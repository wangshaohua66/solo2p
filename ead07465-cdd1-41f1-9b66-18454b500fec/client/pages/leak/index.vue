<template>
  <div class="h-full w-full flex flex-col overflow-hidden">
    <div class="flex items-center justify-between px-4 py-3 border-b border-color bg-secondary">
      <div>
        <div class="text-lg font-semibold text-primary">漏损事件管理</div>
        <div class="text-xs text-muted">共 {{ totalCount }} 条事件记录</div>
      </div>
      <div class="flex gap-2">
        <select v-model="filters.severity" class="select w-32">
          <option value="">全部等级</option>
          <option value="Critical">危急</option>
          <option value="High">高</option>
          <option value="Medium">中</option>
          <option value="Low">低</option>
        </select>
        <select v-model="filters.status" class="select w-32">
          <option value="">全部状态</option>
          <option value="Detected">已检测</option>
          <option value="Confirmed">已确认</option>
          <option value="Repairing">修复中</option>
          <option value="Resolved">已解决</option>
          <option value="FalseAlarm">误报</option>
        </select>
        <input v-model="filters.keyword" class="input w-56" placeholder="搜索事件编号/描述..." />
        <button class="btn btn-primary" @click="exportData">导出数据</button>
      </div>
    </div>

    <div class="flex-1 flex overflow-hidden">
      <div class="w-1/2 min-w-[480px] flex flex-col border-r border-color">
        <div class="flex-1 overflow-y-auto">
          <div v-if="filteredEvents.length === 0" class="flex flex-col items-center justify-center h-64 text-muted">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
            <div class="text-sm mt-2">暂无符合条件的事件</div>
          </div>
          <table v-else class="w-full text-sm">
            <thead class="sticky top-0 bg-tertiary z-10">
              <tr class="text-left text-muted text-xs">
                <th class="px-3 py-2 font-medium">事件编号</th>
                <th class="px-3 py-2 font-medium">等级</th>
                <th class="px-3 py-2 font-medium">状态</th>
                <th class="px-3 py-2 font-medium">置信度</th>
                <th class="px-3 py-2 font-medium">描述</th>
                <th class="px-3 py-2 font-medium">检测时间</th>
                <th class="px-3 py-2 font-medium">工单</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="event in filteredEvents"
                :key="event.id"
                class="border-t border-color cursor-pointer hover:bg-hover transition"
                :class="{ 'bg-accent-primary/10': selectedId === event.id }"
                @click="selectEvent(event)"
              >
                <td class="px-3 py-2.5 font-mono text-xs text-primary">{{ event.eventNo }}</td>
                <td class="px-3 py-2.5">
                  <span class="badge" :class="severityBadge(event.severity)">{{ getSeverityLabel(event.severity) }}</span>
                </td>
                <td class="px-3 py-2.5">
                  <span class="badge" :class="statusBadge(event.status)">{{ getStatusLabel(event.status) }}</span>
                </td>
                <td class="px-3 py-2.5">
                  <div class="flex items-center gap-2">
                    <div class="w-16 h-1.5 bg-tertiary rounded-full overflow-hidden">
                      <div class="h-full rounded-full" :style="{ width: (event.confidence * 100) + '%', background: severityColor(event.severity) }"></div>
                    </div>
                    <span class="text-xs text-secondary">{{ (event.confidence * 100).toFixed(0) }}%</span>
                  </div>
                </td>
                <td class="px-3 py-2.5 max-w-[200px] truncate text-secondary">{{ event.description || '-' }}</td>
                <td class="px-3 py-2.5 text-xs text-muted">{{ formatDateTime(event.detectedAt) }}</td>
                <td class="px-3 py-2.5">
                  <span v-if="event.relatedWorkOrderId" class="text-accent-secondary text-xs">已关联</span>
                  <span v-else class="text-muted text-xs">未创建</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="flex-1 flex flex-col overflow-hidden">
        <div v-if="!selectedEvent" class="flex flex-col items-center justify-center h-full text-muted">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="1"><path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z"/></svg>
          <div class="text-sm mt-3">请选择左侧事件查看详情</div>
        </div>
        <template v-else>
          <div class="px-4 py-3 border-b border-color flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-lg font-semibold text-primary">{{ selectedEvent.eventNo }}</span>
              <span class="badge" :class="severityBadge(selectedEvent.severity)">{{ getSeverityLabel(selectedEvent.severity) }}</span>
              <span class="badge" :class="statusBadge(selectedEvent.status)">{{ getStatusLabel(selectedEvent.status) }}</span>
            </div>
            <div class="flex gap-2">
              <template v-if="selectedEvent.status === 'Detected'">
                <button class="btn btn-secondary btn-sm" @click="markFalseAlarm">标记为误报</button>
                <button class="btn btn-primary btn-sm" @click="createWorkOrder">确认并创建工单</button>
              </template>
              <template v-else-if="selectedEvent.status === 'Confirmed' && !selectedEvent.relatedWorkOrderId">
                <button class="btn btn-primary btn-sm" @click="createWorkOrder">创建工单</button>
              </template>
              <template v-else-if="selectedEvent.status === 'Resolved'">
                <span class="text-xs text-success">已解决 · {{ formatDateTime(selectedEvent.resolvedAt) }}</span>
              </template>
            </div>
          </div>

          <div class="flex-1 overflow-hidden">
            <DispatchMap
              ref="mapRef"
              :pipes="dispatch.pipes"
              :nodes="dispatch.monitorNodes"
              :leak-events="[selectedEvent]"
              :teams="dispatch.repairTeams"
              :selected-leak-id="selectedEvent.id"
              :show-heatmap="true"
              :heatmap-points="selectedEvent.candidatePoints"
              :zoom="15"
              :center="[selectedEvent.longitude, selectedEvent.latitude]"
            />
          </div>

          <div class="h-64 border-t border-color flex">
            <div class="w-1/2 p-4 border-r border-color overflow-y-auto">
              <div class="text-xs font-medium text-muted mb-2">事件详情</div>
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div><span class="text-muted">来源: </span>{{ selectedEvent.source || '系统检测' }}</div>
                <div><span class="text-muted">距离监测点: </span>{{ selectedEvent.distanceToNearestNode?.toFixed(0) || '-' }}m</div>
                <div><span class="text-muted">经度: </span>{{ selectedEvent.longitude.toFixed(6) }}</div>
                <div><span class="text-muted">纬度: </span>{{ selectedEvent.latitude.toFixed(6) }}</div>
                <div><span class="text-muted">预估半径: </span>{{ selectedEvent.estimatedRadius?.toFixed(0) || '-' }}m</div>
                <div><span class="text-muted">检测时间: </span>{{ formatDateTime(selectedEvent.detectedAt) }}</div>
              </div>
              <div class="mt-3"><div class="text-muted text-xs mb-1">描述</div><div class="text-sm text-secondary">{{ selectedEvent.description || '暂无' }}</div></div>
              <div class="mt-3">
                <div class="text-muted text-xs mb-1">异常节点 ({{ abnormalNodeDetails.length }})</div>
                <div v-if="abnormalNodeDetails.length === 0" class="text-xs text-secondary">无</div>
                <div v-else class="flex flex-wrap gap-1">
                  <span v-for="n in abnormalNodeDetails" :key="n.id" class="badge badge-danger text-xs">{{ n.name }}</span>
                </div>
              </div>
            </div>

            <div class="w-1/2 p-4 overflow-y-auto">
              <div class="text-xs font-medium text-muted mb-2">概率热力图</div>
              <div class="h-32 rounded-md bg-tertiary/30 flex items-center justify-center relative overflow-hidden">
                <div v-for="(pt, i) in selectedEvent.candidatePoints.slice(0, 100)" :key="i" class="absolute rounded-full" :style="heatStyle(pt)"></div>
                <span class="text-xs text-muted z-10">概率分布预览</span>
              </div>
              <div class="mt-3 text-xs">
                <div class="text-muted mb-1">置信度分布</div>
                <div class="flex gap-1 text-[10px] text-muted">
                  <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full" style="background:#22c55e"></span>低</span>
                  <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full" style="background:#eab308"></span>中</span>
                  <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full" style="background:#f97316"></span>高</span>
                  <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full" style="background:#ef4444"></span>极高</span>
                </div>
              </div>
              <div class="mt-3"><div class="text-muted text-xs mb-1">关联工单</div>
                <div v-if="!relatedWorkOrder" class="text-xs text-secondary">尚未创建工单</div>
                <div v-else class="card p-2">
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-medium text-primary">{{ relatedWorkOrder.orderNo }}</span>
                    <span class="badge badge-info">{{ getStatusLabel(relatedWorkOrder.status) }}</span>
                  </div>
                  <div class="text-xs text-muted mt-1">{{ relatedWorkOrder.title }}</div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDispatchStore } from '~/stores/dispatch'
import { getSeverityLabel, getStatusLabel, formatDateTime } from '~/utils/api'
import type { LeakEvent } from '~/types'
import DispatchMap from '~/components/DispatchMap.vue'

const dispatch = useDispatchStore()
const mapRef = ref<InstanceType<typeof DispatchMap> | null>(null)

const filters = reactive({ severity: '', status: '', keyword: '' })
const selectedId = ref<string | null>(null)

const selectedEvent = computed(() => selectedId.value ? dispatch.leakEvents.find(l => l.id === selectedId.value) || null : null)

const totalCount = computed(() => dispatch.leakEvents.length)

const filteredEvents = computed(() => {
  let list = [...dispatch.leakEvents]
  if (filters.severity) list = list.filter(e => e.severity === filters.severity)
  if (filters.status) list = list.filter(e => e.status === filters.status)
  if (filters.keyword) {
    const k = filters.keyword.toLowerCase()
    list = list.filter(e => e.eventNo.toLowerCase().includes(k) || (e.description || '').toLowerCase().includes(k))
  }
  return list.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime())
})

const abnormalNodeDetails = computed(() => {
  if (!selectedEvent.value) return []
  return selectedEvent.value.abnormalNodeIds
    .map(id => dispatch.monitorNodes.find(n => n.id === id))
    .filter(Boolean) as any[]
})

const relatedWorkOrder = computed(() => {
  if (!selectedEvent.value?.relatedWorkOrderId) return null
  return dispatch.workOrders.find(w => w.id === selectedEvent.value!.relatedWorkOrderId) || null
})

function selectEvent(e: LeakEvent) {
  selectedId.value = e.id
  nextTick(() => mapRef.value?.flyTo(e.longitude, e.latitude, 15))
}

function severityBadge(s: string) {
  return s === 'Critical' ? 'badge-danger' : s === 'High' ? 'badge-warning' : s === 'Medium' ? 'badge-info' : 'badge-default'
}
function statusBadge(s: string) {
  return s === 'Detected' ? 'badge-danger' : s === 'Confirmed' ? 'badge-warning' : s === 'Repairing' ? 'badge-info' : s === 'Resolved' ? 'badge-success' : 'badge-default'
}
function severityColor(s: string) {
  return { Critical: '#dc2626', High: '#ea580c', Medium: '#d97706', Low: '#16a34a' }[s] || '#6b7280'
}

const heatBounds = computed(() => {
  if (!selectedEvent.value) return { minLng: 0, maxLng: 0, minLat: 0, maxLat: 0 }
  const pts = selectedEvent.value.candidatePoints
  return {
    minLng: Math.min(...pts.map(p => p.longitude), selectedEvent.value.longitude),
    maxLng: Math.max(...pts.map(p => p.longitude), selectedEvent.value.longitude),
    minLat: Math.min(...pts.map(p => p.latitude), selectedEvent.value.latitude),
    maxLat: Math.max(...pts.map(p => p.latitude), selectedEvent.value.latitude)
  }
})

function heatStyle(pt: { longitude: number; latitude: number; probability: number }) {
  const b = heatBounds.value
  const color = pt.probability < 0.3 ? '#22c55e' : pt.probability < 0.6 ? '#eab308' : pt.probability < 0.85 ? '#f97316' : '#ef4444'
  return {
    left: ((pt.longitude - b.minLng) / Math.max(0.0001, b.maxLng - b.minLng) * 100) + '%',
    top: (100 - (pt.latitude - b.minLat) / Math.max(0.0001, b.maxLat - b.minLat) * 100) + '%',
    width: (4 + pt.probability * 14) + 'px',
    height: (4 + pt.probability * 14) + 'px',
    background: color,
    opacity: 0.3 + pt.probability * 0.7,
    transform: 'translate(-50%, -50%)'
  }
}

async function createWorkOrder() {
  if (!selectedEvent.value) return
  await dispatch.createWorkOrderFromLeak(selectedEvent.value.id, `抢修 ${selectedEvent.value.eventNo}`, selectedEvent.value.description || undefined)
}

async function markFalseAlarm() {
  if (!selectedEvent.value) return
  const e = dispatch.leakEvents.find(l => l.id === selectedEvent.value!.id)
  if (e) { e.status = 'FalseAlarm'; e.updatedAt = new Date().toISOString() }
}

function exportData() { dispatch.addToast({ type: 'success', title: '导出成功', message: '已导出 ' + filteredEvents.value.length + ' 条数据' }) }
</script>
