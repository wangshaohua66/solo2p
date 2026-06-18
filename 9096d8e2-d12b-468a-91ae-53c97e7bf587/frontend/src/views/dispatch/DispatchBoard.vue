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
        <div ref="mapContainer" class="map-container"></div>
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
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
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
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const DEFAULT_CENTER = [39.9042, 116.4074] as [number, number]
const DEFAULT_ZOOM = 12

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
  ON_SCENE_STATUS: '在现场',
  TRANSPORTING_STATUS: '转运中',
  AT_HOSPITAL: '已到院',
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
let mapInstance: L.Map | null = null
const mapContainer = ref<HTMLDivElement | null>(null)
const vehicleMarkers = new Map<number, L.Marker>()
const incidentMarkers = new Map<number, L.Marker>()
const geofenceCircles = new Map<string, L.Circle>()

function createAmbulanceIcon(status: string): L.DivIcon {
  const colorMap: Record<string, string> = {
    AVAILABLE: '#22c55e',
    ON_CALL: '#3b82f6',
    ON_SCENE_STATUS: '#f59e0b',
    TRANSPORTING_STATUS: '#8b5cf6',
    ON_SCENE: '#f59e0b',
    TRANSPORTING: '#8b5cf6',
    AT_HOSPITAL: '#10b981',
    MAINTENANCE: '#ef4444'
  }
  const bgColor = colorMap[status] || '#6b7280'

  return L.divIcon({
    className: 'custom-vehicle-marker',
    html: `
      <div style="
        background: ${bgColor};
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 20px;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        position: relative;
      ">
        🚑
        <div style="
          position: absolute;
          bottom: -6px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 6px solid ${bgColor};
        "></div>
      </div>
    `,
    iconSize: [40, 46],
    iconAnchor: [20, 46],
    popupAnchor: [0, -46]
  })
}

function createIncidentIcon(severity: string): L.DivIcon {
  const colorMap: Record<string, string> = {
    MINOR: '#22c55e',
    MODERATE: '#f59e0b',
    SEVERE: '#ef4444',
    CRITICAL: '#dc2626'
  }
  const bgColor = colorMap[severity] || '#ef4444'

  return L.divIcon({
    className: 'custom-incident-marker',
    html: `
      <div style="
        background: ${bgColor};
        width: 36px;
        height: 36px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 18px;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        animation: pulse-${severity === 'CRITICAL' ? 'fast' : 'normal'} 1.5s ease-in-out infinite;
      ">
        <span style="transform: rotate(45deg);">📍</span>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36]
  })
}

function initMap() {
  if (!mapContainer.value) return

  mapInstance = L.map(mapContainer.value, {
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    zoomControl: true,
    attributionControl: true
  })

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    minZoom: 3
  }).addTo(mapInstance)

  L.control.scale({
    imperial: false,
    metric: true,
    position: 'bottomleft'
  }).addTo(mapInstance)
}

function updateVehicleMarkers() {
  if (!mapInstance) return

  vehicleLocations.value.forEach(vehicle => {
    const lat = vehicle.latitude
    const lng = vehicle.longitude
    if (!lat || !lng) return

    const markerStatus = getMarkerStatus(vehicle.status)
    const icon = createAmbulanceIcon(markerStatus)
    const latLng: L.LatLngTuple = [lat, lng]

    const existing = vehicleMarkers.get(vehicle.ambulanceId)
    if (existing) {
      existing.setLatLng(latLng)
      existing.setIcon(icon)
      existing.setPopupContent(`
        <div style="padding: 8px; min-width: 160px;">
          <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px;">${vehicle.plateNumber}</div>
          <div style="font-size: 12px; color: #6b7280;">状态: ${statusText[vehicle.status] || vehicle.status}</div>
          <div style="font-size: 12px; color: #6b7280;">速度: ${vehicle.speedKmh || 0} km/h</div>
          <div style="font-size: 12px; color: #6b7280;">更新: ${new Date(vehicle.timestamp).toLocaleTimeString()}</div>
        </div>
      `)
    } else {
      const marker = L.marker(latLng, { icon })
        .addTo(mapInstance!)
        .bindPopup('')
        .on('click', () => {
          selectedVehicleId.value = vehicle.ambulanceId
        })
      vehicleMarkers.set(vehicle.ambulanceId, marker)
      marker.fire('click')
    }
  })

  const removedIds: number[] = []
  vehicleMarkers.forEach((marker, id) => {
    const exists = vehicleLocations.value.some(v => v.ambulanceId === id)
    if (!exists) {
      mapInstance!.removeLayer(marker)
      removedIds.push(id)
    }
  })
  removedIds.forEach(id => vehicleMarkers.delete(id))
}

function getMarkerStatus(status: string): string {
  const statusMap: Record<string, string> = {
    ON_CALL: 'ON_CALL',
    ON_SCENE: 'ON_SCENE_STATUS',
    TRANSPORTING: 'TRANSPORTING_STATUS',
    AT_HOSPITAL: 'AT_HOSPITAL'
  }
  return statusMap[status] || status
}

function updateIncidentMarkers() {
  if (!mapInstance) return

  activeEvents.value.forEach(event => {
    const lat = event.latitude
    const lng = event.longitude
    if (!lat || !lng) return

    const icon = createIncidentIcon(event.severity)
    const latLng: L.LatLngTuple = [lat, lng]

    const existing = incidentMarkers.get(event.id)
    if (existing) {
      existing.setLatLng(latLng)
      existing.setIcon(icon)
      existing.setPopupContent(`
        <div style="padding: 8px; min-width: 200px;">
          <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px; color: ${getSeverityColor(event.severity)};">
            ${event.callerName} - ${severityText[event.severity]}
          </div>
          <div style="font-size: 12px; color: #6b7280;">电话: ${event.callerPhone}</div>
          <div style="font-size: 12px; color: #6b7280;">地址: ${event.incidentAddress}</div>
          <div style="font-size: 12px; color: #6b7280;">主诉: ${event.chiefComplaint}</div>
          <div style="margin-top: 6px; font-size: 11px;">
            <span style="display: inline-block; padding: 2px 8px; background: #eff6ff; color: #2563eb; border-radius: 4px;">
              ${statusText[event.status]}
            </span>
          </div>
        </div>
      `)
    } else {
      const marker = L.marker(latLng, { icon })
        .addTo(mapInstance!)
        .bindPopup('')
        .on('click', () => {
          selectEvent(event)
        })
      incidentMarkers.set(event.id, marker)
    }
  })

  const removedIds: number[] = []
  incidentMarkers.forEach((marker, id) => {
    const exists = activeEvents.value.some(e => e.id === id)
    if (!exists) {
      mapInstance!.removeLayer(marker)
      removedIds.push(id)
    }
  })
  removedIds.forEach(id => incidentMarkers.delete(id))
}

function getSeverityColor(severity: string): string {
  const colorMap: Record<string, string> = {
    MINOR: '#22c55e',
    MODERATE: '#f59e0b',
    SEVERE: '#ef4444',
    CRITICAL: '#dc2626'
  }
  return colorMap[severity] || '#374151'
}

function updateGeofenceCircles() {
  if (!mapInstance) return

  geofenceCircles.forEach(circle => mapInstance!.removeLayer(circle))
  geofenceCircles.clear()

  const geofenceRadius = 50

  activeEvents.value.forEach(event => {
    if (event.status !== 'EN_ROUTE' || !event.latitude || !event.longitude) return

    const sceneCircle = L.circle([event.latitude, event.longitude], {
      color: '#3b82f6',
      fillColor: '#3b82f6',
      fillOpacity: 0.1,
      weight: 2,
      radius: geofenceRadius,
      dashArray: '5, 5'
    }).addTo(mapInstance!)

    geofenceCircles.set(`scene-${event.id}`, sceneCircle)

    if (event.hospital?.latitude && event.hospital?.longitude) {
      const hospitalCircle = L.circle([event.hospital.latitude, event.hospital.longitude], {
        color: '#10b981',
        fillColor: '#10b981',
        fillOpacity: 0.1,
        weight: 2,
        radius: geofenceRadius,
        dashArray: '5, 5'
      }).addTo(mapInstance!)

      geofenceCircles.set(`hospital-${event.id}`, hospitalCircle)
    }
  })
}

function fitMapToMarkers() {
  if (!mapInstance) return

  const allLatLngs: L.LatLngTuple[] = []

  vehicleLocations.value.forEach(v => {
    if (v.latitude && v.longitude) {
      allLatLngs.push([v.latitude, v.longitude])
    }
  })

  activeEvents.value.forEach(e => {
    if (e.latitude && e.longitude) {
      allLatLngs.push([e.latitude, e.longitude])
    }
  })

  if (allLatLngs.length > 0) {
    const bounds = L.latLngBounds(allLatLngs)
    mapInstance.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 })
  }
}

function selectEvent(event: DispatchEventSummary) {
  getEventDetail(event.id).then(detail => {
    selectedEvent.value = detail
    if (mapInstance && event.latitude && event.longitude) {
      mapInstance.setView([event.latitude, event.longitude], 15)
    }
  })
}

function selectVehicle(id: number) {
  selectedVehicleId.value = id
  const vehicle = vehicleLocations.value.find(v => v.ambulanceId === id)
  if (mapInstance && vehicle?.latitude && vehicle?.longitude) {
    mapInstance.setView([vehicle.latitude, vehicle.longitude], 16)
    const marker = vehicleMarkers.get(id)
    if (marker) marker.openPopup()
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

      stompClient!.subscribe('/topic/dispatch/geofence/scene', (message) => {
        const data = JSON.parse(message.body)
        ElNotification({
          title: '到达现场',
          message: `车辆 ${data.plateNumber || ''} 已到达现场围栏`,
          type: 'success'
        })
      })

      stompClient!.subscribe('/topic/dispatch/geofence/hospital', (message) => {
        const data = JSON.parse(message.body)
        ElNotification({
          title: '到达医院',
          message: `车辆 ${data.plateNumber || ''} 已到达医院围栏`,
          type: 'success'
        })
      })
    })
  } catch (error) {
    console.error('WebSocket connection failed:', error)
  }
}

watch([vehicleLocations, activeEvents], () => {
  nextTick(() => {
    updateVehicleMarkers()
    updateIncidentMarkers()
    updateGeofenceCircles()
  })
}, { deep: true })

onMounted(async () => {
  await nextTick()
  initMap()
  await loadData()
  setTimeout(() => {
    fitMapToMarkers()
  }, 500)
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
  if (mapInstance) {
    mapInstance.remove()
    mapInstance = null
  }
  vehicleMarkers.clear()
  incidentMarkers.clear()
  geofenceCircles.clear()
})
</script>

<style>
@keyframes pulse-normal {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
  }
}

@keyframes pulse-fast {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.6);
  }
  50% {
    box-shadow: 0 0 0 15px rgba(220, 38, 38, 0);
  }
}

.custom-vehicle-marker,
.custom-incident-marker {
  background: transparent !important;
  border: none !important;
}

.leaflet-popup-content-wrapper {
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.leaflet-control-attribution {
  background: rgba(255, 255, 255, 0.85) !important;
  border-radius: 4px;
  padding: 2px 8px !important;
}
</style>

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

.map-container {
  width: 100%;
  height: 100%;
  min-height: 500px;
  border-radius: 8px;
  overflow: hidden;
  background: #e5e7eb;
}
</style>
