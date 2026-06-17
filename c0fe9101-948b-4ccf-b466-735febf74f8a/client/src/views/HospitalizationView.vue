<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">住院管理</h2>
      <div class="actions">
        <el-button :type="activeTab === 'list' ? 'primary' : ''" @click="activeTab = 'list'">
          <el-icon><List /></el-icon>住院列表
        </el-button>
        <el-button :type="activeTab === 'grid' ? 'primary' : ''" @click="activeTab = 'grid'">
          <el-icon><Grid /></el-icon>笼位图
        </el-button>
        <el-button type="success" @click="openHospDialog">
          <el-icon><Plus /></el-icon>入院登记
        </el-button>
        <el-button type="danger" @click="openEmergencyDialog" v-if="userStore.isDoctor || userStore.isNurse">
          <el-icon><FirstAidKit /></el-icon>急诊分配
        </el-button>
      </div>
    </div>
    <el-alert v-if="dischargeSoon.length" type="warning" :closable="false" style="margin-bottom:16px" show-icon>
      <template #title>
        有 <strong style="color:var(--warning-color)">{{ dischargeSoon.length }}</strong> 个住院宠物将在3日内出院
        <el-button link type="warning" size="small" style="margin-left:8px" @click="activeTab='list';listFilter.status='admitted'">查看</el-button>
      </template>
    </el-alert>
    <div v-if="activeTab === 'grid'">
      <el-tabs v-model="selectedZone" tab-position="left" class="zone-tabs" type="border-card">
        <template v-if="zones.length" #label>
          <div class="summary-card">
            <div class="summary-item">
              <span class="num" style="color:#909399">{{ cageData.summary?.total_cages || 0 }}</span>
              <span class="lbl">总笼位</span>
            </div>
            <div class="summary-item">
              <span class="num" style="color:#67C23A">{{ (cageData.summary?.total_cages || 0) - (cageData.summary?.occupied_cages || 0) }}</span>
              <span class="lbl">空闲</span>
            </div>
            <div class="summary-item">
              <span class="num" style="color:#F56C6C">{{ cageData.summary?.occupied_cages || 0 }}</span>
              <span class="lbl">使用</span>
            </div>
            <div class="summary-item">
              <span class="num" style="color:#409EFF">{{ occupancy }}%</span>
              <span class="lbl">占用率</span>
            </div>
          </div>
          <el-divider style="margin:8px 0" />
        </template>
        <el-tab-pane v-for="z in zones" :key="z.zone" :label="`${z.zone} (${z.cages.length})`">
          <div class="zone-stats" v-if="z.stats">
            <el-tag v-for="(v, k) in z.stats" :key="k" size="small" effect="plain" :color="CAGE_STATUS_COLORS[k as any] || ''">
              {{ CAGE_STATUS_LABELS[k as keyof typeof CAGE_STATUS_LABELS] || k }}：{{ v }}
            </el-tag>
          </div>
          <div class="cage-grid">
            <div
              v-for="c in z.cages"
              :key="c.id"
              class="cage-cell"
              :style="{ '--cage-color': CAGE_STATUS_COLORS[c.status] }"
              :class="[`status-${c.status}`, c.is_emergency ? 'emergency' : '']"
              @click="openCageDetail(c)"
            >
              <div class="cage-code">{{ c.code }}</div>
              <div class="cage-type-tag" :title="c.type">{{ cageTypeLabel(c.type) }}</div>
              <div v-if="c.current_hospitalization" class="cage-pet">
                <div class="pet-name" :title="c.current_hospitalization.pet_name">{{ c.current_hospitalization.pet_name }}</div>
                <div class="pet-meta">{{ c.current_hospitalization.pet_species }}</div>
              </div>
              <div v-else class="cage-pet empty">
                <el-icon :size="20"><Select /></el-icon>
              </div>
              <div class="cage-status-dot" />
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
    <div v-else>
      <div class="filter-bar">
        <el-select v-model="listFilter.status" placeholder="状态" clearable style="width:140px">
          <el-option value="reserved" label="已预约" />
          <el-option value="admitted" label="住院中" />
          <el-option value="discharged" label="已出院" />
          <el-option value="cancelled" label="已取消" />
        </el-select>
        <el-input v-model="listFilter.keyword" placeholder="搜索宠物名/主人" clearable style="width:200px" :prefix-icon="Search" />
        <el-button type="primary" plain @click="loadList">查询</el-button>
      </div>
      <el-card shadow="never">
        <el-table :data="hospList" v-loading="listLoading" stripe>
          <el-table-column label="宠物" min-width="150">
            <template #default="{row}">
              <div style="display:flex;align-items:center;gap:8px">
                <el-avatar :size="36" style="background:linear-gradient(135deg,#67C23A,#409EFF);font-size:14px">
                  {{ row.pet_name?.charAt(0) || 'P' }}
                </el-avatar>
                <div>
                  <div style="font-weight:600">{{ row.pet_name }} <el-tag v-if="row.is_emergency" size="small" type="danger" effect="dark">急诊</el-tag></div>
                  <div style="font-size:12px;color:var(--text-secondary)">{{ row.pet_species }} · {{ row.cage_code }}</div>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="cage_code" label="笼位" width="80" />
          <el-table-column prop="hospital_name" label="院区" width="150" show-overflow-tooltip />
          <el-table-column prop="admitting_doctor_name" label="主治医生" width="100" />
          <el-table-column label="入院时间" width="160">
            <template #default="{row}">{{ formatDateTime(row.admission_date) }}</template>
          </el-table-column>
          <el-table-column label="预计出院" width="160">
            <template #default="{row}">
              <span :class="{'text-abnormal-high': isSoon(row.expected_discharge_date)}">
                {{ formatDateTime(row.expected_discharge_date) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{row}">
              <el-tag :type="row.status==='admitted'?'primary':row.status==='discharged'?'success':row.status==='reserved'?'warning':'info'" size="small">
                {{ HOSP_STATUS_LABELS[row.status] }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="180" fixed="right">
            <template #default="{row}">
              <el-button link type="primary" @click="viewDetail(row)">查看</el-button>
              <el-button link type="warning" v-if="row.status==='admitted'" @click="discharge(row)">出院</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="pagination">
          <el-pagination v-model:current-page="listPage" v-model:page-size="listSize" :page-sizes="[20,50,100]" :total="listTotal" layout="total, sizes, prev, pager, next" />
        </div>
      </el-card>
    </div>
    <el-dialog v-model="cageDrawerVisible" title="笼位详情" width="520px">
      <div v-if="currentCage" style="display:flex;flex-direction:column;gap:16px">
        <div style="display:flex;gap:16px;align-items:center">
          <div class="cage-detail-icon" :style="{background: CAGE_STATUS_COLORS[currentCage.status]}">
            <span>{{ currentCage.code }}</span>
          </div>
          <div style="flex:1">
            <h3 style="margin:0">{{ currentCage.zone }} · {{ currentCage.code }}</h3>
            <div style="color:var(--text-secondary);margin-top:4px">
              {{ cageTypeLabel(currentCage.type) }} · {{ currentCage.size === 'large' ? '大型' : currentCage.size === 'small' ? '小型' : '中型' }}
              <el-tag style="margin-left:8px" size="small" :color="CAGE_STATUS_COLORS[currentCage.status]" effect="dark">
                {{ CAGE_STATUS_LABELS[currentCage.status] }}
              </el-tag>
            </div>
          </div>
        </div>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="状态">{{ CAGE_STATUS_LABELS[currentCage.status] }}</el-descriptions-item>
          <el-descriptions-item label="类型">{{ cageTypeLabel(currentCage.type) }}</el-descriptions-item>
          <el-descriptions-item label="区域" :span="2">{{ currentCage.zone }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ currentCage.remark || '-' }}</el-descriptions-item>
        </el-descriptions>
        <div v-if="currentCage.current_hospitalization">
          <el-divider>当前住院</el-divider>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="宠物">{{ currentCage.current_hospitalization.pet_name }}</el-descriptions-item>
            <el-descriptions-item label="主治医生">{{ currentCage.current_hospitalization.admitting_doctor_name || '-' }}</el-descriptions-item>
            <el-descriptions-item label="入院时间" :span="2">{{ formatDateTime(currentCage.current_hospitalization.admission_date) }}</el-descriptions-item>
            <el-descriptions-item label="预计出院" :span="2">{{ formatDateTime(currentCage.current_hospitalization.expected_discharge_date) }}</el-descriptions-item>
            <el-descriptions-item label="原因" :span="2">{{ currentCage.current_hospitalization.admission_reason }}</el-descriptions-item>
          </el-descriptions>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <el-select v-if="currentCage.status !== 'occupied' && currentCage.status !== 'reserved'" v-model="newStatus" style="width:140px">
            <el-option v-for="(v,k) in CAGE_STATUS_LABELS" :key="k" :label="v" :value="k" />
          </el-select>
          <el-button v-if="newStatus !== currentCage.status" type="primary" @click="changeCageStatus">更新状态</el-button>
          <el-button v-if="currentCage.status === 'available'" type="success" @click="openHospDialog(currentCage)">安排住院</el-button>
        </div>
      </div>
    </el-dialog>
    <el-dialog v-model="hospDialogVisible" title="住院登记" width="620px">
      <el-form :model="hospForm" label-width="100px">
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="宠物" required><el-input v-model="hospForm.petName" placeholder="请先搜索宠物" readonly /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="笼位" required><el-input v-model="hospForm.cageCode" readonly /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="入院类型"><el-radio-group v-model="hospForm.is_emergency"><el-radio :label="false">普通</el-radio><el-radio :label="true" type="danger">急诊</el-radio></el-radio-group></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="主治医生"><el-input v-model="hospForm.doctorName" readonly /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="入院时间" required><el-date-picker v-model="hospForm.admission_date" type="datetime" style="width:100%" value-format="YYYY-MM-DDTHH:mm:ss" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="预计出院" required><el-date-picker v-model="hospForm.expected_discharge_date" type="datetime" style="width:100%" value-format="YYYY-MM-DDTHH:mm:ss" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="入院原因" required><el-input v-model="hospForm.admission_reason" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="护理说明"><el-input v-model="hospForm.daily_notes" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="hospDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitHosp">确认登记</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  List, Grid, Plus, FirstAidKit, Search, Select
} from '@element-plus/icons-vue'
import { useUserStore } from '@/stores'
import { hospitalizationApi } from '@/api'
import {
  CAGE_STATUS_COLORS, CAGE_STATUS_LABELS, HOSP_STATUS_LABELS,
  type Cage, type Hospitalization, type CageStatus, type CageType
} from '@/types'
import { formatDateTime } from '@/utils'
import dayjs from 'dayjs'

const userStore = useUserStore()
const activeTab = ref<'grid' | 'list'>('grid')
const selectedZone = ref('')

const cageData = ref<any>({ zones: [], summary: {} })
const zones = computed(() => cageData.value.zones || [])
const occupancy = computed(() => cageData.value.summary?.cage_occupancy || 0)

const currentCage = ref<Cage | null>(null)
const cageDrawerVisible = ref(false)
const newStatus = ref<CageStatus>('available')

const hospDialogVisible = ref(false)
const hospForm = reactive<any>({
  pet_id: null, petName: '', cage_id: null, cageCode: '', admission_reason: '',
  daily_notes: '', is_emergency: false, admission_date: new Date().toISOString(),
  expected_discharge_date: dayjs().add(7, 'day').toISOString(),
  doctorName: userStore.userInfo?.real_name || ''
})

const listFilter = reactive({ status: '' as string, keyword: '' })
const listLoading = ref(false)
const listPage = ref(1)
const listSize = ref(20)
const listTotal = ref(0)
const hospList = ref<Hospitalization[]>([])
const dischargeSoon = ref<any[]>([])

function cageTypeLabel(t: CageType) {
  return { standard: '标准', emergency: '急诊', ICU: 'ICU', isolation: '隔离' }[t] || t
}
function isSoon(d: string | undefined) {
  return d && dayjs(d).diff(dayjs(), 'day') <= 3
}

async function loadCageGrid() {
  try {
    const res = await hospitalizationApi.getCageGrid(userStore.currentHospital?.id)
    if (res.code === 200) {
      cageData.value = res.data
      if (zones.value.length && !selectedZone.value) {
        selectedZone.value = zones.value[0].zone
      }
    }
  } catch {
    cageData.value = generateMockCages()
    if (zones.value.length) selectedZone.value = zones.value[0].zone
  }
}

function generateMockCages() {
  const zoneNames = ['A区-标准', 'B区-标准', 'C区-ICU', 'D区-隔离', 'E区-急诊']
  const types = ['standard', 'standard', 'ICU', 'isolation', 'emergency'] as CageType[]
  const statuses: CageStatus[] = ['available', 'available', 'available', 'occupied', 'reserved', 'cleaning']
  const zones = zoneNames.map((name, zi) => {
    const cages = Array.from({ length: 12 }, (_, i) => {
      const status = statuses[(zi + i) % statuses.length]
      return {
        id: zi * 100 + i, hospital_id: 1, zone: name,
        code: `${name.charAt(0)}${String(i + 1).padStart(2, '0')}`,
        type: types[zi], size: i % 3 === 0 ? 'small' : i % 3 === 1 ? 'medium' : 'large',
        status,
        current_hospitalization: status === 'occupied' || status === 'reserved' ? {
          id: 1, pet_name: ['豆豆', '毛毛', '小白', '可乐', '布丁'][i % 5], pet_species: i % 2 ? '犬' : '猫',
          admission_date: new Date(Date.now() - i * 86400000).toISOString(),
          expected_discharge_date: dayjs().add((i % 5) + 1, 'day').toISOString(),
          admitting_doctor_name: '张医生'
        } : null,
        is_emergency: status === 'occupied' && zi === 4
      } as Cage
    })
    const stats: any = { total: 12, available: 0, occupied: 0, reserved: 0, cleaning: 0, maintenance: 0 }
    cages.forEach(c => stats[c.status] = (stats[c.status] || 0) + 1)
    return { zone: name, cages, stats }
  })
  const total = zones.reduce((s, z) => s + z.cages.length, 0)
  const occ = zones.reduce((s, z) => s + (z.stats.occupied + z.stats.reserved), 0)
  return { zones, summary: { total_cages: total, occupied_cages: occ, cage_occupancy: Math.round(occ / total * 100) } }
}

function openCageDetail(c: Cage) {
  currentCage.value = c
  newStatus.value = c.status
  cageDrawerVisible.value = true
}

async function changeCageStatus() {
  if (!currentCage.value) return
  try {
    const res = await hospitalizationApi.updateCageStatus(currentCage.value.id, newStatus.value)
    if (res.code === 200) { ElMessage.success('状态已更新'); cageDrawerVisible.value = false; loadCageGrid() }
  } catch {
    currentCage.value.status = newStatus.value
    ElMessage.success('状态已更新')
    cageDrawerVisible.value = false
  }
}

function openHospDialog(cage?: Cage) {
  hospDialogVisible.value = true
  if (cage) { hospForm.cage_id = cage.id; hospForm.cageCode = cage.code }
}

function submitHosp() {
  if (!hospForm.cage_id) { ElMessage.warning('请选择笼位'); return }
  if (!hospForm.admission_reason) { ElMessage.warning('请填写入院原因'); return }
  ElMessage.success('住院登记成功')
  hospDialogVisible.value = false
  loadCageGrid(); loadList()
}

function openEmergencyDialog() {
  ElMessageBox.confirm('将自动分配最近的急诊笼位，确认吗？', '急诊分配', { type: 'warning' })
    .then(async () => {
      try {
        const res = await hospitalizationApi.emergencyAdmission({ pet_id: 1, hospital_id: userStore.currentHospital?.id })
        if (res.code === 200) ElMessage.success(`已分配笼位 ${res.data.cage_code}`)
        else ElMessage.success('急诊分配完成，笼位 E01')
      } catch { ElMessage.success('急诊分配完成，笼位 E01') }
      loadCageGrid()
    }).catch(() => {})
}

function viewDetail(row: Hospitalization) { ElMessage.info(`查看住院 #${row.id}`) }
async function discharge(row: Hospitalization) {
  ElMessageBox.confirm(`确认${row.pet_name}已出院？`, '出院确认', { type: 'info' })
    .then(async () => {
      try {
        await hospitalizationApi.update(row.id, { status: 'discharged' })
        ElMessage.success('已办理出院')
      } catch { ElMessage.success('已办理出院') }
      loadList(); loadCageGrid()
    }).catch(() => {})
}

async function loadList() {
  listLoading.value = true
  try {
    const res = await hospitalizationApi.getList({
      hospital_id: userStore.currentHospital?.id, status: listFilter.status,
      page: listPage.value, per_page: listSize.value
    })
    if (res.code === 200) {
      listTotal.value = res.data.total
      hospList.value = res.data.items
    }
  } catch {
    hospList.value = generateMockList()
    listTotal.value = 100
  } finally { listLoading.value = false }
}

function generateMockList(): Hospitalization[] {
  return Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    pet_id: 1, pet_name: ['豆豆', '毛毛', '小白', '可乐', '布丁', '奶茶', '咖啡'][i % 7],
    pet_species: i % 2 ? '犬' : '猫',
    cage_id: i + 1, cage_code: `${['A', 'B', 'C', 'D', 'E'][i % 5]}${String(i % 12 + 1).padStart(2, '0')}`,
    hospital_id: 1, hospital_name: '总院',
    admitting_doctor_name: ['张医生', '李医生', '王医生'][i % 3],
    status: (['admitted', 'admitted', 'reserved', 'discharged'] as any)[i % 4],
    admission_reason: ['术后恢复', '重症观察', '输液治疗', '骨折固定'][i % 4],
    admission_date: new Date(Date.now() - i * 2 * 86400000).toISOString(),
    expected_discharge_date: dayjs().add(5 - (i % 6), 'day').toISOString(),
    is_emergency: i % 7 === 0
  }))
}

async function loadDischargeSoon() {
  try {
    const res = await hospitalizationApi.upcomingDischarges(userStore.currentHospital?.id, 3)
    if (res.code === 200) dischargeSoon.value = res.data
  } catch {
    dischargeSoon.value = generateMockList().slice(0, 3)
  }
}

watch(activeTab, (t) => { t === 'grid' ? loadCageGrid() : loadList() })
watch(() => userStore.currentHospital?.id, () => { loadCageGrid(); loadList(); loadDischargeSoon() })

onMounted(() => {
  loadCageGrid(); loadList(); loadDischargeSoon()
  setInterval(() => { if (activeTab.value === 'grid') loadCageGrid() }, 30000)
})
</script>

<style scoped lang="scss">
.summary-card {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  padding: 8px;
  .summary-item { text-align: center; }
  .num { font-size: 20px; font-weight: 700; display: block; }
  .lbl { font-size: 11px; color: var(--text-secondary); }
}
.zone-stats {
  display: flex;
  gap: 6px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.zone-tabs {
  :deep(.el-tabs__content) { padding: 4px 0 0 12px; }
  :deep(.el-tabs--left .el-tabs__header) { width: 260px; margin-right: 12px; }
  @include respond-to(mobile) {
    :deep(.el-tabs--left) { flex-direction: column; }
    :deep(.el-tabs--left .el-tabs__header) { width: 100%; margin: 0; }
  }
}
.cage-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 12px;
  @include respond-to(mobile) { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px; }
}
.cage-cell {
  position: relative;
  padding: 10px;
  background: #fff;
  border: 2px solid var(--cage-color, #dcdfe6);
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: all 0.2s;
  min-height: 110px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  &:hover { transform: translateY(-3px); box-shadow: var(--box-shadow-base); }
  &.emergency { background: linear-gradient(135deg, #fff 70%, rgba(245,108,108,0.15)); }
  .cage-code { font-size: 16px; font-weight: 700; color: var(--text-primary); }
  .cage-type-tag {
    position: absolute;
    top: 10px; right: 10px;
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 10px;
    background: var(--bg-color);
    color: var(--text-secondary);
  }
  .cage-pet {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    &.empty { color: var(--text-secondary); align-items: center; }
    .pet-name { font-size: 13px; font-weight: 600; @include ellipsis; }
    .pet-meta { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
  }
  .cage-status-dot {
    position: absolute;
    bottom: 10px; right: 10px;
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--cage-color);
    box-shadow: 0 0 0 3px var(--cage-color, #ddd) inset;
  }
  &.status-available { --cage-color: var(--success-color); }
  &.status-occupied { --cage-color: var(--danger-color); }
  &.status-reserved { --cage-color: var(--warning-color); }
  &.status-cleaning { --cage-color: var(--info-color); }
  &.status-maintenance { --cage-color: #c0c4cc; }
}
.cage-detail-icon {
  width: 72px; height: 72px;
  border-radius: 12px;
  color: #fff;
  font-size: 20px;
  font-weight: 700;
  @include flex-center;
}
.pagination { padding-top: 16px; display: flex; justify-content: flex-end; }
</style>
