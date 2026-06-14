<template>
  <div class="schedule-board">
    <div class="toolbar">
      <div class="toolbar-left">
        <el-date-picker
          v-model="currentMonth"
          type="month"
          placeholder="选择月份"
          format="YYYY 年 MM 月"
          value-format="YYYY-MM-DD"
          :clearable="false"
          @change="handleMonthChange"
        />
        <el-checkbox-group
          v-model="selectedVenueIds"
          class="venue-filter"
          @change="handleVenueChange"
        >
          <el-checkbox
            v-for="venue in displayVenues"
            :key="venue.ID"
            :value="venue.ID"
          >
            {{ venue.Name }}
          </el-checkbox>
        </el-checkbox-group>
      </div>

      <div class="toolbar-right">
        <el-select
          v-model="selectedStatuses"
          multiple
          collapse-tags
          placeholder="状态筛选"
          style="width: 180px"
        >
          <el-option label="待审批" value="pending" />
          <el-option label="已确认" value="confirmed" />
          <el-option label="冲突" value="conflict" />
          <el-option label="维护" value="maintenance" />
        </el-select>

        <el-radio-group v-model="viewMode" size="small">
          <el-radio-button value="day">日</el-radio-button>
          <el-radio-button value="week">周</el-radio-button>
          <el-radio-button value="month">月</el-radio-button>
        </el-radio-group>

        <el-button
          v-if="canCreate"
          type="primary"
          :icon="Plus"
          @click="openCreateDialog"
        >
          新建档期
        </el-button>
      </div>
    </div>

    <div v-if="!isMobile" class="gantt-container" ref="ganttContainerRef">
      <div class="gantt-scroll" ref="ganttScrollRef" @scroll="handleScroll">
        <div class="gantt-wrapper">
          <div class="gantt-header" ref="ganttHeaderRef">
            <div class="gantt-corner">场馆</div>
            <div class="gantt-dates" :style="{ width: totalWidth + 'px' }">
              <div
                v-for="date in dateColumns"
                :key="date.key"
                class="gantt-date-col"
                :class="{ 'is-today': date.isToday, 'is-weekend': date.isWeekend }"
                :style="{ width: columnWidth + 'px' }"
              >
                <div class="date-day">{{ dayjs(date.date).format('DD') }}</div>
                <div class="date-week">{{ dayjs(date.date).format('ddd') }}</div>
              </div>
            </div>
          </div>

          <div class="gantt-body">
            <div class="gantt-venue-col">
              <div
                v-for="venue in displayVenues"
                :key="venue.ID"
                class="venue-row"
                :style="{ height: rowHeight + 'px' }"
              >
                <div class="venue-name" :title="venue.Name">{{ venue.Name }}</div>
                <div class="venue-type">
                  <el-tag size="small" type="info">{{ venueTypeText(venue.Type) }}</el-tag>
                </div>
              </div>
            </div>

            <div
              class="gantt-grid"
              :style="{ width: totalWidth + 'px' }"
              @click="handleGridClick"
            >
              <div
                v-for="venue in displayVenues"
                :key="'row-' + venue.ID"
                class="gantt-row"
                :style="{ height: rowHeight + 'px' }"
              >
                <div
                  v-for="date in dateColumns"
                  :key="'cell-' + venue.ID + '-' + date.key"
                  class="gantt-cell"
                  :class="{ 'is-weekend': date.isWeekend }"
                  :style="{ width: columnWidth + 'px' }"
                  :data-venue-id="venue.ID"
                  :data-date="date.date"
                ></div>

                <div
                  v-for="booking in getVenueBookings(venue.ID)"
                  :key="'booking-' + booking.ID"
                  class="booking-bar"
                  :class="'status-' + booking.Status"
                  :style="getBookingStyle(booking, venue.ID)"
                  :draggable="canDrag"
                  @dragstart="handleDragStart($event, booking)"
                  @dragend="handleDragEnd"
                  @dragover.prevent
                  @click.stop="openBookingDetail(booking.ID)"
                >
                  <el-tooltip placement="top" :show-after="200">
                    <template #content>
                      <div class="tooltip-content">
                        <div class="tooltip-title">{{ booking.Title }}</div>
                        <div class="tooltip-row">
                          <span>时间：</span>
                          {{ dayjs(booking.StartTime).format('MM-DD HH:mm') }} - {{ dayjs(booking.EndTime).format('HH:mm') }}
                        </div>
                        <div class="tooltip-row">
                          <span>场馆：</span>{{ booking.Venue?.Name || venue.Name }}
                        </div>
                        <div class="tooltip-row">
                          <span>状态：</span>{{ statusText(booking.Status) }}
                        </div>
                        <div class="tooltip-row" v-if="booking.User">
                          <span>操作人：</span>{{ booking.User.RealName || booking.User.Username }}
                        </div>
                      </div>
                    </template>
                    <div class="booking-bar-inner">
                      <span class="booking-title">{{ booking.Title }}</span>
                      <span class="booking-time" v-if="columnWidth >= 100">
                        {{ dayjs(booking.StartTime).format('HH:mm') }}
                      </span>
                    </div>
                  </el-tooltip>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="dragBooking && dragShadow"
        class="drag-shadow"
        :class="'status-' + dragBooking.Status"
        :style="dragShadowStyle"
      >
        {{ dragBooking.Title }}
      </div>
    </div>

    <div v-else class="mobile-list">
      <div
        v-for="group in mobileGroupedBookings"
        :key="group.date"
        class="mobile-day-group"
      >
        <div class="mobile-day-header">
          <span class="day-date">{{ dayjs(group.date).format('MM月DD日') }}</span>
          <span class="day-week">{{ dayjs(group.date).format('dddd') }}</span>
          <el-tag v-if="isToday(group.date)" size="small" type="danger">今天</el-tag>
        </div>
        <div class="mobile-booking-list">
          <div
            v-for="booking in group.bookings"
            :key="booking.ID"
            class="mobile-booking-card"
            :class="'status-' + booking.Status"
            @click="openBookingDetail(booking.ID)"
          >
            <div class="mobile-booking-time">
              {{ dayjs(booking.StartTime).format('HH:mm') }} - {{ dayjs(booking.EndTime).format('HH:mm') }}
            </div>
            <div class="mobile-booking-info">
              <div class="mobile-booking-title">{{ booking.Title }}</div>
              <div class="mobile-booking-venue">
                <el-tag size="small" :type="statusTagType(booking.Status)">
                  {{ statusText(booking.Status) }}
                </el-tag>
                <span>{{ booking.Venue?.Name }}</span>
              </div>
            </div>
          </div>
          <el-empty
            v-if="group.bookings.length === 0"
            description="暂无档期"
            :image-size="60"
          />
        </div>
      </div>
    </div>

    <BookingDialog
      v-model="dialogVisible"
      :edit-data="editBooking"
      @success="handleDialogSuccess"
    />

    <BookingDetailDrawer
      v-model="drawerVisible"
      :booking-id="detailBookingId"
      @edit="handleEditBooking"
      @refresh="refreshData"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import { useBookingStore } from '@/stores/booking'
import { useUserStore } from '@/stores/user'
import BookingDialog from '@/components/BookingDialog.vue'
import BookingDetailDrawer from '@/components/BookingDetailDrawer.vue'
import type { Booking, BookingStatus, Venue, VenueType } from '@/types'

dayjs.locale('zh-cn')

const bookingStore = useBookingStore()
const userStore = useUserStore()

const ganttContainerRef = ref<HTMLElement>()
const ganttScrollRef = ref<HTMLElement>()
const ganttHeaderRef = ref<HTMLElement>()

const viewMode = ref<'day' | 'week' | 'month'>('month')
const currentMonth = ref(bookingStore.currentMonth.format('YYYY-MM-DD'))
const selectedVenueIds = ref<number[]>([...bookingStore.selectedVenueIds])
const selectedStatuses = ref<BookingStatus[]>(['pending', 'confirmed', 'conflict', 'maintenance'])

const dialogVisible = ref(false)
const editBooking = ref<Booking | null>(null)
const drawerVisible = ref(false)
const detailBookingId = ref<number | null>(null)

const columnWidth = ref(120)
const rowHeight = ref(80)

const isMobile = ref(false)
const checkMobile = () => {
  isMobile.value = window.innerWidth < 768
}

const dragBooking = ref<Booking | null>(null)
const dragShadow = reactive({ show: false, x: 0, y: 0, width: 0, height: 0 })

const canCreate = computed(() => userStore.hasRole(['venue_manager', 'producer']))
const canDrag = computed(() => userStore.hasRole('venue_manager'))

const displayVenues = computed(() =>
  bookingStore.venues.filter(v => v.Type !== 'rehearsal_room')
)

const dateRange = computed(() => {
  const base = dayjs(currentMonth.value)
  if (viewMode.value === 'day') {
    return [base.startOf('day'), base.endOf('day')]
  } else if (viewMode.value === 'week') {
    return [base.startOf('week'), base.endOf('week')]
  } else {
    return [base.startOf('month'), base.endOf('month')]
  }
})

const dateColumns = computed(() => {
  const [start, end] = dateRange.value
  const cols: { date: string; key: string; isToday: boolean; isWeekend: boolean }[] = []
  let cur = start
  while (cur.isBefore(end) || cur.isSame(end, 'day')) {
    cols.push({
      date: cur.format('YYYY-MM-DD'),
      key: cur.format('YYYY-MM-DD'),
      isToday: cur.isSame(dayjs(), 'day'),
      isWeekend: cur.day() === 0 || cur.day() === 6
    })
    cur = cur.add(1, 'day')
  }
  return cols
})

const totalWidth = computed(() => dateColumns.value.length * columnWidth.value)

const filteredBookings = computed(() => {
  return bookingStore.filteredBookings.filter(b => {
    if (selectedStatuses.value.length > 0 && !selectedStatuses.value.includes(b.Status)) {
      return false
    }
    const bStart = dayjs(b.StartTime)
    const bEnd = dayjs(b.EndTime)
    const [rangeStart, rangeEnd] = dateRange.value
    return !(bEnd.isBefore(rangeStart) || bStart.isAfter(rangeEnd))
  })
})

const mobileGroupedBookings = computed(() => {
  const groups: { date: string; bookings: Booking[] }[] = []
  for (const col of dateColumns.value) {
    const dayBookings = filteredBookings.value.filter(b => {
      return dayjs(b.StartTime).isSame(dayjs(col.date), 'day')
    }).sort((a, b) => dayjs(a.StartTime).valueOf() - dayjs(b.StartTime).valueOf())
    groups.push({ date: col.date, bookings: dayBookings })
  }
  return groups
})

const dragShadowStyle = computed(() => ({
  left: dragShadow.x + 'px',
  top: dragShadow.y + 'px',
  width: dragShadow.width + 'px',
  height: dragShadow.height + 'px'
}))

const getVenueBookings = (venueId: number) => {
  return filteredBookings.value.filter(b => b.VenueID === venueId)
}

const getBookingStyle = (booking: Booking, venueId: number) => {
  const [rangeStart] = dateRange.value
  const start = dayjs(booking.StartTime)
  const end = dayjs(booking.EndTime)
  const colStart = Math.max(0, start.startOf('day').diff(rangeStart.startOf('day'), 'day'))
  const colEnd = end.startOf('day').diff(rangeStart.startOf('day'), 'day')

  const dayDurationMinutes = 24 * 60
  const startMinutes = start.hour() * 60 + start.minute()
  const endMinutes = end.hour() * 60 + end.minute()

  const left = colStart * columnWidth.value + (startMinutes / dayDurationMinutes) * columnWidth.value
  const width = Math.max(
    40,
    (colEnd - colStart) * columnWidth.value + ((endMinutes - startMinutes) / dayDurationMinutes) * columnWidth.value - 4
  )

  return {
    left: left + 'px',
    width: width + 'px',
    top: '8px',
    height: rowHeight.value - 16 + 'px'
  }
}

const venueTypeText = (t: VenueType) => {
  const map: Record<VenueType, string> = {
    theater: '剧场',
    concert_hall: '音乐厅',
    experimental_theater: '实验剧场',
    rehearsal_room: '排练厅'
  }
  return map[t] || t
}

const statusText = (s: BookingStatus) => {
  const map: Record<BookingStatus, string> = {
    pending: '待审批',
    confirmed: '已确认',
    conflict: '冲突',
    maintenance: '维护中',
    cancelled: '已取消'
  }
  return map[s] || s
}

const statusTagType = (s: BookingStatus) => {
  const map: Record<BookingStatus, 'info' | 'success' | 'danger' | 'warning'> = {
    pending: 'info',
    confirmed: 'success',
    conflict: 'danger',
    maintenance: 'warning',
    cancelled: 'info'
  }
  return map[s]
}

const isToday = (d: string) => dayjs(d).isSame(dayjs(), 'day')

const handleMonthChange = (val: string) => {
  if (val) {
    bookingStore.setMonth(dayjs(val))
  }
}

const handleVenueChange = (ids: number[]) => {
  bookingStore.selectedVenueIds.splice(0, bookingStore.selectedVenueIds.length, ...ids)
}

const handleScroll = () => {
  if (ganttHeaderRef.value && ganttScrollRef.value) {
    ganttHeaderRef.value.scrollLeft = ganttScrollRef.value.scrollLeft
  }
}

const handleGridClick = (e: MouseEvent) => {
  if (!canCreate.value) return
  const target = e.target as HTMLElement
  const cell = target.closest('.gantt-cell') as HTMLElement
  if (cell) {
    const venueId = Number(cell.dataset.venueId)
    const date = cell.dataset.date
    editBooking.value = null
    dialogVisible.value = true
    setTimeout(() => {
      if (venueId && date) {
        const defaultStart = dayjs(date).hour(9).minute(0).second(0)
        const defaultEnd = dayjs(date).hour(18).minute(0).second(0)
        const dialog = dialogVisible.value
        if (dialog) {
          editBooking.value = null
        }
      }
    }, 50)
  }
}

const handleDragStart = (e: DragEvent, booking: Booking) => {
  if (!canDrag.value) {
    e.preventDefault()
    return
  }
  dragBooking.value = booking
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  dragShadow.show = true
  dragShadow.width = rect.width
  dragShadow.height = rect.height
  dragShadow.x = e.clientX - rect.width / 2
  dragShadow.y = e.clientY - rect.height / 2

  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(booking.ID))
    e.dataTransfer.setDragImage(new Image(), 0, 0)
  }

  document.addEventListener('dragover', handleDragOverDoc)
}

const handleDragOverDoc = (e: DragEvent) => {
  e.preventDefault()
  dragShadow.x = e.clientX - dragShadow.width / 2
  dragShadow.y = e.clientY - dragShadow.height / 2
}

const handleDragEnd = async (e: DragEvent) => {
  document.removeEventListener('dragover', handleDragOverDoc)
  if (!dragBooking.value || !ganttScrollRef.value) {
    dragBooking.value = null
    dragShadow.show = false
    return
  }

  const scrollEl = ganttScrollRef.value
  const rect = scrollEl.getBoundingClientRect()
  const x = e.clientX - rect.left + scrollEl.scrollLeft
  const y = e.clientY - rect.top + scrollEl.scrollTop

  const headerHeight = 60
  const venueColWidth = 160

  const venueIdx = Math.floor((y - headerHeight) / rowHeight.value)
  const dayIdx = Math.floor((x - venueColWidth) / columnWidth.value)

  dragShadow.show = false

  if (venueIdx < 0 || venueIdx >= displayVenues.value.length || dayIdx < 0 || dayIdx >= dateColumns.value.length) {
    dragBooking.value = null
    return
  }

  const targetVenue = displayVenues.value[venueIdx]
  const targetDate = dateColumns.value[dayIdx].date
  const originalBooking = dragBooking.value

  const origStart = dayjs(originalBooking.StartTime)
  const origEnd = dayjs(originalBooking.EndTime)
  const durationMinutes = origEnd.diff(origStart, 'minute')

  const oldDayStart = origStart.startOf('day')
  const offsetMinutes = origStart.diff(oldDayStart, 'minute')

  const newStart = dayjs(targetDate).add(offsetMinutes, 'minute')
  const newEnd = newStart.add(durationMinutes, 'minute')

  try {
    await bookingStore.updateBooking(originalBooking.ID, {
      VenueID: targetVenue.ID,
      StartTime: newStart.format('YYYY-MM-DDTHH:mm:ss'),
      EndTime: newEnd.format('YYYY-MM-DDTHH:mm:ss')
    })
    ElMessage.success('档期已更新')
    refreshData()
  } catch (err: any) {
    if (err?.conflicts || err?.response?.status === 409) {
      ElMessageBox.alert('该时间段存在档期冲突，无法移动到此位置。', '移动失败', { type: 'warning' })
    } else {
      ElMessage.error('更新失败')
    }
  } finally {
    dragBooking.value = null
  }
}

const openCreateDialog = () => {
  editBooking.value = null
  dialogVisible.value = true
}

const openBookingDetail = (id: number) => {
  detailBookingId.value = id
  drawerVisible.value = true
}

const handleEditBooking = (booking: Booking) => {
  editBooking.value = booking
  drawerVisible.value = false
  dialogVisible.value = true
}

const handleDialogSuccess = () => {
  refreshData()
}

const refreshData = async () => {
  await bookingStore.fetchBookings()
}

onMounted(async () => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  await Promise.all([bookingStore.fetchVenues(), bookingStore.fetchBookings()])
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', checkMobile)
  document.removeEventListener('dragover', handleDragOverDoc)
})

watch(
  () => bookingStore.selectedVenueIds,
  (ids) => {
    selectedVenueIds.value = [...ids]
  },
  { deep: true }
)
</script>

<style scoped lang="scss">
.schedule-board {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #ebeef5;
  gap: 16px;
  flex-wrap: wrap;

  .toolbar-left,
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }

  .venue-filter {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
}

.gantt-container {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
}

.gantt-scroll {
  width: 100%;
  height: 100%;
  overflow: auto;
}

.gantt-wrapper {
  position: relative;
  min-width: 100%;
}

.gantt-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  background: #f5f7fa;
  border-bottom: 1px solid #ebeef5;
  overflow: hidden;

  .gantt-corner {
    flex-shrink: 0;
    width: 160px;
    padding: 12px 16px;
    font-weight: 600;
    color: #303133;
    border-right: 1px solid #ebeef5;
    background: #f5f7fa;
    position: sticky;
    left: 0;
    z-index: 11;
  }

  .gantt-dates {
    display: flex;
    flex-shrink: 0;

    .gantt-date-col {
      flex-shrink: 0;
      padding: 8px 4px;
      text-align: center;
      border-right: 1px solid #ebeef5;
      box-sizing: border-box;

      &.is-today {
        background: #ecf5ff;
      }

      &.is-weekend {
        background: #fafafa;
      }

      .date-day {
        font-size: 16px;
        font-weight: 600;
        color: #303133;
      }

      .date-week {
        font-size: 12px;
        color: #909399;
      }
    }
  }
}

.gantt-body {
  display: flex;
  position: relative;
}

.gantt-venue-col {
  flex-shrink: 0;
  width: 160px;
  background: #fff;
  position: sticky;
  left: 0;
  z-index: 5;
  border-right: 1px solid #ebeef5;

  .venue-row {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 8px 12px;
    border-bottom: 1px solid #ebeef5;
    box-sizing: border-box;
    gap: 4px;

    .venue-name {
      font-weight: 500;
      color: #303133;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .venue-type {
      :deep(.el-tag) {
        transform: scale(0.85);
        transform-origin: left center;
      }
    }
  }
}

.gantt-grid {
  flex-shrink: 0;
  position: relative;
  background-image:
    linear-gradient(to right, transparent calc(100% - 1px), #ebeef5 calc(100% - 1px)),
    linear-gradient(to bottom, transparent calc(100% - 1px), #ebeef5 calc(100% - 1px));
  background-size: var(--col-w, 120px) var(--row-h, 80px);

  .gantt-row {
    position: relative;
    display: flex;
    border-bottom: 1px solid #ebeef5;
    box-sizing: border-box;
  }

  .gantt-cell {
    flex-shrink: 0;
    border-right: 1px solid #ebeef5;
    box-sizing: border-box;
    cursor: pointer;
    transition: background-color 0.2s;

    &.is-weekend {
      background: #fafafa;
    }

    &:hover {
      background: rgba(64, 158, 255, 0.06);
    }
  }
}

.booking-bar {
  position: absolute;
  border-radius: 4px;
  padding: 4px 8px;
  box-sizing: border-box;
  overflow: hidden;
  cursor: pointer;
  user-select: none;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  background: var(--gantt-confirmed);
  color: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    z-index: 2;
  }

  &.status-pending {
    background: var(--gantt-pending);
  }

  &.status-confirmed {
    background: var(--gantt-confirmed);
  }

  &.status-conflict {
    background: var(--gantt-conflict);
  }

  &.status-maintenance {
    background: var(--gantt-maintenance);
  }

  &.status-cancelled {
    background: #c0c4cc;
    text-decoration: line-through;
    opacity: 0.7;
  }

  .booking-bar-inner {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;

    .booking-title {
      font-size: 13px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .booking-time {
      font-size: 11px;
      opacity: 0.9;
    }
  }
}

.tooltip-content {
  min-width: 200px;

  .tooltip-title {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 8px;
    color: #303133;
  }

  .tooltip-row {
    font-size: 12px;
    color: #606266;
    line-height: 1.8;

    span {
      color: #909399;
    }
  }
}

.drag-shadow {
  position: fixed;
  z-index: 9999;
  border-radius: 4px;
  padding: 4px 8px;
  background: var(--gantt-confirmed);
  color: #fff;
  opacity: 0.7;
  pointer-events: none;
  font-size: 13px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  transform: translate3d(0, 0, 0);
  transition: opacity 0.1s;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;

  &.status-pending { background: var(--gantt-pending); }
  &.status-confirmed { background: var(--gantt-confirmed); }
  &.status-conflict { background: var(--gantt-conflict); }
  &.status-maintenance { background: var(--gantt-maintenance); }
}

.mobile-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;

  .mobile-day-group {
    margin-bottom: 16px;

    .mobile-day-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      font-weight: 600;
      color: #303133;
      border-bottom: 1px solid #ebeef5;
      margin-bottom: 8px;

      .day-date {
        font-size: 15px;
      }

      .day-week {
        font-size: 13px;
        color: #909399;
      }
    }

    .mobile-booking-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .mobile-booking-card {
      display: flex;
      gap: 12px;
      padding: 12px;
      border-radius: 6px;
      background: #fff;
      border-left: 4px solid var(--gantt-confirmed);
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);

      &.status-pending { border-left-color: var(--gantt-pending); }
      &.status-confirmed { border-left-color: var(--gantt-confirmed); }
      &.status-conflict { border-left-color: var(--gantt-conflict); }
      &.status-maintenance { border-left-color: var(--gantt-maintenance); }

      .mobile-booking-time {
        flex-shrink: 0;
        width: 80px;
        font-size: 13px;
        color: #606266;
        font-weight: 500;
      }

      .mobile-booking-info {
        flex: 1;
        min-width: 0;

        .mobile-booking-title {
          font-size: 14px;
          font-weight: 500;
          color: #303133;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 4px;
        }

        .mobile-booking-venue {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #909399;
        }
      }
    }
  }
}

@media (max-width: 768px) {
  .toolbar {
    .toolbar-left,
    .toolbar-right {
      width: 100%;
    }

    .venue-filter {
      width: 100%;
    }
  }
}
</style>
