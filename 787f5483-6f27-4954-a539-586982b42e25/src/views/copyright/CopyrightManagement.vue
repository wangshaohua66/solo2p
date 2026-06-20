<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import type { Copyright } from '@/types'
import { formatDate } from '@/utils'
import { getCopyrightList, getCopyrightDetail, createCopyright, updateCopyright, deleteCopyright, getExpiringCopyrights, getCopyrightStats } from '@/api/statistics'

const loading = ref(false)
const page = ref(1)
const pageSize = ref(10)
const createDialogVisible = ref(false)
const detailDialogVisible = ref(false)
const currentCopyright = ref<Copyright | null>(null)
const formRef = ref<FormInstance>()

const filters = reactive({
  status: undefined as Copyright['status'] | undefined,
  keyword: ''
})

const form = reactive({
  name: '',
  type: '',
  owner: '',
  authorizationScope: '',
  startDate: '',
  endDate: '',
  cost: 0,
  materialIds: [] as number[]
})

const rules: FormRules = {
  name: [
    { required: true, message: '请输入版权名称', trigger: 'blur' }
  ],
  type: [
    { required: true, message: '请选择版权类型', trigger: 'change' }
  ],
  owner: [
    { required: true, message: '请输入版权方', trigger: 'blur' }
  ],
  startDate: [
    { required: true, message: '请选择授权开始日期', trigger: 'change' }
  ],
  endDate: [
    { required: true, message: '请选择授权结束日期', trigger: 'change' }
  ]
}

const typeOptions = [
  { value: 'video', label: '视频' },
  { value: 'audio', label: '音频' },
  { value: 'image', label: '图片' },
  { value: 'music', label: '音乐' },
  { value: 'literature', label: '文字' },
  { value: 'other', label: '其他' }
]

const statusMap: Record<string, { text: string; class: string }> = {
  active: { text: '有效', class: 'tag--success' },
  expiring: { text: '即将到期', class: 'tag--warning' },
  expired: { text: '已过期', class: 'tag--danger' }
}

const mockData = ref<Copyright[]>([])
const total = ref(0)
const stats = ref({
  total: 0,
  active: 0,
  expiring: 0,
  expired: 0,
  totalCost: 0
})
const expiringList = ref<Copyright[]>([])

const copyrights = computed(() => mockData.value)

function generateMockData(): Copyright[] {
  return [
    { id: 1, name: '春节特别节目背景音乐', type: 'music', owner: '中国音乐著作权协会', authorizationScope: '全国范围，电视播出', startDate: '2024-01-01', endDate: '2024-12-31', cost: 50000, materialIds: [1, 2], status: 'active', createdAt: '2024-01-01T00:00:00Z' },
    { id: 2, name: '城市宣传片素材包', type: 'video', owner: '某影视公司', authorizationScope: '本台播出，不包含网络传播', startDate: '2024-03-01', endDate: '2024-06-30', cost: 120000, materialIds: [3, 4, 5], status: 'expiring', createdAt: '2024-02-15T00:00:00Z' },
    { id: 3, name: '新闻联播片头片尾', type: 'video', owner: '央视国际', authorizationScope: '新闻类节目使用', startDate: '2023-01-01', endDate: '2025-12-31', cost: 200000, materialIds: [6], status: 'active', createdAt: '2022-12-01T00:00:00Z' },
    { id: 4, name: '经典电视剧集播映权', type: 'video', owner: '某影视集团', authorizationScope: '黄金时段播出，限5次', startDate: '2024-01-01', endDate: '2024-05-31', cost: 500000, materialIds: [7, 8, 9, 10], status: 'expired', createdAt: '2023-11-01T00:00:00Z' },
    { id: 5, name: '天气预报背景音乐', type: 'music', owner: '环球音乐', authorizationScope: '天气预报节目专用', startDate: '2024-01-01', endDate: '2024-12-31', cost: 30000, materialIds: [11], status: 'active', createdAt: '2023-12-20T00:00:00Z' }
  ]
}

async function fetchData() {
  loading.value = true
  try {
    mockData.value = generateMockData()
    total.value = mockData.value.length
    stats.value = {
      total: mockData.value.length,
      active: mockData.value.filter(c => c.status === 'active').length,
      expiring: mockData.value.filter(c => c.status === 'expiring').length,
      expired: mockData.value.filter(c => c.status === 'expired').length,
      totalCost: mockData.value.reduce((sum, c) => sum + c.cost, 0)
    }
    expiringList.value = mockData.value.filter(c => c.status === 'expiring')
  } finally {
    loading.value = false
  }
}

async function handleSearch() {
  page.value = 1
  await fetchData()
}

function openCreateDialog() {
  Object.assign(form, {
    name: '',
    type: '',
    owner: '',
    authorizationScope: '',
    startDate: '',
    endDate: '',
    cost: 0,
    materialIds: []
  })
  createDialogVisible.value = true
}

async function handleCreate() {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (valid) {
      try {
        const newItem: Copyright = {
          ...form,
          id: Date.now(),
          status: calculateStatus(form.startDate, form.endDate),
          createdAt: new Date().toISOString()
        }
        mockData.value.unshift(newItem)
        total.value++
        ElMessage.success('版权信息创建成功')
        createDialogVisible.value = false
        await fetchData()
      } catch (error) {
        ElMessage.error('创建失败')
      }
    }
  })
}

function calculateStatus(startDate: string, endDate: string): Copyright['status'] {
  const now = new Date()
  const end = new Date(endDate)
  const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diffDays <= 0) return 'expired'
  if (diffDays <= 7) return 'expiring'
  return 'active'
}

async function handleDelete(item: Copyright) {
  try {
    await ElMessageBox.confirm(`确认删除版权"${item.name}"吗？`, '确认删除', {
      type: 'warning'
    })
    mockData.value = mockData.value.filter(c => c.id !== item.id)
    total.value--
    ElMessage.success('删除成功')
  } catch {
    // 用户取消
  }
}

function handleView(item: Copyright) {
  currentCopyright.value = item
  detailDialogVisible.value = true
}

async function handleRenew(item: Copyright) {
  try {
    const { value: newEndDate } = await ElMessageBox.prompt(
      `请输入新的授权结束日期 (当前到期: ${formatDate(item.endDate, 'YYYY-MM-DD')})`,
      '续期操作',
      {
        confirmButtonText: '确认续期',
        cancelButtonText: '取消',
        inputType: 'date',
        inputPattern: /^\d{4}-\d{2}-\d{2}$/,
        inputErrorMessage: '请输入正确的日期格式 YYYY-MM-DD'
      }
    )
    
    const index = mockData.value.findIndex(c => c.id === item.id)
    if (index !== -1) {
      mockData.value[index].endDate = newEndDate
      mockData.value[index].status = calculateStatus(mockData.value[index].startDate, newEndDate)
    }
    ElMessage.success('续期成功')
    await fetchData()
  } catch {
    // 用户取消
  }
}

function handleSizeChange(size: number) {
  pageSize.value = size
  page.value = 1
  fetchData()
}

function handlePageChange(p: number) {
  page.value = p
  fetchData()
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="page-container copyright-management">
    <div class="page-header">
      <div class="page-header__title">版权资产管理</div>
      <div class="page-header__actions">
        <el-button type="primary" @click="openCreateDialog">
          <el-icon><Plus /></el-icon>登记版权
        </el-button>
      </div>
    </div>
    
    <el-row :gutter="16" class="stats-row">
      <el-col :xs="12" :sm="6">
        <div class="stat-card">
          <div class="stat-icon icon-blue">
            <el-icon :size="24"><Collection /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.total }}</div>
            <div class="stat-label">版权总数</div>
          </div>
        </div>
      </el-col>
      <el-col :xs="12" :sm="6">
        <div class="stat-card">
          <div class="stat-icon icon-success">
            <el-icon :size="24"><CircleCheck /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.active }}</div>
            <div class="stat-label">有效版权</div>
          </div>
        </div>
      </el-col>
      <el-col :xs="12" :sm="6">
        <div class="stat-card">
          <div class="stat-icon icon-warning">
            <el-icon :size="24"><Warning /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.expiring }}</div>
            <div class="stat-label">即将到期</div>
          </div>
        </div>
      </el-col>
      <el-col :xs="12" :sm="6">
        <div class="stat-card">
          <div class="stat-icon icon-danger">
            <el-icon :size="24"><Money /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">¥{{ (stats.totalCost / 10000).toFixed(1) }}万</div>
            <div class="stat-label">版权总费用</div>
          </div>
        </div>
      </el-col>
    </el-row>
    
    <el-alert
      v-if="expiringList.length > 0"
      :title="`有 ${expiringList.length} 项版权将在7天内到期，请及时处理`"
      type="warning"
      show-icon
      :closable="false"
      style="margin-bottom: 16px"
    >
      <template #default>
        <div class="expiring-list">
          <div
            v-for="item in expiringList"
            :key="item.id"
            class="expiring-item"
            @click="handleView(item)"
          >
            <span class="name">{{ item.name }}</span>
            <span class="date">到期: {{ formatDate(item.endDate, 'YYYY-MM-DD') }}</span>
            <el-button type="primary" size="small" @click.stop="handleRenew(item)">
              立即续期
            </el-button>
          </div>
        </div>
      </template>
    </el-alert>
    
    <div class="card filter-card">
      <el-form :model="filters" inline>
        <el-form-item label="状态">
          <el-select
            v-model="filters.status"
            placeholder="全部状态"
            clearable
            style="width: 140px"
          >
            <el-option value="active" label="有效" />
            <el-option value="expiring" label="即将到期" />
            <el-option value="expired" label="已过期" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="关键词">
          <el-input
            v-model="filters.keyword"
            placeholder="搜索版权名称、版权方"
            clearable
            style="width: 200px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        
        <el-form-item>
          <el-button type="primary" @click="handleSearch">
            <el-icon><Search /></el-icon>搜索
          </el-button>
          <el-button @click="filters.status = undefined; filters.keyword = ''; fetchData()">
            重置
          </el-button>
        </el-form-item>
      </el-form>
    </div>
    
    <div class="card">
      <el-table
        :data="copyrights"
        v-loading="loading"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="name" label="版权名称" min-width="180" />
        
        <el-table-column prop="type" label="类型" width="80">
          <template #default="{ row }">
            {{ typeOptions.find(o => o.value === row.type)?.label }}
          </template>
        </el-table-column>
        
        <el-table-column prop="owner" label="版权方" min-width="140" />
        
        <el-table-column label="授权期限" width="220">
          <template #default="{ row }">
            {{ formatDate(row.startDate, 'YYYY-MM-DD') }} 至 {{ formatDate(row.endDate, 'YYYY-MM-DD') }}
          </template>
        </el-table-column>
        
        <el-table-column prop="cost" label="授权费用" width="120">
          <template #default="{ row }">
            ¥{{ row.cost.toLocaleString() }}
          </template>
        </el-table-column>
        
        <el-table-column prop="materialIds" label="关联素材" width="100">
          <template #default="{ row }">
            {{ row.materialIds.length }} 个
          </template>
        </el-table-column>
        
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <span class="tag" :class="statusMap[row.status].class">
              {{ statusMap[row.status].text }}
            </span>
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleView(row)">
              详情
            </el-button>
            <el-button
              v-if="row.status !== 'expired'"
              type="success"
              link
              size="small"
              @click="handleRenew(row)"
            >
              续期
            </el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      
      <div class="pagination">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </div>
    
    <el-dialog
      v-model="createDialogVisible"
      title="版权登记"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="110px"
      >
        <el-form-item label="版权名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入版权名称" />
        </el-form-item>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="版权类型" prop="type">
              <el-select v-model="form.type" placeholder="请选择" style="width: 100%">
                <el-option
                  v-for="item in typeOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="版权方" prop="owner">
              <el-input v-model="form.owner" placeholder="请输入版权方" />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="开始日期" prop="startDate">
              <el-date-picker
                v-model="form.startDate"
                type="date"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="结束日期" prop="endDate">
              <el-date-picker
                v-model="form.endDate"
                type="date"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-form-item label="授权范围" prop="authorizationScope">
          <el-input
            v-model="form.authorizationScope"
            type="textarea"
            :rows="2"
            placeholder="请描述授权使用范围"
          />
        </el-form-item>
        
        <el-form-item label="授权费用" prop="cost">
          <el-input-number
            v-model="form.cost"
            :min="0"
            :step="1000"
            style="width: 200px"
          />
          <span style="margin-left: 8px; color: var(--text-color-tertiary)">元</span>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreate">登记</el-button>
      </template>
    </el-dialog>
    
    <el-dialog
      v-model="detailDialogVisible"
      title="版权详情"
      width="600px"
    >
      <div v-if="currentCopyright" class="detail-content">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="版权名称" :span="2">
            {{ currentCopyright.name }}
          </el-descriptions-item>
          <el-descriptions-item label="版权类型">
            {{ typeOptions.find(o => o.value === currentCopyright.type)?.label }}
          </el-descriptions-item>
          <el-descriptions-item label="版权方">
            {{ currentCopyright.owner }}
          </el-descriptions-item>
          <el-descriptions-item label="授权开始">
            {{ formatDate(currentCopyright.startDate, 'YYYY-MM-DD') }}
          </el-descriptions-item>
          <el-descriptions-item label="授权结束">
            {{ formatDate(currentCopyright.endDate, 'YYYY-MM-DD') }}
          </el-descriptions-item>
          <el-descriptions-item label="授权费用">
            ¥{{ currentCopyright.cost.toLocaleString() }}
          </el-descriptions-item>
          <el-descriptions-item label="当前状态">
            <span class="tag" :class="statusMap[currentCopyright.status].class">
              {{ statusMap[currentCopyright.status].text }}
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="关联素材">
            {{ currentCopyright.materialIds.length }} 个
          </el-descriptions-item>
          <el-descriptions-item label="授权范围" :span="2">
            {{ currentCopyright.authorizationScope }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.copyright-management {
  .stats-row {
    margin-bottom: 16px;
  }
  
  .stat-card {
    display: flex;
    align-items: center;
    padding: 16px;
    background-color: var(--bg-color-card);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-md);
  }
  
  .stat-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: var(--border-radius-sm);
    margin-right: 12px;
    color: #fff;
    
    &.icon-blue {
      background: linear-gradient(135deg, #667eea 0%, #409eff 100%);
    }
    
    &.icon-success {
      background: linear-gradient(135deg, #43e97b 0%, #67c23a 100%);
    }
    
    &.icon-warning {
      background: linear-gradient(135deg, #f093fb 0%, #e6a23c 100%);
    }
    
    &.icon-danger {
      background: linear-gradient(135deg, #fa709a 0%, #f56c6c 100%);
    }
  }
  
  .stat-value {
    font-size: 24px;
    font-weight: 600;
    color: var(--text-color-primary);
    line-height: 1.2;
  }
  
  .stat-label {
    font-size: 12px;
    color: var(--text-color-secondary);
    margin-top: 4px;
  }
  
  .expiring-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
  }
  
  .expiring-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background-color: rgba(230, 162, 60, 0.1);
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    
    .name {
      font-weight: 500;
      color: var(--text-color-primary);
    }
    
    .date {
      flex: 1;
      margin-left: 16px;
      font-size: 13px;
      color: var(--warning-color);
    }
  }
  
  .filter-card {
    margin-bottom: 16px;
  }
  
  .pagination {
    display: flex;
    justify-content: flex-end;
    margin-top: 20px;
  }
  
  .detail-content {
    :deep(.el-descriptions__label) {
      width: 120px;
      color: var(--text-color-tertiary);
    }
    
    :deep(.el-descriptions__content) {
      color: var(--text-color-primary);
    }
  }
}
</style>
