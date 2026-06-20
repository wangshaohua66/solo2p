<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkflowStore } from '@/stores/workflow'
import { useUserStore } from '@/stores/user'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import type { Topic, TopicStatus } from '@/types'
import { formatDate, formatDuration } from '@/utils'

const router = useRouter()
const workflowStore = useWorkflowStore()
const userStore = useUserStore()

const createDialogVisible = ref(false)
const formRef = ref<FormInstance>()
const loading = ref(false)
const page = ref(1)
const pageSize = ref(10)

const filters = reactive({
  status: undefined as TopicStatus | undefined,
  programType: undefined as string | undefined,
  channel: undefined as string | undefined,
  keyword: ''
})

const form = reactive({
  title: '',
  description: '',
  duration: 30,
  expectedAirDate: '',
  programType: 'news' as 'news' | 'feature' | 'variety' | 'drama',
  channel: 'news' as 'news' | 'city' | 'public',
  interviewee: '',
  location: ''
})

const rules: FormRules = {
  title: [
    { required: true, message: '请输入选题标题', trigger: 'blur' },
    { min: 2, max: 100, message: '标题长度为 2 到 100 个字符', trigger: 'blur' }
  ],
  description: [
    { required: true, message: '请输入内容简介', trigger: 'blur' },
    { min: 10, max: 1000, message: '内容简介长度为 10 到 1000 个字符', trigger: 'blur' }
  ],
  duration: [
    { required: true, message: '请输入计划时长', trigger: 'blur' },
    { type: 'number', min: 1, max: 300, message: '时长必须在 1 到 300 分钟之间', trigger: 'blur' }
  ],
  expectedAirDate: [
    { required: true, message: '请选择预期播出日期', trigger: 'change' }
  ],
  programType: [
    { required: true, message: '请选择节目类型', trigger: 'change' }
  ],
  channel: [
    { required: true, message: '请选择频道', trigger: 'change' }
  ],
  location: [
    { required: true, message: '请输入采访地点', trigger: 'blur' }
  ]
}

const statusOptions = [
  { value: 'draft', label: '草稿' },
  { value: 'submitted', label: '已提交' },
  { value: 'reviewing', label: '审核中' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已退回' },
  { value: 'in_production', label: '制作中' },
  { value: 'completed', label: '已完成' },
  { value: 'archived', label: '已归档' }
]

const programTypeOptions = [
  { value: 'news', label: '新闻' },
  { value: 'feature', label: '专题' },
  { value: 'variety', label: '综艺' },
  { value: 'drama', label: '电视剧' }
]

const channelOptions = [
  { value: 'news', label: '新闻综合频道' },
  { value: 'city', label: '都市生活频道' },
  { value: 'public', label: '公共频道' }
]

const statusMap: Record<string, { text: string; class: string }> = {
  draft: { text: '草稿', class: 'tag--info' },
  submitted: { text: '已提交', class: 'tag--primary' },
  reviewing: { text: '审核中', class: 'tag--warning' },
  approved: { text: '已通过', class: 'tag--success' },
  rejected: { text: '已退回', class: 'tag--danger' },
  in_production: { text: '制作中', class: 'tag--primary' },
  completed: { text: '已完成', class: 'tag--success' },
  archived: { text: '已归档', class: 'tag--info' }
}

const topics = computed(() => workflowStore.topics)
const total = computed(() => workflowStore.topicsTotal)

async function fetchData() {
  loading.value = true
  try {
    await workflowStore.fetchTopics({
      page: page.value,
      pageSize: pageSize.value,
      ...filters
    })
  } finally {
    loading.value = false
  }
}

async function handleSearch() {
  page.value = 1
  await fetchData()
}

async function handleReset() {
  filters.status = undefined
  filters.programType = undefined
  filters.channel = undefined
  filters.keyword = ''
  page.value = 1
  await fetchData()
}

function openCreateDialog() {
  Object.assign(form, {
    title: '',
    description: '',
    duration: 30,
    expectedAirDate: '',
    programType: 'news' as const,
    channel: 'news' as const,
    interviewee: '',
    location: ''
  })
  createDialogVisible.value = true
}

async function handleCreate() {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (valid) {
      try {
        const newTopic = await workflowStore.createNewTopic({
          ...form,
          creatorId: userStore.userInfo?.id || 1,
          creatorName: userStore.userInfo?.name || '未知用户'
        })
        ElMessage.success('选题创建成功')
        createDialogVisible.value = false
        router.push(`/topics/${newTopic.id}`)
      } catch (error) {
        ElMessage.error('创建失败，请重试')
      }
    }
  })
}

async function handleSubmit(topic: Topic) {
  try {
    await ElMessageBox.confirm('确认提交该选题进行审核吗？', '确认提交', {
      type: 'warning'
    })
    await workflowStore.submitTopicForReview(topic.id)
    ElMessage.success('提交成功')
    await fetchData()
  } catch {
    // 用户取消
  }
}

async function handleDelete(topic: Topic) {
  try {
    await ElMessageBox.confirm(`确认删除选题"${topic.title}"吗？此操作不可恢复。`, '确认删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
    ElMessage.success('删除成功')
    await fetchData()
  } catch {
    // 用户取消
  }
}

function handleView(topic: Topic) {
  router.push(`/topics/${topic.id}`)
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
  <div class="page-container topic-planning">
    <div class="page-header">
      <div class="page-header__title">选题策划管理</div>
      <div class="page-header__actions">
        <el-button type="primary" @click="openCreateDialog">
          <el-icon><Plus /></el-icon>新建选题
        </el-button>
      </div>
    </div>
    
    <div class="card filter-card">
      <el-form :model="filters" inline>
        <el-form-item label="状态">
          <el-select
            v-model="filters.status"
            placeholder="全部状态"
            clearable
            style="width: 140px"
          >
            <el-option
              v-for="item in statusOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item label="类型">
          <el-select
            v-model="filters.programType"
            placeholder="全部类型"
            clearable
            style="width: 140px"
          >
            <el-option
              v-for="item in programTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item label="频道">
          <el-select
            v-model="filters.channel"
            placeholder="全部频道"
            clearable
            style="width: 160px"
          >
            <el-option
              v-for="item in channelOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item label="关键词">
          <el-input
            v-model="filters.keyword"
            placeholder="搜索标题、内容"
            clearable
            style="width: 200px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        
        <el-form-item>
          <el-button type="primary" @click="handleSearch">
            <el-icon><Search /></el-icon>搜索
          </el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </div>
    
    <div class="card">
      <el-table
        :data="topics"
        v-loading="loading"
        stripe
        style="width: 100%"
        @row-dblclick="handleView"
      >
        <el-table-column type="selection" width="55" />
        
        <el-table-column prop="title" label="选题标题" min-width="200">
          <template #default="{ row }">
            <div class="topic-title-cell" @click="handleView(row)">
              {{ row.title }}
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="programType" label="类型" width="80">
          <template #default="{ row }">
            <span
              class="tag"
              :class="{
                'tag--primary': row.programType === 'news',
                'tag--success': row.programType === 'feature',
                'tag--warning': row.programType === 'variety',
                'tag--danger': row.programType === 'drama'
              }"
            >
              {{ programTypeOptions.find(o => o.value === row.programType)?.label }}
            </span>
          </template>
        </el-table-column>
        
        <el-table-column prop="channel" label="频道" width="120">
          <template #default="{ row }">
            {{ channelOptions.find(o => o.value === row.channel)?.label }}
          </template>
        </el-table-column>
        
        <el-table-column prop="duration" label="时长" width="100">
          <template #default="{ row }">
            {{ formatDuration(row.duration * 60) }}
          </template>
        </el-table-column>
        
        <el-table-column prop="expectedAirDate" label="预计播出" width="120">
          <template #default="{ row }">
            {{ formatDate(row.expectedAirDate, 'YYYY-MM-DD') }}
          </template>
        </el-table-column>
        
        <el-table-column prop="creatorName" label="创建人" width="100" />
        
        <el-table-column prop="createdAt" label="创建时间" width="160">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
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
              查看
            </el-button>
            <el-button
              v-if="row.status === 'draft'"
              type="primary"
              link
              size="small"
              @click="handleSubmit(row)"
            >
              提交
            </el-button>
            <el-button
              v-if="row.status === 'draft'"
              type="danger"
              link
              size="small"
              @click="handleDelete(row)"
            >
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
      title="新建选题"
      width="700px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
      >
        <el-form-item label="选题标题" prop="title">
          <el-input
            v-model="form.title"
            placeholder="请输入选题标题"
            maxlength="100"
            show-word-limit
          />
        </el-form-item>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="节目类型" prop="programType">
              <el-select v-model="form.programType" placeholder="请选择" style="width: 100%">
                <el-option
                  v-for="item in programTypeOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="播出频道" prop="channel">
              <el-select v-model="form.channel" placeholder="请选择" style="width: 100%">
                <el-option
                  v-for="item in channelOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="计划时长" prop="duration">
              <el-input-number
                v-model="form.duration"
                :min="1"
                :max="300"
                :step="5"
                placeholder="分钟"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="预计播出" prop="expectedAirDate">
              <el-date-picker
                v-model="form.expectedAirDate"
                type="date"
                placeholder="选择日期"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="采访对象" prop="interviewee">
              <el-input v-model="form.interviewee" placeholder="请输入采访对象" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="采访地点" prop="location">
              <el-input v-model="form.location" placeholder="请输入采访地点" />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-form-item label="内容简介" prop="description">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="4"
            placeholder="请详细描述选题内容"
            maxlength="1000"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreate">创建选题</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.topic-planning {
  .filter-card {
    margin-bottom: 16px;
  }
  
  .topic-title-cell {
    cursor: pointer;
    color: var(--primary-color);
    
    &:hover {
      text-decoration: underline;
    }
  }
  
  .pagination {
    display: flex;
    justify-content: flex-end;
    margin-top: 20px;
  }
}

@media (max-width: 768px) {
  .topic-planning {
    .filter-card {
      :deep(.el-form-item) {
        display: block;
        width: 100%;
        margin-right: 0;
        
        .el-form-item__label {
          width: 80px !important;
        }
        
        .el-select,
        .el-input {
          width: 100% !important;
        }
      }
    }
  }
}
</style>
