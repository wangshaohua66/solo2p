<template>
  <div class="settlement-report">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>结算报表</span>
          <el-button
            type="primary"
            :icon="Download"
            :loading="exporting"
            :disabled="!selectedBookingId"
            @click="handleExportPDF"
          >
            导出PDF
          </el-button>
        </div>
      </template>

      <el-form :inline="true" class="select-form">
        <el-form-item label="选择演出">
          <el-select
            v-model="selectedBookingId"
            placeholder="请选择演出项目"
            style="width: 320px"
            filterable
            @change="fetchSettlement"
          >
            <el-option
              v-for="booking in bookingOptions"
              :key="booking.ID"
              :label="booking.Title"
              :value="booking.ID"
            />
          </el-select>
        </el-form-item>
      </el-form>

      <div v-loading="loading" v-if="settlement" class="report-content">
        <el-alert
          :title="`总偏差率: ${formatPercent(settlement.totalDeviation)}`"
          :type="settlement.totalDeviation > 0 ? 'error' : 'success'"
          show-icon
          :closable="false"
          style="margin-bottom: 20px"
        />

        <el-descriptions :column="2" border class="summary-desc">
          <el-descriptions-item label="演出项目">
            {{ getBookingTitle(settlement.budget.BookingID) }}
          </el-descriptions-item>
          <el-descriptions-item label="总预算">
            <span class="amount">¥{{ formatAmount(settlement.budget.TotalBudget) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="实际总支出">
            <span class="amount-spent">¥{{ formatAmount(settlement.budget.TotalSpent) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="差额">
            <span :class="settlement.budget.TotalBudget - settlement.budget.TotalSpent >= 0 ? 'amount-remain' : 'amount-spent'">
              ¥{{ formatAmount(Math.abs(settlement.budget.TotalBudget - settlement.budget.TotalSpent)) }}
              {{ settlement.budget.TotalBudget - settlement.budget.TotalSpent >= 0 ? '(结余)' : '(超支)' }}
            </span>
          </el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left">各类别对比</el-divider>

        <v-chart class="bar-chart" :option="barChartOption" autoresize />

        <el-divider content-position="left">预算明细</el-divider>

        <el-table :data="settlement.categoryDetails" stripe border>
          <el-table-column label="类别" width="120">
            <template #default="{ row }">
              <el-tag>{{ categoryText(row.category) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="预算金额" width="160">
            <template #default="{ row }">
              <span class="amount">¥{{ formatAmount(row.budget) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="实际支出" width="160">
            <template #default="{ row }">
              <span class="amount-spent">¥{{ formatAmount(row.spent) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="偏差" width="140">
            <template #default="{ row }">
              <span :class="row.deviation >= 0 ? 'amount-spent' : 'amount-remain'">
                {{ row.deviation >= 0 ? '+' : '' }}¥{{ formatAmount(Math.abs(row.deviation)) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="偏差率" width="140">
            <template #default="{ row }">
              <el-tag
                :type="row.deviation > 0 ? 'danger' : row.deviation < 0 ? 'success' : 'info'"
                effect="light"
              >
                {{ formatPercent(row.deviation) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="进度">
            <template #default="{ row }">
              <el-progress
                :percentage="getProgressPercent(row)"
                :status="row.deviation > 0 ? 'exception' : undefined"
              />
            </template>
          </el-table-column>
        </el-table>

        <el-divider content-position="left">支出明细</el-divider>

        <el-table :data="settlement.expenses" stripe border>
          <el-table-column prop="ID" label="ID" width="80" />
          <el-table-column label="类别" width="100">
            <template #default="{ row }">
              <el-tag>{{ categoryText(row.Category) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="金额" width="140">
            <template #default="{ row }">
              <span class="amount-spent">¥{{ formatAmount(row.Amount) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="Description" label="说明" min-width="200" show-overflow-tooltip />
          <el-table-column label="创建时间" width="170">
            <template #default="{ row }">
              {{ formatDateTime(row.CreatedAt) }}
            </template>
          </el-table-column>
        </el-table>
      </div>

      <el-empty v-else-if="!loading && !selectedBookingId" description="请选择演出项目查看结算报表" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { BarChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import dayjs from 'dayjs'
import { useBookingStore } from '@/stores/booking'
import { generateSettlement, getSettlementPDF } from '@/api/finance'
import type { Settlement, BudgetCategory } from '@/types'

use([BarChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer])

const bookingStore = useBookingStore()

const loading = ref(false)
const exporting = ref(false)
const selectedBookingId = ref<number | undefined>(undefined)
const settlement = ref<Settlement | null>(null)

const bookingOptions = computed(() => bookingStore.bookings)

const formatAmount = (val: number) => {
  if (!val) return '0.00'
  return val.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const formatPercent = (val: number) => {
  return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`
}

const formatDateTime = (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss')

const categoryText = (category: BudgetCategory) => {
  const map: Record<BudgetCategory, string> = {
    stage: '舞美',
    staff: '人力',
    marketing: '营销',
    venue: '场地'
  }
  return map[category] || category
}

const getBookingTitle = (bookingId: number) => {
  const booking = bookingStore.bookings.find(b => b.ID === bookingId)
  return booking?.Title || `档期#${bookingId}`
}

const getProgressPercent = (row: { budget: number; spent: number }) => {
  if (!row.budget) return 0
  return Math.min(Math.round((row.spent / row.budget) * 100), 100)
}

const barChartOption = computed(() => {
  if (!settlement.value) return {}
  const categories = settlement.value.categoryDetails.map(c => categoryText(c.category))
  const budgets = settlement.value.categoryDetails.map(c => c.budget)
  const spents = settlement.value.categoryDetails.map(c => c.spent)
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        let result = `${params[0].name}<br/>`
        params.forEach((p: any) => {
          result += `${p.marker}${p.seriesName}: ¥${formatAmount(p.value)}<br/>`
        })
        return result
      }
    },
    legend: {
      data: ['预算金额', '实际支出'],
      top: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: categories
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => `¥${(value / 1000).toFixed(0)}k`
      }
    },
    series: [
      {
        name: '预算金额',
        type: 'bar',
        data: budgets,
        itemStyle: { color: '#409EFF' },
        barWidth: '35%'
      },
      {
        name: '实际支出',
        type: 'bar',
        data: spents,
        itemStyle: { color: '#67C23A' },
        barWidth: '35%'
      }
    ]
  }
})

const fetchData = async () => {
  try {
    await bookingStore.fetchBookings()
  } catch (e) {
    ElMessage.error('加载数据失败')
  }
}

const fetchSettlement = async () => {
  if (!selectedBookingId.value) return
  loading.value = true
  try {
    const mockBudget = {
      ID: selectedBookingId.value,
      BookingID: selectedBookingId.value,
      StageBudget: 50000,
      StaffBudget: 30000,
      MarketingBudget: 20000,
      VenueBudget: 40000,
      TotalBudget: 140000,
      TotalSpent: 148500,
      Status: 'warning' as const
    }
    settlement.value = {
      budget: mockBudget,
      expenses: [
        { ID: 1, BudgetID: mockBudget.ID, Category: 'stage', Amount: 52000, Description: '舞台搭建材料费', SubmittedBy: 1, CreatedAt: '2026-06-01 10:00:00' },
        { ID: 2, BudgetID: mockBudget.ID, Category: 'staff', Amount: 32000, Description: '演员劳务费', SubmittedBy: 1, CreatedAt: '2026-06-03 14:00:00' },
        { ID: 3, BudgetID: mockBudget.ID, Category: 'marketing', Amount: 18000, Description: '海报及宣传印刷', SubmittedBy: 1, CreatedAt: '2026-06-05 09:00:00' },
        { ID: 4, BudgetID: mockBudget.ID, Category: 'venue', Amount: 40000, Description: '场地租赁费用', SubmittedBy: 1, CreatedAt: '2026-06-08 11:00:00' },
        { ID: 5, BudgetID: mockBudget.ID, Category: 'stage', Amount: 6500, Description: '灯光设备额外租赁费', SubmittedBy: 1, CreatedAt: '2026-06-10 15:00:00' }
      ],
      categoryDetails: [
        { category: 'stage', budget: 50000, spent: 58500, deviation: 8500 },
        { category: 'staff', budget: 30000, spent: 32000, deviation: 2000 },
        { category: 'marketing', budget: 20000, spent: 18000, deviation: -2000 },
        { category: 'venue', budget: 40000, spent: 40000, deviation: 0 }
      ],
      totalDeviation: 6.07
    }
  } catch (e) {
    ElMessage.error('加载结算数据失败')
  } finally {
    loading.value = false
  }
}

const handleExportPDF = async () => {
  if (!selectedBookingId.value) return
  exporting.value = true
  try {
    const blob = await getSettlementPDF(selectedBookingId.value)
    const url = window.URL.createObjectURL(new Blob([blob]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `结算报表_${getBookingTitle(selectedBookingId.value)}_${dayjs().format('YYYYMMDD')}.pdf`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (e) {
    ElMessage.error('导出失败')
  } finally {
    exporting.value = false
  }
}

onMounted(fetchData)
</script>

<style scoped lang="scss">
.settlement-report {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .select-form {
    margin-bottom: 20px;
  }

  .report-content {
    .amount {
      color: #303133;
      font-weight: 600;
    }

    .amount-spent {
      color: #f56c6c;
      font-weight: 600;
    }

    .amount-remain {
      color: #67c23a;
      font-weight: 600;
    }

    .summary-desc {
      margin-bottom: 16px;
    }

    .bar-chart {
      height: 320px;
      margin-bottom: 16px;
    }
  }
}
</style>
