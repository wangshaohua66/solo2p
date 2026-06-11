<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, ArrowLeft, ArrowRight, Monitor, Calendar } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import type { Kiln, KilnSchedule, FiringType } from '@/types'
import { kilnApi } from '@/api/kiln'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { use } from 'echarts/core'

use([
  LineChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  CanvasRenderer
])

const router = useRouter()

const viewMode = ref<'day' | 'week'>('week')
const currentDate = ref(dayjs())
const showAddDialog = ref(false)
const isMobile = ref(false)
const selectedScheduleId = ref<string | null>(null)
const tempChartRef = ref<HTMLElement>()
const loading = ref(false)
const isDragging = ref(false)
const dragScheduleId = ref<string | null>(null)
const dragStartY = ref(0)
const dragStartTop = ref(0)
const dragSchedule = ref<KilnSchedule | null>(null)
let tempChart: echarts.ECharts | null = null

const kilns = ref<Kiln[]>([])
const schedules = ref<KilnSchedule[]>([])

const generateTempCurve = (schedule: KilnSchedule) => {
  const start = dayjs(schedule.startTime)
  const end = dayjs(schedule.endTime)
  const durationHours = end.diff(start, 'hour')
  const points: { time: string; temp: number }[] = []
  const maxTemp = schedule.firingType === 'bisque' ? 1000 : 
                  schedule.firingType === 'glaze' ? 1250 : 1280
  
  const totalPoints = 20
  for (let i = 0; i <= totalPoints; i++) {
    const ratio = i / totalPoints
    const time = start.add(ratio * durationHours, 'hour')
    let temp: number
    
    if (ratio < 0.15) {
      temp = Math.round(20 + (maxTemp * 0.4) * (ratio / 0.15))
    } else if (ratio < 0.5) {
      temp = Math.round(maxTemp * 0.4 + maxTemp * 0.55 * ((ratio - 0.15) / 0.35))
    } else if (ratio < 0.65) {
      temp = maxTemp
    } else if (ratio < 0.85) {
      temp = Math.round(maxTemp * (1 - (ratio - 0.65) / 0.2 * 0.4))
    } else {
      temp = Math.round(maxTemp * 0.6 * (1 - (ratio - 0.85) / 0.15))
    }
    
    points.push({
      time: time.format('HH:mm'),
      temp
    })
  }
  
  return points
}

const initTempChart = () => {
  if (!tempChartRef.value) return
  
  tempChart = echarts.init(tempChartRef.value)
  
  const defaultSchedule = schedules.value[0]
  if (defaultSchedule) {
    updateTempChart(defaultSchedule)
  }
  
  window.addEventListener('resize', handleResize)
}

const updateTempChart = (schedule: KilnSchedule) => {
  if (!tempChart) return
  
  const points = generateTempCurve(schedule)
  
  const option: echarts.EChartsOption = {
    title: {
      text: `${schedule.title} - 温度曲线`,
      left: 'center',
      textStyle: { fontSize: 14, fontWeight: 'normal' }
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const data = params[0]
        return `${data.name}<br/>温度: ${data.value}℃`
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: points.map(p => p.time),
      axisLabel: { fontSize: 10 }
    },
    yAxis: {
      type: 'value',
      name: '温度(℃)',
      nameTextStyle: { fontSize: 10 },
      axisLabel: { fontSize: 10 }
    },
    series: [
      {
        name: '温度',
        type: 'line',
        smooth: true,
        data: points.map(p => p.temp),
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(200, 90, 50, 0.3)' },
            { offset: 1, color: 'rgba(200, 90, 50, 0.05)' }
          ])
        },
        lineStyle: {
          color: '#c85a32',
          width: 2
        },
        itemStyle: { color: '#c85a32' }
      }
    ]
  }
  
  tempChart.setOption(option)
}

const handleResize = () => {
  tempChart?.resize()
  checkMobile()
}

const checkMobile = () => {
  isMobile.value = window.innerWidth < 768
  if (isMobile.value) {
    viewMode.value = 'day'
  }
}

const fetchKilns = async () => {
  try {
    kilns.value = await kilnApi.getKilns()
  } catch (e) {
    console.error('Failed to fetch kilns:', e)
  }
}

const fetchSchedules = async () => {
  loading.value = true
  try {
    const start = currentDate.value.startOf(viewMode.value === 'week' ? 'week' : 'day').toISOString()
    const end = currentDate.value.endOf(viewMode.value === 'week' ? 'week' : 'day').toISOString()
    schedules.value = await kilnApi.getSchedules({ startDate: start, endDate: end })
  } catch (e) {
    console.error('Failed to fetch schedules:', e)
  } finally {
    loading.value = false
  }
}

const loadData = async () => {
  await Promise.all([fetchKilns(), fetchSchedules()])
  nextTick(() => {
    if (tempChartRef.value && schedules.value.length > 0) {
      initTempChart()
    }
  })
}

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

const mobileScheduleList = computed(() => {
  const start = currentDate.value.startOf(viewMode.value === 'week' ? 'week' : 'day')
  const end = currentDate.value.endOf(viewMode.value === 'week' ? 'week' : 'day')
  
  const list = schedules.value
    .filter(s => {
      const sStart = dayjs(s.startTime)
      const sEnd = dayjs(s.endTime)
      return sEnd.isAfter(start) && sStart.isBefore(end)
    })
    .sort((a, b) => dayjs(a.startTime).valueOf() - dayjs(b.startTime).valueOf())
  
  return list
})

const getStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    pending: '待烧制',
    running: '烧制中',
    completed: '已完成',
    cancelled: '已取消'
  }
  return map[status] || status
}

const getStatusType = (status: string) => {
  const map: Record<string, string> = {
    pending: 'info',
    running: 'warning',
    completed: 'success',
    cancelled: 'danger'
  }
  return map[status] || 'info'
}

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

watch([currentDate, viewMode], () => {
  fetchSchedules()
})

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

const checkForConflicts = async () => {
  try {
    const result = await kilnApi.checkConflict(
      newSchedule.value.kilnId,
      dayjs(newSchedule.value.startTime).toISOString(),
      dayjs(newSchedule.value.endTime).toISOString()
    )
    return result
  } catch {
    return { hasConflict: false, conflictingSchedules: [] }
  }
}

const handleSubmitSchedule = async () => {
  if (!newSchedule.value.title) {
    ElMessage.warning('请输入排程标题')
    return
  }

  const start = dayjs(newSchedule.value.startTime)
  const end = dayjs(newSchedule.value.endTime)
  if (end.isBefore(start) || end.isSame(start)) {
    ElMessage.warning('结束时间必须晚于开始时间')
    return
  }

  try {
    const conflict = await checkForConflicts()
    if (conflict && conflict.hasConflict && conflict.conflictingSchedules?.length > 0) {
      try {
        await ElMessageBox.confirm(
          `检测到与 ${conflict.conflictingSchedules.length} 个排程存在时间冲突，是否强制覆盖？`,
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

    await kilnApi.createSchedule({
      kilnId: newSchedule.value.kilnId,
      title: newSchedule.value.title,
      firingType: newSchedule.value.firingType,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      notes: newSchedule.value.notes
    })

    showAddDialog.value = false
    ElMessage.success('排程创建成功')
    await fetchSchedules()
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || '创建排程失败')
  }
}

const handleScheduleClick = (schedule: KilnSchedule) => {
  if (isDragging.value) return
  selectedScheduleId.value = schedule.id
  if (tempChart) {
    updateTempChart(schedule)
  }
}

const handleScheduleMouseDown = (e: MouseEvent, schedule: KilnSchedule) => {
  if (e.button !== 0) return
  if (schedule.status === 'running' || schedule.status === 'completed') {
    ElMessage.warning('已开始或完成的排程无法拖拽')
    return
  }
  
  isDragging.value = true
  dragScheduleId.value = schedule.id
  dragSchedule.value = schedule
  dragStartY.value = e.clientY
  const blockEl = e.currentTarget as HTMLElement
  dragStartTop.value = parseFloat(blockEl.style.top) || 0
  
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  e.preventDefault()
}

const handleMouseMove = (e: MouseEvent) => {
  if (!isDragging.value || !dragScheduleId.value) return
  
  const scheduleBlock = document.querySelector<HTMLElement>(
    `[data-schedule-id="${dragScheduleId.value}"]`
  )
  if (!scheduleBlock) return
  
  const parentArea = scheduleBlock.parentElement
  if (!parentArea) return
  
  const rect = parentArea.getBoundingClientRect()
  const y = e.clientY - rect.top
  const percentage = Math.max(0, Math.min(1, y / rect.height))
  const top = percentage * 100
  scheduleBlock.style.top = `${top}%`
  scheduleBlock.style.zIndex = '100'
  scheduleBlock.style.opacity = '0.85'
  scheduleBlock.style.transform = 'scale(1.02)'
  scheduleBlock.style.cursor = 'grabbing'
}

const handleMouseUp = async (e: MouseEvent) => {
  if (!isDragging.value || !dragScheduleId.value || !dragSchedule.value) {
    resetDragState()
    return
  }
  
  const scheduleBlock = document.querySelector<HTMLElement>(
    `[data-schedule-id="${dragScheduleId.value}"]`
  )
  
  if (scheduleBlock) {
    const parentArea = scheduleBlock.parentElement
    const dayColumn = parentArea?.parentElement
    const kilnColumn = dayColumn?.parentElement?.parentElement
    
    if (parentArea && dayColumn) {
      const rect = parentArea.getBoundingClientRect()
      const y = e.clientY - rect.top
      const percentage = Math.max(0, Math.min(1, y / rect.height))
      const hour = 6 + percentage * 18
      const startHour = Math.floor(hour)
      const startMinute = Math.round((hour - startHour) * 60 / 15) * 15
      
      const dayAttr = dayColumn.getAttribute('data-day')
      const kilnAttr = kilnColumn?.getAttribute('data-kiln-id')
      
      if (dayAttr && kilnAttr) {
        const targetDay = dayjs(dayAttr)
        const schedule = schedules.value.find(s => s.id === dragScheduleId.value)
        if (schedule) {
          const origStart = dayjs(schedule.startTime)
          const origEnd = dayjs(schedule.endTime)
          const duration = origEnd.diff(origStart, 'minute')
          
          const newStart = targetDay.hour(startHour).minute(startMinute).second(0)
          const newEnd = newStart.add(duration, 'minute')
          const newKilnId = kilnAttr
          
          try {
            const conflict = await kilnApi.checkConflict(
              newKilnId, newStart.toISOString(), newEnd.toISOString(), schedule.id
            )
            if (conflict.hasConflict && conflict.conflictingSchedules?.length > 0) {
              conflictScheduleId.value = schedule.id
              ElMessage.warning('存在时间冲突，排程已恢复原位')
              setTimeout(() => {
                conflictScheduleId.value = null
              }, 1500)
              resetDragState()
              return
            }
            
            const newKiln = kilns.value.find(k => k.id === newKilnId)
            await kilnApi.updateSchedule(schedule.id, {
              kilnId: newKilnId,
              kilnName: newKiln?.name,
              startTime: newStart.toISOString(),
              endTime: newEnd.toISOString()
            })
            
            ElMessage.success('排程已更新')
            await fetchSchedules()
          } catch (error: any) {
            ElMessage.error(error?.response?.data?.message || '更新排程失败')
          }
        }
      }
    }
  }
  
  resetDragState()
}

const resetDragState = () => {
  isDragging.value = false
  dragScheduleId.value = null
  dragSchedule.value = null
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
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
  window.addEventListener('resize', handleResize)
  loadData()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  resetDragState()
  tempChart?.dispose()
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

    <div class="schedule-container" v-if="!isMobile">
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
          :data-kiln-id="kiln.id"
        >
          <div class="kiln-header">
            <div class="kiln-name" :style="{ color: getKilnTypeColor(kiln.type) }">
              <el-icon><Monitor /></el-icon>
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
              :data-day="day.format('YYYY-MM-DD')"
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
                  :data-schedule-id="schedule.id"
                  :class="{ 
                    'is-running': schedule.status === 'running',
                    'is-conflict': schedule.id === conflictScheduleId
                  }"
                  :style="schedule.style!"
                  @mousedown="(e) => handleScheduleMouseDown(e, schedule)"
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

    <div class="mobile-timeline" v-else>
      <div class="timeline-title">{{ viewMode === 'week' ? '本周' : '今日' }}排程</div>
      <div v-if="mobileScheduleList.length === 0" class="empty-state">
        <el-empty description="暂无排程" />
      </div>
      <div v-else class="timeline-list">
        <div 
          v-for="schedule in mobileScheduleList" 
          :key="schedule.id"
          class="timeline-item"
          :class="{ active: schedule.id === selectedScheduleId }"
          @click="handleScheduleClick(schedule)"
        >
          <div class="timeline-time">
            <div class="time-start">{{ dayjs(schedule.startTime).format('HH:mm') }}</div>
            <div class="time-line"></div>
            <div class="time-end">{{ dayjs(schedule.endTime).format('HH:mm') }}</div>
          </div>
          <div class="timeline-content">
            <div class="timeline-header">
              <span 
                class="firing-type-tag" 
                :style="{ backgroundColor: getFiringTypeColor(schedule.firingType) }"
              >
                {{ getFiringTypeLabel(schedule.firingType) }}
              </span>
              <el-tag size="small" :type="getStatusType(schedule.status)" effect="plain">
                {{ getStatusLabel(schedule.status) }}
              </el-tag>
            </div>
            <div class="timeline-title-text">{{ schedule.title }}</div>
            <div class="timeline-meta">
              <el-icon class="meta-icon"><Monitor /></el-icon>
              <span>{{ schedule.kilnName }}</span>
              <span class="meta-divider">·</span>
              <el-icon class="meta-icon"><Calendar /></el-icon>
              <span>{{ dayjs(schedule.startTime).format('MM-DD') }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="chart-section">
      <div class="section-header">
        <h3 class="section-title">
          <el-icon class="section-icon"><Monitor /></el-icon>
          烧制温度曲线
        </h3>
        <p class="section-desc">点击上方排程查看详细温度曲线</p>
      </div>
      <div ref="tempChartRef" class="temp-chart"></div>
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

.chart-section {
  margin-top: 24px;
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.section-header {
  margin-bottom: 16px;
  
  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: #1d2129;
    margin: 0;
    
    .section-icon {
      color: #c85a32;
      font-size: 18px;
    }
  }
  
  .section-desc {
    font-size: 12px;
    color: #86909c;
    margin: 4px 0 0 0;
  }
}

.temp-chart {
  width: 100%;
  height: 300px;
}

@media (max-width: 768px) {
  .chart-section {
    padding: 16px;
    margin-top: 16px;
  }
  
  .temp-chart {
    height: 220px;
  }
}

.mobile-timeline {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  
  .timeline-title {
    font-size: 16px;
    font-weight: 600;
    color: #1d2129;
    margin-bottom: 16px;
  }
  
  .empty-state {
    padding: 40px 0;
  }
  
  .timeline-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .timeline-item {
    display: flex;
    gap: 12px;
    padding: 12px;
    background: #f7f8fa;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    border-left: 3px solid transparent;
    
    &:hover {
      background: #f2f3f5;
    }
    
    &.active {
      background: #fff7e6;
      border-left-color: #c85a32;
    }
  }
  
  .timeline-time {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 50px;
    flex-shrink: 0;
    
    .time-start {
      font-size: 13px;
      font-weight: 600;
      color: #1d2129;
    }
    
    .time-line {
      flex: 1;
      width: 2px;
      background: #e5e6eb;
      margin: 4px 0;
    }
    
    .time-end {
      font-size: 12px;
      color: #86909c;
    }
  }
  
  .timeline-content {
    flex: 1;
    min-width: 0;
    
    .timeline-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }
    
    .firing-type-tag {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      color: #fff;
      font-size: 11px;
      font-weight: 500;
    }
    
    .timeline-title-text {
      font-size: 14px;
      font-weight: 500;
      color: #1d2129;
      margin-bottom: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .timeline-meta {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #86909c;
      
      .meta-icon {
        font-size: 12px;
      }
      
      .meta-divider {
        color: #e5e6eb;
      }
    }
  }
}
</style>
