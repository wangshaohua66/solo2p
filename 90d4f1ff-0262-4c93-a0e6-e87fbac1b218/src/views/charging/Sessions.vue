<template>
  <div class="page-container">
    <div class="card">
      <div class="card-title">充电会话</div>
      <el-table
        v-loading="chargingStore.loading"
        :data="chargingStore.sessions.items"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="id" label="会话号" width="200" />
        <el-table-column prop="stationId" label="充电桩ID" width="160" />
        <el-table-column prop="startTime" label="开始时间" width="170">
          <template #default="{ row }">{{ formatDate(row.startTime) }}</template>
        </el-table-column>
        <el-table-column prop="endTime" label="结束时间" width="170">
          <template #default="{ row }">{{ row.endTime ? formatDate(row.endTime) : '-' }}</template>
        </el-table-column>
        <el-table-column label="充电量(kWh)" width="120">
          <template #default="{ row }">{{ row.totalKwh?.toFixed(2) || (row.endKwh ? (row.endKwh - row.startKwh).toFixed(2) : '进行中') }}</template>
        </el-table-column>
        <el-table-column label="费用" width="100">
          <template #default="{ row }">
            <span v-if="row.cost" style="color: #f56c6c; font-weight: 600;">¥{{ row.cost.toFixed(2) }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'Charging' ? 'primary' : 'success'" size="small" effect="light">
              {{ row.status === 'Charging' ? '充电中' : '已完成' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'Charging'" type="danger" size="small" link>
              结束充电
            </el-button>
            <el-button v-else type="primary" size="small" link>查看详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useChargingStore } from '@/stores/charging'
import { formatDate } from '@/utils'

const chargingStore = useChargingStore()

onMounted(() => {
  chargingStore.fetchSessions({ pageIndex: 1, pageSize: 20 })
})
</script>
