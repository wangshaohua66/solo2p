<template>
  <div class="page-container">
    <div class="card">
      <div class="card-title">停车记录</div>
      <el-table
        v-loading="parkingStore.loading"
        :data="parkingStore.currentRecords.items"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="plateNumber" label="车牌号" width="120" />
        <el-table-column prop="spotCode" label="车位号" width="120" />
        <el-table-column prop="entryTime" label="入场时间" width="170">
          <template #default="{ row }">{{ formatDate(row.entryTime) }}</template>
        </el-table-column>
        <el-table-column prop="exitTime" label="出场时间" width="170">
          <template #default="{ row }">{{ row.exitTime ? formatDate(row.exitTime) : '-' }}</template>
        </el-table-column>
        <el-table-column prop="duration" label="停车时长" width="120">
          <template #default="{ row }">{{ row.duration ? formatDuration(row.duration) : '进行中' }}</template>
        </el-table-column>
        <el-table-column label="费用" width="100">
          <template #default="{ row }">
            <span v-if="row.parkingFee" style="color: #f56c6c; font-weight: 600;">
              ¥{{ row.parkingFee.toFixed(2) }}
            </span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'InProgress' ? 'warning' : 'success'" size="small" effect="light">
              {{ row.status === 'InProgress' ? '进行中' : '已完成' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'InProgress'" type="primary" size="small" link>
              车辆出场
            </el-button>
            <el-button v-else type="success" size="small" link>查看发票</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        class="mt-4"
        layout="total, sizes, prev, pager, next, jumper"
        :total="parkingStore.currentRecords.totalCount"
        :page-sizes="[10, 20, 50, 100]"
        v-model:current-page="parkingStore.currentRecords.pageIndex"
        v-model:page-size="parkingStore.currentRecords.pageSize"
        @current-change="fetchData"
        @size-change="fetchData"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useParkingStore } from '@/stores/parking'
import { formatDate, formatDuration } from '@/utils'

const parkingStore = useParkingStore()

const fetchData = () => {
  parkingStore.fetchRecords({
    pageIndex: parkingStore.currentRecords.pageIndex,
    pageSize: parkingStore.currentRecords.pageSize
  })
}

onMounted(fetchData)
</script>

<style lang="scss" scoped>
.mt-4 { margin-top: 16px; text-align: right; }
</style>
