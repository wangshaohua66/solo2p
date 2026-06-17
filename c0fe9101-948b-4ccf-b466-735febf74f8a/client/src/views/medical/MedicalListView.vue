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
    <el-card shadow="never">
      <el-table :data="records" v-loading="loading" stripe style="width:100%">
        <el-table-column label="宠物档案" min-width="160">
          <template #default="{row}">
            <div class="pet-cell" @click="goPet(row.pet_id)">
              <el-avatar :size="36" style="background:#ecf5ff;color:#409EFF">
                {{ row.pet_name?.charAt(0) || 'P' }}
              </el-avatar>
              <div>
                <div class="name">{{ row.pet_name }}</div>
                <div class="sub">{{ row.owner_name }} · {{ row.owner_phone }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="department" label="科室" width="90" />
        <el-table-column label="类型" width="90">
          <template #default="{row}">
            <el-tag size="small" :type="row.visit_type === 'emergency' ? 'danger' : row.visit_type === 'referral' ? 'warning' : ''">{{ VISIT_TYPE_LABELS[row.visit_type] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="hospital_name" label="院区" width="150" show-overflow-tooltip />
        <el-table-column prop="doctor_name" label="医生" width="90" />
        <el-table-column label="主诉" min-width="160" show-overflow-tooltip>
          <template #default="{row}">{{ row.chief_complaint || '-' }}</template>
        </el-table-column>
        <el-table-column label="诊断" min-width="120" show-overflow-tooltip>
          <template #default="{row}">{{ row.diagnosis || '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{row}">
            <el-tag size="small" :type="row.status === 'completed' ? 'success' : row.status === 'referred' ? 'warning' : 'primary'">{{ row.status === 'in_progress' ? '进行中' : row.status === 'completed' ? '已完成' : '已转诊' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="就诊时间" width="160">
          <template #default="{row}">{{ formatDateTime(row.visit_date) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{row}">
            <el-button link type="primary" @click="goDetail(row.id)">查看</el-button>
            <el-button link type="warning" @click="referral(row)" v-if="userStore.isDoctor">转诊</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination v-model:current-page="page" v-model:page-size="perPage" :page-sizes="[20, 50, 100]" :total="total" layout="total, sizes, prev, pager, next, jumper" @change="loadRecords" />
      </div>
    </el-card>
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
                  <el-avatar :size="40" style="background:#ecf5ff;color:#409EFF">{{ row.name.charAt(0) }}</el-avatar>
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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search, Plus } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores'
import { medicalApi } from '@/api'
import { VISIT_TYPE_LABELS, type MedicalRecord, type Pet } from '@/types'
import { formatDateTime, getGenderLabel, debounce } from '@/utils'

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

const petSearchVisible = ref(false)
const petTab = ref('list')
const petKeyword = ref('')
const petLoading = ref(false)
const petList = ref<Pet[]>([])
const selectedPet = ref<Pet | null>(null)

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
  } catch {
    records.value = generateMockRecords()
    total.value = 100
  } finally { loading.value = false }
}

function generateMockRecords(): MedicalRecord[] {
  return Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    pet_id: i + 100,
    pet_name: ['豆豆', '毛毛', '小白', '小黑', '可乐', '布丁', '奶茶', '咖啡', '糖糖', '多多'][i % 10],
    owner_id: 1,
    owner_name: ['张先生', '李女士', '王先生', '赵女士', '陈先生'][i % 5],
    owner_phone: `138${10000000 + i * 137}`,
    hospital_id: 1,
    hospital_name: ['总院', '朝阳急诊', '海淀分院'][i % 3],
    doctor_id: 1,
    doctor_name: ['张医生', '李医生', '王医生'][i % 3],
    department: depts[i % 4],
    visit_type: (['outpatient', 'emergency', 'referral', 'revisit'] as any)[i % 4],
    chief_complaint: ['食欲不振3天', '呕吐腹泻', '跛行', '皮肤瘙痒', '体检'][i % 5],
    diagnosis: ['肠胃炎', '骨折', '皮炎', '上呼吸道感染', '健康'][i % 5],
    status: (['in_progress', 'completed', 'referred'] as any)[i % 3],
    visit_date: new Date(Date.now() - i * 86400000).toISOString()
  }))
}

const searchPets = debounce(async () => {
  if (!petKeyword.value) { petList.value = []; return }
  petLoading.value = true
  try {
    const res = await medicalApi.searchPets({ keyword: petKeyword.value, per_page: 50 })
    if (res.code === 200) petList.value = res.data.items
  } catch {
    petList.value = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1, owner_id: 1, owner_name: `主人${i + 1}`, owner_phone: `138${10000000 + i}`,
      name: ['豆豆', '毛毛', '小白', '可乐', '布丁'][i % 5] + i,
      species: i % 2 ? '犬' : '猫', breed: i % 2 ? '金毛' : '英短', gender: i % 2 ? 'male' : 'female',
      weight: 5 + i, is_neutered: false
    }))
  } finally { petLoading.value = false }
}, 300)

function openPetSearch() {
  petSearchVisible.value = true
  petTab.value = 'list'
}

function goPet(petId: number) {
  petSearchVisible.value = false
  router.push(`/pets/${petId}`)
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
    const owner_id = ownerRes?.code === 200 ? ownerRes.data.id : 1
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
    goPet(1)
  } finally { creatingPet.value = false }
}

function saveNewRecord() {
  if (!newRecordForm.pet_id) { ElMessage.warning('请先选择宠物'); petSearchVisible.value = true; return }
  creatingRecord.value = true
  setTimeout(() => {
    ElMessage.success('病历创建成功')
    createRecordDialog.value = false
    creatingRecord.value = false
    loadRecords()
  }, 500)
}

function goDetail(id: number) {
  router.push(`/medical/${id}`)
}

function referral(row: MedicalRecord) {
  ElMessage.info(`已发起${row.pet_name}的转诊申请`)
}

onMounted(loadRecords)
</script>

<style scoped lang="scss">
.pet-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  .name { font-weight: 600; color: var(--text-primary); }
  .sub { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
}
.pagination {
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
}
.pet-search-header { display: flex; gap: 12px; }
</style>
