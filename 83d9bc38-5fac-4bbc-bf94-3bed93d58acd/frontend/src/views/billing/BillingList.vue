<template>
  <div class="p-4 md:p-6">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">账单管理</h1>
      <p class="text-gray-500 mt-1">查看和管理所有账单记录</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6">
      <el-card class="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-blue-100 text-sm">经费余额</p>
            <p class="text-3xl font-bold mt-2">¥{{ budget.toFixed(2) }}</p>
          </div>
          <el-icon :size="48" class="text-blue-200"><Wallet /></el-icon>
        </div>
      </el-card>

      <el-card class="bg-gradient-to-r from-green-500 to-green-600 text-white">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-green-100 text-sm">本月消费</p>
            <p class="text-3xl font-bold mt-2">¥{{ monthlySpent.toFixed(2) }}</p>
          </div>
          <el-icon :size="48" class="text-green-200"><Money /></el-icon>
        </div>
      </el-card>

      <el-card class="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-orange-100 text-sm">待处理账单</p>
            <p class="text-3xl font-bold mt-2">{{ pendingCount }}</p>
          </div>
          <el-icon :size="48" class="text-orange-200"><Document /></el-icon>
        </div>
      </el-card>
    </div>

    <el-card class="mb-6">
      <el-form :inline="true" :model="filters" class="flex flex-wrap gap-4">
        <el-form-item label="用户">
          <el-select
            v-model="filters.userId"
            placeholder="全部用户"
            clearable
            filterable
            style="width: 180px"
            @change="handleSearch"
          >
            <el-option
              v-for="user in userList"
              :key="user.id"
              :label="user.name"
              :value="user.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="月份">
          <el-date-picker
            v-model="filters.month"
            type="month"
            placeholder="选择月份"
            value-format="YYYY-MM"
            style="width: 180px"
            @change="handleSearch"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select
            v-model="filters.status"
            placeholder="全部状态"
            clearable
            style="width: 150px"
            @change="handleSearch"
          >
            <el-option label="已支付" value="paid" />
            <el-option label="已退款" value="refunded" />
            <el-option label="待支付" value="pending" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">
            <el-icon><Search /></el-icon>
            搜索
          </el-button>
          <el-button @click="handleReset">
            <el-icon><Refresh /></el-icon>
            重置
          </el-button>
        </el-form-item>
        <el-form-item class="ml-auto">
          <el-button type="success" @click="openRechargeDialog">
            <el-icon><Plus /></el-icon>
            充值
          </el-button>
          <el-button type="warning" @click="handleExport">
            <el-icon><Download /></el-icon>
            导出月度报表
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <template #header>
        <span>账单记录</span>
      </template>

      <el-table
        v-loading="loading"
        :data="billingList"
        stripe
        style="width: 100%"
        @row-click="handleRowClick"
      >
        <el-table-column prop="id" label="账单ID" width="100" />
        <el-table-column prop="userName" label="用户" width="120">
          <template #default="{ row }">
            {{ row.user?.name || row.userName }}
          </template>
        </el-table-column>
        <el-table-column prop="equipmentName" label="设备" min-width="150">
          <template #default="{ row }">
            {{ row.equipmentName }}
          </template>
        </el-table-column>
        <el-table-column prop="bookingTime" label="预约时间" width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.billingDate) }}
          </template>
        </el-table-column>
        <el-table-column prop="duration" label="时长" width="100">
          <template #default="{ row }">
            {{ calculateDuration(row.startTime, row.endTime) }}小时
          </template>
        </el-table-column>
        <el-table-column prop="amount" label="金额" width="120">
          <template #default="{ row }">
            <span class="font-semibold text-orange-500">¥{{ row.amount.toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" effect="light">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="billingDate" label="账单日期" width="150">
          <template #default="{ row }">
            {{ formatDate(row.billingDate) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click.stop="viewDetail(row)">
              查看详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="mt-4 flex justify-end">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <el-dialog
      v-model="detailDialogVisible"
      title="账单详情"
      width="500px"
    >
      <el-descriptions v-if="selectedBilling" :column="1" border>
        <el-descriptions-item label="账单ID">
          {{ selectedBilling.id }}
        </el-descriptions-item>
        <el-descriptions-item label="用户">
          {{ selectedBilling.user?.name || selectedBilling.userName }}
        </el-descriptions-item>
        <el-descriptions-item label="设备">
          {{ selectedBilling.equipmentName }}
        </el-descriptions-item>
        <el-descriptions-item label="开始时间">
          {{ formatDateTime(selectedBilling.startTime) }}
        </el-descriptions-item>
        <el-descriptions-item label="结束时间">
          {{ formatDateTime(selectedBilling.endTime) }}
        </el-descriptions-item>
        <el-descriptions-item label="时长">
          {{ calculateDuration(selectedBilling.startTime, selectedBilling.endTime) }}小时
        </el-descriptions-item>
        <el-descriptions-item label="金额">
          <span class="font-semibold text-orange-500">¥{{ selectedBilling.amount.toFixed(2) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusType(selectedBilling.status)" effect="light">
            {{ getStatusText(selectedBilling.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="账单日期">
          {{ formatDate(selectedBilling.billingDate) }}
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">
          {{ formatDateTime(selectedBilling.createdAt) }}
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="rechargeDialogVisible"
      title="经费充值"
      width="400px"
    >
      <el-form :model="rechargeForm" label-width="80px">
        <el-form-item label="充值用户">
          <el-select
            v-model="rechargeForm.userId"
            placeholder="请选择用户"
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="user in userList"
              :key="user.id"
              :label="`${user.name} (${user.username})`"
              :value="user.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="充值金额">
          <el-input-number
            v-model="rechargeForm.amount"
            :min="0"
            :precision="2"
            :step="100"
            style="width: 100%"
            placeholder="请输入充值金额"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="rechargeForm.remark"
            type="textarea"
            :rows="3"
            placeholder="请输入备注（可选）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rechargeDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleRecharge">确认充值</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Download, Plus, Wallet, Money, Document } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { billing as billingApi, user as userApi } from '@/api'
import type { Billing, BillingStatus, User } from '@/types'

const loading = ref(false)
const billingList = ref<Billing[]>([])
const userList = ref<User[]>([])
const budget = ref(0)
const monthlySpent = ref(0)
const pendingCount = ref(0)

const filters = ref({
  userId: undefined as number | undefined,
  month: undefined as string | undefined,
  status: undefined as BillingStatus | undefined
})

const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
})

const detailDialogVisible = ref(false)
const selectedBilling = ref<Billing | null>(null)

const rechargeDialogVisible = ref(false)
const rechargeForm = ref({
  userId: undefined as number | undefined,
  amount: 0,
  remark: ''
})

const getStatusType = (status: BillingStatus) => {
  const typeMap: Record<BillingStatus, 'success' | 'info' | 'warning'> = {
    paid: 'success',
    refunded: 'info',
    pending: 'warning'
  }
  return typeMap[status] || 'info'
}

const getStatusText = (status: BillingStatus) => {
  const textMap: Record<BillingStatus, string> = {
    paid: '已支付',
    refunded: '已退款',
    pending: '待支付'
  }
  return textMap[status] || status
}

const formatDateTime = (time: string) => {
  return dayjs(time).format('YYYY-MM-DD HH:mm')
}

const formatDate = (time: string) => {
  return dayjs(time).format('YYYY-MM-DD')
}

const calculateDuration = (start: string, end: string) => {
  const duration = dayjs(end).diff(dayjs(start), 'minute') / 60
  return duration.toFixed(1)
}

const loadBillings = async () => {
  loading.value = true
  try {
    const params: any = {
      ...filters.value,
      page: pagination.value.page,
      pageSize: pagination.value.pageSize
    }
    if (filters.value.month) {
      params.startDate = `${filters.value.month}-01`
      params.endDate = dayjs(filters.value.month).endOf('month').format('YYYY-MM-DD')
      delete params.month
    }
    const response = await billingApi.getList(params)
    billingList.value = response.items
    pagination.value.total = response.total
  } finally {
    loading.value = false
  }
}

const loadUsers = async () => {
  const response = await userApi.getList({ pageSize: 100 })
  userList.value = response.items
}

const loadBudget = async () => {
  try {
    const response = await billingApi.getBudget()
    budget.value = response.budget
  } catch {
  }
}

const loadStats = async () => {
  const currentMonth = dayjs().format('YYYY-MM')
  const params = {
    startDate: `${currentMonth}-01`,
    endDate: dayjs(currentMonth).endOf('month').format('YYYY-MM-DD'),
    status: 'paid' as BillingStatus
  }
  const paidResponse = await billingApi.getList({ ...params, pageSize: 1000 })
  monthlySpent.value = paidResponse.items.reduce((sum, item) => sum + item.amount, 0)

  const pendingResponse = await billingApi.getList({ status: 'pending', pageSize: 1 })
  pendingCount.value = pendingResponse.total
}

const handleSearch = () => {
  pagination.value.page = 1
  loadBillings()
}

const handleReset = () => {
  filters.value = {
    userId: undefined,
    month: undefined,
    status: undefined
  }
  pagination.value.page = 1
  loadBillings()
}

const handleSizeChange = (size: number) => {
  pagination.value.pageSize = size
  pagination.value.page = 1
  loadBillings()
}

const handleCurrentChange = (page: number) => {
  pagination.value.page = page
  loadBillings()
}

const handleRowClick = (row: Billing) => {
  viewDetail(row)
}

const viewDetail = (row: Billing) => {
  selectedBilling.value = row
  detailDialogVisible.value = true
}

const openRechargeDialog = () => {
  rechargeForm.value = {
    userId: undefined,
    amount: 0,
    remark: ''
  }
  rechargeDialogVisible.value = true
}

const handleRecharge = async () => {
  if (!rechargeForm.value.userId) {
    ElMessage.warning('请选择充值用户')
    return
  }
  if (!rechargeForm.value.amount || rechargeForm.value.amount <= 0) {
    ElMessage.warning('请输入有效的充值金额')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确定为用户充值 ¥${rechargeForm.value.amount.toFixed(2)} 吗？`,
      '确认充值',
      { type: 'warning' }
    )
    await billingApi.updateBudget({
      userId: rechargeForm.value.userId!,
      amount: rechargeForm.value.amount,
      remark: rechargeForm.value.remark
    })
    ElMessage.success('充值成功')
    rechargeDialogVisible.value = false
    loadBudget()
  } catch {
  }
}

const handleExport = async () => {
  try {
    const currentMonth = filters.value.month || dayjs().format('YYYY-MM')
    const [year, month] = currentMonth.split('-').map(Number)
    
    const blob = await billingApi.exportReport({ year, month })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `账单报表_${year}年${month}月.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    
    ElMessage.success('导出成功')
  } catch {
    ElMessage.error('导出失败，请重试')
  }
}

onMounted(() => {
  loadBillings()
  loadUsers()
  loadBudget()
  loadStats()
})
</script>
