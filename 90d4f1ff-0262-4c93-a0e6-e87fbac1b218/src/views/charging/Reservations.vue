<template>
  <div class="page-container">
    <div class="card">
      <div class="card-title">预约记录</div>
      <el-table
        v-loading="chargingStore.loading"
        :data="chargingStore.reservations.items"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="id" label="预约号" width="200" />
        <el-table-column prop="stationCode" label="充电桩" width="140" />
        <el-table-column prop="startTime" label="开始时间" width="170">
          <template #default="{ row }">{{ formatDate(row.startTime) }}</template>
        </el-table-column>
        <el-table-column prop="endTime" label="结束时间" width="170">
          <template #default="{ row }">{{ formatDate(row.endTime) }}</template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="170">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="reservationStatusTag(row.status)" size="small" effect="light">
              {{ reservationStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'Active'"
              type="danger"
              size="small"
              link
              @click="cancelReservation(row.id)"
            >取消预约</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useChargingStore } from '@/stores/charging'
import { formatDate } from '@/utils'

const chargingStore = useChargingStore()

const reservationStatusLabel = (s: string) => ({
  Active: '有效', Completed: '已完成', Cancelled: '已取消', Expired: '已超时'
}[s] || s)

const reservationStatusTag = (s: string) => ({
  Active: 'success', Completed: 'info', Cancelled: 'danger', Expired: 'warning'
}[s] || 'info') as 'success' | 'info' | 'danger' | 'warning'

const cancelReservation = async (id: string) => {
  await ElMessageBox.confirm('确认取消该预约？', '提示', { type: 'warning' })
  await chargingStore.cancelReservation(id)
  ElMessage.success('已取消')
}

onMounted(() => {
  chargingStore.fetchReservations({ pageIndex: 1, pageSize: 20 })
})
</script>
