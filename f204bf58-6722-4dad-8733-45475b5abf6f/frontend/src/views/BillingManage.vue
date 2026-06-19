<template>
  <div class="billing-manage">
    <el-tabs v-model="activeTab" type="border-card">
      <el-tab-pane label="工时录入" name="worklog">
        <div class="page-header">
          <div>
            <p style="color:#718096;font-size:13px">
              本月已录工时 <b style="color:#1e3a5f;font-size:16px">{{ summary.total_hours || 0 }}</b> 小时，
              可计费金额 <b style="color:#38a169;font-size:16px">¥{{ (summary.total_actual_amount || 0).toLocaleString() }}</b>
            </p>
          </div>
          <el-button type="primary" @click="openWorkLog">
            <el-icon><Plus /></el-icon> 录工时
          </el-button>
        </div>

        <div class="summary-row">
          <div class="sm-card" style="border-color:#4299e1">
            <p class="sm-label">总工时</p>
            <p class="sm-value blue">{{ summary.total_hours || 0 }}h</p>
          </div>
          <div class="sm-card" style="border-color:#38a169">
            <p class="sm-label">可计费</p>
            <p class="sm-value green">¥{{ (summary.total_actual_amount || 0).toLocaleString() }}</p>
          </div>
          <div class="sm-card" style="border-color:#d69e2e">
            <p class="sm-label">待确认</p>
            <p class="sm-value orange">{{ pendingCount }}条</p>
          </div>
          <div class="sm-card" style="border-color:#e53e3e">
            <p class="sm-label">差旅费</p>
            <p class="sm-value red">¥{{ (summary.total_travel_expenses || 0).toLocaleString() }}</p>
          </div>
        </div>

        <div class="filter-bar">
          <el-select v-model="wlFilter.worker" placeholder="工作人员" clearable filterable style="width:140px" @change="loadLogs">
            <el-option v-for="l in lawyerList" :key="l.id" :label="l.full_name" :value="l.id" />
          </el-select>
          <el-select v-model="wlFilter.case" placeholder="关联案件" clearable filterable style="width:200px" @change="loadLogs">
            <el-option v-for="c in caseList" :key="c.id" :label="`${c.case_no} ${c.case_name}`" :value="c.id" />
          </el-select>
          <el-select v-model="wlFilter.work_type" placeholder="工作类型" clearable style="width:120px" @change="loadLogs">
            <el-option v-for="t in workTypes" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
          <el-select v-model="wlFilter.approval_status" placeholder="确认状态" clearable style="width:120px" @change="loadLogs">
            <el-option label="草稿" value="draft" />
            <el-option label="待确认" value="submitted" />
            <el-option label="已确认" value="approved" />
            <el-option label="已调整" value="adjusted" />
            <el-option label="已驳回" value="rejected" />
          </el-select>
          <el-date-picker
            v-model="wlFilter.dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="开始"
            end-placeholder="结束"
            style="width:240px"
            @change="loadLogs"
          />
          <el-button v-if="isPartner" type="success" @click="batchApproveAll">
            批量确认
          </el-button>
        </div>

        <el-table :data="workLogs" v-loading="billingStore.loading" row-key="id">
          <el-table-column prop="work_date" label="日期" width="110" fixed="left" />
          <el-table-column label="人员" width="100">
            <template #default="{ row }">{{ row.worker_info?.full_name }}</template>
          </el-table-column>
          <el-table-column label="时间段" width="130">
            <template #default="{ row }">
              {{ row.start_time?.slice(0, 5) }} - {{ row.end_time?.slice(0, 5) }}
            </template>
          </el-table-column>
          <el-table-column prop="duration" label="工时" width="70" align="right">
            <template #default="{ row }"><b>{{ row.duration }}</b>h</template>
          </el-table-column>
          <el-table-column prop="work_type_display" label="类型" width="100" />
          <el-table-column label="工作内容" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">{{ row.work_content }}</template>
          </el-table-column>
          <el-table-column label="关联案件" width="160">
            <template #default="{ row }">{{ row.case_info?.case_no }}</template>
          </el-table-column>
          <el-table-column label="计费" width="70" align="right">
            <template #default="{ row }">
              <span :class="row.billable_status === 'non_billable' ? 'gray' : ''">
                ¥{{ row.actual_amount?.toLocaleString() }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag size="small" :type="approvalTag(row.approval_status)">
                {{ row.approval_status_display }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="180" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="editLog(row)">编辑</el-button>
              <el-button
                v-if="row.approval_status === 'draft' || row.approval_status === 'rejected'"
                link size="small" @click="submitLog(row)"
              >提交</el-button>
              <el-button
                v-if="isPartner && row.approval_status === 'submitted'"
                type="success" link size="small"
                @click="approveLog(row)"
              >确认</el-button>
              <el-button type="danger" link size="small" @click="deleteLog(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination">
          <el-pagination
            v-model:current-page="billingStore.logFilters.page"
            v-model:page-size="billingStore.logFilters.page_size"
            :page-sizes="[20, 50, 100]"
            :total="billingStore.logsTotal"
            layout="total, sizes, prev, pager, next, jumper"
            @current-change="loadLogs"
            @size-change="loadLogs"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane label="结算单" name="settlement">
        <div class="page-header">
          <el-button type="primary" @click="openSettlement">
            <el-icon><Plus /></el-icon> 新建结算
          </el-button>
        </div>
        <el-alert
          v-if="overdueSettlements.length"
          type="error"
          :closable="false"
          show-icon
          style="margin-bottom:16px"
        >
          <template #title>
            有 {{ overdueSettlements.length }} 张结算单已逾期，
            <el-button link type="danger" @click="activeTab = 'settlement';loadSettlements()">查看</el-button>
          </template>
        </el-alert>
        <el-table :data="settlements">
          <el-table-column prop="settlement_no" label="结算单号" width="170" fixed="left" />
          <el-table-column label="客户" min-width="160">
            <template #default="{ row }">{{ row.client_info?.client_name }}</template>
          </el-table-column>
          <el-table-column label="案件" width="160">
            <template #default="{ row }">{{ row.case_info?.case_no }} {{ row.case_info?.case_name?.slice(0,10) }}</template>
          </el-table-column>
          <el-table-column label="周期" width="220">
            <template #default="{ row }">{{ row.period_start }} ~ {{ row.period_end }}</template>
          </el-table-column>
          <el-table-column prop="total_hours" label="工时" width="80" align="right" />
          <el-table-column label="结算金额" width="120" align="right">
            <template #default="{ row }">
              <b style="color:#1e3a5f">¥{{ row.settlement_amount?.toLocaleString() }}</b>
            </template>
          </el-table-column>
          <el-table-column label="已到账" width="110" align="right">
            <template #default="{ row }">
              <span :style="{ color: row.paid_amount >= row.settlement_amount ? '#38a169' : '#e53e3e' }">
                ¥{{ row.paid_amount?.toLocaleString() }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="due_date" label="付款截止" width="110" />
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag size="small" :type="settleTag(row.status)" effect="light">
                {{ row.status_display }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="180" fixed="right">
            <template #default="{ row }">
              <el-button link size="small" @click="viewSettlement(row)">详情</el-button>
              <el-button type="success" link size="small" @click="recordPayment(row)">到账</el-button>
              <el-button v-if="isPartner && row.approval_status === 'pending'" type="primary" link size="small" @click="approveSm(row)">审批</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="发票管理" name="invoice">
        <div class="page-header">
          <el-button type="primary" @click="openInvoice">
            <el-icon><Plus /></el-icon> 开具发票
          </el-button>
        </div>
        <el-table :data="invoices">
          <el-table-column prop="invoice_no" label="发票号" width="180" />
          <el-table-column prop="issue_date" label="开票日期" width="110" />
          <el-table-column label="客户" min-width="160">
            <template #default="{ row }">{{ row.buyer_name }}</template>
          </el-table-column>
          <el-table-column prop="invoice_type_display" label="发票类型" width="130" />
          <el-table-column label="价税合计" width="130" align="right">
            <template #default="{ row }">
              <b>¥{{ row.total_amount?.toLocaleString() }}</b>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag size="small" :type="invoiceTag(row.status)">{{ row.status_display }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="140">
            <template #default="{ row }">
              <el-button link size="small">下载</el-button>
              <el-button v-if="row.status === 'draft'" type="success" link size="small" @click="markSent(row)">寄出</el-button>
              <el-button v-if="row.status === 'issued'" type="danger" link size="small" @click="voidInvoice(row)">作废</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="统计报表" name="report">
        <div class="summary-row" style="margin-top:16px">
          <div class="sm-card" style="border-color:#4299e1">
            <p class="sm-label">结算单数</p>
            <p class="sm-value blue">{{ settlementStats.total || 0 }}</p>
          </div>
          <div class="sm-card" style="border-color:#38a169">
            <p class="sm-label">已结算总额</p>
            <p class="sm-value green">¥{{ (settlementStats.total_amount || 0).toLocaleString() }}</p>
          </div>
          <div class="sm-card" style="border-color:#e53e3e">
            <p class="sm-label">待收金额</p>
            <p class="sm-value red">¥{{ (settlementStats.total_unpaid || 0).toLocaleString() }}</p>
          </div>
          <div class="sm-card" style="border-color:#d69e2e">
            <p class="sm-label">已到账率</p>
            <p class="sm-value orange">
              {{ settlementStats.total_amount ? ((settlementStats.total_paid || 0) / settlementStats.total_amount * 100).toFixed(1) : 0 }}%
            </p>
          </div>
        </div>
        <div class="card" style="margin-top:16px">
          <h3 style="margin-bottom:20px;font-size:15px;color:#2d3748">月度计费趋势</h3>
          <v-chart style="height:340px" :option="chartOption" autoresize />
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="showWorkForm" :title="isLogEdit ? '编辑工时' : '录入工时'" width="560px">
      <el-form :model="workForm" :rules="workRules" ref="workFormRef" label-width="100px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="工作日期" prop="work_date">
              <el-date-picker v-model="workForm.work_date" type="date" value-format="YYYY-MM-DD" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="工作人员" prop="worker">
              <el-select v-model="workForm.worker" filterable style="width:100%">
                <el-option v-for="u in userList" :key="u.id" :label="`${u.full_name} (${u.position || u.role})`" :value="u.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="开始时间" prop="start_time">
              <el-time-picker v-model="workForm.start_time" format="HH:mm" value-format="HH:mm:ss" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="结束时间" prop="end_time">
              <el-time-picker v-model="workForm.end_time" format="HH:mm" value-format="HH:mm:ss" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="工作类型" prop="work_type">
              <el-select v-model="workForm.work_type" style="width:100%">
                <el-option v-for="t in workTypes" :key="t.value" :label="t.label" :value="t.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="小时费率(元)">
              <el-input-number v-model="workForm.hourly_rate" :min="0" :precision="2" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="关联案件" prop="case">
              <el-select v-model="workForm.case" filterable style="width:100%" @change="onCaseChange">
                <el-option v-for="c in caseList" :key="c.id" :label="`${c.case_no} ${c.case_name}`" :value="c.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="计费状态" prop="billable_status">
              <el-select v-model="workForm.billable_status" style="width:100%">
                <el-option label="可计费" value="billable" />
                <el-option label="不计费" value="non_billable" />
                <el-option label="优惠免费" value="no_charge" />
                <el-option label="风险代理计时" value="contingency" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="工作内容" prop="work_content">
              <el-input v-model="workForm.work_content" type="textarea" :rows="3" placeholder="请详细描述工作内容..." />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="差旅费(元)">
              <el-input-number v-model="workForm.travel_expense" :min="0" :precision="2" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="其他费用(元)">
              <el-input-number v-model="workForm.other_expense" :min="0" :precision="2" style="width:100%" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="showWorkForm = false">取消</el-button>
        <el-button @click="saveWork('draft')">保存草稿</el-button>
        <el-button type="primary" :loading="submitting" @click="saveWork('submit')">保存并提交</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showSettleForm" title="新建结算单" width="620px">
      <el-form label-width="100px">
        <el-form-item label="客户">
          <el-select v-model="settleForm.client" filterable style="width:100%" @change="loadClientCases">
            <el-option v-for="c in clientList" :key="c.id" :label="`${c.client_no} ${c.client_name}`" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="关联案件">
          <el-select v-model="settleForm.case" filterable clearable style="width:100%" @change="loadUnbilledLogs">
            <el-option v-for="c in clientCases" :key="c.id" :label="`${c.case_no} ${c.case_name}`" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="结算周期">
          <el-date-picker v-model="settleForm.range" type="daterange" value-format="YYYY-MM-DD" style="width:100%" range-separator="至" start-placeholder="开始" end-placeholder="结束" />
        </el-form-item>
        <el-form-item label="选择工时">
          <el-table :data="unbilledLogs" size="small" @selection-change="onSelLogs" ref="logTableRef">
            <el-table-column type="selection" width="40" />
            <el-table-column prop="work_date" label="日期" width="100" />
            <el-table-column label="人员" width="90">
              <template #default="{ row }">{{ row.worker_info?.full_name }}</template>
            </el-table-column>
            <el-table-column prop="work_type_display" label="类型" width="90" />
            <el-table-column prop="duration" label="工时" width="70" align="right" />
            <el-table-column label="金额" width="90" align="right">
              <template #default="{ row }">¥{{ (row.actual_amount || 0).toLocaleString() }}</template>
            </el-table-column>
          </el-table>
        </el-form-item>
        <el-form-item label="优惠减免(元)">
          <el-input-number v-model="settleForm.discount_amount" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="合计">
          <div style="font-size:20px;font-weight:600;color:#1e3a5f">
            ¥{{ settleTotal.toLocaleString() }}
            <span style="font-size:13px;color:#718096;font-weight:400;margin-left:8px">
              (共{{ selectedLogs.length }}条，工时{{ selectedHours }}h)
            </span>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSettleForm = false">取消</el-button>
        <el-button type="primary" @click="submitSettle">生成结算单</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showPayDialog" title="登记到账" width="400px">
      <el-form label-width="90px">
        <el-form-item label="到账金额(元)">
          <el-input-number v-model="payForm.amount" :min="0" :precision="2" style="width:100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showPayDialog = false">取消</el-button>
        <el-button type="primary" @click="submitPayment">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import {
  Plus, Document, Money, Calendar, User
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent } from 'echarts/components'
import type { EChartsOption } from 'echarts'
import { useBillingStore } from '@/stores/billing'
import { useUserStore } from '@/stores/user'
import { userApi, caseApi, clientApi, workLogApi, settlementApi, invoiceApi } from '@/api/modules'
import dayjs from 'dayjs'

use([CanvasRenderer, BarChart, LineChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent])

const billingStore = useBillingStore()
const userStore = useUserStore()
const workFormRef = ref<FormInstance>()
const logTableRef = ref()
const submitting = ref(false)

const activeTab = ref('worklog')
const isPartner = computed(() => userStore.isPartner)

const showWorkForm = ref(false)
const showSettleForm = ref(false)
const showPayDialog = ref(false)
const showInvoice = ref(false)
const isLogEdit = ref(false)
const currentLog = ref<any>(null)
const currentSm = ref<any>(null)

const lawyerList = ref<any[]>([])
const userList = ref<any[]>([])
const caseList = ref<any[]>([])
const clientList = ref<any[]>([])
const clientCases = ref<any[]>([])
const unbilledLogs = ref<any[]>([])
const selectedLogs = ref<any[]>([])
const workLogs = computed(() => billingStore.workLogs)
const settlements = computed(() => billingStore.settlements)
const invoices = computed(() => billingStore.invoices)
const summary = computed<any>(() => billingStore.workLogSummary || {})
const settlementStats = computed<any>(() => billingStore.settlementStats || {})
const overdueSettlements = computed(() => settlements.value.filter(s => ['draft', 'approved', 'partial_paid', 'invoicing', 'completed'].includes(s.status) && (s.unpaid_amount || 0) > 0 && dayjs(s.due_date).isBefore(dayjs())))
const pendingCount = computed(() => workLogs.value.filter(w => w.approval_status === 'submitted').length)

const wlFilter = reactive({
  worker: null as number | null,
  case: null as number | null,
  work_type: '',
  approval_status: '',
  dateRange: [] as string[]
})

const workTypes = [
  { label: '法律咨询', value: 'consultation' },
  { label: '客户会见', value: 'meeting' },
  { label: '法律研究', value: 'research' },
  { label: '文书起草', value: 'drafting' },
  { label: '文件审阅', value: 'reviewing' },
  { label: '谈判协商', value: 'negotiation' },
  { label: '开庭审理', value: 'trial' },
  { label: '证据整理', value: 'evidence' },
  { label: '立案归档', value: 'filing' },
  { label: '执行事务', value: 'execution' },
  { label: '出差交通', value: 'travel' },
  { label: '电话/邮件', value: 'communication' },
  { label: '案件研讨', value: 'conference' },
  { label: '培训学习', value: 'training' },
  { label: '行政事务', value: 'admin' },
  { label: '其他工作', value: 'other' },
]

const defaultWorkForm = () => ({
  work_date: dayjs().format('YYYY-MM-DD'),
  worker: userStore.user?.id || null,
  start_time: '09:00:00',
  end_time: '10:00:00',
  work_type: 'research',
  hourly_rate: userStore.user?.hourly_rate || 500,
  case: null as number | null,
  client: null as number | null,
  billable_status: 'billable',
  work_content: '',
  travel_expense: 0,
  other_expense: 0,
  participants: [] as number[],
})

const workForm = reactive<any>(defaultWorkForm())

const workRules: FormRules = {
  work_date: [{ required: true, message: '请选择日期' }],
  worker: [{ required: true, message: '请选择人员' }],
  start_time: [{ required: true, message: '请选择开始时间' }],
  end_time: [{ required: true, message: '请选择结束时间' }],
  work_type: [{ required: true, message: '请选择类型' }],
  case: [{ required: true, message: '请选择案件' }],
  work_content: [{ required: true, message: '请填写工作内容' }],
}

const settleForm = reactive({
  client: null as number | null,
  case: null as number | null,
  range: [] as string[],
  discount_amount: 0,
  period_start: '',
  period_end: '',
  work_log_ids: [] as number[],
})

const payForm = reactive({ amount: 0 })

const selectedHours = computed(() => selectedLogs.value.reduce((s, l) => s + (l.duration || 0), 0))
const selectedAmount = computed(() => selectedLogs.value.reduce((s, l) => s + (l.actual_amount || 0) + (l.travel_expense || 0) + (l.other_expense || 0), 0))
const settleTotal = computed(() => Math.max(0, selectedAmount.value - settleForm.discount_amount))

const chartOption = computed<EChartsOption>(() => {
  const data = settlementStats.value.by_month || []
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['结算金额', '已到账', '数量'], right: 0 },
    grid: { left: 50, right: 20, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: data.map((m: any) => dayjs(m.month).format('M月')) },
    yAxis: [{ type: 'value', name: '金额(万)' }, { type: 'value', name: '数量' }],
    series: [
      { name: '结算金额', type: 'bar', data: data.map((m: any) => +(m.amount / 10000).toFixed(2)), itemStyle: { color: '#4299e1', borderRadius: [4, 4, 0, 0] } },
      { name: '已到账', type: 'bar', data: data.map((m: any) => +((m.paid || 0) / 10000).toFixed(2)), itemStyle: { color: '#38a169', borderRadius: [4, 4, 0, 0] } },
      { name: '数量', type: 'line', yAxisIndex: 1, data: data.map((m: any) => m.count), smooth: true, itemStyle: { color: '#d69e2e' }, lineStyle: { width: 3 } }
    ]
  }
})

function approvalTag(s: string) {
  return ({ draft: 'info', submitted: 'warning', approved: 'success', rejected: 'danger', adjusted: 'primary' } as any)[s] || ''
}
function settleTag(s: string) {
  return ({ draft: 'info', reviewing: 'warning', approved: '', invoicing: 'primary', completed: '', partial_paid: 'warning', paid: 'success', overdue: 'danger' } as any)[s] || ''
}
function invoiceTag(s: string) {
  return ({ draft: 'info', issued: 'primary', sent: '', received: 'success', red_flushed: 'danger', cancelled: 'danger' } as any)[s] || ''
}

async function loadLogs() {
  const params: any = {}
  if (wlFilter.worker) params.worker = wlFilter.worker
  if (wlFilter.case) params.case = wlFilter.case
  if (wlFilter.work_type) params.work_type = wlFilter.work_type
  if (wlFilter.approval_status) params.approval_status = wlFilter.approval_status
  if (wlFilter.dateRange?.length === 2) {
    params.start_date = wlFilter.dateRange[0]
    params.end_date = wlFilter.dateRange[1]
  }
  await billingStore.fetchWorkLogs(params)
  await billingStore.fetchLogSummary(params)
}

async function loadSettlements() { await billingStore.fetchSettlements({ page_size: 100 }) }
async function loadInvoices() { await billingStore.fetchInvoices({ page_size: 100 }) }

function openWorkLog() {
  Object.assign(workForm, defaultWorkForm())
  isLogEdit.value = false
  currentLog.value = null
  showWorkForm.value = true
}

function editLog(row: any) {
  Object.assign(workForm, {
    work_date: row.work_date,
    worker: row.worker,
    start_time: row.start_time,
    end_time: row.end_time,
    work_type: row.work_type,
    hourly_rate: row.hourly_rate,
    case: row.case,
    client: row.client,
    billable_status: row.billable_status,
    work_content: row.work_content,
    travel_expense: row.travel_expense || 0,
    other_expense: row.other_expense || 0,
  })
  currentLog.value = row
  isLogEdit.value = true
  showWorkForm.value = true
}

function onCaseChange(id: number) {
  const c = caseList.value.find(x => x.id === id)
  if (c) workForm.client = c.client_info?.id
}

async function saveWork(type: 'draft' | 'submit') {
  if (!workFormRef.value) return
  await workFormRef.value.validate()
  submitting.value = true
  try {
    if (isLogEdit.value && currentLog.value) {
      await billingStore.updateWorkLog(currentLog.value.id, workForm)
    } else {
      await billingStore.createWorkLog(workForm)
    }
    if (type === 'submit' && isLogEdit.value) {
      await billingStore.submitWorkLog(isLogEdit.value ? currentLog.value.id : 0)
    }
    ElMessage.success('保存成功')
    showWorkForm.value = false
    await loadLogs()
  } catch (e: any) { ElMessage.error(e.message) }
  finally { submitting.value = false }
}

async function submitLog(row: any) {
  try {
    await billingStore.submitWorkLog(row.id)
    ElMessage.success('已提交确认')
    await loadLogs()
  } catch (e: any) { ElMessage.error(e.message) }
}

async function approveLog(row: any) {
  try {
    await billingStore.approveWorkLog(row.id, { approved: true })
    ElMessage.success('已确认')
    await loadLogs()
  } catch (e: any) { ElMessage.error(e.message) }
}

async function batchApproveAll() {
  const ids = workLogs.value.filter(w => w.approval_status === 'submitted').map(w => w.id)
  if (!ids.length) return ElMessage.warning('没有待确认的工时')
  try {
    await billingStore.approveWorkLog(0, { ids, approved: true } as any)
    ElMessage.success('批量确认完成')
    await loadLogs()
  } catch (e: any) { ElMessage.error(e.message) }
}

async function deleteLog(row: any) {
  await ElMessageBox.confirm('确定删除该工时记录吗？', '提示', { type: 'warning' })
  try {
    await billingStore.deleteWorkLog(row.id)
    ElMessage.success('已删除')
    await loadLogs()
  } catch (e: any) { ElMessage.error(e.message) }
}

function openSettlement() {
  Object.assign(settleForm, { client: null, case: null, range: [], discount_amount: 0, work_log_ids: [] })
  unbilledLogs.value = []
  selectedLogs.value = []
  showSettleForm.value = true
}

async function loadClientCases(id: number) {
  settleForm.case = null
  const c = caseList.value.filter(x => x.client_info?.id === id)
  clientCases.value = c
}

async function loadUnbilledLogs() {
  if (!settleForm.case) { unbilledLogs.value = []; return }
  const params: any = { case: settleForm.case, billed: 'false' }
  if (settleForm.range?.length === 2) {
    params.start_date = settleForm.range[0]
    params.end_date = settleForm.range[1]
  }
  const r = await workLogApi.list({ ...params, page_size: 500 }) as any
  unbilledLogs.value = (r.data?.results || []).filter(w => w.approval_status === 'approved')
}

function onSelLogs(rows: any[]) { selectedLogs.value = rows }

async function submitSettle() {
  if (!settleForm.client || !selectedLogs.value.length) {
    return ElMessage.warning('请选择客户和需要结算的工时')
  }
  if (!settleForm.range?.length) return ElMessage.warning('请选择结算周期')
  try {
    await billingStore.createSettlement({
      client: settleForm.client,
      case: settleForm.case,
      period_start: settleForm.range[0],
      period_end: settleForm.range[1],
      discount_amount: settleForm.discount_amount,
      due_date: dayjs(settleForm.range[1]).add(30, 'day').format('YYYY-MM-DD'),
      work_log_ids: selectedLogs.value.map(w => w.id),
      status: 'draft'
    })
    ElMessage.success('结算单已生成')
    showSettleForm.value = false
    await loadSettlements()
    await billingStore.fetchSettlementStats()
  } catch (e: any) { ElMessage.error(e.message) }
}

function viewSettlement(row: any) { ElMessage.info('查看详情功能待实现') }

function recordPayment(row: any) {
  currentSm.value = row
  payForm.amount = row.unpaid_amount || 0
  showPayDialog.value = true
}

async function submitPayment() {
  if (!currentSm.value || payForm.amount <= 0) return
  try {
    await billingStore.recordSettlementPayment(currentSm.value.id, payForm.amount)
    ElMessage.success('已登记到账')
    showPayDialog.value = false
    await loadSettlements()
    await billingStore.fetchSettlementStats()
  } catch (e: any) { ElMessage.error(e.message) }
}

async function approveSm(row: any) {
  try {
    await billingStore.approveSettlement(row.id, { approved: true })
    ElMessage.success('已审批')
    await loadSettlements()
  } catch (e: any) { ElMessage.error(e.message) }
}

function openInvoice() { ElMessage.info('发票开具功能待实现') }

async function markSent(row: any) {
  try {
    await invoiceApi.markSent(row.id)
    ElMessage.success('已标记寄出')
    await loadInvoices()
  } catch (e: any) { ElMessage.error(e.message) }
}

async function voidInvoice(row: any) {
  await ElMessageBox.confirm('确定作废该发票吗？', '提示', { type: 'warning' })
  try {
    await invoiceApi.voidInvoice(row.id)
    ElMessage.success('已作废')
    await loadInvoices()
  } catch (e: any) { ElMessage.error(e.message) }
}

onMounted(async () => {
  await Promise.all([
    loadLogs(),
    loadSettlements(),
    loadInvoices(),
    billingStore.fetchSettlementStats(),
    userApi.lawyers().then(r => { lawyerList.value = r.data; userList.value = r.data }),
    userApi.simpleList().then(r => { userList.value = [...userList.value, ...r.data] }),
    caseApi.list({ page_size: 300 }).then(r => { caseList.value = (r as any).data?.results || [] }),
    clientApi.simpleList().then(r => { clientList.value = r.data })
  ])
})
</script>

<style lang="scss" scoped>
.billing-manage {
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  .summary-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 16px;
    .sm-card {
      background: #fff;
      border-radius: 8px;
      padding: 14px 18px;
      border-left: 3px solid;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      .sm-label { color: #718096; font-size: 12px; margin: 0 0 6px; }
      .sm-value { margin: 0; font-size: 22px; font-weight: 600; &.blue { color: #4299e1; } &.green { color: #38a169; } &.orange { color: #d69e2e; } &.red { color: #e53e3e; } }
    }
  }
  .gray { color: #a0aec0; }
  .pagination {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;
  }
  :deep(.el-tabs__content) { padding: 0 4px; }
}
@media (max-width: 1100px) {
  .billing-manage .summary-row { grid-template-columns: repeat(2, 1fr); }
}
</style>
