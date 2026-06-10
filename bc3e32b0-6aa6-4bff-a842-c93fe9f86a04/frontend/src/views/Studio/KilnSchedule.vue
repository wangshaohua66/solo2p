<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import type { Kiln, KilnSchedule, FiringType } from '@/types'

const router = useRouter()

const viewMode = ref<'day' | 'week'>('week')
const currentDate = ref(dayjs())
const showAddDialog = ref(false)
const isMobile = ref(false)

const checkMobile = () => {
  isMobile.value = window.innerWidth < 768
  if (isMobile.value) {
    viewMode.value = 'day'
  }
}

const kilns = ref<Kiln[]>([
  { id: '1', name: '电窑A', type: 'electric', capacity: 50, status: 'available', maxTemperature: 1280 },
  { id: '2', name: '汽窑B', type: 'gas', capacity: 80, status: 'running', maxTemperature: 1300 },
  { id: '3', name: '柴窑', type: 'wood', capacity: 120, status: 'available', maxTemperature: 1350 }
])

const schedules = ref<KilnSchedule[]>([
  {
    id: '1', kilnId: '1', kilnName: '电窑A', title: '素烧 - 第24期课程作品',
    firingType: 'bisque', startTime: dayjs().hour(9).minute(0).second(0).toISOString(),
    endTime: dayjs().hour(17).minute(0).second(0).toISOString(),
    status: 'running', createdBy: 'admin'
  },
  {
    id: '2', kilnId: '1', kilnName: '电窑A', title: '釉烧 - 会员作品批量',
    firingType: 'glaze', startTime: dayjs().add(1, 'day').hour(8).minute(0).toISOString(),
    endTime: dayjs().add(1, 'day').hour(20).minute(0).toISOString(),
    status: 'pending', createdBy: 'admin'
  },
  {
    id: '3', kilnId: '2', kilnName: '汽窑B', title: '釉烧 - 中级班作品',
    firingType: 'glaze', startTime: dayjs().add(2, 'day').hour(10).minute(0).toISOString(),
    endTime: dayjs().add(2, 'day').hour(22).minute(0).toISOString(),
    status: 'pending', createdBy: 'teacher'
  },
  {
    id: '4', kilnId: '3', kilnName: '柴窑', title: '还原焰 - 大师班',
    firingType: 'reduction', startTime: dayjs().add(5, 'day').hour(10).minute(0).toISOString(),
    endTime: dayjs().add(6, 'day').hour(18).minute(0).toISOString(),
    status: 'pending', createdBy: 'admin'
  }
])

const newSchedule = ref({
  kilnId: '',
  title: '',
  firingType: 'bisque' as FiringType,
  startTime: '',
  endTime: '',
  notes: ''
})

const conflictScheduleId = ref<string | null>(null)

const weekDays = computed(() => {
  const start = currentDate.value.startOf(viewMode.value === 'week' ? 'week' : 'day')
  const days = []
  const count = viewMode.value === 'week' ? 7 : 1
  for (let i = 0; i < count; i++) {
    days.push(start.add(i, 'day'))
  }
  return days
})

const timeSlots = computed(() => {
  const slots = []
  for (let h = 6; h <= 24; h++) {
    slots.push({ hour: h, label: `${h.toString().padStart(2, '0')}:00` })
  }
  return slots
})

const getFiringTypeLabel = (type: FiringType) => {
  const map: Record<FiringType, string> = {
    bisque: '素烧',
    glaze: '釉烧',
    reduction: '还原焰'
  }
  return map[type] || type
}

const getFiringTypeColor = (type: FiringType) => {
  const map: Record<FiringType, string> = {
    bisque: '#8c8c8c',
    glaze: '#c85a32',
    reduction: '#722ed1'
  }
  return map[type] || '#999'
}

const getKilnTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    electric: '电窑',
    gas: '汽窑',
    wood: '柴窑'
  }
  return map[type] || type
}

const getKilnTypeColor = (type: string) => {
  const map: Record<string, string> = {
    electric: '#5b8ff9',
    gas: '#f6bd16',
    wood: '#c85a32'
  }
  return map[type] || '#999'
}

const getScheduleStyle = (schedule: KilnSchedule, day: dayjs.Dayjs) => {
  const start = dayjs(schedule.startTime)
  const end = dayjs(schedule.endTime)
  const dayStart = day.startOf('day')
  const dayEnd = day.endOf('day')

  if (end.isBefore(dayStart) || start.isAfter(dayEnd)) {
    return null
  }

  const displayStart = start.isBefore(dayStart) ? dayStart : start
  const displayEnd = end.isAfter(dayEnd) ? dayEnd : end

  const startMinutes = displayStart.hour() * 60 + displayStart.minute()
  const duration = displayEnd.diff(displayStart, 'minute')
  const totalMinutes = 18 * 60
  const top = ((startMinutes - 6 * 60) / totalMinutes) * 100
  const height = (duration / totalMinutes) * 100

  return {
    top: `${top}%`,
    height: `${Math.max(height, 4)}%`,
    backgroundColor: getFiringTypeColor(schedule.firingType),
    isConflict: schedule.isConflict
  }
}

const getSchedulesForKilnAndDay = (kilnId: string, day: dayjs.Dayjs) => {
  return schedules.value.filter(s => s.kilnId === kilnId).map(s => {
    const style = getScheduleStyle(s, day)
    return { ...s, style }
  }).filter(s => s.style !== null)
}

const prevPeriod = () => {
  currentDate.value = currentDate.value.subtract(1, viewMode.value === 'week' ? 'week' : 'day')
}

const nextPeriod = () => {
  currentDate.value = currentDate.value.add(1, viewMode.value === 'week' ? 'week' : 'day')
}

const goToday = () => {
  currentDate.value = dayjs()
}

const handleAddSchedule = () => {
  newSchedule.value = {
    kilnId: kilns.value[0]?.id || '',
    title: '',
    firingType: 'bisque',
    startTime: currentDate.value.hour(9).minute(0).format('YYYY-MM-DD HH:mm'),
    endTime: currentDate.value.hour(17).minute(0).format('YYYY-MM-DD HH:mm'),
    notes: ''
  }
  conflictScheduleId.value = null
  showAddDialog.value = true
}

const checkForConflicts = () => {
  const start = dayjs(newSchedule.value.startTime)
  const end = dayjs(newSchedule.value.endTime)
  
  if (end.isBefore(start) || end.isSame(start)) {
    ElMessage.warning('结束时间必须晚于开始时间')
    return null
  }

  const conflicts = schedules.value.filter(s => {
    if (s.kilnId !== newSchedule.value.kilnId) return false
    const sStart = dayjs(s.startTime)
    const sEnd = dayjs(s.endTime)
    return start.isBefore(sEnd) && end.isAfter(sStart)
  })

  return conflicts
}

const handleSubmitSchedule = async () => {
  if (!newSchedule.value.title) {
    ElMessage.warning('请输入排程标题')
    return
  }

  const conflicts = checkForConflicts()
  if (conflicts && conflicts.length > 0) {
    try {
      await ElMessageBox.confirm(
        `检测到与 ${conflicts.length} 个排程存在时间冲突，是否强制覆盖？`,
        '时间冲突',
        {
          confirmButtonText: '强制覆盖',
          cancelButtonText: '返回修改',
          type: 'warning',
          confirmButtonClass: 'el-button--danger'
        }
      )
    } catch {
      return
    }
  }

  const schedule: KilnSchedule = {
    id: Date.now().toString(),
    kilnId: newSchedule.value.kilnId,
    kilnName: kilns.value.find(k => k.id === newSchedule.value.kilnId)?.name,
    title: newSchedule.value.title,
    firingType: newSchedule.value.firingType,
    startTime: dayjs(newSchedule.value.startTime).toISOString(),
    endTime: dayjs(newSchedule.value.endTime).toISOString(),
    status: 'pending',
    createdBy: 'admin',
    isConflict: false
  }

  schedules.value.push(schedule)
  showAddDialog.value = false
  ElMessage.success('排程创建成功')
}

const handleScheduleClick = (schedule: KilnSchedule) => {
  ElMessage.info(`查看排程: ${schedule.title}`)
}

const handleScheduleDrag = (e: DragEvent, schedule: KilnSchedule) => {
  e.dataTransfer?.setData('scheduleId', schedule.id)
}

const handleDrop = (e: DragEvent, kilnId: string, day: dayjs.Dayjs) => {
  e.preventDefault()
  const scheduleId = e.dataTransfer?.getData('scheduleId')
  if (!scheduleId) return

  const rect = (e.target as HTMLElement).getBoundingClientRect()
  const y = e.clientY - rect.top
  const percentage = y / rect.height
  const hour = 6 + percentage * 18
  const startHour = Math.floor(hour)
  const startMinute = Math.round((hour - startHour) * 60 / 15) * 15

  const schedule = schedules.value.find(s => s.id === scheduleId)
  if (!schedule) return

  const start = dayjs(schedule.startTime)
  const end = dayjs(schedule.endTime)
  const duration = end.diff(start, 'minute')

  const newStart = day.hour(startHour).minute(startMinute).second(0)
  const newEnd = newStart.add(duration, 'minute')

  const conflicts = schedules.value.filter(s => {
    if (s.id === scheduleId) return false
    if (s.kilnId !== kilnId) return false
    const sStart = dayjs(s.startTime)
    const sEnd = dayjs(s.endTime)
    return newStart.isBefore(sEnd) && newEnd.isAfter(sStart)
  })

  if (conflicts.length > 0) {
    conflictScheduleId.value = scheduleId
    ElMessage.warning('存在时间冲突，请选择其他时段')
    setTimeout(() => {
      conflictScheduleId.value = null
    }, 1000)
    return
  }

  schedule.kilnId = kilnId
  schedule.kilnName = kilns.value.find(k => k.id === kilnId)?.name
  schedule.startTime = newStart.toISOString()
  schedule.endTime = newEnd.toISOString()
  
  ElMessage.success('排程已更新')
}

const formatDateRange = () => {
  if (viewMode.value === 'day') {
    return currentDate.value.format('YYYY年M月D日 dddd')
  }
  const start = currentDate.value.startOf('week')
  const end = currentDate.value.endOf('week')
  return `${start.format('M月D日')} - ${end.format('M月D日')}`
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})
</script>

<template>
  <div class="kiln-schedule-page">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">窑炉排程</h2>
        <div class="date-navigation">
          <el-button-group>
            <el-button :icon="ArrowLeft" @click="prevPeriod" />
            <el-button @click="goToday">今天</el-button>
            <el-button :icon="ArrowRight" @click="nextPeriod" />
          </el-button-group>
          <span class="current-date">{{ formatDateRange() }}</span>
        </div>
      </div>
      <div class="header-right">
        <el-radio-group v-model="viewMode" size="default">
          <el-radio-button value="day">日</el-radio-button>
          <el-radio-button value="week">周</el-radio-button>
        </el-radio-group>
        <el-button type="primary" :icon="Plus" @click="handleAddSchedule">
          新建排程
        </el-button>
      </div>
    </div>

    <div class="legend">
      <div class="legend-item">
        <span class="legend-color" style="background: #5b8ff9;"></span>
        <span>电窑</span>
      </div>
      <div class="legend-item">
        <span class="legend-color" style="background: #f6bd16;"></span>
        <span>汽窑</span>
      </div>
      <div class="legend-item">
        <span class="legend-color" style="background: #c85a32;"></span>
        <span>柴窑</span>
      </div>
      <div class="legend-divider"></div>
      <div class="legend-item">
        <span class="legend-color firing" style="background: #8c8c8c;"></span>
        <span>素烧</span>
      </div>
      <div class="legend-item">
        <span class="legend-color firing" style="background: #c85a32;"></span>
        <span>釉烧</span>
      </div>
      <div class="legend-item">
        <span class="legend-color firing" style="background: #722ed1;"></span>
        <span>还原焰</span>
      </div>
    </div>

    <div class="schedule-container">
      <div class="time-column">
        <div class="corner-cell"></div>
        <div class="time-slots">
          <div v-for="slot in timeSlots" :key="slot.hour" class="time-slot">
            {{ slot.label }}
          </div>
        </div>
      </div>

      <div class="kilns-columns">
        <div 
          v-for="kiln in kilns" 
          :key="kiln.id" 
          class="kiln-column"
        >
          <div class="kiln-header">
            <div class="kiln-name" :style="{ color: getKilnTypeColor(kiln.type) }">
              <el-icon><Flame /></el-icon>
              {{ kiln.name }}
            </div>
            <div class="kiln-info">
              <el-tag size="small" :type="kiln.status === 'available' ? 'success' : kiln.status === 'running' ? 'warning' : 'info'" effect="plain">
                {{ kiln.status === 'available' ? '可用' : kiln.status === 'running' ? '运行中' : '维护中' }}
              </el-tag>
              <span class="capacity">{{ kiln.capacity }}L</span>
            </div>
          </div>
          
          <div class="kiln-days">
            <div 
              v-for="day in weekDays" 
              :key="day.format('YYYY-MM-DD')"
              class="day-column"
              @dragover.prevent
              @drop="(e) => handleDrop(e, kiln.id, day)"
            >
              <div class="day-header">
                <div class="day-name">{{ day.format('ddd') }}</div>
                <div class="day-date" :class="{ today: day.isSame(dayjs(), 'day') }">
                  {{ day.format('D') }}
                </div>
              </div>
              <div class="schedule-area">
                <div 
                  v-for="schedule in getSchedulesForKilnAndDay(kiln.id, day)" 
                  :key="schedule.id"
                  class="schedule-block"
                  :class="{ 
                    'is-running': schedule.status === 'running',
                    'is-conflict': schedule.id === conflictScheduleId
                  }"
                  :style="schedule.style!"
                  draggable="true"
                  @dragstart="(e) => handleScheduleDrag(e, schedule)"
                  @click="handleScheduleClick(schedule)"
                >
                  <div class="schedule-title">{{ schedule.title }}</div>
                  <div class="schedule-time">
                    {{ dayjs(schedule.startTime).format('HH:mm') }} - {{ dayjs(schedule.endTime).format('HH:mm') }}
                  </div>
                  <div class="schedule-type">
                    {{ getFiringTypeLabel(schedule.firingType) }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <el-dialog 
      v-model="showAddDialog" 
      title="新建窑炉排程"
      width="500px"
    >
      <el-form label-width="100px">
        <el-form-item label="窑炉">
          <el-select v-model="newSchedule.kilnId" class="full-width">
            <el-option 
              v-for="k in kilns" 
              :key="k.id" 
              :label="k.name + ' (' + getKilnTypeLabel(k.type) + ')'" 
              :value="k.id" 
            />
          </el-select>
        </el-form-item>
        <el-form-item label="标题">
          <el-input v-model="newSchedule.title" placeholder="请输入排程标题" />
        </el-form-item>
        <el-form-item label="烧制类型">
          <el-radio-group v-model="newSchedule.firingType">
            <el-radio value="bisque">素烧</el-radio>
            <el-radio value="glaze">釉烧</el-radio>
            <el-radio value="reduction">还原焰</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="开始时间">
          <el-date-picker
            v-model="newSchedule.startTime"
            type="datetime"
            placeholder="选择开始时间"
            class="full-width"
            format="YYYY-MM-DD HH:mm"
            value-format="YYYY-MM-DD HH:mm"
          />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-date-picker
            v-model="newSchedule.endTime"
            type="datetime"
            placeholder="选择结束时间"
            class="full-width"
            format="YYYY-MM-DD HH:mm"
            value-format="YYYY-MM-DD HH:mm"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input 
            v-model="newSchedule.notes" 
            type="textarea" 
            :rows="3"
            placeholder="选填"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSubmitSchedule">创建排程</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.kiln-schedule-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: calc(100vh - #{$header-height} - 40px);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;

  @media (max-width: $breakpoint-mobile) {
    flex-direction: column;
    align-items: stretch;
  }
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: $color-text-primary;
}

.date-navigation {
  display: flex;
  align-items: center;
  gap: 12px;
}

.current-date {
  font-size: 15px;
  font-weight: 500;
  color: $color-text-primary;
  min-width: 180px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.legend {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: white;
  border-radius: $border-radius-md;
  margin-bottom: 16px;
  flex-wrap: wrap;
  box-shadow: $shadow-sm;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: $color-text-secondary;
}

.legend-color {
  width: 14px;
  height: 14px;
  border-radius: 3px;

  &.firing {
    border-radius: 50%;
  }
}

.legend-divider {
  width: 1px;
  height: 20px;
  background: $color-border;
}

.schedule-container {
  display: flex;
  flex: 1;
  background: white;
  border-radius: $border-radius-md;
  overflow: hidden;
  box-shadow: $shadow-sm;
  overflow-x: auto;
}

.time-column {
  flex-shrink: 0;
  width: 60px;
  border-right: 1px solid $color-border;
}

.corner-cell {
  height: 60px;
  border-bottom: 1px solid $color-border;
}

.time-slots {
  position: relative;
}

.time-slot {
  height: 50px;
  font-size: 12px;
  color: $color-text-placeholder;
  text-align: center;
  border-bottom: 1px solid $color-border;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 2px;
}

.kilns-columns {
  flex: 1;
  display: flex;
  min-width: 0;
}

.kiln-column {
  flex: 1;
  min-width: 200px;
  border-right: 1px solid $color-border;

  &:last-child {
    border-right: none;
  }
}

.kiln-header {
  height: 60px;
  border-bottom: 1px solid $color-border;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: $color-bg;
}

.kiln-name {
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}

.kiln-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.capacity {
  font-size: 12px;
  color: $color-text-placeholder;
}

.kiln-days {
  display: flex;
  height: calc(50px * 19);
}

.day-column {
  flex: 1;
  border-right: 1px solid $color-border;
  position: relative;

  &:last-child {
    border-right: none;
  }
}

.day-header {
  height: 50px;
  border-bottom: 1px solid $color-border;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: $color-bg;
}

.day-name {
  font-size: 12px;
  color: $color-text-secondary;
}

.day-date {
  font-size: 16px;
  font-weight: 600;
  color: $color-text-primary;

  &.today {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: $color-primary;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.schedule-area {
  position: relative;
  height: calc(50px * 18);
  background-image: linear-gradient(to bottom, $color-border 1px, transparent 1px);
  background-size: 100% 50px;
}

.schedule-block {
  position: absolute;
  left: 4px;
  right: 4px;
  border-radius: $border-radius-sm;
  padding: 6px 8px;
  color: white;
  font-size: 11px;
  cursor: pointer;
  overflow: hidden;
  transition: all $transition-fast;
  opacity: 0.9;

  &:hover {
    opacity: 1;
    transform: scale(1.02);
    z-index: 10;
    box-shadow: $shadow-md;
  }

  &.is-running {
    opacity: 1;
    animation: runningGlow 2s infinite;
  }

  &.is-conflict {
    animation: shake 0.5s ease-in-out;
    box-shadow: 0 0 0 3px $color-error;
  }
}

@keyframes runningGlow {
  0%, 100% { box-shadow: 0 0 5px rgba(82, 196, 26, 0.5); }
  50% { box-shadow: 0 0 15px rgba(82, 196, 26, 0.8); }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-3px); }
  40%, 80% { transform: translateX(3px); }
}

.schedule-title {
  font-weight: 600;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.schedule-time {
  font-size: 10px;
  opacity: 0.9;
  margin-bottom: 2px;
}

.schedule-type {
  font-size: 10px;
  opacity: 0.8;
}

.full-width {
  width: 100%;
}
</style>
