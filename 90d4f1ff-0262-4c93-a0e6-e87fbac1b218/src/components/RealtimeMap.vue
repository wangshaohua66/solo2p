<template>
  <div class="realtime-map-wrapper">
    <div class="page-container">
      <div class="toolbar card mb-4">
        <div class="toolbar-left">
          <el-select
            v-model="parkingStore.selectedLotId"
            placeholder="选择停车场"
            style="width: 200px"
            @change="handleLotChange"
          >
            <el-option
              v-for="lot in parkingStore.parkingLots"
              :key="lot.id"
              :label="lot.name"
              :value="lot.id"
            />
          </el-select>
          <el-select
            v-if="parkingStore.selectedLot?.floors"
            v-model="parkingStore.selectedFloorId"
            placeholder="选择楼层"
            style="width: 160px; margin-left: 12px"
            @change="handleFloorChange"
          >
            <el-option
              v-for="floor in parkingStore.selectedLot.floors"
              :key="floor.id"
              :label="floor.name"
              :value="floor.id"
            />
          </el-select>
        </div>
        <div class="toolbar-right">
          <div class="stat-item">
            <span class="dot available"></span>
            空闲 <strong>{{ parkingStore.totalStats.available }}</strong>
          </div>
          <div class="stat-item">
            <span class="dot occupied"></span>
            占用 <strong>{{ parkingStore.totalStats.occupied }}</strong>
          </div>
          <div class="stat-item">
            <span class="dot reserved"></span>
            预约 <strong>{{ parkingStore.totalStats.reserved }}</strong>
          </div>
          <div class="stat-item">
            <span class="dot offline"></span>
            离线 <strong>{{ parkingStore.totalStats.offline }}</strong>
          </div>
          <el-divider direction="vertical" />
          <div class="stat-item occupancy">
            占有率: <strong>{{ parkingStore.totalStats.occupancyRate }}%</strong>
          </div>
          <el-button type="primary" :icon="Refresh" @click="refreshData" :loading="parkingStore.loading">
            刷新
          </el-button>
        </div>
      </div>

      <div class="content-row">
        <div class="map-container card">
          <div class="card-title flex-between">
            <span>{{ parkingStore.selectedLot?.name || '实时车位地图' }} - {{ parkingStore.selectedFloor?.name || '' }}</span>
            <el-tag v-if="signalrConnected" type="success" effect="light">
              <span class="status-dot online"></span>实时同步中
            </el-tag>
            <el-tag v-else type="danger" effect="light">
              <span class="status-dot offline"></span>连接已断开
            </el-tag>
          </div>
          <div v-loading="parkingStore.loading" class="map-area">
            <svg
              v-if="parkingStore.selectedFloor && parkingStore.selectedFloor.spots.length > 0"
              :viewBox="`0 0 ${mapWidth} ${mapHeight}`"
              class="parking-svg"
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e8e8e8" stroke-width="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />

              <g v-for="(row, rowIdx) in groupedSpots" :key="rowIdx" class="spot-row">
                <rect
                  v-for="spot in row"
                  :key="spot.id"
                  :x="spot.x"
                  :y="spot.y"
                  :width="spot.width"
                  :height="spot.height"
                  :rx="4"
                  :class="['spot-rect', `status-${spot.status.toLowerCase()}`]"
                  @click="handleSpotClick(spot)"
                />
                <text
                  v-for="spot in row"
                  :key="'label-' + spot.id"
                  :x="spot.x + spot.width / 2"
                  :y="spot.y + spot.height / 2 + 4"
                  text-anchor="middle"
                  class="spot-label"
                  @click="handleSpotClick(spot)"
                >
                  {{ spot.code }}
                </text>
              </g>
            </svg>
            <el-empty v-else description="暂无车位数据" />
          </div>
        </div>

        <div class="side-panel">
          <div class="card mb-4">
            <div class="card-title">车位详情</div>
            <div v-if="selectedSpot" class="spot-detail">
              <el-descriptions :column="1" border size="default">
                <el-descriptions-item label="车位编号">
                  <el-tag type="primary">{{ selectedSpot.code }}</el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="状态">
                  <el-tag :type="spotStatusTagType(selectedSpot.status)" effect="light">
                    {{ spotStatusLabel(selectedSpot.status) }}
                  </el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="所在区域">
                  {{ parkingStore.selectedLot?.name }} / {{ parkingStore.selectedFloor?.name }}
                </el-descriptions-item>
                <el-descriptions-item v-if="selectedSpot.plateNumber" label="车牌号">
                  {{ selectedSpot.plateNumber }}
                </el-descriptions-item>
                <el-descriptions-item v-if="selectedSpot.entryTime" label="入场时间">
                  {{ formatDate(selectedSpot.entryTime) }}
                </el-descriptions-item>
                <el-descriptions-item v-if="selectedSpot.entryTime" label="已停时长">
                  <span class="duration-text">{{ computeDuration(selectedSpot.entryTime) }}</span>
                </el-descriptions-item>
              </el-descriptions>
              <div v-if="authStore.hasRole(['SuperAdmin', 'ParkOperator', 'ParkingAdmin'])" class="detail-actions">
                <el-button
                  v-if="selectedSpot.status === 'Available'"
                  type="primary"
                  @click="showEntryDialog(selectedSpot)"
                >
                  车辆入场
                </el-button>
                <el-button
                  v-if="selectedSpot.status === 'Occupied'"
                  type="danger"
                  @click="handleExitParking(selectedSpot)"
                >
                  车辆出场
                </el-button>
                <el-button
                  v-if="selectedSpot.status === 'Offline'"
                  type="warning"
                  @click="markSpotOnline(selectedSpot.id)"
                >
                  标记上线
                </el-button>
              </div>
            </div>
            <el-empty v-else description="点击车位查看详情" :image-size="100" />
          </div>

          <div class="card">
            <div class="card-title">最近入场</div>
            <div v-if="recentEntries.length > 0" class="recent-list">
              <div v-for="record in recentEntries" :key="record.id" class="recent-item">
                <el-avatar :size="36" class="recent-avatar">
                  <el-icon><Van /></el-icon>
                </el-avatar>
                <div class="recent-info">
                  <div class="recent-plate">{{ record.plateNumber }}</div>
                  <div class="recent-time">{{ formatRelative(record.entryTime) }} 入场</div>
                </div>
                <el-tag size="small">{{ record.spotCode }}</el-tag>
              </div>
            </div>
            <el-empty v-else description="暂无入场记录" :image-size="80" />
          </div>
        </div>
      </div>
    </div>

    <el-dialog v-model="entryDialogVisible" title="车辆入场" width="420px">
      <el-form :model="entryForm" label-width="80px">
        <el-form-item label="车位编号">
          <el-input v-model="entryForm.spotCode" disabled />
        </el-form-item>
        <el-form-item label="车牌号" prop="plateNumber" :rules="[{ required: true, message: '请输入车牌号', trigger: 'blur' }]">
          <el-input v-model="entryForm.plateNumber" placeholder="请输入车牌号" maxlength="10" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="entryDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmEntry">确认入场</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Van } from '@element-plus/icons-vue'
import { useParkingStore } from '@/stores/parking'
import { useAuthStore } from '@/stores/auth'
import { useSignalRService } from '@/services/signalr'
import { formatDate, formatRelative } from '@/utils'
import type { ParkingSpot, ParkingSpotStatus } from '@/types'

const parkingStore = useParkingStore()
const authStore = useAuthStore()
const { isConnected: signalrConnected, startConnection } = useSignalRService()

const selectedSpot = ref<ParkingSpot | null>(null)
const entryDialogVisible = ref(false)
const entryForm = ref({
  spotId: '',
  spotCode: '',
  plateNumber: ''
})
let durationTimer: ReturnType<typeof setInterval> | null = null

const mapWidth = computed(() => {
  if (!parkingStore.selectedFloor?.spots.length) return 800
  const maxX = Math.max(...parkingStore.selectedFloor.spots.map(s => s.x + s.width))
  return Math.max(maxX + 60, 800)
})

const mapHeight = computed(() => {
  if (!parkingStore.selectedFloor?.spots.length) return 500
  const maxY = Math.max(...parkingStore.selectedFloor.spots.map(s => s.y + s.height))
  return Math.max(maxY + 60, 500)
})

const groupedSpots = computed(() => {
  if (!parkingStore.selectedFloor) return []
  const rows: ParkingSpot[][] = []
  const rowMap = new Map<number, ParkingSpot[]>()
  parkingStore.selectedFloor.spots.forEach(spot => {
    const rowY = Math.round(spot.y / 10) * 10
    if (!rowMap.has(rowY)) rowMap.set(rowY, [])
    rowMap.get(rowY)!.push(spot)
  })
  Array.from(rowMap.keys()).sort((a, b) => a - b).forEach(y => {
    const row = rowMap.get(y)!.sort((a, b) => a.x - b.x)
    rows.push(row)
  })
  return rows
})

const recentEntries = computed(() => {
  return parkingStore.currentRecords.items.slice(0, 5)
})

const spotStatusLabel = (status: ParkingSpotStatus) => {
  const labels: Record<ParkingSpotStatus, string> = {
    Available: '空闲',
    Occupied: '占用中',
    Reserved: '已预约',
    Offline: '离线'
  }
  return labels[status]
}

const spotStatusTagType = (status: ParkingSpotStatus) => {
  const types: Record<ParkingSpotStatus, 'success' | 'danger' | 'warning' | 'info'> = {
    Available: 'success',
    Occupied: 'danger',
    Reserved: 'warning',
    Offline: 'info'
  }
  return types[status]
}

const computeDuration = (entryTime: string) => {
  const start = new Date(entryTime).getTime()
  const now = Date.now()
  const diff = Math.max(0, Math.floor((now - start) / 60000))
  const h = Math.floor(diff / 60)
  const m = diff % 60
  return h > 0 ? `${h}小时${m}分钟` : `${m}分钟`
}

const handleLotChange = (lotId: string) => {
  parkingStore.selectLot(lotId)
  selectedSpot.value = null
}

const handleFloorChange = () => {
  selectedSpot.value = null
}

const handleSpotClick = (spot: ParkingSpot) => {
  selectedSpot.value = spot
}

const showEntryDialog = (spot: ParkingSpot) => {
  entryForm.value = {
    spotId: spot.id,
    spotCode: spot.code,
    plateNumber: ''
  }
  entryDialogVisible.value = true
}

const confirmEntry = async () => {
  if (!entryForm.value.plateNumber) {
    ElMessage.warning('请输入车牌号')
    return
  }
  try {
    await parkingStore.entryParking({
      spotId: entryForm.value.spotId,
      plateNumber: entryForm.value.plateNumber
    })
    ElMessage.success('入场成功')
    entryDialogVisible.value = false
  } catch (e: any) {
    ElMessage.error(e.message || '入场失败')
  }
}

const handleExitParking = async (spot: ParkingSpot) => {
  await ElMessageBox.confirm(
    `确认车辆 ${spot.plateNumber} 从车位 ${spot.code} 出场？`,
    '出场确认',
    { type: 'warning' }
  )
  try {
    const record = parkingStore.currentRecords.items.find(
      r => r.spotId === spot.id && r.status === 'InProgress'
    )
    if (!record) return
    const result = await parkingStore.exitParking({
      recordId: record.id,
      plateNumber: spot.plateNumber || ''
    })
    ElMessage.success(`出场成功，费用：¥${result.fee.toFixed(2)}`)
    selectedSpot.value = null
  } catch (e: any) {
    ElMessage.error(e.message || '出场失败')
  }
}

const markSpotOnline = async (spotId: string) => {
  ElMessage.success('已标记上线')
}

const refreshData = async () => {
  await Promise.all([
    parkingStore.fetchParkingLots(),
    parkingStore.fetchRecords({ pageIndex: 1, pageSize: 20 })
  ])
  ElMessage.success('刷新成功')
}

onMounted(async () => {
  await parkingStore.fetchParkingLots()
  await parkingStore.fetchRecords({ pageIndex: 1, pageSize: 20 })
  durationTimer = setInterval(() => {}, 60000)
})

onUnmounted(() => {
  if (durationTimer) clearInterval(durationTimer)
})
</script>

<style lang="scss" scoped>
.realtime-map-wrapper {
  width: 100%;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;

  &-left { display: flex; align-items: center; }
  &-right { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
}

.mb-4 { margin-bottom: 16px; }

.stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #606266;

  strong {
    color: #303133;
    font-size: 15px;
    margin-left: 2px;
  }

  &.occupancy strong {
    color: var(--primary-color);
    font-size: 16px;
  }
}

.dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 3px;

  &.available { background: var(--spot-available); }
  &.occupied { background: var(--spot-occupied); }
  &.reserved { background: var(--spot-reserved); }
  &.offline { background: var(--spot-offline); }
}

.content-row {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 16px;

  @media (max-width: 1100px) {
    grid-template-columns: 1fr;
  }
}

.map-container {
  min-height: 600px;
}

.map-area {
  min-height: 540px;
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  background: #fafbfc;
}

.parking-svg {
  width: 100%;
  height: 540px;
  display: block;
}

.spot-rect {
  cursor: pointer;
  stroke-width: 2;
  transition: all 0.2s ease;

  &:hover {
    stroke-width: 3;
    filter: brightness(1.05);
  }

  &.status-available {
    fill: #f0f9eb;
    stroke: var(--spot-available);
  }

  &.status-occupied {
    fill: #fef0f0;
    stroke: var(--spot-occupied);
  }

  &.status-reserved {
    fill: #fdf6ec;
    stroke: var(--spot-reserved);
  }

  &.status-offline {
    fill: #f4f4f5;
    stroke: var(--spot-offline);
  }
}

.spot-label {
  font-size: 11px;
  fill: #606266;
  pointer-events: none;
  user-select: none;
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;

  &.online {
    background: var(--success-color);
    animation: pulse 2s infinite;
  }

  &.offline {
    background: var(--danger-color);
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.side-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.spot-detail {
  .detail-actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }

  .duration-text {
    color: var(--primary-color);
    font-weight: 600;
  }
}

.recent-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.recent-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 6px;
  background: #f5f7fa;
  transition: background 0.2s;

  &:hover {
    background: #ecf5ff;
  }
}

.recent-avatar {
  background: linear-gradient(135deg, #409eff, #67c23a);
  flex-shrink: 0;
}

.recent-info {
  flex: 1;
  min-width: 0;
}

.recent-plate {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.recent-time {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}
</style>
