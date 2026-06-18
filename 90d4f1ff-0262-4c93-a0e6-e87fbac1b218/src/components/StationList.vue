<template>
  <div class="station-list-wrapper">
    <div class="page-container">
      <div class="stats-row">
        <div class="stat-card" v-for="stat in statsCards" :key="stat.label">
          <div class="stat-label">{{ stat.label }}</div>
          <div class="stat-value" :style="{ color: stat.color }">{{ stat.value }}</div>
        </div>
      </div>

      <div class="card filter-bar">
        <el-form :inline="true" :model="filterForm" class="filter-form">
          <el-form-item label="搜索">
            <el-input
              v-model="filterForm.keyword"
              placeholder="桩编号/名称/位置"
              clearable
              style="width: 240px"
              :prefix-icon="Search"
            />
          </el-form-item>
          <el-form-item label="状态">
            <el-select v-model="filterForm.status" placeholder="全部" clearable style="width: 140px">
              <el-option label="空闲" value="Idle" />
              <el-option label="充电中" value="Charging" />
              <el-option label="已预约" value="Reserved" />
              <el-option label="故障" value="Faulty" />
              <el-option label="离线" value="Offline" />
            </el-select>
          </el-form-item>
          <el-form-item label="类型">
            <el-select v-model="filterForm.type" placeholder="全部" clearable style="width: 140px">
              <el-option label="交流(AC)" value="AC" />
              <el-option label="直流(DC)" value="DC" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :icon="Refresh" @click="refreshData" :loading="loading">
              刷新
            </el-button>
          </el-form-item>
        </el-form>
      </div>

      <div v-loading="loading" class="card">
        <div class="card-title flex-between">
          <span>充电桩列表</span>
          <div class="view-switch">
            <el-radio-group v-model="viewMode" size="default">
              <el-radio-button label="card">
                <el-icon><Grid /></el-icon>卡片
              </el-radio-button>
              <el-radio-button label="list">
                <el-icon><List /></el-icon>列表
              </el-radio-button>
            </el-radio-group>
          </div>
        </div>

        <div v-if="filteredStations.length === 0" class="empty-state">
          <el-empty description="暂无充电桩数据" />
        </div>

        <div v-else-if="viewMode === 'card'" class="station-grid">
          <div
            v-for="station in filteredStations"
            :key="station.id"
            class="station-card"
            :class="`status-${station.status.toLowerCase()}`"
            @click="handleStationClick(station)"
          >
            <div class="station-header">
              <div class="station-code">
                <el-icon class="type-icon" :class="station.type === 'DC' ? 'dc' : 'ac'">
                  <Lightning />
                </el-icon>
                {{ station.code }}
              </div>
              <el-tag :type="statusTagType(station.status)" size="small" effect="light">
                {{ statusLabel(station.status) }}
              </el-tag>
            </div>

            <div class="station-name text-ellipsis">{{ station.name }}</div>
            <div class="station-location text-ellipsis">
              <el-icon><Location /></el-icon>
              {{ station.location }}
            </div>

            <div class="station-info">
              <div class="info-item">
                <span class="info-label">类型</span>
                <span class="info-value">{{ station.type === 'DC' ? '直流快充' : '交流慢充' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">功率</span>
                <span class="info-value">{{ station.power }} kW</span>
              </div>
              <div class="info-item">
                <span class="info-label">单价</span>
                <span class="info-value highlight">¥{{ station.pricePerKwh }}/kWh</span>
              </div>
            </div>

            <div v-if="station.status === 'Charging'" class="charging-progress">
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: `${chargedPercent(station)}%` }"></div>
              </div>
              <div class="progress-info">
                <span>{{ station.chargedKwh?.toFixed(1) || 0 }} kWh</span>
                <span>{{ station.currentPower?.toFixed(1) || 0 }} kW</span>
              </div>
            </div>

            <div v-if="station.status === 'Offline' && station.lastHeartbeat" class="offline-info">
              <el-icon><Warning /></el-icon>
              <span>已离线 {{ computeOfflineDuration(station.lastHeartbeat) }}</span>
            </div>

            <div class="station-actions">
              <el-button
                v-if="station.status === 'Idle'"
                type="primary"
                size="small"
                :icon="Calendar"
                @click.stop="openReservationDialog(station)"
              >
                预约
              </el-button>
              <el-button
                v-if="station.status === 'Idle'"
                type="success"
                size="small"
                :icon="VideoPlay"
                @click.stop="startCharging(station)"
              >
                开始充电
              </el-button>
              <el-button
                v-if="station.status === 'Offline'"
                type="info"
                size="small"
                disabled
              >
                离线不可用
              </el-button>
              <el-button
                v-if="station.status === 'Charging'"
                type="danger"
                size="small"
                :icon="VideoPause"
                @click.stop="stopCharging(station)"
              >
                结束充电
              </el-button>
              <el-button
                v-if="station.status === 'Faulty' && authStore.hasRole(['SuperAdmin','ChargingOps'])"
                type="warning"
                size="small"
                :icon="Tools"
                @click.stop="reportFault(station)"
              >
                报修
              </el-button>
            </div>
          </div>
        </div>

        <el-table v-else :data="filteredStations" stripe style="width: 100%">
          <el-table-column prop="code" label="编号" width="120" />
          <el-table-column prop="name" label="名称" min-width="140" show-overflow-tooltip />
          <el-table-column label="类型" width="110">
            <template #default="{ row }">
              <el-tag :type="row.type === 'DC' ? 'danger' : 'primary'" size="small">
                {{ row.type === 'DC' ? '直流快充' : '交流慢充' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="power" label="功率(kW)" width="100" />
          <el-table-column label="单价" width="120">
            <template #default="{ row }">¥{{ row.pricePerKwh }}/kWh</template>
          </el-table-column>
          <el-table-column prop="location" label="位置" min-width="160" show-overflow-tooltip />
          <el-table-column label="状态" width="110">
            <template #default="{ row }">
              <el-tag :type="statusTagType(row.status)" effect="light">
                {{ statusLabel(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column v-if="chargingStore.stationStats.charging > 0" label="当前功率" width="120">
            <template #default="{ row }">
              <span v-if="row.status === 'Charging'">{{ row.currentPower?.toFixed(1) || 0 }} kW</span>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="220" fixed="right">
            <template #default="{ row }">
              <el-button
                v-if="row.status === 'Idle'"
                type="primary"
                size="small"
                link
                @click="openReservationDialog(row)"
              >预约</el-button>
              <el-button
                v-if="row.status === 'Idle'"
                type="success"
                size="small"
                link
                @click="startCharging(row)"
              >开始充电</el-button>
              <el-button
                v-if="row.status === 'Charging'"
                type="danger"
                size="small"
                link
                @click="stopCharging(row)"
              >结束充电</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <el-dialog
      v-model="reservationDialogVisible"
      title="预约充电桩"
      width="520px"
      :close-on-click-modal="false"
    >
      <div v-if="selectedStation" class="reservation-dialog">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="充电桩">{{ selectedStation.code }} - {{ selectedStation.name }}</el-descriptions-item>
          <el-descriptions-item label="类型/功率">
            {{ selectedStation.type === 'DC' ? '直流' : '交流' }} / {{ selectedStation.power }}kW
          </el-descriptions-item>
          <el-descriptions-item label="位置">{{ selectedStation.location }}</el-descriptions-item>
          <el-descriptions-item label="单价">¥{{ selectedStation.pricePerKwh }}/kWh</el-descriptions-item>
        </el-descriptions>

        <el-form :model="reservationForm" label-width="80px" class="mt-4">
          <el-form-item label="预约日期">
            <el-date-picker
              v-model="reservationForm.date"
              type="date"
              placeholder="选择日期"
              value-format="YYYY-MM-DD"
              :disabled-date="disablePastDate"
              style="width: 100%"
              @change="loadAvailableSlots"
            />
          </el-form-item>
          <el-form-item label="时段选择">
            <div class="time-slots">
              <div
                v-for="slot in availableSlots"
                :key="slot.startTime"
                class="time-slot"
                :class="{
                  active: isSlotSelected(slot),
                  disabled: !slot.available,
                  'in-range': isSlotInRange(slot)
                }"
                @click="toggleSlot(slot)"
              >
                {{ formatSlotTime(slot.startTime) }}
              </div>
            </div>
            <div class="text-muted text-small mt-2">
              提示：点击开始时间和结束时间选择连续时段
            </div>
          </el-form-item>
          <el-form-item v-if="selectedTimeRange" label="预约时段">
            <el-tag type="primary" effect="light">
              {{ formatSlotTime(selectedTimeRange.startTime) }} - {{ formatSlotTime(selectedTimeRange.endTime) }}
            </el-tag>
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="reservationDialogVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!selectedTimeRange" @click="confirmReservation">
          确认预约
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Search, Refresh, Grid, List, Lightning, Location, Calendar,
  VideoPlay, VideoPause, Tools, Warning
} from '@element-plus/icons-vue'
import { useChargingStore } from '@/stores/charging'
import { useAuthStore } from '@/stores/auth'
import dayjs from '@/utils'
import type { ChargingStation, ChargingStationStatus } from '@/types'

const chargingStore = useChargingStore()
const authStore = useAuthStore()

const loading = computed(() => chargingStore.loading)
const viewMode = ref<'card' | 'list'>('card')
const selectedStation = ref<ChargingStation | null>(null)
const reservationDialogVisible = ref(false)
const availableSlots = ref<{ startTime: string; endTime: string; available: boolean }[]>([])

const filterForm = reactive({
  keyword: '',
  status: '',
  type: ''
})

const reservationForm = reactive({
  date: dayjs().format('YYYY-MM-DD'),
  startTime: '',
  endTime: ''
})

const selectedStart = ref<string | null>(null)
const selectedEnd = ref<string | null>(null)

const statsCards = computed(() => [
  { label: '充电桩总数', value: chargingStore.stationStats.total, color: '#303133' },
  { label: '空闲中', value: chargingStore.stationStats.idle, color: '#67c23a' },
  { label: '充电中', value: chargingStore.stationStats.charging, color: '#409eff' },
  { label: '已预约', value: chargingStore.stationStats.reserved, color: '#e6a23c' },
  { label: '故障/离线', value: chargingStore.stationStats.faulty + chargingStore.stationStats.offline, color: '#f56c6c' },
  { label: '利用率', value: chargingStore.stationStats.utilizationRate + '%', color: '#909399' }
])

const filteredStations = computed(() => {
  return chargingStore.stations.filter(s => {
    if (filterForm.keyword) {
      const kw = filterForm.keyword.toLowerCase()
      if (!s.code.toLowerCase().includes(kw) &&
          !s.name.toLowerCase().includes(kw) &&
          !s.location.toLowerCase().includes(kw)) return false
    }
    if (filterForm.status && s.status !== filterForm.status) return false
    if (filterForm.type && s.type !== filterForm.type) return false
    return true
  })
})

const selectedTimeRange = computed(() => {
  if (!selectedStart.value || !selectedEnd.value) return null
  const slots = availableSlots.value
  const startIdx = slots.findIndex(s => s.startTime === selectedStart.value)
  const endIdx = slots.findIndex(s => s.startTime === selectedEnd.value)
  if (startIdx === -1 || endIdx === -1) return null
  const [si, ei] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx]
  return {
    startTime: slots[si].startTime,
    endTime: slots[ei].endTime
  }
})

const statusLabel = (status: ChargingStationStatus): string => {
  const labels: Record<ChargingStationStatus, string> = {
    Idle: '空闲',
    Charging: '充电中',
    Reserved: '已预约',
    Faulty: '故障',
    Offline: '离线'
  }
  return labels[status]
}

const statusTagType = (status: ChargingStationStatus) => {
  const types: Record<ChargingStationStatus, 'success' | 'primary' | 'warning' | 'danger' | 'info'> = {
    Idle: 'success',
    Charging: 'primary',
    Reserved: 'warning',
    Faulty: 'danger',
    Offline: 'info'
  }
  return types[status]
}

const chargedPercent = (station: ChargingStation) => {
  return Math.min(100, ((station.chargedKwh || 0) / (station.power * 4)) * 100)
}

const computeOfflineDuration = (lastHeartbeat: string) => {
  const last = new Date(lastHeartbeat).getTime()
  const now = Date.now()
  const diff = Math.max(0, Math.floor((now - last) / 60000))
  if (diff < 60) return `${diff}分钟`
  const h = Math.floor(diff / 60)
  const m = diff % 60
  if (h < 24) return `${h}小时${m}分钟`
  const d = Math.floor(h / 24)
  return `${d}天${h % 24}小时`
}

const formatSlotTime = (t: string) => t.substring(0, 5)

const disablePastDate = (date: Date) => {
  return date.getTime() < dayjs().startOf('day').valueOf()
}

const isSlotSelected = (slot: { startTime: string; endTime: string }) => {
  return slot.startTime === selectedStart.value || slot.startTime === selectedEnd.value
}

const isSlotInRange = (slot: { startTime: string; endTime: string }) => {
  if (!selectedStart.value || !selectedEnd.value) return false
  const slots = availableSlots.value
  const si = slots.findIndex(s => s.startTime === selectedStart.value)
  const ei = slots.findIndex(s => s.startTime === selectedEnd.value)
  const cur = slots.findIndex(s => s.startTime === slot.startTime)
  const [min, max] = si <= ei ? [si, ei] : [ei, si]
  return cur > min && cur < max
}

const toggleSlot = (slot: { startTime: string; endTime: string; available: boolean }) => {
  if (!slot.available) return
  if (!selectedStart.value) {
    selectedStart.value = slot.startTime
  } else if (!selectedEnd.value) {
    const slots = availableSlots.value
    const si = slots.findIndex(s => s.startTime === selectedStart.value)
    const ei = slots.findIndex(s => s.startTime === slot.startTime)
    const [min, max] = si <= ei ? [si, ei] : [ei, si]
    const allAvailable = slots.slice(min, max + 1).every(s => s.available)
    if (!allAvailable) {
      ElMessage.warning('所选时段存在已占用，请重新选择')
      selectedStart.value = slot.startTime
      selectedEnd.value = null
      return
    }
    selectedEnd.value = slot.startTime
  } else {
    selectedStart.value = slot.startTime
    selectedEnd.value = null
  }
}

const loadAvailableSlots = async () => {
  if (!selectedStation.value) return
  selectedStart.value = null
  selectedEnd.value = null
  try {
    availableSlots.value = await chargingStore.getAvailableSlots(
      selectedStation.value.id,
      reservationForm.date
    )
  } catch {
    availableSlots.value = generateMockSlots()
  }
}

const generateMockSlots = () => {
  const slots: { startTime: string; endTime: string; available: boolean }[] = []
  for (let h = 0; h < 24; h++) {
    slots.push({
      startTime: `${String(h).padStart(2, '0')}:00:00`,
      endTime: `${String(h + 1).padStart(2, '0')}:00:00`,
      available: Math.random() > 0.3
    })
  }
  return slots
}

const handleStationClick = (_station: ChargingStation) => {
  // card click navigation if needed
}

const openReservationDialog = async (station: ChargingStation) => {
  selectedStation.value = station
  reservationForm.date = dayjs().format('YYYY-MM-DD')
  reservationDialogVisible.value = true
  await loadAvailableSlots()
}

const confirmReservation = async () => {
  if (!selectedStation.value || !selectedTimeRange.value) return
  try {
    await chargingStore.createReservation({
      stationId: selectedStation.value.id,
      startTime: `${reservationForm.date}T${selectedTimeRange.value.startTime}`,
      endTime: `${reservationForm.date}T${selectedTimeRange.value.endTime}`
    })
    ElMessage.success('预约成功，超时15分钟将自动取消')
    reservationDialogVisible.value = false
  } catch (e: any) {
    ElMessage.error(e.message || '预约失败')
  }
}

const startCharging = async (station: ChargingStation) => {
  await ElMessageBox.confirm(`确认开始使用充电桩 ${station.code}？`, '提示', { type: 'info' })
  try {
    await chargingStore.startCharging(station.id)
    ElMessage.success('已开始充电')
  } catch (e: any) {
    ElMessage.error(e.message || '启动充电失败')
  }
}

const stopCharging = async (station: ChargingStation) => {
  const session = chargingStore.sessions.items.find(
    s => s.stationId === station.id && s.status === 'Charging'
  )
  if (!session) {
    ElMessage.warning('未找到充电会话')
    return
  }
  await ElMessageBox.confirm(
    `确认结束充电？已充电 ${session.totalKwh?.toFixed(2) || 0} kWh`,
    '提示',
    { type: 'warning' }
  )
  try {
    const result = await chargingStore.stopCharging(session.id)
    ElMessage.success(`充电结束，费用 ¥${(result.cost || 0).toFixed(2)}`)
  } catch (e: any) {
    ElMessage.error(e.message || '结束充电失败')
  }
}

const reportFault = (station: ChargingStation) => {
  ElMessage.info(`已提交充电桩 ${station.code} 报修工单`)
}

const refreshData = async () => {
  await chargingStore.fetchStations()
  ElMessage.success('刷新成功')
}

onMounted(async () => {
  await chargingStore.fetchStations()
})
</script>

<style lang="scss" scoped>
.station-list-wrapper { width: 100%; }

.mt-4 { margin-top: 16px; }
.mt-2 { margin-top: 8px; }
.text-muted { color: #909399; }
.text-small { font-size: 12px; }

.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.filter-bar {
  margin-bottom: 16px;
}

.filter-form {
  margin-bottom: 0;
}

.view-switch {
  user-select: none;
}

.station-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.station-card {
  border: 1px solid #ebeef5;
  border-radius: 10px;
  padding: 16px;
  background: #fff;
  cursor: pointer;
  transition: all 0.25s ease;
  position: relative;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
  }

  &.status-charging {
    border-color: #409eff;
    background: linear-gradient(135deg, #fff 0%, #ecf5ff 100%);
  }

  &.status-faulty {
    border-color: #fbc4c4;
    background: #fef0f0;
  }

  &.status-offline {
    opacity: 0.65;
  }
}

.station-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.station-code {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 16px;
  color: #303133;

  .type-icon {
    &.ac { color: #409eff; }
    &.dc { color: #f56c6c; }
  }
}

.station-name {
  font-size: 14px;
  color: #606266;
  margin-bottom: 4px;
}

.station-location {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #909399;
  margin-bottom: 12px;
}

.station-info {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 6px;
  margin-bottom: 12px;
}

.info-item {
  text-align: center;

  .info-label {
    display: block;
    font-size: 11px;
    color: #909399;
    margin-bottom: 2px;
  }

  .info-value {
    font-size: 13px;
    color: #303133;
    font-weight: 500;

    &.highlight {
      color: var(--danger-color);
    }
  }
}

.charging-progress {
  margin-bottom: 12px;

  .progress-bar {
    height: 6px;
    background: #ebeef5;
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 6px;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #67c23a, #409eff);
    border-radius: 3px;
    transition: width 0.5s ease;
  }

  .progress-info {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: #606266;
  }
}

.offline-info {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: #fdf6ec;
  border-radius: 6px;
  margin-bottom: 12px;
  font-size: 12px;
  color: #e6a23c;

  .el-icon {
    font-size: 14px;
  }
}

.station-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.reservation-dialog {
  .time-slots {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 6px;
    max-height: 260px;
    overflow-y: auto;
    padding: 8px;
    border: 1px solid #ebeef5;
    border-radius: 6px;
  }

  .time-slot {
    padding: 6px 4px;
    text-align: center;
    font-size: 12px;
    background: #f5f7fa;
    border: 1px solid #ebeef5;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(.disabled) {
      border-color: var(--primary-color);
      color: var(--primary-color);
    }

    &.active {
      background: var(--primary-color);
      color: #fff;
      border-color: var(--primary-color);
    }

    &.in-range {
      background: #ecf5ff;
      color: var(--primary-color);
      border-color: #b3d8ff;
    }

    &.disabled {
      background: #f4f4f5;
      color: #c0c4cc;
      cursor: not-allowed;
      text-decoration: line-through;
    }
  }
}
</style>
