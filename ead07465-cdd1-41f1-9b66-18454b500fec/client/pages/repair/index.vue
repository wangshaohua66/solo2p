<template>
  <div class="h-full w-full flex flex-col overflow-hidden">
    <div class="flex items-center justify-between px-4 py-3 border-b border-color bg-secondary">
      <div>
        <div class="text-lg font-semibold text-primary">工单调度面板</div>
        <div class="text-xs text-muted">待处理 {{ pendingCount }} · 进行中 {{ inProgressCount }} · 已完成 {{ completedCount }}</div>
      </div>
      <div class="flex gap-2">
        <select v-model="filters.priority" class="select w-28">
          <option value="">全部优先级</option>
          <option value="4">★★★★ 紧急</option>
          <option value="3">★★★ 高</option>
          <option value="2">★★ 中</option>
          <option value="1">★ 低</option>
        </select>
        <select v-model="filters.team" class="select w-40">
          <option value="">全部抢修队</option>
          <option v-for="t in dispatch.repairTeams" :key="t.id" :value="t.id">{{ t.teamName }}</option>
        </select>
        <button class="btn btn-primary" @click="showCreateModal = true">新建工单</button>
      </div>
    </div>

    <div class="flex-1 flex overflow-hidden">
      <div class="flex-1 flex overflow-hidden border-r border-color">
        <div
          v-for="column in columns"
          :key="column.key"
          class="flex-1 min-w-[220px] flex flex-col border-r border-color last:border-r-0"
        >
          <div class="px-3 py-2 bg-tertiary/50 border-b border-color flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full" :style="{ background: column.color }"></span>
              <span class="text-sm font-medium text-primary">{{ column.label }}</span>
            </div>
            <span class="text-xs text-muted bg-secondary px-2 py-0.5 rounded-full">{{ getColumnOrders(column.key).length }}</span>
          </div>
          <div class="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
            <div
              v-for="order in getColumnOrders(column.key)"
              :key="order.id"
              class="card p-3 cursor-pointer transition hover:bg-hover"
              :class="{ 'flash-alarm ring-2 ring-danger': order.isTimeoutEscalated, 'ring-2 ring-accent-primary': selectedOrderId === order.id }"
              draggable="true"
              @dragstart="onDragStart($event, order)"
              @dragover.prevent
              @drop="onDrop($event, column.key)"
              @click="selectOrder(order)"
            >
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-mono text-muted">{{ order.orderNo }}</span>
                <div class="flex items-center gap-1">
                  <span v-for="i in order.priority" :key="i" class="text-warning text-xs">★</span>
                </div>
              </div>
              <div class="text-sm font-medium text-primary mb-2 line-clamp-2 min-h-[40px]">{{ order.title }}</div>
              <div class="flex flex-wrap gap-1 mb-2">
                <span v-if="order.isTimeoutEscalated" class="badge badge-danger">超时</span>
                <span v-if="order.assignedTeam" class="badge badge-info text-xs">{{ order.assignedTeam.teamName }}</span>
                <span v-else class="badge badge-default text-xs">待派发</span>
              </div>
              <div class="flex items-center justify-between text-xs text-muted">
                <span>{{ formatDateTime(order.createdAt) }}</span>
                <span v-if="order.deadline" :class="{ 'text-danger': isOverdue(order) }">
                  {{ isOverdue(order) ? '已超时' : getDeadlineText(order) }}
                </span>
              </div>
            </div>
            <div v-if="getColumnOrders(column.key).length === 0" class="flex items-center justify-center h-24 text-xs text-muted border border-dashed border-color rounded-md">
              暂无工单
            </div>
          </div>
        </div>
      </div>

      <div class="w-[400px] flex flex-col bg-secondary">
        <div v-if="!selectedOrder" class="flex flex-col items-center justify-center h-full text-muted p-8 text-center">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="1"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <div class="text-sm mt-3">点击左侧工单查看详情</div>
          <div class="text-xs mt-1">或拖拽工单卡片变更状态</div>
        </div>
        <template v-else>
          <div class="px-4 py-3 border-b border-color">
            <div class="flex items-center justify-between mb-1">
              <span class="font-semibold text-primary">{{ selectedOrder.orderNo }}</span>
              <span class="badge" :class="statusBadge(selectedOrder.status)">{{ getStatusLabel(selectedOrder.status) }}</span>
            </div>
            <div class="text-sm text-secondary">{{ selectedOrder.title }}</div>
          </div>

          <div class="flex-1 overflow-y-auto p-4">
            <div class="mb-4">
              <div class="text-xs text-muted mb-2">基本信息</div>
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div><span class="text-muted">优先级: </span><span class="text-warning">{{ '★'.repeat(selectedOrder.priority) }}</span></div>
                <div><span class="text-muted">创建: </span>{{ formatDateTime(selectedOrder.createdAt) }}</div>
                <div><span class="text-muted">接单: </span>{{ selectedOrder.acceptedAt ? formatDateTime(selectedOrder.acceptedAt) : '-' }}</div>
                <div><span class="text-muted">到场: </span>{{ selectedOrder.onSiteAt ? formatDateTime(selectedOrder.onSiteAt) : '-' }}</div>
              </div>
              <div v-if="selectedOrder.description" class="mt-2">
                <div class="text-xs text-muted mb-1">描述</div>
                <div class="text-xs text-secondary">{{ selectedOrder.description }}</div>
              </div>
            </div>

            <div class="mb-4">
              <div class="text-xs text-muted mb-2">抢修队</div>
              <div v-if="!selectedOrder.assignedTeam" class="card p-3">
                <div class="text-sm text-secondary mb-2">尚未派发</div>
                <div class="flex gap-2">
                  <select v-model="selectedTeamId" class="select flex-1 text-xs">
                    <option value="">选择抢修队...</option>
                    <option v-for="t in dispatch.repairTeams.filter(x => x.status === 'Idle' || x.id === selectedOrder.assignedTeamId)" :key="t.id" :value="t.id">
                      {{ t.teamName }} ({{ t.leaderName }} · {{ getStatusLabel(t.status) }})
                    </option>
                  </select>
                  <button class="btn btn-primary btn-sm" :disabled="!selectedTeamId" @click="dispatchOrder">派发</button>
                </div>
              </div>
              <div v-else class="card p-3">
                <div class="flex items-center justify-between mb-1">
                  <span class="font-medium text-primary">{{ selectedOrder.assignedTeam.teamName }}</span>
                  <span class="badge badge-info">{{ getStatusLabel(selectedOrder.assignedTeam.status) }}</span>
                </div>
                <div class="text-xs text-muted">{{ selectedOrder.assignedTeam.leaderName }} · {{ selectedOrder.assignedTeam.leaderPhone }}</div>
              </div>
            </div>

            <div class="mb-4">
              <div class="text-xs text-muted mb-2">停水区域推演</div>
              <div v-if="!selectedOrder.outageZone" class="card p-3">
                <div class="text-sm text-secondary mb-2">尚未生成停水区域</div>
                <button class="btn btn-secondary btn-sm w-full" @click="simulateOutage">根据关阀方案推演</button>
              </div>
              <div v-else class="card p-3">
                <div class="text-sm font-medium text-primary mb-1">{{ selectedOrder.outageZone.zoneName }}</div>
                <div class="text-xs text-muted mb-2">预计影响 {{ selectedOrder.outageZone.estimatedUserCount }} 户</div>
                <div class="text-xs text-secondary bg-tertiary/40 rounded p-2 line-clamp-3">{{ selectedOrder.outageZone.notificationText }}</div>
                <div class="flex gap-2 mt-2">
                  <button class="btn btn-secondary btn-sm flex-1">编辑通知</button>
                  <button class="btn btn-primary btn-sm flex-1">审批停水</button>
                </div>
              </div>
            </div>

            <div>
              <div class="text-xs text-muted mb-2">状态流转</div>
              <div class="relative">
                <div class="absolute left-3 top-2 bottom-2 w-px bg-tertiary"></div>
                <div v-for="(log, i) in selectedOrder.statusLogs" :key="i" class="relative pl-8 pb-3 last:pb-0">
                  <div class="absolute left-1.5 top-1 w-3 h-3 rounded-full border-2 border-secondary" :style="{ background: getStatusColor(log.toStatus) }"></div>
                  <div class="text-sm text-primary">{{ getStatusLabel(log.toStatus) }}</div>
                  <div class="text-xs text-muted">{{ formatDateTime(log.createdAt) }}{{ log.remark ? ' · ' + log.remark : '' }}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="px-4 py-3 border-t border-color flex gap-2">
            <template v-if="canAdvance">
              <button class="btn btn-secondary flex-1" @click="regress">返回上一步</button>
              <button class="btn btn-primary flex-1" @click="advance">{{ nextActionLabel }}</button>
            </template>
            <template v-else>
              <button class="btn btn-secondary flex-1" @click="selectedOrderId = null">关闭</button>
            </template>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDispatchStore } from '~/stores/dispatch'
import { getStatusLabel, getStatusColor, formatDateTime } from '~/utils/api'
import type { RepairWorkOrder, WorkOrderStatus } from '~/types'

const dispatch = useDispatchStore()

const filters = reactive({ priority: '', team: '' })
const selectedOrderId = ref<string | null>(null)
const selectedTeamId = ref('')
const showCreateModal = ref(false)

const columns = [
  { key: 'Created', label: '待派发', color: '#6366f1' },
  { key: 'Dispatched', label: '已派发', color: '#8b5cf6' },
  { key: 'Accepted', label: '已接单', color: '#0ea5e9' },
  { key: 'OnSite', label: '已到场', color: '#f59e0b' },
  { key: 'Repairing', label: '修复中', color: '#ef4444' },
  { key: 'Completed', label: '待验收', color: '#22c55e' },
  { key: 'AcceptedClosed', label: '已关闭', color: '#10b981' }
]

const selectedOrder = computed(() => selectedOrderId.value ? dispatch.workOrders.find(w => w.id === selectedOrderId.value) || null : null)

const pendingCount = computed(() => dispatch.workOrders.filter(w => ['Created', 'Dispatched'].includes(w.status)).length)
const inProgressCount = computed(() => dispatch.workOrders.filter(w => ['Accepted', 'OnSite', 'Repairing'].includes(w.status)).length)
const completedCount = computed(() => dispatch.workOrders.filter(w => ['Completed', 'AcceptedClosed'].includes(w.status)).length)

function getColumnOrders(key: string) {
  let list = dispatch.workOrders.filter(w => w.status === key)
  if (filters.priority) list = list.filter(w => String(w.priority) === filters.priority)
  if (filters.team) list = list.filter(w => w.assignedTeamId === filters.team)
  return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

function selectOrder(order: RepairWorkOrder) {
  selectedOrderId.value = order.id
  selectedTeamId.value = order.assignedTeamId || ''
}

function statusBadge(s: string) {
  if (['Created', 'Dispatched'].includes(s)) return 'badge-warning'
  if (['Accepted', 'OnSite', 'Repairing'].includes(s)) return 'badge-info'
  if (['Completed', 'AcceptedClosed'].includes(s)) return 'badge-success'
  return 'badge-default'
}

function isOverdue(order: RepairWorkOrder) {
  return order.deadline && new Date(order.deadline) < new Date() && ['Created', 'Dispatched'].includes(order.status)
}

function getDeadlineText(order: RepairWorkOrder) {
  if (!order.deadline) return ''
  const diff = new Date(order.deadline).getTime() - Date.now()
  const mins = Math.ceil(diff / 60000)
  return mins < 60 ? `${mins} 分钟截止` : `${Math.ceil(mins / 60)} 小时截止`
}

const statusFlow: WorkOrderStatus[] = ['Created', 'Dispatched', 'Accepted', 'OnSite', 'Repairing', 'Completed', 'AcceptedClosed']

const canAdvance = computed(() => {
  if (!selectedOrder.value) return false
  const idx = statusFlow.indexOf(selectedOrder.value.status)
  return idx >= 0 && idx < statusFlow.length - 1
})

const nextActionLabel = computed(() => {
  if (!selectedOrder.value) return ''
  const idx = statusFlow.indexOf(selectedOrder.value.status)
  const next = statusFlow[idx + 1]
  return next ? getStatusLabel(next) : '完成'
})

function advance() {
  if (!selectedOrder.value || !canAdvance.value) return
  const idx = statusFlow.indexOf(selectedOrder.value.status)
  dispatch.updateWorkOrderStatus(selectedOrder.value.id, statusFlow[idx + 1])
}

function regress() {
  if (!selectedOrder.value) return
  const idx = statusFlow.indexOf(selectedOrder.value.status)
  if (idx > 0) dispatch.updateWorkOrderStatus(selectedOrder.value.id, statusFlow[idx - 1])
}

async function dispatchOrder() {
  if (!selectedOrder.value || !selectedTeamId.value) return
  await dispatch.dispatchWorkOrder(selectedOrder.value.id, selectedTeamId.value)
}

function simulateOutage() {
  if (!selectedOrder.value) return
  dispatch.addToast({ type: 'info', title: '推演中', message: '正在根据管网拓扑计算停水区域...', duration: 2000 })
}

let dragOrderId: string | null = null
function onDragStart(e: DragEvent, order: RepairWorkOrder) { dragOrderId = order.id }
function onDrop(e: DragEvent, status: string) {
  if (dragOrderId) dispatch.updateWorkOrderStatus(dragOrderId, status)
  dragOrderId = null
}
</script>

<style scoped>
.line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.line-clamp-3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
</style>
