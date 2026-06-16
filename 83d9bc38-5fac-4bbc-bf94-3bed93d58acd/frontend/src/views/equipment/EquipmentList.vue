<template>
  <div class="p-4 md:p-6">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">设备列表</h1>
      <p class="text-gray-500 mt-1">查看和管理所有可用设备</p>
    </div>

    <el-card class="mb-6">
      <el-form :inline="true" :model="filters" class="flex flex-wrap gap-4">
        <el-form-item label="搜索">
          <el-input
            v-model="filters.keyword"
            placeholder="设备名称/型号"
            clearable
            @keyup.enter="handleSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item label="中心">
          <el-select
            v-model="filters.centerId"
            placeholder="全部中心"
            clearable
            style="width: 150px"
            @change="handleSearch"
          >
            <el-option
              v-for="center in centerList"
              :key="center.id"
              :label="center.name"
              :value="center.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="类别">
          <el-select
            v-model="filters.category"
            placeholder="全部类别"
            clearable
            style="width: 150px"
            @change="handleSearch"
          >
            <el-option
              v-for="cat in categoryList"
              :key="cat"
              :label="cat"
              :value="cat"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select
            v-model="filters.status"
            placeholder="全部状态"
            clearable
            style="width: 150px"
            @change="handleSearch"
          >
            <el-option label="可用" value="available" />
            <el-option label="维修中" value="maintenance" />
            <el-option label="已报废" value="scrapped" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">
            <el-icon><Search /></el-icon>
            搜索
          </el-button>
          <el-button @click="handleReset">
            <el-icon><Refresh /></el-icon>
            重置
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <div v-if="equipmentStore.loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
      <div
        v-for="i in 8"
        :key="i"
        class="bg-white rounded-lg p-4 shadow-sm animate-pulse"
      >
        <div class="h-6 bg-gray-200 rounded w-3/4 mb-3"></div>
        <div class="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
        <div class="h-5 bg-gray-200 rounded w-20 mb-4"></div>
        <div class="space-y-2">
          <div class="h-4 bg-gray-200 rounded w-full"></div>
          <div class="h-4 bg-gray-200 rounded w-full"></div>
          <div class="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    </div>

    <div v-else-if="equipmentList.length === 0" class="py-16 text-center">
      <el-empty description="暂无设备数据" />
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
      <el-card
        v-for="equipment in equipmentList"
        :key="equipment.id"
        class="equipment-card cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group"
        @click="goToDetail(equipment.id)"
      >
        <template #default>
          <div class="flex items-start justify-between mb-3">
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-gray-900 truncate">{{ equipment.name }}</h3>
              <p class="text-sm text-gray-500 truncate">{{ equipment.model }}</p>
            </div>
            <el-tag
              :type="getStatusType(equipment.status)"
              size="small"
              effect="light"
            >
              {{ getStatusText(equipment.status) }}
            </el-tag>
          </div>

          <el-divider class="my-3" />

          <div class="space-y-2 text-sm">
            <div class="flex items-center gap-2 text-gray-600">
              <el-icon :size="16"><User /></el-icon>
              <span v-if="equipment.currentUser" class="truncate">
                正在使用：{{ equipment.currentUser }}
              </span>
              <span v-else class="text-green-600">当前空闲</span>
            </div>

            <div class="flex items-center gap-2 text-gray-600">
              <el-icon :size="16"><Clock /></el-icon>
              <span v-if="equipment.nextFreeTime" class="truncate">
                下一时段：{{ formatNextFreeTime(equipment.nextFreeTime) }}
              </span>
              <span v-else class="text-green-600">随时可用</span>
            </div>

            <div class="flex items-center gap-2 text-gray-600">
              <el-icon :size="16"><Building2 /></el-icon>
              <span class="truncate">{{ equipment.centerName }}</span>
            </div>

            <div class="flex items-center gap-2 text-gray-600">
              <el-icon :size="16"><CircleDollarSign /></el-icon>
              <span>
                <span class="text-orange-500 font-semibold">¥{{ equipment.hourlyRate }}</span>
                /小时
              </span>
            </div>
          </div>
        </template>

        <template #footer>
          <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <el-button
              type="primary"
              size="small"
              class="flex-1"
              @click.stop="goToDetail(equipment.id)"
            >
              <el-icon><CircleInfo /></el-icon>
              详情
            </el-button>
            <el-button
              type="success"
              size="small"
              class="flex-1"
              :disabled="equipment.status !== 'available'"
              @click.stop="handleBooking(equipment)"
            >
              <el-icon><CalendarPlus /></el-icon>
              预约
            </el-button>
          </div>
        </template>
      </el-card>
    </div>

    <div class="mt-8 flex justify-center">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="equipmentStore.pagination.total"
        :page-sizes="[8, 16, 24, 32]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handlePageChange"
        @current-change="handlePageChange"
      />
    </div>

    <el-dialog
      v-model="bookingDialogVisible"
      title="预约设备"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form v-if="selectedEquipment" :model="bookingForm" label-width="80px">
        <el-form-item label="设备">
          <span>{{ selectedEquipment.name }} ({{ selectedEquipment.model }})</span>
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker
            v-model="bookingForm.date"
            type="date"
            placeholder="选择预约日期"
            :disabled-date="disabledDate"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="开始时间">
          <el-time-picker
            v-model="bookingForm.startTime"
            placeholder="选择开始时间"
            format="HH:mm"
            value-format="HH:mm"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-time-picker
            v-model="bookingForm.endTime"
            placeholder="选择结束时间"
            format="HH:mm"
            value-format="HH:mm"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bookingDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="bookingStore.loading" @click="submitBooking">
          确认预约
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import {
  Search,
  Refresh,
  User,
  Clock,
  Building2,
  CircleDollarSign,
  CircleInfo,
  CalendarPlus
} from '@element-plus/icons-vue'
import { useEquipmentStore, type Equipment, type EquipmentFilters } from '@/stores/equipment'
import { useBookingStore } from '@/stores/booking'
import type { Center } from '@/stores/user'
import type { EquipmentStatus } from '@/types'

const router = useRouter()
const equipmentStore = useEquipmentStore()
const bookingStore = useBookingStore()

const filters = ref<EquipmentFilters>({
  keyword: '',
  centerId: undefined,
  category: '',
  status: ''
})

const currentPage = ref(1)
const pageSize = ref(8)

const centerList = ref<Center[]>([])
const categoryList = ref<string[]>([])

const bookingDialogVisible = ref(false)
const selectedEquipment = ref<Equipment | null>(null)
const bookingForm = ref({
  date: '',
  startTime: '',
  endTime: ''
})

const equipmentList = computed(() => equipmentStore.equipmentList)

const getStatusType = (status: EquipmentStatus) => {
  const typeMap: Record<EquipmentStatus, 'success' | 'warning' | 'danger'> = {
    available: 'success',
    maintenance: 'warning',
    scrapped: 'danger'
  }
  return typeMap[status] || 'info'
}

const getStatusText = (status: EquipmentStatus) => {
  const textMap: Record<EquipmentStatus, string> = {
    available: '可用',
    maintenance: '维修中',
    scrapped: '已报废'
  }
  return textMap[status] || status
}

const formatNextFreeTime = (time: string) => {
  if (!time) return ''
  const now = dayjs()
  const nextFree = dayjs(time)
  if (nextFree.isSame(now, 'day')) {
    return `今天 ${nextFree.format('HH:mm')}`
  } else if (nextFree.isSame(now.add(1, 'day'), 'day')) {
    return `明天 ${nextFree.format('HH:mm')}`
  }
  return nextFree.format('MM-DD HH:mm')
}

const disabledDate = (time: Date) => {
  return dayjs(time).isBefore(dayjs().startOf('day'))
}

const loadEquipment = async () => {
  await equipmentStore.fetchList({
    page: currentPage.value,
    pageSize: pageSize.value,
    ...filters.value
  })
}

const loadFilters = async () => {
  try {
    const { data: centers } = await import('axios').then(({ default: axios }) =>
      axios.get<Center[]>('/api/centers')
    )
    centerList.value = centers
  } catch {
    centerList.value = [
      { id: 1, name: '创客中心', address: '', description: '', createdAt: '', updatedAt: '' },
      { id: 2, name: '工程训练中心', address: '', description: '', createdAt: '', updatedAt: '' },
      { id: 3, name: '智能制造中心', address: '', description: '', createdAt: '', updatedAt: '' }
    ]
  }
  categoryList.value = ['3D打印机', '数控机床', '激光切割机', '机器人', '电子设备', '其他']
}

const handleSearch = () => {
  currentPage.value = 1
  loadEquipment()
}

const handleReset = () => {
  filters.value = {
    keyword: '',
    centerId: undefined,
    category: '',
    status: ''
  }
  currentPage.value = 1
  loadEquipment()
}

const handlePageChange = () => {
  loadEquipment()
}

const goToDetail = (id: number) => {
  router.push(`/equipment/${id}`)
}

const handleBooking = (equipment: Equipment) => {
  if (equipment.status !== 'available') {
    ElMessage.warning('该设备当前不可预约')
    return
  }
  selectedEquipment.value = equipment
  bookingForm.value = {
    date: dayjs().format('YYYY-MM-DD'),
    startTime: '09:00',
    endTime: '11:00'
  }
  bookingDialogVisible.value = true
}

const submitBooking = async () => {
  if (!selectedEquipment.value) return
  if (!bookingForm.value.date || !bookingForm.value.startTime || !bookingForm.value.endTime) {
    ElMessage.warning('请完善预约信息')
    return
  }
  if (bookingForm.value.startTime >= bookingForm.value.endTime) {
    ElMessage.warning('结束时间必须晚于开始时间')
    return
  }

  const startTime = `${bookingForm.value.date}T${bookingForm.value.startTime}:00`
  const endTime = `${bookingForm.value.date}T${bookingForm.value.endTime}:00`

  try {
    const conflict = await bookingStore.checkConflict(selectedEquipment.value.id, startTime, endTime)
    if (conflict.hasConflict) {
      await ElMessageBox.confirm(
        '该时段存在冲突预约，是否加入等待队列？',
        '时段冲突',
        { type: 'warning', confirmButtonText: '加入等待', cancelButtonText: '取消' }
      )
      await bookingStore.addWaitlist({
        equipmentId: selectedEquipment.value.id,
        startTime,
        endTime
      })
      ElMessage.success('已加入等待队列')
    } else {
      await bookingStore.createBooking({
        equipmentId: selectedEquipment.value.id,
        startTime,
        endTime
      })
      ElMessage.success('预约成功')
    }
    bookingDialogVisible.value = false
    loadEquipment()
  } catch {
    if (bookingStore.loading) {
      ElMessage.error('操作失败，请重试')
    }
  }
}

onMounted(() => {
  loadFilters()
  loadEquipment()
})
</script>

<style scoped>
.equipment-card {
  height: 100%;
}

.equipment-card :deep(.el-card__body) {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.equipment-card :deep(.el-card__footer) {
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>
