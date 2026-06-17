<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">病历管理</h2>
      <div class="actions">
        <el-button type="primary" @click="openPetSearch">
          <el-icon><Search /></el-icon>搜索宠物
        </el-button>
        <el-button type="success" @click="createRecordDialog = true" v-if="userStore.isDoctor || userStore.isManager">
          <el-icon><Plus /></el-icon>新建病历
        </el-button>
      </div>
    </div>
    <div class="filter-bar">
      <el-input v-model="filters.keyword" placeholder="宠物名/主人/电话" clearable style="width:220px" :prefix-icon="Search" />
      <el-select v-model="filters.status" placeholder="状态" clearable style="width:140px">
        <el-option value="in_progress" label="进行中" />
        <el-option value="completed" label="已完成" />
        <el-option value="referred" label="已转诊" />
      </el-select>
      <el-select v-model="filters.visitType" placeholder="就诊类型" clearable style="width:140px">
        <el-option v-for="(v, k) in VISIT_TYPE_LABELS" :key="k" :value="k" :label="v" />
      </el-select>
      <el-date-picker v-model="filters.dateRange" type="daterange" range-separator="-" start-placeholder="开始" end-placeholder="结束" value-format="YYYY-MM-DD" />
      <el-button type="primary" plain @click="loadRecords">查询</el-button>
      <el-button @click="resetFilters">重置</el-button>
    </div>
    <div v-loading="loading" class="cards-container">
      <el-empty v-if="!loading && petCards.length === 0" description="暂无病历数据" />
      <el-row :gutter="16">
        <el-col v-for="card in petCards" :key="card.pet_id" :xs="24" :sm="12" :md="8" :lg="8" :xl="8" style="margin-bottom:16px">
          <div class="pet-card" @click="goPet(card.pet_id)">
            <div class="card-header">
              <el-avatar :size="52" class="pet-avatar">
                {{ card.pet_name?.charAt(0) || 'P' }}
              </el-avatar>
              <div class="pet-basic">
                <div class="pet-name-row">
                  <span class="pet-name">{{ card.pet_name }}</span>
                  <el-tag
                    v-if="card.latestStatus"
                    size="small"
                    :type="card.latestStatus === 'completed' ? 'success' : card.latestStatus === 'referred' ? 'warning' : 'primary'"
                    effect="plain"
                  >
                    {{ card.latestStatus === 'in_progress' ? '进行中' : card.latestStatus === 'completed' ? '已完成' : '已转诊' }}
                  </el-tag>
                </div>
                <div class="owner-info">
                  <el-icon><User /></el-icon>
                  <span>{{ card.owner_name }} · {{ card.owner_phone }}</span>
                </div>
              </div>
            </div>
            <el-divider style="margin:12px 0" />
            <div class="card-body">
              <div class="section-title">
                <el-icon><Clock /></el-icon>
                <span>最近就诊</span>
              </div>
              <div class="mini-timeline">
                <div v-for="rec in card.recentRecords" :key="rec.id" class="timeline-item" @click.stop="goDetail(rec.id)">
                  <div class="timeline-dot" :class="rec.visit_type"></div>
                  <div class="timeline-content">
                    <div class="timeline-head">
                      <el-tag size="small" :type="rec.visit_type === 'emergency' ? 'danger' : rec.visit_type === 'referral' ? 'warning' : undefined" effect="plain">
                        {{ VISIT_TYPE_LABELS[rec.visit_type] }}
                      </el-tag>
                      <span class="time">{{ formatDateTime(rec.visit_date) }}</span>
                    </div>
                    <div class="timeline-text">
                      <span v-if="rec.department">{{ rec.department }}</span>
                      <span v-if="rec.department && rec.doctor_name"> · </span>
                      <span v-if="rec.doctor_name">{{ rec.doctor_name }}</span>
                    </div>
                    <div class="timeline-text secondary" v-if="rec.chief_complaint || rec.diagnosis">
                      {{ rec.diagnosis || rec.chief_complaint }}
                    </div>
                  </div>
                </div>
                <div v-if="card.recentRecords.length === 0" class="empty-timeline">
                  <span style="color:var(--text-secondary);font-size:13px">暂无就诊记录</span>
                </div>
              </div>
            </div>
            <div class="card-footer" @click.stop>
              <el-button size="small" type="primary" plain @click="goPet(card.pet_id)">
                <el-icon><View /></el-icon>查看档案
              </el-button>
              <el-button size="small" type="warning" plain @click="referral(card.recentRecords[0] || card)" v-if="userStore.isDoctor && card.recentRecords.length">
                <el-icon><Switch /></el-icon>转诊
              </el-button>
              <el-button size="small" type="success" plain v-if="userStore.isDoctor || userStore.isManager" @click="goCreateRecordForPet(card)">
                <el-icon><Plus /></el-icon>新建就诊
              </el-button>
            </div>
          </div>
        </el-col>
      </el-row>
      <div v-if="petCards.length > 0" class="pagination">
        <el-pagination v-model:current-page="page" v-model:page-size="perPage" :page-sizes="[20, 50, 100]" :total="total" layout="total, sizes, prev, pager, next, jumper" @change="loadRecords" />
      </div>
    </div>
    <el-drawer v-model="petSearchVisible" title="搜索宠物 / 新建" size="600px">
      <div class="pet-search-header">
        <el-input v-model="petKeyword" placeholder="输入宠物名/主人/电话" :prefix-icon="Search" size="large" clearable @input="searchPets" />
      </div>
      <el-tabs v-model="petTab" style="margin-top:16px">
        <el-tab-pane label="搜索结果" name="list">
          <el-table :data="petList" v-loading="petLoading" style="width:100%" size="default" @row-click="goPet">
            <el-table-column label="宠物" min-width="180">
              <template #default="{row}">
                <div style="display:flex;align-items:center;gap:10px">
                  <el-avatar :size="40" class="pet-avatar">{{ row.name.charAt(0) }}</el-avatar>
                  <div>
                    <div style="font-weight:600">{{ row.name }}</div>
                    <div style="font-size:12px;color:var(--text-secondary)">{{ row.species }} · {{ row.breed || '-' }} · {{ getGenderLabel(row.gender) }}</div>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="主人" width="160">
              <template #default="{row}"><div>{{ row.owner_name }}</div><div style="font-size:12px;color:var(--text-secondary)">{{ row.owner_phone }}</div></template>
            </el-table-column>
            <el-table-column label="操作" width="100">
              <template #default="{row}"><el-button type="primary" size="small" @click.stop="goPet(row.id)">查看</el-button></template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="新建宠物" name="create">
          <el-form :model="newPetForm" label-width="100px">
            <el-form-item label="主人姓名" required><el-input v-model="newPetForm.ownerName" /></el-form-item>
            <el-form-item label="联系电话" required><el-input v-model="newPetForm.ownerPhone" /></el-form-item>
            <el-divider content-position="left">宠物信息</el-divider>
            <el-form-item label="宠物名字" required><el-input v-model="newPetForm.name" /></el-form-item>
            <el-form-item label="品种">
              <el-select v-model="newPetForm.species" placeholder="物种" style="width:120px;margin-right:8px">
                <el-option label="犬" value="犬" /><el-option label="猫" value="猫" /><el-option label="其他" value="其他" />
              </el-select>
              <el-input v-model="newPetForm.breed" placeholder="具体品种" />
            </el-form-item>
            <el-form-item label="性别"><el-radio-group v-model="newPetForm.gender"><el-radio value="male">公</el-radio><el-radio value="female">母</el-radio><el-radio value="unknown">未知</el-radio></el-radio-group></el-form-item>
            <el-form-item label="出生日期"><el-date-picker v-model="newPetForm.birthDate" type="date" value-format="YYYY-MM-DD" /></el-form-item>
            <el-form-item label="体重(kg)"><el-input-number v-model="newPetForm.weight" :min="0" :precision="1" /></el-form-item>
            <el-form-item label="过敏史"><el-input v-model="newPetForm.allergyHistory" type="textarea" /></el-form-item>
            <el-form-item><el-button type="primary" @click="createPet" :loading="creatingPet">创建并进入档案</el-button></el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </el-drawer>
    <el-dialog v-model="createRecordDialog" title="新建病历" width="720px">
      <el-form :model="newRecordForm" label-width="100px">
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="宠物" required><el-input v-model="newRecordForm.pet_name" readonly placeholder="请先在左侧搜索宠物" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="科室"><el-select v-model="newRecordForm.department" style="width:100%"><el-option v-for="d in depts" :key="d" :label="d" :value="d" /></el-select></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="就诊类型"><el-select v-model="newRecordForm.visit_type" style="width:100%"><el-option v-for="(v,k) in VISIT_TYPE_LABELS" :key="k" :value="k" :label="v" /></el-select></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="就诊日期"><el-date-picker v-model="newRecordForm.visit_date" type="datetime" style="width:100%" value-format="YYYY-MM-DDTHH:mm:ss" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="主诉"><el-input v-model="newRecordForm.chief_complaint" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="诊断"><el-input v-model="newRecordForm.diagnosis" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="治疗方案"><el-input v-model="newRecordForm.treatment_plan" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createRecordDialog = false">取消</el-button>
        <el-button type="primary" :loading="creatingRecord" @click="saveNewRecord">创建</el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="referralDialog" title="发起转诊" width="520px">
      <el-form label-width="100px">
        <el-form-item label="目标院区" required>
          <el-select v-model="referralForm.hospital_id" style="width:100%" placeholder="选择院区">
            <el-option v-for="h in userStore.hospitals" :key="h.id" :label="h.name" :value="h.id">
              {{ h.name }}<el-tag v-if="h.type==='emergency_24h'" size="small" type="danger" style="margin-left:8px">24H急诊</el-tag>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="接诊医生">
          <el-select v-model="referralForm.doctor_id" style="width:100%" placeholder="可选" clearable>
            <el-option label="暂不指定" :value="''" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="referralDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmReferral" :loading="referring">确认转诊</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus, User, Clock, View, Switch } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores'
import { medicalApi } from '@/api'
import { VISIT_TYPE_LABELS, type MedicalRecord, type Pet } from '@/types'
import { formatDateTime, getGenderLabel, debounce } from '@/utils'

interface PetCard {
  pet_id: number
  pet_name?: string
  owner_name?: string
  owner_phone?: string
  latestStatus?: string
  recentRecords: MedicalRecord[]
}

const router = useRouter()
const userStore = useUserStore()
const depts = ['内科', '外科', '影像科', '检验科']

const loading = ref(false)
const records = ref<MedicalRecord[]>([])
const total = ref(0)
const page = ref(1)
const perPage = ref(20)

const filters = reactive({
  keyword: '', status: '', visitType: '', dateRange: [] as string[]
})

const petCards = computed<PetCard[]>(() => {
  const map = new Map<number, PetCard>()
  for (const rec of records.value) {
    if (!map.has(rec.pet_id)) {
      map.set(rec.pet_id, {
        pet_id: rec.pet_id,
        pet_name: rec.pet_name,
        owner_name: rec.owner_name,
        owner_phone: rec.owner_phone,
        latestStatus: rec.status,
        recentRecords: []
      })
    }
    const card = map.get(rec.pet_id)!
    if (card.recentRecords.length < 3) {
      card.recentRecords.push(rec)
    }
  }
  return Array.from(map.values())
})

const petSearchVisible = ref(false)
const petTab = ref('list')
const petKeyword = ref('')
const petLoading = ref(false)
const petList = ref<Pet[]>([])

const createRecordDialog = ref(false)
const creatingRecord = ref(false)
const creatingPet = ref(false)
const newRecordForm = reactive({
  pet_id: 0, pet_name: '', department: '内科', visit_type: 'outpatient' as any,
  visit_date: new Date().toISOString(), chief_complaint: '', diagnosis: '', treatment_plan: ''
})
const newPetForm = reactive({
  ownerName: '', ownerPhone: '', name: '', species: '犬', breed: '', gender: 'unknown',
  birthDate: '', weight: undefined as number | undefined, allergyHistory: ''
})

const referralDialog = ref(false)
const referring = ref(false)
const referralTargetRecord = ref<MedicalRecord | null>(null)
const referralForm = reactive({
  hospital_id: null as number | null,
  doctor_id: null as number | null
})

function resetFilters() {
  filters.keyword = ''
  filters.status = ''
  filters.visitType = ''
  filters.dateRange = []
  page.value = 1
  loadRecords()
}

async function loadRecords() {
  loading.value = true
  try {
    const hid = userStore.currentHospital?.id || undefined
    const res = await medicalApi.searchRecords({
      hospital_id: hid,
      status: filters.status,
      keyword: filters.keyword,
      start_date: filters.dateRange?.[0],
      end_date: filters.dateRange?.[1],
      page: page.value,
      per_page: perPage.value
    })
    if (res.code === 200) {
      total.value = res.data.total
      records.value = res.data.items
    }
  } catch (e) {
    records.value = []
    total.value = 0
    ElMessage.error('加载病历列表失败')
  } finally { loading.value = false }
}

const searchPets = debounce(async () => {
  if (!petKeyword.value) { petList.value = []; return }
  petLoading.value = true
  try {
    const res = await medicalApi.searchPets({ keyword: petKeyword.value, per_page: 50 })
    if (res.code === 200) petList.value = res.data.items
  } catch (e) {
    petList.value = []
    ElMessage.error('搜索宠物失败')
  } finally { petLoading.value = false }
}, 300)

function openPetSearch() {
  petSearchVisible.value = true
  petTab.value = 'list'
}

function goPet(petId: number | Pet | MedicalRecord | PetCard) {
  const id = typeof petId === 'number' ? petId : (petId as any).pet_id ?? (petId as any).id
  petSearchVisible.value = false
  router.push(`/pets/${id}`)
}

async function createPet() {
  if (!newPetForm.ownerName || !newPetForm.ownerPhone || !newPetForm.name) {
    ElMessage.warning('请填写必填项')
    return
  }
  creatingPet.value = true
  try {
    let ownerRes: any = null
    try {
      ownerRes = await medicalApi.createOwner({ name: newPetForm.ownerName, phone: newPetForm.ownerPhone })
    } catch {}
    const owner_id = ownerRes?.code === 200 ? ownerRes.data.id : undefined
    const res = await medicalApi.createPet({
      owner_id, name: newPetForm.name, species: newPetForm.species,
      breed: newPetForm.breed, gender: newPetForm.gender,
      birth_date: newPetForm.birthDate, weight: newPetForm.weight,
      allergy_history: newPetForm.allergyHistory
    })
    if (res.code === 200) {
      ElMessage.success('创建成功')
      goPet(res.data.id)
    }
  } catch (e) {
    ElMessage.error('创建宠物失败')
  } finally { creatingPet.value = false }
}

async function saveNewRecord() {
  if (!newRecordForm.pet_id) { ElMessage.warning('请先选择宠物'); petSearchVisible.value = true; return }
  creatingRecord.value = true
  try {
    const res = await medicalApi.createRecord({
      pet_id: newRecordForm.pet_id,
      department: newRecordForm.department,
      visit_type: newRecordForm.visit_type,
      visit_date: newRecordForm.visit_date,
      chief_complaint: newRecordForm.chief_complaint,
      diagnosis: newRecordForm.diagnosis,
      treatment_plan: newRecordForm.treatment_plan
    })
    if (res.code === 200) {
      ElMessage.success('病历创建成功')
      createRecordDialog.value = false
      loadRecords()
    }
  } catch (e) {
    ElMessage.error('创建病历失败')
  } finally { creatingRecord.value = false }
}

function goDetail(id: number) {
  router.push(`/medical/${id}`)
}

function goCreateRecordForPet(card: PetCard) {
  newRecordForm.pet_id = card.pet_id
  newRecordForm.pet_name = card.pet_name || ''
  createRecordDialog.value = true
}

function referral(row: MedicalRecord | PetCard) {
  const record = (row as MedicalRecord).id !== undefined
    ? row as MedicalRecord
    : (row as PetCard).recentRecords[0]
  if (!record) {
    ElMessage.warning('暂无就诊记录可转诊')
    return
  }
  referralTargetRecord.value = record
  referralForm.hospital_id = null
  referralForm.doctor_id = null
  referralDialog.value = true
}

async function confirmReferral() {
  if (!referralForm.hospital_id) { ElMessage.warning('请选择院区'); return }
  if (!referralTargetRecord.value) { ElMessage.warning('未选择目标病历'); return }
  referring.value = true
  try {
    const res = await medicalApi.createReferral(
      referralTargetRecord.value.id,
      { target_hospital_id: referralForm.hospital_id!, target_doctor_id: referralForm.doctor_id || undefined }
    )
    if (res.code === 200) {
      ElMessage.success('转诊成功')
      referralDialog.value = false
      router.push(`/medical/${res.data.id}`)
    }
  } catch (e: any) {
    if (e?.response?.status === 409) {
      const duplicateItems = e?.response?.data?.data?.duplicate_items || e?.response?.data?.duplicate_items || []
      const itemsText = Array.isArray(duplicateItems) && duplicateItems.length
        ? duplicateItems.join('、')
        : '部分检验项目'
      ElMessageBox.alert(
        `存在重复检验项目：${itemsText}，是否仍要继续转诊？`,
        '重复检验提醒',
        {
          confirmButtonText: '继续转诊',
          cancelButtonText: '取消',
          type: 'warning',
          showCancelButton: true
        }
      ).then(async () => {
        try {
          const res = await medicalApi.createReferral(
            referralTargetRecord.value!.id,
            {
              target_hospital_id: referralForm.hospital_id!,
              target_doctor_id: referralForm.doctor_id || undefined
            }
          )
          if (res.code === 200) {
            ElMessage.success('转诊成功')
            referralDialog.value = false
            router.push(`/medical/${res.data.id}`)
          }
        } catch {
          ElMessage.error('转诊失败')
        }
      }).catch(() => {})
    } else {
      ElMessage.error('转诊失败')
    }
  } finally { referring.value = false }
}

onMounted(loadRecords)
</script>

<style scoped lang="scss">
.cards-container {
  min-height: 200px;
}
.pet-card {
  @include card-style;
  padding: 16px;
  cursor: pointer;
  height: 100%;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-light);
  &:hover {
    transform: translateY(-4px);
    border-color: var(--primary-light);
  }
}
.card-header {
  display: flex;
  gap: 12px;
  align-items: center;
}
.pet-avatar {
  background: linear-gradient(135deg, #409EFF, #67C23A);
  color: #fff;
  font-weight: 600;
  flex-shrink: 0;
}
.pet-basic {
  flex: 1;
  min-width: 0;
}
.pet-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.pet-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}
.owner-info {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--text-secondary);
}
.card-body {
  flex: 1;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-regular);
  margin-bottom: 10px;
}
.mini-timeline {
  position: relative;
  padding-left: 4px;
}
.timeline-item {
  display: flex;
  gap: 10px;
  padding: 6px 0;
  position: relative;
  &:not(:last-child)::after {
    content: '';
    position: absolute;
    left: 5px;
    top: 22px;
    bottom: -4px;
    width: 1px;
    background: var(--border-light);
  }
}
.timeline-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--primary-color);
  flex-shrink: 0;
  margin-top: 5px;
  &.emergency { background: var(--danger-color); }
  &.referral { background: var(--warning-color); }
  &.revisit { background: var(--success-color); }
}
.timeline-content {
  flex: 1;
  min-width: 0;
}
.timeline-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
  .time {
    font-size: 12px;
    color: var(--text-secondary);
    margin-left: auto;
  }
}
.timeline-text {
  font-size: 12px;
  color: var(--text-regular);
  line-height: 1.5;
  &.secondary { color: var(--text-secondary); }
}
.empty-timeline {
  padding: 12px 0;
  text-align: center;
}
.card-footer {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  margin-top: auto;
  border-top: 1px solid var(--border-light);
  flex-wrap: wrap;
  .el-button {
    flex: 1;
    min-width: 0;
  }
}
.pagination {
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
}
.pet-search-header { display: flex; gap: 12px; }
</style>
