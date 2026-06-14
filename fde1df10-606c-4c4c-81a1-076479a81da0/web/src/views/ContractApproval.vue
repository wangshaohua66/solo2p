<template>
  <div class="contract-approval">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>合同审批</span>
          <el-button type="primary" @click="handleSubmit">
            <el-icon><Plus /></el-icon>
            提交合同
          </el-button>
        </div>
      </template>

      <el-tabs v-model="activeTab" @tab-change="fetchData">
        <el-tab-pane label="待我审批" name="pending" />
        <el-tab-pane label="我发起的" name="submitted" />
        <el-tab-pane label="已完成" name="completed" />
      </el-tabs>

      <el-table v-loading="loading" :data="contracts" stripe border>
        <el-table-column prop="ID" label="ID" width="80" />
        <el-table-column prop="Title" label="合同标题" min-width="200" show-overflow-tooltip />
        <el-table-column label="关联演出" min-width="160">
          <template #default="{ row }">
            {{ getBookingTitle(row.BookingID) }}
          </template>
        </el-table-column>
        <el-table-column label="当前步骤" width="140">
          <template #default="{ row }">
            <el-steps :active="row.CurrentStep" finish-status="success" align-center>
              <el-step title="技术" />
              <el-step title="财务" />
              <el-step title="场馆" />
            </el-steps>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.Status)">{{ statusText(row.Status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="提交时间" width="170">
          <template #default="{ row }">
            {{ formatDateTime(row.CreatedAt || '') }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleApprove(row)">
              {{ activeTab === 'pending' ? '审批' : '查看' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-drawer v-model="drawerVisible" title="合同审批" size="600px">
      <template v-if="currentContract">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="合同标题">{{ currentContract.Title }}</el-descriptions-item>
          <el-descriptions-item label="关联演出">{{ getBookingTitle(currentContract.BookingID) }}</el-descriptions-item>
          <el-descriptions-item label="当前状态">
            <el-tag :type="statusTagType(currentContract.Status)">{{ statusText(currentContract.Status) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="审批步骤">
            <el-steps :active="currentContract.CurrentStep" finish-status="success" align-center>
              <el-step title="技术审批" />
              <el-step title="财务审批" />
              <el-step title="场馆审批" />
            </el-steps>
          </el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left">合同内容</el-divider>
        <div class="contract-content">
          {{ currentContract.Content || '暂无内容' }}
        </div>

        <el-divider content-position="left">审批历史</el-divider>
        <el-timeline>
          <el-timeline-item
            v-for="(approval, index) in currentContract.Approvals || []"
            :key="index"
            :timestamp="formatDateTime(approval.CreatedAt)"
            :type="approvalActionType(approval.Action)"
            :icon="approvalActionIcon(approval.Action)"
          >
            <div class="approval-item">
              <span class="approval-action">{{ approvalActionText(approval.Action) }}</span>
              <span class="approval-comment" v-if="approval.Comment"> - {{ approval.Comment }}</span>
            </div>
          </el-timeline-item>
          <el-timeline-item v-if="!currentContract.Approvals?.length" type="info">
            暂无审批记录
          </el-timeline-item>
        </el-timeline>

        <template v-if="activeTab === 'pending'">
          <el-divider content-position="left">审批操作</el-divider>
          <el-form :model="approvalForm" label-width="80px">
            <el-form-item label="审批意见">
              <el-input
                v-model="approvalForm.Comment"
                type="textarea"
                :rows="3"
                placeholder="请输入审批意见（可选）"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="success" @click="doApprove('approve')">通过</el-button>
              <el-button type="warning" @click="doApprove('return')">退回修改</el-button>
              <el-button type="danger" @click="doApprove('reject')">驳回</el-button>
            </el-form-item>
          </el-form>
        </template>
      </template>
    </el-drawer>

    <el-dialog
      v-model="submitVisible"
      title="提交合同"
      width="600px"
      @close="resetSubmitForm"
    >
      <el-form :model="submitForm" :rules="submitRules" ref="submitFormRef" label-width="100px">
        <el-form-item label="关联演出" prop="BookingID">
          <el-select v-model="submitForm.BookingID" placeholder="请选择演出档期" style="width: 100%">
            <el-option
              v-for="booking in bookingOptions"
              :key="booking.ID"
              :label="booking.Title"
              :value="booking.ID"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="合同标题" prop="Title">
          <el-input v-model="submitForm.Title" placeholder="请输入合同标题" />
        </el-form-item>
        <el-form-item label="合同内容" prop="Content">
          <el-input
            v-model="submitForm.Content"
            type="textarea"
            :rows="8"
            placeholder="请输入合同内容"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="submitVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmitConfirm">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Plus, CircleCheck, Close, RefreshLeft } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { useBookingStore } from '@/stores/booking'
import {
  getContracts,
  createContract,
  approveContract,
  getContract
} from '@/api/finance'
import type { Contract, ContractStatus, ApprovalAction } from '@/types'

const bookingStore = useBookingStore()

const loading = ref(false)
const submitting = ref(false)
const activeTab = ref('pending')
const contracts = ref<Contract[]>([])
const drawerVisible = ref(false)
const submitVisible = ref(false)
const submitFormRef = ref<FormInstance>()
const currentContract = ref<Contract | null>(null)

const approvalForm = reactive({
  Comment: ''
})

const submitForm = reactive<Partial<Contract>>({
  BookingID: undefined,
  Title: '',
  Content: ''
})

const submitRules: FormRules = {
  BookingID: [{ required: true, message: '请选择演出档期', trigger: 'change' }],
  Title: [{ required: true, message: '请输入合同标题', trigger: 'blur' }],
  Content: [{ required: true, message: '请输入合同内容', trigger: 'blur' }]
}

const bookingOptions = computed(() => bookingStore.bookings)

const formatDateTime = (val: string) => {
  if (!val) return '-'
  return dayjs(val).format('YYYY-MM-DD HH:mm:ss')
}

const statusText = (status: ContractStatus) => {
  const map: Record<ContractStatus, string> = {
    pending_tech: '待技术审批',
    pending_finance: '待财务审批',
    pending_venue: '待场馆审批',
    approved: '已通过',
    rejected: '已驳回',
    returned: '已退回'
  }
  return map[status] || status
}

const statusTagType = (status: ContractStatus) => {
  const map: Record<ContractStatus, 'warning' | 'info' | 'success' | 'danger'> = {
    pending_tech: 'warning',
    pending_finance: 'warning',
    pending_venue: 'warning',
    approved: 'success',
    rejected: 'danger',
    returned: 'info'
  }
  return map[status] || 'info'
}

const approvalActionText = (action: ApprovalAction) => {
  const map: Record<ApprovalAction, string> = {
    approve: '审批通过',
    reject: '审批驳回',
    return: '退回修改'
  }
  return map[action] || action
}

const approvalActionType = (action: ApprovalAction) => {
  const map: Record<ApprovalAction, 'success' | 'danger' | 'warning'> = {
    approve: 'success',
    reject: 'danger',
    return: 'warning'
  }
  return map[action] || 'primary'
}

const approvalActionIcon = (action: ApprovalAction) => {
  const map: Record<ApprovalAction, any> = {
    approve: CircleCheck,
    reject: Close,
    return: RefreshLeft
  }
  return map[action]
}

const getBookingTitle = (bookingId: number) => {
  const booking = bookingStore.bookings.find(b => b.ID === bookingId)
  return booking?.Title || `档期#${bookingId}`
}

const fetchData = async () => {
  loading.value = true
  try {
    await bookingStore.fetchBookings()
    let status: string | undefined
    if (activeTab.value === 'completed') {
      status = 'approved'
    } else if (activeTab.value === 'pending') {
      status = 'pending'
    }
    contracts.value = await getContracts(status ? { status } : undefined)
  } catch (e) {
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

const handleApprove = async (row: Contract) => {
  currentContract.value = await getContract(row.ID)
  approvalForm.Comment = ''
  drawerVisible.value = true
}

const doApprove = async (action: 'approve' | 'reject' | 'return') => {
  if (!currentContract.value) return
  try {
    await approveContract(currentContract.value.ID, {
      Action: action,
      Comment: approvalForm.Comment
    })
    ElMessage.success('操作成功')
    drawerVisible.value = false
    fetchData()
  } catch (e) {
    ElMessage.error('操作失败')
  }
}

const handleSubmit = () => {
  resetSubmitForm()
  submitVisible.value = true
}

const resetSubmitForm = () => {
  Object.assign(submitForm, {
    BookingID: undefined,
    Title: '',
    Content: ''
  })
  submitFormRef.value?.resetFields()
}

const handleSubmitConfirm = async () => {
  if (!submitFormRef.value) return
  await submitFormRef.value.validate(async valid => {
    if (!valid) return
    submitting.value = true
    try {
      await createContract(submitForm)
      ElMessage.success('提交成功')
      submitVisible.value = false
      resetSubmitForm()
      fetchData()
    } catch (e) {
      ElMessage.error('提交失败')
    } finally {
      submitting.value = false
    }
  })
}

onMounted(fetchData)
</script>

<style scoped lang="scss">
.contract-approval {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .contract-content {
    background: #f5f7fa;
    padding: 16px;
    border-radius: 4px;
    white-space: pre-wrap;
    line-height: 1.8;
    min-height: 120px;
  }

  .approval-item {
    font-size: 14px;

    .approval-action {
      font-weight: 600;
    }

    .approval-comment {
      color: #606266;
    }
  }
}
</style>
