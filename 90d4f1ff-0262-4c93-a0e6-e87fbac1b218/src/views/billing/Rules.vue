<template>
  <div class="page-container">
    <div class="card">
      <div class="flex-between mb-4">
        <div class="card-title" style="margin: 0;">计费规则管理</div>
        <el-button type="primary" :icon="Plus" @click="showCreateDialog">新建规则</el-button>
      </div>
      <el-table :data="billingStore.rules" v-loading="billingStore.loading" stripe>
        <el-table-column prop="name" label="规则名称" min-width="160" />
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.type === 'Parking' ? 'primary' : 'success'" size="small">
              {{ row.type === 'Parking' ? '停车' : '充电' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="priority" label="优先级" width="90" />
        <el-table-column label="每日封顶" width="100">
          <template #default="{ row }">
            <span v-if="row.dailyCap">¥{{ row.dailyCap }}</span>
            <span v-else class="text-muted">未设置</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-switch
              :model-value="row.isEnabled"
              @change="(v: boolean) => billingStore.toggleRule(row.id, v)"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" link>编辑</el-button>
            <el-button type="danger" size="small" link>删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { useBillingStore } from '@/stores/billing'
import { ElMessage } from 'element-plus'

const billingStore = useBillingStore()
const showCreateDialog = ref(false)

onMounted(async () => {
  try {
    await billingStore.fetchRules()
  } catch {
    billingStore.rules = [
      {
        id: '1', name: '工作日停车费率', type: 'Parking', priority: 1, isEnabled: true,
        timeSlots: [
          { startTime: '00:00', endTime: '08:00', ratePerHour: 2 },
          { startTime: '08:00', endTime: '18:00', ratePerHour: 5 },
          { startTime: '18:00', endTime: '24:00', ratePerHour: 3 }
        ],
        memberDiscounts: [{ level: 1, discountRate: 0.95 }, { level: 2, discountRate: 0.9 }, { level: 3, discountRate: 0.8 }],
        chargingTiers: [],
        dailyCap: 50
      },
      {
        id: '2', name: '阶梯充电费率', type: 'Charging', priority: 1, isEnabled: true,
        timeSlots: [
          { startTime: '00:00', endTime: '06:00', ratePerHour: 0.3 },
          { startTime: '06:00', endTime: '22:00', ratePerHour: 0.8 },
          { startTime: '22:00', endTime: '24:00', ratePerHour: 0.5 }
        ],
        memberDiscounts: [{ level: 1, discountRate: 0.98 }, { level: 2, discountRate: 0.95 }, { level: 3, discountRate: 0.9 }],
        chargingTiers: [
          { minKwh: 0, maxKwh: 30, ratePerKwh: 0.8 },
          { minKwh: 30, maxKwh: 60, ratePerKwh: 0.7 },
          { minKwh: 60, ratePerKwh: 0.6 }
        ],
        dailyCap: undefined
      }
    ]
  }
})
</script>

<style lang="scss" scoped>
.mb-4 { margin-bottom: 16px; }
.text-muted { color: #c0c4cc; }
</style>
