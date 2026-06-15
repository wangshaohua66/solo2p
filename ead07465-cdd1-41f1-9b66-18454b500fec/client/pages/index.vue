<template>
  <div class="h-full w-full flex">
    <div class="h-full relative" :class="showDrawer ? 'w-[70%]' : 'w-full lg:w-[70%]'">
      <DispatchMap
        ref="mapRef"
        :pipes="dispatch.pipes"
        :nodes="dispatch.monitorNodes"
        :leak-events="dispatch.leakEvents"
        :teams="dispatch.repairTeams"
        :outage-zones="dispatch.outageZones"
        :selected-leak-id="dispatch.selectedLeakId"
        @leak-click="onLeakClick"
        @team-click="onTeamClick"
        @node-click="onNodeClick"
      />

      <div class="absolute top-4 left-4 flex flex-col gap-2 z-10">
        <div class="card px-3 py-2">
          <div class="text-xs text-muted mb-1">管网总览</div>
          <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div><span class="text-muted">管线: </span><span class="font-semibold">{{ dispatch.pipes.length }}</span></div>
            <div><span class="text-muted">监测点: </span><span class="font-semibold">{{ dispatch.monitorNodes.length }}</span></div>
            <div><span class="text-muted">在线: </span><span class="text-success font-semibold">{{ onlineNodeCount }}</span></div>
            <div><span class="text-muted">告警: </span><span class="text-danger font-semibold">{{ alarmNodeCount }}</span></div>
          </div>
        </div>

        <div class="card px-3 py-2">
          <div class="text-xs text-muted mb-1">抢修资源</div>
          <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div><span class="text-muted">队伍: </span><span class="font-semibold">{{ dispatch.repairTeams.length }}</span></div>
            <div><span class="text-muted">空闲: </span><span class="text-success font-semibold">{{ dispatch.teamStatusCounts.Idle || 0 }}</span></div>
            <div><span class="text-muted">抢修中: </span><span class="text-warning font-semibold">{{ (dispatch.teamStatusCounts.Repairing || 0) + (dispatch.teamStatusCounts.OnSite || 0) }}</span></div>
            <div><span class="text-muted">阀门: </span><span class="font-semibold">{{ dispatch.valves.length }}</span></div>
          </div>
        </div>

        <div class="card px-3 py-2">
          <div class="text-xs text-muted mb-1">压力色阶</div>
          <div class="flex items-center gap-1 text-xs">
            <div class="w-3 h-3 rounded-full bg-[#3b82f6]"></div><span class="text-muted">偏低</span>
            <div class="w-3 h-3 rounded-full bg-[#22c55e] ml-2"></div><span class="text-muted">正常</span>
            <div class="w-3 h-3 rounded-full bg-[#eab308] ml-2"></div><span class="text-muted">偏高</span>
            <div class="w-3 h-3 rounded-full bg-[#ef4444] ml-2"></div><span class="text-muted">告警</span>
          </div>
        </div>
      </div>

      <div class="absolute bottom-4 left-4 card px-3 py-2 z-10">
        <div class="text-xs text-muted mb-1">抢修队状态</div>
        <div class="flex gap-3 text-xs">
          <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-success"></span>空闲</span>
          <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-info"></span>出勤</span>
          <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-warning"></span>到场</span>
          <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-danger"></span>抢修</span>
        </div>
      </div>
    </div>

    <div v-if="!showDrawer" class="hidden lg:flex h-full w-[30%] min-w-[380px] flex-col border-l border-color bg-secondary">
      <div class="flex items-center justify-between px-4 py-3 border-b border-color">
        <div>
          <div class="font-semibold text-primary">实时事件</div>
          <div class="text-xs text-muted">共 {{ activeEvents.length }} 条待处理</div>
        </div>
        <div class="flex gap-1">
          <button
            v-for="f in filters"
            :key="f.key"
            class="btn btn-sm"
            :class="activeFilter === f.key ? 'btn-primary' : 'btn-secondary'"
            @click="activeFilter = f.key"
          >{{ f.label }}</button>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-3">
        <div v-if="filteredEvents.length === 0" class="flex flex-col items-center justify-center h-full text-muted">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div class="text-sm mt-2">暂无事件</div>
        </div>

        <div v-else class="flex flex-col gap-3">
          <div
            v-for="event in filteredEvents"
            :key="event.id"
            class="card p-3 cursor-pointer transition-all hover:bg-hover"
            :class="{ 'flash-alarm': event.status === 'Detected' && (event.severity === 'Critical' || event.severity === 'High'), 'ring-2 ring-accent-primary': dispatch.selectedLeakId === event.id }"
            @click="selectEvent(event)"
          >
            <div class="flex items-start justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="badge" :class="severityBadge(event.severity)">{{ severityLabel(event.severity) }}</span>
                <span class="badge" :class="statusBadge(event.status)">{{ statusLabel(event.status) }}</span>
              </div>
              <span class="text-xs text-muted">{{ relativeTime(event.detectedAt) }}</span>
            </div>
            <div class="font-medium text-primary text-sm mb-1 truncate">{{ event.eventNo }} · {{ event.description || '疑似漏损事件' }}</div>
            <div class="grid grid-cols-2 gap-2 text-xs text-muted">
              <div>置信度: <span class="text-primary font-medium">{{ (event.confidence * 100).toFixed(0) }}%</span></div>
              <div>最近监测点: <span class="text-primary font-medium">{{ event.distanceToNearestNode != null ? (event.distanceToNearestNode).toFixed(0) + 'm' : '-' }}</span></div>
              <div>工单状态: <span class="text-primary font-medium">{{ getOrderStatus(event.relatedWorkOrderId) }}</span></div>
              <div>来源: <span class="text-primary font-medium">{{ event.source || '系统检测' }}</span></div>
            </div>
          </div>
        </div>
      </div>

      <div class="border-t border-color p-3">
        <div class="flex items-center justify-between text-xs">
          <span class="text-muted">待派发工单</span>
          <span class="font-semibold text-accent-warning">{{ pendingOrderCount }}</span>
        </div>
      </div>
    </div>

    <Transition name="slide-up">
      <EventDrawer v-if="showDrawer" :event="selectedEvent" @close="closeDrawer" />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { useDispatchStore } from '~/stores/dispatch'
import { getSeverityLabel, getStatusLabel, relativeTime } from '~/utils/api'
import type { LeakEvent } from '~/types'
import DispatchMap from '~/components/DispatchMap.vue'
import EventDrawer from '~/components/EventDrawer.vue'

const dispatch = useDispatchStore()
const mapRef = ref<InstanceType<typeof DispatchMap> | null>(null)

const activeFilter = ref('all')

const filters = [
  { key: 'all', label: '全部' },
  { key: 'unconfirmed', label: '待确认' },
  { key: 'repairing', label: '抢修中' }
]

const selectedEvent = ref<LeakEvent | null>(null)
const showDrawer = computed(() => selectedEvent.value != null)

const activeEvents = computed(() => dispatch.activeLeakEvents)

const filteredEvents = computed(() => {
  let list = activeEvents.value
  if (activeFilter.value === 'unconfirmed') list = list.filter(e => e.status === 'Detected')
  else if (activeFilter.value === 'repairing') list = list.filter(e => e.status === 'Repairing' || e.status === 'Confirmed')
  return list
})

const onlineNodeCount = computed(() => dispatch.monitorNodes.filter(n => n.isOnline).length)
const alarmNodeCount = computed(() => dispatch.monitorNodes.filter(n => n.hasAlarm).length)

const pendingOrderCount = computed(() =>
  dispatch.workOrders.filter(w => w.status === 'Created' || w.status === 'Dispatched').length
)

function severityLabel(s: string) { return getSeverityLabel(s) }
function statusLabel(s: string) { return getStatusLabel(s) }

function severityBadge(s: string): string {
  return s === 'Critical' ? 'badge-danger' : s === 'High' ? 'badge-warning' : s === 'Medium' ? 'badge-info' : 'badge-default'
}

function statusBadge(s: string): string {
  return s === 'Detected' ? 'badge-danger' : s === 'Confirmed' ? 'badge-warning' : s === 'Repairing' ? 'badge-info' : 'badge-success'
}

function getOrderStatus(orderId: string | null): string {
  if (!orderId) return '未创建'
  const order = dispatch.workOrders.find(w => w.id === orderId)
  return order ? getStatusLabel(order.status) : '未创建'
}

function selectEvent(event: LeakEvent) {
  selectedEvent.value = event
  dispatch.selectLeak(event.id)
  mapRef.value?.flyTo(event.longitude, event.latitude, 15)
}

function closeDrawer() {
  selectedEvent.value = null
  dispatch.selectLeak(null)
}

function onLeakClick(leak: LeakEvent) { selectEvent(leak) }
function onTeamClick() { /* team drawer */ }
function onNodeClick() { /* node drawer */ }
</script>
