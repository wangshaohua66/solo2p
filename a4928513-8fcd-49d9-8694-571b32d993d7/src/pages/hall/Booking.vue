<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Setting,
  Refresh,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Plus,
  Edit,
  Delete,
  Close,
  InfoFilled,
  Warning
} from '@element-plus/icons-vue'
import { mockHalls, mockBookings } from '@/mock/halls'
import { dayjs, getWeekRange, isTimeOverlap } from '@/utils/date'
import type { FarewellHall, Booking, BookingStatus } from '@/types/hall'

const funeralHomes = [
  { id: 'fh1', name: '第一殡仪馆' },
  { id: 'fh2', name: '第二殡仪馆' },
  { id: 'fh3', name: '第三殡仪馆' }
]

const statusConfig: Record<BookingStatus, { label: string; color: string; bg: string; border: string }> = {
  pending: { label: '待确认', color: '#FA8C16', bg: 'rgba(250, 140, 22, 0.15)', border: '#FA8C16' },
  confirmed: { label: '已确认', color: '#1890FF', bg: 'rgba(24, 144, 255, 0.15)', border: '#1890FF' },
  completed: { label: '已完成', color: '#52C41A', bg: 'rgba(82, 196, 26, 0.15)', border: '#52C41A' },
  cancelled: { label: '已取消', color: '#8C8C8C', bg: 'rgba(140, 140, 140, 0.15)', border: '#8C8C8C' }
}

const HOUR_START = 7
const HOUR_END = 20
const SLOT_HEIGHT = 40
const HEADER_HEIGHT = 60
const HALL_HEADER_WIDTH = 160

const currentFuneralHome = ref('fh1')
const currentWeekStart = ref(getWeekRange().start)
const bookings = ref<Booking[]>([...mockBookings])
const selectedBooking = ref<Booking | null>(null)
const detailVisible = ref(false)
const quickPanelVisible = ref(true)
const hoveredBooking = ref<Booking | null>(null)
const hoverPosition = ref({ x: 0, y: 0 })

const dragState = reactive({
  isDragging: false,
  booking: null as Booking | null,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  offsetX: 0,
  offsetY: 0,
  originalHallId: '',
  originalDate: ''
})

const quickForm = reactive({
  hallId: '',
  date: dayjs().format('YYYY-MM-DD'),
  startTime: '09:00',
  duration: 90,
  remainsName: '',
  ritualistName: '',
  remark: ''
})

const weekData = computed(() => getWeekRange(currentWeekStart.value))

const filteredHalls = computed(() => {
  return mockHalls.filter(h => h.funeralHomeId === currentFuneralHome.value)
})

const hoursList = computed(() => {
  const hours: number[] = []
  for (let h = HOUR_START; h <= HOUR_END; h++) {
    hours.push(h)
  }
  return hours
})

const totalGridHeight = computed(() => (HOUR_END - HOUR_START) * SLOT_HEIGHT)

const bookingsWithConflict = computed(() => {
  const result = bookings.value.map(b => ({ ...b, conflict: false }))
  for (let i = 0; i < result.length; i++) {
    for (let j = i + 1; j < result.length; j++) {
      const a = result[i]
      const b = result[j]
      if (a.hallId === b.hallId && a.date === b.date && a.status !== 'cancelled' && b.status !== 'cancelled') {
        if (isTimeOverlap(a.startTime, a.endTime, b.startTime, b.endTime)) {
          a.conflict = true
          b.conflict = true
        }
      }
    }
  }
  return result
})

const timeToMinutes = (t: string): number => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

const getBookingStyle = (booking: Booking & { conflict?: boolean }) => {
  const startMin = timeToMinutes(booking.startTime)
  const endMin = timeToMinutes(booking.endTime)
  const top = ((startMin - HOUR_START * 60) / 60) * SLOT_HEIGHT
  const height = ((endMin - startMin) / 60) * SLOT_HEIGHT - 2
  const status = statusConfig[booking.status]
  return {
    top: `${top}px`,
    height: `${height}px`,
    left: '2px',
    right: '2px',
    background: status.bg,
    borderLeft: `3px solid ${status.color}`,
    border: booking.conflict ? '2px solid #FF4D4F' : undefined,
    boxShadow: booking.conflict ? '0 0 8px rgba(255, 77, 79, 0.4)' : undefined
  }
}

const getBookingsForCell = (hallId: string, date: string) => {
  return bookingsWithConflict.value.filter(
    b => b.hallId === hallId && b.date === date && b.status !== 'cancelled'
  )
}

const goPrevWeek = () => {
  currentWeekStart.value = dayjs(currentWeekStart.value).subtract(7, 'day').format('YYYY-MM-DD')
}

const goNextWeek = () => {
  currentWeekStart.value = dayjs(currentWeekStart.value).add(7, 'day').format('YYYY-MM-DD')
}

const goToday = () => {
  currentWeekStart.value = getWeekRange().start
}

const switchFuneralHome = (id: string) => {
  currentFuneralHome.value = id
}

const getDayLabel = (date: string) => {
  const d = dayjs(date)
  const weekMap = ['日', '一', '二', '三', '四', '五', '六']
  return {
    week: `周${weekMap[d.day()]}`,
    date: d.format('MM/DD'),
    isToday: d.isSame(dayjs(), 'day')
  }
}

const formatEndTime = (startTime: string, duration: number) => {
  const [h, m] = startTime.split(':').map(Number)
  const totalMin = h * 60 + m + duration
  return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`
}

const openDetail = (booking: Booking) => {
  if (dragState.isDragging) return
  selectedBooking.value = { ...booking }
  detailVisible.value = true
}

const closeDetail = () => {
  detailVisible.value = false
  selectedBooking.value = null
}

const updateBooking = () => {
  if (!selectedBooking.value) return
  const idx = bookings.value.findIndex(b => b.id === selectedBooking.value!.id)
  if (idx > -1) {
    bookings.value[idx] = { ...selectedBooking.value }
    ElMessage.success('预约信息已更新')
    closeDetail()
  }
}

const cancelBooking = async () => {
  if (!selectedBooking.value) return
  try {
    await ElMessageBox.confirm('确定要取消此预约吗？此操作不可恢复。', '取消确认', {
      type: 'warning'
    })
    const idx = bookings.value.findIndex(b => b.id === selectedBooking.value!.id)
    if (idx > -1) {
      bookings.value[idx] = { ...bookings.value[idx], status: 'cancelled' as BookingStatus }
      ElMessage.success('预约已取消')
      closeDetail()
    }
  } catch {}
}

const checkConflictForTime = (hallId: string, date: string, startTime: string, endTime: string, excludeId?: string): boolean => {
  return bookings.value.some(b => {
    if (b.id === excludeId) return false
    if (b.status === 'cancelled') return false
    return b.hallId === hallId && b.date === date && isTimeOverlap(startTime, endTime, b.startTime, b.endTime)
  })
}

const submitQuickBooking = () => {
  if (!quickForm.hallId) {
    ElMessage.warning('请选择告别厅')
    return
  }
  if (!quickForm.remainsName) {
    ElMessage.warning('请填写逝者信息')
    return
  }
  const endTime = formatEndTime(quickForm.startTime, quickForm.duration)
  const hall = mockHalls.find(h => h.id === quickForm.hallId)!
  if (checkConflictForTime(quickForm.hallId, quickForm.date, quickForm.startTime, endTime)) {
    ElMessage.error('该时间段存在预约冲突，请重新选择')
    return
  }
  const newBooking: Booking = {
    id: `BK${dayjs(quickForm.date).format('MMDD')}${String(bookings.value.length + 1).padStart(3, '0')}`,
    hallId: quickForm.hallId,
    hallName: hall.name,
    funeralHomeId: hall.funeralHomeId,
    remainsId: `R${dayjs().format('YYYYMMDD')}${String(3000 + bookings.value.length).padStart(4, '0')}`,
    remainsName: quickForm.remainsName,
    date: quickForm.date,
    startTime: quickForm.startTime,
    endTime,
    duration: quickForm.duration,
    ritualistName: quickForm.ritualistName || undefined,
    services: [],
    totalFee: Math.ceil(hall.basePrice * (quickForm.duration / 60)),
    status: 'pending',
    createTime: dayjs().format('YYYY-MM-DD HH:mm'),
    remark: quickForm.remark
  }
  bookings.value.push(newBooking)
  ElMessage.success('预约创建成功')
  quickForm.remainsName = ''
  quickForm.ritualistName = ''
  quickForm.remark = ''
}

const handleMouseEnter = (e: MouseEvent, booking: Booking) => {
  if (dragState.isDragging) return
  hoveredBooking.value = booking
  updateHoverPosition(e)
}

const handleMouseMove = (e: MouseEvent) => {
  updateHoverPosition(e)
  if (dragState.isDragging && dragState.booking) {
    dragState.currentX = e.clientX
    dragState.currentY = e.clientY
  }
}

const updateHoverPosition = (e: MouseEvent) => {
  hoverPosition.value = { x: e.clientX + 12, y: e.clientY + 12 }
}

const handleMouseLeave = () => {
  hoveredBooking.value = null
}

const startDrag = (e: MouseEvent, booking: Booking) => {
  if (booking.status === 'completed' || booking.status === 'cancelled') return
  e.preventDefault()
  dragState.isDragging = true
  dragState.booking = booking
  dragState.startX = e.clientX
  dragState.startY = e.clientY
  dragState.currentX = e.clientX
  dragState.currentY = e.clientY
  dragState.offsetX = 0
  dragState.offsetY = 0
  dragState.originalHallId = booking.hallId
  dragState.originalDate = booking.date
  document.addEventListener('mousemove', onDocumentMouseMove)
  document.addEventListener('mouseup', onDocumentMouseUp)
}

const onDocumentMouseMove = (e: MouseEvent) => {
  if (!dragState.isDragging) return
  dragState.offsetX = e.clientX - dragState.startX
  dragState.offsetY = e.clientY - dragState.startY
  dragState.currentX = e.clientX
  dragState.currentY = e.clientY
}

const getDragTarget = (): { hallId: string; date: string; newStartTime: string } | null => {
  const calendarEl = document.querySelector('.calendar-grid') as HTMLElement
  if (!calendarEl || !dragState.booking) return null
  const rect = calendarEl.getBoundingClientRect()
  const relX = dragState.currentX - rect.left - HALL_HEADER_WIDTH
  const relY = dragState.currentY - rect.top - HEADER_HEIGHT
  if (relX < 0 || relY < 0) return null
  const dayIdx = Math.floor(relX / ((rect.width - HALL_HEADER_WIDTH) / 7))
  if (dayIdx < 0 || dayIdx > 6) return null
  const date = weekData.value.days[dayIdx]
  const halls = filteredHalls.value
  const hallIdx = Math.floor(relY / (totalGridHeight.value))
  if (hallIdx < 0 || hallIdx >= halls.length) return null
  const hall = halls[hallIdx]
  const rowY = relY - hallIdx * totalGridHeight.value
  const minutesFromStart = (rowY / SLOT_HEIGHT) * 60
  const snappedMinutes = Math.round(minutesFromStart / 30) * 30
  const totalMin = HOUR_START * 60 + Math.max(0, Math.min((HOUR_END - HOUR_START) * 60 - dragState.booking.duration, snappedMinutes))
  const newH = Math.floor(totalMin / 60)
  const newM = totalMin % 60
  const newStartTime = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`
  return { hallId: hall.id, date, newStartTime }
}

const onDocumentMouseUp = () => {
  if (!dragState.isDragging || !dragState.booking) {
    resetDragState()
    return
  }
  const target = getDragTarget()
  if (target) {
    const b = dragState.booking
    const newEndTime = formatEndTime(target.newStartTime, b.duration)
    if (!checkConflictForTime(target.hallId, target.date, target.newStartTime, newEndTime, b.id)) {
      const idx = bookings.value.findIndex(x => x.id === b.id)
      if (idx > -1) {
        const hall = mockHalls.find(h => h.id === target.hallId)!
        bookings.value[idx] = {
          ...bookings.value[idx],
          hallId: target.hallId,
          hallName: hall.name,
          funeralHomeId: hall.funeralHomeId,
          date: target.date,
          startTime: target.newStartTime,
          endTime: newEndTime
        }
        ElMessage.success('预约已调整')
      }
    } else {
      ElMessage.error('存在时间冲突，无法移动')
    }
  }
  resetDragState()
}

const resetDragState = () => {
  dragState.isDragging = false
  dragState.booking = null
  dragState.startX = 0
  dragState.startY = 0
  dragState.currentX = 0
  dragState.currentY = 0
  dragState.offsetX = 0
  dragState.offsetY = 0
  document.removeEventListener('mousemove', onDocumentMouseMove)
  document.removeEventListener('mouseup', onDocumentMouseUp)
}

const getDragPreviewStyle = () => {
  if (!dragState.booking || !dragState.isDragging) return {}
  return {
    position: 'fixed' as const,
    left: `${dragState.currentX - 60}px`,
    top: `${dragState.currentY - 20}px`,
    width: '160px',
    pointerEvents: 'none' as const,
    zIndex: 3000,
    opacity: 0.8
  }
}

const getHallDurationOptions = () => [
  { label: '60分钟', value: 60 },
  { label: '90分钟', value: 90 },
  { label: '120分钟', value: 120 },
  { label: '180分钟', value: 180 }
]

onMounted(() => {
  if (filteredHalls.value.length > 0) {
    quickForm.hallId = filteredHalls.value[0].id
  }
})

onUnmounted(() => {
  resetDragState()
})

watch(currentFuneralHome, () => {
  if (filteredHalls.value.length > 0) {
    quickForm.hallId = filteredHalls.value[0].id
  }
})
</script>

<template>
  <div class="booking-page page-container">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title text-gold-gradient">告别厅智能预约</h2>
        <span class="page-subtitle">周视图 · 智能排期 · 冲突检测</span>
      </div>
      <div class="header-right">
        <el-button type="primary" size="large" :icon="Plus" class="btn-gold" @click="quickPanelVisible = true">
          新增预约
        </el-button>
      </div>
    </div>

    <div class="toolbar card-base">
      <div class="toolbar-section">
        <el-tabs v-model="currentFuneralHome" class="fh-tabs" @tab-change="switchFuneralHome">
          <el-tab-pane v-for="fh in funeralHomes" :key="fh.id" :label="fh.name" :name="fh.id" />
        </el-tabs>
      </div>
      <div class="toolbar-divider"></div>
      <div class="toolbar-section week-controls">
        <el-button :icon="ArrowLeft" circle size="small" @click="goPrevWeek" />
        <span class="week-range">
          {{ weekData.start }} ~ {{ weekData.end }}
        </span>
        <el-button :icon="ArrowRight" circle size="small" @click="goNextWeek" />
        <el-button :icon="Calendar" size="small" class="ml-2" @click="goToday">今日</el-button>
        <el-button :icon="Refresh" circle size="small" class="ml-2" />
      </div>
      <div class="toolbar-section legend">
        <span class="legend-item"><i class="dot pending"></i>待确认</span>
        <span class="legend-item"><i class="dot confirmed"></i>已确认</span>
        <span class="legend-item"><i class="dot completed"></i>已完成</span>
        <span class="legend-item"><i class="dot conflict"></i>冲突</span>
      </div>
    </div>

    <div class="main-content">
      <div class="calendar-wrapper card-base scrollbar-thin" @mousemove="handleMouseMove" @mouseleave="handleMouseLeave">
        <div class="calendar-grid">
          <div class="grid-header" :style="{ height: HEADER_HEIGHT + 'px' }">
            <div class="corner-cell" :style="{ width: HALL_HEADER_WIDTH + 'px' }">
              <span>告别厅 / 时间</span>
            </div>
            <div class="hours-row">
              <div class="hours-inner">
                <div
                  v-for="h in hoursList"
                  :key="h"
                  class="hour-cell"
                  :style="{ width: `calc(100% / 7 * 1 / ${HOUR_END - HOUR_START})` }"
                >
                  {{ String(h).padStart(2, '0') }}:00
                </div>
              </div>
            </div>
            <div class="days-row">
              <div
                v-for="(d, idx) in weekData.days"
                :key="d"
                class="day-cell"
                :class="{ today: getDayLabel(d).isToday }"
              >
                <div class="day-week">{{ getDayLabel(d).week }}</div>
                <div class="day-date">{{ getDayLabel(d).date }}</div>
              </div>
            </div>
          </div>

          <div class="grid-body">
            <div
              v-for="(hall, hIdx) in filteredHalls"
              :key="hall.id"
              class="hall-row"
              :style="{ height: totalGridHeight + 'px' }"
            >
              <div class="hall-header" :style="{ width: HALL_HEADER_WIDTH + 'px' }">
                <div class="hall-name">{{ hall.name }}</div>
                <div class="hall-meta">
                  <span>容{{ hall.capacity }}人</span>
                  <span class="meta-divider">|</span>
                  <span>{{ hall.area }}㎡</span>
                </div>
                <div v-if="hall.status === 'maintenance'" class="hall-status maintenance">
                  维护中
                </div>
              </div>

              <div class="hall-cells">
                <div
                  v-for="(d, dIdx) in weekData.days"
                  :key="d"
                  class="hall-cell"
                  :class="{ 'today-col': getDayLabel(d).isToday }"
                >
                  <div class="cell-hours">
                    <div
                      v-for="h in (HOUR_END - HOUR_START)"
                      :key="h"
                      class="cell-hour-slot"
                      :style="{ height: SLOT_HEIGHT + 'px' }"
                    ></div>
                  </div>
                  <div class="bookings-layer">
                    <div
                      v-for="booking in getBookingsForCell(hall.id, d)"
                      :key="booking.id"
                      class="booking-block"
                      :class="{
                        dragging: dragState.booking?.id === booking.id,
                        'cannot-drag': booking.status === 'completed' || booking.status === 'cancelled'
                      }"
                      :style="getBookingStyle(booking)"
                      @click="openDetail(booking)"
                      @mouseenter="handleMouseEnter($event, booking)"
                      @mousedown="startDrag($event, booking)"
                    >
                      <div class="booking-time">{{ booking.startTime }}-{{ booking.endTime }}</div>
                      <div class="booking-name" :title="booking.remainsName">{{ booking.remainsName }}</div>
                      <div class="booking-status">
                        <el-tag size="small" :color="statusConfig[booking.status].bg" :style="{ color: statusConfig[booking.status].color, border: 'none', padding: '0 4px' }">
                          {{ statusConfig[booking.status].label }}
                        </el-tag>
                      </div>
                      <div v-if="booking.conflict" class="conflict-badge">
                        <el-icon><Warning /></el-icon>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="quickPanelVisible" class="quick-panel card-base">
        <div class="panel-header">
          <span class="panel-title">快捷预约</span>
          <el-button :icon="Close" text circle size="small" @click="quickPanelVisible = false" />
        </div>
        <div class="panel-body">
          <div class="form-item">
            <label>选择告别厅</label>
            <el-select v-model="quickForm.hallId" size="default" placeholder="请选择">
              <el-option
                v-for="h in filteredHalls"
                :key="h.id"
                :label="h.name + ' (' + h.capacity + '人)'"
                :value="h.id"
                :disabled="h.status === 'maintenance'"
              />
            </el-select>
          </div>
          <div class="form-item">
            <label>选择日期</label>
            <el-date-picker
              v-model="quickForm.date"
              type="date"
              size="default"
              placeholder="选择日期"
              value-format="YYYY-MM-DD"
              style="width: 100%"
            />
          </div>
          <div class="form-row">
            <div class="form-item flex-1">
              <label>开始时间</label>
              <el-time-select
                v-model="quickForm.startTime"
                :start="'07:00'"
                :step="'00:30'"
                :end="'19:30'"
                size="default"
                placeholder="选择时间"
                style="width: 100%"
              />
            </div>
            <div class="form-item flex-1">
              <label>时长(分钟)</label>
              <el-select v-model="quickForm.duration" size="default" placeholder="选择">
                <el-option v-for="opt in getHallDurationOptions()" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </div>
          </div>
          <div class="form-item">
            <label>逝者/告别会名称</label>
            <el-input v-model="quickForm.remainsName" size="default" placeholder="请输入" />
          </div>
          <div class="form-item">
            <label>礼仪师</label>
            <el-input v-model="quickForm.ritualistName" size="default" placeholder="选填" />
          </div>
          <div class="form-item">
            <label>备注</label>
            <el-input v-model="quickForm.remark" type="textarea" :rows="3" placeholder="选填" />
          </div>
        </div>
        <div class="panel-footer">
          <el-button size="large" style="flex: 1" @click="quickPanelVisible = false">取消</el-button>
          <el-button size="large" type="primary" class="btn-gold" style="flex: 1" @click="submitQuickBooking">
            提交预约
          </el-button>
        </div>
      </div>
    </div>

    <div
      v-if="hoveredBooking && !dragState.isDragging"
      class="hover-preview card-base"
      :style="{ left: hoverPosition.x + 'px', top: hoverPosition.y + 'px' }"
    >
      <div class="preview-header">
        <span class="preview-title">{{ hoveredBooking.remainsName }}</span>
        <el-tag size="small" :color="statusConfig[hoveredBooking.status].bg" :style="{ color: statusConfig[hoveredBooking.status].color, border: 'none' }">
          {{ statusConfig[hoveredBooking.status].label }}
        </el-tag>
      </div>
      <div class="preview-row">
        <span class="label">告别厅：</span>
        <span class="value">{{ hoveredBooking.hallName }}</span>
      </div>
      <div class="preview-row">
        <span class="label">日期：</span>
        <span class="value">{{ hoveredBooking.date }}</span>
      </div>
      <div class="preview-row">
        <span class="label">时间：</span>
        <span class="value">{{ hoveredBooking.startTime }} - {{ hoveredBooking.endTime }} ({{ hoveredBooking.duration }}分钟)</span>
      </div>
      <div v-if="hoveredBooking.ritualistName" class="preview-row">
        <span class="label">礼仪师：</span>
        <span class="value">{{ hoveredBooking.ritualistName }}</span>
      </div>
      <div class="preview-row">
        <span class="label">费用：</span>
        <span class="value">¥{{ hoveredBooking.totalFee }}</span>
      </div>
      <div v-if="hoveredBooking.conflict" class="preview-conflict">
        <el-icon><Warning /></el-icon>
        存在时间冲突
      </div>
    </div>

    <div v-if="dragState.isDragging && dragState.booking" class="drag-preview card-base" :style="getDragPreviewStyle()">
      <div class="drag-time">{{ dragState.booking.startTime }} - {{ dragState.booking.endTime }}</div>
      <div class="drag-name">{{ dragState.booking.remainsName }}</div>
      <div class="drag-hall">{{ dragState.booking.hallName }}</div>
    </div>

    <el-dialog
      v-model="detailVisible"
      :title="'预约详情 - ' + (selectedBooking?.id || '')"
      width="520px"
      class="booking-detail-dialog"
      destroy-on-close
    >
      <div v-if="selectedBooking" class="detail-content">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="状态">
            <el-tag :color="statusConfig[selectedBooking.status].bg" :style="{ color: statusConfig[selectedBooking.status].color, border: 'none' }">
              {{ statusConfig[selectedBooking.status].label }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="费用">¥{{ selectedBooking.totalFee }}</el-descriptions-item>
          <el-descriptions-item label="告别厅">{{ selectedBooking.hallName }}</el-descriptions-item>
          <el-descriptions-item label="殡仪馆">{{ funeralHomes.find(f => f.id === selectedBooking.funeralHomeId)?.name }}</el-descriptions-item>
          <el-descriptions-item label="日期" :span="2">
            <el-date-picker v-model="selectedBooking.date" type="date" size="small" value-format="YYYY-MM-DD" style="width: 100%" />
          </el-descriptions-item>
          <el-descriptions-item label="开始时间">
            <el-time-select v-model="selectedBooking.startTime" :start="'07:00'" :step="'00:30'" :end="'19:30'" size="small" style="width: 100%" />
          </el-descriptions-item>
          <el-descriptions-item label="结束时间">{{ selectedBooking.endTime }}</el-descriptions-item>
          <el-descriptions-item label="逝者/告别会名称" :span="2">
            <el-input v-model="selectedBooking.remainsName" size="small" />
          </el-descriptions-item>
          <el-descriptions-item label="礼仪师" :span="2">
            <el-input v-model="selectedBooking.ritualistName" size="small" placeholder="选填" />
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ selectedBooking.createTime }}</el-descriptions-item>
          <el-descriptions-item label="确认时间">{{ selectedBooking.confirmTime || '未确认' }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">
            <el-input v-model="selectedBooking.remark" type="textarea" :rows="2" size="small" placeholder="选填" />
          </el-descriptions-item>
        </el-descriptions>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="closeDetail">关闭</el-button>
          <el-button v-if="selectedBooking?.status !== 'completed' && selectedBooking?.status !== 'cancelled'" type="danger" @click="cancelBooking" :icon="Delete">
            取消预约
          </el-button>
          <el-button type="primary" class="btn-gold" @click="updateBooking" :icon="Edit">
            保存修改
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
@import '@/assets/styles/theme.scss';

.booking-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 100%;

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .header-left {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .page-title {
      font-size: 24px;
      font-weight: 700;
      margin: 0;
    }

    .page-subtitle {
      font-size: 13px;
      color: $color-funeral-text-muted;
    }

    .btn-gold {
      @include gold-gradient;
      border: none;
      font-weight: 600;

      &:hover {
        opacity: 0.9;
      }
    }
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 20px;
    flex-wrap: wrap;

    .toolbar-section {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .toolbar-divider {
      width: 1px;
      height: 32px;
      background: $color-funeral-border;
    }

    .fh-tabs {
      :deep(.el-tabs__item) {
        color: $color-funeral-text-secondary;
        height: 36px;
        line-height: 36px;
      }
      :deep(.el-tabs__item.is-active) {
        color: $color-funeral-gold;
        font-weight: 600;
      }
      :deep(.el-tabs__active-bar) {
        background: $color-funeral-gold;
      }
      :deep(.el-tabs__nav-wrap::after) {
        background: $color-funeral-border;
      }
    }

    .week-controls {
      .week-range {
        font-size: 14px;
        color: $color-funeral-text-primary;
        font-weight: 500;
        min-width: 220px;
        text-align: center;
      }
    }

    .legend {
      margin-left: auto;

      .legend-item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: $color-funeral-text-secondary;
        margin-left: 16px;

        .dot {
          width: 10px;
          height: 10px;
          border-radius: 2px;

          &.pending { background: #FA8C16; }
          &.confirmed { background: #1890FF; }
          &.completed { background: #52C41A; }
          &.conflict { background: #FF4D4F; }
        }
      }
    }
  }

  .main-content {
    display: flex;
    gap: 16px;
    flex: 1;
    min-height: 0;
  }

  .calendar-wrapper {
    flex: 1;
    overflow: auto;
    padding: 0;

    .calendar-grid {
      min-width: 100%;
      position: relative;
    }

    .grid-header {
      position: sticky;
      top: 0;
      z-index: 10;
      background: $color-funeral-card;
      border-bottom: 1px solid $color-funeral-border;
      display: grid;
      grid-template-columns: 160px 1fr;
      grid-template-rows: 1fr 1fr;

      .corner-cell {
        grid-row: span 2;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        color: $color-funeral-text-muted;
        border-right: 1px solid $color-funeral-border;
        background: $color-funeral-dark;
      }

      .hours-row {
        border-bottom: 1px solid $color-funeral-border;
        overflow: hidden;

        .hours-inner {
          display: flex;
          width: 100%;

          .hour-cell {
            font-size: 11px;
            color: $color-funeral-text-muted;
            text-align: center;
            padding: 6px 0;
            border-right: 1px solid $color-funeral-border;
            min-width: 30px;
          }
        }
      }

      .days-row {
        display: grid;
        grid-template-columns: repeat(7, 1fr);

        .day-cell {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4px 0;
          border-right: 1px solid $color-funeral-border;

          &.today {
            background: rgba(201, 168, 108, 0.1);

            .day-date {
              color: $color-funeral-gold;
              font-weight: 600;
            }
          }

          .day-week {
            font-size: 11px;
            color: $color-funeral-text-muted;
          }

          .day-date {
            font-size: 14px;
            color: $color-funeral-text-primary;
          }
        }
      }
    }

    .grid-body {
      .hall-row {
        display: grid;
        grid-template-columns: 160px 1fr;
        border-bottom: 1px solid $color-funeral-border;

        .hall-header {
          padding: 12px;
          border-right: 1px solid $color-funeral-border;
          background: $color-funeral-dark;
          display: flex;
          flex-direction: column;
          gap: 4px;
          align-items: flex-start;
          justify-content: flex-start;

          .hall-name {
            font-size: 13px;
            font-weight: 600;
            color: $color-funeral-text-primary;
          }

          .hall-meta {
            font-size: 11px;
            color: $color-funeral-text-muted;

            .meta-divider {
              margin: 0 4px;
            }
          }

          .hall-status {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 2px;
            margin-top: 4px;

            &.maintenance {
              background: rgba(250, 140, 22, 0.2);
              color: #FA8C16;
            }
          }
        }

        .hall-cells {
          display: grid;
          grid-template-columns: repeat(7, 1fr);

          .hall-cell {
            position: relative;
            border-right: 1px solid $color-funeral-border;
            overflow: hidden;

            &.today-col {
              background: rgba(201, 168, 108, 0.03);
            }

            .cell-hours {
              position: absolute;
              inset: 0;

              .cell-hour-slot {
                border-bottom: 1px dashed rgba(58, 58, 68, 0.5);
              }
            }

            .bookings-layer {
              position: absolute;
              inset: 0;
            }

            .booking-block {
              position: absolute;
              border-radius: 4px;
              padding: 4px 6px;
              overflow: hidden;
              cursor: grab;
              transition: transform 0.15s ease, box-shadow 0.15s ease;
              backdrop-filter: blur(4px);

              &:hover {
                transform: scale(1.01);
                z-index: 5;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
              }

              &:active {
                cursor: grabbing;
              }

              &.dragging {
                opacity: 0.4;
              }

              &.cannot-drag {
                cursor: pointer;
              }

              .booking-time {
                font-size: 10px;
                color: $color-funeral-text-secondary;
                font-weight: 600;
              }

              .booking-name {
                font-size: 12px;
                color: $color-funeral-text-primary;
                font-weight: 500;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                margin-top: 2px;
              }

              .booking-status {
                margin-top: 2px;
              }

              .conflict-badge {
                position: absolute;
                top: 2px;
                right: 2px;
                color: #FF4D4F;
                font-size: 12px;
              }
            }
          }
        }
      }
    }
  }

  .quick-panel {
    width: 300px;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid $color-funeral-border;

      .panel-title {
        font-size: 15px;
        font-weight: 600;
        color: $color-funeral-gold;
      }
    }

    .panel-body {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      flex: 1;
      overflow-y: auto;
      @include scrollbar-custom;
    }

    .form-row {
      display: flex;
      gap: 10px;

      .flex-1 {
        flex: 1;
      }
    }

    .form-item {
      display: flex;
      flex-direction: column;
      gap: 6px;

      label {
        font-size: 12px;
        color: $color-funeral-text-secondary;
        font-weight: 500;
      }
    }

    .panel-footer {
      display: flex;
      gap: 8px;
      padding: 12px 16px;
      border-top: 1px solid $color-funeral-border;

      .btn-gold {
        @include gold-gradient;
        border: none;
      }
    }
  }

  .hover-preview {
    position: fixed;
    width: 240px;
    padding: 12px;
    z-index: 2000;
    pointer-events: none;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);

    .preview-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px solid $color-funeral-border;

      .preview-title {
        font-size: 14px;
        font-weight: 600;
        color: $color-funeral-text-primary;
      }
    }

    .preview-row {
      font-size: 12px;
      margin-bottom: 4px;
      display: flex;

      .label {
        color: $color-funeral-text-muted;
        min-width: 60px;
      }

      .value {
        color: $color-funeral-text-primary;
      }
    }

    .preview-conflict {
      margin-top: 8px;
      padding: 6px 8px;
      background: rgba(255, 77, 79, 0.1);
      border-radius: 4px;
      font-size: 12px;
      color: #FF4D4F;
      display: flex;
      align-items: center;
      gap: 4px;
    }
  }

  .drag-preview {
    padding: 8px 10px;

    .drag-time {
      font-size: 11px;
      color: $color-funeral-gold;
      font-weight: 600;
    }
    .drag-name {
      font-size: 12px;
      color: $color-funeral-text-primary;
      margin-top: 2px;
    }
    .drag-hall {
      font-size: 10px;
      color: $color-funeral-text-muted;
      margin-top: 2px;
    }
  }

  .booking-detail-dialog {
    :deep(.el-dialog__header) {
      border-bottom: 1px solid $color-funeral-border;
      margin-right: 0;
      padding: 16px 20px;
    }
    :deep(.el-dialog__title) {
      color: $color-funeral-gold;
    }
    :deep(.el-dialog__body) {
      padding: 20px;
    }
    :deep(.el-dialog__footer) {
      border-top: 1px solid $color-funeral-border;
      padding: 12px 20px;
    }
    :deep(.el-descriptions__label) {
      background: $color-funeral-dark;
      color: $color-funeral-text-secondary;
      border-color: $color-funeral-border;
    }
    :deep(.el-descriptions__body .el-descriptions__table .el-descriptions__cell) {
      border-color: $color-funeral-border;
    }
    :deep(.el-descriptions__content) {
      color: $color-funeral-text-primary;
    }

    .btn-gold {
      @include gold-gradient;
      border: none;
    }
  }
}

@media (max-width: 1200px) {
  .booking-page {
    .main-content {
      flex-direction: column;
    }
    .quick-panel {
      width: 100%;
    }
  }
}
</style>
