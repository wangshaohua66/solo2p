<template>
  <div class="rehearsal-booking">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>排练厅预约</span>
          <div class="header-actions">
            <el-button :icon="ArrowLeft" @click="prevWeek" />
            <span class="week-label">{{ weekLabel }}</span>
            <el-button :icon="ArrowRight" @click="nextWeek" />
          </div>
        </div>
      </template>

      <el-tabs v-model="activeTab">
        <el-tab-pane label="周视图" name="calendar">
          <div v-loading="loading" class="calendar-wrapper">
            <div class="calendar-header">
              <div class="venue-col">排练厅</div>
              <div
                v-for="day in weekDays"
                :key="day.date"
                class="day-col"
                :class="{ today: day.isToday }"
              >
                <div class="day-name">{{ day.weekday }}</div>
                <div class="day-date">{{ day.date }}</div>
              </div>
            </div>
            <div class="calendar-body">
              <div
                v-for="venue in rehearsalVenues"
                :key="venue.ID"
                class="venue-row"
              >
                <div class="venue-col venue-cell">
                  <div class="venue-name">{{ venue.Name }}</div>
                  <div class="venue-meta">容量: {{ venue.Capacity }}</div>
                </div>
                <div
                  v-for="day in weekDays"
                  :key="`${venue.ID}-${day.date}`"
                  class="day-col slot-cell"
                  @click="handleSlotClick(venue, day)"
                >
                  <div
                    v-for="booking in getBookingsForSlot(venue.ID, day.date)"
                    :key="booking.ID"
                    class="booking-item"
                    @click.stop="handleBookingClick(booking)"
                  >
                    <div class="booking-time">
                      {{ formatTime(booking.StartTime) }} - {{ formatTime(booking.EndTime) }}
                    </div>
                    <div class="booking-name">{{ booking.TroupeName }}</div>
                  </div>
                  <div v-if="getBookingsForSlot(venue.ID, day.date).length === 0" class="empty-slot">
                    <el-icon><Plus /></el-icon>
                    <span>点击预约</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="我的预约" name="my-bookings">
          <el-table v-loading="loading" :data="myBookings" stripe border>
            <el-table-column prop="ID" label="ID" width="80" />
            <el-table-column prop="TroupeName" label="院团名称" min-width="150" />
            <el-table-column label="排练厅" width="140">
              <template #default="{ row }">
                {{ getVenueName(row.VenueID) }}
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
            <el-table-column label="周期" width="150">
              <template #default="{ row }">
                {{ formatRecurrence(row) }}
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag type="success" v-if="row.Status === 'confirmed'">已确认</el-tag>
                <el-tag v-else>{{ row.Status || '待确认' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
                <el-button link type="danger" @click="handleCancel(row)">取消</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      title="预约排练厅"
      width="520px"
      @close="resetForm"
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-width="110px">
        <el-form-item label="院团名称" prop="TroupeName">
          <el-input v-model="form.TroupeName" placeholder="请输入院团名称" />
        </el-form-item>
        <el-form-item label="排练厅" prop="VenueID">
          <el-select v-model="form.VenueID" placeholder="请选择排练厅" style="width: 100%">
            <el-option
              v-for="venue in rehearsalVenues"
              :key="venue.ID"
              :label="venue.Name"
              :value="venue.ID"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="日期" prop="date">
          <el-date-picker
            v-model="form.date"
            type="date"
            placeholder="请选择日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="开始时间" prop="StartTime">
          <el-time-picker
            v-model="form.StartTime"
            placeholder="请选择开始时间"
            format="HH:mm"
            value-format="HH:mm"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="结束时间" prop="EndTime">
          <el-time-picker
            v-model="form.EndTime"
            placeholder="请选择结束时间"
            format="HH:mm"
            value-format="HH:mm"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="周期选项" prop="RecurrenceRule">
          <el-radio-group v-model="form.RecurrenceRule">
            <el-radio label="none">不重复</el-radio>
            <el-radio label="weekly">每周</el-radio>
          </el-radio-group>
        </el-form-item>
        <template v-if="form.RecurrenceRule === 'weekly'">
          <el-form-item label="选择星期" prop="RecurrenceDays">
            <el-checkbox-group v-model="form.days">
              <el-checkbox label="1">周一</el-checkbox>
              <el-checkbox label="2">周二</el-checkbox>
              <el-checkbox label="3">周三</el-checkbox>
              <el-checkbox label="4">周四</el-checkbox>
              <el-checkbox label="5">周五</el-checkbox>
              <el-checkbox label="6">周六</el-checkbox>
              <el-checkbox label="7">周日</el-checkbox>
            </el-checkbox-group>
          </el-form-item>
          <el-form-item label="持续周数" prop="RecurrenceWeeks">
            <el-input-number
              v-model="form.RecurrenceWeeks"
              :min="1"
              :max="52"
              placeholder="请输入周数"
            />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定预约</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus, ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import weekday from 'dayjs/plugin/weekday'
import { useBookingStore } from '@/stores/booking'
import {
  createRehearsalBooking,
  getRehearsalBookings,
  cancelRehearsalBooking
} from '@/api/resource'
import type { RehearsalBooking, Venue } from '@/types'

dayjs.extend(weekday)

const bookingStore = useBookingStore()

const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()
const activeTab = ref('calendar')
const currentWeekStart = ref(dayjs().startOf('week'))
const rehearsalBookings = ref<RehearsalBooking[]>([])

const rehearsalVenues = computed(() => bookingStore.rehearsalVenues)

interface FormData {
  TroupeName: string
  VenueID: number | undefined
  date: string
  StartTime: string
  EndTime: string
  RecurrenceRule: 'none' | 'weekly'
  days: string[]
  RecurrenceWeeks: number
}

const form = reactive<FormData>({
  TroupeName: '',
  VenueID: undefined,
  date: '',
  StartTime: '',
  EndTime: '',
  RecurrenceRule: 'none',
  days: [],
  RecurrenceWeeks: 4
})

const rules: FormRules = {
  TroupeName: [{ required: true, message: '请输入院团名称', trigger: 'blur' }],
  VenueID: [{ required: true, message: '请选择排练厅', trigger: 'change' }],
  date: [{ required: true, message: '请选择日期', trigger: 'change' }],
  StartTime: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
  EndTime: [{ required: true, message: '请选择结束时间', trigger: 'change' }],
  RecurrenceWeeks: [
    {
      validator: (_rule, value, callback) => {
        if (form.RecurrenceRule === 'weekly' && (!value || value < 1)) {
          callback(new Error('请输入周数'))
        } else {
          callback()
        }
      },
      trigger: 'change'
    }
  ]
}

interface WeekDay {
  date: string
  weekday: string
  isToday: boolean
}

const weekDays = computed<WeekDay[]>(() => {
  const days: WeekDay[] = []
  const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  for (let i = 0; i < 7; i++) {
    const d = currentWeekStart.value.add(i, 'day')
    days.push({
      date: d.format('YYYY-MM-DD'),
      weekday: weekdayNames[d.day()],
      isToday: d.isSame(dayjs(), 'day')
    })
  }
  return days
})

const weekLabel = computed(() => {
  const start = currentWeekStart.value.format('YYYY/MM/DD')
  const end = currentWeekStart.value.add(6, 'day').format('YYYY/MM/DD')
  return `${start} - ${end}`
})

const myBookings = computed(() => rehearsalBookings.value)

const getBookingsForSlot = (venueId: number, date: string) => {
  return rehearsalBookings.value.filter(b => {
    const bookingDate = dayjs(b.StartTime).format('YYYY-MM-DD')
    return b.VenueID === venueId && bookingDate === date
  })
}

const getVenueName = (venueId: number) => {
  const venue = rehearsalVenues.value.find(v => v.ID === venueId)
  return venue?.Name || '-'
}

const formatTime = (val: string) => dayjs(val).format('HH:mm')
const formatDateTime = (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm')

const formatRecurrence = (booking: RehearsalBooking) => {
  if (booking.RecurrenceRule === 'none' || !booking.RecurrenceRule) return '单次'
  const dayMap: Record<string, string> = {
    '1': '一', '2': '二', '3': '三', '4': '四', '5': '五', '6': '六', '7': '日'
  }
  const days = booking.RecurrenceDays ? booking.RecurrenceDays.split(',').map(d => dayMap[d] || d).join('、') : ''
  return `每周${days}，共${booking.RecurrenceWeeks}周`
}

const fetchData = async () => {
  loading.value = true
  try {
    await bookingStore.fetchVenues()
    const weekStart = currentWeekStart.value.format('YYYY-MM-DD')
    rehearsalBookings.value = await getRehearsalBookings({ week_start: weekStart })
  } catch (e) {
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

const prevWeek = () => {
  currentWeekStart.value = currentWeekStart.value.subtract(1, 'week')
}

const nextWeek = () => {
  currentWeekStart.value = currentWeekStart.value.add(1, 'week')
}

watch(currentWeekStart, fetchData)

const resetForm = () => {
  Object.assign(form, {
    TroupeName: '',
    VenueID: undefined,
    date: '',
    StartTime: '',
    EndTime: '',
    RecurrenceRule: 'none',
    days: [],
    RecurrenceWeeks: 4
  })
  formRef.value?.resetFields()
}

const handleSlotClick = (venue: Venue, day: WeekDay) => {
  resetForm()
  form.VenueID = venue.ID
  form.date = day.date
  dialogVisible.value = true
}

const handleBookingClick = (booking: RehearsalBooking) => {
  ElMessageBox.alert(
    `院团: ${booking.TroupeName}\n时间: ${formatDateTime(booking.StartTime)} - ${formatDateTime(booking.EndTime)}\n周期: ${formatRecurrence(booking)}`,
    '预约详情'
  )
}

const handleCancel = (row: RehearsalBooking) => {
  ElMessageBox.confirm('确认取消该预约？', '取消确认', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(async () => {
      await cancelRehearsalBooking(row.ID)
      ElMessage.success('取消成功')
      fetchData()
    })
    .catch(() => {})
}

const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async valid => {
    if (!valid) return
    submitting.value = true
    try {
      const startDateTime = dayjs(`${form.date} ${form.StartTime}`).format('YYYY-MM-DD HH:mm:ss')
      const endDateTime = dayjs(`${form.date} ${form.EndTime}`).format('YYYY-MM-DD HH:mm:ss')
      const payload: Partial<RehearsalBooking> = {
        TroupeName: form.TroupeName,
        VenueID: form.VenueID,
        StartTime: startDateTime,
        EndTime: endDateTime,
        RecurrenceRule: form.RecurrenceRule
      }
      if (form.RecurrenceRule === 'weekly') {
        payload.RecurrenceDays = form.days.join(',')
        payload.RecurrenceWeeks = form.RecurrenceWeeks
      }
      await createRehearsalBooking(payload)
      ElMessage.success('预约成功')
      dialogVisible.value = false
      resetForm()
      fetchData()
    } catch (e) {
      ElMessage.error('预约失败')
    } finally {
      submitting.value = false
    }
  })
}

onMounted(fetchData)
</script>

<style scoped lang="scss">
.rehearsal-booking {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;

      .week-label {
        font-size: 15px;
        font-weight: 500;
      }
    }
  }

  .calendar-wrapper {
    border: 1px solid #ebeef5;
    border-radius: 4px;
    overflow: hidden;

    .calendar-header {
      display: grid;
      grid-template-columns: 160px repeat(7, 1fr);
      background: #f5f7fa;
      border-bottom: 1px solid #ebeef5;

      .venue-col,
      .day-col {
        padding: 12px 8px;
        text-align: center;
        border-right: 1px solid #ebeef5;

        &:last-child {
          border-right: none;
        }
      }

      .venue-col {
        font-weight: 600;
      }

      .day-col {
        .day-name {
          font-size: 13px;
          color: #606266;
        }
        .day-date {
          font-size: 14px;
          font-weight: 600;
          margin-top: 4px;
        }

        &.today {
          background: #ecf5ff;
          .day-date {
            color: #409eff;
          }
        }
      }
    }

    .calendar-body {
      .venue-row {
        display: grid;
        grid-template-columns: 160px repeat(7, 1fr);
        border-bottom: 1px solid #ebeef5;

        &:last-child {
          border-bottom: none;
        }

        .venue-col,
        .day-col {
          padding: 8px;
          border-right: 1px solid #ebeef5;
          min-height: 100px;

          &:last-child {
            border-right: none;
          }
        }

        .venue-cell {
          background: #fafafa;
          display: flex;
          flex-direction: column;
          justify-content: center;

          .venue-name {
            font-weight: 600;
            font-size: 14px;
          }
          .venue-meta {
            font-size: 12px;
            color: #909399;
            margin-top: 4px;
          }
        }

        .slot-cell {
          cursor: pointer;
          transition: background 0.2s;

          &:hover {
            background: #f5f7fa;
          }

          .booking-item {
            background: #409eff;
            color: #fff;
            border-radius: 4px;
            padding: 4px 6px;
            margin-bottom: 4px;
            font-size: 12px;

            .booking-time {
              font-weight: 500;
            }
            .booking-name {
              opacity: 0.9;
              margin-top: 2px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
          }

          .empty-slot {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            min-height: 80px;
            color: #c0c4cc;
            font-size: 12px;
            gap: 4px;
          }
        }
      }
    }
  }
}
</style>
