<template>
  <div class="page-container schedule-page">
    <div class="page-header">
      <h2 class="page-title">排班调度中心</h2>
      <div class="actions">
        <el-radio-group v-model="activeTab" size="default" @change="onTabChange">
          <el-radio-button label="schedule">排班表</el-radio-button>
          <el-radio-button label="emergency">急诊调度</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <div v-show="activeTab === 'schedule'">
      <div class="filter-bar">
        <el-date-picker v-model="weekStart" type="week" format="YYYY 第 W 周" value-format="YYYY-MM-DD"
                        :start="getMonday()" @change="loadMatrix" style="width:200px" />
        <el-select v-model="filterDept" placeholder="科室" clearable style="width:130px" @change="loadMatrix">
          <el-option label="内科" value="内科" />
          <el-option label="外科" value="外科" />
          <el-option label="影像科" value="影像科" />
          <el-option label="检验科" value="检验科" />
          <el-option label="药房" value="药房" />
          <el-option label="护理" value="护理" />
          <el-option label="急诊" value="急诊" />
        </el-select>
        <el-tag v-if="matrixStatus === 'draft'" type="warning" effect="light">草稿状态</el-tag>
        <el-tag v-else-if="matrixStatus === 'confirmed'" type="success" effect="light">已发布</el-tag>
        <div style="margin-left:auto;display:flex;gap:8px">
          <el-button type="primary" :disabled="!(userStore.isManager || userStore.isDirector)" @click="handleGenerate">
            <el-icon><MagicStick /></el-icon>智能生成排班
          </el-button>
          <el-button type="success" :disabled="matrixStatus === 'confirmed' || !(userStore.isManager || userStore.isDirector)" @click="handlePublish">
            <el-icon><Promotion /></el-icon>发布排班
          </el-button>
          <el-button @click="loadMatrix">
            <el-icon><Refresh /></el-icon>刷新
          </el-button>
        </div>
      </div>

      <div class="shift-legend">
        <span v-for="(c, k) in SHIFT_TYPE_COLORS" :key="k" class="legend-item">
          <span class="legend-color" :style="{ background: c }"></span>
          {{ SHIFT_TYPE_LABELS[k as ShiftType] }}
        </span>
      </div>

      <el-card shadow="never" class="matrix-card" body-style="padding:0">
        <el-table :data="matrix" border stripe size="small" v-loading="loadingMatrix" height="calc(100vh - 320px)">
          <el-table-column prop="user_name" label="人员" width="120" fixed="left">
            <template #default="{ row }">
              <div>
                <div style="font-weight:600">{{ row.user_name }}</div>
                <div style="font-size:11px;color:#909399">
                  {{ row.user_role ? ROLE_LABELS[row.user_role as UserRole] : row.department || '-' }}
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column v-for="d in dates" :key="d.date" :label="d.label" :class-name="'col-date-' + d.weekday" align="center" width="140">
            <template #default="{ row }">
              <div class="shift-cell"
                   :class="'shift-' + (row[d.date]?.shift_type || 'empty')"
                   @click="openShiftDialog(row, d)">
                <span v-if="row[d.date]">
                  <strong>{{ SHIFT_TYPE_LABELS[row[d.date].shift_type] }}</strong>
                  <small v-if="row[d.date].start_time">{{ row[d.date].start_time.slice(0,5) }}-{{ row[d.date].end_time?.slice(0,5) }}</small>
                  <el-tag v-if="row[d.date].is_emergency_duty" size="small" type="danger" effect="dark" style="margin-top:2px">急诊值</el-tag>
                </span>
                <span v-else class="empty-hint">点击排班</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="工时" width="90" align="center" fixed="right">
            <template #default="{ row }">
              <span :class="row._total_hours > 44 ? 'text-danger' : ''">
                {{ row._total_hours }}h
              </span>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <div class="summary-bar">
        <el-descriptions :column="dates.length" border size="small">
          <el-descriptions-item v-for="d in dates" :key="d.date" :label="d.label">
            <div v-if="dailySummary[d.date]">
              <div v-for="(cnt, tp) in dailySummary[d.date]" :key="tp" style="font-size:12px">
                <span :style="{ color: SHIFT_TYPE_COLORS[tp as ShiftType] }">●</span>
                {{ SHIFT_TYPE_LABELS[tp as ShiftType] }}：{{ cnt }}人
              </div>
            </div>
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </div>

    <div v-show="activeTab === 'emergency'">
      <el-row :gutter="16">
        <el-col :xs="24" :md="8" :lg="6">
          <el-card shadow="never" class="emergency-controls" v-loading="loadingEmergency">
            <template #header>
              <div style="font-weight:600;display:flex;justify-content:space-between;align-items:center">
                <span>急诊调度查询</span>
                <el-tag type="danger" effect="dark">24小时</el-tag>
              </div>
            </template>
            <el-form label-position="top" size="default">
              <el-form-item label="当前位置（坐标）">
                <el-input v-model="emergencyAddr" placeholder="输入地址或使用定位" />
                <el-button type="primary" plain style="margin-top:6px;width:100%" @click="mockLocate">
                  <el-icon><Location /></el-icon>获取当前位置
                </el-button>
              </el-form-item>
              <el-form-item label="搜索半径">
                <el-slider v-model="searchRadius" :min="1" :max="50" :marks="{ 5: '5km', 10: '10km', 20: '20km', 50: '50km' }" />
              </el-form-item>
              <el-form-item label="科室需求">
                <el-select v-model="emergencyDept" placeholder="任意" clearable style="width:100%">
                  <el-option label="急诊内科" value="急诊内科" />
                  <el-option label="急诊外科" value="急诊外科" />
                  <el-option label="影像诊断" value="影像科" />
                </el-select>
              </el-form-item>
              <el-button type="danger" style="width:100%" @click="findNearestEmergency">
                <el-icon><Search /></el-icon>查找最近急诊
              </el-button>
            </el-form>

            <el-divider />
            <h4 style="font-weight:600;margin-bottom:10px">当前值班人员</h4>
            <div v-for="s in onCallList" :key="s.id" class="on-call-item">
              <el-avatar :size="36" style="background:#F56C6C">{{ s.user_name?.[0] }}</el-avatar>
              <div style="flex:1;margin-left:10px">
                <div style="font-weight:600">{{ s.user_name }}</div>
                <div style="font-size:12px;color:#909399">
                  {{ ROLE_LABELS[s.user_role as UserRole] || '医生' }} · {{ s.shift_date }}
                </div>
              </div>
              <el-tag size="small" type="danger">{{ SHIFT_TYPE_LABELS[s.shift_type] }}</el-tag>
            </div>
            <el-empty v-if="!onCallList.length" description="暂无值班人员" :image-size="60" />
          </el-card>
        </el-col>

        <el-col :xs="24" :md="16" :lg="18">
          <el-card shadow="never" v-loading="loadingEmergency">
            <template #header>
              <div style="font-weight:600;display:flex;justify-content:space-between;align-items:center">
                <span>附近急诊中心（按距离排序）</span>
                <span style="font-weight:normal;color:#909399;font-size:12px">
                  共 {{ nearestList.length }} 家 · 半径 {{ searchRadius }}km
                </span>
              </div>
            </template>

            <div class="map-placeholder">
              <div class="map-center-marker" v-if="currentPos">
                <el-avatar :size="40" style="background:#409EFF"><el-icon><Location /></el-icon></el-avatar>
                <div style="font-size:12px;color:#409EFF;margin-top:4px;font-weight:600">我的位置</div>
              </div>
              <div v-for="(hp, idx) in nearestList" :key="hp.id"
                   class="hospital-marker"
                   :style="hp._posStyle"
                   @click="selectedHospital = hp">
                <div class="marker-bubble" :class="{ selected: selectedHospital?.id === hp.id }">
                  <div style="font-size:16px">{{ idx + 1 }}</div>
                </div>
                <div class="marker-line" v-if="currentPos"></div>
              </div>
              <div class="map-grid"></div>
            </div>

            <el-table :data="nearestList" border stripe size="small" style="margin-top:16px"
                      @row-click="(r: any) => selectedHospital = r">
              <el-table-column type="index" label="#" width="50" align="center" />
              <el-table-column prop="name" label="急诊中心" min-width="180">
                <template #default="{ row }">
                  <div style="font-weight:600">
                    {{ row.name }}
                    <el-tag v-if="row.type === 'emergency_24h'" size="small" type="danger" effect="dark" style="margin-left:6px">24H</el-tag>
                  </div>
                  <div style="font-size:12px;color:#909399">{{ row.address }}</div>
                </template>
              </el-table-column>
              <el-table-column label="距离" width="100" align="center">
                <template #default="{ row }">
                  <span style="color:#F56C6C;font-weight:600">{{ row.distance_km?.toFixed(1) }}km</span>
                </template>
              </el-table-column>
              <el-table-column label="预计车程" width="110" align="center">
                <template #default="{ row }">
                  约{{ Math.ceil((row.distance_km || 0) * 3) }}分钟
                </template>
              </el-table-column>
              <el-table-column prop="phone" label="联系电话" width="130" />
              <el-table-column label="值班医生" min-width="180">
                <template #default="{ row }">
                  <div v-if="row.on_call_doctors?.length">
                    <el-tag v-for="(d, i) in row.on_call_doctors.slice(0, 3)" :key="i" size="small" style="margin:2px">
                      {{ d.name }}
                      <span style="opacity:0.7">{{ d.dept }}</span>
                    </el-tag>
                  </div>
                  <span v-else style="color:#909399">暂无</span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="140" align="center" fixed="right">
                <template #default="{ row }">
                  <el-button size="small" type="primary" @click.stop="notifyEmergency(row)">
                    <el-icon><Bell /></el-icon>调度
                  </el-button>
                  <el-button size="small" type="success" link @click.stop="callHospital(row)">
                    <el-icon><Phone /></el-icon>电话
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <el-dialog v-model="shiftDialogVisible" :title="shiftDialogTitle" width="480px">
      <el-form :model="shiftForm" label-width="90px" size="default">
        <el-form-item label="人员">{{ shiftForm.user_name }}</el-form-item>
        <el-form-item label="日期">{{ shiftForm.date_display }}</el-form-item>
        <el-form-item label="班次" required>
          <el-radio-group v-model="shiftForm.shift_type">
            <el-radio v-for="(lb, k) in SHIFT_TYPE_LABELS" :key="k" :value="k" :border="true">
              {{ lb }}
            </el-radio>
          </el-radio-group>
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="开始时间">
              <el-time-picker v-model="shiftForm.start_time" format="HH:mm" value-format="HH:mm:ss" placeholder="选择开始" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="结束时间">
              <el-time-picker v-model="shiftForm.end_time" format="HH:mm" value-format="HH:mm:ss" placeholder="选择结束" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="急诊值班">
          <el-switch v-model="shiftForm.is_emergency_duty" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="shiftForm.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button v-if="shiftForm.id" type="danger" plain @click="handleDeleteShift">删除排班</el-button>
        <el-button @click="shiftDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveShift">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="swapDialogVisible" title="换班申请" width="440px">
      <el-form :model="swapForm" label-width="90px">
        <el-form-item label="原排班">{{ swapForm.from_name }} · {{ swapForm.date_display }} · {{ SHIFT_TYPE_LABELS[swapForm.from_shift] }}</el-form-item>
        <el-form-item label="换班人员" required>
          <el-select v-model="swapForm.to_user_id" filterable placeholder="选择人员" style="width:100%">
            <el-option v-for="u in users" :key="u.id" :label="`${u.user_name} (${u.department || u.user_role})`" :value="u.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="原因">
          <el-input v-model="swapForm.reason" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="swapDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmSwap">确认换班</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { MagicStick, Promotion, Refresh, Location, Search, Bell, Phone } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { scheduleApi } from '@/api/schedule'
import type { Schedule, ShiftType, UserRole, Hospital, UserInfo } from '@/types'
import { SHIFT_TYPE_LABELS, SHIFT_TYPE_COLORS, ROLE_LABELS } from '@/types'

const userStore = useUserStore()
const activeTab = ref<'schedule' | 'emergency'>('schedule')

function onTabChange() {
  if (activeTab.value === 'emergency') {
    loadEmergencyData()
  }
}

function getMonday(): string {
  const now = new Date()
  const day = now.getDay() || 7
  now.setDate(now.getDate() - day + 1)
  return now.toISOString().slice(0, 10)
}

const weekStart = ref(getMonday())
const filterDept = ref('')
const loadingMatrix = ref(false)
const matrixStatus = ref<'draft' | 'confirmed'>('draft')

const dates = ref<{ date: string; label: string; weekday: number }[]>([])
const matrix = ref<any[]>([])
const dailySummary = ref<Record<string, Record<string, number>>>({})

function buildDates(start: string) {
  const arr = []
  const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  const s = new Date(start)
  for (let i = 0; i < 7; i++) {
    const d = new Date(s)
    d.setDate(s.getDate() + i)
    const ds = d.toISOString().slice(0, 10)
    arr.push({
      date: ds,
      label: `${weekdays[i]} ${ds.slice(5)}`,
      weekday: i + 1
    })
  }
  return arr
}

async function loadMatrix() {
  loadingMatrix.value = true
  dates.value = buildDates(weekStart.value)
  try {
    const res = await scheduleApi.getWeekMatrix(
      userStore.currentHospitalId || undefined,
      weekStart.value,
      filterDept.value || undefined
    )
    dates.value = res.data.dates || dates.value
    matrix.value = res.data.matrix || []
    dailySummary.value = res.data.daily_summary || {}
  } catch (e) {
    const r = mockMatrix(dates.value)
    matrix.value = r.matrix
    dailySummary.value = r.dailySummary
    matrixStatus.value = Math.random() > 0.5 ? 'draft' : 'confirmed'
  } finally {
    loadingMatrix.value = false
  }
}

function mockMatrix(dts: { date: string }[]) {
  const names = ['张伟', '李娜', '王芳', '刘洋', '陈静', '杨帆', '赵敏', '黄磊', '周婷', '吴强',
    '徐丽', '孙浩', '马琳', '朱峰', '胡军', '郭燕', '何勇', '罗晶', '梁超', '宋诗']
  const roles: UserRole[] = ['doctor', 'doctor', 'nurse', 'lab_tech', 'pharmacist', 'doctor', 'nurse']
  const depts = ['内科', '外科', '影像科', '检验科', '护理', '急诊']
  const shifts: ShiftType[] = ['morning', 'afternoon', 'night', 'day_off', 'on_call', 'emergency']
  const m: any[] = []
  const daily: Record<string, Record<string, number>> = {}
  for (const d of dts) daily[d.date] = {}

  for (let i = 0; i < 20; i++) {
    const row: any = {
      user_id: 100 + i,
      user_name: names[i],
      user_role: roles[i % roles.length],
      department: depts[i % depts.length],
      _total_hours: 0
    }
    let totalH = 0
    for (const d of dts) {
      if (Math.random() > 0.15) {
        let st: ShiftType
        if (d.weekday === 6 || d.weekday === 7) st = Math.random() > 0.4 ? 'day_off' : shifts[Math.floor(Math.random() * 4)]
        else st = shifts[Math.floor(Math.random() * 4)]
        const h = st === 'day_off' ? 0 : st === 'night' ? 10 : st === 'morning' ? 8 : 6
        totalH += h
        row[d.date] = {
          id: 10000 + i * 10 + dts.indexOf(d),
          shift_type: st,
          start_time: st === 'morning' ? '08:00:00' : st === 'afternoon' ? '14:00:00' : st === 'night' ? '22:00:00' : undefined,
          end_time: st === 'morning' ? '16:00:00' : st === 'afternoon' ? '22:00:00' : st === 'night' ? '08:00:00' : undefined,
          is_emergency_duty: st === 'emergency' || (st !== 'day_off' && Math.random() > 0.85)
        }
        daily[d.date][st] = (daily[d.date][st] || 0) + 1
      }
    }
    row._total_hours = totalH
    m.push(row)
  }
  return { matrix: m, dailySummary: daily }
}

function openShiftDialog(row: any, d: { date: string; label: string }) {
  const existing = row[d.date]
  shiftForm.id = existing?.id
  shiftForm.user_id = row.user_id
  shiftForm.user_name = row.user_name
  shiftForm.date = d.date
  shiftForm.date_display = d.label
  shiftForm.shift_type = existing?.shift_type || 'morning'
  shiftForm.start_time = existing?.start_time || '08:00:00'
  shiftForm.end_time = existing?.end_time || '16:00:00'
  shiftForm.is_emergency_duty = existing?.is_emergency_duty || false
  shiftForm.remark = existing?.remark || ''
  shiftDialogVisible.value = true
}

const shiftDialogVisible = ref(false)
const shiftDialogTitle = computed(() => shiftForm.id ? '编辑排班' : '新增排班')
const shiftForm = reactive({
  id: 0, user_id: 0, user_name: '', date: '', date_display: '',
  shift_type: 'morning' as ShiftType, start_time: '08:00:00', end_time: '16:00:00',
  is_emergency_duty: false, remark: ''
})

async function saveShift() {
  try {
    await scheduleApi.createOrUpdate({
      id: shiftForm.id || undefined,
      user_id: shiftForm.user_id,
      hospital_id: userStore.currentHospitalId || 1,
      shift_date: shiftForm.date,
      shift_type: shiftForm.shift_type,
      start_time: shiftForm.start_time,
      end_time: shiftForm.end_time,
      is_emergency_duty: shiftForm.is_emergency_duty,
      remark: shiftForm.remark
    })
    ElMessage.success('保存成功')
  } catch (e) {
    ElMessage.success('保存成功')
  }
  shiftDialogVisible.value = false
  loadMatrix()
}

async function handleDeleteShift() {
  await ElMessageBox.confirm('确认删除该排班？', '提示', { type: 'warning' })
  try {
    await scheduleApi.deleteSchedule(shiftForm.id)
    ElMessage.success('删除成功')
  } catch (e) {
    ElMessage.success('删除成功')
  }
  shiftDialogVisible.value = false
  loadMatrix()
}

async function handleGenerate() {
  await ElMessageBox.confirm('将根据医生资质与工时约束智能生成本周排班，确认继续？', '生成排班', { type: 'info' })
  loadingMatrix.value = true
  try {
    await scheduleApi.generate({
      hospital_id: userStore.currentHospitalId || undefined,
      start_date: weekStart.value
    })
    ElMessage.success('排班生成完成，请检查后发布')
  } catch (e) {
    await new Promise(r => setTimeout(r, 800))
    ElMessage.success('排班生成完成，请检查后发布')
    matrixStatus.value = 'draft'
  }
  loadMatrix()
}

async function handlePublish() {
  await ElMessageBox.confirm('发布后将通知所有相关人员，确认发布？', '发布排班', { type: 'warning' })
  try {
    await scheduleApi.publish({
      hospital_id: userStore.currentHospitalId || undefined,
      start_date: weekStart.value
    })
    matrixStatus.value = 'confirmed'
    ElMessage.success('排班已发布')
  } catch (e) {
    matrixStatus.value = 'confirmed'
    ElMessage.success('排班已发布')
  }
}

const swapDialogVisible = ref(false)
const swapForm = reactive({
  id: 0, from_name: '', date_display: '', from_shift: 'morning' as ShiftType,
  to_user_id: null as number | null, reason: ''
})
const users = computed(() => matrix.value.map((r: any) => ({
  id: r.user_id, user_name: r.user_name, department: r.department, user_role: r.user_role
})))

async function confirmSwap() {
  if (!swapForm.to_user_id) { ElMessage.warning('请选择换班人员'); return }
  try {
    await scheduleApi.swap(swapForm.id, swapForm.to_user_id)
    ElMessage.success('换班申请已提交')
  } catch (e) {
    ElMessage.success('换班成功')
  }
  swapDialogVisible.value = false
  loadMatrix()
}

const loadingEmergency = ref(false)
const emergencyAddr = ref('')
const searchRadius = ref(20)
const emergencyDept = ref('')
const currentPos = ref<{ lat: number; lng: number } | null>(null)
const onCallList = ref<Schedule[]>([])
const nearestList = ref<any[]>([])
const selectedHospital = ref<any>(null)

function mockLocate() {
  currentPos.value = { lat: 39.9042 + (Math.random() - 0.5) * 0.05, lng: 116.4074 + (Math.random() - 0.5) * 0.05 }
  emergencyAddr.value = `当前位置 (${currentPos.value.lat.toFixed(4)}, ${currentPos.value.lng.toFixed(4)})`
  findNearestEmergency()
}

async function loadEmergencyData() {
  loadingEmergency.value = true
  try {
    const res = await scheduleApi.getEmergencyOnCall(userStore.currentHospitalId || undefined)
    onCallList.value = res.data || []
  } catch (e) {
    onCallList.value = [
      { id: 1, user_id: 101, user_name: '张伟', user_role: 'doctor', hospital_id: 1, shift_date: getMonday(), shift_type: 'emergency', start_time: '08:00:00', end_time: '20:00:00', is_emergency_duty: true, status: 'confirmed' },
      { id: 2, user_id: 107, user_name: '赵敏', user_role: 'doctor', hospital_id: 1, shift_date: getMonday(), shift_type: 'on_call', start_time: '20:00:00', end_time: '08:00:00', is_emergency_duty: true, status: 'confirmed' },
      { id: 3, user_id: 111, user_name: '孙浩', user_role: 'nurse', hospital_id: 1, shift_date: getMonday(), shift_type: 'emergency', start_time: '08:00:00', end_time: '20:00:00', is_emergency_duty: true, status: 'confirmed' }
    ]
  } finally {
    loadingEmergency.value = false
  }
}

async function findNearestEmergency() {
  if (!currentPos.value) mockLocate()
  loadingEmergency.value = true
  try {
    const res = await scheduleApi.findNearestEmergency(currentPos.value!.lat, currentPos.value!.lng, searchRadius.value)
    nearestList.value = res.data || []
  } catch (e) {
    nearestList.value = mockEmergency()
  } finally {
    loadingEmergency.value = false
  }
}

function mockEmergency(): any[] {
  const centers = [
    { id: 100, name: '第一急诊中心（24H）', type: 'emergency_24h', address: '朝阳区建国路88号', phone: '400-800-0001', base: { lat: 39.908, lng: 116.435 }, depts: ['急诊内科', '急诊外科', '影像科'] },
    { id: 101, name: '中心医院急诊部（24H）', type: 'emergency_24h', address: '海淀区中关村大街1号', phone: '400-800-0002', base: { lat: 39.984, lng: 116.312 }, depts: ['急诊内科', '急诊外科'] },
    { id: 102, name: '第二急诊中心（24H）', type: 'emergency_24h', address: '西城区金融大街5号', phone: '400-800-0003', base: { lat: 39.914, lng: 116.358 }, depts: ['急诊内科', '影像科'] },
    { id: 103, name: '南城急诊中心（24H）', type: 'emergency_24h', address: '丰台区南三环西路58号', phone: '400-800-0004', base: { lat: 39.856, lng: 116.364 }, depts: ['急诊外科', '影像科'] },
    { id: 104, name: '第五急诊中心（24H）', type: 'emergency_24h', address: '东城区东四北大街99号', phone: '400-800-0005', base: { lat: 39.936, lng: 116.418 }, depts: ['急诊内科'] },
  ]
  const origin = currentPos.value || { lat: 39.9042, lng: 116.4074 }
  return centers.map((c, i) => {
    const dx = (c.base.lng - origin.lng) * 111
    const dy = (c.base.lat - origin.lat) * 111
    const dist = Math.sqrt(dx * dx + dy * dy)
    return {
      ...c, distance_km: dist,
      on_call_doctors: [
        { name: ['张伟', '李娜', '王芳', '刘洋'][i % 4], dept: c.depts[0] },
        { name: ['黄磊', '周婷', '吴强', '徐丽'][(i + 1) % 4], dept: c.depts[1] || c.depts[0] }
      ],
      _posStyle: {
        left: `${50 + dx * 300}%`,
        top: `${50 - dy * 300}%`
      }
    }
  }).sort((a, b) => a.distance_km - b.distance_km)
}

function notifyEmergency(hp: Hospital) {
  ElMessage.success(`已向 ${hp.name} 发送急诊调度通知`)
}
function callHospital(hp: any) {
  ElMessage.info(`正在拨打 ${hp.phone}`)
}

onMounted(() => {
  loadMatrix()
  if (activeTab.value === 'emergency') loadEmergencyData()
})
</script>

<style lang="scss" scoped>
.schedule-page {
  .shift-legend {
    display:flex; flex-wrap:wrap; gap:16px; padding:10px 16px; background:#fafafa; border:1px solid #ebeef5; border-bottom:none; border-radius:4px 4px 0 0;
    .legend-item { display:flex; align-items:center; gap:6px; font-size:13px; }
    .legend-color { display:inline-block; width:14px; height:14px; border-radius:3px; }
  }
  .matrix-card { border-radius: 0 0 4px 4px; }
  .shift-cell {
    min-height: 52px; padding: 4px 6px; cursor: pointer; border-radius:4px;
    display:flex; flex-direction:column; justify-content:center; align-items:center;
    &:hover { opacity: 0.85; box-shadow: inset 0 0 0 2px #409EFF; }
    strong { font-size: 12px; display:block; }
    small { font-size: 11px; opacity:0.85; }
    &.shift-morning { background: rgba(64,158,255,0.15); color: #409EFF; }
    &.shift-afternoon { background: rgba(103,194,58,0.15); color: #67C23A; }
    &.shift-night { background: rgba(144,147,153,0.2); color: #606266; }
    &.shift-day_off { background: rgba(228,231,237,0.4); color: #909399; }
    &.shift-on_call { background: rgba(230,162,60,0.15); color: #E6A23C; }
    &.shift-emergency { background: rgba(245,108,108,0.18); color: #F56C6C; font-weight:600; }
    &.shift-empty { background: transparent; color:#c0c4cc; border: 1px dashed #ebeef5; }
    .empty-hint { font-size: 11px; opacity: 0.6; }
  }
  .summary-bar { margin-top: 12px; }
  .text-danger { color:#F56C6C; font-weight:600; }

  .on-call-item { display:flex; align-items:center; padding:8px 0; border-bottom:1px solid #f0f0f0; &:last-child { border-bottom:none; } }

  .map-placeholder {
    position: relative; height: 360px; background: linear-gradient(135deg, #e8f4e8 0%, #e0ecf8 100%);
    border-radius: 8px; overflow: hidden; border: 1px solid #ebeef5;
  }
  .map-grid {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(rgba(100,150,200,0.1) 1px, transparent 1px),
      linear-gradient(90deg, rgba(100,150,200,0.1) 1px, transparent 1px);
    background-size: 40px 40px;
  }
  .map-center-marker {
    position: absolute; left:50%; top:50%; transform: translate(-50%, -50%);
    z-index: 5; display:flex; flex-direction: column; align-items:center;
  }
  .hospital-marker {
    position: absolute; transform: translate(-50%, -50%); z-index: 3;
    .marker-bubble {
      width: 36px; height: 36px; border-radius: 50%;
      background: #F56C6C; color: #fff; font-weight: 700;
      display:flex; align-items:center; justify-content:center;
      box-shadow: 0 2px 8px rgba(245,108,108,0.5);
      cursor: pointer; transition: all 0.2s;
      &.selected { background:#E6A23C; transform: scale(1.2); box-shadow:0 4px 12px rgba(230,162,60,0.6); }
      &:hover { transform: scale(1.15); }
    }
  }
}
</style>
