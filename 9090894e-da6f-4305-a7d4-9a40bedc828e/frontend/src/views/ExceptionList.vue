<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Warning,
  Search as SearchIcon,
  Refresh,
  View,
  Edit,
  WarningFilled,
  CircleCheck,
  Clock,
  RefreshRight,
  Upload
} from '@element-plus/icons-vue'
import StatusTag from '@/components/StatusTag.vue'
import type { CustomsException } from '@/types'
import { useNotificationStore } from '@/stores/notificationStore'

const notificationStore = useNotificationStore()

const filterStatus = ref('')
const filterType = ref('')
const keyword = ref('')
const detailVisible = ref(false)
const handleVisible = ref(false)
const redeclareVisible = ref(false)
const currentException = ref<CustomsException | null>(null)
const handleForm = reactive({ suggestion: '', actions: '' })
const redeclareForm = reactive({ remark: '', resubmit: true })
const syncLoading = ref(false)

const exceptions: CustomsException[] = reactive([
  {
    id: '1',
    declareNo: 'CB202406130005',
    type: '单证不符',
    description: 'HS编码归类有误，申报编码33041000与实际商品不符，需提供化妆品备案凭证',
    status: 'pending',
    suggestion: '请核对商品HS编码，补充相关备案资料后重新申报',
    reportedAt: '2024-06-13 15:00:00',
    handler: ''
  },
  {
    id: '2',
    declareNo: 'CB202406120008',
    type: '价格质疑',
    description: '海关对申报价格存在质疑，要求提供交易凭证、付款记录等价格证明材料',
    status: 'processing',
    suggestion: '请补充相关价格证明材料',
    reportedAt: '2024-06-12 11:20:00',
    handler: '李审核员'
  },
  {
    id: '3',
    declareNo: 'CB202406110012',
    type: '原产地证书缺失',
    description: '申报货物涉及RCEP协定税率，但未提供有效原产地证书',
    status: 'resolved',
    suggestion: '已补传原产地证书，审核通过',
    reportedAt: '2024-06-11 09:15:00',
    resolvedAt: '2024-06-11 16:45:00',
    handler: '李审核员'
  },
  {
    id: '4',
    declareNo: 'CB202406100015',
    type: '数量差异',
    description: '海关查验发现实际货物数量与申报数量存在5%差异',
    status: 'pending',
    suggestion: '请核实实际数量并修改申报',
    reportedAt: '2024-06-10 14:30:00',
    handler: ''
  },
  {
    id: '5',
    declareNo: 'CB202406080020',
    type: '禁限类商品',
    description: '申报商品属于出口许可证管理范畴，未提供有效出口许可证',
    status: 'processing',
    suggestion: '请办理并提交出口许可证',
    reportedAt: '2024-06-08 10:00:00',
    handler: '王管理员'
  }
])

const statusOptions = [
  { label: '全部状态', value: '' },
  { label: '待处理', value: 'pending' },
  { label: '处理中', value: 'processing' },
  { label: '已解决', value: 'resolved' }
]

const typeOptions = [
  { label: '全部类型', value: '' },
  { label: '单证不符', value: '单证不符' },
  { label: '价格质疑', value: '价格质疑' },
  { label: '原产地证书缺失', value: '原产地证书缺失' },
  { label: '数量差异', value: '数量差异' },
  { label: '禁限类商品', value: '禁限类商品' }
]

const stats = computed(() => ({
  total: exceptions.length,
  pending: exceptions.filter(e => e.status === 'pending').length,
  processing: exceptions.filter(e => e.status === 'processing').length,
  resolved: exceptions.filter(e => e.status === 'resolved').length
}))

const filteredExceptions = computed(() => {
  return exceptions.filter(e => {
    if (filterStatus.value && e.status !== filterStatus.value) return false
    if (filterType.value && e.type !== filterType.value) return false
    if (keyword.value && !e.declareNo.includes(keyword.value) && !e.description.includes(keyword.value)) return false
    return true
  })
})

function handleSearch() {
  ElMessage.success('筛选完成')
}

function handleReset() {
  filterStatus.value = ''
  filterType.value = ''
  keyword.value = ''
}

function viewDetail(row: CustomsException) {
  currentException.value = row
  detailVisible.value = true
}

function handleException(row: CustomsException) {
  if (row.status === 'resolved') {
    ElMessage.warning('该案件已解决')
    return
  }
  currentException.value = row
  handleForm.suggestion = ''
  handleForm.actions = ''
  handleVisible.value = true
}

function submitHandle() {
  if (!handleForm.suggestion) {
    ElMessage.warning('请填写整改意见')
    return
  }
  if (currentException.value) {
    currentException.value.status = 'processing'
    currentException.value.suggestion = handleForm.suggestion
    currentException.value.handler = '李审核员'
  }
  handleVisible.value = false
  ElMessage.success('处理意见已提交')
}

function resolve(row: CustomsException) {
  row.status = 'resolved'
  row.resolvedAt = new Date().toLocaleString()
  ElMessage.success('案件已标记为已解决')
}

function openRedeclare(row: CustomsException) {
  currentException.value = row
  redeclareForm.remark = ''
  redeclareForm.resubmit = true
  redeclareVisible.value = true
}

function confirmRedeclare() {
  if (!currentException.value) return

  ElMessageBox.confirm(
    `确定要对申报单 ${currentException.value.declareNo} 重新申报吗？重新提交后将进入审核流程。`,
    '重新申报确认',
    {
      confirmButtonText: '确认重新申报',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    if (currentException.value) {
      currentException.value.status = 'resolved'
      currentException.value.resolvedAt = new Date().toLocaleString()
      currentException.value.resolveNote = redeclareForm.remark || '企业重新申报'

      notificationStore.addMessage({
        type: 'system',
        title: '重新申报成功',
        content: `申报单 ${currentException.value.declareNo} 已重新提交，等待审核`,
        link: '/declarations'
      })

      ElMessage.success('重新申报成功，已进入审核流程')
      redeclareVisible.value = false
    }
  }).catch(() => {})
}

function syncCustomsStatus() {
  syncLoading.value = true
  setTimeout(() => {
    const pendingList = exceptions.filter(e => e.status !== 'resolved')
    if (pendingList.length > 0 && Math.random() > 0.5) {
      const randomException = pendingList[Math.floor(Math.random() * pendingList.length)]
      notificationStore.addMessage({
        type: 'exception',
        title: '新异常预警',
        content: `申报单 ${randomException.declareNo} 出现${randomException.type}异常`,
        link: '/exceptions'
      })
    }
    syncLoading.value = false
    ElMessage.success('海关状态同步完成')
  }, 1500)
}

const knowledgeList = [
  { id: 'k1', title: 'HS编码归类常见错误及正确案例', solution: '重点关注商品材质、用途、功能三个维度进行综合判断...' },
  { id: 'k2', title: '出口退税单证不齐应对方案', solution: '常见缺失单证包括报关单、增值税发票、出口收汇核销单等...' },
  { id: 'k3', title: '海关价格质疑应对指南', solution: '准备合同、发票、付款凭证、运保费单据等材料...' }
]

const searchKnowledge = ref('')
const showKnowledge = ref(false)
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-title">
        <el-icon style="margin-right: 8px"><Warning /></el-icon>
        通关异常跟踪
      </div>
      <div style="display: flex; gap: 10px">
        <el-button @click="syncCustomsStatus" :loading="syncLoading">
          <el-icon style="margin-right: 4px"><RefreshRight /></el-icon>
          同步海关状态
        </el-button>
        <el-button @click="showKnowledge = !showKnowledge">
          <el-icon style="margin-right: 4px"><View /></el-icon>
          {{ showKnowledge ? '隐藏知识库' : '异常知识库' }}
        </el-button>
        <el-button :icon="Refresh">刷新</el-button>
      </div>
    </div>

    <el-row :gutter="16" style="margin-bottom: 16px">
      <el-col :span="6" v-for="(v, k) in stats" :key="k">
        <div class="card stat-mini">
          <el-icon
            :size="28"
            :color="k==='total'?'#1e6fff':k==='pending'?'#ff4d4f':k==='processing'?'#faad14':'#52c41a'"
          >
            <component :is="k==='total'?Warning:k==='pending'?WarningFilled:k==='processing'?Clock:CircleCheck" />
          </el-icon>
          <div>
            <div class="stat-num">{{ v }}</div>
            <div class="stat-name">
              {{ k==='total'?'异常总数':k==='pending'?'待处理':k==='processing'?'处理中':'已解决' }}
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <div v-if="showKnowledge" class="card" style="margin-bottom: 16px">
      <div class="section-title">异常案例知识库</div>
      <div style="display: flex; gap: 10px; margin-bottom: 12px">
        <el-input v-model="searchKnowledge" placeholder="搜索常见问题..." style="max-width: 360px" />
        <el-button type="primary" :icon="SearchIcon">搜索</el-button>
      </div>
      <el-table :data="knowledgeList" size="small">
        <el-table-column prop="title" label="问题标题" />
        <el-table-column prop="solution" label="解决方案" show-overflow-tooltip />
      </el-table>
    </div>

    <div class="card">
      <el-form :inline="true" style="margin-bottom: 12px">
        <el-form-item label="关键词">
          <el-input v-model="keyword" placeholder="申报单号/描述" clearable style="width: 220px" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filterStatus" placeholder="全部" clearable style="width: 140px">
            <el-option v-for="o in statusOptions" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="异常类型">
          <el-select v-model="filterType" placeholder="全部" clearable style="width: 180px">
            <el-option v-for="o in typeOptions" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="SearchIcon" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="filteredExceptions" border stripe>
        <el-table-column prop="declareNo" label="申报单号" width="170">
          <template #default="{ row }">
            <el-link type="primary">{{ row.declareNo }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="type" label="异常类型" width="140">
          <template #default="{ row }">
            <el-tag type="danger" size="small">{{ row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="异常描述" min-width="260" show-overflow-tooltip />
        <el-table-column prop="suggestion" label="整改建议" min-width="200" show-overflow-tooltip />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <StatusTag :status="row.status" />
          </template>
        </el-table-column>
        <el-table-column prop="handler" label="处理人" width="100">
          <template #default="{ row }">{{ row.handler || '-' }}</template>
        </el-table-column>
        <el-table-column prop="reportedAt" label="上报时间" width="170" sortable />
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewDetail(row)">详情</el-button>
            <el-button link type="primary" @click="handleException(row)" :disabled="row.status==='resolved'">
              处理
            </el-button>
            <el-button
              link
              type="success"
              @click="openRedeclare(row)"
              :disabled="row.status==='resolved'"
            >
              <el-icon style="margin-right: 2px"><Upload /></el-icon>
              重新申报
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="detailVisible" title="异常详情" width="640px">
      <template v-if="currentException">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="申报单号">{{ currentException.declareNo }}</el-descriptions-item>
          <el-descriptions-item label="异常类型">
            <el-tag type="danger" size="small">{{ currentException.type }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <StatusTag :status="currentException.status" />
          </el-descriptions-item>
          <el-descriptions-item label="处理人">{{ currentException.handler || '-' }}</el-descriptions-item>
          <el-descriptions-item label="上报时间">{{ currentException.reportedAt }}</el-descriptions-item>
          <el-descriptions-item label="解决时间">{{ currentException.resolvedAt || '-' }}</el-descriptions-item>
          <el-descriptions-item label="异常描述" :span="2">{{ currentException.description }}</el-descriptions-item>
          <el-descriptions-item label="整改建议" :span="2">{{ currentException.suggestion }}</el-descriptions-item>
        </el-descriptions>
        <div style="margin-top: 16px; text-align: right">
          <el-button @click="detailVisible = false">关闭</el-button>
          <el-button
            type="primary"
            @click="openRedeclare(currentException); detailVisible = false"
            :disabled="currentException.status==='resolved'"
          >
            <el-icon style="margin-right: 4px"><Upload /></el-icon>
            重新申报
          </el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="handleVisible" title="处理异常" width="520px">
      <el-form label-position="top">
        <el-form-item label="整改意见" required>
          <el-input
            v-model="handleForm.suggestion"
            type="textarea"
            :rows="4"
            placeholder="请填写具体的整改要求和建议"
          />
        </el-form-item>
        <el-form-item label="需提交的材料/操作">
          <el-input
            v-model="handleForm.actions"
            type="textarea"
            :rows="3"
            placeholder="需企业补充提供的资料或执行的操作"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="handleVisible = false">取消</el-button>
        <el-button type="primary" @click="submitHandle">提交处理</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="redeclareVisible" title="重新申报" width="520px">
      <template v-if="currentException">
        <el-alert
          title="重新申报说明"
          type="info"
          :closable="false"
          style="margin-bottom: 16px"
        >
          <template #default>
            <p>• 重新申报后，原异常案件将标记为"已解决"</p>
            <p>• 新的申报单将进入审核流程，状态为"待审核"</p>
            <p>• 请确保已根据整改建议补充完整相关资料</p>
          </template>
        </el-alert>
        <el-form label-position="top">
          <el-form-item label="申报单号">
            <el-input :model-value="currentException.declareNo" disabled />
          </el-form-item>
          <el-form-item label="异常类型">
            <el-input :model-value="currentException.type" disabled />
          </el-form-item>
          <el-form-item label="整改备注">
            <el-input
              v-model="redeclareForm.remark"
              type="textarea"
              :rows="3"
              placeholder="请简要说明已完成的整改工作（选填）"
            />
          </el-form-item>
        </el-form>
      </template>
      <template #footer>
        <el-button @click="redeclareVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmRedeclare">
          <el-icon style="margin-right: 4px"><Upload /></el-icon>
          确认重新申报
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.page-container {
  padding: 20px;
  height: 100%;
  overflow: auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  .page-title {
    font-size: $font-size-xl;
    font-weight: 600;
    display: flex;
    align-items: center;
  }
}

.stat-mini {
  display: flex;
  align-items: center;
  gap: 16px;

  .stat-num {
    font-size: 24px;
    font-weight: 700;
    color: $text-primary;
    line-height: 1.2;
  }

  .stat-name {
    font-size: 13px;
    color: $text-secondary;
  }
}

.section-title {
  font-weight: 600;
  margin-bottom: 12px;
}
</style>
