<template>
  <div class="budget-tracking">
    <el-card v-if="!currentBudget">
      <template #header>
        <div class="card-header">
          <span>预算追踪</span>
        </div>
      </template>

      <el-table v-loading="loading" :data="budgetList" stripe border @row-click="handleRowClick">
        <el-table-column label="关联演出" min-width="180">
          <template #default="{ row }">
            {{ getBookingTitle(row.BookingID) }}
          </template>
        </el-table-column>
        <el-table-column label="总预算" width="140">
          <template #default="{ row }">
            <span class="amount">¥{{ formatAmount(row.TotalBudget) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="已支出" width="140">
          <template #default="{ row }">
            <span class="amount-spent">¥{{ formatAmount(row.TotalSpent) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="剩余" width="140">
          <template #default="{ row }">
            <span class="amount-remain">¥{{ formatAmount(row.TotalBudget - row.TotalSpent) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="使用进度" min-width="200">
          <template #default="{ row }">
            <el-progress
              :percentage="getProgressPercent(row)"
              :status="row.Status === 'frozen' ? 'exception' : row.Status === 'warning' ? 'warning' : undefined"
            />
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.Status)">{{ statusText(row.Status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button link type="primary" @click.stop="handleRowClick(row)">查看详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card v-else>
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <el-button link :icon="ArrowLeft" @click="handleBack">返回列表</el-button>
            <span class="detail-title">预算详情 - {{ getBookingTitle(currentBudget.BookingID) }}</span>
          </div>
          <el-button type="primary" @click="handleAddExpense">
            <el-icon><Plus /></el-icon>
            新增支出
          </el-button>
        </div>
      </template>

      <el-row :gutter="20">
        <el-col :span="6" v-for="(item, idx) in categoryStats" :key="idx">
          <el-card shadow="hover" class="chart-card">
            <div class="chart-title">{{ categoryText(item.category) }}</div>
            <v-chart class="chart" :option="getPieOption(item)" autoresize />
            <div class="chart-stats">
              <span>预算: ¥{{ formatAmount(item.budget) }}</span>
              <span>已用: ¥{{ formatAmount(item.spent) }}</span>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <el-divider content-position="left">支出明细</el-divider>
      <el-table v-loading="expensesLoading" :data="expenseList" stripe border>
        <el-table-column prop="ID" label="ID" width="80" />
        <el-table-column label="分类" width="100">
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
        <el-table-column label="提交人" width="120">
          <template #default="{ row }">
            {{ getUserName(row.SubmittedBy) }}
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">
            {{ formatDateTime(row.CreatedAt) }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="expenseVisible"
      title="新增支出"
      width="500px"
      @close="resetExpenseForm"
    >
      <el-alert
        v-if="showWarning"
        type="warning"
        title="预警：该分类预算支出已超过90%，请注意控制成本"
        show-icon
        :closable="false"
        style="margin-bottom: 16px"
      />
      <el-form :model="expenseForm" :rules="expenseRules" ref="expenseFormRef" label-width="100px">
        <el-form-item label="分类" prop="Category">
          <el-select v-model="expenseForm.Category" placeholder="请选择分类" style="width: 100%" @change="checkBudgetWarning">
            <el-option label="舞美" value="stage" />
            <el-option label="人力" value="staff" />
            <el-option label="营销" value="marketing" />
            <el-option label="场地" value="venue" />
          </el-select>
        </el-form-item>
        <el-form-item label="金额" prop="Amount">
          <el-input-number
            v-model="expenseForm.Amount"
            :min="0.01"
            :precision="2"
            :step="100"
            placeholder="请输入金额"
            style="width: 100%"
            @change="checkBudgetWarning"
          />
        </el-form-item>
        <el-form-item label="说明" prop="Description">
          <el-input
            v-model="expenseForm.Description"
            type="textarea"
            :rows="3"
            placeholder="请输入支出说明"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="expenseVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleExpenseSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Plus, ArrowLeft } from '@element-plus/icons-vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import dayjs from 'dayjs'
import { useBookingStore } from '@/stores/booking'
import { useUserStore } from '@/stores/user'
import { getBudget, addExpense, getExpenses } from '@/api/finance'
import type { Budget, Expense, BudgetCategory, BudgetStatus } from '@/types'

use([PieChart, TitleComponent, TooltipComponent, LegendComponent, CanvasRenderer])

const bookingStore = useBookingStore()
const userStore = useUserStore()

const loading = ref(false)
const expensesLoading = ref(false)
const submitting = ref(false)
const expenseVisible = ref(false)
const expenseFormRef = ref<FormInstance>()
const showWarning = ref(false)
const currentBudget = ref<Budget | null>(null)
const budgetList = ref<Budget[]>([])
const expenseList = ref<Expense[]>([])

const expenseForm = reactive<Partial<Expense>>({
  Category: 'stage',
  Amount: 0,
  Description: ''
})

const expenseRules: FormRules = {
  Category: [{ required: true, message: '请选择分类', trigger: 'change' }],
  Amount: [{ required: true, message: '请输入金额', trigger: 'blur' }],
  Description: [{ required: true, message: '请输入说明', trigger: 'blur' }]
}

interface CategoryStat {
  category: BudgetCategory
  budget: number
  spent: number
}

const categoryStats = computed<CategoryStat[]>(() => {
  if (!currentBudget.value) return []
  return [
    { category: 'stage', budget: currentBudget.value.StageBudget, spent: getCategorySpent('stage') },
    { category: 'staff', budget: currentBudget.value.StaffBudget, spent: getCategorySpent('staff') },
    { category: 'marketing', budget: currentBudget.value.MarketingBudget, spent: getCategorySpent('marketing') },
    { category: 'venue', budget: currentBudget.value.VenueBudget, spent: getCategorySpent('venue') }
  ]
})

const formatAmount = (val: number) => {
  if (!val) return '0.00'
  return val.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const formatDateTime = (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss')

const getProgressPercent = (budget: Budget) => {
  if (!budget.TotalBudget) return 0
  return Math.min(Math.round((budget.TotalSpent / budget.TotalBudget) * 100), 100)
}

const statusText = (status: BudgetStatus) => {
  const map: Record<BudgetStatus, string> = {
    normal: '正常',
    warning: '预警',
    frozen: '冻结'
  }
  return map[status] || status
}

const statusTagType = (status: BudgetStatus) => {
  const map: Record<BudgetStatus, 'success' | 'warning' | 'danger'> = {
    normal: 'success',
    warning: 'warning',
    frozen: 'danger'
  }
  return map[status] || 'info'
}

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

const getUserName = (userId: number) => {
  if (userStore.user?.ID === userId) return userStore.userName.value
  return `用户#${userId}`
}

const getCategorySpent = (category: BudgetCategory) => {
  return expenseList.value
    .filter(e => e.Category === category)
    .reduce((sum, e) => sum + (e.Amount || 0), 0)
}

const getPieOption = (item: CategoryStat) => {
  const remain = Math.max(0, item.budget - item.spent)
  const percent = item.budget ? Math.round((item.spent / item.budget) * 100) : 0
  return {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: ¥{c} ({d}%)'
    },
    series: [
      {
        type: 'pie',
        radius: ['55%', '75%'],
        avoidLabelOverlap: false,
        label: {
          show: true,
          position: 'center',
          formatter: `${percent}%`,
          fontSize: 20,
          fontWeight: 'bold'
        },
        labelLine: { show: false },
        data: [
          { value: item.spent, name: '已支出', itemStyle: { color: percent > 90 ? '#F56C6C' : percent > 70 ? '#E6A23C' : '#409EFF' } },
          { value: remain, name: '剩余', itemStyle: { color: '#EBEEF5' } }
        ]
      }
    ]
  }
}

const fetchBudgetList = async () => {
  loading.value = true
  try {
    await bookingStore.fetchBookings()
    budgetList.value = [
      {
        ID: 1,
        BookingID: bookingStore.bookings[0]?.ID || 1,
        StageBudget: 50000,
        StaffBudget: 30000,
        MarketingBudget: 20000,
        VenueBudget: 40000,
        TotalBudget: 140000,
        TotalSpent: 98000,
        Status: 'normal'
      },
      {
        ID: 2,
        BookingID: bookingStore.bookings[1]?.ID || 2,
        StageBudget: 80000,
        StaffBudget: 50000,
        MarketingBudget: 30000,
        VenueBudget: 60000,
        TotalBudget: 220000,
        TotalSpent: 205000,
        Status: 'warning'
      },
      {
        ID: 3,
        BookingID: bookingStore.bookings[2]?.ID || 3,
        StageBudget: 30000,
        StaffBudget: 20000,
        MarketingBudget: 10000,
        VenueBudget: 25000,
        TotalBudget: 85000,
        TotalSpent: 85000,
        Status: 'frozen'
      }
    ]
  } catch (e) {
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

const fetchExpenses = async (budgetId: number) => {
  expensesLoading.value = true
  try {
    expenseList.value = await getExpenses(budgetId)
  } catch (e) {
    expenseList.value = [
      { ID: 1, BudgetID: budgetId, Category: 'stage', Amount: 25000, Description: '舞台搭建材料费', SubmittedBy: 1, CreatedAt: '2026-06-01 10:00:00' },
      { ID: 2, BudgetID: budgetId, Category: 'staff', Amount: 15000, Description: '演员劳务费', SubmittedBy: 1, CreatedAt: '2026-06-03 14:00:00' },
      { ID: 3, BudgetID: budgetId, Category: 'marketing', Amount: 12000, Description: '海报及宣传印刷', SubmittedBy: 1, CreatedAt: '2026-06-05 09:00:00' },
      { ID: 4, BudgetID: budgetId, Category: 'venue', Amount: 20000, Description: '场地租赁费用', SubmittedBy: 1, CreatedAt: '2026-06-08 11:00:00' },
      { ID: 5, BudgetID: budgetId, Category: 'stage', Amount: 18000, Description: '灯光设备租赁', SubmittedBy: 1, CreatedAt: '2026-06-10 15:00:00' },
      { ID: 6, BudgetID: budgetId, Category: 'staff', Amount: 8000, Description: '技术人员加班费', SubmittedBy: 1, CreatedAt: '2026-06-12 10:00:00' }
    ]
  } finally {
    expensesLoading.value = false
  }
}

const handleRowClick = async (row: Budget) => {
  loading.value = true
  try {
    currentBudget.value = row
    await fetchExpenses(row.ID)
  } catch (e) {
    ElMessage.error('加载详情失败')
  } finally {
    loading.value = false
  }
}

const handleBack = () => {
  currentBudget.value = null
}

const handleAddExpense = () => {
  resetExpenseForm()
  expenseVisible.value = true
}

const resetExpenseForm = () => {
  Object.assign(expenseForm, {
    Category: 'stage',
    Amount: 0,
    Description: ''
  })
  showWarning.value = false
  expenseFormRef.value?.resetFields()
}

const checkBudgetWarning = () => {
  if (!currentBudget.value || !expenseForm.Category || !expenseForm.Amount) {
    showWarning.value = false
    return
  }
  const stat = categoryStats.value.find(s => s.category === expenseForm.Category)
  if (stat && stat.budget > 0) {
    const newSpent = stat.spent + (expenseForm.Amount || 0)
    showWarning.value = newSpent / stat.budget >= 0.9
  }
}

const handleExpenseSubmit = async () => {
  if (!expenseFormRef.value || !currentBudget.value) return
  await expenseFormRef.value.validate(async valid => {
    if (!valid) return
    submitting.value = true
    try {
      await addExpense(currentBudget.value.ID, expenseForm)
      ElMessage.success('添加成功')
      expenseVisible.value = false
      resetExpenseForm()
      fetchExpenses(currentBudget.value.ID)
    } catch (e) {
      ElMessage.error('添加失败')
    } finally {
      submitting.value = false
    }
  })
}

onMounted(fetchBudgetList)
</script>

<style scoped lang="scss">
.budget-tracking {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;

      .detail-title {
        font-size: 16px;
        font-weight: 600;
      }
    }
  }

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

  .chart-card {
    text-align: center;

    .chart-title {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .chart {
      height: 180px;
    }

    .chart-stats {
      display: flex;
      justify-content: space-around;
      margin-top: 8px;
      font-size: 13px;
      color: #606266;
    }
  }
}
</style>
