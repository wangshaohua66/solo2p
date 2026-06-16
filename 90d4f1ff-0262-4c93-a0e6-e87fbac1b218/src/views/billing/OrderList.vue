<template>
  <div class="page-container">
    <div class="card">
      <div class="card-title">订单列表</div>
      <el-table
        v-loading="billingStore.loading"
        :data="billingStore.orders.items"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="orderNo" label="订单号" width="220" />
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row.type === 'Parking' ? 'primary' : row.type === 'Charging' ? 'success' : 'warning'">
              {{ { Parking: '停车', Charging: '充电', Reservation: '预约' }[row.type] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="relatedId" label="关联单" width="180" />
        <el-table-column label="金额" width="120">
          <template #default="{ row }">
            <span style="color: #f56c6c; font-weight: 600;">¥{{ row.amount.toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="orderStatusTag(row.status)" effect="light" size="small">
              {{ orderStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="支付方式" width="100">
          <template #default="{ row }">
            {{ row.paymentMethod ? { WeChat: '微信', Alipay: '支付宝', Balance: '余额' }[row.paymentMethod] : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="paidAt" label="支付时间" width="170">
          <template #default="{ row }">{{ row.paidAt ? formatDate(row.paidAt) : '-' }}</template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="170">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'Pending'"
              type="primary"
              size="small"
              link
            >去支付</el-button>
            <el-button
              v-if="row.status === 'Paid'"
              type="success"
              size="small"
              link
            >开发票</el-button>
            <el-button
              v-if="row.status === 'Paid'"
              type="danger"
              size="small"
              link
            >申请退款</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useBillingStore } from '@/stores/billing'
import { formatDate } from '@/utils'
import type { OrderStatus } from '@/types'

const billingStore = useBillingStore()

const orderStatusLabel = (s: OrderStatus) => ({
  Pending: '待支付', Paid: '已支付', Refunding: '退款中', Refunded: '已退款', Cancelled: '已取消'
}[s])

const orderStatusTag = (s: OrderStatus) => ({
  Pending: 'warning', Paid: 'success', Refunding: 'primary', Refunded: 'info', Cancelled: 'danger'
}[s]) as 'warning' | 'success' | 'primary' | 'info' | 'danger'

onMounted(() => {
  billingStore.fetchOrders({ pageIndex: 1, pageSize: 20 })
})
</script>
