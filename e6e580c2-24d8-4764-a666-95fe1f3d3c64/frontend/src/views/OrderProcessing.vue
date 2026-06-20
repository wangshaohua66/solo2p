<template>
  <div class="page-container">
    <el-row :gutter="12" class="stat-row">
      <el-col :xs="12" :sm="8" :md="4" v-for="card in statusCards" :key="card.status">
        <div
          class="stat-card status-card-item"
          :class="{ active: queryParams.status === card.status }"
          :style="{ background: card.bg }"
          @click="filterByStatus(card.status)"
        >
          <div>
            <div class="stat-value">{{ card.count }}</div>
            <div class="stat-label">{{ card.label }}</div>
          </div>
          <el-icon class="stat-icon">
            <component :is="card.icon" />
          </el-icon>
        </div>
      </el-col>
    </el-row>

    <div class="card-box">
      <el-form :inline="true" :model="queryParams" class="search-form">
        <el-form-item label="订单号">
          <el-input
            v-model="queryParams.orderNo"
            placeholder="请输入订单号"
            clearable
            style="width: 180px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="用户ID">
          <el-input
            v-model="queryParams.userId"
            placeholder="请输入用户ID"
            clearable
            style="width: 150px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="小区">
          <el-select
            v-model="queryParams.communityId"
            placeholder="请选择小区"
            clearable
            filterable
            style="width: 180px"
          >
            <el-option
              v-for="item in communityList"
              :key="item.id"
              :label="item.name"
              :value="item.id!"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="订单状态">
          <el-select
            v-model="queryParams.status"
            placeholder="请选择状态"
            clearable
            style="width: 150px"
          >
            <el-option
              v-for="item in statusOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="创建时间">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 260px"
            @change="handleDateChange"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
          <el-button :icon="Refresh" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="card-box">
      <div class="table-toolbar">
        <div class="batch-bar">
          <el-button
            type="primary"
            :icon="Van"
            :disabled="selectionRows.length === 0"
            @click="handleBatchDelivery"
          >
            批量确认配送
          </el-button>
          <span v-if="selectionRows.length > 0" class="batch-tip">
            已选择 {{ selectionRows.length }} 项
          </span>
        </div>
      </div>

      <el-table
        :data="tableData"
        border
        stripe
        v-loading="loading"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="50" />
        <el-table-column prop="orderNo" label="订单号" width="180" show-overflow-tooltip />
        <el-table-column prop="userId" label="用户ID" width="90" />
        <el-table-column prop="communityName" label="小区" width="120" show-overflow-tooltip />
        <el-table-column label="订单金额" width="110" align="right">
          <template #default="{ row }">
            ¥{{ formatMoney(row.totalAmount) }}
          </template>
        </el-table-column>
        <el-table-column label="支付金额" width="110" align="right">
          <template #default="{ row }">
            <span class="pay-amount">¥{{ formatMoney(row.payAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="订单状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" effect="light">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="支付状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag
              :type="row.payStatus === 1 ? 'success' : 'info'"
              size="small"
              effect="plain"
            >
              {{ row.payStatus === 1 ? '已支付' : '未支付' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="配送状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag
              :type="getDeliveryStatusType(row.deliveryStatus)"
              size="small"
              effect="plain"
            >
              {{ getDeliveryStatusLabel(row.deliveryStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="pickupCode" label="取货码" width="100" align="center">
          <template #default="{ row }">
            <span v-if="row.pickupCode" class="pickup-code">{{ row.pickupCode }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="160" />
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" :icon="View" @click="handleDetail(row)">
              详情
            </el-button>
            <el-button
              v-if="row.status === 0"
              link
              type="success"
              :icon="Money"
              @click="handlePay(row)"
            >
              支付
            </el-button>
            <el-button
              v-if="row.status === 0 || row.status === 1"
              link
              type="warning"
              :icon="Close"
              @click="handleCancel(row)"
            >
              取消
            </el-button>
            <el-button
              v-if="row.payStatus === 1 && row.status !== 5"
              link
              type="danger"
              :icon="RefreshLeft"
              @click="handleRefund(row)"
            >
              退款
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="queryParams.pageNum"
          v-model:page-size="queryParams.pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @size-change="loadData"
          @current-change="loadData"
        />
      </div>
    </div>

    <el-dialog v-model="detailVisible" title="订单详情" width="820px" destroy-on-close>
      <el-descriptions v-if="orderDetail" :column="3" border>
        <el-descriptions-item label="订单号">{{ orderDetail.orderNo }}</el-descriptions-item>
        <el-descriptions-item label="用户ID">{{ orderDetail.userId }}</el-descriptions-item>
        <el-descriptions-item label="小区">{{ orderDetail.communityName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="订单金额">¥{{ formatMoney(orderDetail.totalAmount) }}</el-descriptions-item>
        <el-descriptions-item label="优惠金额">¥{{ formatMoney(orderDetail.discountAmount) }}</el-descriptions-item>
        <el-descriptions-item label="支付金额">¥{{ formatMoney(orderDetail.payAmount) }}</el-descriptions-item>
        <el-descriptions-item label="订单状态">
          <el-tag :type="getStatusType(orderDetail.status)" size="small">
            {{ getStatusLabel(orderDetail.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="支付状态">
          {{ orderDetail.payStatus === 1 ? '已支付' : '未支付' }}
        </el-descriptions-item>
        <el-descriptions-item label="取货码">{{ orderDetail.pickupCode || '-' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ orderDetail.createTime || '-' }}</el-descriptions-item>
        <el-descriptions-item label="支付时间">{{ orderDetail.payTime || '-' }}</el-descriptions-item>
        <el-descriptions-item label="备注">{{ orderDetail.remark || '-' }}</el-descriptions-item>
      </el-descriptions>
      <el-alert
        v-if="orderDetail && orderDetail.cancelReason"
        :title="'取消原因：' + orderDetail.cancelReason"
        type="warning"
        :closable="false"
        show-icon
        style="margin-top: 12px"
      />
      <el-divider content-position="left">订单明细</el-divider>
      <el-table :data="orderItems" border size="small">
        <el-table-column label="商品图片" width="80" align="center">
          <template #default="{ row }">
            <el-image
              v-if="row.productImage"
              :src="row.productImage"
              fit="cover"
              style="width: 50px; height: 50px; border-radius: 4px"
              :preview-src-list="[row.productImage]"
              preview-teleported
            />
            <span v-else class="no-image">无图</span>
          </template>
        </el-table-column>
        <el-table-column prop="productName" label="商品名称" show-overflow-tooltip />
        <el-table-column label="单价" width="110" align="right">
          <template #default="{ row }">¥{{ formatMoney(row.price) }}</template>
        </el-table-column>
        <el-table-column prop="quantity" label="数量" width="90" align="center" />
        <el-table-column label="小计" width="120" align="right">
          <template #default="{ row }">
            <span class="pay-amount">¥{{ formatMoney(row.totalPrice) }}</span>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="reasonVisible" :title="reasonTitle" width="460px" destroy-on-close>
      <el-form>
        <el-form-item label="原因">
          <el-input
            v-model="reasonText"
            type="textarea"
            :rows="4"
            :placeholder="reasonPlaceholder"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reasonVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="confirmReason">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Search,
  Refresh,
  View,
  Money,
  Close,
  RefreshLeft,
  Van
} from '@element-plus/icons-vue'
import { orderApi } from '@/api/order'
import { communityApi } from '@/api/community'
import type { Order, OrderItem, Community } from '@/types'

const statusOptions = [
  { value: 0, label: '待付款' },
  { value: 1, label: '待配送' },
  { value: 2, label: '配送中' },
  { value: 3, label: '待自提' },
  { value: 4, label: '已完成' },
  { value: 5, label: '已取消' }
]

const statusCards = ref([
  { status: 0, label: '待付款', count: 0, icon: 'Clock', bg: 'linear-gradient(135deg, #f6d365, #fda085)' },
  { status: 1, label: '待配送', count: 0, icon: 'Box', bg: 'linear-gradient(135deg, #84fab0, #8fd3f4)' },
  { status: 2, label: '配送中', count: 0, icon: 'Van', bg: 'linear-gradient(135deg, #409eff, #5e72e4)' },
  { status: 3, label: '待自提', count: 0, icon: 'Goods', bg: 'linear-gradient(135deg, #43e97b, #38f9d7)' },
  { status: 4, label: '已完成', count: 0, icon: 'CircleCheck', bg: 'linear-gradient(135deg, #67c23a, #4caf50)' },
  { status: 5, label: '已取消', count: 0, icon: 'CircleClose', bg: 'linear-gradient(135deg, #f5576c, #f093fb)' }
])

const communityList = ref<Community[]>([])
const tableData = ref<Order[]>([])
const total = ref(0)
const loading = ref(false)
const selectionRows = ref<Order[]>([])

const dateRange = ref<[string, string] | null>(null)

const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  orderNo: '',
  userId: undefined as number | undefined,
  communityId: undefined as number | undefined,
  status: undefined as number | undefined,
  startDate: '',
  endDate: ''
})

const detailVisible = ref(false)
const orderDetail = ref<Order | null>(null)
const orderItems = ref<OrderItem[]>([])

const reasonVisible = ref(false)
const reasonTitle = ref('')
const reasonText = ref('')
const reasonPlaceholder = ref('')
const submitting = ref(false)
const reasonAction = ref<'cancel' | 'refund'>('cancel')
const currentOrderId = ref<number>()

const getStatusType = (status: number) => {
  const map: Record<number, string> = {
    0: 'warning',
    1: 'info',
    2: 'primary',
    3: 'success',
    4: 'success',
    5: 'danger'
  }
  return map[status] ?? 'info'
}

const getStatusLabel = (status: number) => {
  return statusOptions.find(item => item.value === status)?.label ?? '未知'
}

const getDeliveryStatusType = (status: number) => {
  const map: Record<number, string> = {
    0: 'info',
    1: 'primary',
    2: 'success',
    3: 'danger',
    4: 'success'
  }
  return map[status] ?? 'info'
}

const getDeliveryStatusLabel = (status: number) => {
  const map: Record<number, string> = {
    0: '待配送',
    1: '配送中',
    2: '已送达',
    3: '已取消',
    4: '已完成'
  }
  return map[status] ?? '未知'
}

const formatMoney = (val: number | string | undefined) => {
  if (val === undefined || val === null || val === '') return '0.00'
  const num = Number(val)
  return isNaN(num) ? '0.00' : num.toFixed(2)
}

const handleDateChange = (val: [string, string] | null) => {
  if (val) {
    queryParams.startDate = val[0]
    queryParams.endDate = val[1]
  } else {
    queryParams.startDate = ''
    queryParams.endDate = ''
  }
}

const loadCommunityList = async () => {
  try {
    const res: any = await communityApi.getList()
    communityList.value = res.data || []
  } catch (e) {
    console.error(e)
  }
}

const loadData = async () => {
  loading.value = true
  try {
    const params: any = {
      pageNum: queryParams.pageNum,
      pageSize: queryParams.pageSize
    }
    if (queryParams.orderNo) params.orderNo = queryParams.orderNo
    if (queryParams.userId) params.userId = queryParams.userId
    if (queryParams.communityId) params.communityId = queryParams.communityId
    if (queryParams.status !== undefined && queryParams.status !== null) {
      params.status = queryParams.status
    }
    if (queryParams.startDate) params.startDate = queryParams.startDate
    if (queryParams.endDate) params.endDate = queryParams.endDate

    const res: any = await orderApi.getPage(params)
    tableData.value = res.data.records || []
    total.value = res.data.total || 0
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

const loadStatusStatistics = async () => {
  try {
    const results = await Promise.all(
      statusOptions.map(opt =>
        orderApi.getPage({ pageNum: 1, pageSize: 1, status: opt.value })
      )
    )
    results.forEach((res: any, index: number) => {
      statusCards.value[index].count = res.data.total || 0
    })
  } catch (e) {
    console.error(e)
  }
}

const filterByStatus = (status: number) => {
  queryParams.status = queryParams.status === status ? undefined : status
  queryParams.pageNum = 1
  loadData()
}

const handleSearch = () => {
  queryParams.pageNum = 1
  loadData()
}

const handleReset = () => {
  queryParams.orderNo = ''
  queryParams.userId = undefined
  queryParams.communityId = undefined
  queryParams.status = undefined
  queryParams.startDate = ''
  queryParams.endDate = ''
  dateRange.value = null
  queryParams.pageNum = 1
  loadData()
}

const handleSelectionChange = (rows: Order[]) => {
  selectionRows.value = rows
}

const refreshAll = () => {
  loadData()
  loadStatusStatistics()
}

const handleDetail = async (row: Order) => {
  try {
    const res: any = await orderApi.getDetail(row.id!)
    orderDetail.value = res.data.order
    orderItems.value = res.data.items || []
    detailVisible.value = true
  } catch (e) {
    console.error(e)
  }
}

const handlePay = (row: Order) => {
  ElMessageBox.confirm(
    `确认对订单「${row.orderNo}」进行模拟支付吗？支付金额 ¥${formatMoney(row.payAmount)}`,
    '支付确认',
    { confirmButtonText: '确认支付', cancelButtonText: '取消', type: 'warning' }
  ).then(async () => {
    try {
      await orderApi.pay(row.id!)
      ElMessage.success('支付成功')
      refreshAll()
    } catch (e) {
      console.error(e)
    }
  }).catch(() => {})
}

const handleCancel = (row: Order) => {
  reasonAction.value = 'cancel'
  currentOrderId.value = row.id
  reasonTitle.value = '取消订单'
  reasonPlaceholder.value = '请输入取消原因（选填）'
  reasonText.value = ''
  reasonVisible.value = true
}

const handleRefund = (row: Order) => {
  reasonAction.value = 'refund'
  currentOrderId.value = row.id
  reasonTitle.value = '申请退款'
  reasonPlaceholder.value = '请输入退款原因'
  reasonText.value = ''
  reasonVisible.value = true
}

const confirmReason = async () => {
  if (reasonAction.value === 'refund' && !reasonText.value.trim()) {
    ElMessage.warning('请输入退款原因')
    return
  }
  submitting.value = true
  try {
    if (reasonAction.value === 'cancel') {
      await orderApi.cancel(currentOrderId.value!, reasonText.value)
      ElMessage.success('订单已取消')
    } else {
      await orderApi.refund(currentOrderId.value!, reasonText.value)
      ElMessage.success('退款申请已提交')
    }
    reasonVisible.value = false
    refreshAll()
  } catch (e) {
    console.error(e)
  } finally {
    submitting.value = false
  }
}

const handleBatchDelivery = () => {
  const validRows = selectionRows.value.filter(
    row => row.status === 1 && row.deliveryStatus === 0
  )
  if (validRows.length === 0) {
    ElMessage.warning('请选择待配送状态的订单')
    return
  }
  const invalidCount = selectionRows.value.length - validRows.length
  ElMessageBox.confirm(
    `确认对选中的 ${validRows.length} 笔订单确认配送？` +
      (invalidCount > 0 ? `（其中 ${invalidCount} 笔非待配送状态已自动过滤）` : ''),
    '批量确认配送',
    { confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning' }
  ).then(async () => {
    try {
      await Promise.all(
        validRows.map(row => orderApi.updateDeliveryStatus(row.id!, 1))
      )
      ElMessage.success(`已确认配送 ${validRows.length} 笔订单`)
      refreshAll()
    } catch (e) {
      console.error(e)
    }
  }).catch(() => {})
}

onMounted(() => {
  loadCommunityList()
  loadData()
  loadStatusStatistics()
})
</script>

<style scoped>
.stat-row {
  margin-bottom: 16px;
}

.status-card-item {
  cursor: pointer;
  transition: all 0.3s;
}

.status-card-item:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px 0 rgba(0, 0, 0, 0.15);
}

.status-card-item.active {
  outline: 3px solid #fff;
  box-shadow: 0 0 0 3px var(--primary-color);
}

.search-form {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
}

.table-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.batch-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.batch-tip {
  color: var(--text-secondary);
  font-size: 13px;
}

.pay-amount {
  color: var(--danger-color);
  font-weight: 600;
}

.pickup-code {
  font-family: 'Courier New', monospace;
  font-weight: 700;
  color: var(--warning-color);
}

.no-image {
  color: var(--text-secondary);
  font-size: 12px;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

:deep(.el-table) {
  border-radius: 4px;
}

:deep(.el-dialog__body) {
  padding-top: 16px;
}
</style>
