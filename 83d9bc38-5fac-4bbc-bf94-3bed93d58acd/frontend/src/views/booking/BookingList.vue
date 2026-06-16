<template>
  <div class="p-4 md:p-6">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">预约列表</h1>
      <p class="text-gray-500 mt-1">查看和管理所有设备预约</p>
    </div>

    <el-card class="mb-6">
      <el-form :inline="true" :model="filters" class="flex flex-wrap gap-4">
        <el-form-item label="设备">
          <el-select
            v-model="filters.equipmentId"
            placeholder="全部设备"
            clearable
            style="width: 180px"
            @change="handleSearch"
          >
            <el-option
              v-for="eq in equipmentList"
              :key="eq.id"
              :label="eq.name"
              :value="eq.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="用户">
          <el-select
            v-model="filters.userId"
            placeholder="全部用户"
            clearable
            filterable
            style="width: 180px"
            @change="handleSearch"
          >
            <el-option
              v-for="user in userList"
              :key="user.id"
              :label="user.name"
              :value="user.id"
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
            <el-option label="已确认" value="confirmed" />
            <el-option label="已取消" value="cancelled" />
            <el-option label="已完成" value="completed" />
            <el-option label="等待队列" value="waitlist" />
          </el-select>
        </el-form-item>
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 280px"
            @change="handleDateChange"
          />
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

    <el-card>
      <template #header>
        <div class="flex items-center justify-between">
          <span>预约记录</span>
          <el-button type="primary" @click="goToCalendar">
            <el-icon><Calendar /></el-icon>
            日历视图
          </el-button>
        </div>
      </template>

      <el-table
        v-loading="loading"
        :data="bookingList"
        stripe
        style="width: 100%"
        @row-click="handleRowClick"
      >
        <el-table-column prop="id" label="预约ID" width="100" />
        <el-table-column prop="equipmentName" label="设备名称" min-width="150">
          <template #default="{ row }">
            {{ row.equipment?.name || row.equipmentName }}
          </template>
        </el-table-column>
        <el-table-column prop="userName" label="预约人" width="120">
          <template #default="{ row }">
            {{ row.user?.name || row.userName }}
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
              v-if="row.status === 'confirmed'"
              type="danger"
              link
              @click.stop="cancelBooking(row)"
            >
              取消预约
            </el-button>
            <el-button
              v-if="row.status === 'cancelled' || row.status === 'completed'"
              type="warning"
              link
              @click.stop="addToWaitlist(row)"
            >
              加入等待队列
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
    </el-card>

    <el-dialog
      v-model="detailDialogVisible"
      title="预约详情"
      width="500px"
    >
      <el-descriptions v-if="selectedBooking" :column="1" border>
        <el-descriptions-item label="预约ID">
          {{ selectedBooking.id }}
        </el-descriptions-item>
        <el-descriptions-item label="设备名称">
          {{ selectedBooking.equipment?.name || selectedBooking.equipmentName }}
        </el-descriptions-item>
        <el-descriptions-item label="预约人">
          {{ selectedBooking.user?.name || selectedBooking.userName }}
        </el-descriptions-item>
        <el-descriptions-item label="开始时间">
          {{ formatDateTime(selectedBooking.startTime) }}
        </el-descriptions-item>
        <el-descriptions-item label="结束时间">
          {{ formatDateTime(selectedBooking.endTime) }}
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusType(selectedBooking.status)" effect="light">
            {{ getStatusText(selectedBooking.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item v-if="selectedBooking.isSeries" label="系列预约">
          是 (系列ID: {{ selectedBooking.seriesId }})
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">
          {{ formatDateTime(selectedBooking.createdAt) }}
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
        <el-button
          v-if="selectedBooking?.status === 'confirmed'"
          type="danger"
          @click="cancelBooking(selectedBooking)"
        >
          取消预约
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Calendar } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { booking as bookingApi, equipment as equipmentApi, user as userApi } from '@/api'
import type { Booking, BookingStatus, Equipment, User } from '@/types'

const router = useRouter()

const loading = ref(false)
const bookingList = ref<Booking[]>([])
const equipmentList = ref<Equipment[]>([])
const userList = ref<User[]>([])
const dateRange = ref<string[]>([])

const filters = ref({
  equipmentId: undefined as number | undefined,
  userId: undefined as number | undefined,
  status: undefined as BookingStatus | undefined,
  startDate: undefined as string | undefined,
  endDate: undefined as string | undefined
})

const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
})

const detailDialogVisible = ref(false)
const selectedBooking = ref<Booking | null>(null)

const getStatusType = (status: BookingStatus) => {
  const typeMap: Record<BookingStatus, 'success' | 'info' | 'danger' | 'warning'> = {
    confirmed: 'success',
    cancelled: 'info',
    completed: 'primary',
    waitlist: 'warning'
  }
  return typeMap[status] || 'info'
}

const getStatusText = (status: BookingStatus) => {
  const textMap: Record<BookingStatus, string> = {
    confirmed: '已确认',
    cancelled: '已取消',
    completed: '已完成',
    waitlist: '等待队列'
  }
  return textMap[status] || status
}

const formatDateTime = (time: string) => {
  return dayjs(time).format('YYYY-MM-DD HH:mm')
}

const loadBookings = async () => {
  loading.value = true
  try {
    const response = await bookingApi.getList({
      ...filters.value,
      page: pagination.value.page,
      pageSize: pagination.value.pageSize
    })
    bookingList.value = response.items
    pagination.value.total = response.total
  } finally {
    loading.value = false
  }
}

const loadEquipment = async () => {
  const response = await equipmentApi.getList({ pageSize: 100 })
  equipmentList.value = response.items
}

const loadUsers = async () => {
  const response = await userApi.getList({ pageSize: 100 })
  userList.value = response.items
}

const handleSearch = () => {
  pagination.value.page = 1
  loadBookings()
}

const handleReset = () => {
  filters.value = {
    equipmentId: undefined,
    userId: undefined,
    status: undefined,
    startDate: undefined,
    endDate: undefined
  }
  dateRange.value = []
  pagination.value.page = 1
  loadBookings()
}

const handleDateChange = (val: string[]) => {
  if (val && val.length === 2) {
    filters.value.startDate = val[0]
    filters.value.endDate = val[1]
  } else {
    filters.value.startDate = undefined
    filters.value.endDate = undefined
  }
}

const handleSizeChange = (size: number) => {
  pagination.value.pageSize = size
  pagination.value.page = 1
  loadBookings()
}

const handleCurrentChange = (page: number) => {
  pagination.value.page = page
  loadBookings()
}

const handleRowClick = (row: Booking) => {
  viewDetail(row)
}

const viewDetail = (row: Booking) => {
  selectedBooking.value = row
  detailDialogVisible.value = true
}

const cancelBooking = async (row: Booking) => {
  try {
    await ElMessageBox.confirm(
      `确定要取消预约 #${row.id} 吗？`,
      '取消预约',
      { type: 'warning' }
    )
    await bookingApi.cancel(row.id)
    ElMessage.success('预约已取消')
    detailDialogVisible.value = false
    loadBookings()
  } catch {
  }
}

const addToWaitlist = async (row: Booking) => {
  try {
    await ElMessageBox.confirm(
      `确定要将预约 #${row.id} 加入等待队列吗？`,
      '加入等待队列',
      { type: 'info' }
    )
    await bookingApi.addWaitlist({
      equipmentId: row.equipmentId,
      startTime: row.startTime,
      endTime: row.endTime
    })
    ElMessage.success('已加入等待队列')
    loadBookings()
  } catch {
  }
}

const goToCalendar = () => {
  router.push('/booking/calendar')
}

onMounted(() => {
  loadBookings()
  loadEquipment()
  loadUsers()
})
</script>
