<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import type { Station, StudioBooking, StationType } from '@/types'
import { studioApi } from '@/api/studio'

const authStore = useAuthStore()

const currentWeek = ref(dayjs().startOf('week'))
const selectedStation = ref<string>('')
const showBookingDialog = ref(false)
const loading = ref(false)
const bookingForm = ref({
  stationId: '',
  date: '',
  startTime: '10:00',
  endTime: '12:00'
})

const stations = ref<Station[]>([])
const myBookings = ref<StudioBooking[]>([])
const weeklyBookings = ref<StudioBooking[]>([])

const fetchStations = async () => {
  try {
    stations.value = await studioApi.getStations()
  } catch (e) {
    console.error('Failed to fetch stations:', e)
  }
}

const fetchWeeklyBookings = async () => {
  try {
    const weekStart = currentWeek.value.startOf('week').format('YYYY-MM-DD')
    weeklyBookings.value = await studioApi.getWeeklyBookings(weekStart)
  } catch (e) {
    console.error('Failed to fetch weekly bookings:', e)
  }
}

const fetchMyBookings = async () => {
  try {
    myBookings.value = await studioApi.getMyBookings()
  } catch (e) {
    console.error('Failed to fetch my bookings:', e)
  }
}

const loadData = () => {
  Promise.all([fetchStations(), fetchWeeklyBookings(), fetchMyBookings()])
}

const weekDays = computed(() => {
  const days = []
  for (let i = 0; i < 7; i++) {
    days.push(currentWeek.value.add(i, 'day'))
  }
  return days
})

const filteredStations = computed(() => {
  if (!selectedStation.value) return stations.value
  return stations.value.filter(s => s.type === selectedStation.value)
})

const stationTypeOptions = [
  { value: '', label: '全部工位' },
  { value: 'wheel', label: '拉坯工位' },
  { value: 'table', label: '手捏桌' },
  { value: 'glaze', label: '施釉区' }
]

const getStationTypeLabel = (type: StationType) => {
  const map: Record<string, string> = {
    wheel: '拉坯',
    table: '手捏',
    glaze: '施釉'
  }
  return map[type] || type
}

const getStationStatusColor = (status: string) => {
  const map: Record<string, string> = {
    available: '#52c41a',
    occupied: '#faad14',
    maintenance: '#909399'
  }
  return map[status] || '#999'
}

const getStationStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    available: '可用',
    occupied: '使用中',
    maintenance: '维护中'
  }
  return map[status] || status
}

const prevWeek = () => {
  currentWeek.value = currentWeek.value.subtract(1, 'week')
}

const nextWeek = () => {
  currentWeek.value = currentWeek.value.add(1, 'week')
}

const handleBooking = (station: Station, day: dayjs.Dayjs) => {
  if (station.status !== 'available') {
    ElMessage.warning('该工位当前不可用')
    return
  }
  if (day.isBefore(dayjs(), 'day')) {
    ElMessage.warning('不能预约过去的日期')
    return
  }
  
  bookingForm.value = {
    stationId: station.id,
    date: day.format('YYYY-MM-DD'),
    startTime: '10:00',
    endTime: '12:00'
  }
  showBookingDialog.value = true
}

const confirmBooking = async () => {
  if (!bookingForm.value.stationId || !bookingForm.value.date) return
  
  try {
    loading.value = true
    await studioApi.createBooking({
      stationId: bookingForm.value.stationId,
      date: bookingForm.value.date,
      startTime: bookingForm.value.startTime,
      endTime: bookingForm.value.endTime
    })
    ElMessage.success('预约成功！请准时到达')
    showBookingDialog.value = false
    await Promise.all([fetchWeeklyBookings(), fetchMyBookings()])
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || '预约失败')
  } finally {
    loading.value = false
  }
}

const handleCheckIn = async (bookingId: string) => {
  try {
    loading.value = true
    await studioApi.checkIn(bookingId)
    ElMessage.success('签到成功，创作愉快！')
    await fetchMyBookings()
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || '签到失败')
  } finally {
    loading.value = false
  }
}

const handleCheckOut = async (bookingId: string) => {
  try {
    loading.value = true
    await studioApi.checkOut(bookingId)
    ElMessage.success('签退成功，获得创作积分！')
    await fetchMyBookings()
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || '签退失败')
  } finally {
    loading.value = false
  }
}

const handleCancelBooking = async (bookingId: string) => {
  try {
    await ElMessageBox.confirm('确定要取消此预约吗？', '取消预约', {
      type: 'warning',
      confirmButtonText: '确定取消',
      cancelButtonText: '再想想'
    })
    loading.value = true
    await studioApi.cancelBooking(bookingId)
    ElMessage.success('预约已取消')
    await Promise.all([fetchWeeklyBookings(), fetchMyBookings()])
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err?.response?.data?.message || '取消失败')
    }
  } finally {
    loading.value = false
  }
}

watch(currentWeek, () => {
  fetchWeeklyBookings()
  fetchMyBookings()
})

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="studio-booking-page">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">自由创作</h2>
        <div class="week-navigation">
          <el-button-group>
            <el-button :icon="ArrowLeft" @click="prevWeek" />
            <el-button>{{ currentWeek.format('M月D日') }} - {{ currentWeek.add(6, 'day').format('M月D日') }}</el-button>
            <el-button :icon="ArrowRight" @click="nextWeek" />
          </el-button-group>
        </div>
      </div>
      <div class="header-right">
        <el-select v-model="selectedStation" class="station-filter">
          <el-option 
            v-for="opt in stationTypeOptions" 
            :key="opt.value" 
            :label="opt.label" 
            :value="opt.value" 
          />
        </el-select>
      </div>
    </div>

    <div class="booking-grid">
      <div class="stations-header"></div>
      <div class="days-header">
        <div 
          v-for="day in weekDays" 
          :key="day.format('YYYY-MM-DD')"
          class="day-header-item"
          :class="{ today: day.isSame(dayjs(), 'day'), past: day.isBefore(dayjs(), 'day') }"
        >
          <div class="day-name">{{ day.format('ddd') }}</div>
          <div class="day-date">{{ day.format('M/D') }}</div>
        </div>
      </div>
      
      <template v-for="station in filteredStations" :key="station.id">
        <div class="station-cell">
          <div class="station-name">{{ station.name }}</div>
          <div class="station-type">
            <el-tag size="small" effect="plain">
              {{ getStationTypeLabel(station.type) }}
            </el-tag>
          </div>
          <div class="station-status" :style="{ color: getStationStatusColor(station.status) }">
            <span class="status-dot" :style="{ backgroundColor: getStationStatusColor(station.status) }"></span>
            {{ getStationStatusLabel(station.status) }}
          </div>
        </div>
        
        <div class="day-cells">
          <div 
            v-for="day in weekDays" 
            :key="station.id + '-' + day.format('YYYY-MM-DD')"
            class="day-cell"
            :class="{ 
              past: day.isBefore(dayjs(), 'day'),
              available: station.status === 'available' && !day.isBefore(dayjs(), 'day')
            }"
            @click="handleBooking(station, day)"
          >
            <div v-if="station.status === 'available' && !day.isBefore(dayjs(), 'day')" class="book-btn">
              <el-icon><Plus /></el-icon>
            </div>
          </div>
        </div>
      </template>
    </div>

    <div class="my-bookings-section">
      <h3 class="section-title">我的预约</h3>
      <div class="booking-list">
        <div 
          v-for="booking in myBookings" 
          :key="booking.id"
          class="booking-card"
        >
          <div class="booking-info">
            <div class="booking-station">{{ booking.stationName }}</div>
            <div class="booking-time">
              <el-icon><Calendar /></el-icon>
              <span>{{ booking.date }} {{ booking.startTime }} - {{ booking.endTime }}</span>
            </div>
          </div>
          <div class="booking-actions">
            <el-button 
              v-if="booking.status === 'booked'"
              size="small"
              type="primary"
              @click="handleCheckIn(booking.id)"
            >
              签到
            </el-button>
            <el-button 
              v-if="booking.status === 'checked_in'"
              size="small"
              type="success"
              @click="handleCheckOut(booking.id)"
            >
              签退
            </el-button>
            <el-button 
              v-if="booking.status === 'booked'"
              size="small"
              @click="handleCancelBooking(booking.id)"
            >
              取消
            </el-button>
          </div>
        </div>
        
        <el-empty v-if="myBookings.length === 0" description="暂无预约" />
      </div>
    </div>

    <el-dialog 
      v-model="showBookingDialog" 
      title="预约工位"
      width="400px"
    >
      <el-form label-width="80px">
        <el-form-item label="工位">
          <el-select v-model="bookingForm.stationId" class="full-width">
            <el-option 
              v-for="s in stations.filter(s => s.status === 'available')" 
              :key="s.id" 
              :label="s.name" 
              :value="s.id" 
            />
          </el-select>
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker
            v-model="bookingForm.date"
            type="date"
            class="full-width"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item label="开始时间">
          <el-time-picker
            v-model="bookingForm.startTime"
            format="HH:mm"
            value-format="HH:mm"
            class="full-width"
          />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-time-picker
            v-model="bookingForm.endTime"
            format="HH:mm"
            value-format="HH:mm"
            class="full-width"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showBookingDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmBooking">确认预约</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.studio-booking-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
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

.station-filter {
  width: 140px;
}

.booking-grid {
  display: grid;
  grid-template-columns: 180px 1fr;
  background: white;
  border-radius: $border-radius-md;
  overflow: hidden;
  box-shadow: $shadow-sm;

  @media (max-width: $breakpoint-mobile) {
    grid-template-columns: 100px 1fr;
    font-size: 12px;
  }
}

.stations-header {
  background: $color-bg;
  border-bottom: 1px solid $color-border;
  height: 50px;
}

.days-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  background: $color-bg;
  border-bottom: 1px solid $color-border;
}

.day-header-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 50px;
  border-left: 1px solid $color-border;
  color: $color-text-secondary;

  &.today {
    background: rgba($color-primary, 0.1);
    color: $color-primary;
    font-weight: 500;
  }

  &.past {
    opacity: 0.4;
  }
}

.day-name {
  font-size: 12px;
}

.day-date {
  font-size: 14px;
  font-weight: 600;
}

.station-cell {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 12px;
  border-bottom: 1px solid $color-border;
  gap: 4px;
}

.station-name {
  font-size: 13px;
  font-weight: 500;
  color: $color-text-primary;
}

.station-type {
  font-size: 11px;
}

.station-status {
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.day-cells {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}

.day-cell {
  border-left: 1px solid $color-border;
  border-bottom: 1px solid $color-border;
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: default;

  &.available {
    cursor: pointer;
    transition: background $transition-fast;

    &:hover {
      background: rgba($color-primary, 0.05);
    }
  }

  &.past {
    background: $color-bg;
    opacity: 0.5;
  }
}

.book-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba($color-primary, 0.1);
  color: $color-primary;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all $transition-fast;

  .day-cell:hover & {
    opacity: 1;
  }
}

.my-bookings-section {
  background: white;
  border-radius: $border-radius-md;
  padding: 20px;
  box-shadow: $shadow-sm;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: $color-text-primary;
  margin: 0 0 16px 0;
}

.booking-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.booking-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: $color-bg;
  border-radius: $border-radius-md;
}

.booking-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.booking-station {
  font-size: 15px;
  font-weight: 500;
  color: $color-text-primary;
}

.booking-time {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: $color-text-secondary;
}

.booking-actions {
  display: flex;
  gap: 8px;
}

.full-width {
  width: 100%;
}
</style>
