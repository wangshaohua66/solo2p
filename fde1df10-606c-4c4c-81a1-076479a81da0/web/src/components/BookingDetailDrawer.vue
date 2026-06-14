<template>
  <el-drawer
    v-model="drawerVisible"
    title="档期详情"
    direction="rtl"
    size="480px"
    @close="handleClose"
  >
    <div v-if="booking" class="booking-detail">
      <div class="section">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="档期标题">
            <span class="title-text">{{ booking.Title }}</span>
            <el-tag
              :type="statusTagType"
              size="small"
              style="margin-left: 8px"
            >
              {{ statusText }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="场馆">
            {{ booking.Venue?.Name || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="类型">
            <el-tag :type="typeTagType" size="small">
              {{ typeText }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="开始时间">
            {{ dayjs(booking.StartTime).format('YYYY-MM-DD HH:mm') }}
          </el-descriptions-item>
          <el-descriptions-item label="结束时间">
            {{ dayjs(booking.EndTime).format('YYYY-MM-DD HH:mm') }}
          </el-descriptions-item>
          <el-descriptions-item label="操作人">
            {{ booking.User?.RealName || booking.User?.Username || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ dayjs(booking.CreatedAt).format('YYYY-MM-DD HH:mm') }}
          </el-descriptions-item>
          <el-descriptions-item label="描述" v-if="booking.Description">
            {{ booking.Description }}
          </el-descriptions-item>
          <el-descriptions-item label="备注" v-if="booking.Remarks">
            {{ booking.Remarks }}
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <div class="section" v-if="booking.Status === 'pending' && userStore.hasRole('venue_manager')">
        <div class="section-title">审批操作</div>
        <el-space>
          <el-button type="success" :loading="approving" @click="handleApprove">
            通过
          </el-button>
          <el-button type="danger" :loading="rejecting" @click="handleReject">
            驳回
          </el-button>
        </el-space>
      </div>

      <div class="section">
        <div class="section-title">变更历史</div>
        <el-timeline>
          <el-timeline-item
            :timestamp="dayjs(booking.CreatedAt).format('YYYY-MM-DD HH:mm')"
            placement="top"
          >
            创建档期
          </el-timeline-item>
          <el-timeline-item
            v-if="booking.Status !== 'pending'"
            :timestamp="dayjs(booking.CreatedAt).format('YYYY-MM-DD HH:mm')"
            :type="booking.Status === 'confirmed' ? 'success' : 'danger'"
            placement="top"
          >
            {{ statusText }}
          </el-timeline-item>
        </el-timeline>
      </div>

      <div class="section">
        <div class="section-title">关联设备</div>
        <el-table
          v-loading="equipmentLoading"
          :data="equipments"
          size="small"
          style="width: 100%"
          empty-text="暂无关联设备"
        >
          <el-table-column prop="Name" label="设备名称" />
          <el-table-column prop="Category" label="分类" width="80">
            <template #default="{ row }">
              <el-tag size="small">{{ categoryText(row.Category) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="Status" label="状态" width="80">
            <template #default="{ row }">
              <el-tag size="small" :type="equipmentStatusType(row.Status)">
                {{ equipmentStatusText(row.Status) }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="actions">
        <el-space>
          <el-button
            v-if="canEdit"
            type="primary"
            @click="handleEdit"
          >
            编辑
          </el-button>
          <el-button
            v-if="canDelete"
            type="danger"
            :loading="deleting"
            @click="handleDelete"
          >
            删除
          </el-button>
        </el-space>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import { useBookingStore } from '@/stores/booking'
import { useUserStore } from '@/stores/user'
import { getEquipments } from '@/api/resource'
import type { Booking, Equipment, BookingStatus, BookingType, EquipmentCategory, EquipmentStatus } from '@/types'

const props = defineProps<{
  modelValue: boolean
  bookingId: number | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'edit', booking: Booking): void
  (e: 'refresh'): void
}>()

const bookingStore = useBookingStore()
const userStore = useUserStore()

const drawerVisible = ref(props.modelValue)
const booking = ref<Booking | null>(null)
const equipments = ref<Equipment[]>([])
const equipmentLoading = ref(false)
const approving = ref(false)
const rejecting = ref(false)
const deleting = ref(false)

const statusText = computed(() => {
  if (!booking.value) return ''
  const map: Record<BookingStatus, string> = {
    pending: '待审批',
    confirmed: '已确认',
    conflict: '冲突',
    maintenance: '维护中',
    cancelled: '已取消'
  }
  return map[booking.value.Status]
})

const statusTagType = computed(() => {
  if (!booking.value) return ''
  const map: Record<BookingStatus, 'info' | 'success' | 'danger' | 'warning'> = {
    pending: 'info',
    confirmed: 'success',
    conflict: 'danger',
    maintenance: 'warning',
    cancelled: 'info'
  }
  return map[booking.value.Status]
})

const typeText = computed(() => {
  if (!booking.value) return ''
  const map: Record<BookingType, string> = {
    performance: '演出',
    rehearsal: '排练',
    maintenance: '维护'
  }
  return map[booking.value.Type]
})

const typeTagType = computed(() => {
  if (!booking.value) return ''
  const map: Record<BookingType, '' | 'warning' | 'info'> = {
    performance: '',
    rehearsal: 'warning',
    maintenance: 'info'
  }
  return map[booking.value.Type] as '' | 'success' | 'warning' | 'info' | 'danger'
})

const canEdit = computed(() => {
  if (!booking.value) return false
  if (userStore.hasRole('venue_manager')) return true
  if (userStore.hasRole('producer') && booking.value.UserID === userStore.user?.ID) return true
  return false
})

const canDelete = computed(() => canEdit.value)

watch(
  () => props.modelValue,
  (val) => {
    drawerVisible.value = val
    if (val && props.bookingId) {
      fetchBookingDetail()
    }
  }
)

watch(drawerVisible, (val) => {
  emit('update:modelValue', val)
})

const fetchBookingDetail = async () => {
  const found = bookingStore.bookings.find(b => b.ID === props.bookingId)
  booking.value = found || null
  if (booking.value) {
    fetchEquipments()
  }
}

const fetchEquipments = async () => {
  equipmentLoading.value = true
  try {
    equipments.value = await getEquipments()
  } finally {
    equipmentLoading.value = false
  }
}

const categoryText = (c: EquipmentCategory) => {
  const map: Record<EquipmentCategory, string> = {
    lighting: '灯光',
    sound: '音响',
    stage: '舞台'
  }
  return map[c] || c
}

const equipmentStatusText = (s: EquipmentStatus) => {
  const map: Record<EquipmentStatus, string> = {
    available: '可用',
    in_use: '使用中',
    maintenance: '维护中'
  }
  return map[s] || s
}

const equipmentStatusType = (s: EquipmentStatus) => {
  const map: Record<EquipmentStatus, 'success' | 'warning' | 'info'> = {
    available: 'success',
    in_use: 'warning',
    maintenance: 'info'
  }
  return map[s]
}

const handleApprove = async () => {
  if (!booking.value) return
  approving.value = true
  try {
    await bookingStore.approveBooking(booking.value.ID, 'approve')
    ElMessage.success('审批通过')
    emit('refresh')
    fetchBookingDetail()
  } finally {
    approving.value = false
  }
}

const handleReject = async () => {
  if (!booking.value) return
  try {
    await ElMessageBox.confirm('确定要驳回该档期吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    rejecting.value = true
    await bookingStore.approveBooking(booking.value.ID, 'reject')
    ElMessage.success('已驳回')
    emit('refresh')
    fetchBookingDetail()
  } catch {
  } finally {
    rejecting.value = false
  }
}

const handleEdit = () => {
  if (booking.value) {
    emit('edit', booking.value)
  }
}

const handleDelete = async () => {
  if (!booking.value) return
  try {
    await ElMessageBox.confirm('确定要删除该档期吗？此操作不可恢复。', '提示', {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'error'
    })
    deleting.value = true
    await bookingStore.deleteBooking(booking.value.ID)
    ElMessage.success('删除成功')
    emit('refresh')
    drawerVisible.value = false
  } catch {
  } finally {
    deleting.value = false
  }
}

const handleClose = () => {
  drawerVisible.value = false
  booking.value = null
  equipments.value = []
}
</script>

<style scoped lang="scss">
.booking-detail {
  .section {
    margin-bottom: 24px;

    .section-title {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #303133;
    }
  }

  .title-text {
    font-size: 16px;
    font-weight: 600;
  }

  .actions {
    position: sticky;
    bottom: 0;
    padding-top: 16px;
    background: #fff;
    border-top: 1px solid #ebeef5;
  }
}
</style>
