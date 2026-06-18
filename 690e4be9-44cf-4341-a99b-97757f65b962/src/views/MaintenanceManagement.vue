<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

interface VehicleItem {
  id: string
  plate: string
  model: string
  mileage: number
  mileageLimit: number
  status: 'normal' | 'warning' | 'critical'
  lastMaintenance: string
  nextMaintenance: string
}

interface FaultReport {
  vehiclePlate: string
  faultType: string
  description: string
  urgency: 'low' | 'medium' | 'high'
}

const vehicles = ref<VehicleItem[]>([
  { id: 'v1', plate: '京A·12345', model: '宇通E12', mileage: 82000, mileageLimit: 100000, status: 'normal', lastMaintenance: '2026-05-20', nextMaintenance: '2026-07-20' },
  { id: 'v2', plate: '京A·12346', model: '比亚迪K9', mileage: 95000, mileageLimit: 100000, status: 'warning', lastMaintenance: '2026-04-15', nextMaintenance: '2026-06-30' },
  { id: 'v3', plate: '京A·12347', model: '金龙XMQ', mileage: 98000, mileageLimit: 100000, status: 'critical', lastMaintenance: '2026-03-10', nextMaintenance: '2026-06-20' },
  { id: 'v4', plate: '京B·56001', model: '宇通E12', mileage: 45000, mileageLimit: 100000, status: 'normal', lastMaintenance: '2026-06-01', nextMaintenance: '2026-08-01' },
  { id: 'v5', plate: '京B·56002', model: '比亚迪K9', mileage: 72000, mileageLimit: 100000, status: 'normal', lastMaintenance: '2026-05-10', nextMaintenance: '2026-07-10' },
  { id: 'v6', plate: '京C·12001', model: '金龙XMQ', mileage: 61000, mileageLimit: 100000, status: 'normal', lastMaintenance: '2026-05-25', nextMaintenance: '2026-07-25' },
  { id: 'v7', plate: '京C·12002', model: '宇通E12', mileage: 89000, mileageLimit: 100000, status: 'warning', lastMaintenance: '2026-04-20', nextMaintenance: '2026-06-25' },
])

const faultForm = ref<FaultReport>({
  vehiclePlate: '',
  faultType: '',
  description: '',
  urgency: 'medium',
})

const submitting = ref(false)

const emergencyPlans = [
  { vehiclePlate: '京C·12002', fault: '发动机故障', replacement: '京C·12999（备用）', route: '12路', eta: '约15分钟到达' },
  { vehiclePlate: '京A·12346', fault: '里程接近上限', replacement: '京A·12998（备用）', route: '1路', eta: '计划明天替换' },
]

function mileagePercent(v: VehicleItem): number {
  return Math.round((v.mileage / v.mileageLimit) * 100)
}

function mileageColor(v: VehicleItem): string {
  const pct = mileagePercent(v)
  if (pct >= 95) return '#EF4444'
  if (pct >= 85) return '#F59E0B'
  return '#22C55E'
}

function statusLabel(status: VehicleItem['status']): string {
  return status === 'normal' ? '正常' : status === 'warning' ? '预警' : '紧急'
}

function statusType(status: VehicleItem['status']): 'success' | 'warning' | 'danger' {
  return status === 'normal' ? 'success' : status === 'warning' ? 'warning' : 'danger'
}

function submitFault() {
  if (!faultForm.value.vehiclePlate || !faultForm.value.faultType || !faultForm.value.description) {
    ElMessage.warning('请填写完整故障信息')
    return
  }
  submitting.value = true
  setTimeout(() => {
    ElMessage.success('故障上报成功')
    faultForm.value = { vehiclePlate: '', faultType: '', description: '', urgency: 'medium' }
    submitting.value = false
  }, 500)
}
</script>

<template>
  <div class="flex flex-col h-full gap-4">
    <div class="flex-1 grid grid-cols-3 gap-4 overflow-auto">
      <el-card shadow="never" class="col-span-2">
        <template #header>
          <span class="text-sm font-semibold">车辆列表</span>
        </template>
        <el-table :data="vehicles" stripe size="small" :row-class-name="({ row }: any) => row.status === 'critical' ? 'bg-red-50' : ''">
          <el-table-column prop="plate" label="车牌号" width="120">
            <template #default="{ row }">
              <span class="font-medium">{{ row.plate }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="model" label="车型" width="100" />
          <el-table-column label="里程进度" min-width="200">
            <template #default="{ row }">
              <div class="flex items-center gap-2">
                <el-progress
                  :percentage="mileagePercent(row)"
                  :color="mileageColor(row)"
                  :stroke-width="14"
                  :text-inside="true"
                  style="flex: 1"
                />
                <span class="text-xs text-gray-400 font-num w-24 text-right">{{ row.mileage.toLocaleString() }} / {{ row.mileageLimit.toLocaleString() }}km</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="80" align="center">
            <template #default="{ row }">
              <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="下次维保" width="110">
            <template #default="{ row }">
              <span class="text-xs font-num">{{ row.nextMaintenance }}</span>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <div class="space-y-4">
        <el-card shadow="never">
          <template #header>
            <span class="text-sm font-semibold">故障上报</span>
          </template>
          <el-form :model="faultForm" label-position="top" size="small">
            <el-form-item label="车辆">
              <el-select v-model="faultForm.vehiclePlate" placeholder="选择车辆" class="w-full">
                <el-option v-for="v in vehicles" :key="v.id" :label="v.plate" :value="v.plate" />
              </el-select>
            </el-form-item>
            <el-form-item label="故障类型">
              <el-select v-model="faultForm.faultType" placeholder="选择类型" class="w-full">
                <el-option label="发动机故障" value="engine" />
                <el-option label="制动系统" value="brake" />
                <el-option label="电气系统" value="electrical" />
                <el-option label="空调系统" value="ac" />
                <el-option label="轮胎问题" value="tire" />
                <el-option label="其他" value="other" />
              </el-select>
            </el-form-item>
            <el-form-item label="紧急程度">
              <el-radio-group v-model="faultForm.urgency">
                <el-radio value="low">低</el-radio>
                <el-radio value="medium">中</el-radio>
                <el-radio value="high">高</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="故障描述">
              <el-input v-model="faultForm.description" type="textarea" :rows="3" placeholder="描述故障详情" />
            </el-form-item>
            <el-button type="primary" class="w-full" :loading="submitting" @click="submitFault">提交上报</el-button>
          </el-form>
        </el-card>

        <el-card shadow="never">
          <template #header>
            <span class="text-sm font-semibold">紧急替代方案</span>
          </template>
          <div class="space-y-3">
            <div
              v-for="plan in emergencyPlans"
              :key="plan.vehiclePlate"
              class="p-3 rounded-lg border"
              style="background: #FEF3C7; border-color: #F59E0B"
            >
              <div class="flex items-center justify-between mb-1">
                <span class="text-sm font-medium">{{ plan.vehiclePlate }}</span>
                <el-tag size="small" type="warning">{{ plan.route }}</el-tag>
              </div>
              <div class="text-xs text-gray-600 mb-1">{{ plan.fault }}</div>
              <div class="flex items-center justify-between text-xs">
                <span style="color: var(--color-info)">替代: {{ plan.replacement }}</span>
                <span class="text-gray-400">{{ plan.eta }}</span>
              </div>
            </div>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>
