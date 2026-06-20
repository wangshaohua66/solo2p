<template>
  <div class="page-container">
    <el-row :gutter="20" class="stat-row">
      <el-col :xs="12" :sm="8" :md="4" v-for="card in statCards" :key="card.label">
        <div class="stat-card" :style="{ background: card.bg }">
          <div>
            <div class="stat-value">{{ card.value }}</div>
            <div class="stat-label">{{ card.label }}</div>
          </div>
          <el-icon class="stat-icon">
            <component :is="card.icon" />
          </el-icon>
        </div>
      </el-col>
    </el-row>

    <div class="card-box">
      <div class="table-toolbar">
        <div class="search-form">
          <el-input
            v-model="query.taskNo"
            placeholder="任务编号"
            clearable
            style="width: 200px"
            @keyup.enter="handleSearch"
          />
          <el-date-picker
            v-model="query.deliveryDate"
            type="date"
            placeholder="配送日期"
            value-format="YYYY-MM-DD"
            clearable
            style="width: 180px"
          />
          <el-select v-model="query.status" placeholder="任务状态" clearable style="width: 140px">
            <el-option label="待配送" :value="0" />
            <el-option label="配送中" :value="1" />
            <el-option label="已完成" :value="2" />
            <el-option label="异常" :value="3" />
          </el-select>
          <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
          <el-button :icon="Refresh" @click="handleReset">重置</el-button>
        </div>
        <el-button type="success" :icon="Plus" @click="openGenerateDialog">生成配送任务</el-button>
      </div>

      <el-table :data="tableData" v-loading="loading" stripe border>
        <el-table-column prop="taskNo" label="任务编号" min-width="160" />
        <el-table-column prop="deliveryDate" label="配送日期" width="120" />
        <el-table-column prop="vehicleNo" label="车辆编号" width="110" />
        <el-table-column prop="driverName" label="司机" width="90" />
        <el-table-column prop="totalOrders" label="订单数" width="80" align="center" />
        <el-table-column label="总金额" width="110" align="right">
          <template #default="{ row }">¥{{ Number(row.totalAmount || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="startTime" label="开始时间" width="170" />
        <el-table-column prop="endTime" label="完成时间" width="170" />
        <el-table-column label="操作" width="340" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="viewRoute(row)">查看路线</el-button>
            <el-button link type="success" size="small" :disabled="row.status !== 0" @click="handleStart(row)">开始配送</el-button>
            <el-button link type="warning" size="small" :disabled="row.status !== 1" @click="handleComplete(row)">完成配送</el-button>
            <el-button link type="danger" size="small" :disabled="row.status === 2" @click="openExceptionDialog(row)">异常上报</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="query.pageNum"
        v-model:page-size="query.pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        class="pagination"
        @size-change="handleSizeChange"
        @current-change="loadList"
      />
    </div>

    <el-dialog v-model="generateDialogVisible" title="生成配送任务" width="820px">
      <el-form :model="generateForm" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="车辆编号">
              <el-input v-model="generateForm.vehicleNo" placeholder="请输入车辆编号" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="司机姓名">
              <el-input v-model="generateForm.driverName" placeholder="请输入司机姓名" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="司机电话">
              <el-input v-model="generateForm.driverPhone" placeholder="请输入司机电话" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="待配送订单">
          <el-table
            :data="pendingOrders"
            max-height="320"
            border
            size="small"
            @selection-change="handleSelectionChange"
          >
            <el-table-column type="selection" width="50" />
            <el-table-column prop="orderNo" label="订单号" min-width="160" />
            <el-table-column prop="communityName" label="小区" min-width="120" />
            <el-table-column label="金额" width="100" align="right">
              <template #default="{ row }">¥{{ Number(row.payAmount || 0).toFixed(2) }}</template>
            </el-table-column>
            <el-table-column prop="createTime" label="下单时间" width="170" />
          </el-table>
          <div class="select-tip">已选择 {{ selectedOrders.length }} 个订单</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="generateDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="generateLoading" @click="handleGenerate">确认生成</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="routeDialogVisible"
      title="配送路线"
      width="920px"
      @opened="onRouteOpened"
      @closed="onRouteClosed"
    >
      <div class="route-head">
        <div class="route-head-info">
          <span class="route-title">任务：{{ routeTask.taskNo }}</span>
          <el-tag :type="statusTagType(routeTask.status)" size="small">{{ statusText(routeTask.status) }}</el-tag>
          <span class="route-legend">
            <i class="dot" style="background:#909399"></i>待配送
            <i class="dot" style="background:#e6a23c"></i>已到达
            <i class="dot" style="background:#67c23a"></i>已确认
          </span>
        </div>
      </div>
      <div ref="routeChartRef" class="route-chart"></div>
      <div class="route-detail-header">
        <span class="route-title">配送明细（拖动行可调整配送顺序）</span>
        <el-button type="primary" size="small" :icon="Rank" :disabled="routePoints.length === 0" @click="handleSaveSort">保存排序</el-button>
      </div>
      <el-table
        :data="routePoints"
        border
        size="small"
        row-key="id"
        class="route-detail-table"
      >
        <el-table-column label="" width="50" align="center">
          <template #default>
            <el-icon class="drag-handle"><Rank /></el-icon>
          </template>
        </el-table-column>
        <el-table-column type="index" label="顺序" width="70" :index="1" />
        <el-table-column prop="communityName" label="小区名称" min-width="140" />
        <el-table-column prop="orderNo" label="订单号" min-width="160" />
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="detailStatusTagType(row.status)" size="small">{{ detailStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="arriveTime" label="到达时间" width="170" />
        <el-table-column prop="confirmTime" label="确认时间" width="170" />
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button link type="primary" size="small" :disabled="row.status !== 0" @click="handleArrive(row)">确认到达</el-button>
            <el-button link type="success" size="small" :disabled="row.status !== 1" @click="handleConfirm(row)">确认收货</el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="routeDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="exceptionDialogVisible" title="异常上报" width="500px">
      <el-form :model="exceptionForm" label-width="80px">
        <el-form-item label="任务编号">
          <el-input v-model="exceptionForm.taskNo" disabled />
        </el-form-item>
        <el-form-item label="异常原因">
          <el-input
            v-model="exceptionForm.remark"
            type="textarea"
            :rows="4"
            maxlength="200"
            show-word-limit
            placeholder="请输入异常原因"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="exceptionDialogVisible = false">取消</el-button>
        <el-button type="danger" :loading="exceptionLoading" @click="handleReport">确认上报</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus, Rank } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import { deliveryApi } from '@/api/order'
import { orderApi } from '@/api/order'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const query = reactive({
  pageNum: 1,
  pageSize: 10,
  taskNo: '',
  deliveryDate: '',
  status: undefined as number | undefined
})

const statCards = ref([
  { label: '总任务数', value: 0, icon: 'Van', bg: 'linear-gradient(135deg, #667eea, #764ba2)' },
  { label: '已完成', value: 0, icon: 'CircleCheck', bg: 'linear-gradient(135deg, #43e97b, #38f9d7)' },
  { label: '进行中', value: 0, icon: 'Loading', bg: 'linear-gradient(135deg, #4facfe, #00f2fe)' },
  { label: '待配送', value: 0, icon: 'Clock', bg: 'linear-gradient(135deg, #f093fb, #f5576c)' },
  { label: '异常任务', value: 0, icon: 'Warning', bg: 'linear-gradient(135deg, #ff5858, #f09819)' },
  { label: '准时率', value: '0%', icon: 'Timer', bg: 'linear-gradient(135deg, #fa709a, #fee140)' }
])

const statusText = (status: number) => {
  const map: Record<number, string> = { 0: '待配送', 1: '配送中', 2: '已完成', 3: '异常' }
  return map[status] ?? '未知'
}
const statusTagType = (status: number) => {
  const map: Record<number, string> = { 0: 'info', 1: 'warning', 2: 'success', 3: 'danger' }
  return map[status] ?? 'info'
}
const detailStatusText = (status: number) => {
  const map: Record<number, string> = { 0: '待配送', 1: '已到达', 2: '已确认' }
  return map[status] ?? '未知'
}
const detailStatusTagType = (status: number) => {
  const map: Record<number, string> = { 0: 'info', 1: 'warning', 2: 'success' }
  return map[status] ?? 'info'
}

const loadStatistics = async () => {
  try {
    const res: any = await deliveryApi.getStatistics()
    const data = res.data || {}
    statCards.value[0].value = data.total || 0
    statCards.value[1].value = data.completed || 0
    statCards.value[2].value = data.inProgress || 0
    statCards.value[3].value = data.pending || 0
    statCards.value[4].value = data.exception || 0
    statCards.value[5].value = (data.onTimeRate ?? 0) + '%'
  } catch (e) {
    console.error(e)
  }
}

const loadList = async () => {
  loading.value = true
  try {
    const res: any = await deliveryApi.getPage(query)
    tableData.value = res.data.records || []
    total.value = res.data.total || 0
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  query.pageNum = 1
  loadList()
}
const handleReset = () => {
  query.taskNo = ''
  query.deliveryDate = ''
  query.status = undefined
  query.pageNum = 1
  loadList()
}
const handleSizeChange = () => {
  query.pageNum = 1
  loadList()
}

const generateDialogVisible = ref(false)
const generateLoading = ref(false)
const pendingOrders = ref<any[]>([])
const selectedOrders = ref<any[]>([])
const generateForm = reactive({
  vehicleNo: '',
  driverName: '',
  driverPhone: ''
})

const openGenerateDialog = async () => {
  generateForm.vehicleNo = ''
  generateForm.driverName = ''
  generateForm.driverPhone = ''
  selectedOrders.value = []
  generateDialogVisible.value = true
  try {
    const res: any = await orderApi.getPendingDelivery()
    pendingOrders.value = res.data || []
  } catch (e) {
    console.error(e)
  }
}
const handleSelectionChange = (rows: any[]) => {
  selectedOrders.value = rows
}
const handleGenerate = async () => {
  if (selectedOrders.value.length === 0) {
    ElMessage.warning('请至少选择一个待配送订单')
    return
  }
  if (!generateForm.vehicleNo.trim()) {
    ElMessage.warning('请填写车辆编号')
    return
  }
  if (!generateForm.driverName.trim()) {
    ElMessage.warning('请填写司机姓名')
    return
  }
  if (!generateForm.driverPhone.trim()) {
    ElMessage.warning('请填写司机电话')
    return
  }
  generateLoading.value = true
  try {
    await deliveryApi.generate({
      orderIds: selectedOrders.value.map(o => o.id),
      vehicleNo: generateForm.vehicleNo,
      driverName: generateForm.driverName,
      driverPhone: generateForm.driverPhone
    })
    ElMessage.success('配送任务生成成功')
    generateDialogVisible.value = false
    loadList()
    loadStatistics()
  } catch (e) {
    console.error(e)
  } finally {
    generateLoading.value = false
  }
}

const handleStart = async (row: any) => {
  try {
    await ElMessageBox.confirm(`确认开始配送任务 ${row.taskNo}？`, '提示', { type: 'warning' })
    await deliveryApi.start(row.id)
    ElMessage.success('已开始配送')
    loadList()
    loadStatistics()
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}
const handleComplete = async (row: any) => {
  try {
    await ElMessageBox.confirm(`确认完成任务 ${row.taskNo}？`, '提示', { type: 'warning' })
    await deliveryApi.complete(row.id)
    ElMessage.success('任务已完成')
    loadList()
    loadStatistics()
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}

const exceptionDialogVisible = ref(false)
const exceptionLoading = ref(false)
const exceptionForm = reactive({
  taskId: undefined as number | undefined,
  taskNo: '',
  remark: ''
})
const openExceptionDialog = (row: any) => {
  exceptionForm.taskId = row.id
  exceptionForm.taskNo = row.taskNo
  exceptionForm.remark = ''
  exceptionDialogVisible.value = true
}
const handleReport = async () => {
  if (!exceptionForm.remark.trim()) {
    ElMessage.warning('请填写异常原因')
    return
  }
  exceptionLoading.value = true
  try {
    await deliveryApi.reportException(exceptionForm.taskId!, exceptionForm.remark)
    ElMessage.success('异常已上报')
    exceptionDialogVisible.value = false
    loadList()
    loadStatistics()
  } catch (e) {
    console.error(e)
  } finally {
    exceptionLoading.value = false
  }
}

const routeDialogVisible = ref(false)
const routeChartRef = ref<HTMLElement>()
let routeChart: echarts.ECharts | null = null
const routeTask = ref<any>({})
const routePoints = ref<any[]>([])
let dragIndex = -1

const viewRoute = (row: any) => {
  routeTask.value = row
  routeDialogVisible.value = true
}
const onRouteOpened = async () => {
  await loadRouteData()
}
const onRouteClosed = () => {
  if (routeChart) {
    routeChart.dispose()
    routeChart = null
  }
  routePoints.value = []
  routeTask.value = {}
  dragIndex = -1
}
const loadRouteData = async () => {
  try {
    const res: any = await deliveryApi.getRoute(routeTask.value.id)
    routeTask.value = res.data.task || routeTask.value
    routePoints.value = res.data.points || []
    await nextTick()
    renderRouteChart()
    initDragSort()
  } catch (e) {
    console.error(e)
  }
}
const refreshRoute = async () => {
  await loadRouteData()
}

const renderRouteChart = () => {
  if (!routeChartRef.value) return
  if (routeChart) {
    routeChart.dispose()
  }
  routeChart = echarts.init(routeChartRef.value)
  const points = routePoints.value
  if (points.length === 0) {
    routeChart.setOption({
      title: { text: '暂无配送点数据', left: 'center', top: 'middle', textStyle: { color: '#909399' } }
    })
    return
  }
  const statusColorMap: Record<number, string> = { 0: '#909399', 1: '#e6a23c', 2: '#67c23a' }
  const lineData = points.map((p) => [Number(p.lng), Number(p.lat)])
  const pointData = points.map((p) => ({
    name: p.name,
    value: [Number(p.lng), Number(p.lat)],
    itemStyle: { color: statusColorMap[p.status] || '#409eff' }
  }))
  routeChart.setOption({
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const idx = params.dataIndex
        const p = points[idx]
        if (!p) return ''
        return `${idx + 1}. ${p.name}<br/>状态：${detailStatusText(p.status)}<br/>经度：${p.lng}<br/>纬度：${p.lat}`
      }
    },
    grid: { left: '5%', right: '5%', bottom: '12%', top: '12%', containLabel: true },
    xAxis: { type: 'value', name: '经度', scale: true, nameLocation: 'middle', nameGap: 28, nameTextStyle: { color: '#909399' } },
    yAxis: { type: 'value', name: '纬度', scale: true, nameLocation: 'middle', nameGap: 36, nameTextStyle: { color: '#909399' } },
    series: [
      {
        type: 'line',
        data: lineData,
        symbol: 'none',
        smooth: false,
        lineStyle: { width: 3, color: '#409eff', type: 'dashed' }
      },
      {
        type: 'scatter',
        data: pointData,
        symbolSize: 16,
        label: {
          show: true,
          position: 'top',
          fontSize: 13,
          fontWeight: 'bold',
          formatter: (params: any) => `${params.dataIndex + 1}`
        },
        emphasis: { scale: 1.4 }
      }
    ]
  })
}

const handleArrive = async (row: any) => {
  try {
    await deliveryApi.arrive(row.id)
    ElMessage.success('已确认到达')
    await refreshRoute()
    loadList()
  } catch (e) {
    console.error(e)
  }
}
const handleConfirm = async (row: any) => {
  try {
    await deliveryApi.confirm(row.id)
    ElMessage.success('已确认收货')
    await refreshRoute()
    loadList()
  } catch (e) {
    console.error(e)
  }
}

const handleSaveSort = async () => {
  if (routePoints.value.length === 0) return
  try {
    await deliveryApi.reorder(routePoints.value.map((p) => p.id))
    ElMessage.success('配送顺序已保存')
    await loadRouteData()
  } catch (e) {
    console.error(e)
  }
}

const initDragSort = () => {
  nextTick(() => {
    const tbody = document.querySelector('.route-detail-table .el-table__body-wrapper tbody') as HTMLElement | null
    if (!tbody) return
    const rows = Array.from(tbody.querySelectorAll('tr')) as HTMLElement[]
    rows.forEach((row, index) => {
      row.addEventListener('mousedown', (e: MouseEvent) => {
        const target = e.target as HTMLElement
        if (target.closest('.drag-handle')) {
          row.setAttribute('draggable', 'true')
        } else {
          row.setAttribute('draggable', 'false')
        }
      })
      row.addEventListener('dragstart', (e: DragEvent) => {
        if (row.getAttribute('draggable') !== 'true') {
          e.preventDefault()
          return
        }
        dragIndex = index
        row.classList.add('dragging-row')
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', String(index))
        }
      })
      row.addEventListener('dragend', () => {
        row.setAttribute('draggable', 'false')
        row.classList.remove('dragging-row')
        dragIndex = -1
      })
      row.addEventListener('dragover', (e: DragEvent) => {
        if (dragIndex === -1 || dragIndex === index) return
        e.preventDefault()
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
        const rect = row.getBoundingClientRect()
        const after = (e.clientY - rect.top) / rect.height > 0.5
        row.classList.toggle('drag-over-top', !after)
        row.classList.toggle('drag-over-bottom', after)
      })
      row.addEventListener('dragleave', () => {
        row.classList.remove('drag-over-top', 'drag-over-bottom')
      })
      row.addEventListener('drop', (e: DragEvent) => {
        e.preventDefault()
        row.classList.remove('drag-over-top', 'drag-over-bottom')
        if (dragIndex === -1 || dragIndex === index) return
        const rect = row.getBoundingClientRect()
        const after = (e.clientY - rect.top) / rect.height > 0.5
        let targetIndex = index + (after ? 1 : 0)
        const moved = routePoints.value.splice(dragIndex, 1)[0]
        if (targetIndex > dragIndex) targetIndex -= 1
        routePoints.value.splice(targetIndex, 0, moved)
        routePoints.value.forEach((p, i) => {
          p.sortOrder = i + 1
        })
        dragIndex = -1
        renderRouteChart()
        nextTick(() => initDragSort())
      })
    })
  })
}

const handleResize = () => {
  routeChart?.resize()
}

onMounted(() => {
  loadList()
  loadStatistics()
  window.addEventListener('resize', handleResize)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  if (routeChart) {
    routeChart.dispose()
    routeChart = null
  }
})
</script>

<style scoped>
.stat-row {
  margin-bottom: 20px;
}
.pagination {
  margin-top: 16px;
  justify-content: flex-end;
  display: flex;
}
.select-tip {
  margin-top: 8px;
  color: var(--text-secondary);
  font-size: 13px;
}
.route-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.route-head-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.route-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}
.route-legend {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}
.route-legend .dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-left: 8px;
}
.route-chart {
  width: 100%;
  height: 320px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  margin-bottom: 16px;
}
.route-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.drag-handle {
  cursor: move;
  color: var(--text-secondary);
  font-size: 16px;
}
.drag-handle:hover {
  color: var(--primary-color);
}
:deep(.route-detail-table .el-table__body tr) {
  transition: background 0.2s;
}
:deep(.route-detail-table .el-table__body tr.dragging-row) {
  opacity: 0.5;
  background: #ecf5ff !important;
}
:deep(.route-detail-table .el-table__body tr.drag-over-top) {
  box-shadow: inset 0 3px 0 0 var(--primary-color);
}
:deep(.route-detail-table .el-table__body tr.drag-over-bottom) {
  box-shadow: inset 0 -3px 0 0 var(--primary-color);
}
</style>
