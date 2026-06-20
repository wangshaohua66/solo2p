<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Search,
  Refresh,
  ZoomIn,
  ZoomOut,
  Location,
  Warning,
  Phone,
  User,
  Timer,
  Van,
  Files,
  Check,
  Bell,
  Document,
  Right,
  Close,
  View
} from '@element-plus/icons-vue'
import { mockVehicles, mockMissions } from '@/mock/vehicles'
import { dayjs } from '@/utils/date'
import type { Vehicle, PickupMission, MissionStatus, DispatchRecord } from '@/types/vehicle'

interface MapPoint {
  x: number
  y: number
  lat: number
  lng: number
}

const MISSION_TABS = [
  { key: 'pending', label: '待分配', count: 0, dotColor: '#FF4D4F' },
  { key: 'progress', label: '进行中', count: 0, dotColor: '#1890FF' },
  { key: 'completed', label: '已完成', count: 0, dotColor: '#52C41A' },
  { key: 'log', label: '调度日志', count: 0, dotColor: '#C9A86C' }
] as const

type TabKey = typeof MISSION_TABS[number]['key']

const missionStatusConfig: Record<MissionStatus, { label: string; color: string; bg: string }> = {
  pending: { label: '待分配', color: '#FF4D4F', bg: 'rgba(255, 77, 79, 0.15)' },
  urgent: { label: '紧急', color: '#FF4D4F', bg: 'rgba(255, 77, 79, 0.2)' },
  assigned: { label: '已派车', color: '#1890FF', bg: 'rgba(24, 144, 255, 0.15)' },
  picking: { label: '接运中', color: '#1890FF', bg: 'rgba(24, 144, 255, 0.15)' },
  arrived: { label: '已到达', color: '#722ED1', bg: 'rgba(114, 46, 209, 0.15)' },
  completed: { label: '已完成', color: '#52C41A', bg: 'rgba(82, 196, 26, 0.15)' },
  cancelled: { label: '已取消', color: '#8C8C8C', bg: 'rgba(140, 140, 140, 0.15)' }
}

const vehicleStatusConfig: Record<string, { label: string; color: string; dot: string }> = {
  idle: { label: '空闲', color: '#52C41A', dot: '#52C41A' },
  on_mission: { label: '任务中', color: '#1890FF', dot: '#1890FF' },
  maintenance: { label: '维护', color: '#FA8C16', dot: '#FA8C16' }
}

const MAP_CENTER = { lat: 31.2304, lng: 121.4737 }
const MAP_WIDTH = 800
const MAP_HEIGHT = 560
const LAT_RANGE = 0.2
const LNG_RANGE = 0.3

const funeralHomes = [
  { id: 'fh1', name: '第一殡仪馆', lat: 31.28, lng: 121.44 },
  { id: 'fh2', name: '第二殡仪馆', lat: 31.20, lng: 121.52 },
  { id: 'fh3', name: '第三殡仪馆', lat: 31.25, lng: 121.38 }
]

const currentTab = ref<TabKey>('pending')
const missions = ref<PickupMission[]>([...mockMissions])
const vehicles = ref<Vehicle[]>([...mockVehicles])
const showOnlyIdle = ref(false)
const searchVehicle = ref('')
const mapZoom = ref(1)
const selectedMission = ref<PickupMission | null>(null)
const selectedVehicle = ref<Vehicle | null>(null)
const hoveredVehicle = ref<Vehicle | null>(null)
const assignDialogVisible = ref(false)
const assignTargetMission = ref<PickupMission | null>(null)
const selectedVehicleForAssign = ref('')
const now = ref(dayjs())

const dispatchRecords = ref<DispatchRecord[]>([
  { id: 'L001', missionId: missions.value[0]?.id || 'M001', vehicleId: 'V001', operatorId: 'O001', operatorName: '调度员A', action: 'assign', time: dayjs().subtract(15, 'minute').format('YYYY-MM-DD HH:mm:ss') },
  { id: 'L002', missionId: missions.value[1]?.id || 'M002', vehicleId: 'V003', operatorId: 'O001', operatorName: '调度员A', action: 'urgent', time: dayjs().subtract(10, 'minute').format('YYYY-MM-DD HH:mm:ss'), reason: '家属催促' },
  { id: 'L003', missionId: missions.value[2]?.id || 'M003', vehicleId: 'V005', operatorId: 'O002', operatorName: '调度员B', action: 'assign', time: dayjs().subtract(5, 'minute').format('YYYY-MM-DD HH:mm:ss') },
  { id: 'L004', missionId: missions.value[3]?.id || 'M004', vehicleId: 'V002', operatorId: 'O002', operatorName: '调度员B', action: 'reassign', time: dayjs().subtract(2, 'minute').format('YYYY-MM-DD HH:mm:ss'), oldVehicleId: 'V004', reason: '车辆故障' }
])

let animationTimer: number | null = null
const vehicleAnimationOffsets = reactive<Record<string, { dx: number; dy: number; progress: number }>>({})

const latLngToXY = (lat: number, lng: number): MapPoint => {
  const x = ((lng - (MAP_CENTER.lng - LNG_RANGE / 2)) / LNG_RANGE) * MAP_WIDTH
  const y = (1 - (lat - (MAP_CENTER.lat - LAT_RANGE / 2)) / LAT_RANGE) * MAP_HEIGHT
  return { x, y, lat, lng }
}

const xyToLatLng = (x: number, y: number) => {
  const lng = (x / MAP_WIDTH) * LNG_RANGE + (MAP_CENTER.lng - LNG_RANGE / 2)
  const lat = (1 - y / MAP_HEIGHT) * LAT_RANGE + (MAP_CENTER.lat - LAT_RANGE / 2)
  return { lat, lng }
}

const tabCounts = computed(() => {
  return {
    pending: missions.value.filter(m => m.status === 'pending' || m.status === 'urgent').length,
    progress: missions.value.filter(m => ['assigned', 'picking', 'arrived'].includes(m.status)).length,
    completed: missions.value.filter(m => m.status === 'completed').length,
    log: dispatchRecords.value.length
  }
})

const filteredMissions = computed(() => {
  switch (currentTab.value) {
    case 'pending':
      return missions.value.filter(m => m.status === 'pending' || m.status === 'urgent')
    case 'progress':
      return missions.value.filter(m => ['assigned', 'picking', 'arrived'].includes(m.status))
    case 'completed':
      return missions.value.filter(m => m.status === 'completed')
    default:
      return []
  }
})

const filteredVehicles = computed(() => {
  let result = vehicles.value
  if (showOnlyIdle.value) {
    result = result.filter(v => v.status === 'idle')
  }
  if (searchVehicle.value) {
    const q = searchVehicle.value.toLowerCase()
    result = result.filter(v =>
      v.plateNumber.toLowerCase().includes(q) ||
      v.driverName.toLowerCase().includes(q) ||
      v.model.toLowerCase().includes(q)
    )
  }
  return result
})

const idleVehicles = computed(() => vehicles.value.filter(v => v.status === 'idle'))

const activeMissions = computed(() => missions.value.filter(m =>
  ['assigned', 'picking', 'arrived', 'urgent'].includes(m.status)
))

const getVehicleForMission = (mission: PickupMission): Vehicle | undefined => {
  if (!mission.vehicleId) return undefined
  return vehicles.value.find(v => v.id === mission.vehicleId)
}

const getVehicleMapPos = (vehicle: Vehicle) => {
  const base = latLngToXY(vehicle.currentLocation.lat, vehicle.currentLocation.lng)
  const offset = vehicleAnimationOffsets[vehicle.id] || { dx: 0, dy: 0 }
  return {
    ...base,
    x: base.x + offset.dx,
    y: base.y + offset.dy
  }
}

const getMissionRoutePoints = (mission: PickupMission) => {
  const pickup = latLngToXY(mission.pickupLocation.lat, mission.pickupLocation.lng)
  const dest = latLngToXY(mission.destination.lat, mission.destination.lng)
  return { pickup, dest }
}

const calcETA = (mission: PickupMission): string => {
  if (mission.status === 'completed' || !mission.estimatedDuration) return '--'
  const base = dayjs(mission.appointmentTime)
  if (mission.actualDepartTime) {
    const elapsed = dayjs().diff(dayjs(mission.actualDepartTime), 'minute')
    const remain = Math.max(0, mission.estimatedDuration - elapsed)
    return remain > 60 ? `${Math.floor(remain / 60)}时${remain % 60}分` : `${remain}分钟`
  }
  return `${mission.estimatedDuration}分钟`
}

const calcSpeed = (): number => {
  return Math.round(20 + Math.random() * 40)
}

const openAssignDialog = (mission: PickupMission) => {
  assignTargetMission.value = mission
  selectedVehicleForAssign.value = ''
  assignDialogVisible.value = true
}

const confirmAssign = () => {
  if (!assignTargetMission.value || !selectedVehicleForAssign.value) {
    ElMessage.warning('请选择车辆')
    return
  }
  const mission = assignTargetMission.value
  const vehicle = vehicles.value.find(v => v.id === selectedVehicleForAssign.value)
  if (!vehicle) return
  const idx = missions.value.findIndex(m => m.id === mission.id)
  if (idx > -1) {
    missions.value[idx] = {
      ...missions.value[idx],
      status: 'assigned',
      isUrgent: false,
      vehicleId: vehicle.id,
      vehiclePlate: vehicle.plateNumber,
      driverId: vehicle.driverId,
      driverName: vehicle.driverName,
      driverPhone: vehicle.driverPhone
    }
  }
  const vIdx = vehicles.value.findIndex(v => v.id === vehicle.id)
  if (vIdx > -1) {
    vehicles.value[vIdx] = { ...vehicles.value[vIdx], status: 'on_mission' }
  }
  dispatchRecords.value.unshift({
    id: `L${String(dispatchRecords.value.length + 1).padStart(3, '0')}`,
    missionId: mission.id,
    vehicleId: vehicle.id,
    operatorId: 'O001',
    operatorName: '当前调度员',
    action: 'assign',
    time: dayjs().format('YYYY-MM-DD HH:mm:ss')
  })
  ElMessage.success(`已将 ${vehicle.plateNumber} 派给任务 ${mission.code}`)
  assignDialogVisible.value = false
}

const quickAssign = async (mission: PickupMission) => {
  const idle = idleVehicles.value
  if (idle.length === 0) {
    ElMessage.warning('暂无空闲车辆可用')
    return
  }
  const vehicle = idle[0]
  try {
    await ElMessageBox.confirm(
      `将为任务 ${mission.code} 自动分配空闲车辆 ${vehicle.plateNumber} (${vehicle.driverName})`,
      '一键派车确认',
      { type: 'info' }
    )
    const idx = missions.value.findIndex(m => m.id === mission.id)
    if (idx > -1) {
      missions.value[idx] = {
        ...missions.value[idx],
        status: 'assigned',
        isUrgent: false,
        vehicleId: vehicle.id,
        vehiclePlate: vehicle.plateNumber,
        driverId: vehicle.driverId,
        driverName: vehicle.driverName,
        driverPhone: vehicle.driverPhone
      }
    }
    const vIdx = vehicles.value.findIndex(v => v.id === vehicle.id)
    if (vIdx > -1) {
      vehicles.value[vIdx] = { ...vehicles.value[vIdx], status: 'on_mission' }
    }
    dispatchRecords.value.unshift({
      id: `L${String(dispatchRecords.value.length + 1).padStart(3, '0')}`,
      missionId: mission.id,
      vehicleId: vehicle.id,
      operatorId: 'O001',
      operatorName: '当前调度员',
      action: 'assign',
      time: dayjs().format('YYYY-MM-DD HH:mm:ss')
    })
    ElMessage.success('派车成功')
  } catch {}
}

const markUrgent = async (mission: PickupMission) => {
  try {
    await ElMessageBox.confirm(`将任务 ${mission.code} 标记为紧急？`, '紧急标记', { type: 'warning' })
    const idx = missions.value.findIndex(m => m.id === mission.id)
    if (idx > -1) {
      missions.value[idx] = { ...missions.value[idx], status: 'urgent', isUrgent: true }
    }
    dispatchRecords.value.unshift({
      id: `L${String(dispatchRecords.value.length + 1).padStart(3, '0')}`,
      missionId: mission.id,
      vehicleId: mission.vehicleId || 'N/A',
      operatorId: 'O001',
      operatorName: '当前调度员',
      action: 'urgent',
      time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      reason: '手动标记紧急'
    })
    ElMessage.success('已标记为紧急任务')
  } catch {}
}

const refreshVehicles = () => {
  vehicles.value = vehicles.value.map(v => ({
    ...v,
    lastUpdateTime: dayjs().format('YYYY-MM-DD HH:mm:ss')
  }))
  ElMessage.success('车辆位置已刷新')
}

const zoomIn = () => {
  mapZoom.value = Math.min(2, mapZoom.value + 0.2)
}

const zoomOut = () => {
  mapZoom.value = Math.max(0.5, mapZoom.value - 0.2)
}

const focusMission = (mission: PickupMission) => {
  selectedMission.value = mission
  if (mission.vehicleId) {
    selectedVehicle.value = vehicles.value.find(v => v.id === mission.vehicleId) || null
  }
}

const formatTimeAgo = (timeStr: string) => {
  return dayjs(timeStr).fromNow()
}

const generateDistrictPaths = () => {
  const districts = [
    { name: '黄浦区', cx: 0.5, cy: 0.45, rx: 0.12, ry: 0.08, color: 'rgba(201,168,108,0.06)' },
    { name: '徐汇区', cx: 0.35, cy: 0.55, rx: 0.15, ry: 0.12, color: 'rgba(201,168,108,0.04)' },
    { name: '静安区', cx: 0.48, cy: 0.3, rx: 0.13, ry: 0.1, color: 'rgba(201,168,108,0.05)' },
    { name: '长宁区', cx: 0.25, cy: 0.42, rx: 0.14, ry: 0.1, color: 'rgba(201,168,108,0.04)' },
    { name: '普陀区', cx: 0.32, cy: 0.25, rx: 0.13, ry: 0.11, color: 'rgba(201,168,108,0.05)' },
    { name: '虹口区', cx: 0.58, cy: 0.32, rx: 0.1, ry: 0.09, color: 'rgba(201,168,108,0.04)' },
    { name: '杨浦区', cx: 0.68, cy: 0.38, rx: 0.13, ry: 0.12, color: 'rgba(201,168,108,0.05)' },
    { name: '浦东新区', cx: 0.72, cy: 0.6, rx: 0.2, ry: 0.22, color: 'rgba(201,168,108,0.03)' },
    { name: '闵行区', cx: 0.45, cy: 0.75, rx: 0.2, ry: 0.12, color: 'rgba(201,168,108,0.04)' },
    { name: '宝山区', cx: 0.4, cy: 0.15, rx: 0.2, ry: 0.08, color: 'rgba(201,168,108,0.05)' }
  ]
  return districts.map(d => ({
    ...d,
    path: `M ${d.cx * MAP_WIDTH - d.rx * MAP_WIDTH},${d.cy * MAP_HEIGHT}
      Q ${d.cx * MAP_WIDTH - d.rx * MAP_WIDTH},${d.cy * MAP_HEIGHT - d.ry * MAP_HEIGHT}
      ${d.cx * MAP_WIDTH},${d.cy * MAP_HEIGHT - d.ry * MAP_HEIGHT}
      Q ${d.cx * MAP_WIDTH + d.rx * MAP_WIDTH},${d.cy * MAP_HEIGHT - d.ry * MAP_HEIGHT}
      ${d.cx * MAP_WIDTH + d.rx * MAP_WIDTH},${d.cy * MAP_HEIGHT}
      Q ${d.cx * MAP_WIDTH + d.rx * MAP_WIDTH},${d.cy * MAP_HEIGHT + d.ry * MAP_HEIGHT}
      ${d.cx * MAP_WIDTH},${d.cy * MAP_HEIGHT + d.ry * MAP_HEIGHT}
      Q ${d.cx * MAP_WIDTH - d.rx * MAP_WIDTH},${d.cy * MAP_HEIGHT + d.ry * MAP_HEIGHT}
      ${d.cx * MAP_WIDTH - d.rx * MAP_WIDTH},${d.cy * MAP_HEIGHT} Z`
  }))
}

const districtPaths = generateDistrictPaths()

const startAnimation = () => {
  animationTimer = window.setInterval(() => {
    now.value = dayjs()
    vehicles.value.forEach(v => {
      if (v.status === 'on_mission') {
        const current = vehicleAnimationOffsets[v.id] || { dx: 0, dy: 0, progress: 0 }
        const newProgress = (current.progress + 0.02) % 1
        vehicleAnimationOffsets[v.id] = {
          dx: Math.sin(newProgress * Math.PI * 2) * 6,
          dy: Math.cos(newProgress * Math.PI * 2) * 4,
          progress: newProgress
        }
      }
    })
  }, 1000)
}

const actionLabelMap: Record<DispatchRecord['action'], string> = {
  assign: '派车',
  reassign: '改派',
  recall: '召回',
  urgent: '紧急调度'
}

onMounted(() => {
  startAnimation()
})

onUnmounted(() => {
  if (animationTimer) {
    clearInterval(animationTimer)
  }
})

watch(assignDialogVisible, (val) => {
  if (!val) {
    assignTargetMission.value = null
    selectedVehicleForAssign.value = ''
  }
})
</script>

<template>
  <div class="dispatch-page page-container">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title text-gold-gradient">车辆调度优化</h2>
        <span class="page-subtitle">实时追踪 · 智能派单 · 最优路径</span>
      </div>
      <div class="header-stats">
        <div class="stat-mini">
          <i class="stat-dot pending"></i>
          <span class="stat-val">{{ tabCounts.pending }}</span>
          <span class="stat-lbl">待处理</span>
        </div>
        <div class="stat-mini">
          <i class="stat-dot progress"></i>
          <span class="stat-val">{{ tabCounts.progress }}</span>
          <span class="stat-lbl">进行中</span>
        </div>
        <div class="stat-mini">
          <i class="stat-dot idle"></i>
          <span class="stat-val">{{ idleVehicles.length }}</span>
          <span class="stat-lbl">空闲车</span>
        </div>
        <div class="stat-mini">
          <i class="stat-dot total"></i>
          <span class="stat-val">{{ vehicles.length }}</span>
          <span class="stat-lbl">总车辆</span>
        </div>
      </div>
    </div>

    <div class="dispatch-body">
      <div class="mission-panel card-base">
        <div class="panel-tabs">
          <div
            v-for="tab in MISSION_TABS"
            :key="tab.key"
            class="tab-item"
            :class="{ active: currentTab === tab.key }"
            @click="currentTab = tab.key"
          >
            <span class="tab-dot" :style="{ background: tab.dotColor }"></span>
            <span class="tab-label">{{ tab.label }}</span>
            <span v-if="tab.key !== 'log'" class="tab-badge">{{ tabCounts[tab.key] }}</span>
            <span v-else class="tab-badge">{{ tabCounts.log }}</span>
          </div>
        </div>

        <div v-if="currentTab !== 'log'" class="mission-list scrollbar-thin">
          <div v-if="filteredMissions.length === 0" class="empty-state">
            <el-icon :size="48" color="#6B6B74"><Files /></el-icon>
            <p>暂无{{ currentTab === 'pending' ? '待分配' : currentTab === 'progress' ? '进行中' : '已完成' }}任务</p>
          </div>
          <div
            v-for="mission in filteredMissions"
            :key="mission.id"
            class="mission-card"
            :class="{
              urgent: mission.isUrgent || mission.status === 'urgent',
              selected: selectedMission?.id === mission.id
            }"
            @click="focusMission(mission)"
          >
            <div class="mission-head">
              <div class="mission-code">
                <el-icon v-if="mission.isUrgent" class="urgent-icon"><Bell /></el-icon>
                {{ mission.code }}
              </div>
              <el-tag size="small" :color="missionStatusConfig[mission.status].bg" :style="{ color: missionStatusConfig[mission.status].color, border: 'none' }">
                {{ missionStatusConfig[mission.status].label }}
              </el-tag>
            </div>

            <div class="mission-body">
              <div class="info-line">
                <el-icon :size="13"><User /></el-icon>
                <span class="info-label">逝者：</span>
                <span class="info-value">{{ mission.remainsName }}</span>
              </div>
              <div class="info-line">
                <el-icon :size="13"><Location /></el-icon>
                <span class="info-label">地址：</span>
                <span class="info-value address" :title="mission.pickupLocation.address">{{ mission.pickupLocation.address }}</span>
              </div>
              <div class="info-line">
                <el-icon :size="13"><Timer /></el-icon>
                <span class="info-label">预约：</span>
                <span class="info-value">{{ mission.appointmentTime }}</span>
                <span v-if="mission.distanceKm" class="distance">{{ mission.distanceKm }}km</span>
              </div>
            </div>

            <div v-if="mission.vehiclePlate" class="mission-vehicle">
              <div class="vh-plate">
                <el-icon :size="13"><Van /></el-icon>
                {{ mission.vehiclePlate }}
              </div>
              <div class="vh-driver">
                <el-icon :size="12"><User /></el-icon>
                {{ mission.driverName }}
              </div>
              <div class="vh-phone" :title="mission.driverPhone">
                <el-icon :size="12"><Phone /></el-icon>
                {{ mission.driverPhone }}
              </div>
            </div>

            <div class="mission-actions">
              <template v-if="mission.status === 'pending' || mission.status === 'urgent'">
                <el-button size="small" type="primary" class="btn-gold" @click.stop="quickAssign(mission)">
                  一键派车
                </el-button>
                <el-button size="small" @click.stop="openAssignDialog(mission)">选择车辆</el-button>
                <el-button v-if="!mission.isUrgent" size="small" type="danger" text @click.stop="markUrgent(mission)">
                  <el-icon><Warning /></el-icon>
                  紧急
                </el-button>
              </template>
              <template v-else>
                <span class="eta-tag">
                  <el-icon :size="12"><Timer /></el-icon>
                  ETA: {{ calcETA(mission) }}
                </span>
                <el-button size="small" text type="primary" @click.stop="openAssignDialog(mission)">改派</el-button>
              </template>
            </div>
          </div>
        </div>

        <div v-else class="dispatch-log scrollbar-thin">
          <div v-if="dispatchRecords.length === 0" class="empty-state">
            <el-icon :size="48" color="#6B6B74"><Document /></el-icon>
            <p>暂无调度日志</p>
          </div>
          <div v-for="(log, idx) in dispatchRecords" :key="log.id" class="log-item" :class="log.action">
            <div class="log-time">
              <span class="time-main">{{ dayjs(log.time).format('HH:mm:ss') }}</span>
              <span class="time-sub">{{ formatTimeAgo(log.time) }}</span>
            </div>
            <div class="log-content">
              <span class="log-operator">{{ log.operatorName }}</span>
              <span class="log-action-tag" :class="log.action">
                <el-icon><Right /></el-icon>
                {{ actionLabelMap[log.action] }}
              </span>
              <div class="log-detail">
                任务: <b>{{ missions.find(m => m.id === log.missionId)?.code || log.missionId }}</b>
                <span v-if="log.vehicleId !== 'N/A'"> / 车辆: <b>{{ vehicles.find(v => v.id === log.vehicleId)?.plateNumber || log.vehicleId }}</b></span>
              </div>
              <div v-if="log.reason" class="log-reason">原因：{{ log.reason }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="map-panel card-base">
        <div class="map-toolbar">
          <div class="toolbar-left">
            <div class="toolbar-title">
              <el-icon><Location /></el-icon>
              上海市调度地图
            </div>
            <span class="update-time">更新: {{ now.format('HH:mm:ss') }}</span>
          </div>
          <div class="toolbar-right">
            <div class="search-box">
              <el-icon class="search-icon"><Search /></el-icon>
              <input v-model="searchVehicle" placeholder="搜索车牌/司机..." />
            </div>
            <el-checkbox v-model="showOnlyIdle" class="idle-filter">仅空闲</el-checkbox>
            <el-button :icon="Refresh" circle size="small" @click="refreshVehicles" />
            <el-button :icon="ZoomOut" circle size="small" @click="zoomOut" />
            <span class="zoom-val">{{ Math.round(mapZoom * 100) }}%</span>
            <el-button :icon="ZoomIn" circle size="small" @click="zoomIn" />
          </div>
        </div>

        <div class="map-container scrollbar-thin">
          <div class="map-viewport" :style="{ transform: `scale(${mapZoom})`, transformOrigin: 'center center' }">
            <svg :width="MAP_WIDTH" :height="MAP_HEIGHT" class="map-svg">
              <defs>
                <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#3A3A44" stroke-width="0.5" opacity="0.3" />
                </pattern>
                <radialGradient id="fhGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" style="stop-color:#C9A86C;stop-opacity:0.4" />
                  <stop offset="100%" style="stop-color:#C9A86C;stop-opacity:0" />
                </radialGradient>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#1890FF" opacity="0.6" />
                </marker>
              </defs>

              <rect width="100%" height="100%" fill="url(#gridPattern)" />

              <g v-for="(d, i) in districtPaths" :key="i" class="district">
                <path :d="d.path" :fill="d.color" stroke="#3A3A44" stroke-width="1" stroke-dasharray="4,4" />
                <text :x="d.cx * MAP_WIDTH" :y="d.cy * MAP_HEIGHT" fill="#6B6B74" font-size="12" text-anchor="middle" style="pointer-events:none">
                  {{ d.name }}
                </text>
              </g>

              <g v-for="mission in activeMissions" :key="mission.id + '-route'" class="route-layer" style="pointer-events:none">
                <line
                  v-if="mission.vehicleId && getVehicleForMission(mission)"
                  :x1="getVehicleMapPos(getVehicleForMission(mission)!).x"
                  :y1="getVehicleMapPos(getVehicleForMission(mission)!).y"
                  :x2="getMissionRoutePoints(mission).pickup.x"
                  :y2="getMissionRoutePoints(mission).pickup.y"
                  stroke="#1890FF"
                  stroke-width="2"
                  stroke-dasharray="6,4"
                  opacity="0.5"
                  marker-end="url(#arrowhead)"
                />
                <line
                  :x1="getMissionRoutePoints(mission).pickup.x"
                  :y1="getMissionRoutePoints(mission).pickup.y"
                  :x2="getMissionRoutePoints(mission).dest.x"
                  :y2="getMissionRoutePoints(mission).dest.y"
                  stroke="#C9A86C"
                  stroke-width="1.5"
                  stroke-dasharray="4,4"
                  opacity="0.4"
                />
              </g>

              <g v-for="fh in funeralHomes" :key="fh.id" class="fh-marker">
                <circle
                  :cx="latLngToXY(fh.lat, fh.lng).x"
                  :cy="latLngToXY(fh.lat, fh.lng).y"
                  r="28"
                  fill="url(#fhGlow)"
                />
                <circle
                  :cx="latLngToXY(fh.lat, fh.lng).x"
                  :cy="latLngToXY(fh.lat, fh.lng).y"
                  r="12"
                  fill="#C9A86C"
                  stroke="#fff"
                  stroke-width="2"
                />
                <text
                  :x="latLngToXY(fh.lat, fh.lng).x"
                  :y="latLngToXY(fh.lat, fh.lng).y - 18"
                  fill="#C9A86C"
                  font-size="12"
                  font-weight="600"
                  text-anchor="middle"
                >
                  {{ fh.name }}
                </text>
              </g>

              <g v-for="mission in filteredMissions" :key="mission.id + '-pickup'" class="pickup-marker">
                <circle
                  v-if="mission.status === 'pending' || mission.status === 'urgent'"
                  :cx="getMissionRoutePoints(mission).pickup.x"
                  :cy="getMissionRoutePoints(mission).pickup.y"
                  r="8"
                  :fill="mission.isUrgent ? '#FF4D4F' : '#FA8C16'"
                  class="pulse-dot"
                />
                <circle
                  :cx="getMissionRoutePoints(mission).pickup.x"
                  :cy="getMissionRoutePoints(mission).pickup.y"
                  r="14"
                  fill="none"
                  :stroke="mission.isUrgent ? '#FF4D4F' : '#FA8C16'"
                  stroke-width="1"
                  opacity="0.5"
                  class="pulse-ring"
                />
              </g>
            </svg>

            <div
              v-for="mission in filteredMissions"
              :key="mission.id + '-label'"
              class="mission-label"
              :class="{ urgent: mission.isUrgent }"
              :style="{
                left: getMissionRoutePoints(mission).pickup.x + 'px',
                top: (getMissionRoutePoints(mission).pickup.y + 20) + 'px'
              }"
            >
              {{ mission.code }}
            </div>

            <div
              v-for="vehicle in filteredVehicles"
              :key="vehicle.id"
              class="vehicle-marker"
              :class="{
                idle: vehicle.status === 'idle',
                active: vehicle.status === 'on_mission',
                selected: selectedVehicle?.id === vehicle.id,
                hovered: hoveredVehicle?.id === vehicle.id
              }"
              :style="{
                left: (getVehicleMapPos(vehicle).x - 14) + 'px',
                top: (getVehicleMapPos(vehicle).y - 14) + 'px'
              }"
              @mouseenter="hoveredVehicle = vehicle"
              @mouseleave="hoveredVehicle = null"
              @click="selectedVehicle = vehicle"
            >
              <div class="v-icon" :class="vehicle.type">
                <el-icon :size="16"><Van /></el-icon>
              </div>
              <span class="v-plate">{{ vehicle.plateNumber.slice(-4) }}</span>
            </div>
          </div>
        </div>

        <div
          v-if="hoveredVehicle || selectedVehicle"
          class="vehicle-popup card-base"
          :style="{ bottom: '16px', left: '16px' }"
        >
          <div class="popup-header">
            <div class="popup-title">
              <span class="vehicle-type-tag" :class="(hoveredVehicle || selectedVehicle)!.type">
                {{ (hoveredVehicle || selectedVehicle)!.type === 'hearse' ? '灵车' : '家属车' }}
              </span>
              <span class="popup-plate">{{ (hoveredVehicle || selectedVehicle)!.plateNumber }}</span>
            </div>
            <el-button text :icon="Close" size="small" @click="selectedVehicle = null; hoveredVehicle = null" />
          </div>
          <div class="popup-body">
            <div class="popup-row">
              <span class="lbl">车型</span>
              <span class="val">{{ (hoveredVehicle || selectedVehicle)!.model }}</span>
            </div>
            <div class="popup-row">
              <span class="lbl">司机</span>
              <span class="val">
                <el-icon :size="12"><User /></el-icon>
                {{ (hoveredVehicle || selectedVehicle)!.driverName }}
              </span>
            </div>
            <div class="popup-row">
              <span class="lbl">电话</span>
              <span class="val">
                <el-icon :size="12"><Phone /></el-icon>
                {{ (hoveredVehicle || selectedVehicle)!.driverPhone }}
              </span>
            </div>
            <div class="popup-row">
              <span class="lbl">状态</span>
              <span class="val">
                <i class="status-dot" :style="{ background: vehicleStatusConfig[(hoveredVehicle || selectedVehicle)!.status].dot }"></i>
                <span :style="{ color: vehicleStatusConfig[(hoveredVehicle || selectedVehicle)!.status].color }">
                  {{ vehicleStatusConfig[(hoveredVehicle || selectedVehicle)!.status].label }}
                </span>
              </span>
            </div>
            <div class="popup-row">
              <span class="lbl">速度</span>
              <span class="val">{{ calcSpeed() }} km/h</span>
            </div>
            <div class="popup-row">
              <span class="lbl">位置</span>
              <span class="val">{{ (hoveredVehicle || selectedVehicle)!.currentLocation.address }}</span>
            </div>
            <div v-if="selectedMission" class="popup-row highlight">
              <span class="lbl">ETA</span>
              <span class="val gold">{{ calcETA(selectedMission) }}</span>
            </div>
          </div>
        </div>

        <div class="map-legend">
          <div class="legend-group">
            <span class="legend-title">殡仪馆</span>
            <span class="legend-item"><i class="lg-dot fh"></i>殡仪馆</span>
          </div>
          <div class="legend-group">
            <span class="legend-title">车辆</span>
            <span class="legend-item"><i class="lg-dot idle"></i>空闲</span>
            <span class="legend-item"><i class="lg-dot active"></i>任务中</span>
            <span class="legend-item"><i class="lg-dot maintenance"></i>维护</span>
          </div>
          <div class="legend-group">
            <span class="legend-title">任务</span>
            <span class="legend-item"><i class="lg-dot urgent"></i>紧急</span>
            <span class="legend-item"><i class="lg-dot pending"></i>待派</span>
          </div>
        </div>
      </div>
    </div>

    <el-dialog
      v-model="assignDialogVisible"
      title="选择派车"
      width="480px"
      class="assign-dialog"
      destroy-on-close
    >
      <div v-if="assignTargetMission" class="assign-mission-info">
        <div class="ami-code">任务编号：{{ assignTargetMission.code }}</div>
        <div class="ami-row">
          <el-icon :size="13"><Location /></el-icon>
          {{ assignTargetMission.pickupLocation.address }}
        </div>
        <div class="ami-row">
          <el-icon :size="13"><Timer /></el-icon>
          {{ assignTargetMission.appointmentTime }} · {{ assignTargetMission.distanceKm }}km
        </div>
      </div>
      <div class="vehicle-list-scroll scrollbar-thin">
        <div
          v-for="v in idleVehicles"
          :key="v.id"
          class="vehicle-option"
          :class="{ selected: selectedVehicleForAssign === v.id }"
          @click="selectedVehicleForAssign = v.id"
        >
          <div class="vo-radio">
            <el-radio v-model="selectedVehicleForAssign" :label="v.id">
              <span class="vo-plate">{{ v.plateNumber }}</span>
              <span class="vo-type" :class="v.type">
                {{ v.type === 'hearse' ? '灵车' : '家属车' }}
              </span>
            </el-radio>
          </div>
          <div class="vo-detail">
            <span><el-icon :size="12"><User /></el-icon> {{ v.driverName }}</span>
            <span class="sep">|</span>
            <span>{{ v.driverPhone }}</span>
          </div>
          <div class="vo-model">{{ v.model }}</div>
        </div>
        <div v-if="idleVehicles.length === 0" class="empty-state small">
          <p>暂无空闲车辆</p>
        </div>
      </div>
      <template #footer>
        <el-button @click="assignDialogVisible = false">取消</el-button>
        <el-button type="primary" class="btn-gold" @click="confirmAssign">确认派车</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
@import '@/assets/styles/theme.scss';

.dispatch-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 100%;

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;

    .header-left {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .page-title {
      font-size: 24px;
      font-weight: 700;
      margin: 0;
    }

    .page-subtitle {
      font-size: 13px;
      color: $color-funeral-text-muted;
    }

    .header-stats {
      display: flex;
      gap: 20px;

      .stat-mini {
        display: flex;
        align-items: center;
        gap: 8px;

        .stat-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;

          &.pending { background: #FF4D4F; box-shadow: 0 0 8px rgba(255,77,79,0.5); }
          &.progress { background: #1890FF; box-shadow: 0 0 8px rgba(24,144,255,0.5); }
          &.idle { background: #52C41A; }
          &.total { background: #C9A86C; }
        }

        .stat-val {
          font-size: 20px;
          font-weight: 700;
          color: $color-funeral-text-primary;
        }

        .stat-lbl {
          font-size: 12px;
          color: $color-funeral-text-muted;
        }
      }
    }
  }

  .dispatch-body {
    display: flex;
    gap: 16px;
    flex: 1;
    min-height: 0;
  }

  .mission-panel {
    width: 35%;
    min-width: 360px;
    display: flex;
    flex-direction: column;

    .panel-tabs {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      border-bottom: 1px solid $color-funeral-border;

      .tab-item {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 14px 8px;
        cursor: pointer;
        font-size: 13px;
        color: $color-funeral-text-secondary;
        position: relative;
        transition: all 0.2s ease;

        .tab-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .tab-label {
          font-weight: 500;
        }

        .tab-badge {
          min-width: 20px;
          height: 20px;
          padding: 0 6px;
          background: $color-funeral-dark;
          color: $color-funeral-text-secondary;
          font-size: 11px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        &.active {
          color: $color-funeral-gold;
          background: rgba(201, 168, 108, 0.08);

          &::after {
            content: '';
            position: absolute;
            bottom: -1px;
            left: 0;
            right: 0;
            height: 2px;
            background: $color-funeral-gold;
          }

          .tab-badge {
            background: $color-funeral-gold;
            color: #1A1A1F;
            font-weight: 600;
          }
        }

        &:hover:not(.active) {
          background: rgba(255, 255, 255, 0.02);
        }
      }
    }

    .mission-list {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      @include scrollbar-custom;
    }

    .mission-card {
      background: $color-funeral-dark;
      border: 1px solid $color-funeral-border;
      border-radius: $radius-md;
      padding: 12px 14px;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        border-color: $color-funeral-gold-dark;
        transform: translateY(-1px);
      }

      &.selected {
        border-color: $color-funeral-gold;
        box-shadow: $shadow-gold-glow;
      }

      &.urgent {
        border: 2px solid #FF4D4F;
        animation: urgentBlink 1.5s ease-in-out infinite;

        @keyframes urgentBlink {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 77, 79, 0.4); }
          50% { box-shadow: 0 0 12px 2px rgba(255, 77, 79, 0.3); }
        }
      }

      .mission-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;

        .mission-code {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 14px;
          font-weight: 600;
          color: $color-funeral-text-primary;

          .urgent-icon {
            color: #FF4D4F;
            animation: shake 0.5s ease-in-out infinite;

            @keyframes shake {
              0%, 100% { transform: rotate(0deg); }
              25% { transform: rotate(-10deg); }
              75% { transform: rotate(10deg); }
            }
          }
        }
      }

      .mission-body {
        margin-bottom: 10px;
        padding-bottom: 10px;
        border-bottom: 1px dashed $color-funeral-border;

        .info-line {
          display: flex;
          align-items: flex-start;
          gap: 4px;
          font-size: 12px;
          margin-bottom: 6px;
          color: $color-funeral-text-secondary;

          .info-label {
            flex-shrink: 0;
            color: $color-funeral-text-muted;
            width: 36px;
          }

          .info-value {
            flex: 1;
            color: $color-funeral-text-primary;

            &.address {
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              overflow: hidden;
            }
          }

          .distance {
            margin-left: auto;
            padding: 1px 6px;
            background: rgba(201, 168, 108, 0.15);
            color: $color-funeral-gold;
            border-radius: 2px;
            font-size: 11px;
            font-weight: 500;
          }
        }
      }

      .mission-vehicle {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 12px;
        padding: 8px 10px;
        background: rgba(24, 144, 255, 0.08);
        border-radius: 4px;
        margin-bottom: 10px;
        flex-wrap: wrap;

        .vh-plate, .vh-driver, .vh-phone {
          display: flex;
          align-items: center;
          gap: 4px;
          color: $color-funeral-text-secondary;
        }

        .vh-plate { color: #1890FF; font-weight: 600; }
      }

      .mission-actions {
        display: flex;
        gap: 8px;

        .btn-gold {
          @include gold-gradient;
          border: none;
        }

        .eta-tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: $color-funeral-gold;
          margin-right: auto;
          font-weight: 500;
        }
      }
    }

    .dispatch-log {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      @include scrollbar-custom;

      .log-item {
        display: flex;
        gap: 12px;
        padding-bottom: 16px;
        margin-bottom: 16px;
        border-bottom: 1px dashed $color-funeral-border;
        position: relative;

        &::before {
          content: '';
          position: absolute;
          left: 52px;
          top: 24px;
          bottom: -16px;
          width: 1px;
          background: $color-funeral-border;
        }

        &:last-child::before {
          display: none;
        }

        .log-time {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          min-width: 80px;

          .time-main {
            font-size: 13px;
            font-weight: 600;
            color: $color-funeral-gold;
            font-variant-numeric: tabular-nums;
          }
          .time-sub {
            font-size: 10px;
            color: $color-funeral-text-muted;
          }
        }

        .log-content {
          flex: 1;
          padding-left: 16px;
          border-left: 2px solid $color-funeral-border;
          position: relative;

          &::before {
            content: '';
            position: absolute;
            left: -7px;
            top: 4px;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: $color-funeral-dark;
            border: 2px solid $color-funeral-gold;
          }

          .log-operator {
            font-size: 12px;
            color: $color-funeral-text-secondary;
            margin-right: 8px;
          }

          .log-action-tag {
            display: inline-flex;
            align-items: center;
            gap: 2px;
            font-size: 11px;
            padding: 2px 8px;
            border-radius: 3px;
            font-weight: 500;

            &.assign { background: rgba(24, 144, 255, 0.15); color: #1890FF; }
            &.reassign { background: rgba(114, 46, 209, 0.15); color: #722ED1; }
            &.urgent { background: rgba(255, 77, 79, 0.15); color: #FF4D4F; }
            &.recall { background: rgba(250, 140, 22, 0.15); color: #FA8C16; }
          }

          .log-detail {
            font-size: 12px;
            margin-top: 6px;
            color: $color-funeral-text-secondary;

            b {
              color: $color-funeral-text-primary;
              font-weight: 600;
            }
          }

          .log-reason {
            font-size: 11px;
            margin-top: 4px;
            color: $color-funeral-text-muted;
            font-style: italic;
          }
        }

        &.urgent .log-content::before {
          border-color: #FF4D4F;
          background: rgba(255, 77, 79, 0.3);
        }
      }
    }

    .empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: $color-funeral-text-muted;
      font-size: 13px;

      &.small {
        padding: 24px;
      }
    }
  }

  .map-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;

    .map-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid $color-funeral-border;
      flex-wrap: wrap;
      gap: 12px;

      .toolbar-left {
        display: flex;
        align-items: center;
        gap: 12px;

        .toolbar-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 15px;
          font-weight: 600;
          color: $color-funeral-gold;
        }

        .update-time {
          font-size: 11px;
          color: $color-funeral-text-muted;
          font-variant-numeric: tabular-nums;
        }
      }

      .toolbar-right {
        display: flex;
        align-items: center;
        gap: 8px;

        .search-box {
          display: flex;
          align-items: center;
          gap: 6px;
          background: $color-funeral-dark;
          border: 1px solid $color-funeral-border;
          border-radius: 6px;
          padding: 4px 10px;
          height: 32px;

          .search-icon {
            color: $color-funeral-text-muted;
          }

          input {
            background: transparent;
            border: none;
            outline: none;
            color: $color-funeral-text-primary;
            font-size: 12px;
            width: 140px;

            &::placeholder {
              color: $color-funeral-text-muted;
            }
          }
        }

        .idle-filter {
          :deep(.el-checkbox__label) {
            font-size: 12px;
            color: $color-funeral-text-secondary;
          }
        }

        .zoom-val {
          font-size: 11px;
          color: $color-funeral-text-muted;
          min-width: 40px;
          text-align: center;
        }
      }
    }

    .map-container {
      flex: 1;
      overflow: auto;
      position: relative;
      background: $color-funeral-deepest;
      @include scrollbar-custom;

      .map-viewport {
        width: 100%;
        min-height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 40px;
        transition: transform 0.2s ease;
      }

      .map-svg {
        display: block;
        border-radius: 8px;
        background: $color-funeral-dark;

        .district {
          cursor: default;

          path {
            transition: fill 0.2s ease;
          }
        }

        .fh-marker circle {
          transition: transform 0.2s ease;
        }

        .pulse-dot {
          animation: pulse 1.5s ease-in-out infinite;
        }

        .pulse-ring {
          animation: pulseRing 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { r: 8; }
          50% { r: 10; }
        }

        @keyframes pulseRing {
          0% { r: 10; opacity: 0.8; }
          100% { r: 24; opacity: 0; }
        }
      }

      .mission-label {
        position: absolute;
        transform: translateX(-50%);
        background: rgba(250, 140, 22, 0.9);
        color: #fff;
        font-size: 10px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 3px;
        white-space: nowrap;
        pointer-events: none;

        &.urgent {
          background: rgba(255, 77, 79, 0.9);
        }
      }

      .vehicle-marker {
        position: absolute;
        width: 28px;
        height: 28px;
        cursor: pointer;
        transition: all 0.2s ease;

        &:hover {
          transform: scale(1.2);
          z-index: 100;

          .v-plate {
            opacity: 1;
            transform: translateY(0);
          }
        }

        &.idle .v-icon {
          background: $color-status-success;
          box-shadow: 0 0 8px rgba(82, 196, 26, 0.6);
        }
        &.active .v-icon {
          background: $color-status-info;
          box-shadow: 0 0 10px rgba(24, 144, 255, 0.7);
          animation: activePulse 2s ease-in-out infinite;
        }
        &.active.hovered .v-icon {
          background: $color-status-info;
        }
        &.selected .v-icon {
          background: $color-funeral-gold;
          box-shadow: 0 0 16px rgba(201, 168, 108, 0.8);
          transform: scale(1.15);
        }

        @keyframes activePulse {
          0%, 100% { box-shadow: 0 0 10px rgba(24, 144, 255, 0.5); }
          50% { box-shadow: 0 0 16px rgba(24, 144, 255, 0.8); }
        }

        .v-icon {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 2px solid #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          transition: all 0.2s ease;
        }

        .v-plate {
          position: absolute;
          top: -18px;
          left: 50%;
          transform: translateX(-50%) translateY(4px);
          background: rgba(26, 26, 31, 0.95);
          border: 1px solid $color-funeral-gold;
          color: $color-funeral-gold;
          font-size: 10px;
          font-weight: 600;
          padding: 1px 4px;
          border-radius: 3px;
          white-space: nowrap;
          opacity: 0;
          transition: all 0.2s ease;
        }
      }
    }

    .vehicle-popup {
      position: absolute;
      width: 260px;
      padding: 0;
      z-index: 50;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      overflow: hidden;

      .popup-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 14px;
        background: $color-funeral-dark;
        border-bottom: 1px solid $color-funeral-border;

        .popup-title {
          display: flex;
          align-items: center;
          gap: 8px;

          .vehicle-type-tag {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 3px;
            font-weight: 600;

            &.hearse {
              background: rgba(24, 144, 255, 0.2);
              color: #1890FF;
            }
            &.family_car {
              background: rgba(114, 46, 209, 0.2);
              color: #722ED1;
            }
          }

          .popup-plate {
            font-size: 15px;
            font-weight: 700;
            color: $color-funeral-text-primary;
          }
        }
      }

      .popup-body {
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;

        .popup-row {
          display: flex;
          justify-content: space-between;
          font-size: 12px;

          .lbl {
            color: $color-funeral-text-muted;
          }

          .val {
            color: $color-funeral-text-primary;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            max-width: 60%;
            text-align: right;

            &.gold {
              color: $color-funeral-gold;
              font-weight: 700;
            }
          }

          &.highlight {
            padding-top: 6px;
            margin-top: 4px;
            border-top: 1px dashed $color-funeral-border;
          }

          .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
          }
        }
      }
    }

    .map-legend {
      display: flex;
      justify-content: center;
      gap: 24px;
      padding: 10px 16px;
      border-top: 1px solid $color-funeral-border;
      flex-wrap: wrap;

      .legend-group {
        display: flex;
        align-items: center;
        gap: 10px;

        .legend-title {
          font-size: 11px;
          color: $color-funeral-text-muted;
          font-weight: 500;
        }

        .legend-item {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: $color-funeral-text-secondary;

          .lg-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;

            &.fh { background: #C9A86C; }
            &.idle { background: #52C41A; }
            &.active { background: #1890FF; }
            &.maintenance { background: #FA8C16; }
            &.urgent { background: #FF4D4F; }
            &.pending { background: #FA8C16; }
          }
        }
      }
    }
  }

  .assign-dialog {
    :deep(.el-dialog__header) {
      border-bottom: 1px solid $color-funeral-border;
      padding: 16px 20px;
    }
    :deep(.el-dialog__title) {
      color: $color-funeral-gold;
    }
    :deep(.el-dialog__body) {
      padding: 16px 20px;
    }
    :deep(.el-dialog__footer) {
      border-top: 1px solid $color-funeral-border;
      padding: 12px 20px;
    }

    .assign-mission-info {
      padding: 10px 12px;
      background: rgba(201, 168, 108, 0.06);
      border-radius: 6px;
      margin-bottom: 16px;
      border: 1px solid $color-funeral-border;

      .ami-code {
        font-size: 14px;
        font-weight: 600;
        color: $color-funeral-gold;
        margin-bottom: 6px;
      }

      .ami-row {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: $color-funeral-text-secondary;
        margin-top: 4px;
      }
    }

    .vehicle-list-scroll {
      max-height: 360px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
      @include scrollbar-custom;

      .vehicle-option {
        padding: 12px;
        border: 1px solid $color-funeral-border;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;

        &:hover {
          border-color: $color-funeral-gold-dark;
          background: rgba(201, 168, 108, 0.04);
        }

        &.selected {
          border-color: $color-funeral-gold;
          background: rgba(201, 168, 108, 0.08);
        }

        .vo-radio {
          margin-bottom: 6px;

          .vo-plate {
            font-size: 14px;
            font-weight: 600;
            color: $color-funeral-text-primary;
            margin-right: 8px;
          }

          .vo-type {
            font-size: 10px;
            padding: 1px 6px;
            border-radius: 2px;
            font-weight: 500;

            &.hearse {
              background: rgba(24, 144, 255, 0.15);
              color: #1890FF;
            }
            &.family_car {
              background: rgba(114, 46, 209, 0.15);
              color: #722ED1;
            }
          }
        }

        .vo-detail {
          font-size: 12px;
          color: $color-funeral-text-secondary;

          .sep {
            margin: 0 6px;
            color: $color-funeral-text-muted;
          }
        }

        .vo-model {
          font-size: 11px;
          color: $color-funeral-text-muted;
          margin-top: 4px;
        }
      }
    }

    .btn-gold {
      @include gold-gradient;
      border: none;
    }
  }
}

@media (max-width: 1200px) {
  .dispatch-page {
    .dispatch-body {
      flex-direction: column;
    }
    .mission-panel {
      width: 100%;
      min-width: 0;
      max-height: 500px;
    }
  }
}
</style>
