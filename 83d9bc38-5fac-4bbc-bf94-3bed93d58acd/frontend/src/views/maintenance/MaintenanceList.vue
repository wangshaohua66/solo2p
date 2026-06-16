<template>
  <div class="p-4 md:p-6">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">维护计划</h1>
      <p class="text-gray-500 mt-1">管理设备维护计划和记录</p>
    </div>

    <el-card class="mb-6">
      <div class="flex items-center justify-between mb-4">
        <el-radio-group v-model="viewMode" size="large">
          <el-radio-button value="calendar">
            <el-icon><Calendar /></el-icon>
            日历视图
          </el-radio-button>
          <el-radio-button value="table">
            <el-icon><List /></el-icon>
            表格视图
          </el-radio-button>
        </el-radio-group>
        <el-button type="primary" @click="openCreateDialog">
          <el-icon><Plus /></el-icon>
          创建维护计划
        </el-button>
      </div>

      <div v-if="viewMode === 'calendar'" class="calendar-view">
        <div class="flex items-center justify-between mb-4">
          <el-button-group>
            <el-button @click="prevMonth">
              <el-icon><ArrowLeft /></el-icon>
            </el-button>
            <el-button @click="goToToday">今天</el-button>
            <el-button @click="nextMonth">
              <el-icon><ArrowRight /></el-icon>
            </el-button>
          </el-button-group>
          <h2 class="text-xl font-semibold text-gray-800">
            {{ currentMonthText }}
          </h2>
          <div class="w-24"></div>
        </div>

        <div class="calendar-grid">
          <div
            v-for="day in weekDays"
            :key="day"
            class="calendar-header-cell"
          >
            {{ day }}
          </div>
          <div
            v-for="(day, index) in calendarDays"
            :key="index"
            :class="[
              'calendar-day-cell',
              { 'is-other-month': !day.isCurrentMonth },
              { 'is-today': day.isToday }
            ]"
          >
            <div class="day-number">{{ day.date }}</div>
            <div class="day-events">
              <div
                v-for="event in day.events"
                :key="event.id"
                :class="[
                  'event-item',
                  `event-${event.status}`
                ]"
                @click="viewDetail(event)"
              >
                <div class="event-time">
                  {{ formatTime(event.startTime) }} - {{ formatTime(event.endTime) }}
                </div>
                <div class="event-title truncate">{{ event.equipmentName }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="table-view">
        <el-table
          v-loading="loading"
          :data="maintenanceList"
          stripe
          style="width: 100%"
          @row-click="handleRowClick"
        >
          <el-table-column prop="id" label="计划ID" width="100" />
          <el-table-column prop="equipmentName" label="设备名称" min-width="150">
            <template #default="{ row }">
              {{ row.equipment?.name || row.equipmentName }}
            </template>
          </el-table-column>
          <el-table-column prop="type" label="类型" width="120">
            <template #default="{ row }">
              {{ getTypeText(row.type) }}
            </template>
          </el-table-column>
          <el-table-column prop="startTime" label="开始时间" width="180">
            <template #default="{ row }">
              {{ formatDateTime(row.startTime) }}
            </template>
          </el-table-column>
          <el-table-column prop="endTime" label="结束时间" width="180">
            <template #default="{ row }">
              {{ formatDateTime(row.endTime) }}
            </template>
          </el-table-column>
          <el-table-column prop="operatorName" label="负责人" width="120">
            <template #default="{ row }">
              {{ row.operator?.name || row.operatorName || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="120">
            <template #default="{ row }">
              <el-tag :type="getStatusType(row.status)" effect="light">
                {{ getStatusText(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="240" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" link @click.stop="viewDetail(row)">
                查看详情
              </el-button>
              <el-button
                v-if="row.status === 'scheduled' || row.status === 'in_progress'"
                type="success"
                link
                @click.stop="completeMaintenance(row)"
              >
                完成维护
              </el-button>
              <el-button
                v-if="row.status === 'scheduled'"
                type="danger"
                link
                @click.stop="cancelMaintenance(row)"
              >
                取消维护
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="mt-4 flex justify-end">
          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :page-sizes="[10, 20, 50, 100]"
            :total="pagination.total"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
          />
        </div>
      </div>
    </el-card>

    <el-dialog
      v-model="detailDialogVisible"
      title="维护计划详情"
      width="500px"
    >
      <el-descriptions v-if="selectedMaintenance" :column="1" border>
        <el-descriptions-item label="计划ID">
          {{ selectedMaintenance.id }}
        </el-descriptions-item>
        <el-descriptions-item label="设备名称">
          {{ selectedMaintenance.equipment?.name || selectedMaintenance.equipmentName }}
        </el-descriptions-item>
        <el-descriptions-item label="维护类型">
          {{ getTypeText(selectedMaintenance.type) }}
        </el-descriptions-item>
        <el-descriptions-item label="开始时间">
          {{ formatDateTime(selectedMaintenance.startTime) }}
        </el-descriptions-item>
        <el-descriptions-item label="结束时间">
          {{ formatDateTime(selectedMaintenance.endTime) }}
        </el-descriptions-item>
        <el-descriptions-item label="负责人">
          {{ selectedMaintenance.operator?.name || selectedMaintenance.operatorName || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusType(selectedMaintenance.status)" effect="light">
            {{ getStatusText(selectedMaintenance.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="备注">
          {{ selectedMaintenance.remark || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">
          {{ formatDateTime(selectedMaintenance.createdAt) }}
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
        <el-button
          v-if="selectedMaintenance?.status === 'scheduled' || selectedMaintenance?.status === 'in_progress'"
          type="success"
          @click="completeMaintenance(selectedMaintenance!)"
        >
          完成维护
        </el-button>
        <el-button
          v-if="selectedMaintenance?.status === 'scheduled'"
          type="danger"
          @click="cancelMaintenance(selectedMaintenance!)"
        >
          取消维护
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="createDialogVisible"
      title="创建维护计划"
      width="500px"
    >
      <el-form
        ref="createFormRef"
        :model="createForm"
        :rules="createRules"
        label-width="100px"
      >
        <el-form-item label="设备" prop="equipmentId">
          <el-select
            v-model="createForm.equipmentId"
            placeholder="请选择设备"
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="eq in equipmentList"
              :key="eq.id"
              :label="eq.name"
              :value="eq.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="维护类型" prop="type">
          <el-select
            v-model="createForm.type"
            placeholder="请选择维护类型"
            style="width: 100%"
          >
            <el-option label="日常维护" value="routine" />
            <el-option label="维修" value="repair" />
            <el-option label="校准" value="calibration" />
          </el-select>
        </el-form-item>
        <el-form-item label="开始时间" prop="startTime">
          <el-date-picker
            v-model="createForm.startTime"
            type="datetime"
            placeholder="选择开始时间"
            value-format="YYYY-MM-DDTHH:mm:ss"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="结束时间" prop="endTime">
          <el-date-picker
            v-model="createForm.endTime"
            type="datetime"
            placeholder="选择结束时间"
            value-format="YYYY-MM-DDTHH:mm:ss"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="负责人">
          <el-select
            v-model="createForm.operatorId"
            placeholder="请选择负责人（可选）"
            clearable
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="user in operatorList"
              :key="user.id"
              :label="user.name"
              :value="user.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="createForm.remark"
            type="textarea"
            :rows="3"
            placeholder="请输入备注（可选）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreate">确认创建</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="completeDialogVisible"
      title="完成维护"
      width="400px"
    >
      <el-form label-width="80px">
        <el-form-item label="完成备注">
          <el-input
            v-model="completeRemark"
            type="textarea"
            :rows="3"
            placeholder="请输入维护完成备注（可选）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="completeDialogVisible = false">取消</el-button>
        <el-button type="success" @click="confirmComplete">确认完成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Calendar, List, Plus, ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { maintenance as maintenanceApi, equipment as equipmentApi, user as userApi } from '@/api'
import type { Maintenance, MaintenanceStatus, MaintenanceType, Equipment, User } from '@/types'

const loading = ref(false)
const maintenanceList = ref<Maintenance[]>([])
const equipmentList = ref<Equipment[]>([])
const operatorList = ref<User[]>([])
const viewMode = ref<'calendar' | 'table'>('calendar')
const currentMonth = ref(dayjs())

const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
})

const detailDialogVisible = ref(false)
const selectedMaintenance = ref<Maintenance | null>(null)

const createDialogVisible = ref(false)
const createFormRef = ref<FormInstance>()
const createForm = ref({
  equipmentId: undefined as number | undefined,
  type: undefined as MaintenanceType | undefined,
  startTime: '',
  endTime: '',
  operatorId: undefined as number | undefined,
  remark: ''
})

const createRules: FormRules = {
  equipmentId: [{ required: true, message: '请选择设备', trigger: 'change' }],
  type: [{ required: true, message: '请选择维护类型', trigger: 'change' }],
  startTime: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
  endTime: [{ required: true, message: '请选择结束时间', trigger: 'change' }]
}

const completeDialogVisible = ref(false)
const completeRemark = ref('')
const completingMaintenanceId = ref<number | null>(null)

const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const currentMonthText = computed(() => {
  return currentMonth.value.format('YYYY年MM月')
})

const calendarDays = computed(() => {
  const startOfMonth = currentMonth.value.startOf('month')
  const endOfMonth = currentMonth.value.endOf('month')
  const startDay = startOfMonth.day()
  const daysInMonth = endOfMonth.date()
  
  const days: Array<{
    date: number
    isCurrentMonth: boolean
    isToday: boolean
    events: Maintenance[]
  }> = []

  const prevMonth = currentMonth.value.subtract(1, 'month')
  const prevMonthDays = prevMonth.daysInMonth()
  for (let i = startDay - 1; i >= 0; i--) {
    const date = prevMonthDays - i
    days.push({
      date,
      isCurrentMonth: false,
      isToday: false,
      events: getEventsForDate(prevMonth.date(date))
    })
  }

  const today = dayjs()
  for (let i = 1; i <= daysInMonth; i++) {
    const date = currentMonth.value.date(i)
    days.push({
      date: i,
      isCurrentMonth: true,
      isToday: date.isSame(today, 'day'),
      events: getEventsForDate(date)
    })
  }

  const remainingDays = 42 - days.length
  const nextMonth = currentMonth.value.add(1, 'month')
  for (let i = 1; i <= remainingDays; i++) {
    days.push({
      date: i,
      isCurrentMonth: false,
      isToday: false,
      events: getEventsForDate(nextMonth.date(i))
    })
  }

  return days
})

const getEventsForDate = (date: dayjs.Dayjs) => {
  const dateStr = date.format('YYYY-MM-DD')
  return maintenanceList.value.filter(m => {
    const startDate = dayjs(m.startTime).format('YYYY-MM-DD')
    const endDate = dayjs(m.endTime).format('YYYY-MM-DD')
    return dateStr >= startDate && dateStr <= endDate && m.status !== 'cancelled'
  })
}

const getStatusType = (status: MaintenanceStatus | string) => {
  const typeMap: Record<string, 'primary' | 'warning' | 'success' | 'info'> = {
    scheduled: 'primary',
    in_progress: 'warning',
    completed: 'success',
    cancelled: 'info'
  }
  return typeMap[status] || 'info'
}

const getStatusText = (status: MaintenanceStatus | string) => {
  const textMap: Record<string, string> = {
    scheduled: '已计划',
    in_progress: '进行中',
    completed: '已完成',
    cancelled: '已取消'
  }
  return textMap[status] || status
}

const getTypeText = (type: MaintenanceType) => {
  const textMap: Record<MaintenanceType, string> = {
    routine: '日常维护',
    repair: '维修',
    calibration: '校准'
  }
  return textMap[type] || type
}

const formatDateTime = (time: string) => {
  return dayjs(time).format('YYYY-MM-DD HH:mm')
}

const formatTime = (time: string) => {
  return dayjs(time).format('HH:mm')
}

const loadMaintenance = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.value.page,
      pageSize: viewMode.value === 'calendar' ? 1000 : pagination.value.pageSize
    }
    const response = await maintenanceApi.getList(params)
    maintenanceList.value = response.items
    pagination.value.total = response.total
  } finally {
    loading.value = false
  }
}

const loadEquipment = async () => {
  const response = await equipmentApi.getList({ pageSize: 100 })
  equipmentList.value = response.items
}

const loadOperators = async () => {
  const response = await userApi.getList({ pageSize: 100 })
  operatorList.value = response.items
}

const prevMonth = () => {
  currentMonth.value = currentMonth.value.subtract(1, 'month')
}

const nextMonth = () => {
  currentMonth.value = currentMonth.value.add(1, 'month')
}

const goToToday = () => {
  currentMonth.value = dayjs()
}

const handleRowClick = (row: Maintenance) => {
  viewDetail(row)
}

const viewDetail = (row: Maintenance) => {
  selectedMaintenance.value = row
  detailDialogVisible.value = true
}

const openCreateDialog = () => {
  createForm.value = {
    equipmentId: undefined,
    type: undefined,
    startTime: '',
    endTime: '',
    operatorId: undefined,
    remark: ''
  }
  createDialogVisible.value = true
}

const handleCreate = async () => {
  if (!createFormRef.value) return
  
  await createFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        if (createForm.value.startTime >= createForm.value.endTime) {
          ElMessage.warning('结束时间必须晚于开始时间')
          return
        }
        
        await maintenanceApi.create({
          equipmentId: createForm.value.equipmentId!,
          startTime: createForm.value.startTime,
          endTime: createForm.value.endTime,
          type: createForm.value.type!,
          operatorId: createForm.value.operatorId,
          remark: createForm.value.remark
        })
        ElMessage.success('创建成功')
        createDialogVisible.value = false
        loadMaintenance()
      } catch {
        ElMessage.error('创建失败，请重试')
      }
    }
  })
}

const completeMaintenance = (row: Maintenance) => {
  completingMaintenanceId.value = row.id
  completeRemark.value = ''
  completeDialogVisible.value = true
}

const confirmComplete = async () => {
  if (!completingMaintenanceId.value) return
  
  try {
    await ElMessageBox.confirm(
      '确定要标记该维护计划为已完成吗？',
      '完成维护',
      { type: 'success' }
    )
    await maintenanceApi.complete(completingMaintenanceId.value, completeRemark.value)
    ElMessage.success('维护已完成')
    completeDialogVisible.value = false
    detailDialogVisible.value = false
    loadMaintenance()
  } catch {
  }
}

const cancelMaintenance = async (row: Maintenance) => {
  try {
    await ElMessageBox.confirm(
      `确定要取消维护计划 #${row.id} 吗？`,
      '取消维护',
      { type: 'warning' }
    )
    await maintenanceApi.cancel(row.id)
    ElMessage.success('维护已取消')
    detailDialogVisible.value = false
    loadMaintenance()
  } catch {
  }
}

const handleSizeChange = (size: number) => {
  pagination.value.pageSize = size
  pagination.value.page = 1
  loadMaintenance()
}

const handleCurrentChange = (page: number) => {
  pagination.value.page = page
  loadMaintenance()
}

onMounted(() => {
  loadMaintenance()
  loadEquipment()
  loadOperators()
})
</script>

<style scoped>
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
}

.calendar-header-cell {
  padding: 12px;
  text-align: center;
  font-weight: 600;
  background-color: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
  border-right: 1px solid #e4e7ed;
}

.calendar-header-cell:last-child {
  border-right: none;
}

.calendar-day-cell {
  min-height: 120px;
  padding: 8px;
  border-right: 1px solid #e4e7ed;
  border-bottom: 1px solid #e4e7ed;
  cursor: pointer;
  transition: background-color 0.2s;
}

.calendar-day-cell:hover {
  background-color: #f5f7fa;
}

.calendar-day-cell:nth-child(7n) {
  border-right: none;
}

.calendar-day-cell.is-other-month {
  background-color: #fafafa;
  color: #c0c4cc;
}

.calendar-day-cell.is-today {
  background-color: #ecf5ff;
}

.calendar-day-cell.is-today .day-number {
  background-color: #409eff;
  color: white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.day-number {
  font-weight: 600;
  margin-bottom: 4px;
}

.day-events {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.event-item {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: transform 0.2s;
}

.event-item:hover {
  transform: scale(1.02);
}

.event-scheduled {
  background-color: #ecf5ff;
  color: #409eff;
  border-left: 3px solid #409eff;
}

.event-in_progress {
  background-color: #fdf6ec;
  color: #e6a23c;
  border-left: 3px solid #e6a23c;
}

.event-completed {
  background-color: #f0f9eb;
  color: #67c23a;
  border-left: 3px solid #67c23a;
}

.event-cancelled {
  background-color: #f4f4f5;
  color: #909399;
  border-left: 3px solid #909399;
}

.event-time {
  font-weight: 600;
  margin-bottom: 2px;
}

.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
