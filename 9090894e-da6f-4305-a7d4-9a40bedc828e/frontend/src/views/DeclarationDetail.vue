<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import StatusTag from '@/components/StatusTag.vue'
import type { Declaration } from '@/types'
import dayjs from 'dayjs'

const route = useRoute()
const declaration = ref<Declaration | null>(null)

onMounted(() => {
  declaration.value = {
    id: route.params.id as string,
    declareNo: 'CB202406150001',
    title: '6月亚马逊美国站电子产品出口申报',
    enterpriseName: '杭州跨境贸易有限公司',
    platform: 'amazon',
    status: 'customs_passed',
    declareType: 'normal',
    items: [
      { id: 'i1', productName: '蓝牙耳机', hsCode: '85171210', specification: 'TWS无线 黑色', quantity: 500, unit: '件', unitPrice: 25, currency: 'USD', totalAmount: 12500, country: 'US', declareElements: {} },
      { id: 'i2', productName: '智能手表', hsCode: '85176290', specification: '心率监测 GPS', quantity: 200, unit: '件', unitPrice: 80, currency: 'USD', totalAmount: 16000, country: 'US', declareElements: {} }
    ],
    attachments: [],
    totalAmount: 28500,
    taxRefundAmount: 3705,
    statusHistory: [
      { status: 'draft', time: '2024-06-15 09:00:00', operator: '张申报员' },
      { status: 'submitted', time: '2024-06-15 10:00:00', operator: '张申报员' },
      { status: 'approved', time: '2024-06-15 11:00:00', operator: '李审核员' },
      { status: 'customs_passed', time: '2024-06-15 16:30:00', operator: '系统' }
    ],
    remark: '',
    submitter: '张申报员',
    reviewer: '李审核员',
    createdAt: '2024-06-15 09:00:00',
    updatedAt: '2024-06-15 16:30:00'
  }
})
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-title">申报单详情</div>
    </div>
    <div class="card" v-if="declaration">
      <el-descriptions :column="2" border title="基本信息">
        <el-descriptions-item label="申报单号">{{ declaration.declareNo }}</el-descriptions-item>
        <el-descriptions-item label="状态"><StatusTag :status="declaration.status" /></el-descriptions-item>
        <el-descriptions-item label="标题" :span="2">{{ declaration.title }}</el-descriptions-item>
        <el-descriptions-item label="企业名称">{{ declaration.enterpriseName }}</el-descriptions-item>
        <el-descriptions-item label="申报人">{{ declaration.submitter }}</el-descriptions-item>
        <el-descriptions-item label="总金额">${{ declaration.totalAmount.toLocaleString() }}</el-descriptions-item>
        <el-descriptions-item label="退税金额">¥{{ declaration.taxRefundAmount.toLocaleString() }}</el-descriptions-item>
      </el-descriptions>

      <h3 style="margin-top: 24px; margin-bottom: 12px">商品明细</h3>
      <el-table :data="declaration.items" border>
        <el-table-column prop="productName" label="商品名称" />
        <el-table-column prop="hsCode" label="HS编码" width="120" />
        <el-table-column prop="quantity" label="数量" width="80" />
        <el-table-column prop="unit" label="单位" width="60" />
        <el-table-column label="单价" width="100">
          <template #default="{ row }">${{ row.unitPrice }}</template>
        </el-table-column>
        <el-table-column label="总价" width="120">
          <template #default="{ row }">${{ row.totalAmount.toLocaleString() }}</template>
        </el-table-column>
        <el-table-column prop="country" label="目的国" width="80" />
      </el-table>

      <h3 style="margin-top: 24px; margin-bottom: 12px">状态流转</h3>
      <el-timeline>
        <el-timeline-item
          v-for="(h, idx) in declaration.statusHistory"
          :key="idx"
          :timestamp="h.time"
          :type="idx === declaration.statusHistory.length - 1 ? 'primary' : 'info'"
        >
          <div style="display: flex; align-items: center; gap: 8px">
            <StatusTag :status="h.status" size="small" />
            <span>操作人：{{ h.operator }}</span>
          </div>
        </el-timeline-item>
      </el-timeline>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.page-container {
  padding: 20px;
  height: 100%;
  overflow: auto;
}

.page-header {
  margin-bottom: 16px;

  .page-title {
    font-size: $font-size-xl;
    font-weight: 600;
  }
}
</style>
