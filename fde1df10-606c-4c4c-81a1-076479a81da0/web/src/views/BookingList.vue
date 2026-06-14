<template>
  <div class="booking-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>档期管理</span>
          <el-button type="primary" @click="handleCreate">
            <el-icon><Plus /></el-icon>
            新建档期
          </el-button>
        </div>
      </template>

      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="场馆">
          <el-select v-model="filters.venue_id" placeholder="请选择场馆" clearable>
            <el-option
              v-for="venue in venueOptions"
              :key="venue.ID"
              :label="venue.Name"
              :value="venue.ID"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="请选择状态" clearable>
            <el-option label="待审批" value="pending" />
            <el-option label="已确认" value="confirmed" />
            <el-option label="冲突" value="conflict" />
            <el-option label="维护" value="maintenance" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
        </el-form-item>
        <el-form-item label="日期范围">
          <el-date-picker
            v-model="filters.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table
        v-loading="loading"
        :data="pagedList"
        stripe
        border
        style="width: 100%"
      >
        <el-table-column prop="ID" label="ID" width="80" />
        <el-table-column prop="Title" label="演出标题" min-width="160" show-overflow-tooltip />
        <el-table-column label="场馆" width="140">
          <template #default="{ row }">
            {{ row.Venue?.Name || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="开始时间" width="170">
          <template #default="{ row }">
            {{ formatDateTime(row.StartTime) }}
          </template>
        </el-table-column>
        <el-table-column label="结束时间" width="170">
          <template #default="{ row }">
            {{ formatDateTime(row.EndTime) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.Status)">
              {{ statusText(row.Status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            {{ typeText(row.Type) }}
          </template>
        </el-table-column>
        <el-table-column label="操作人" width="120">
          <template #default="{ row }">
            {{ row.User?.RealName || row.User?.Username || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">
            {{ formatDateTime(row.CreatedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleView(row)">查看</el-button>
            <el-button
              v-if="isVenueManager && row.Status === 'pending'"
              link
              type="success"
              @click="handleApprove(row)"
            >审批</el-button>
            <el-button link type="primary" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="filteredList.length"
        layout="total, sizes, prev, pager, next, jumper"
        class="pagination"
      />
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="600px"
      @close="resetForm"
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="演出标题" prop="Title">
          <el-input v-model="form.Title" placeholder="请输入演出标题" />
        </el-form-item>
        <el-form-item label="场馆" prop="VenueID">
          <el-select v-model="form.VenueID" placeholder="请选择场馆" style="width: 100%">
            <el-option
              v-for="venue in venueOptions"
              :key="venue.ID"
              :label="venue.Name"
              :value="venue.ID"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="类型" prop="Type">
          <el-select v-model="form.Type" placeholder="请选择类型" style="width: 100%">
            <el-option label="演出" value="performance" />
            <el-option label="排练" value="rehearsal" />
            <el-option label="维护" value="maintenance" />
          </el-select>
        </el-form-item>
        <el-form-item label="开始时间" prop="StartTime">
          <el-date-picker
            v-model="form.StartTime"
            type="datetime"
            placeholder="请选择开始时间"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="结束时间" prop="EndTime">
          <el-date-picker
            v-model="form.EndTime"
            type="datetime"
            placeholder="请选择结束时间"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="form.Description"
            type="textarea"
            :rows="3"
            placeholder="请输入描述"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="form.Remarks"
            type="textarea"
            :rows="2"
            placeholder="请输入备注"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="detailVisible" title="档期详情" size="500px">
      <template v-if="currentBooking">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="ID">{{ currentBooking.ID }}</el-descriptions-item>
          <el-descriptions-item label="演出标题">{{ currentBooking.Title }}</el-descriptions-item>
          <el-descriptions-item label="场馆">{{ currentBooking.Venue?.Name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="类型">{{ typeText(currentBooking.Type) }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTagType(currentBooking.Status)">
              {{ statusText(currentBooking.Status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="开始时间">{{ formatDateTime(currentBooking.StartTime) }}</el-descriptions-item>
          <el-descriptions-item label="结束时间">{{ formatDateTime(currentBooking.EndTime) }}</el-descriptions-item>
          <el-descriptions-item label="操作人">
            {{ currentBooking.User?.RealName || currentBooking.User?.Username || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatDateTime(currentBooking.CreatedAt) }}</el-descriptions-item>
          <el-descriptions-item label="描述">{{ currentBooking.Description || '-' }}</el-descriptions-item>
          <el-descriptions-item label="备注">{{ currentBooking.Remarks || '-' }}</el-descriptions-item>
        </el-descriptions>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { useBookingStore } from '@/stores/booking'
import { useUserStore } from '@/stores/user'
import type { Booking, BookingStatus, BookingType } from '@/types'

const bookingStore = useBookingStore()
const userStore = useUserStore()

const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const detailVisible = ref(false)
const formRef = ref<FormInstance>()
const isEdit = ref(false)
const currentBooking = ref<Booking | null>(null)

const isVenueManager = computed(() => userStore.hasRole('venue_manager'))

const filters = reactive({
  venue_id: undefined as number | undefined,
  status: undefined as string | undefined,
  dateRange: [] as string[]
})

const pagination = reactive({
  page: 1,
  pageSize: 10
})

const form = reactive<Partial<Booking>>({
  Title: '',
  VenueID: undefined,
  Type: 'performance',
  StartTime: '',
  EndTime: '',
  Description: '',
  Remarks: ''
})

const rules: FormRules = {
  Title: [{ required: true, message: '请输入演出标题', trigger: 'blur' }],
  VenueID: [{ required: true, message: '请选择场馆', trigger: 'change' }],
  Type: [{ required: true, message: '请选择类型', trigger: 'change' }],
  StartTime: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
  EndTime: [{ required: true, message: '请选择结束时间', trigger: 'change' }]
}

const venueOptions = computed(() => bookingStore.venues)

const dialogTitle = computed(() => (isEdit.value ? '编辑档期' : '新建档期'))

const filteredList = computed(() => {
  let result = bookingStore.bookings
  if (filters.venue_id) {
    result = result.filter(b => b.VenueID === filters.venue_id)
  }
  if (filters.status) {
    result = result.filter(b => b.Status === filters.status)
  }
  if (filters.dateRange && filters.dateRange.length === 2) {
    const [start, end] = filters.dateRange
    result = result.filter(b => {
      const bookingDate = dayjs(b.StartTime).format('YYYY-MM-DD')
      return bookingDate >= start && bookingDate <= end
    })
  }
  return result
})

const pagedList = computed(() => {
  const start = (pagination.page - 1) * pagination.pageSize
  return filteredList.value.slice(start, start + pagination.pageSize)
})

const formatDateTime = (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss')

const statusText = (status: BookingStatus) => {
  const map: Record<BookingStatus, string> = {
    pending: '待审批',
    confirmed: '已确认',
    conflict: '冲突',
    maintenance: '维护',
    cancelled: '已取消'
  }
  return map[status] || status
}

const statusTagType = (status: BookingStatus) => {
  const map: Record<BookingStatus, 'info' | 'success' | 'danger' | 'warning' | 'primary'> = {
    pending: 'info',
    confirmed: 'success',
    conflict: 'danger',
    maintenance: 'warning',
    cancelled: 'primary'
  }
  return map[status] || 'info'
}

const typeText = (type: BookingType) => {
  const map: Record<BookingType, string> = {
    performance: '演出',
    rehearsal: '排练',
    maintenance: '维护'
  }
  return map[type] || type
}

const fetchData = async () => {
  loading.value = true
  try {
    await bookingStore.fetchVenues()
    await bookingStore.fetchBookings()
  } catch (e) {
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.page = 1
}

const handleReset = () => {
  filters.venue_id = undefined
  filters.status = undefined
  filters.dateRange = []
  pagination.page = 1
}

const resetForm = () => {
  Object.assign(form, {
    Title: '',
    VenueID: undefined,
    Type: 'performance',
    StartTime: '',
    EndTime: '',
    Description: '',
    Remarks: ''
  })
  formRef.value?.resetFields()
}

const handleCreate = () => {
  isEdit.value = false
  resetForm()
  dialogVisible.value = true
}

const handleEdit = (row: Booking) => {
  isEdit.value = true
  Object.assign(form, {
    ID: row.ID,
    Title: row.Title,
    VenueID: row.VenueID,
    Type: row.Type,
    StartTime: row.StartTime,
    EndTime: row.EndTime,
    Description: row.Description,
    Remarks: row.Remarks
  })
  dialogVisible.value = true
}

const handleView = (row: Booking) => {
  currentBooking.value = row
  detailVisible.value = true
}

const handleApprove = (row: Booking) => {
  ElMessageBox.confirm('确认通过该档期审批？', '审批确认', {
    confirmButtonText: '通过',
    cancelButtonText: '驳回',
    distinguishCancelAndClose: true,
    type: 'warning'
  })
    .then(async () => {
      await bookingStore.approveBooking(row.ID, 'approve')
      ElMessage.success('审批通过')
    })
    .catch(async action => {
      if (action === 'cancel') {
        await bookingStore.approveBooking(row.ID, 'reject')
        ElMessage.success('已驳回')
      }
    })
}

const handleDelete = (row: Booking) => {
  ElMessageBox.confirm('确认删除该档期？', '删除确认', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(async () => {
      await bookingStore.deleteBooking(row.ID)
      ElMessage.success('删除成功')
    })
    .catch(() => {})
}

const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async valid => {
    if (!valid) return
    submitting.value = true
    try {
      if (isEdit.value && form.ID) {
        await bookingStore.updateBooking(form.ID, form)
        ElMessage.success('更新成功')
      } else {
        await bookingStore.createBooking(form)
        ElMessage.success('创建成功')
      }
      dialogVisible.value = false
      resetForm()
    } catch (e) {
      ElMessage.error('操作失败')
    } finally {
      submitting.value = false
    }
  })
}

onMounted(fetchData)
</script>

<style scoped lang="scss">
.booking-list {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .filter-form {
    margin-bottom: 16px;
  }

  .pagination {
    margin-top: 16px;
    justify-content: flex-end;
  }
}
</style>
