<template>
  <div class="vehicle-management">
    <div class="page-header">
      <h2>车辆管理</h2>
      <div class="header-actions">
        <el-button type="primary" @click="openVehicleDialog">
          <el-icon><Plus /></el-icon>
          新增车辆
        </el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="vehicle-tabs">
      <el-tab-pane label="车辆列表" name="vehicles">
        <el-card class="stats-card">
          <el-row :gutter="20">
            <el-col :span="6">
              <div class="stat-item">
                <div class="stat-icon available"><el-icon><Van /></el-icon></div>
                <div class="stat-info">
                  <div class="stat-value">{{ stats.total }}</div>
                  <div class="stat-label">车辆总数</div>
                </div>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="stat-item">
                <div class="stat-icon on-call"><el-icon><Warning /></el-icon></div>
                <div class="stat-info">
                  <div class="stat-value">{{ stats.available }}</div>
                  <div class="stat-label">可用车辆</div>
                </div>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="stat-item">
                <div class="stat-icon maintenance"><el-icon><Tools /></el-icon></div>
                <div class="stat-info">
                  <div class="stat-value">{{ stats.maintenance }}</div>
                  <div class="stat-label">维保中</div>
                </div>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="stat-item">
                <div class="stat-icon alert"><el-icon><Bell /></el-icon></div>
                <div class="stat-info">
                  <div class="stat-value">{{ stats.dueMaintenance }}</div>
                  <div class="stat-label">待保养</div>
                </div>
              </div>
            </el-col>
          </el-row>
        </el-card>

        <el-card class="table-card">
          <div class="table-header">
            <el-input
              v-model="searchKeyword"
              placeholder="搜索车牌号/司机"
              style="width: 200px"
              clearable
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
            <el-select v-model="statusFilter" placeholder="状态" style="width: 120px" clearable>
              <el-option label="可用" value="AVAILABLE" />
              <el-option label="执行任务" value="ON_CALL" />
              <el-option label="在现场" value="ON_SCENE" />
              <el-option label="转运中" value="TRANSPORTING" />
              <el-option label="维修中" value="MAINTENANCE" />
            </el-select>
          </div>

          <el-table :data="vehicles" v-loading="loading">
            <el-table-column prop="plateNumber" label="车牌号" width="120" />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="getStatusType(row.status)" size="small">
                  {{ getStatusText(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="vehicleType" label="车型" width="100" />
            <el-table-column prop="equipmentLevel" label="装备等级" width="100" />
            <el-table-column prop="driverName" label="司机" width="100" />
            <el-table-column prop="driverPhone" label="联系电话" width="140" />
            <el-table-column label="当前位置" min-width="200">
              <template #default="{ row }">
                <span v-if="row.currentLongitude && row.currentLatitude">
                  {{ row.currentLongitude.toFixed(6) }}, {{ row.currentLatitude.toFixed(6) }}
                </span>
                <span v-else class="text-muted">暂无位置信息</span>
              </template>
            </el-table-column>
            <el-table-column prop="mileageKm" label="里程(km)" width="100" />
            <el-table-column label="下次保养" width="120">
              <template #default="{ row }">
                <span :class="{ 'text-danger': row.nextMaintenanceDue && row.nextMaintenanceDue < today }">
                  {{ row.nextMaintenanceDue || '-' }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" size="small" link @click="editVehicle(row)">编辑</el-button>
                <el-button type="info" size="small" link @click="viewMaintenance(row)">维保记录</el-button>
                <el-button type="warning" size="small" link @click="viewSupplies(row)">耗材</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="pagination">
            <el-pagination
              v-model:current-page="page"
              v-model:page-size="size"
              :page-sizes="[10, 20, 50]"
              :total="total"
              layout="total, sizes, prev, pager, next, jumper"
              @size-change="loadVehicles"
              @current-change="loadVehicles"
            />
          </div>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="耗材库存" name="supplies">
        <el-card class="table-card">
          <div class="table-header">
            <el-input
              v-model="supplySearch"
              placeholder="搜索耗材名称"
              style="width: 200px"
              clearable
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
            <el-select v-model="supplyStatus" placeholder="状态" style="width: 140px" clearable>
              <el-option label="正常" value="NORMAL" />
              <el-option label="低库存" value="LOW_STOCK" />
              <el-option label="临期" value="EXPIRING_SOON" />
              <el-option label="已过期" value="EXPIRED" />
            </el-select>
            <el-button type="primary" @click="openSupplyDialog">
              <el-icon><Plus /></el-icon>
              新增耗材
            </el-button>
          </div>

          <el-table :data="supplies" v-loading="supplyLoading">
            <el-table-column prop="name" label="耗材名称" />
            <el-table-column prop="category" label="分类" width="120" />
            <el-table-column label="所属车辆" width="120">
              <template #default="{ row }">
                {{ row.ambulance?.plateNumber || '-' }}
              </template>
            </el-table-column>
            <el-table-column prop="quantity" label="库存数量" width="100" />
            <el-table-column prop="unit" label="单位" width="80" />
            <el-table-column prop="safetyStock" label="安全库存" width="100" />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="getSupplyStatusType(row.status)" size="small">
                  {{ getSupplyStatusText(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="expiryDate" label="有效期" width="120" />
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" size="small" link @click="editSupply(row)">编辑</el-button>
                <el-button type="warning" size="small" link @click="stockOut(row)">出库</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="维保记录" name="maintenance">
        <el-card class="table-card">
          <el-table :data="maintenanceRecords" v-loading="maintenanceLoading">
            <el-table-column label="车辆" width="120">
              <template #default="{ row }">
                {{ row.ambulance?.plateNumber || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="类型" width="120">
              <template #default="{ row }">
                {{ row.maintenanceType === 'ROUTINE' ? '常规保养' : row.maintenanceType === 'REPAIR' ? '故障维修' : '其他' }}
              </template>
            </el-table-column>
            <el-table-column prop="description" label="内容" min-width="200" show-overflow-tooltip />
            <el-table-column prop="maintenanceDate" label="日期" width="120" />
            <el-table-column prop="mileageKm" label="里程(km)" width="100" />
            <el-table-column prop="cost" label="费用(元)" width="100" />
            <el-table-column prop="nextMaintenanceDate" label="下次保养" width="120" />
            <el-table-column prop="technician" label="技师" width="100" />
            <el-table-column prop="remarks" label="备注" min-width="150" show-overflow-tooltip />
          </el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <el-dialog
      v-model="vehicleDialogVisible"
      :title="editingVehicle ? '编辑车辆' : '新增车辆'"
      width="500px"
    >
      <el-form :model="vehicleForm" label-width="100px">
        <el-form-item label="车牌号" required>
          <el-input v-model="vehicleForm.plateNumber" />
        </el-form-item>
        <el-form-item label="车辆状态">
          <el-select v-model="vehicleForm.status" style="width: 100%">
            <el-option label="可用" value="AVAILABLE" />
            <el-option label="维修中" value="MAINTENANCE" />
          </el-select>
        </el-form-item>
        <el-form-item label="车型">
          <el-select v-model="vehicleForm.vehicleType" style="width: 100%">
            <el-option label="监护型" value="MONITORING" />
            <el-option label="抢救型" value="RESCUE" />
            <el-option label="转运型" value="TRANSFER" />
          </el-select>
        </el-form-item>
        <el-form-item label="装备等级">
          <el-select v-model="vehicleForm.equipmentLevel" style="width: 100%">
            <el-option label="A级(基本)" value="A" />
            <el-option label="B级(中级)" value="B" />
            <el-option label="C级(高级)" value="C" />
          </el-select>
        </el-form-item>
        <el-form-item label="司机姓名">
          <el-input v-model="vehicleForm.driverName" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="vehicleForm.driverPhone" />
        </el-form-item>
        <el-form-item label="里程(km)">
          <el-input-number v-model="vehicleForm.mileageKm" :min="0" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="vehicleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveVehicle">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getVehicles,
  createAmbulance,
  updateAmbulance,
  getSupplies,
  createSupply,
  updateSupply,
  getMaintenanceHistory
} from '@/api/vehicle'
import type {
  VehicleDto,
  SupplyDto,
  VehicleMaintenance
} from '@/types/vehicle'
import { Plus, Search, Van, Warning, Tools, Bell } from '@element-plus/icons-vue'
import dayjs from 'dayjs'

const activeTab = ref('vehicles')
const loading = ref(false)
const supplyLoading = ref(false)
const maintenanceLoading = ref(false)

const vehicles = ref<VehicleDto[]>([])
const supplies = ref<SupplyDto[]>([])
const maintenanceRecords = ref<VehicleMaintenance[]>([])
const total = ref(0)
const searchKeyword = ref('')
const statusFilter = ref<string | null>(null)
const supplySearch = ref('')
const supplyStatus = ref<string | null>(null)
const page = ref(1)
const size = ref(10)

const stats = reactive({
  total: 0,
  available: 0,
  maintenance: 0,
  dueMaintenance: 0
})

const today = ref(dayjs().format('YYYY-MM-DD'))
const vehicleDialogVisible = ref(false)
const editingVehicle = ref<VehicleDto | null>(null)
const vehicleForm = reactive({
  id: null as number | null,
  plateNumber: '',
  status: 'AVAILABLE',
  vehicleType: 'MONITORING',
  equipmentLevel: 'B',
  driverName: '',
  driverPhone: '',
  mileageKm: 0,
  equipmentStatus: '{}'
})

function getStatusType(status: string) {
  const map: Record<string, string> = {
    AVAILABLE: 'success',
    ON_CALL: 'primary',
    ON_SCENE: 'warning',
    TRANSPORTING: 'info',
    MAINTENANCE: 'danger',
    OUT_OF_SERVICE: 'info'
  }
  return map[status] || 'info'
}

function getStatusText(status: string) {
  const map: Record<string, string> = {
    AVAILABLE: '可用',
    ON_CALL: '执行任务',
    ON_SCENE: '在现场',
    TRANSPORTING: '转运中',
    AT_HOSPITAL: '在医院',
    MAINTENANCE: '维修中',
    OUT_OF_SERVICE: '停运'
  }
  return map[status] || status
}

function getSupplyStatusType(status: string) {
  const map: Record<string, string> = {
    NORMAL: 'success',
    LOW_STOCK: 'warning',
    EXPIRING_SOON: 'warning',
    EXPIRED: 'danger'
  }
  return map[status] || 'info'
}

function getSupplyStatusText(status: string) {
  const map: Record<string, string> = {
    NORMAL: '正常',
    LOW_STOCK: '低库存',
    EXPIRING_SOON: '临期',
    EXPIRED: '已过期'
  }
  return map[status] || status
}

async function loadVehicles() {
  loading.value = true
  try {
    const result = await getVehicles(statusFilter.value || undefined, page.value - 1, size.value)
    vehicles.value = result.content
    total.value = result.totalElements

    stats.total = total.value
    stats.available = vehicles.value.filter(v => v.status === 'AVAILABLE').length
    stats.maintenance = vehicles.value.filter(v => v.status === 'MAINTENANCE').length
    stats.dueMaintenance = vehicles.value.filter(v => {
      if (!v.nextMaintenanceDue) return false
      return dayjs(v.nextMaintenanceDue).isBefore(today.value)
    }).length
  } catch (error) {
    console.error('Failed to load vehicles:', error)
  } finally {
    loading.value = false
  }
}

async function loadSupplies() {
  supplyLoading.value = true
  try {
    supplies.value = await getSupplies(undefined, undefined, supplyStatus.value || undefined)
  } catch (error) {
    console.error('Failed to load supplies:', error)
  } finally {
    supplyLoading.value = false
  }
}

function openVehicleDialog() {
  editingVehicle.value = null
  Object.assign(vehicleForm, {
    id: null,
    plateNumber: '',
    status: 'AVAILABLE',
    vehicleType: 'MONITORING',
    equipmentLevel: 'B',
    driverName: '',
    driverPhone: '',
    mileageKm: 0,
    equipmentStatus: '{}'
  })
  vehicleDialogVisible.value = true
}

function editVehicle(vehicle: VehicleDto) {
  editingVehicle.value = vehicle
  Object.assign(vehicleForm, {
    id: vehicle.id,
    plateNumber: vehicle.plateNumber,
    status: vehicle.status,
    vehicleType: vehicle.vehicleType,
    equipmentLevel: vehicle.equipmentLevel,
    driverName: vehicle.driverName || '',
    driverPhone: vehicle.driverPhone || '',
    mileageKm: vehicle.mileageKm || 0,
    equipmentStatus: vehicle.equipmentStatus || '{}'
  })
  vehicleDialogVisible.value = true
}

async function saveVehicle() {
  try {
    if (editingVehicle.value && vehicleForm.id) {
      await updateAmbulance(vehicleForm.id, {
        status: vehicleForm.status,
        driverName: vehicleForm.driverName,
        driverPhone: vehicleForm.driverPhone,
        mileageKm: vehicleForm.mileageKm
      })
      ElMessage.success('更新成功')
    } else {
      await createAmbulance({
        plateNumber: vehicleForm.plateNumber,
        vehicleType: vehicleForm.vehicleType,
        equipmentLevel: vehicleForm.equipmentLevel,
        status: vehicleForm.status,
        driverName: vehicleForm.driverName,
        driverPhone: vehicleForm.driverPhone,
        mileageKm: vehicleForm.mileageKm,
        equipmentStatus: vehicleForm.equipmentStatus
      })
      ElMessage.success('创建成功')
    }
    vehicleDialogVisible.value = false
    loadVehicles()
  } catch (error) {
    console.error('Save vehicle failed:', error)
  }
}

function viewMaintenance(vehicle: VehicleDto) {
  getMaintenanceHistory(vehicle.id).then(records => {
    maintenanceRecords.value = records
    activeTab.value = 'maintenance'
  })
}

function viewSupplies(vehicle: VehicleDto) {
  getSupplies(vehicle.id, undefined, undefined).then(result => {
    supplies.value = result
    activeTab.value = 'supplies'
  })
}

function openSupplyDialog() {
  ElMessage.info('新增耗材功能开发中')
}

function editSupply(supply: SupplyDto) {
  ElMessage.info('编辑耗材功能开发中')
}

function stockOut(supply: SupplyDto) {
  ElMessage.info('耗材出库功能开发中')
}

onMounted(() => {
  loadVehicles()
  loadSupplies()
})
</script>

<style scoped lang="scss">
.vehicle-management {
  padding: 20px;
  height: 100%;
  overflow-y: auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;

  h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: #111827;
  }
}

.vehicle-tabs {
  :deep(.el-tabs__header) {
    margin-bottom: 20px;
  }
}

.stats-card {
  margin-bottom: 20px;

  .stat-item {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 0;

    .stat-icon {
      width: 48px;
      height: 48px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      color: #fff;

      &.available { background: #10b981; }
      &.on-call { background: #3b82f6; }
      &.maintenance { background: #8b5cf6; }
      &.alert { background: #ef4444; }
    }

    .stat-info {
      .stat-value {
        font-size: 24px;
        font-weight: 700;
        color: #111827;
      }

      .stat-label {
        font-size: 12px;
        color: #6b7280;
      }
    }
  }
}

.table-card {
  .table-header {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
  }

  .pagination {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;
  }
}

.text-muted {
  color: #9ca3af;
}

.text-danger {
  color: #ef4444;
}
</style>
