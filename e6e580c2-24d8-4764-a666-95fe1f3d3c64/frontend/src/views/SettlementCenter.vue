<template>
  <div class="page-container">
    <div class="stat-row-flex">
      <div class="stat-card" :style="{ background: card.bg }" v-for="card in statCards" :key="card.label">
        <div>
          <div class="stat-value">{{ card.value }}</div>
          <div class="stat-label">{{ card.label }}</div>
        </div>
        <el-icon class="stat-icon">
          <component :is="card.icon" />
        </el-icon>
      </div>
    </div>

    <div class="card-box">
      <div class="table-toolbar">
        <div class="search-form">
          <el-input
            v-model="searchForm.settlementNo"
            placeholder="结算单号"
            clearable
            style="width: 180px"
            @keyup.enter="handleSearch"
          />
          <el-select v-model="searchForm.type" placeholder="结算类型" clearable style="width: 140px">
            <el-option label="供应商结算" :value="1" />
            <el-option label="团长佣金" :value="2" />
          </el-select>
          <el-input
            v-model="searchForm.targetId"
            placeholder="目标ID"
            clearable
            style="width: 120px"
            @keyup.enter="handleSearch"
          />
          <el-select v-model="searchForm.status" placeholder="结算状态" clearable style="width: 140px">
            <el-option label="待结算" :value="0" />
            <el-option label="已结算" :value="1" />
          </el-select>
          <el-date-picker
            v-model="searchForm.dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            clearable
            style="width: 260px"
          />
          <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
          <el-button :icon="Refresh" @click="handleReset">重置</el-button>
        </div>
        <div class="action-buttons">
          <el-button type="success" :icon="Document" @click="openSupplierDialog">生成供应商对账单</el-button>
          <el-button type="warning" :icon="Money" @click="openLeaderDialog">生成团长佣金结算单</el-button>
        </div>
      </div>

      <el-table :data="tableData" v-loading="loading" border stripe style="width: 100%">
        <el-table-column prop="settlementNo" label="结算单号" width="180" show-overflow-tooltip />
        <el-table-column prop="type" label="类型" width="110">
          <template #default="{ row }">
            <el-tag :type="row.type === 1 ? '' : 'warning'">
              {{ row.type === 1 ? '供应商' : '团长' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="targetName" label="目标名称" width="130" show-overflow-tooltip />
        <el-table-column label="结算周期" width="200">
          <template #default="{ row }">{{ row.startDate }} ~ {{ row.endDate }}</template>
        </el-table-column>
        <el-table-column prop="orderCount" label="订单数" width="80" align="center" />
        <el-table-column label="总金额" width="110" align="right">
          <template #default="{ row }">{{ formatMoney(row.totalAmount) }}</template>
        </el-table-column>
        <el-table-column label="佣金" width="110" align="right">
          <template #default="{ row }">{{ formatMoney(row.commissionAmount) }}</template>
        </el-table-column>
        <el-table-column label="平台利润" width="110" align="right">
          <template #default="{ row }">{{ formatMoney(row.platformProfit) }}</template>
        </el-table-column>
        <el-table-column label="结算金额" width="110" align="right">
          <template #default="{ row }">
            <span class="settle-amount">{{ formatMoney(row.settleAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 0 ? 'warning' : 'success'">
              {{ row.status === 0 ? '待结算' : '已结算' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="settleTime" label="结算时间" width="160">
          <template #default="{ row }">{{ row.settleTime || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewDetail(row)">查看明细</el-button>
            <el-button link type="success" v-if="row.status === 0" @click="handleExecute(row)">执行结算</el-button>
            <el-button link type="warning" v-if="row.status === 0" @click="openAdjustDialog(row)">调整金额</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.pageNum"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </div>

    <el-dialog v-model="supplierDialogVisible" title="生成供应商对账单" width="500px">
      <el-form :model="supplierForm" label-width="100px">
        <el-form-item label="选择供应商">
          <el-select
            v-model="supplierForm.supplierId"
            placeholder="请选择供应商"
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="item in supplierList"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="结算周期">
          <el-date-picker
            v-model="supplierForm.dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="supplierDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="generateLoading" @click="handleGenerateSupplier">确认生成</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="leaderDialogVisible" title="生成团长佣金结算单" width="500px">
      <el-form :model="leaderForm" label-width="100px">
        <el-form-item label="选择团长">
          <el-select
            v-model="leaderForm.leaderId"
            placeholder="请选择团长"
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="item in leaderList"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="结算周期">
          <el-date-picker
            v-model="leaderForm.dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="leaderDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="generateLoading" @click="handleGenerateLeader">确认生成</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailDialogVisible" title="结算明细" width="820px">
      <el-table :data="itemList" v-loading="itemLoading" border size="small" max-height="460">
        <el-table-column type="index" label="序号" width="60" align="center" />
        <el-table-column prop="orderNo" label="订单号" width="180" show-overflow-tooltip />
        <el-table-column prop="productName" label="商品名称" show-overflow-tooltip />
        <el-table-column label="金额" width="120" align="right">
          <template #default="{ row }">{{ formatMoney(row.amount) }}</template>
        </el-table-column>
        <el-table-column label="佣金" width="120" align="right">
          <template #default="{ row }">{{ formatMoney(row.commission) }}</template>
        </el-table-column>
        <el-table-column label="利润" width="120" align="right">
          <template #default="{ row }">{{ formatMoney(row.profit) }}</template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="adjustDialogVisible" title="调整结算金额" width="460px">
      <el-form :model="adjustForm" label-width="100px">
        <el-form-item label="原结算金额">
          <span class="settle-amount">{{ formatMoney(adjustForm.originalAmount) }}</span>
        </el-form-item>
        <el-form-item label="新结算金额">
          <el-input-number
            v-model="adjustForm.newAmount"
            :precision="2"
            :min="0"
            :step="100"
            controls-position="right"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="调整原因">
          <el-input
            v-model="adjustForm.remark"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
            placeholder="请输入调整原因"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adjustDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="adjustLoading" @click="handleAdjust">确认调整</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Document, Money } from '@element-plus/icons-vue'
import { settlementApi } from '@/api/order'
import { supplierApi } from '@/api/product'
import { leaderApi } from '@/api/community'

const loading = ref(false)
const generateLoading = ref(false)
const adjustLoading = ref(false)
const itemLoading = ref(false)

const tableData = ref<any[]>([])
const supplierList = ref<any[]>([])
const leaderList = ref<any[]>([])
const itemList = ref<any[]>([])

const pagination = reactive({
  pageNum: 1,
  pageSize: 10,
  total: 0
})

const searchForm = reactive({
  settlementNo: '',
  type: undefined as number | undefined,
  targetId: '',
  status: undefined as number | undefined,
  dateRange: [] as string[]
})

const statCards = ref([
  { label: '供应商总结算金额', value: '¥0.00', icon: 'Connection', bg: 'linear-gradient(135deg, #667eea, #764ba2)' },
  { label: '团长佣金总额', value: '¥0.00', icon: 'UserFilled', bg: 'linear-gradient(135deg, #f093fb, #f5576c)' },
  { label: '平台利润总额', value: '¥0.00', icon: 'Money', bg: 'linear-gradient(135deg, #4facfe, #00f2fe)' },
  { label: '待结算笔数', value: 0, icon: 'Clock', bg: 'linear-gradient(135deg, #fa709a, #fee140)' },
  { label: '已结算笔数', value: 0, icon: 'CircleCheck', bg: 'linear-gradient(135deg, #43e97b, #38f9d7)' }
])

const supplierDialogVisible = ref(false)
const leaderDialogVisible = ref(false)
const detailDialogVisible = ref(false)
const adjustDialogVisible = ref(false)

const supplierForm = reactive({
  supplierId: undefined as number | undefined,
  dateRange: [] as string[]
})

const leaderForm = reactive({
  leaderId: undefined as number | undefined,
  dateRange: [] as string[]
})

const adjustForm = reactive({
  id: 0,
  originalAmount: 0,
  newAmount: 0,
  remark: ''
})

const formatMoney = (val: any) => {
  if (val === null || val === undefined || val === '') return '-'
  const num = Number(val) || 0
  return '¥' + num.toFixed(2)
}

const loadList = async () => {
  loading.value = true
  try {
    const params: any = {
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      settlementNo: searchForm.settlementNo || undefined,
      type: searchForm.type,
      targetId: searchForm.targetId ? Number(searchForm.targetId) : undefined,
      status: searchForm.status,
      startDate: searchForm.dateRange?.[0] || undefined,
      endDate: searchForm.dateRange?.[1] || undefined
    }
    const res: any = await settlementApi.getPage(params)
    tableData.value = res.data.records || []
    pagination.total = res.data.total || 0
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

const loadStatistics = async () => {
  try {
    const res: any = await settlementApi.getStatistics()
    const data = res.data || {}
    statCards.value[0].value = formatMoney(data.supplierTotalSettlement)
    statCards.value[1].value = formatMoney(data.leaderCommissionTotal)
    statCards.value[2].value = formatMoney(data.platformProfitTotal)
    statCards.value[3].value = data.pendingCount || 0
    statCards.value[4].value = data.completedCount || 0
  } catch (e) {
    console.error(e)
  }
}

const loadSuppliers = async () => {
  try {
    const res: any = await supplierApi.getList()
    supplierList.value = res.data || []
  } catch (e) {
    console.error(e)
  }
}

const loadLeaders = async () => {
  try {
    const res: any = await leaderApi.getList()
    leaderList.value = res.data || []
  } catch (e) {
    console.error(e)
  }
}

const handleSearch = () => {
  pagination.pageNum = 1
  loadList()
}

const handleReset = () => {
  searchForm.settlementNo = ''
  searchForm.type = undefined
  searchForm.targetId = ''
  searchForm.status = undefined
  searchForm.dateRange = []
  pagination.pageNum = 1
  loadList()
}

const handleSizeChange = (size: number) => {
  pagination.pageSize = size
  pagination.pageNum = 1
  loadList()
}

const handleCurrentChange = (page: number) => {
  pagination.pageNum = page
  loadList()
}

const openSupplierDialog = () => {
  supplierForm.supplierId = undefined
  supplierForm.dateRange = []
  supplierDialogVisible.value = true
}

const openLeaderDialog = () => {
  leaderForm.leaderId = undefined
  leaderForm.dateRange = []
  leaderDialogVisible.value = true
}

const handleGenerateSupplier = async () => {
  if (!supplierForm.supplierId) {
    ElMessage.warning('请选择供应商')
    return
  }
  if (!supplierForm.dateRange || supplierForm.dateRange.length < 2) {
    ElMessage.warning('请选择结算周期')
    return
  }
  generateLoading.value = true
  try {
    await settlementApi.generateSupplier({
      supplierId: supplierForm.supplierId,
      startDate: supplierForm.dateRange[0],
      endDate: supplierForm.dateRange[1]
    })
    ElMessage.success('供应商对账单生成成功')
    supplierDialogVisible.value = false
    loadList()
    loadStatistics()
  } catch (e) {
    console.error(e)
  } finally {
    generateLoading.value = false
  }
}

const handleGenerateLeader = async () => {
  if (!leaderForm.leaderId) {
    ElMessage.warning('请选择团长')
    return
  }
  if (!leaderForm.dateRange || leaderForm.dateRange.length < 2) {
    ElMessage.warning('请选择结算周期')
    return
  }
  generateLoading.value = true
  try {
    await settlementApi.generateLeader({
      leaderId: leaderForm.leaderId,
      startDate: leaderForm.dateRange[0],
      endDate: leaderForm.dateRange[1]
    })
    ElMessage.success('团长佣金结算单生成成功')
    leaderDialogVisible.value = false
    loadList()
    loadStatistics()
  } catch (e) {
    console.error(e)
  } finally {
    generateLoading.value = false
  }
}

const viewDetail = async (row: any) => {
  detailDialogVisible.value = true
  itemLoading.value = true
  itemList.value = []
  try {
    const res: any = await settlementApi.getItems(row.id)
    itemList.value = res.data || []
  } catch (e) {
    console.error(e)
  } finally {
    itemLoading.value = false
  }
}

const handleExecute = (row: any) => {
  ElMessageBox.confirm('确认执行该结算单吗？执行后状态将变为已结算。', '提示', {
    type: 'warning',
    confirmButtonText: '确认执行',
    cancelButtonText: '取消'
  })
    .then(async () => {
      try {
        await settlementApi.execute(row.id)
        ElMessage.success('结算执行成功')
        loadList()
        loadStatistics()
      } catch (e) {
        console.error(e)
      }
    })
    .catch(() => {})
}

const openAdjustDialog = (row: any) => {
  adjustForm.id = row.id
  adjustForm.originalAmount = row.settleAmount
  adjustForm.newAmount = Number(row.settleAmount) || 0
  adjustForm.remark = ''
  adjustDialogVisible.value = true
}

const handleAdjust = async () => {
  if (!adjustForm.remark.trim()) {
    ElMessage.warning('请输入调整原因')
    return
  }
  adjustLoading.value = true
  try {
    await settlementApi.adjust(adjustForm.id, adjustForm.newAmount, adjustForm.remark)
    ElMessage.success('调整成功')
    adjustDialogVisible.value = false
    loadList()
    loadStatistics()
  } catch (e) {
    console.error(e)
  } finally {
    adjustLoading.value = false
  }
}

onMounted(() => {
  loadList()
  loadStatistics()
  loadSuppliers()
  loadLeaders()
})
</script>

<style scoped>
.stat-row-flex {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.stat-row-flex .stat-card {
  flex: 1 1 calc(20% - 16px);
  min-width: 180px;
}

.action-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.settle-amount {
  font-weight: 600;
  color: var(--danger-color);
}
</style>
