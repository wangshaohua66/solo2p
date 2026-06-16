<template>
  <div class="page-container">
    <div class="card">
      <div class="card-title">工单管理</div>
      <el-table
        v-loading="adminStore.loading"
        :data="adminStore.workOrders.items"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="orderNo" label="工单号" width="200" />
        <el-table-column label="类型" width="120">
          <template #default="{ row }">
            <el-tag size="small" :type="row.type === 'IllegalParking' ? 'danger' : row.type === 'Fault' ? 'warning' : 'info'">
              {{ { IllegalParking: '违停举报', Fault: '设备故障', Other: '其他' }[row.type] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip />
        <el-table-column prop="plateNumber" label="车牌号" width="120" />
        <el-table-column prop="location" label="位置" min-width="140" show-overflow-tooltip />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="workOrderStatusTag(row.status)" effect="light" size="small">
              {{ workOrderStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="170">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" link>查看</el-button>
            <el-button
              v-if="row.status === 'Pending'"
              type="success"
              size="small"
              link
            >派单</el-button>
            <el-button
              v-if="row.status !== 'Closed'"
              type="warning"
              size="small"
              link
            >处理</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAdminStore } from '@/stores/admin'
import { formatDate } from '@/utils'
import type { WorkOrderStatus } from '@/types'

const adminStore = useAdminStore()

const workOrderStatusLabel = (s: WorkOrderStatus) => ({
  Pending: '待处理', Assigned: '已派单', Processing: '处理中', Closed: '已结案'
}[s])

const workOrderStatusTag = (s: WorkOrderStatus) => ({
  Pending: 'warning', Assigned: 'primary', Processing: 'success', Closed: 'info'
}[s]) as 'warning' | 'primary' | 'success' | 'info'

onMounted(() => {
  adminStore.fetchWorkOrders({ pageIndex: 1, pageSize: 20 })
})
</script>
