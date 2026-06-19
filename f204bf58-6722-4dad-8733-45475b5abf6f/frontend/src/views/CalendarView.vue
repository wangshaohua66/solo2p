<template>
  <div class="calendar-view">
    <div class="page-header">
      <div>
        <h2 class="page-title">庭审日程</h2>
        <p style="color:#718096;font-size:13px;margin-top:4px">
          本月共 {{ monthTrialCount }} 场庭审，
          <span style="color:#e53e3e" v-if="conflictCount > 0">
            {{ conflictCount }} 场存在时间冲突
          </span>
        </p>
      </div>
      <div class="header-actions">
        <el-select v-model="filterLawyer" placeholder="筛选律师" clearable filterable style="width:180px" @change="loadCalendar">
          <el-option v-for="l in lawyerList" :key="l.id" :label="l.full_name" :value="l.id" />
        </el-select>
        <el-button-group>
          <el-button @click="changeView('month')" :type="viewMode === 'month' ? 'primary' : ''">月视图</el-button>
          <el-button @click="changeView('week')" :type="viewMode === 'week' ? 'primary' : ''">周视图</el-button>
          <el-button @click="changeView('list')" :type="viewMode === 'list' ? 'primary' : ''">列表</el-button>
        </el-button-group>
        <el-button type="primary" @click="openCreate">
          <el-icon><Plus /></el-icon> 新增庭审
        </el-button>
      </div>
    </div>

    <div class="card" v-if="viewMode !== 'list'">
      <div class="calendar-header">
        <el-button :icon="ArrowLeft" circle @click="prev" />
        <span class="current-title">{{ currentTitle }}</span>
        <el-button :icon="ArrowRight" circle @click="next" />
        <el-button size="small" style="margin-left:16px" @click="goToday">今天</el-button>
      </div>
      <div class="calendar-grid" v-if="viewMode === 'month'">
        <div class="weekday-header">
          <div v-for="d in weekDays" :key="d" class="weekday">{{ d }}</div>
        </div>
        <div class="days-grid">
          <div
            v-for="day in monthDays"
            :key="day.key"
            class="day-cell"
            :class="{
              'other-month': day.otherMonth,
              'is-today': day.isToday,
              'selected': selectedDate && day.date === selectedDate,
              'drag-over': dragOverDate === day.date
            }"
            @click="selectDay(day)"
            @dragover.prevent="onMonthDragOver($event, day)"
            @dragleave="onMonthDragLeave(day)"
            @drop.prevent="onMonthDrop($event, day)"
          >
            <div class="day-number">{{ day.num }}</div>
            <div class="day-events">
              <div
            v-for="ev in day.events"
            :key="ev.id"
            class="event-item"
            :class="{ conflict: ev.has_conflict, dragging: draggingTrial?.id === ev.id }"
            :style="{ background: ev.color }"
            draggable="true"
            @dragstart="onDragStart($event, ev)"
            @dragend="onDragEnd"
            @click.stop="openTrial(ev)"
          >
                <span class="ev-time">{{ ev.startStr }}</span>
                <span class="ev-title">{{ ev.title }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="week-view" v-else>
        <div class="week-grid">
          <div class="time-col">
            <div class="empty-header"></div>
            <div v-for="h in 24" :key="h" class="time-slot">{{ (h - 1).toString().padStart(2, '0') }}:00</div>
          </div>
          <div class="days-cols">
            <div v-for="day in weekDaysArr" :key="day.date" class="day-col">
              <div class="day-header" :class="{ 'is-today': day.isToday }">
                <div>{{ day.weekday }}</div>
                <div class="num">{{ day.num }}</div>
              </div>
              <div class="day-time-slots">
                <div v-for="h in 24" :key="h" class="slot"
                  @click="slotClick(day, h - 1)"
                  @dragover.prevent
                  @drop.prevent="onWeekDrop($event, day, h - 1)"
                >
                  <div
                    v-for="ev in getSlotEvents(day, h - 1)"
                    :key="ev.id"
                    class="event-block"
                    :class="{ conflict: ev.has_conflict, dragging: draggingTrial?.id === ev.id }"
                    :style="getEventStyle(ev)"
                    draggable="true"
                    @dragstart="onDragStart($event, ev)"
                    @dragend="onDragEnd"
                    @click.stop="openTrial(ev)"
                  >
                    <div class="eb-time">{{ ev.startStr }}</div>
                    <div class="eb-title">{{ ev.title }}</div>
                    <div class="eb-loc">{{ ev.extendedProps?.courtroom || ev.extendedProps?.location }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card" v-else>
      <el-table :data="trials" v-loading="trialStore.loading">
        <el-table-column label="时间" width="200">
          <template #default="{ row }">
            <div>
              <div style="color:#2d3748;font-weight:500">{{ formatDate(row.start_time) }}</div>
              <div style="color:#718096;font-size:12px">{{ formatTimeRange(row.start_time, row.end_time) }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="case_info.case_no" label="案号" width="150" />
        <el-table-column label="案件名称">
          <template #default="{ row }">{{ row.case_info?.case_name }}</template>
        </el-table-column>
        <el-table-column prop="trial_type_display" label="类型" width="110">
          <template #default="{ row }">
            <el-tag size="small" type="primary">{{ row.trial_type_display }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="地点" prop="location" min-width="160" show-overflow-tooltip />
        <el-table-column label="主办律师" width="110">
          <template #default="{ row }">{{ row.presiding_lawyer_info?.full_name }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag v-if="row.has_conflict" type="danger" size="small" effect="dark" class="danger-pulse">冲突</el-tag>
            <el-tag v-else :type="resultType(row.result)" size="small">{{ row.result_display }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openTrial(row)">详情</el-button>
            <el-button type="danger" link size="small" @click="deleteTrial(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination
          :total="trials.length"
          v-model:current-page="page"
          :page-size="20"
          layout="prev, pager, next"
        />
      </div>
    </div>

    <el-dialog v-model="showForm" :title="isEdit ? '编辑庭审' : '新增庭审'" width="560px">
      <el-form :model="trialForm" :rules="trialRules" ref="trialFormRef" label-width="100px">
        <el-form-item label="关联案件" prop="case">
          <el-select v-model="trialForm.case" filterable style="width:100%">
            <el-option v-for="c in caseList" :key="c.id" :label="`${c.case_no} ${c.case_name}`" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="庭审类型" prop="trial_type">
          <el-select v-model="trialForm.trial_type" style="width:100%">
            <el-option label="一审开庭" value="first_instance" />
            <el-option label="二审开庭" value="second_instance" />
            <el-option label="再审开庭" value="retrial" />
            <el-option label="听证" value="hearing" />
            <el-option label="调解" value="mediation" />
            <el-option label="仲裁开庭" value="arbitration" />
            <el-option label="庭前会议" value="meeting" />
          </el-select>
        </el-form-item>
        <el-form-item label="开庭时间" prop="start_time">
          <el-date-picker
            v-model="startTime"
            type="datetime"
            value-format="YYYY-MM-DDTHH:mm:ss"
            style="width:100%"
          />
        </el-form-item>
        <el-form-item label="结束时间" prop="end_time">
          <el-date-picker
            v-model="endTime"
            type="datetime"
            value-format="YYYY-MM-DDTHH:mm:ss"
            style="width:100%"
          />
        </el-form-item>
        <el-form-item label="地点" prop="location">
          <el-input v-model="trialForm.location" placeholder="法院/仲裁委地址" />
        </el-form-item>
        <el-form-item label="法庭">
          <el-input v-model="trialForm.courtroom" />
        </el-form-item>
        <el-form-item label="主办律师" prop="presiding_lawyer">
          <el-select v-model="trialForm.presiding_lawyer" filterable style="width:100%">
            <el-option v-for="l in lawyerList" :key="l.id" :label="l.full_name" :value="l.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="参与律师">
          <el-select v-model="trialForm.attending_lawyers" multiple filterable style="width:100%">
            <el-option v-for="l in lawyerList" :key="l.id" :label="l.full_name" :value="l.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="法官">
          <el-input v-model="trialForm.judge" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="trialForm.notes" type="textarea" :rows="2" />
        </el-form-item>
        <el-alert
          v-if="conflictResult && conflictResult.has_conflict"
          type="error"
          :closable="false"
          style="margin-bottom:0"
        >
          <div>⚠️ 检测到时间冲突：</div>
          <div v-for="c in conflictResult.conflicts" :key="c.id" style="margin:4px 0">
            {{ c.case_no }} {{ c.case_name }} - {{ formatTime(c.start_time) }}
          </div>
          <div v-if="conflictResult.available_lawyers?.length" style="margin-top:8px">
            推荐备选律师：
            <el-tag v-for="l in conflictResult.available_lawyers" :key="l.id" size="small" style="margin:2px">
              {{ l.full_name }}
            </el-tag>
          </div>
        </el-alert>
      </el-form>
      <template #footer>
        <el-button @click="checkConflict" :disabled="!canCheck">检测冲突</el-button>
        <el-button @click="showForm = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitTrial">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import {
  Plus, ArrowLeft, ArrowRight
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { useTrialStore } from '@/stores/trial'
import { userApi, caseApi } from '@/api/modules'
import dayjs, { Dayjs } from 'dayjs'

const trialStore = useTrialStore()
const trialFormRef = ref<FormInstance>()
const submitting = ref(false)

const viewMode = ref<'month' | 'week' | 'list'>('month')
const currentDate = ref<Dayjs>(dayjs())
const selectedDate = ref<string>('')
const filterLawyer = ref<number | null>(null)
const lawyerList = ref<any[]>([])
const caseList = ref<any[]>([])
const trials = ref<any[]>([])
const page = ref(1)

const showForm = ref(false)
const isEdit = ref(false)
const currentTrial = ref<any>(null)
const conflictResult = ref<any>(null)
const startTime = ref('')
const endTime = ref('')
const draggingTrial = ref<any>(null)
const dragOverDate = ref<string>('')
const dragSaving = ref(false)

const defaultTrialForm = () => ({
  case: null as number | null,
  trial_type: 'first_instance',
  trial_round: 1,
  start_time: '',
  end_time: '',
  location: '',
  courtroom: '',
  presiding_lawyer: null as number | null,
  attending_lawyers: [] as number[],
  judge: '',
  result: 'pending',
  notes: ''
})
const trialForm = reactive<any>(defaultTrialForm())

const trialRules: FormRules = {
  case: [{ required: true, message: '请选择案件' }],
  trial_type: [{ required: true, message: '请选择庭审类型' }],
  start_time: [{ required: true, message: '请选择开庭时间' }],
  presiding_lawyer: [{ required: true, message: '请选择主办律师' }],
}

const canCheck = computed(() => !!trialForm.presiding_lawyer && !!startTime.value)

const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const currentTitle = computed(() => {
  if (viewMode.value === 'month') return currentDate.value.format('YYYY年 M月')
  if (viewMode.value === 'week') {
    const start = currentDate.value.startOf('week')
    const end = currentDate.value.endOf('week')
    return `${start.format('YYYY年M月D日')} - ${end.format('M月D日')}`
  }
  return '全部庭审'
})

const monthDays = computed(() => {
  const events = trialStore.calendarEvents
  const start = currentDate.value.startOf('month').startOf('week')
  const end = currentDate.value.endOf('month').endOf('week')
  const days = []
  let cur = start
  while (cur.isBefore(end) || cur.isSame(end, 'day')) {
    const dateStr = cur.format('YYYY-MM-DD')
    const dayEvents = events.filter((e: any) => dayjs(e.start).format('YYYY-MM-DD') === dateStr)
      .map((e: any) => ({
        ...e,
        startStr: dayjs(e.start).format('HH:mm'),
        color: e.backgroundColor || '#4299e1'
      }))
      .sort((a: any, b: any) => a.start.localeCompare(b.start))
    days.push({
      key: dateStr,
      date: dateStr,
      num: cur.date(),
      otherMonth: cur.month() !== currentDate.value.month(),
      isToday: cur.isSame(dayjs(), 'day'),
      events: dayEvents.slice(0, 3),
      moreCount: Math.max(0, dayEvents.length - 3)
    })
    cur = cur.add(1, 'day')
  }
  return days
})

const weekDaysArr = computed(() => {
  const events = trialStore.calendarEvents
  const start = currentDate.value.startOf('week')
  const days = []
  for (let i = 0; i < 7; i++) {
    const d = start.add(i, 'day')
    const dateStr = d.format('YYYY-MM-DD')
    const dayEvents = events.filter((e: any) => dayjs(e.start).format('YYYY-MM-DD') === dateStr)
      .map((e: any) => ({
        ...e,
        startMin: dayjs(e.start).hour() * 60 + dayjs(e.start).minute(),
        durationMin: Math.max(30, dayjs(e.end || e.start).diff(dayjs(e.start), 'minute')),
        startStr: dayjs(e.start).format('HH:mm')
      }))
    days.push({
      date: dateStr,
      num: d.date(),
      weekday: weekDays[i],
      isToday: d.isSame(dayjs(), 'day'),
      events: dayEvents
    })
  }
  return days
})

const monthTrialCount = computed(() => {
  const events = trialStore.calendarEvents
  const m = currentDate.value.format('YYYY-MM')
  return events.filter((e: any) => dayjs(e.start).format('YYYY-MM') === m).length
})
const conflictCount = computed(() =>
  trialStore.calendarEvents.filter((e: any) => e.extendedProps?.has_conflict).length
)

function formatDate(t: string) { return dayjs(t).format('YYYY-MM-DD') }
function formatTime(t: string) { return dayjs(t).format('HH:mm') }
function formatTimeRange(s: string, e?: string) {
  if (!e) return formatTime(s)
  return `${formatTime(s)} - ${formatTime(e)}`
}
function resultType(r: string) {
  return ({ pending: 'warning', ongoing: 'primary', completed: 'success', postponed: 'info', cancelled: 'danger' } as any)[r] || ''
}

function prev() {
  if (viewMode.value === 'month') currentDate.value = currentDate.value.subtract(1, 'month')
  else currentDate.value = currentDate.value.subtract(1, 'week')
  loadCalendar()
}
function next() {
  if (viewMode.value === 'month') currentDate.value = currentDate.value.add(1, 'month')
  else currentDate.value = currentDate.value.add(1, 'week')
  loadCalendar()
}
function goToday() { currentDate.value = dayjs(); loadCalendar() }

async function loadCalendar() {
  let start: Dayjs, end: Dayjs
  if (viewMode.value === 'month') {
    start = currentDate.value.startOf('month')
    end = currentDate.value.endOf('month')
  } else {
    start = currentDate.value.startOf('week')
    end = currentDate.value.endOf('week')
  }
  await trialStore.fetchCalendar(start, end, filterLawyer.value || undefined)
  if (viewMode.value === 'list') {
    const r = await trialStore.fetchTrials({ page_size: 100 })
    trials.value = (r as any).results
  }
}

function changeView(m: 'month' | 'week' | 'list') {
  viewMode.value = m
  loadCalendar()
}

function selectDay(day: any) {
  selectedDate.value = day.date
  if (day.otherMonth) {
    currentDate.value = dayjs(day.date)
    loadCalendar()
  }
}

function openTrial(ev: any) {
  currentTrial.value = ev
  isEdit.value = true
  conflictResult.value = null
  Object.assign(trialForm, {
    case: ev.extendedProps?.case_id,
    trial_type: ev.extendedProps?.trial_type,
    presiding_lawyer: ev.extendedProps?.presiding_lawyer?.id,
    start_time: ev.start,
    end_time: ev.end,
    location: ev.extendedProps?.location,
    courtroom: ev.extendedProps?.courtroom,
    result: ev.extendedProps?.result
  })
  startTime.value = ev.start
  endTime.value = ev.end
  showForm.value = true
}

function openCreate(date?: string, hour?: number) {
  currentTrial.value = null
  isEdit.value = false
  conflictResult.value = null
  Object.assign(trialForm, defaultTrialForm())
  if (date) {
    const h = hour ?? 9
    startTime.value = dayjs(`${date} ${h.toString().padStart(2, '0')}:00:00`).format('YYYY-MM-DDTHH:mm:ss')
    endTime.value = dayjs(`${date} ${h.toString().padStart(2, '0')}:30:00`).format('YYYY-MM-DDTHH:mm:ss')
  } else {
    const d = dayjs().hour(9).minute(0).second(0)
    startTime.value = d.format('YYYY-MM-DDTHH:mm:ss')
    endTime.value = d.add(1, 'hour').format('YYYY-MM-DDTHH:mm:ss')
  }
  showForm.value = true
}

function slotClick(day: any, hour: number) {
  openCreate(day.date, hour)
}

function getSlotEvents(day: any, hour: number) {
  return day.events.filter((e: any) => Math.floor(e.startMin / 60) === hour)
}
function getEventStyle(ev: any) {
  const top = ((ev.startMin % 60) / 60) * 60
  const height = Math.max(40, (ev.durationMin / 60) * 60 - 4)
  const bg = ev.has_conflict ? '#feb2b2' : (ev.extendedProps?.result === 'completed' ? '#9ae6b4' : '#bee3f8')
  const borderColor = ev.has_conflict ? '#e53e3e' : (ev.extendedProps?.result === 'completed' ? '#38a169' : '#4299e1')
  return {
    top: top + 'px',
    height: height + 'px',
    background: bg,
    borderLeft: `3px solid ${borderColor}`
  }
}

async function checkConflict() {
  if (!trialForm.presiding_lawyer || !startTime.value) return
  const res = await trialStore.checkConflict({
    presiding_lawyer: trialForm.presiding_lawyer,
    start_time: startTime.value,
    end_time: endTime.value || startTime.value,
    exclude_trial_id: currentTrial.value?.id
  })
  conflictResult.value = (res as any).data
}

function syncFormTime() {
  trialForm.start_time = startTime.value
  trialForm.end_time = endTime.value
}

async function submitTrial() {
  if (!trialFormRef.value) return
  syncFormTime()
  await trialFormRef.value.validate()
  submitting.value = true
  try {
    if (isEdit.value && currentTrial.value) {
      await trialStore.updateTrial(currentTrial.value.id, trialForm)
    } else {
      await trialStore.createTrial(trialForm)
    }
    ElMessage.success('保存成功')
    showForm.value = false
    await loadCalendar()
  } catch (e: any) {
    ElMessage.error(e.message || '保存失败')
  } finally { submitting.value = false }
}

async function deleteTrial(t: any) {
  await ElMessageBox.confirm('确定删除该庭审日程吗？', '提示', { type: 'warning' })
  await trialStore.deleteTrial(t.id)
  ElMessage.success('已删除')
  await loadCalendar()
}

function onDragStart(e: DragEvent, ev: any) {
  draggingTrial.value = ev
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(ev.id))
  }
}
function onDragEnd() {
  draggingTrial.value = null
  dragOverDate.value = ''
}
function onMonthDragOver(e: DragEvent, day: any) {
  dragOverDate.value = day.date
}
function onMonthDragLeave(day: any) {
  if (dragOverDate.value === day.date) dragOverDate.value = ''
}
async function onMonthDrop(e: DragEvent, day: any) {
  dragOverDate.value = ''
  const ev = draggingTrial.value
  if (!ev) return
  const oldStart = dayjs(ev.start)
  const oldEnd = dayjs(ev.end || ev.start)
  const durationMin = Math.max(30, oldEnd.diff(oldStart, 'minute'))
  const newDate = dayjs(day.date)
  const newStart = newDate.hour(oldStart.hour()).minute(oldStart.minute()).second(0)
  const newEnd = newStart.add(durationMin, 'minute')
  await applyTrialDrag(ev, newStart, newEnd)
}
async function onWeekDrop(e: DragEvent, day: any, hour: number) {
  const ev = draggingTrial.value
  if (!ev) return
  const oldStart = dayjs(ev.start)
  const oldEnd = dayjs(ev.end || ev.start)
  const durationMin = Math.max(30, oldEnd.diff(oldStart, 'minute'))
  const newStart = dayjs(day.date).hour(hour).minute(0).second(0)
  const newEnd = newStart.add(durationMin, 'minute')
  await applyTrialDrag(ev, newStart, newEnd)
}
async function applyTrialDrag(ev: any, newStart: Dayjs, newEnd: Dayjs) {
  if (dragSaving.value) return
  dragSaving.value = true
  try {
    const trialId = ev.id || ev.extendedProps?.id
    if (!trialId) { ElMessage.warning('无法识别该庭审'); return }
    const payload = {
      case: ev.extendedProps?.case_id,
      trial_type: ev.extendedProps?.trial_type || 'first_instance',
      presiding_lawyer: ev.extendedProps?.presiding_lawyer?.id,
      start_time: newStart.format('YYYY-MM-DDTHH:mm:ss'),
      end_time: newEnd.format('YYYY-MM-DDTHH:mm:ss'),
      location: ev.extendedProps?.location,
      courtroom: ev.extendedProps?.courtroom,
      result: ev.extendedProps?.result || 'pending',
    }
    const conflict = await trialStore.checkConflict({
      presiding_lawyer: payload.presiding_lawyer,
      start_time: payload.start_time,
      end_time: payload.end_time,
      exclude_trial_id: trialId,
    })
    if ((conflict as any)?.data?.has_conflict) {
      await ElMessageBox.alert(
        `⚠️ 检测到时间冲突：${(conflict as any).data.conflicts?.[0]?.case_name || '其他庭审'}，是否仍要调整？`,
        '冲突提示',
        { type: 'warning', confirmButtonText: '仍要调整', cancelButtonText: '取消', showCancelButton: true } as any
      ).catch(() => { throw new Error('cancel') })
    }
    await trialStore.updateTrial(trialId, payload)
    ElMessage.success(`已调整至 ${newStart.format('YYYY-MM-DD HH:mm')}`)
    await loadCalendar()
  } catch (e: any) {
    if (e?.message !== 'cancel') ElMessage.error(e?.message || '调整失败')
  } finally {
    dragSaving.value = false
    draggingTrial.value = null
  }
}

watch([startTime, endTime, () => trialForm.presiding_lawyer], () => { conflictResult.value = null })

onMounted(async () => {
  await Promise.all([
    loadCalendar(),
    userApi.lawyers().then(r => { lawyerList.value = r.data }),
    caseApi.list({ page_size: 200 }).then(r => { caseList.value = (r as any).data?.results || [] })
  ])
})
</script>

<style lang="scss" scoped>
.calendar-view {
  .header-actions {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  .calendar-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #edf2f7;
    .current-title {
      font-size: 18px;
      font-weight: 600;
      color: #2d3748;
      min-width: 160px;
      text-align: center;
    }
  }
  .weekday-header {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    margin-bottom: 8px;
    .weekday {
      text-align: center;
      font-size: 13px;
      font-weight: 600;
      color: #4a5568;
      padding: 8px;
    }
  }
  .days-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 1px;
    background: #e2e8f0;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    overflow: hidden;
    .day-cell {
      background: #fff;
      min-height: 120px;
      padding: 6px;
      cursor: pointer;
      transition: background 0.15s;
      &:hover { background: #f7fafc; }
      &.other-month { background: #f7fafc; opacity: 0.5; }
      &.is-today .day-number {
        background: #1e3a5f;
        color: #fff;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        line-height: 24px;
        text-align: center;
        display: inline-block;
      }
      &.selected { background: #ebf8ff; }
      &.drag-over {
        background: #ebf8ff !important;
        outline: 2px dashed #4299e1;
        outline-offset: -2px;
      }
      .day-number { font-size: 13px; color: #4a5568; font-weight: 500; margin-bottom: 4px; }
      .day-events {
        display: flex;
        flex-direction: column;
        gap: 3px;
        .event-item {
          font-size: 11px;
          padding: 3px 5px;
          border-radius: 3px;
          color: #fff;
          display: flex;
          gap: 4px;
          overflow: hidden;
          cursor: move;
          white-space: nowrap;
          user-select: none;
          &.conflict {
            background: #e53e3e !important;
            animation: pulse-danger 1.5s infinite;
          }
          &.dragging { opacity: 0.4; }
          .ev-time { flex-shrink: 0; }
          .ev-title { overflow: hidden; text-overflow: ellipsis; }
        }
      }
    }
  }
  .week-view {
    .week-grid {
      display: flex;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
    }
    .time-col {
      width: 60px;
      flex-shrink: 0;
      .empty-header { height: 60px; border-bottom: 1px solid #e2e8f0; background: #f7fafc; }
      .time-slot {
        height: 60px;
        font-size: 11px;
        color: #a0aec0;
        padding: 0 6px;
        border-bottom: 1px solid #edf2f7;
        border-right: 1px solid #edf2f7;
      }
    }
    .days-cols {
      flex: 1;
      display: grid;
      grid-template-columns: repeat(7, 1fr);
    }
    .day-col {
      border-left: 1px solid #edf2f7;
      display: flex;
      flex-direction: column;
      min-width: 0;
      &:first-child { border-left: none; }
      .day-header {
        height: 60px;
        background: #f7fafc;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        color: #4a5568;
        .num { font-size: 18px; font-weight: 600; color: #2d3748; margin-top: 2px; }
        &.is-today { background: #ebf8ff;
          .num { color: #1e3a5f; }
        }
      }
      .day-time-slots {
        flex: 1;
        position: relative;
      }
      .slot {
        height: 60px;
        border-bottom: 1px dashed #edf2f7;
        position: relative;
        cursor: pointer;
        &:hover { background: #f7fafc; }
      }
    }
    .event-block {
      position: absolute;
      left: 4px;
      right: 4px;
      padding: 4px 6px;
      border-radius: 4px;
      font-size: 11px;
      overflow: hidden;
      cursor: move;
      z-index: 5;
      user-select: none;
      .eb-time { font-weight: 600; color: #2d3748; }
      .eb-title { color: #2d3748; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .eb-loc { color: #718096; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      &.conflict { background: #fed7d7 !important; border-color: #e53e3e !important; animation: pulse-danger 1.5s infinite; }
      &.dragging { opacity: 0.4; }
    }
  }
  .pagination {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
  }
}
@keyframes pulse-danger { 50% { opacity: 0.6; } }
</style>
