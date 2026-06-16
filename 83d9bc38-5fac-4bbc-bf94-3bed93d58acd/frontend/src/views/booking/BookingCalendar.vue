<template>
  <div class="h-full flex flex-col p-4 md:p-6">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">预约日历</h1>
      <p class="text-gray-500 mt-1">查看和管理设备预约</p>
    </div>

    <div class="flex flex-col lg:flex-row gap-4 lg:gap-6 flex-1 min-h-0">
      <div class="lg:w-64 shrink-0">
        <el-card class="h-full">
          <template #header>
            <div class="flex items-center justify-between">
              <span class="font-semibold">设备列表</span>
              <el-badge :value="equipmentList.length" class="ml-2" />
            </div>
          </template>
          <div class="space-y-2 max-h-96 lg:max-h-full overflow-y-auto">
            <div
              v-for="equipment in equipmentList"
              :key="equipment.id"
              class="equipment-item p-3 rounded-lg cursor-pointer transition-all border-2"
              :class="[
                selectedEquipmentId === equipment.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-transparent hover:bg-gray-50'
              ]"
              @click="selectEquipment(equipment.id)"
            >
              <div class="flex items-center gap-3">
                <div
                  class="w-3 h-3 rounded-full shrink-0"
                  :class="getStatusDotColor(equipment.status)"
                />
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-sm text-gray-900 truncate">
                    {{ equipment.name }}
                  </div>
                  <div class="text-xs text-gray-500 truncate">
                    {{ equipment.model }}
                  </div>
                </div>
              </div>
            </div>
            <div v-if="equipmentList.length === 0" class="py-8 text-center text-gray-400 text-sm">
              暂无设备
            </div>
          </div>
        </el-card>
      </div>

      <div class="flex-1 flex flex-col min-w-0">
        <el-card class="mb-4">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center gap-2">
              <el-button-group>
                <el-button @click="prevWeek">
                  <el-icon><ArrowLeft /></el-icon>
                </el-button>
                <el-button @click="goToToday">今天</el-button>
                <el-button @click="nextWeek">
                  <el-icon><ArrowRight /></el-icon>
                </el-button>
              </el-button-group>
              <span class="font-semibold text-lg ml-2">
                {{ weekRangeText }}
              </span>
            </div>
            <div class="flex items-center gap-4">
              <div class="hidden md:flex items-center gap-4 text-sm">
                <div class="flex items-center gap-1">
                  <div class="w-3 h-3 rounded bg-blue-500"></div>
                  <span class="text-gray-600">已预约</span>
                </div>
                <div class="flex items-center gap-1">
                  <div class="w-3 h-3 rounded bg-gray-300 pattern-stripes"></div>
                  <span class="text-gray-600">等待队列</span>
                </div>
                <div class="flex items-center gap-1">
                  <div class="w-3 h-3 rounded bg-gray-200 border border-gray-300"></div>
                  <span class="text-gray-600">维护中</span>
                </div>
                <div class="flex items-center gap-1">
                  <div class="w-3 h-3 rounded border-2 border-red-500"></div>
                  <span class="text-gray-600">冲突</span>
                </div>
              </div>
              <el-button
                type="primary"
                :disabled="!selectedEquipmentId"
                @click="showQuickBooking = true"
              >
                <el-icon><Calendar /></el-icon>
                快速预约
              </el-button>
            </div>
          </div>
        </el-card>

        <el-card class="flex-1 min-h-0 overflow-hidden">
          <div v-if="bookingStore.loading" class="h-full flex items-center justify-center">
            <el-loading text="加载中..." />
          </div>
          <div v-else-if="!selectedEquipmentId" class="h-full flex items-center justify-center">
            <el-empty description="请从左侧选择设备查看预约" />
          </div>
          <div v-else class="h-full overflow-auto" ref="calendarContainer">
            <div class="min-w-[800px]">
              <div class="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
                <div class="w-20 shrink-0 border-r border-gray-200 p-2 text-center text-sm font-medium text-gray-500">
                  时间
                </div>
                <div
                  v-for="day in weekDays"
                  :key="day.date"
                  class="flex-1 border-r border-gray-200 last:border-r-0 p-2 text-center"
                  :class="{ 'bg-blue-50': day.isToday }"
                >
                  <div class="text-sm font-medium text-gray-900">{{ day.weekday }}</div>
                  <div class="text-xs text-gray-500">{{ day.dateText }}</div>
                </div>
              </div>

              <div class="relative">
                <div v-for="hour in timeSlots" :key="hour" class="flex border-b border-gray-100">
                  <div class="w-20 shrink-0 border-r border-gray-200 p-1 text-center text-xs text-gray-400">
                    {{ String(hour).padStart(2, '0') }}:00
                  </div>
                  <div
                    v-for="day in weekDays"
                    :key="`${day.date}-${hour}`"
                    class="flex-1 border-r border-gray-100 last:border-r-0 h-12 relative"
                    :class="{ 'bg-gray-50 cursor-pointer hover:bg-blue-50': !isMaintenanceSlot(day.date, hour) }"
                    @mousedown="startDrag($event, day.date, hour)"
                  >
                    <div
                      v-if="isMaintenanceSlot(day.date, hour)"
                      class="absolute inset-0 bg-gray-200 flex items-center justify-center"
                    >
                      <el-icon :size="16" class="text-gray-400"><Lock /></el-icon>
                    </div>
                  </div>
                </div>

                <div
                  v-for="booking in displayBookings"
                  :key="booking.id"
                  class="absolute rounded px-2 py-1 overflow-hidden cursor-pointer transition-all hover:z-20 hover:shadow-lg"
                  :class="getBookingClass(booking)"
                  :style="getBookingStyle(booking)"
                  @click="showBookingDetail(booking)"
                >
                  <div class="text-xs font-medium text-white truncate">
                    {{ booking.user?.name || booking.userName }}
                  </div>
                  <div class="text-xs text-white/80">
                    {{ formatTime(booking.startTime) }} - {{ formatTime(booking.endTime) }}
                  </div>
                  <div v-if="booking.status === 'waitlist'" class="text-xs text-white/80">
                    #{{ booking.waitlistPosition || '?' }} 等待中
                  </div>
                </div>

                <div
                  v-if="isDragging && dragSelection"
                  class="absolute bg-blue-200/50 border-2 border-blue-500 rounded pointer-events-none z-30"
                  :style="dragSelectionStyle"
                />
              </div>
            </div>
          </div>
        </el-card>
      </div>
    </div>

    <el-dialog
      v-model="detailDialogVisible"
      title="预约详情"
      width="480px"
    >
      <div v-if="selectedBooking" class="space-y-4">
        <div class="flex items-center gap-3">
          <el-tag :type="getBookingStatusType(selectedBooking.status)" size="large">
            {{ getBookingStatusText(selectedBooking.status) }}
          </el-tag>
          <span v-if="hasConflict(selectedBooking)" class="text-red-500 text-sm flex items-center gap-1">
            <el-icon><Warning /></el-icon>
            时段冲突
          </span>
        </div>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="设备">
            {{ selectedBooking.equipment?.name || selectedBooking.equipmentName }}
          </el-descriptions-item>
          <el-descriptions-item label="预约人">
            {{ selectedBooking.user?.name || selectedBooking.userName }}
          </el-descriptions-item>
          <el-descriptions-item label="日期">
            {{ formatDate(selectedBooking.startTime) }}
          </el-descriptions-item>
          <el-descriptions-item label="时间">
            {{ formatTime(selectedBooking.startTime) }} - {{ formatTime(selectedBooking.endTime) }}
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ formatDateTime(selectedBooking.createdAt) }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
        <el-button
          v-if="selectedBooking && selectedBooking.status === 'confirmed'"
          type="danger"
          :loading="bookingStore.loading"
          @click="handleCancelBooking"
        >
          取消预约
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showQuickBooking"
      title="快速预约"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form :model="quickBookingForm" label-width="80px">
        <el-form-item label="设备">
          <el-select v-model="quickBookingForm.equipmentId" placeholder="选择设备" style="width: 100%">
            <el-option
              v-for="eq in availableEquipmentList"
              :key="eq.id"
              :label="`${eq.name} (${eq.model})`"
              :value="eq.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker
            v-model="quickBookingForm.date"
            type="date"
            placeholder="选择日期"
            :disabled-date="disabledDate"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="开始时间">
          <el-time-picker
            v-model="quickBookingForm.startTime"
            placeholder="选择开始时间"
            format="HH:mm"
            value-format="HH:mm"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-time-picker
            v-model="quickBookingForm.endTime"
            placeholder="选择结束时间"
            format="HH:mm"
            value-format="HH:mm"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <div v-if="conflictInfo?.hasConflict" class="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
        <div class="text-orange-600 text-sm flex items-center gap-1">
          <el-icon><Warning /></el-icon>
          该时段已有 {{ conflictInfo.conflictingBookings.length }} 个预约冲突
        </div>
      </div>
      <template #footer>
        <el-button @click="showQuickBooking = false">取消</el-button>
        <el-button type="primary" :loading="bookingStore.loading" @click="submitQuickBooking">
          {{ conflictInfo?.hasConflict ? '加入等待队列' : '确认预约' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Lock,
  Warning
} from '@element-plus/icons-vue'
import { useEquipmentStore, type Equipment } from '@/stores/equipment'
import { useBookingStore, type Booking } from '@/stores/booking'
import type { BookingStatus, EquipmentStatus } from '@/types'
import { cn } from '@/lib/utils'

const equipmentStore = useEquipmentStore()
const bookingStore = useBookingStore()

const calendarContainer = ref<HTMLElement | null>(null)
const currentWeekStart = ref(dayjs().startOf('week'))
const selectedEquipmentId = ref<number | null>(null)
const selectedBooking = ref<Booking | null>(null)
const detailDialogVisible = ref(false)
const showQuickBooking = ref(false)
const conflictInfo = ref<{ hasConflict: boolean; conflictingBookings: Booking[] } | null>(null)

const isDragging = ref(false)
const dragStart = ref<{ date: string; hour: number } | null>(null)
const dragEnd = ref<{ date: string; hour: number } | null>(null)

const quickBookingForm = ref({
  equipmentId: null as number | null,
  date: dayjs().format('YYYY-MM-DD'),
  startTime: '09:00',
  endTime: '11:00'
})

const HOUR_HEIGHT = 48
const SLOT_START = 8
const SLOT_END = 22

const equipmentList = computed(() => equipmentStore.equipmentList)
const availableEquipmentList = computed(() =>
  equipmentStore.equipmentList.filter(eq => eq.status === 'available')
)

const timeSlots = computed(() => {
  const slots: number[] = []
  for (let i = SLOT_START; i <= SLOT_END; i++) {
    slots.push(i)
  }
  return slots
})

const weekDays = computed(() => {
  const days: { date: string; weekday: string; dateText: string; isToday: boolean }[] = []
  const today = dayjs()
  for (let i = 0; i < 7; i++) {
    const day = currentWeekStart.value.add(i, 'day')
    days.push({
      date: day.format('YYYY-MM-DD'),
      weekday: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][day.day()],
      dateText: day.format('MM/DD'),
      isToday: day.isSame(today, 'day')
    })
  }
  return days
})

const weekRangeText = computed(() => {
  const start = currentWeekStart.value
  const end = currentWeekStart.value.add(6, 'day')
  if (start.month() === end.month()) {
    return `${start.format('YYYY年MM月DD日')} - ${end.format('DD日')}`
  }
  return `${start.format('YYYY年MM月DD日')} - ${end.format('MM月DD日')}`
})

const displayBookings = computed(() => {
  if (!selectedEquipmentId.value) return []
  const startDate = currentWeekStart.value.format('YYYY-MM-DD')
  const endDate = currentWeekStart.value.add(6, 'day').format('YYYY-MM-DD')
  return bookingStore.bookingList.filter(booking => {
    if (booking.equipmentId !== selectedEquipmentId.value) return false
    const bookingDate = dayjs(booking.startTime).format('YYYY-MM-DD')
    return bookingDate >= startDate && bookingDate <= endDate
  })
})

const maintenanceSlots = ref<Map<string, Set<number>>>(new Map())

const getStatusDotColor = (status: EquipmentStatus) => {
  const colorMap: Record<EquipmentStatus, string> = {
    available: 'bg-green-500',
    maintenance: 'bg-yellow-500',
    scrapped: 'bg-red-500'
  }
  return colorMap[status] || 'bg-gray-400'
}

const getBookingStatusType = (status: BookingStatus) => {
  const typeMap: Record<BookingStatus, 'success' | 'warning' | 'info' | 'danger'> = {
    confirmed: 'success',
    waitlist: 'warning',
    completed: 'info',
    cancelled: 'danger'
  }
  return typeMap[status] || 'info'
}

const getBookingStatusText = (status: BookingStatus) => {
  const textMap: Record<BookingStatus, string> = {
    confirmed: '已确认',
    waitlist: '等待中',
    completed: '已完成',
    cancelled: '已取消'
  }
  return textMap[status] || status
}

const formatTime = (time: string) => {
  return dayjs(time).format('HH:mm')
}

const formatDate = (time: string) => {
  return dayjs(time).format('YYYY-MM-DD dddd')
}

const formatDateTime = (time: string) => {
  return dayjs(time).format('YYYY-MM-DD HH:mm')
}

const disabledDate = (time: Date) => {
  return dayjs(time).isBefore(dayjs().startOf('day'))
}

const isMaintenanceSlot = (date: string, hour: number) => {
  const daySlots = maintenanceSlots.value.get(date)
  return daySlots?.has(hour) || false
}

const hasConflict = (booking: Booking) => {
  return bookingStore.conflictInfo?.conflictingBookings.some(b => b.id === booking.id) || false
}

const getBookingClass = (booking: Booking) => {
  const base = 'z-10'
  if (booking.status === 'cancelled') {
    return cn(base, 'bg-gray-400 opacity-50')
  }
  if (booking.status === 'waitlist') {
    return cn(base, 'bg-gray-500 pattern-stripes')
  }
  if (hasConflict(booking)) {
    return cn(base, 'bg-blue-500 border-2 border-red-500')
  }
  return cn(base, 'bg-blue-500')
}

const getBookingStyle = (booking: Booking) => {
  const startTime = dayjs(booking.startTime)
  const endTime = dayjs(booking.endTime)
  const date = startTime.format('YYYY-MM-DD')
  const dayIndex = weekDays.value.findIndex(d => d.date === date)

  if (dayIndex === -1) return { display: 'none' }

  const startHour = startTime.hour() + startTime.minute() / 60
  const endHour = endTime.hour() + endTime.minute() / 60

  const top = (startHour - SLOT_START) * HOUR_HEIGHT
  const height = (endHour - startHour) * HOUR_HEIGHT
  const left = `calc(5rem + ${dayIndex} * (100% - 5rem) / 7)`
  const width = `calc((100% - 5rem) / 7 - 4px)`

  return {
    top: `${top}px`,
    height: `${Math.max(height - 2, 20)}px`,
    left,
    width
  }
}

const dragSelection = computed(() => {
  if (!dragStart.value || !dragEnd.value) return null
  return {
    startDate: dragStart.value.date <= dragEnd.value.date ? dragStart.value.date : dragEnd.value.date,
    endDate: dragStart.value.date <= dragEnd.value.date ? dragEnd.value.date : dragStart.value.date,
    startHour: Math.min(dragStart.value.hour, dragEnd.value.hour),
    endHour: Math.max(dragStart.value.hour, dragEnd.value.hour) + 1
  }
})

const dragSelectionStyle = computed(() => {
  if (!dragSelection.value) return {}
  const { startDate, startHour, endHour, endDate } = dragSelection.value
  const startDayIndex = weekDays.value.findIndex(d => d.date === startDate)
  const endDayIndex = weekDays.value.findIndex(d => d.date === endDate)

  if (startDayIndex === -1 || endDayIndex === -1) return {}

  const top = (startHour - SLOT_START) * HOUR_HEIGHT
  const height = (endHour - startHour) * HOUR_HEIGHT
  const left = `calc(5rem + ${startDayIndex} * (100% - 5rem) / 7)`
  const dayCount = endDayIndex - startDayIndex + 1
  const width = `calc(${dayCount} * (100% - 5rem) / 7 - 4px)`

  return {
    top: `${top}px`,
    height: `${height}px`,
    left,
    width
  }
})

const selectEquipment = async (id: number) => {
  selectedEquipmentId.value = id
  quickBookingForm.value.equipmentId = id
  await loadBookings()
}

const prevWeek = () => {
  currentWeekStart.value = currentWeekStart.value.subtract(1, 'week')
  loadBookings()
}

const nextWeek = () => {
  currentWeekStart.value = currentWeekStart.value.add(1, 'week')
  loadBookings()
}

const goToToday = () => {
  currentWeekStart.value = dayjs().startOf('week')
  loadBookings()
}

const loadEquipment = async () => {
  await equipmentStore.fetchList({ page: 1, pageSize: 100 })
  if (equipmentStore.equipmentList.length > 0 && !selectedEquipmentId.value) {
    selectEquipment(equipmentStore.equipmentList[0].id)
  }
}

const loadBookings = async () => {
  if (!selectedEquipmentId.value) return
  const startDate = currentWeekStart.value.format('YYYY-MM-DD')
  const endDate = currentWeekStart.value.add(6, 'day').format('YYYY-MM-DD')
  await bookingStore.fetchBookings({
    equipmentId: selectedEquipmentId.value,
    startDate,
    endDate
  })
}

const showBookingDetail = (booking: Booking) => {
  selectedBooking.value = booking
  detailDialogVisible.value = true
}

const handleCancelBooking = async () => {
  if (!selectedBooking.value) return
  try {
    await ElMessageBox.confirm('确定要取消该预约吗？', '取消预约', {
      type: 'warning'
    })
    await bookingStore.cancelBooking(selectedBooking.value.id)
    ElMessage.success('预约已取消')
    detailDialogVisible.value = false
    loadBookings()
  } catch {
  }
}

const startDrag = (event: MouseEvent, date: string, hour: number) => {
  if (isMaintenanceSlot(date, hour)) return
  isDragging.value = true
  dragStart.value = { date, hour }
  dragEnd.value = { date, hour }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.value || !calendarContainer.value) return
    const rect = calendarContainer.value.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const dayIndex = Math.floor((x - 80) / ((rect.width - 80) / 7))
    const clampedDayIndex = Math.max(0, Math.min(6, dayIndex))
    const hour = Math.floor(y / HOUR_HEIGHT) + SLOT_START
    const clampedHour = Math.max(SLOT_START, Math.min(SLOT_END - 1, hour))
    dragEnd.value = {
      date: weekDays.value[clampedDayIndex].date,
      hour: clampedHour
    }
  }

  const handleMouseUp = async () => {
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)

    if (isDragging.value && dragSelection.value && selectedEquipmentId.value) {
      const { startDate, startHour, endHour } = dragSelection.value
      const startTime = `${startDate}T${String(startHour).padStart(2, '0')}:00:00`
      const endTime = `${startDate}T${String(endHour).padStart(2, '0')}:00:00`

      try {
        const conflict = await bookingStore.checkConflict(selectedEquipmentId.value, startTime, endTime)
        if (conflict.hasConflict) {
          await ElMessageBox.confirm(
            '该时段存在冲突预约，是否加入等待队列？',
            '时段冲突',
            { type: 'warning', confirmButtonText: '加入等待', cancelButtonText: '取消' }
          )
          await bookingStore.addWaitlist({
            equipmentId: selectedEquipmentId.value,
            startTime,
            endTime
          })
          ElMessage.success('已加入等待队列')
        } else {
          await ElMessageBox.confirm(
            `确认预约 ${dayjs(startTime).format('MM-DD HH:mm')} - ${dayjs(endTime).format('HH:mm')}？`,
            '创建预约',
            { type: 'info' }
          )
          await bookingStore.createBooking({
            equipmentId: selectedEquipmentId.value,
            startTime,
            endTime
          })
          ElMessage.success('预约成功')
        }
        loadBookings()
      } catch {
      }
    }

    isDragging.value = false
    dragStart.value = null
    dragEnd.value = null
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

const checkConflict = async () => {
  if (!quickBookingForm.value.equipmentId || !quickBookingForm.value.date || !quickBookingForm.value.startTime || !quickBookingForm.value.endTime) {
    conflictInfo.value = null
    return
  }
  const startTime = `${quickBookingForm.value.date}T${quickBookingForm.value.startTime}:00`
  const endTime = `${quickBookingForm.value.date}T${quickBookingForm.value.endTime}:00`
  conflictInfo.value = await bookingStore.checkConflict(quickBookingForm.value.equipmentId, startTime, endTime)
}

const submitQuickBooking = async () => {
  if (!quickBookingForm.value.equipmentId) {
    ElMessage.warning('请选择设备')
    return
  }
  if (!quickBookingForm.value.date || !quickBookingForm.value.startTime || !quickBookingForm.value.endTime) {
    ElMessage.warning('请完善预约时间')
    return
  }
  if (quickBookingForm.value.startTime >= quickBookingForm.value.endTime) {
    ElMessage.warning('结束时间必须晚于开始时间')
    return
  }

  const startTime = `${quickBookingForm.value.date}T${quickBookingForm.value.startTime}:00`
  const endTime = `${quickBookingForm.value.date}T${quickBookingForm.value.endTime}:00`

  try {
    if (conflictInfo.value?.hasConflict) {
      await bookingStore.addWaitlist({
        equipmentId: quickBookingForm.value.equipmentId,
        startTime,
        endTime
      })
      ElMessage.success('已加入等待队列')
    } else {
      await bookingStore.createBooking({
        equipmentId: quickBookingForm.value.equipmentId,
        startTime,
        endTime
      })
      ElMessage.success('预约成功')
    }
    showQuickBooking.value = false
    loadBookings()
  } catch {
    ElMessage.error('操作失败，请重试')
  }
}

watch(
  () => [quickBookingForm.value.equipmentId, quickBookingForm.value.date, quickBookingForm.value.startTime, quickBookingForm.value.endTime],
  () => {
    checkConflict()
  }
)

onMounted(() => {
  loadEquipment()
})

onUnmounted(() => {
})
</script>

<style scoped>
.pattern-stripes {
  background-image: repeating-linear-gradient(
    45deg,
    rgba(255, 255, 255, 0.2),
    rgba(255, 255, 255, 0.2) 4px,
    transparent 4px,
    transparent 8px
  );
}

:deep(.el-descriptions__label) {
  width: 80px;
}

@media (max-width: 1024px) {
  :deep(.el-descriptions) {
    font-size: 14px;
  }
}
</style>
