<template>
  <div class="case-manage">
    <div class="page-header">
      <div>
        <h2 class="page-title">案件管理</h2>
        <p style="color:#718096;font-size:13px;margin-top:4px">
          共 {{ caseStore.total }} 件案件，
          <span v-if="warningCount" class="danger-pulse" style="color:#e53e3e">
            {{ warningCount }} 件临近诉讼时效
          </span>
        </p>
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="showCreate = true">
          <el-icon><Plus /></el-icon> 新建案件
        </el-button>
        <el-button @click="exportExcel">
          <el-icon><Download /></el-icon> 导出
        </el-button>
      </div>
    </div>

    <div class="card">
      <div class="filter-bar">
        <el-input
          v-model="filters.search"
          placeholder="搜索案号、名称、案由..."
          style="width:240px"
          clearable
          @change="handleSearch"
          :prefix-icon="Search"
        />
        <el-select v-model="filters.status" placeholder="案件状态" clearable style="width:140px" @change="loadCases">
          <el-option v-for="s in statusOptions" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>
        <el-select v-model="filters.case_type" placeholder="案件类型" clearable style="width:140px" @change="loadCases">
          <el-option label="民商事诉讼" value="civil" />
          <el-option label="刑事辩护" value="criminal" />
          <el-option label="行政诉讼" value="administrative" />
          <el-option label="非诉业务" value="non_litigation" />
        </el-select>
        <el-select v-model="filters.lead_lawyer" placeholder="主办律师" clearable filterable style="width:140px" @change="loadCases">
          <el-option v-for="l in lawyerList" :key="l.id" :label="l.full_name" :value="l.id" />
        </el-select>
        <el-select v-model="filters.priority" placeholder="优先级" clearable style="width:110px" @change="loadCases">
          <el-option label="普通" value="normal" />
          <el-option label="加急" value="urgent" />
          <el-option label="特急" value="critical" />
        </el-select>
        <el-button @click="resetFilters">重置</el-button>
      </div>

      <el-table
        :data="caseStore.cases"
        v-loading="caseStore.loading"
        stripe
        @row-click="goDetail"
        style="cursor:pointer"
      >
        <el-table-column prop="case_no" label="案号" width="170" fixed="left" />
        <el-table-column label="案件名称" min-width="220">
          <template #default="{ row }">
            <div class="case-name-cell">
              <el-tag
                v-if="row.limit_warning_level"
                size="small"
                :type="warningTagType(row.limit_warning_level)"
                effect="dark"
                :class="{ 'danger-pulse': row.limit_warning_level === 'critical', 'warning-pulse': row.limit_warning_level === 'urgent' }"
              >
                {{ row.limit_warning_level === 'expired' ? '已过期' : (row.days_left + '天') }}
              </el-tag>
              <span class="name-text" :title="row.case_name">{{ row.case_name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="case_type_display" label="类型" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="caseTypeTag(row.case_type)">{{ row.case_type_display }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="cause" label="案由" min-width="130" show-overflow-tooltip />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="statusTag(row.status)" effect="light">{{ row.status_display }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="主办律师" width="100">
          <template #default="{ row }">{{ row.lead_lawyer_info?.full_name || '-' }}</template>
        </el-table-column>
        <el-table-column label="标的额(元)" width="120" align="right">
          <template #default="{ row }">
            <span style="font-family:monospace">{{ formatAmount(row.amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="accept_date" label="受理日期" width="110" />
        <el-table-column label="优先级" width="80" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.priority !== 'normal'" size="small" type="danger" effect="dark" v-show="row.priority === 'critical'">特急</el-tag>
            <el-tag v-else-if="row.priority === 'urgent'" size="small" type="warning">加急</el-tag>
            <span v-else style="color:#a0aec0">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right" @click.stop>
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click.stop="goDetail(row.id)">详情</el-button>
            <el-button size="small" link @click.stop="assignLawyer(row)">分配</el-button>
            <el-button size="small" type="danger" link @click.stop="deleteCase(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="filters.page"
          v-model:page-size="filters.page_size"
          :page-sizes="[10, 20, 50, 100]"
          :total="caseStore.total"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="loadCases"
          @size-change="loadCases"
        />
      </div>
    </div>

    <el-dialog v-model="showCreate" :title="isEdit ? '编辑案件' : '新建案件'" width="720px">
      <el-form :model="formData" :rules="formRules" ref="formRef" label-width="110px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="案件名称" prop="case_name">
              <el-input v-model="formData.case_name" maxlength="200" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="案件类型" prop="case_type">
              <el-select v-model="formData.case_type" style="width:100%">
                <el-option label="民商事诉讼" value="civil" />
                <el-option label="刑事辩护" value="criminal" />
                <el-option label="行政诉讼" value="administrative" />
                <el-option label="非诉业务" value="non_litigation" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="案由" prop="cause">
              <el-input v-model="formData.cause" maxlength="200" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="收费模式" prop="billing_type">
              <el-select v-model="formData.billing_type" style="width:100%">
                <el-option label="计时收费" value="hourly" />
                <el-option label="固定收费" value="fixed" />
                <el-option label="风险代理" value="contingency" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="委托客户" prop="client">
              <el-select v-model="formData.client" filterable style="width:100%">
                <el-option v-for="c in clientList" :key="c.id" :label="`${c.client_no} ${c.client_name}`" :value="c.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="受理日期" prop="accept_date">
              <el-date-picker v-model="formData.accept_date" type="date" value-format="YYYY-MM-DD" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="标的金额(元)" prop="amount">
              <el-input-number v-model="formData.amount" :min="0" :precision="2" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="约定律师费(元)" prop="fee_agreed">
              <el-input-number v-model="formData.fee_agreed" :min="0" :precision="2" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="受理法院">
              <el-input v-model="formData.court" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="风险等级">
              <el-select v-model="formData.risk_level" style="width:100%">
                <el-option label="低" value="low" />
                <el-option label="中" value="medium" />
                <el-option label="高" value="high" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="案情摘要">
              <el-input v-model="formData.case_summary" type="textarea" :rows="3" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="当事人">
              <div class="parties-editor">
                <div v-for="(p, i) in formData.parties" :key="i" class="party-row">
                  <el-select v-model="p.party_type" style="width:130px" size="small">
                    <el-option label="原告" value="plaintiff" />
                    <el-option label="被告" value="defendant" />
                    <el-option label="第三人" value="third_party" />
                  </el-select>
                  <el-input v-model="p.name" placeholder="姓名/名称" size="small" style="width:160px" />
                  <el-input v-model="p.phone" placeholder="电话" size="small" style="width:130px" />
                  <el-switch v-model="p.is_represented" size="small" active-text="我方代理" />
                  <el-button size="small" type="danger" link @click="formData.parties.splice(i, 1)">删除</el-button>
                </div>
                <el-button size="small" type="primary" link @click="addParty">
                  <el-icon><Plus /></el-icon> 添加当事人
                </el-button>
              </div>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="showCreate = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showAssign" title="分配律师" width="500px">
      <el-form :model="assignForm" label-width="90px">
        <el-form-item label="主办律师">
          <el-select v-model="assignForm.lead_lawyer" filterable style="width:100%">
            <el-option v-for="l in lawyerList" :key="l.id" :label="l.full_name + ' (' + l.hourly_rate + '元/时)'" :value="l.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="律师助理">
          <el-select v-model="assignForm.assistant" clearable filterable style="width:100%">
            <el-option v-for="a in assistantList" :key="a.id" :label="a.full_name" :value="a.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAssign = false">取消</el-button>
        <el-button type="primary" @click="submitAssign">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Plus, Download, Search
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { useCaseStore } from '@/stores/case'
import { userApi, clientApi, caseApi } from '@/api/modules'
import type { Case, Party } from '@/types'
import * as XLSX from 'xlsx'
import dayjs from 'dayjs'

const router = useRouter()
const caseStore = useCaseStore()
const formRef = ref<FormInstance>()
const submitting = ref(false)

const showCreate = ref(false)
const showAssign = ref(false)
const isEdit = ref(false)
const lawyerList = ref<any[]>([])
const assistantList = ref<any[]>([])
const clientList = ref<any[]>([])

const filters = reactive({
  page: 1, page_size: 20, search: '', status: '',
  case_type: '', lead_lawyer: null as number | null, priority: ''
})

const warningCount = computed(() =>
  caseStore.cases.filter(c => c.limit_warning_level && c.limit_warning_level !== 'normal').length
)

const statusOptions = [
  { label: '咨询登记', value: 'consulting' },
  { label: '冲突审查', value: 'conflict_check' },
  { label: '正式立案', value: 'filing' },
  { label: '已分配', value: 'assigned' },
  { label: '办理中', value: 'handling' },
  { label: '庭审阶段', value: 'trial' },
  { label: '执行阶段', value: 'execution' },
  { label: '结案归档', value: 'closing' },
  { label: '已结案', value: 'closed' },
]

const defaultForm = () => ({
  case_name: '', case_type: 'civil', case_subtype: '', cause: '',
  status: 'consulting', billing_type: 'fixed', amount: 0, fee_agreed: 0,
  retention_rate: 0, accept_date: dayjs().format('YYYY-MM-DD'),
  lead_lawyer: null as number | null, assistant: null as number | null,
  lawyers: [] as number[], client: null as number | null,
  court: '', judge: '', risk_level: 'medium', priority: 'normal',
  case_summary: '', claim: '', defense: '',
  parties: [{ party_type: 'plaintiff', name: '', phone: '', is_represented: true } as Party]
})

const formData = reactive<any>(defaultForm())
const assignForm = reactive({ lead_lawyer: null as number | null, assistant: null as number | null, lawyers: [] as number[] })
const currentCase = ref<Case | null>(null)

const formRules: FormRules = {
  case_name: [{ required: true, message: '请输入案件名称' }],
  case_type: [{ required: true, message: '请选择案件类型' }],
  cause: [{ required: true, message: '请输入案由' }],
  accept_date: [{ required: true, message: '请选择受理日期' }],
  client: [{ required: true, message: '请选择委托客户' }],
}

function caseTypeTag(t: string) {
  return ({ civil: 'primary', criminal: 'danger', administrative: 'warning', non_litigation: 'success' } as any)[t] || 'info'
}
function statusTag(s: string) {
  return ({
    consulting: 'info', conflict_check: 'warning', filing: 'primary',
    assigned: 'primary', handling: 'info', trial: 'success', execution: 'info',
    closing: 'warning', closed: 'success', suspended: 'danger'
  } as any)[s] || 'info'
}
function warningTagType(l: string) {
  return ({ critical: 'danger', urgent: 'danger', warning: 'warning', notice: 'primary', expired: 'danger' } as any)[l] || 'info'
}
function formatAmount(v: number) {
  return (v || 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}

async function loadCases() {
  const params = Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== '' && v !== null)) as any
  await caseStore.fetchCases(params)
}
function handleSearch() {
  filters.page = 1
  loadCases()
}
function resetFilters() {
  Object.assign(filters, { page: 1, page_size: 20, search: '', status: '', case_type: '', lead_lawyer: null, priority: '' })
  loadCases()
}
function goDetail(row: any) {
  const id = typeof row === 'object' ? row.id : row
  router.push(`/cases/${id}`)
}
function addParty() {
  formData.parties.push({ party_type: 'defendant', name: '', phone: '', is_represented: false })
}
function assignLawyer(row: Case) {
  currentCase.value = row
  assignForm.lead_lawyer = row.lead_lawyer || null
  assignForm.assistant = row.assistant || null
  showAssign.value = true
}
async function submitAssign() {
  if (!currentCase.value) return
  await caseApi.assignLawyer(currentCase.value.id, assignForm)
  ElMessage.success('分配成功')
  showAssign.value = false
  await loadCases()
}
async function deleteCase(row: Case) {
  await ElMessageBox.confirm(`确定删除案件「${row.case_name}」吗？`, '提示', { type: 'warning' })
  await caseStore.deleteCase(row.id)
  ElMessage.success('已删除')
}
async function submitForm() {
  if (!formRef.value) return
  await formRef.value.validate()
  submitting.value = true
  try {
    if (isEdit.value && currentCase.value) {
      await caseStore.updateCase(currentCase.value.id, formData)
      ElMessage.success('更新成功')
    } else {
      await caseStore.createCase(formData)
      ElMessage.success('创建成功')
    }
    showCreate.value = false
    await loadCases()
  } catch (e: any) {
    ElMessage.error(e.message || '操作失败')
  } finally {
    submitting.value = false
  }
}
function exportExcel() {
  const data = caseStore.cases.map(c => ({
    '案号': c.case_no, '案件名称': c.case_name, '类型': c.case_type_display,
    '案由': c.cause, '状态': c.status_display, '主办律师': c.lead_lawyer_info?.full_name || '',
    '标的额': c.amount, '约定律师费': c.fee_agreed, '受理日期': c.accept_date,
    '时效截止': c.limit_date || '', '剩余天数': c.days_left ?? '无',
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '案件列表')
  XLSX.writeFile(wb, `案件列表_${dayjs().format('YYYYMMDD')}.xlsx`)
}

onMounted(async () => {
  await Promise.all([
    loadCases(),
    userApi.lawyers().then(r => { lawyerList.value = r.data }),
    userApi.assistants().then(r => { assistantList.value = r.data }),
    clientApi.simpleList().then(r => { clientList.value = r.data })
  ])
})
</script>

<style lang="scss" scoped>
.case-manage {
  .case-name-cell {
    display: flex;
    align-items: center;
    gap: 8px;
    .name-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 500;
    }
  }
  .header-actions {
    display: flex;
    gap: 8px;
  }
  .parties-editor {
    width: 100%;
    padding: 12px;
    background: #f7fafc;
    border-radius: 6px;
    .party-row {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-bottom: 8px;
    }
  }
  .pagination {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
  }
}
</style>
