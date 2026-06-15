<template>
  <div class="dispatch-board dark-theme">
    <div class="board-header">
      <div class="title">
        <span class="status-dot"></span>
        急救调度指挥中心
      </div>
      <div class="stats-bar">
        <div class="stat-item">
          <div class="stat-value pending">{{ dashboardStats.pendingCount || 0 }}</div>
          <div class="stat-label">待处理</div>
        </div>
        <div class="stat-item">
          <div class="stat-value ongoing">{{ dashboardStats.ongoingCount || 0 }}</div>
          <div class="stat-label">进行中</div>
        </div>
        <div class="stat-item">
          <div class="stat-value available">{{ dashboardStats.availableVehicles || 0 }}</div>
          <div class="stat-label">可用车辆</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ dashboardStats.completedToday || 0 }}</div>
          <div class="stat-label">今日完成</div>
        </div>
      </div>
    </div>

    <div class="board-content">
      <div class="call-queue">
        <div class="queue-header">
          <h3>
            <el-icon><Bell /></el-icon>
            呼入队列
            <span class="badge">{{ activeEvents.length }}</span>
          </h3>
        </div>
        <div class="queue-list">
          <div
            v-for="event in activeEvents"
            :key="event.id"
            class="call-item"
            :class="{
              active: selectedEvent?.id === event.id,
              'severity-critical': event.severity === 'CRITICAL'
            }"
            @click="selectEvent(event)"
          >
            <div class="caller-info">
              <span class="caller-name">{{ event.callerName }}</span>
              <span :class="['severity-tag', event.severity]">{{ severityText[event.severity] }}</span>
            </div>
            <div class="phone">{{ event.callerPhone }}</div>
            <div class="address">{{ event.incidentAddress }}</div>
            <div class="complaint">{{ event.chiefComplaint }}</div>
          </div>
        </div>
      </div>

      <div class="map-area">
        <div class="map-placeholder">
          <div class="map-grid"></div>
          <el-icon class="map-icon"><Location /></el-icon>
          <div class="map-text">地图组件加载中...</div>
        </div>

        <div class="vehicle-markers">
          <div
            v-for="vehicle in vehicleLocations"
            :key="vehicle.ambulanceId"
            class="vehicle-marker"
            :style="getVehiclePosition(vehicle)"
            :class="{ selected: selectedVehicleId === vehicle.ambulanceId }"
            @click="selectVehicle(vehicle.ambulanceId)"
          >
            <div :class="['marker-icon', getStatusClass(vehicle.status)]">
              <el-icon><Van /></el-icon>
            </div>
            <div class="marker-label">{{ vehicle.plateNumber }}</div>
          </div>
        </div>

        <div class="incident-markers">
          <div
            v-for="event in activeEvents"
            :key="'incident-' + event.id"
            class="incident-marker"
            :style="getIncidentPosition(event)"
          >
            <el-icon class="marker-pin"><LocationFilled /></el-icon>
            <div class="marker-label">{{ event.callerName }}</div>
          </div>
        </div>
      </div>

      <div class="event-detail">
        <template v-if="selectedEvent">
          <div class="detail-header">
            <div class="event-no">事件编号: {{ selectedEvent.eventNo }}</div>
            <div class="event-status">
              <span :class="['status-badge', selectedEvent.status]">
                {{ statusText[selectedEvent.status] }}
              </span>
              <span :class="['severity-tag', selectedEvent.severity]">
                {{ severityText[selectedEvent.severity] }}
              </span>
            </div>
          </div>

          <div class="detail-body">
            <div class="section">
              <div class="section-title">呼救信息</div>
              <div class="info-row">
                <span class="label">姓名</span>
                <span class="value">{{ selectedEvent.callerName }}</span>
              </div>
              <div class="info-row">
                <span class="label">电话</span>
                <span class="value">{{ selectedEvent.callerPhone }}</span>
              </div>
              <div class="info-row">
                <span class="label">地址</span>
                <span class="value">{{ selectedEvent.incidentAddress }}</span>
              </div>
              <div class="info-row">
                <span class="label">主诉</span>
                <span class="value">{{ selectedEvent.chiefComplaint }}</span>
              </div>
            </div>

            <div class="section" v-if="selectedEvent.ambulance">
              <div class="section-title">派车信息</div>
              <div class="info-row">
                <span class="label">车牌号</span>
                <span class="value">{{ selectedEvent.ambulance.plateNumber }}</span>
              </div>
              <div class="info-row">
                <span class="label">车辆状态</span>
                <span class="value">{{ statusText[selectedEvent.ambulance.status as keyof typeof statusText] }}</span>
              </div>
              <div class="info-row">
                <span class="label">司机</span>
                <span class="value">{{ selectedEvent.ambulance.driverName || '-' }}</span>
              </div>
            </div>

            <div class="section">
              <div class="section-title">时间线</div>
              <div class="timeline">
                <div
                  v-for="(item, index) in timelineItems"
                  :key="index"
                  class="timeline-item"
                  :class="{ completed: item.completed, current: item.current }"
                >
                  <div class="timeline-dot"></div>
                  <div class="timeline-content">
                    <div class="status-text">{{ item.text }}</div>
                    <div class="status-time">{{ item.time || '未完成' }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="detail-actions">
            <div class="action-row" v-if="selectedEvent.status === 'PENDING'">
              <el-button type="primary" size="default" @click="openDispatchDialog">
                <el-icon><Van /></el-icon>
                派车
              </el-button>
            </div>
            <div class="action-row" v-if="selectedEvent.status === 'DISPATCHED'">
              <el-button type="primary" size="default" @click="updateStatus('EN_ROUTE')">
                确认出车
              </el-button>
              <el-button size="default" @click="openReassignDialog">改派</el-button>
            </div>
            <div class="action-row" v-if="selectedEvent.status === 'EN_ROUTE'">
              <el-button type="primary" size="default" @click="updateStatus('ON_SCENE')">
                到达现场
              </el-button>
            </div>
            <div class="action-row" v-if="selectedEvent.status === 'ON_SCENE'">
              <el-button type="primary" size="default" @click="updateStatus('TRANSPORTING')">
                离开现场
              </el-button>
            </div>
            <div class="action-row" v-if="selectedEvent.status === 'TRANSPORTING'">
              <el-button type="primary" size="default" @click="updateStatus('ARRIVED_HOSPITAL')">
                到达医院
              </el-button>
            </div>
            <div class="action-row" v-if="selectedEvent.status === 'ARRIVED_HOSPITAL'">
              <el-button type="success" size="default" @click="updateStatus('COMPLETED')">
                完成交接
              </el-button>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="no-selection">
            <el-icon :size="48" color="#6b7280"><Document /></el-icon>
            <p>请从左侧选择一个事件查看详情</p>
          </div>
        </template>
      </div>
    </div>

    <el-dialog
      v-model="dispatchDialogVisible"
      title="派车指令"
      width="600px"
      @closed="loadNearbyVehicles"
    >
      <el-form :model="dispatchForm" label-width="100px">
        <el-form-item label="目标医院">
          <el-select v-model="dispatchForm.hospitalId" placeholder="请选择医院" style="width: 100%">
            <el-option
              v-for="h in hospitals"
              :key="h.id"
              :label="h.name"
              :value="h.id"
            />
          </el-select>
        </el-form-item>
      </el-form>

      <div class="vehicle-recommendation">
        <h4>推荐车辆 ({{ nearbyVehicles.length }}辆)</h4>
        <el-table :data="nearbyVehicles" height="300px" @row-click="handleVehicleSelect">
          <el-table-column prop="plateNumber" label="车牌号" width="100" />
          <el-table-column label="距离">
            <template #default="{ row }">
              {{ (row.distanceMeters / 1000).toFixed(2) }} km
            </template>
          </el-table-column>
          <el-table-column label="预计到达">
            <template #default="{ row }">
              {{ row.estimatedArrivalMinutes }} 分钟
            </template>
          </el-table-column>
          <el-table-column prop="equipmentLevel" label="装备等级" />
          <el-table-column label="操作" width="80">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click="confirmDispatch(row.ambulanceId)">
                派车
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <template #footer>
        <el-button @click="dispatchDialogVisible = false">取消</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElNotification } from 'element-plus'
import {
  getActiveEvents,
  getEventDetail,
  getDashboard,
  findNearbyVehicles,
  dispatchVehicle,
  updateEventStatus,
  getAllVehiclesLocation
} from '@/api/dispatch'
import type {
  DispatchEventSummary,
  DispatchEventDetail,
  VehicleRecommendation,
  VehicleStatusUpdate,
  NearbyVehicleRequest,
  EventStatusUpdateRequest
} from '@/types/dispatch'
import {
  Bell,
  Location,
  LocationFilled,
  Van,
  Document
} from '@element-plus/icons-vue'
import type { Client } from '@stomp/stompjs'
import Stomp from 'stompjs'
import SockJS from 'sockjs-client'

const activeEvents = ref<DispatchEventSummary[]>([])
const selectedEvent = ref<DispatchEventDetail | null>(null)
const vehicleLocations = ref<VehicleStatusUpdate[]>([])
const selectedVehicleId = ref<number | null>(null)
const nearbyVehicles = ref<VehicleRecommendation[]>([])
const dashboardStats = reactive({
  pendingCount: 0,
  ongoingCount: 0,
  availableVehicles: 0,
  completedToday: 0
})

const dispatchDialogVisible = ref(false)
const dispatchForm = reactive({
  hospitalId: null as number | null
})

const hospitals = ref([
  { id: 1, name: '市第一人民医院' },
  { id: 2, name: '市第二人民医院' },
  { id: 3, name: '市中医院' },
  { id: 4, name: '市妇幼保健院' }
])

const statusText: Record<string, string> = {
  PENDING: '待派车',
  DISPATCHED: '已派车',
  EN_ROUTE: '出车中',
  ON_SCENE: '在现场',
  TRANSPORTING: '转运中',
  ARRIVED_HOSPITAL: '已到院',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  AVAILABLE: '可用',
  ON_CALL: '执行任务',
  MAINTENANCE: '维修中'
}

const severityText: Record<string, string> = {
  MINOR: '轻伤',
  MODERATE: '中等',
  SEVERE: '重伤',
  CRITICAL: '危重'
}

const timelineItems = computed(() => {
  if (!selectedEvent.value) return []
  const items = [
    { status: 'PENDING', text: '接警', time: selectedEvent.value.receivedAt },
    { status: 'DISPATCHED', text: '派车', time: selectedEvent.value.dispatchedAt },
    { status: 'EN_ROUTE', text: '出车', time: selectedEvent.value.departedAt },
    { status: 'ON_SCENE', text: '到达现场', time: selectedEvent.value.arrivedAtScene },
    { status: 'TRANSPORTING', text: '离开现场', time: selectedEvent.value.departedScene },
    { status: 'ARRIVED_HOSPITAL', text: '到达医院', time: selectedEvent.value.arrivedAtHospital },
    { status: 'COMPLETED', text: '交接完成', time: selectedEvent.value.completedAt }
  ]

  const statusOrder = ['PENDING', 'DISPATCHED', 'EN_ROUTE', 'ON_SCENE', 'TRANSPORTING', 'ARRIVED_HOSPITAL', 'COMPLETED']
  const currentIndex = statusOrder.indexOf(selectedEvent.value.status)

  return items.map((item, index) => ({
    ...item,
    completed: index < currentIndex,
    current: index === currentIndex
  }))
})

let stompClient: Client | null = null
let refreshTimer: number | null = null

function selectEvent(event: DispatchEventSummary) {
  getEventDetail(event.id).then(detail => {
    selectedEvent.value = detail
  })
}

function selectVehicle(id: number) {
  selectedVehicleId.value = id
}

function getVehiclePosition(vehicle: VehicleStatusUpdate) {
  const x = ((vehicle.longitude - 116.3) / 0.2) * 100
  const y = ((40.1 - vehicle.latitude) / 0.1) * 100
  return {
    left: `${Math.max(10, Math.min(90, x))}%`,
    top: `${Math.max(10, Math.min(90, y))}%`
  }
}

function getIncidentPosition(event: DispatchEventSummary) {
  const x = ((116.38 - 116.3) / 0.2) * 100
  const y = ((40.05 - 40.1) / 0.1) * 100 + Math.random() * 30
  return {
    left: `${Math.max(15, Math.min(85, x))}%`,
    top: `${Math.max(20, Math.min(80, y))}%`
  }
}

function getStatusClass(status: string) {
  const map: Record<string, string> = {
    AVAILABLE: 'available',
    ON_CALL: 'on-call',
    ON_SCENE: 'on-scene',
    TRANSPORTING: 'transporting',
    MAINTENANCE: 'maintenance'
  }
  return map[status] || 'available'
}

async function loadData() {
  try {
    const [events, dashboard, locations] = await Promise.all([
      getActiveEvents(0, 50),
      getDashboard(),
      getAllVehiclesLocation()
    ])
    activeEvents.value = events.content
    Object.assign(dashboardStats, dashboard)
    vehicleLocations.value = Array.from(locations.values())
  } catch (error) {
    console.error('Failed to load data:', error)
  }
}

async function loadNearbyVehicles() {
  if (!selectedEvent.value?.longitude || !selectedEvent.value?.latitude) return
  const request: NearbyVehicleRequest = {
    longitude: selectedEvent.value.longitude,
    latitude: selectedEvent.value.latitude,
    radiusKm: 5.0,
    statuses: ['AVAILABLE']
  }
  nearbyVehicles.value = await findNearbyVehicles(request)
}

function openDispatchDialog() {
  dispatchForm.hospitalId = null
  dispatchDialogVisible.value = true
}

function openReassignDialog() {
  openDispatchDialog()
}

function handleVehicleSelect(vehicle: VehicleRecommendation) {
  confirmDispatch(vehicle.ambulanceId)
}

async function confirmDispatch(ambulanceId: number) {
  if (!selectedEvent.value) return
  try {
    const result = await dispatchVehicle({
      eventId: selectedEvent.value.id,
      ambulanceId,
      hospitalId: dispatchForm.hospitalId || undefined
    })
    selectedEvent.value = result
    dispatchDialogVisible.value = false
    ElMessage.success('派车成功')
    loadData()
  } catch (error) {
    console.error('Dispatch failed:', error)
  }
}

async function updateStatus(status: string) {
  if (!selectedEvent.value) return
  try {
    const request: EventStatusUpdateRequest = {
      status: status as any,
      remark: '状态更新'
    }
    const result = await updateEventStatus(selectedEvent.value.id, request)
    selectedEvent.value = result
    ElMessage.success('状态更新成功')
    loadData()
  } catch (error) {
    console.error('Status update failed:', error)
  }
}

function connectWebSocket() {
  try {
    const socket = new SockJS('/ws/ems')
    stompClient = Stomp.over(socket) as Client
    stompClient.connect({}, () => {
      stompClient!.subscribe('/topic/dispatch/events', (message) => {
        const data = JSON.parse(message.body)
        ElNotification({
          title: '调度事件更新',
          message: data.message || '事件状态已更新',
          type: 'info'
        })
        loadData()
        if (selectedEvent.value?.id === data.eventId) {
          getEventDetail(data.eventId).then(detail => {
            selectedEvent.value = detail
          })
        }
      })

      stompClient!.subscribe('/topic/vehicle/locations', (message) => {
        const locations = JSON.parse(message.body)
        vehicleLocations.value = Array.from(locations.values())
      })
    })
  } catch (error) {
    console.error('WebSocket connection failed:', error)
  }
}

onMounted(() => {
  loadData()
  connectWebSocket()
  refreshTimer = window.setInterval(loadData, 5000)
})

onUnmounted(() => {
  if (stompClient) {
    stompClient.disconnect()
  }
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }
})
</script>

<style scoped lang="scss">
.vehicle-recommendation {
  margin-top: 16px;

  h4 {
    margin: 0 0 12px;
    font-size: 14px;
    color: #374151;
  }
}

.no-selection {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #6b7280;

  p {
    margin-top: 16px;
    font-size: 14px;
  }
}
</style>
