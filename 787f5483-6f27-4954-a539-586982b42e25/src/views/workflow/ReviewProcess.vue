<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useWorkflowStore } from '@/stores/workflow'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import type { ReviewItem, ReviewRecord } from '@/types'
import { formatDate, formatRelativeTime } from '@/utils'
import { getReviewHistory, compareVersions, remindReviewer, submitReview } from '@/api/review'

const workflowStore = useWorkflowStore()

const loading = ref(false)
const page = ref(1)
const pageSize = ref(10)
const activeTab = ref('pending')
const reviewDialogVisible = ref(false)
const currentReviewItem = ref<ReviewItem | null>(null)
const historyDialogVisible = ref(false)
const reviewHistory = ref<ReviewRecord[]>([])
const compareDialogVisible = ref(false)
const compareContent = ref<{ version1: string; version2: string; diff: string } | null>(null)

const filters = reactive({
  type: undefined as ReviewItem['type'] | undefined,
  currentLevel: undefined as number | undefined
})

const reviewFormRef = ref<FormInstance>()
const reviewForm = reactive({
  level: 1 as 1 | 2 | 3,
  status: 'approved' as 'approved' | 'rejected',
  comment: '',
  version: ''
})

const reviewRules: FormRules = {
  comment: [
    { required: true, message: '请输入审核意见', trigger: 'blur' },
    { min: 5, max: 500, message: '审核意见长度为 5 到 500 个字符', trigger: 'blur' }
  ]
}

const typeOptions = [
  { value: 'topic', label: '选题' },
  { value: 'material', label: '素材' },
  { value: 'program', label: '节目' }
]

const levelOptions = [
  { value: 1, label: '初审' },
  { value: 2, label: '复审' },
  { value: 3, label: '终审' }
]

const statusMap: Record<string, { text: string; class: string }> = {
  pending: { text: '待审核', class: 'tag--warning' },
  reviewing: { text: '审核中', class: 'tag--primary' },
  approved: { text: '已通过', class: 'tag--success' },
  rejected: { text: '已退回', class: 'tag--danger' },
  completed: { text: '已完成', class: 'tag--success' }
}

const typeMap: Record<string, string> = {
  topic: '选题',
  material: '素材',
  program: '节目'
}

const tabItems = [
  { name: 'pending', label: '待我审核', status: 'pending' as const },
  { name: 'all', label: '全部审核', status: undefined }
]

const reviews = computed(() => {
  if (activeTab.value === 'pending') {
    return workflowStore.reviews.filter(r => 
      r.status === 'pending' || r.status === 'reviewing'
    )
  }
  return workflowStore.reviews
})

const total = computed(() => {
  if (activeTab.value === 'pending') {
    return reviews.value.length
  }
  return workflowStore.reviewsTotal
})

const levelProgress = computed(() => (item: ReviewItem) => {
  const completed = item.reviews.filter(r => r.status === 'approved').length
  return Math.round((completed / 3) * 100)
})

async function fetchData() {
  loading.value = true
  try {
    const status = activeTab.value === 'pending' ? 'pending' as const : undefined
    await workflowStore.fetchReviews({
      page: page.value,
      pageSize: pageSize.value,
      status,
      ...filters
    })
  } finally {
    loading.value = false
  }
}

function handleTabChange() {
  page.value = 1
  fetchData()
}

function openReviewDialog(item: ReviewItem) {
  currentReviewItem.value = item
  reviewForm.level = item.currentLevel
  reviewForm.status = 'approved'
  reviewForm.comment = ''
  reviewForm.version = ''
  reviewDialogVisible.value = true
}

async function handleSubmitReview() {
  if (!reviewFormRef.value || !currentReviewItem.value) return
  
  await reviewFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        await submitReview(currentReviewItem.value.id, reviewForm)
        ElMessage.success(`审核${reviewForm.status === 'approved' ? '通过' : '退回'}成功`)
        reviewDialogVisible.value = false
        await fetchData()
      } catch (error) {
        ElMessage.error('操作失败，请重试')
      }
    }
  })
}

async function viewHistory(item: ReviewItem) {
  reviewHistory.value = await getReviewHistory(item.id)
  historyDialogVisible.value = true
}

async function handleCompareVersions(item: ReviewItem) {
  const versions = item.reviews.filter(r => r.version).map(r => r.version!)
  if (versions.length < 2) {
    ElMessage.warning('需要至少两个版本才能进行对比')
    return
  }
  
  try {
    const { value: version1 } = await ElMessageBox.prompt('请选择要对比的版本1', '版本对比', {
      inputType: 'select',
      inputOptions: versions.map(v => ({ value: v, label: v }))
    })
    const { value: version2 } = await ElMessageBox.prompt('请选择要对比的版本2', '版本对比', {
      inputType: 'select',
      inputOptions: versions.filter(v => v !== version1).map(v => ({ value: v, label: v }))
    })
    
    const diff = await compareVersions(item.id, version1, version2)
    compareContent.value = {
      version1,
      version2,
      diff: diff as unknown as string
    }
    compareDialogVisible.value = true
  } catch {
    // 用户取消
  }
}

async function handleRemind(item: ReviewItem) {
  try {
    await ElMessageBox.confirm('是否发送提醒给审核人员？', '确认提醒', {
      type: 'warning'
    })
    await remindReviewer(item.id, 1)
    ElMessage.success('提醒已发送')
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
  <div class="page-container review-process">
    <div class="page-header">
      <div class="page-header__title">审核流程管理</div>
      <div class="page-header__actions">
        <el-tag type="warning" effect="dark">
          待审核: {{ workflowStore.reviews.filter(r => r.status === 'pending').length }}
        </el-tag>
      </div>
    </div>
    
    <div class="card filter-card">
      <el-form :model="filters" inline>
        <el-form-item label="类型">
          <el-select
            v-model="filters.type"
            placeholder="全部类型"
            clearable
            style="width: 140px"
          >
            <el-option
              v-for="item in typeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item label="审核级别">
          <el-select
            v-model="filters.currentLevel"
            placeholder="全部级别"
            clearable
            style="width: 140px"
          >
            <el-option
              v-for="item in levelOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item>
          <el-button type="primary" @click="fetchData">
            <el-icon><Search /></el-icon>搜索
          </el-button>
          <el-button @click="filters.type = undefined; filters.currentLevel = undefined; fetchData()">
            重置
          </el-button>
        </el-form-item>
      </el-form>
    </div>
    
    <div class="card">
      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane
          v-for="tab in tabItems"
          :key="tab.name"
          :label="tab.label"
          :name="tab.name"
        />
      </el-tabs>
      
      <el-table
        :data="reviews"
        v-loading="loading"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="title" label="标题" min-width="200" />
        
        <el-table-column prop="type" label="类型" width="80">
          <template #default="{ row }">
            <span class="tag tag--info">{{ typeMap[row.type] }}</span>
          </template>
        </el-table-column>
        
        <el-table-column label="审核进度" width="150">
          <template #default="{ row }">
            <div class="progress-wrapper">
              <el-steps :active="row.reviews.filter(r => r.status === 'approved').length" size="small" finish-status="success">
                <el-step title="初审" />
                <el-step title="复审" />
                <el-step title="终审" />
              </el-steps>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="currentLevel" label="当前级别" width="100">
          <template #default="{ row }">
            {{ levelOptions.find(l => l.value === row.currentLevel)?.label }}
          </template>
        </el-table-column>
        
        <el-table-column prop="submitterName" label="提交人" width="100" />
        
        <el-table-column prop="submittedAt" label="提交时间" width="160">
          <template #default="{ row }">
            {{ formatDate(row.submittedAt) }}
          </template>
        </el-table-column>
        
        <el-table-column label="超时提醒" width="100">
          <template #default="{ row }">
            <el-tag 
              v-if="Date.now() - new Date(row.submittedAt).getTime() > 24 * 3600 * 1000"
              type="danger" 
              size="small"
            >
              已超时
            </el-tag>
            <span v-else class="text-muted">{{ formatRelativeTime(row.submittedAt) }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <span class="tag" :class="statusMap[row.status].class">
              {{ statusMap[row.status].text }}
            </span>
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'pending' || row.status === 'reviewing'"
              type="primary"
              link
              size="small"
              @click="openReviewDialog(row)"
            >
              审核
            </el-button>
            <el-button link size="small" @click="viewHistory(row)">
              记录
            </el-button>
            <el-button link size="small" @click="handleCompareVersions(row)">
              对比
            </el-button>
            <el-button
              v-if="Date.now() - new Date(row.submittedAt).getTime() > 24 * 3600 * 1000"
              type="warning"
              link
              size="small"
              @click="handleRemind(row)"
            >
              催办
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
      v-model="reviewDialogVisible"
      title="审核处理"
      width="600px"
      :close-on-click-modal="false"
    >
      <div v-if="currentReviewItem" class="review-info">
        <div class="info-row">
          <span class="label">标题：</span>
          <span class="value">{{ currentReviewItem.title }}</span>
        </div>
        <div class="info-row">
          <span class="label">类型：</span>
          <span class="value">{{ typeMap[currentReviewItem.type] }}</span>
        </div>
        <div class="info-row">
          <span class="label">当前级别：</span>
          <span class="value">{{ levelOptions.find(l => l.value === currentReviewItem.currentLevel)?.label }}</span>
        </div>
      </div>
      
      <el-form
        ref="reviewFormRef"
        :model="reviewForm"
        :rules="reviewRules"
        label-width="100px"
        style="margin-top: 20px"
      >
        <el-form-item label="审核级别" prop="level">
          <el-select v-model="reviewForm.level" style="width: 100%">
            <el-option
              v-for="item in levelOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item label="审核结果" prop="status">
          <el-radio-group v-model="reviewForm.status">
            <el-radio-button value="approved">
              <el-icon><CircleCheck /></el-icon>通过
            </el-radio-button>
            <el-radio-button value="rejected">
              <el-icon><Close /></el-icon>退回修改
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
        
        <el-form-item label="版本号" prop="version">
          <el-input v-model="reviewForm.version" placeholder="如：v1.0.0" />
        </el-form-item>
        
        <el-form-item label="审核意见" prop="comment">
          <el-input
            v-model="reviewForm.comment"
            type="textarea"
            :rows="4"
            placeholder="请输入详细的审核意见..."
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="reviewDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmitReview">
          确认{{ reviewForm.status === 'approved' ? '通过' : '退回' }}
        </el-button>
      </template>
    </el-dialog>
    
    <el-dialog
      v-model="historyDialogVisible"
      title="审核历史"
      width="700px"
    >
      <el-timeline v-if="reviewHistory.length > 0">
        <el-timeline-item
          v-for="(record, index) in reviewHistory"
          :key="record.id"
          :timestamp="formatDate(record.reviewedAt)"
          :color="record.status === 'approved' ? '#67c23a' : '#f56c6c'"
        >
          <div class="history-item">
            <div class="history-header">
              <span class="level">{{ levelOptions.find(l => l.value === record.level)?.label }}</span>
              <span class="result" :class="record.status">
                {{ record.status === 'approved' ? '通过' : '退回' }}
              </span>
              <span v-if="record.version" class="version">版本: {{ record.version }}</span>
            </div>
            <div class="history-content">
              <p>{{ record.comment }}</p>
            </div>
            <div class="history-footer">
              <span>{{ record.reviewerName }}</span>
              <span>{{ formatRelativeTime(record.reviewedAt) }}</span>
            </div>
          </div>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-else description="暂无审核记录" />
    </el-dialog>
    
    <el-dialog
      v-model="compareDialogVisible"
      title="版本对比"
      width="900px"
    >
      <div v-if="compareContent" class="compare-content">
        <div class="compare-versions">
          <el-tag type="info">{{ compareContent.version1 }}</el-tag>
          <el-icon><ArrowRight /></el-icon>
          <el-tag type="primary">{{ compareContent.version2 }}</el-tag>
        </div>
        <div class="diff-content">
          <pre>{{ compareContent.diff || '版本差异内容展示区域' }}</pre>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.review-process {
  .filter-card {
    margin-bottom: 16px;
  }
  
  .progress-wrapper {
    padding: 8px 0;
    
    :deep(.el-step__title) {
      font-size: 11px;
      color: var(--text-color-secondary);
    }
    
    :deep(.el-step.is-process .el-step__title) {
      color: var(--primary-color);
    }
  }
  
  .pagination {
    display: flex;
    justify-content: flex-end;
    margin-top: 20px;
  }
  
  .review-info {
    padding: 16px;
    background-color: var(--bg-color-secondary);
    border-radius: var(--border-radius-sm);
  }
  
  .info-row {
    display: flex;
    margin-bottom: 8px;
    
    &:last-child {
      margin-bottom: 0;
    }
    
    .label {
      width: 80px;
      color: var(--text-color-tertiary);
    }
    
    .value {
      flex: 1;
      color: var(--text-color-primary);
    }
  }
  
  .history-item {
    .history-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
      
      .level {
        font-size: 13px;
        font-weight: 500;
        color: var(--text-color-primary);
      }
      
      .result {
        font-size: 12px;
        padding: 2px 8px;
        border-radius: 4px;
        
        &.approved {
          background-color: rgba(103, 194, 58, 0.1);
          color: var(--success-color);
        }
        
        &.rejected {
          background-color: rgba(245, 108, 108, 0.1);
          color: var(--danger-color);
        }
      }
      
      .version {
        font-size: 12px;
        color: var(--text-color-tertiary);
      }
    }
    
    .history-content {
      p {
        font-size: 13px;
        color: var(--text-color-secondary);
        line-height: 1.6;
        margin: 0;
      }
    }
    
    .history-footer {
      display: flex;
      justify-content: space-between;
      margin-top: 8px;
      font-size: 11px;
      color: var(--text-color-tertiary);
    }
  }
  
  .compare-content {
    .compare-versions {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    
    .diff-content {
      pre {
        padding: 16px;
        background-color: var(--bg-color-secondary);
        border-radius: var(--border-radius-sm);
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: 12px;
        line-height: 1.6;
        color: var(--text-color-secondary);
        max-height: 400px;
        overflow: auto;
      }
    }
  }
}
</style>
