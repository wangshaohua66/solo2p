<template>
  <div class="memorial-page">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">祭扫预约分流管理</h2>
        <p class="page-desc">合理规划祭扫时段，保障园区秩序与安全</p>
      </div>
      <div class="header-right">
        <el-date-picker
          v-model="selectedDate"
          type="date"
          placeholder="选择日期"
          format="YYYY年MM月DD日"
          value-format="YYYY-MM-DD"
          class="date-picker"
          :cell-class-name="dateCellClassName"
        />
      </div>
    </div>

    <transition name="fade">
      <div v-if="isPeakDate" class="peak-banner">
        <div class="peak-icon">
          <el-icon><Warning /></el-icon>
        </div>
        <div class="peak-content">
          <div class="peak-title">清明祭扫高峰提醒</div>
          <div class="peak-desc">
            当前为祭扫高峰期，建议错峰祭扫。推荐选择工作日或早间7:00-9:00时段，园区将增派工作人员保障秩序。
          </div>
        </div>
        <div class="peak-tips">
          <div class="tip-item">
            <span class="tip-dot"></span>
            建议公共交通出行
          </div>
          <div class="tip-item">
            <span class="tip-dot"></span>
            提前在线预约
          </div>
        </div>
      </div>
    </transition>

    <div class="page-body">
      <div class="left-section">
        <div class="section-header">
          <div class="section-title">
            <el-icon><Clock /></el-icon>
            <span>时段预约</span>
            <span class="date-label">{{ formatDateLabel(selectedDate) }}</span>
          </div>
          <div class="section-summary">
            <span>今日已预约</span>
            <span class="summary-number">{{ totalBooked }}</span>
            <span>/</span>
            <span class="summary-total">{{ totalQuota }}</span>
            <span class="summary-rate">使用率 {{ usageRate }}%</span>
          </div>
        </div>

        <div class="slots-grid">
          <div
            v-for="slot in slots"
            :key="slot.slotId"
            :class="[
              'slot-card',
              slot.status,
              { peak: slot.isPeak }
            ]"
            @click="onSlotClick(slot)"
          >
            <div class="slot-header">
              <div class="time-range">{{ slot.timeRange }}</div>
              <div v-if="slot.isPeak" class="peak-badge">
                <el-icon><Sunny /></el-icon>
                <span>高峰</span>
              </div>
              <StatusTag :status="slot.status" type="slot" />
            </div>

            <div class="slot-progress">
              <div
                class="progress-bar"
                :style="{ width: `${(slot.bookedCount / slot.totalQuota) * 100}%` }"
                :class="slot.status"
              ></div>
            </div>

            <div class="slot-stats">
              <div class="stat-item">
                <el-icon><User /></el-icon>
                <span class="stat-current">{{ slot.bookedCount }}</span>
                <span class="stat-divider">/</span>
                <span class="stat-total">{{ slot.totalQuota }}</span>
                <span class="stat-label">人</span>
              </div>
              <div class="stat-item">
                <el-icon><Van /></el-icon>
                <span class="stat-current">{{ slot.vehicleBooked }}</span>
                <span class="stat-divider">/</span>
                <span class="stat-total">{{ slot.vehicleQuota }}</span>
                <span class="stat-label">车</span>
              </div>
            </div>

            <div class="slot-footer">
              <span class="remaining">
                剩余 <strong>{{ slot.totalQuota - slot.bookedCount }}</strong> 名额
              </span>
              <el-icon class="action-icon"><ArrowRight /></el-icon>
            </div>
          </div>
        </div>
      </div>

      <div class="right-section">
        <el-tabs v-model="activeTab" class="right-tabs">
          <el-tab-pane label="今日预约" name="bookings">
            <template #label>
              <div class="tab-label">
                <el-icon><Tickets /></el-icon>
                <span>今日预约</span>
                <span class="tab-badge">{{ bookings.length }}</span>
              </div>
            </template>

            <div class="bookings-list scrollbar-thin">
              <div
                v-for="booking in bookings"
                :key="booking.id"
                :class="['booking-card', booking.status]"
              >
                <div class="booking-header">
                  <div class="booking-family">
                    <div class="family-avatar">{{ booking.familyName.slice(0, 1) }}</div>
                    <div class="family-info">
                      <div class="family-name">{{ booking.familyName }}</div>
                      <div class="booking-time">
                        <el-icon><Clock /></el-icon>
                        <span>{{ booking.timeRange }}</span>
                      </div>
                    </div>
                  </div>
                  <StatusTag :status="mapBookingStatus(booking.status)" type="slot" :text="getBookingStatusText(booking.status)" />
                </div>

                <div class="booking-body">
                  <div class="info-row">
                    <span class="info-label">人数</span>
                    <span class="info-value">{{ booking.peopleCount }}人</span>
                  </div>
                  <div v-if="booking.hasVehicle" class="info-row">
                    <span class="info-label">车牌</span>
                    <span class="info-value plate">{{ booking.plateNumber }}</span>
                  </div>
                  <div v-if="booking.deceaseName" class="info-row">
                    <span class="info-label">祭扫对象</span>
                    <span class="info-value">{{ booking.deceaseName }}</span>
                  </div>
                  <div v-if="booking.plotNo" class="info-row">
                    <span class="info-label">墓位号</span>
                    <span class="info-value plot">{{ booking.plotNo }}</span>
                  </div>
                  <div v-if="booking.parkingLotName" class="info-row">
                    <span class="info-label">停车场</span>
                    <span class="info-value">{{ booking.parkingLotName }} · {{ booking.parkingSpot }}</span>
                  </div>
                </div>

                <div class="booking-footer">
                  <div class="pass-code">
                    凭证号：<span class="code">{{ booking.passCode }}</span>
                  </div>
                  <div class="booking-actions">
                    <button
                      v-if="booking.status === 'booked'"
                      class="action-btn primary"
                      @click.stop="onCheckIn(booking)"
                    >
                      <el-icon><Camera /></el-icon>
                      <span>扫码核销</span>
                    </button>
                    <button class="action-btn" @click.stop="onViewPass(booking)">
                      <el-icon><View /></el-icon>
                      <span>通行证</span>
                    </button>
                  </div>
                </div>
              </div>

              <div v-if="bookings.length === 0" class="empty-bookings">
                <el-icon><Tickets /></el-icon>
                <p>暂无预约记录</p>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="电子通行证" name="pass">
            <template #label>
              <div class="tab-label">
                <el-icon><CreditCard /></el-icon>
                <span>电子通行证</span>
              </div>
            </template>

            <div class="pass-preview">
              <div class="pass-card">
                <div class="pass-header">
                  <div class="pass-title">园区电子通行证</div>
                  <div class="pass-subtitle">MEMORIAL PARKING PASS</div>
                </div>

                <div class="qr-wrapper">
                  <div class="qr-code">
                    <svg viewBox="0 0 200 200" class="qr-svg">
                      <rect width="200" height="200" fill="#C9A86C" />
                      <g fill="#1A1A1F">
                        <rect v-for="i in 80" :key="i"
                          :x="Math.floor(i % 10) * 20 + (i % 3) * 3"
                          :y="Math.floor(i / 10) * 20 + (i % 5) * 2"
                          width="14" height="14"
                          :opacity="(i % 7) * 0.15 + 0.3"
                        />
                        <rect x="4" y="4" width="44" height="44" fill="none" stroke="#1A1A1F" stroke-width="6" />
                        <rect x="152" y="4" width="44" height="44" fill="none" stroke="#1A1A1F" stroke-width="6" />
                        <rect x="4" y="152" width="44" height="44" fill="none" stroke="#1A1A1F" stroke-width="6" />
                        <rect x="14" y="14" width="24" height="24" fill="#1A1A1F" />
                        <rect x="162" y="14" width="24" height="24" fill="#1A1A1F" />
                        <rect x="14" y="162" width="24" height="24" fill="#1A1A1F" />
                      </g>
                    </svg>
                  </div>
                  <div class="qr-caption">扫码入园</div>
                </div>

                <div class="pass-info">
                  <div class="pass-code-box">
                    <span class="label">验证码</span>
                    <span class="code">{{ selectedBooking?.passCode || 'JC06200001' }}</span>
                  </div>

                  <div class="info-grid">
                    <div class="info-col">
                      <span class="label">有效期</span>
                      <span class="value">{{ selectedDate }} 全天</span>
                    </div>
                    <div class="info-col">
                      <span class="label">预约时段</span>
                      <span class="value">{{ selectedBooking?.timeRange || '09:00-11:00' }}</span>
                    </div>
                    <div class="info-col">
                      <span class="label">家属</span>
                      <span class="value">{{ selectedBooking?.familyName || '王家' }}</span>
                    </div>
                    <div class="info-col">
                      <span class="label">人数</span>
                      <span class="value">{{ selectedBooking?.peopleCount || 4 }}人</span>
                    </div>
                  </div>

                  <div v-if="selectedBooking?.hasVehicle" class="vehicle-info">
                    <div class="info-col">
                      <span class="label">车牌号</span>
                      <span class="value plate">{{ selectedBooking?.plateNumber }}</span>
                    </div>
                    <div class="info-col">
                      <span class="label">车型</span>
                      <span class="value">{{ selectedBooking?.vehicleType }}</span>
                    </div>
                    <div class="info-col">
                      <span class="label">停车场</span>
                      <span class="value">{{ selectedBooking?.parkingLotName }}</span>
                    </div>
                    <div class="info-col">
                      <span class="label">车位</span>
                      <span class="value">{{ selectedBooking?.parkingSpot }}</span>
                    </div>
                  </div>
                </div>

                <div class="pass-footer">
                  <div class="footer-note">
                    <el-icon><InfoFilled /></el-icon>
                    <span>请在入园时出示此凭证，配合工作人员核验</span>
                  </div>
                </div>
              </div>

              <div class="pass-actions">
                <button class="pass-btn">
                  <el-icon><Download /></el-icon>
                  <span>保存图片</span>
                </button>
                <button class="pass-btn">
                  <el-icon><Share /></el-icon>
                  <span>分享给家属</span>
                </button>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </div>

    <div class="parking-bar">
      <div class="parking-label">
        <el-icon><Van /></el-icon>
        <span>停车场实时状态</span>
      </div>
      <div class="parking-lots">
        <div
          v-for="lot in parkingLots"
          :key="lot.id"
          :class="['parking-lot', lot.type]"
        >
          <div class="lot-header">
            <span class="lot-name">{{ lot.name }}</span>
            <span class="lot-available">
              剩余 <strong>{{ lot.availableSpots }}</strong> / {{ lot.totalSpots }}
            </span>
          </div>
          <div class="lot-progress">
            <div
              class="progress-fill"
              :style="{ width: `${((lot.totalSpots - lot.availableSpots) / lot.totalSpots) * 100}%` }"
              :class="getParkingStatus(lot)"
            ></div>
          </div>
          <div class="lot-meta">
            <span class="meta-item">
              <el-icon><Location /></el-icon>
              {{ lot.area }}
            </span>
            <span class="meta-item">
              <el-icon><Clock /></el-icon>
              {{ lot.openTime }}-{{ lot.closeTime }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <el-dialog
      v-model="bookingDialogVisible"
      title="新增祭扫预约"
      width="540px"
      class="booking-dialog"
      :close-on-click-modal="false"
    >
      <div v-if="selectedSlot" class="booking-form-content">
        <div class="slot-summary">
          <div class="summary-time">
            <el-icon><Clock /></el-icon>
            <span>{{ selectedDate }} {{ selectedSlot.timeRange }}</span>
          </div>
          <StatusTag :status="selectedSlot.status" type="slot" />
        </div>

        <el-form :model="newBookingForm" label-width="90px" class="booking-form">
          <el-form-item label="家属姓名" required>
            <el-input v-model="newBookingForm.familyName" placeholder="请输入家属姓名" />
          </el-form-item>
          <el-form-item label="联系电话" required>
            <el-input v-model="newBookingForm.phone" placeholder="请输入联系电话" />
          </el-form-item>
          <el-form-item label="人数" required>
            <el-input-number v-model="newBookingForm.peopleCount" :min="1" :max="20" style="width: 100%" />
          </el-form-item>
          <el-form-item label="是否驾车">
            <el-switch v-model="newBookingForm.hasVehicle" />
          </el-form-item>
          <template v-if="newBookingForm.hasVehicle">
            <el-form-item label="车牌号" required>
              <el-input v-model="newBookingForm.plateNumber" placeholder="例：沪A·12345" />
            </el-form-item>
            <el-form-item label="车辆类型">
              <el-select v-model="newBookingForm.vehicleType" placeholder="请选择" style="width: 100%">
                <el-option label="轿车" value="轿车" />
                <el-option label="SUV" value="SUV" />
                <el-option label="MPV" value="MPV" />
                <el-option label="其他" value="其他" />
              </el-select>
            </el-form-item>
          </template>
          <el-form-item label="祭扫对象">
            <el-input v-model="newBookingForm.deceaseName" placeholder="逝者姓名（可选）" />
          </el-form-item>
          <el-form-item label="墓位编号">
            <el-input v-model="newBookingForm.plotNo" placeholder="例：FS-A01-01（可选）" />
          </el-form-item>
          <el-form-item label="祭品需求">
            <el-checkbox-group v-model="newBookingForm.offerings">
              <el-checkbox label="鲜花" />
              <el-checkbox label="香烛" />
              <el-checkbox label="供品" />
              <el-checkbox label="其他" />
            </el-checkbox-group>
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <button class="dialog-btn cancel" @click="bookingDialogVisible = false">取消</button>
        <button class="dialog-btn confirm" @click="onSubmitBooking">
          <el-icon><Check /></el-icon>
          <span>提交预约</span>
        </button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import {
  Warning,
  Clock,
  Sunny,
  User,
  Van,
  ArrowRight,
  Tickets,
  Camera,
  View,
  CreditCard,
  InfoFilled,
  Download,
  Share,
  Location,
  Check
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import StatusTag from '@/components/common/StatusTag.vue'
import {
  generateMemorialSlots,
  generateMemorialBookings,
  mockParkingLots
} from '@/mock/cemetery'
import { dayjs } from '@/utils/date'
import type { MemorialTimeSlot, MemorialBooking, ParkingLot } from '@/types/cemetery'

const selectedDate = ref(dayjs().format('YYYY-MM-DD'))
const slots = ref<MemorialTimeSlot[]>([])
const bookings = ref<MemorialBooking[]>([])
const parkingLots = ref<ParkingLot[]>(mockParkingLots)
const activeTab = ref('bookings')
const bookingDialogVisible = ref(false)
const selectedSlot = ref<MemorialTimeSlot | null>(null)
const selectedBooking = ref<MemorialBooking | null>(null)

const newBookingForm = reactive({
  familyName: '',
  phone: '',
  peopleCount: 2,
  hasVehicle: false,
  plateNumber: '',
  vehicleType: '轿车',
  deceaseName: '',
  plotNo: '',
  offerings: [] as string[]
})

const isPeakDate = computed(() => {
  const d = dayjs(selectedDate.value)
  const month = d.month()
  const date = d.date()
  const day = d.day()
  return (month === 3 && date >= 1 && date <= 7) || day === 0 || day === 6
})

const totalBooked = computed(() => slots.value.reduce((s: number, slot: MemorialTimeSlot) => s + slot.bookedCount, 0))
const totalQuota = computed(() => slots.value.reduce((s: number, slot: MemorialTimeSlot) => s + slot.totalQuota, 0))
const usageRate = computed(() => {
  if (totalQuota.value === 0) return 0
  return Math.round((totalBooked.value / totalQuota.value) * 100)
})

function refreshData() {
  slots.value = generateMemorialSlots(selectedDate.value)
  bookings.value = generateMemorialBookings(selectedDate.value)
}

watch(selectedDate, () => {
  refreshData()
}, { immediate: true })

function dateCellClassName(date: { date: Date | string; isDate?: boolean }) {
  const d = dayjs(date.isDate ? date.date : new Date(date.date as string | Date))
  const month = d.month()
  const day = d.date()
  const weekDay = d.day()

  if (month === 3 && day >= 1 && day <= 7) {
    return 'qingming-peak'
  }
  if (weekDay === 0 || weekDay === 6) {
    return 'weekend'
  }
  return ''
}

function formatDateLabel(date: string): string {
  const d = dayjs(date)
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${d.month() + 1}月${d.date()}日 ${weekdays[d.day()]}`
}

function onSlotClick(slot: MemorialTimeSlot) {
  if (slot.status === 'closed') {
    ElMessage.warning('此时段已关闭预约')
    return
  }
  if (slot.status === 'full') {
    ElMessage.warning('此时段名额已满，请选择其他时段')
    return
  }
  selectedSlot.value = slot
  bookingDialogVisible.value = true
}

function onCheckIn(booking: MemorialBooking) {
  ElMessage.success(`预约 ${booking.passCode} 核销成功`)
  booking.status = 'checked_in'
}

function onViewPass(booking: MemorialBooking) {
  selectedBooking.value = booking
  activeTab.value = 'pass'
}

function mapBookingStatus(status: string): string {
  const map: Record<string, string> = {
    booked: 'available',
    checked_in: 'limited',
    completed: 'available',
    cancelled: 'closed',
    expired: 'closed'
  }
  return map[status] || 'available'
}

function getBookingStatusText(status: string): string {
  const map: Record<string, string> = {
    booked: '待入园',
    checked_in: '已入园',
    completed: '已完成',
    cancelled: '已取消',
    expired: '已过期'
  }
  return map[status] || status
}

function onSubmitBooking() {
  if (!newBookingForm.familyName || !newBookingForm.phone) {
    ElMessage.warning('请填写家属姓名和联系电话')
    return
  }
  if (newBookingForm.hasVehicle && !newBookingForm.plateNumber) {
    ElMessage.warning('请填写车牌号')
    return
  }
  ElMessage.success(`预约成功！家属：${newBookingForm.familyName}，时段：${selectedSlot.value?.timeRange}`)
  bookingDialogVisible.value = false
  Object.assign(newBookingForm, {
    familyName: '',
    phone: '',
    peopleCount: 2,
    hasVehicle: false,
    plateNumber: '',
    vehicleType: '轿车',
    deceaseName: '',
    plotNo: '',
    offerings: []
  })
}

function getParkingStatus(lot: ParkingLot): string {
  const usedRate = (lot.totalSpots - lot.availableSpots) / lot.totalSpots
  if (usedRate >= 0.9) return 'critical'
  if (usedRate >= 0.7) return 'warning'
  return 'normal'
}
</script>

<style lang="scss" scoped>
.memorial-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 20px;
  gap: 16px;
  background: #1A1A1F;
  overflow: hidden;
}

.page-header {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding-bottom: 4px;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 4px;
  background: linear-gradient(135deg, #D4B87C 0%, #C9A86C 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.page-desc {
  font-size: 13px;
  color: #6B6B74;
  margin: 0;
}

.date-picker {
  width: 220px;

  :deep(.el-input__wrapper) {
    background: #24242B;
    border: 1px solid #3A3A44;
    border-radius: 8px;
    box-shadow: none;
    padding: 6px 14px;
  }

  :deep(.el-input__inner) {
    color: #FFFFFF;
    font-size: 13px;
  }

  :deep(.el-input__prefix-inner),
  :deep(.el-input__suffix-inner) {
    color: #C9A86C;
  }
}

:deep(.el-picker-panel) {
  background: #24242B;
  border: 1px solid #3A3A44;

  .qingming-peak {
    color: #FF4D4F !important;
    font-weight: 700;

    &.el-date-table-cell__text::after {
      content: '';
      position: absolute;
      bottom: 2px;
      left: 50%;
      transform: translateX(-50%);
      width: 4px;
      height: 4px;
      background: #FF4D4F;
      border-radius: 50%;
    }
  }

  .weekend {
    color: #FA8C16 !important;
  }
}

.peak-banner {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
  background: linear-gradient(135deg, rgba(255, 77, 79, 0.12) 0%, rgba(250, 140, 22, 0.08) 100%);
  border: 1px solid rgba(255, 77, 79, 0.3);
  border-radius: 10px;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 4px;
    height: 100%;
    background: linear-gradient(180deg, #FF4D4F 0%, #FA8C16 100%);
  }
}

.peak-icon {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 77, 79, 0.15);
  border-radius: 10px;
  color: #FF4D4F;

  :deep(.el-icon) {
    width: 24px;
    height: 24px;
  }
}

.peak-content {
  flex: 1;
}

.peak-title {
  font-size: 15px;
  font-weight: 600;
  color: #FF4D4F;
  margin-bottom: 3px;
}

.peak-desc {
  font-size: 12px;
  color: #B0B0B8;
  line-height: 1.5;
}

.peak-tips {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.tip-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #FA8C16;
}

.tip-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #FA8C16;
  flex-shrink: 0;
}

.page-body {
  flex: 1;
  display: flex;
  gap: 16px;
  min-height: 0;
}

.left-section {
  width: 65%;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
}

.section-header {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  background: #24242B;
  border: 1px solid #3A3A44;
  border-radius: 10px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #C9A86C;

  :deep(.el-icon) {
    width: 18px;
    height: 18px;
  }
}

.date-label {
  font-size: 12px;
  font-weight: 400;
  color: #6B6B74;
  padding: 3px 10px;
  background: rgba(201, 168, 108, 0.08);
  border-radius: 5px;
}

.section-summary {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #B0B0B8;
}

.summary-number {
  font-size: 18px;
  font-weight: 700;
  color: #C9A86C;
  font-family: 'SF Mono', Monaco, monospace;
}

.summary-total {
  font-size: 14px;
  font-weight: 600;
  color: #6B6B74;
  font-family: 'SF Mono', Monaco, monospace;
}

.summary-rate {
  margin-left: 10px;
  padding: 3px 10px;
  background: rgba(82, 196, 26, 0.1);
  color: #52C41A;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 600;
}

.slots-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  overflow-y: auto;
  padding: 4px;
  min-height: 0;
  align-content: start;

  @include scrollbar-custom;
}

.slot-card {
  position: relative;
  padding: 14px 16px;
  background: linear-gradient(135deg, #24242B 0%, #2A2A33 100%);
  border: 1.5px solid #3A3A44;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s ease;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 3px;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  &.available {
    &::before { background: linear-gradient(90deg, #52C41A, #73D13D); opacity: 0.6; }
  }
  &.limited {
    &::before { background: linear-gradient(90deg, #FA8C16, #FFA940); opacity: 0.6; }
  }
  &.full {
    &::before { background: linear-gradient(90deg, #FF4D4F, #FF7875); opacity: 0.6; }
    cursor: not-allowed;
    opacity: 0.7;
  }
  &.closed {
    &::before { background: linear-gradient(90deg, #8C8C8C, #A0A0A0); opacity: 0.6; }
    cursor: not-allowed;
    opacity: 0.55;
  }

  &:hover:not(.full):not(.closed) {
    border-color: #C9A86C;
    transform: translateY(-3px);
    box-shadow:
      0 10px 30px rgba(0, 0, 0, 0.35),
      0 0 0 1px rgba(201, 168, 108, 0.2),
      inset 0 0 30px rgba(201, 168, 108, 0.05);

    &::before {
      opacity: 1;
      background: linear-gradient(90deg, #C9A86C, #D4B87C);
    }
  }

  &.peak {
    border-style: dashed;
  }
}

.slot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  gap: 8px;
  flex-wrap: wrap;
}

.time-range {
  font-size: 17px;
  font-weight: 700;
  color: #FFFFFF;
  font-family: 'SF Mono', Monaco, monospace;
  letter-spacing: 0.5px;
}

.peak-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  background: rgba(250, 140, 22, 0.15);
  border: 1px solid rgba(250, 140, 22, 0.3);
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  color: #FA8C16;

  :deep(.el-icon) {
    width: 11px;
    height: 11px;
  }
}

.slot-progress {
  height: 6px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 12px;
}

.progress-bar {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s ease;

  &.available {
    background: linear-gradient(90deg, #52C41A 0%, #73D13D 100%);
    box-shadow: 0 0 8px rgba(82, 196, 26, 0.4);
  }
  &.limited {
    background: linear-gradient(90deg, #FA8C16 0%, #FFA940 100%);
    box-shadow: 0 0 8px rgba(250, 140, 22, 0.4);
  }
  &.full {
    background: linear-gradient(90deg, #FF4D4F 0%, #FF7875 100%);
    box-shadow: 0 0 8px rgba(255, 77, 79, 0.4);
  }
  &.closed {
    background: linear-gradient(90deg, #8C8C8C 0%, #A0A0A0 100%);
  }
}

.slot-stats {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #B0B0B8;

  :deep(.el-icon) {
    width: 13px;
    height: 13px;
    color: #6B6B74;
  }
}

.stat-current {
  font-weight: 700;
  color: #FFFFFF;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 13px;
}

.stat-divider {
  color: #3A3A44;
}

.stat-total {
  color: #6B6B74;
  font-family: 'SF Mono', Monaco, monospace;
}

.slot-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.remaining {
  font-size: 11px;
  color: #6B6B74;

  strong {
    color: #52C41A;
    font-size: 13px;
    font-weight: 700;
    font-family: 'SF Mono', Monaco, monospace;
    margin: 0 2px;
  }
}

.slot-card.limited .remaining strong {
  color: #FA8C16;
}

.slot-card.full .remaining strong {
  color: #FF4D4F;
}

.action-icon {
  width: 16px;
  height: 16px;
  color: #6B6B74;
  transition: all 0.3s ease;
}

.slot-card:hover:not(.full):not(.closed) .action-icon {
  color: #C9A86C;
  transform: translateX(4px);
}

.right-section {
  width: calc(35% - 16px);
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #24242B;
  border: 1px solid #3A3A44;
  border-radius: 10px;
  overflow: hidden;
}

:deep(.right-tabs) {
  display: flex;
  flex-direction: column;
  height: 100%;

  .el-tabs__header {
    margin: 0;
    border-bottom: 1px solid #3A3A44;
    background: rgba(0, 0, 0, 0.15);
  }

  .el-tabs__nav-wrap::after {
    display: none;
  }

  .el-tabs__item {
    color: #6B6B74;
    font-size: 13px;
    font-weight: 500;
    height: 48px;
    line-height: 48px;

    &.is-active {
      color: #C9A86C;
    }
  }

  .el-tabs__active-bar {
    background: linear-gradient(90deg, #C9A86C, #D4B87C);
    height: 2.5px;
  }

  .el-tabs__content {
    flex: 1;
    overflow: hidden;
    padding: 16px;
  }

  .el-tab-pane {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;

  :deep(.el-icon) {
    width: 15px;
    height: 15px;
  }
}

.tab-badge {
  display: inline-block;
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  line-height: 18px;
  text-align: center;
  font-size: 10px;
  font-weight: 700;
  color: #1A1A1F;
  background: #C9A86C;
  border-radius: 9px;
  font-family: 'SF Mono', Monaco, monospace;
}

.bookings-list {
  flex: 1;
  overflow-y: auto;
  padding-right: 4px;
  display: flex;
  flex-direction: column;
  gap: 10px;

  @include scrollbar-custom;
}

.booking-card {
  padding: 14px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 9px;
  transition: all 0.25s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(201, 168, 108, 0.2);
  }

  &.cancelled,
  &.expired {
    opacity: 0.55;
  }
}

.booking-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 10px;
  gap: 10px;
}

.booking-family {
  display: flex;
  align-items: center;
  gap: 10px;
}

.family-avatar {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(201, 168, 108, 0.3) 0%, rgba(139, 115, 85, 0.2) 100%);
  color: #C9A86C;
  font-weight: 700;
  font-size: 14px;
  border: 1px solid rgba(201, 168, 108, 0.3);
}

.family-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.family-name {
  font-size: 14px;
  font-weight: 600;
  color: #FFFFFF;
}

.booking-time {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #6B6B74;

  :deep(.el-icon) {
    width: 11px;
    height: 11px;
  }
}

.booking-body {
  padding: 8px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  margin-bottom: 10px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 12px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  gap: 8px;
}

.info-label {
  color: #6B6B74;
  flex-shrink: 0;
}

.info-value {
  color: #FFFFFF;
  text-align: right;
  font-weight: 500;

  &.plate {
    font-family: 'SF Mono', Monaco, monospace;
    color: #C9A86C;
  }

  &.plot {
    font-family: 'SF Mono', Monaco, monospace;
    color: #1890FF;
    font-size: 10px;
  }
}

.booking-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.pass-code {
  font-size: 11px;
  color: #6B6B74;

  .code {
    font-family: 'SF Mono', Monaco, monospace;
    color: #B0B0B8;
    font-weight: 600;
    margin-left: 4px;
  }
}

.booking-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 5px;
  color: #B0B0B8;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s ease;

  :deep(.el-icon) {
    width: 12px;
    height: 12px;
  }

  &:hover {
    border-color: rgba(201, 168, 108, 0.35);
    color: #C9A86C;
  }

  &.primary {
    background: linear-gradient(135deg, rgba(201, 168, 108, 0.18) 0%, rgba(139, 115, 85, 0.12) 100%);
    border-color: rgba(201, 168, 108, 0.4);
    color: #C9A86C;

    &:hover {
      background: linear-gradient(135deg, rgba(201, 168, 108, 0.28) 0%, rgba(139, 115, 85, 0.2) 100%);
    }
  }
}

.empty-bookings {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #6B6B74;
  gap: 10px;
  padding: 40px 20px;

  :deep(.el-icon) {
    width: 48px;
    height: 48px;
    opacity: 0.4;
  }

  p {
    margin: 0;
    font-size: 13px;
  }
}

.pass-preview {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;

  @include scrollbar-custom;
}

.pass-card {
  background: linear-gradient(160deg, #1E1E25 0%, #24242B 50%, #1A1A1F 100%);
  border: 2px solid rgba(201, 168, 108, 0.35);
  border-radius: 14px;
  overflow: hidden;
  position: relative;
  box-shadow:
    0 0 0 1px rgba(201, 168, 108, 0.1),
    0 10px 40px rgba(0, 0, 0, 0.3),
    inset 0 0 60px rgba(201, 168, 108, 0.03);

  &::before,
  &::after {
    content: '';
    position: absolute;
    width: 30px;
    height: 30px;
    background: #1A1A1F;
    border-radius: 50%;
  }

  &::before {
    left: -15px;
    top: 50%;
    transform: translateY(-50%);
  }

  &::after {
    right: -15px;
    top: 50%;
    transform: translateY(-50%);
  }
}

.pass-header {
  padding: 16px 20px 12px;
  text-align: center;
  background: linear-gradient(180deg, rgba(201, 168, 108, 0.15) 0%, transparent 100%);
  border-bottom: 1px dashed rgba(201, 168, 108, 0.2);
}

.pass-title {
  font-size: 18px;
  font-weight: 700;
  background: linear-gradient(135deg, #D4B87C 0%, #C9A86C 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 2px;
}

.pass-subtitle {
  font-size: 9px;
  letter-spacing: 3px;
  color: rgba(201, 168, 108, 0.5);
  font-weight: 500;
}

.qr-wrapper {
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.qr-code {
  width: 140px;
  height: 140px;
  padding: 8px;
  background: #FFFFFF;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(201, 168, 108, 0.2);
}

.qr-svg {
  width: 100%;
  height: 100%;
  display: block;
}

.qr-caption {
  font-size: 11px;
  color: #C9A86C;
  font-weight: 500;
}

.pass-info {
  padding: 0 20px 12px;
}

.pass-code-box {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  margin-bottom: 12px;
  background: rgba(201, 168, 108, 0.08);
  border: 1px dashed rgba(201, 168, 108, 0.25);
  border-radius: 7px;

  .label {
    font-size: 11px;
    color: #6B6B74;
  }

  .code {
    font-size: 16px;
    font-weight: 700;
    color: #C9A86C;
    font-family: 'SF Mono', Monaco, monospace;
    letter-spacing: 2px;
  }
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 16px;
}

.vehicle-info {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed rgba(255, 255, 255, 0.08);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 16px;
}

.info-col {
  display: flex;
  flex-direction: column;
  gap: 2px;

  .label {
    font-size: 10px;
    color: #6B6B74;
  }

  .value {
    font-size: 12px;
    color: #FFFFFF;
    font-weight: 500;

    &.plate {
      color: #C9A86C;
      font-family: 'SF Mono', Monaco, monospace;
    }
  }
}

.pass-footer {
  padding: 10px 20px 16px;
}

.footer-note {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(24, 144, 255, 0.08);
  border-radius: 6px;
  font-size: 11px;
  color: #1890FF;
  line-height: 1.5;

  :deep(.el-icon) {
    width: 13px;
    height: 13px;
    flex-shrink: 0;
    margin-top: 1px;
  }
}

.pass-actions {
  display: flex;
  gap: 10px;
}

.pass-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  background: rgba(201, 168, 108, 0.08);
  border: 1px solid rgba(201, 168, 108, 0.25);
  border-radius: 8px;
  color: #C9A86C;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s ease;

  :deep(.el-icon) {
    width: 14px;
    height: 14px;
  }

  &:hover {
    background: rgba(201, 168, 108, 0.15);
    border-color: #C9A86C;
  }
}

.parking-bar {
  flex-shrink: 0;
  display: flex;
  align-items: stretch;
  gap: 16px;
  padding: 14px 18px;
  background: linear-gradient(180deg, #24242B 0%, #1E1E25 100%);
  border: 1px solid #3A3A44;
  border-radius: 10px;
}

.parking-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 16px;
  border-right: 1px solid #3A3A44;
  font-size: 13px;
  font-weight: 600;
  color: #C9A86C;
  white-space: nowrap;

  :deep(.el-icon) {
    width: 17px;
    height: 17px;
  }
}

.parking-lots {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

.parking-lot {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  transition: all 0.25s ease;

  &:hover {
    border-color: rgba(201, 168, 108, 0.2);
  }
}

.lot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.lot-name {
  font-size: 12px;
  font-weight: 600;
  color: #FFFFFF;
}

.lot-available {
  font-size: 11px;
  color: #6B6B74;

  strong {
    color: #52C41A;
    font-family: 'SF Mono', Monaco, monospace;
    font-size: 13px;
    margin: 0 2px;
  }
}

.parking-lot .lot-available strong.warning {
  color: #FA8C16;
}

.parking-lot .lot-available strong.critical {
  color: #FF4D4F;
}

.lot-progress {
  height: 4px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.5s ease;

  &.normal {
    background: linear-gradient(90deg, #52C41A, #73D13D);
  }
  &.warning {
    background: linear-gradient(90deg, #FA8C16, #FFA940);
  }
  &.critical {
    background: linear-gradient(90deg, #FF4D4F, #FF7875);
  }
}

.lot-meta {
  display: flex;
  gap: 10px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  color: #6B6B74;

  :deep(.el-icon) {
    width: 10px;
    height: 10px;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

:deep(.booking-dialog) {
  .el-dialog {
    background: #24242B;
    border: 1px solid rgba(201, 168, 108, 0.25);
    border-radius: 12px;
  }

  .el-dialog__header {
    border-bottom: 1px solid rgba(201, 168, 108, 0.15);
    padding: 18px 24px;
  }

  .el-dialog__title {
    color: #C9A86C;
    font-weight: 600;
  }

  .el-dialog__body {
    padding: 20px 24px;
  }

  .el-dialog__footer {
    padding: 14px 24px;
    border-top: 1px solid rgba(201, 168, 108, 0.15);
  }
}

.slot-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  margin-bottom: 18px;
  background: linear-gradient(135deg, rgba(201, 168, 108, 0.12) 0%, transparent 100%);
  border: 1px solid rgba(201, 168, 108, 0.25);
  border-radius: 8px;
}

.summary-time {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #FFFFFF;

  :deep(.el-icon) {
    width: 16px;
    height: 16px;
    color: #C9A86C;
  }
}

:deep(.booking-form) {
  .el-form-item__label {
    color: #B0B0B8;
    font-size: 13px;
  }

  .el-input__wrapper,
  .el-textarea__inner,
  .el-select__wrapper,
  .el-input-number {
    background: #1A1A1F !important;
    border: 1px solid #3A3A44;
    box-shadow: none !important;
    border-radius: 8px;
  }

  .el-input-number {
    --el-input-bg-color: #1A1A1F;
  }

  .el-input__inner,
  .el-textarea__inner,
  .el-input-number__decrease,
  .el-input-number__increase {
    color: #FFFFFF;
    font-size: 13px;
  }

  .el-input-number__decrease,
  .el-input-number__increase {
    background: #24242B;
    border-color: #3A3A44;
    color: #C9A86C;
  }

  .el-checkbox {
    margin-right: 18px;

    .el-checkbox__label {
      color: #B0B0B8;
      font-size: 13px;
    }

    .el-checkbox__inner {
      background: #1A1A1F;
      border-color: #3A3A44;
    }

    &.is-checked .el-checkbox__inner {
      background: #C9A86C;
      border-color: #C9A86C;
    }
  }

  .el-switch {
    --el-switch-on-color: #C9A86C;
    --el-switch-off-color: #3A3A44;
  }
}

.dialog-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
  border: 1px solid transparent;

  :deep(.el-icon) {
    width: 14px;
    height: 14px;
  }

  &.cancel {
    background: transparent;
    border-color: #3A3A44;
    color: #B0B0B8;

    &:hover {
      border-color: #6B6B74;
      color: #FFFFFF;
    }
  }

  &.confirm {
    background: linear-gradient(135deg, #C9A86C 0%, #8B7355 100%);
    color: #1A1A1F;

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(201, 168, 108, 0.35);
    }
  }
}

@include scrollbar-custom;
</style>
