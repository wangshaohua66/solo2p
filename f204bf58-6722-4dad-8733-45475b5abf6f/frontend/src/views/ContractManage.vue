<template>
  <div class="contract-manage">
    <div class="page-header">
      <h2 class="page-title">合同管理</h2>
      <el-button type="primary" @click="showForm = true">
        <el-icon><Plus /></el-icon> 新建合同
      </el-button>
    </div>
    <div class="card">
      <div class="filter-bar">
        <el-select v-model="filterType" placeholder="合同类型" clearable style="width:140px" @change="loadData">
          <el-option label="法律顾问" value="retainer" />
          <el-option label="诉讼委托" value="engagement" />
          <el-option label="非诉委托" value="non_litigation" />
          <el-option label="刑事辩护" value="criminal" />
          <el-option label="劳动仲裁" value="labor" />
          <el-option label="其他" value="other" />
        </el-select>
        <el-select v-model="filterStatus" placeholder="合同状态" clearable style="width:140px" @change="loadData">
          <el-option label="草稿" value="draft" />
          <el-option label="审批中" value="reviewing" />
          <el-option label="已签署" value="signed" />
          <el-option label="履行中" value="effective" />
          <el-option label="已到期" value="expired" />
          <el-option label="已解除" value="terminated" />
        </el-select>
        <el-select v-model="filterApproval" placeholder="审批状态" clearable style="width:120px" @change="loadData">
          <el-option label="待审批" value="pending" />
          <el-option label="已通过" value="approved" />
          <el-option label="已驳回" value="rejected" />
        </el-select>
      </div>
      <el-table :data="contracts" v-loading="loading">
        <el-table-column prop="contract_no" label="合同编号" width="150" fixed="left" />
        <el-table-column prop="contract_name" label="合同名称" min-width="200" show-overflow-tooltip />
        <el-table-column label="客户" min-width="180">
          <template #default="{ row }">
            {{ row.client_info?.client_no }} {{ row.client_info?.client_name }}
          </template>
        </el-table-column>
        <el-table-column prop="contract_type_display" label="类型" width="110">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ row.contract_type_display }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="合同金额" width="130" align="right">
          <template #default="{ row }">¥{{ (row.total_amount || 0).toLocaleString() }}</template>
        </el-table-column>
        <el-table-column label="已付/未付" width="180" align="right">
          <template #default="{ row }">
            <span style="color:#38a169">¥{{ (row.paid_amount || 0).toLocaleString() }}</span>
            <span style="color:#a0aec0"> / </span>
            <span style="color:#e53e3e">¥{{ (row.unpaid_amount || 0).toLocaleString() }}</span>
          </template>
        </el-table-column>
        <el-table-column label="有效期" width="220">
          <template #default="{ row }">
            {{ row.effective_date }} ~ {{ row.expire_date }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="statusTag(row.status)">{{ row.status_display }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="审批" width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="row.approval_status === 'approved' ? 'success' : row.approval_status === 'rejected' ? 'danger' : 'warning'" effect="light">
              {{ row.approval_status_display }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small">预览</el-button>
            <el-button link size="small" @click="recordPay(row)">收款</el-button>
            <el-button type="success" link size="small" v-if="row.approval_status === 'pending' && isPartner" @click="approve(row)">审批</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { contractApi } from '@/api/modules'
import { useUserStore } from '@/stores/user'
import type { Contract } from '@/types'

const userStore = useUserStore()
const isPartner = userStore.isPartner

const contracts = ref<Contract[]>([])
const loading = ref(false)
const showForm = ref(false)
const filterType = ref('')
const filterStatus = ref('')
const filterApproval = ref('')

function statusTag(s: string) {
  return ({
    draft: 'info', reviewing: 'warning', signed: '', effective: 'primary',
    expired: 'danger', terminated: 'danger'
  } as any)[s] || ''
}

async function loadData() {
  loading.value = true
  try {
    const params: any = { page_size: 100 }
    if (filterType.value) params.contract_type = filterType.value
    if (filterStatus.value) params.status = filterStatus.value
    if (filterApproval.value) params.approval_status = filterApproval.value
    const r = await contractApi.list(params) as any
    contracts.value = r.data?.results || []
  } finally { loading.value = false }
}

async function approve(row: Contract) {
  try {
    await contractApi.approve(row.id, { approved: true })
    ElMessage.success('审批通过')
    await loadData()
  } catch (e: any) { ElMessage.error(e.message) }
}

async function recordPay(row: Contract) {
  const { value } = await ElMessageBox.prompt(`当前待收：¥${(row.unpaid_amount || 0).toLocaleString()}`, '登记收款', {
    inputType: 'number',
    inputPattern: /^\d+(\.\d{1,2})?$/,
    inputErrorMessage: '请输入正确的金额',
    confirmButtonText: '确定',
    cancelButtonText: '取消'
  }).catch(() => null) as any
  if (value && parseFloat(value) > 0) {
    try {
      await contractApi.recordPayment(row.id, {
        plan_id: row.payment_plans?.[0]?.id || row.id,
        amount: parseFloat(value)
      })
      ElMessage.success('已登记')
      await loadData()
    } catch (e: any) { ElMessage.error(e.message) }
  }
}

onMounted(loadData)
</script>

<style lang="scss" scoped>
.contract-manage { }
</style>
