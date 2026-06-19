<template>
  <div class="case-detail" v-loading="caseStore.loading" v-if="currentCase">
    <div class="detail-header">
      <div>
        <el-button :icon="ArrowLeft" link @click="router.back()">返回</el-button>
        <h2 style="margin-top:12px">
          <el-tag :type="caseTypeTag(currentCase.case_type)" size="small" style="margin-right:8px">{{ currentCase.case_type_display }}</el-tag>
          {{ currentCase.case_name }}
          <el-tag v-if="currentCase.limit_warning_level && ['critical','urgent','warning','expired'].includes(currentCase.limit_warning_level)"
            :type="warningTag(currentCase.limit_warning_level)" effect="dark" style="margin-left:8px"
            :class="currentCase.limit_warning_level === 'critical' ? 'danger-pulse' : 'warning-pulse'"
          >
            {{ currentCase.limit_warning_level === 'expired' ? '已过期' : (currentCase.days_left + '天') }}
          </el-tag>
        </h2>
        <p style="color:#718096;margin-top:6px">
          {{ currentCase.case_no }} · 由{{ currentCase.created_by_info?.full_name }}创建于{{ formatTime(currentCase.created_at) }}
        </p>
      </div>
      <div class="detail-actions">
        <el-button @click="editCase">
          <el-icon><Edit /></el-icon> 编辑
        </el-button>
        <el-button type="success" @click="genDoc">
          <el-icon><Document /></el-icon> 生成文书
        </el-button>
        <el-button @click="assignLawyer(currentCase)">
          <el-icon><UserFilled /></el-icon> 分配律师
        </el-button>
        <el-dropdown @command="onStatusCmd" trigger="click">
          <el-button type="primary">
            状态：{{ currentCase.status_display }}<el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-for="s in statusOptions" :key="s.value" :command="s.value" :disabled="currentCase.status === s.value">
                {{ s.label }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <el-row :gutter="16">
      <el-col :span="16">
        <div class="card">
          <el-tabs v-model="activeTab" type="border-card">
            <el-tab-pane label="案件信息" name="info">
              <el-descriptions :column="2" border>
                <el-descriptions-item label="案由">{{ currentCase.cause }}</el-descriptions-item>
                <el-descriptions-item label="标的金额(元)">¥{{ formatAmount(currentCase.amount) }}</el-descriptions-item>
                <el-descriptions-item label="律师费(元)">¥{{ formatAmount(currentCase.fee_agreed) }}</el-descriptions-item>
                <el-descriptions-item label="收费模式">{{ currentCase.billing_type_display }}</el-descriptions-item>
                <el-descriptions-item label="受理日期">{{ currentCase.accept_date }}</el-descriptions-item>
                <el-descriptions-item label="诉讼时效截止">
                  <span :style="{ color: currentCase.limit_warning_level && currentCase.limit_warning_level !== 'normal' ? '#e53e3e' : '' }">
                    {{ currentCase.limit_date || '-' }}
                  </span>
                </el-descriptions-item>
                <el-descriptions-item label="立案日期">{{ currentCase.filing_date || '-' }}</el-descriptions-item>
                <el-descriptions-item label="结案日期">{{ currentCase.close_date || '-' }}</el-descriptions-item>
                <el-descriptions-item label="受理法院">{{ currentCase.court || '-' }}</el-descriptions-item>
                <el-descriptions-item label="承办法官">{{ currentCase.judge ? `${currentCase.judge} ${currentCase.judge_phone || ''}` : '-' }}</el-descriptions-item>
                <el-descriptions-item label="主办律师">
                  <el-tag type="primary" size="small">{{ currentCase.lead_lawyer_info?.full_name || '未分配' }}</el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="律师助理">
                  {{ currentCase.assistant_info?.full_name || '-' }}
                </el-descriptions-item>
                <el-descriptions-item label="优先级">
                  <el-tag :type="currentCase.priority === 'critical' ? 'danger' : currentCase.priority === 'urgent' ? 'warning' : 'info'" size="small">
                    {{ currentCase.priority_display }}
                  </el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="风险等级">
                  <el-tag :type="currentCase.risk_level === 'high' ? 'danger' : currentCase.risk_level === 'medium' ? 'warning' : 'success'" size="small">
                    {{ currentCase.risk_level_display }}
                  </el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="案情摘要" :span="2">
                  <div style="white-space:pre-wrap;min-height:60px">{{ currentCase.case_summary || '无' }}</div>
                </el-descriptions-item>
                <el-descriptions-item label="诉讼请求" :span="2">
                  <div style="white-space:pre-wrap;min-height:60px">{{ currentCase.claim || '无' }}</div>
                </el-descriptions-item>
                <el-descriptions-item label="答辩要点" :span="2">
                  <div style="white-space:pre-wrap;min-height:60px">{{ currentCase.defense || '无' }}</div>
                </el-descriptions-item>
              </el-descriptions>

              <h4 style="margin-top:24px;margin-bottom:12px;color:#2d3748">当事人信息</h4>
              <el-table :data="currentCase.parties || []" size="small">
                <el-table-column label="角色" width="140">
                  <template #default="{ row }">
                    <el-tag size="small" :type="row.is_represented ? 'primary' : 'info'">
                      {{ row.party_type_display }} {{ row.is_represented ? '(我方)' : '' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="姓名/名称" prop="name" min-width="160" />
                <el-table-column label="证件" width="240">
                  <template #default="{ row }">
                    {{ row.id_type }}: {{ row.id_no || '-' }}
                  </template>
                </el-table-column>
                <el-table-column label="联系方式" width="160" prop="phone" />
                <el-table-column label="地址" prop="address" show-overflow-tooltip />
              </el-table>
              <el-empty v-if="!currentCase.parties?.length" description="暂无当事人信息" :image-size="60" style="margin:20px 0" />
            </el-tab-pane>

            <el-tab-pane label="进展时间线" name="progress">
              <div style="padding:20px">
                <el-empty v-if="!currentCase.progress_logs?.length" description="暂无进展记录" :image-size="80" />
                <el-timeline v-else>
                  <el-timeline-item
                    v-for="(p, i) in [...currentCase.progress_logs].reverse()"
                    :key="p.id"
                    :timestamp="formatTime(p.created_at)"
                    placement="top"
                    :type="progressType(p.operation_type)"
                    :hollow="i === 0"
                  >
                    <el-card shadow="never" style="border:1px solid #edf2f7">
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                        <span>
                          <el-tag size="small" :type="p.operation_type === 'approve' ? 'success' : p.operation_type === 'reject' ? 'danger' : 'primary'">
                            {{ p.operation_type_display }}
                          </el-tag>
                          <span v-if="p.from_status" style="margin-left:8px;color:#a0aec0">
                            {{ p.from_status_display || p.from_status }} →
                          </span>
                          <b style="margin-left:4px">{{ p.to_status_display }}</b>
                        </span>
                        <span style="color:#718096;font-size:13px">{{ p.operator_info?.full_name }}</span>
                      </div>
                      <p style="margin:0;color:#4a5568">{{ p.description || '无详细描述' }}</p>
                    </el-card>
                  </el-timeline-item>
                </el-timeline>
              </div>
            </el-tab-pane>

            <el-tab-pane label="庭审日程" name="trial">
              <div style="display:flex;justify-content:space-between;margin-bottom:12px">
                <h4 style="margin:0">庭审记录 ({{ currentCase.trials?.length || 0 }})</h4>
                <el-button type="primary" size="small" @click="openTrialDialog">新增庭审</el-button>
              </div>
              <el-table :data="currentCase.trials || []" size="small">
                <el-table-column label="时间" width="200">
                  <template #default="{ row }">
                    {{ formatDate(row.start_time) }} {{ formatTime(row.start_time) }}<br />
                    <span style="color:#718096;font-size:12px">时长 {{ row.duration }}小时</span>
                  </template>
                </el-table-column>
                <el-table-column prop="trial_type_display" label="类型" width="100" />
                <el-table-column prop="trial_round" label="第几次" width="70" align="center" />
                <el-table-column label="地点" prop="location" show-overflow-tooltip />
                <el-table-column label="法庭" prop="courtroom" width="100" />
                <el-table-column label="主办律师" width="100">
                  <template #default="{ row }">{{ row.presiding_lawyer_info?.full_name }}</template>
                </el-table-column>
                <el-table-column label="冲突" width="60" align="center">
                  <template #default="{ row }">
                    <el-icon v-if="row.has_conflict" color="#e53e3e"><Warning /></el-icon>
                    <span v-else style="color:#a0aec0">-</span>
                  </template>
                </el-table-column>
                <el-table-column label="结果" width="100">
                  <template #default="{ row }">
                    <el-tag size="small" :type="resultType(row.result)">{{ row.result_display }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="判决结果" min-width="180" prop="judgment_result" show-overflow-tooltip />
              </el-table>
            </el-tab-pane>

            <el-tab-pane label="证据材料" name="evidence">
              <div style="display:flex;justify-content:space-between;margin-bottom:12px">
                <h4 style="margin:0">证据清单 ({{ currentCase.evidences?.length || 0 }})</h4>
                <el-button type="primary" size="small" @click="goEvidence">前往证据中心</el-button>
              </div>
              <el-table :data="currentCase.evidences || []" size="small">
                <el-table-column prop="evidence_no" label="编号" width="160" />
                <el-table-column prop="evidence_name" label="名称" min-width="180" show-overflow-tooltip />
                <el-table-column prop="evidence_type_display" label="类型" width="90" />
                <el-table-column label="状态" width="90">
                  <template #default="{ row }">
                    <el-tag size="small" :type="row.storage_status === 'in_store' ? 'success' : row.storage_status === 'lost' ? 'danger' : 'warning'">
                      {{ row.storage_status_display }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="page_count" label="页数" width="70" align="right" />
                <el-table-column label="版本" width="60" align="center" prop="version" />
                <el-table-column label="上传人" width="100">
                  <template #default="{ row }">{{ row.uploaded_by_info?.full_name }}</template>
                </el-table-column>
                <el-table-column prop="created_at" label="上传时间" width="150">
                  <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
                </el-table-column>
                <el-table-column label="操作" width="100">
                  <template #default="{ row }">
                    <el-button type="primary" link size="small" @click="previewEvidence(row)">预览</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>

            <el-tab-pane label="工时记录" name="worklog">
              <el-table :data="workLogs" v-loading="workLogLoading" size="small">
                <el-table-column prop="work_date" label="日期" width="110" />
                <el-table-column label="人员" width="100">
                  <template #default="{ row }">{{ row.worker_info?.full_name }}</template>
                </el-table-column>
                <el-table-column label="时间段" width="130">
                  <template #default="{ row }">{{ row.start_time?.slice(0,5) }}-{{ row.end_time?.slice(0,5) }}</template>
                </el-table-column>
                <el-table-column prop="duration" label="工时" width="70" align="right" />
                <el-table-column prop="work_type_display" label="类型" width="100" />
                <el-table-column prop="work_content" label="内容" min-width="200" show-overflow-tooltip />
                <el-table-column label="计费" width="90" align="right">
                  <template #default="{ row }">
                    <span :class="{ gray: row.billable_status === 'non_billable' }">
                      ¥{{ (row.actual_amount || 0).toLocaleString() }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column label="状态" width="80">
                  <template #default="{ row }">
                    <el-tag size="small" :type="row.approval_status === 'approved' ? 'success' : row.approval_status === 'submitted' ? 'warning' : 'info'">
                      {{ row.approval_status_display }}
                    </el-tag>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
          </el-tabs>
        </div>
      </el-col>

      <el-col :span="8">
        <div class="card">
          <h3 style="font-size:15px;margin:0 0 16px;color:#2d3748;padding-bottom:12px;border-bottom:1px solid #edf2f7">案件时间线</h3>
          <el-steps direction="vertical" :active="stepIndex" finish-status="success">
            <el-step
              v-for="(s, i) in caseSteps"
              :key="s.status"
              :title="s.label"
              :description="s.desc"
              :status="s.done ? 'success' : s.current ? 'process' : 'wait'"
            />
          </el-steps>
        </div>
        <div class="card" style="margin-top:16px">
          <h3 style="font-size:15px;margin:0 0 16px;color:#2d3748;padding-bottom:12px;border-bottom:1px solid #edf2f7">操作快捷</h3>
          <div class="quick-actions">
            <el-button @click="goEvidence" style="width:100%;justify-content:flex-start;margin-bottom:8px">
              <el-icon><FolderOpened /></el-icon> 上传证据材料
            </el-button>
            <el-button @click="openTrialDialog" style="width:100%;justify-content:flex-start;margin-bottom:8px">
              <el-icon><Calendar /></el-icon> 安排庭审
            </el-button>
            <el-button @click="genDoc" style="width:100%;justify-content:flex-start;margin-bottom:8px">
              <el-icon><Tickets /></el-icon> 生成法律文书
            </el-button>
            <el-button @click="router.push(`/billing?case=${currentCase.id}`)" style="width:100%;justify-content:flex-start;margin-bottom:8px">
              <el-icon><EditPen /></el-icon> 录入工时
            </el-button>
            <el-button @click="router.push(`/contracts?case=${currentCase.id}`)" style="width:100%;justify-content:flex-start;margin-bottom:8px">
              <el-icon><Notebook /></el-icon> 查看合同
            </el-button>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  ArrowLeft, Edit, Document, UserFilled, ArrowDown, Warning,
  FolderOpened, Calendar, Tickets, EditPen, Notebook
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useCaseStore } from '@/stores/cases'
import { useTrialStore } from '@/stores/trial'
import { caseApi, workLogApi, trialApi } from '@/api/modules'
import type { Case, Evidence } from '@/types'
import dayjs from 'dayjs'

const router = useRouter()
const route = useRoute()
const caseStore = useCaseStore()
const trialStore = useTrialStore()

const activeTab = ref('info')
const currentCase = ref<Case | null>(null)
const workLogs = ref<any[]>([])
const workLogLoading = ref(false)

const statusOptions = [
  { label: '咨询登记', value: 'consulting' },
  { label: '利益冲突审查', value: 'conflict_check' },
  { label: '正式立案', value: 'filing' },
  { label: '已分配', value: 'assigned' },
  { label: '办理中', value: 'handling' },
  { label: '庭审阶段', value: 'trial' },
  { label: '执行阶段', value: 'execution' },
  { label: '结案归档', value: 'closing' },
  { label: '已结案', value: 'closed' },
  { label: '中止', value: 'suspended' },
]

const caseSteps = computed(() => {
  const steps = [
    { status: 'consulting', label: '咨询登记', desc: '客户咨询并初步登记', done: false, current: false },
    { status: 'conflict_check', label: '利益冲突审查', desc: '利益冲突检索与审批', done: false, current: false },
    { status: 'filing', label: '正式立案', desc: '签订合同并立案', done: false, current: false },
    { status: 'assigned', label: '律师分配', desc: '分配主办律师与助理', done: false, current: false },
    { status: 'handling', label: '案件办理', desc: '案件准备与证据收集', done: false, current: false },
    { status: 'trial', label: '庭审阶段', desc: '出庭与审理', done: false, current: false },
    { status: 'execution', label: '执行阶段', desc: '判决执行程序', done: false, current: false },
    { status: 'closing', label: '结案归档', desc: '结案并归档材料', done: false, current: false },
    { status: 'closed', label: '已结案', desc: '案件完成', done: false, current: false },
  ]
  const order = steps.map(s => s.status)
  const curIdx = order.indexOf(currentCase.value?.status || '')
  steps.forEach((s, i) => {
    s.done = i < curIdx
    s.current = i === curIdx
    if (s.status === 'consulting' && currentCase.value?.conflict_checked) s.desc += ' ✓'
  })
  return steps
})
const stepIndex = computed(() => {
  const idx = caseSteps.value.findIndex(s => s.current)
  return idx > -1 ? idx + 1 : 0
})

function formatTime(t: string) { return dayjs(t).format('YYYY-MM-DD HH:mm') }
function formatDate(t: string) { return dayjs(t).format('YYYY-MM-DD') }
function formatAmount(v: number) { return (v || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 }) }
function caseTypeTag(t: string) {
  return ({ civil: 'primary', criminal: 'danger', administrative: 'warning', non_litigation: 'success' } as any)[t] || ''
}
function warningTag(l: string) {
  return ({ critical: 'danger', urgent: 'danger', warning: 'warning', notice: 'primary', expired: 'danger' } as any)[l] || 'info'
}
function progressType(t: string) {
  return ({ approve: 'success', reject: 'danger', update: 'primary', comment: 'info' } as any)[t] || 'primary'
}
function resultType(r: string) {
  return ({ pending: 'warning', ongoing: 'primary', completed: 'success', postponed: 'info', cancelled: 'danger' } as any)[r] || ''
}

async function loadDetail() {
  const id = Number(route.params.id)
  const c = await caseApi.detail(id) as any
  currentCase.value = c.data
  caseStore.currentCase = c.data
}

async function loadWorkLogs() {
  if (!currentCase.value) return
  workLogLoading.value = true
  try {
    const r = await workLogApi.list({ case: currentCase.value.id, page_size: 200 }) as any
    workLogs.value = r.data?.results || []
  } finally { workLogLoading.value = false }
}

async function onStatusCmd(s: string) {
  const { value: desc } = await ElMessageBox.prompt(`请输入操作说明`, `变更状态为：${statusOptions.find(x => x.value === s)?.label}`, {
    confirmButtonText: '确定', cancelButtonText: '取消', inputPlaceholder: '选填：变更原因'
  }).catch(() => '') as any
  if (!desc && desc !== '') return
  try {
    await caseApi.changeStatus(currentCase.value!.id, { status: s, description: desc })
    ElMessage.success('状态已变更')
    await loadDetail()
  } catch (e: any) { ElMessage.error(e.message) }
}

function editCase() { ElMessage.info('编辑案件功能待实现') }
function genDoc() { router.push('/templates') }
function goEvidence() { router.push(`/evidence?case=${currentCase.value?.id}`) }
function openTrialDialog() { router.push('/calendar') }
function previewEvidence(e: Evidence) {
  if (e.file_url) window.open(e.file_url)
  else ElMessage.info('该证据无预览文件')
}
function assignLawyer(c: Case) {
  ElMessage.info('请在案件管理列表中点击分配按钮')
}

watch(() => route.params.id, () => loadDetail())

onMounted(async () => {
  await loadDetail()
  await loadWorkLogs()
})
</script>

<style lang="scss" scoped>
.case-detail {
  .detail-header {
    background: #fff;
    padding: 20px 24px;
    border-radius: 10px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    margin-bottom: 16px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 20px;
    h2 { margin: 0; font-size: 18px; color: #2d3748; }
  }
  .detail-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .card {
    background: #fff;
    border-radius: 10px;
    padding: 20px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  .quick-actions { padding: 4px 0; }
  .gray { color: #a0aec0; }
}
</style>
