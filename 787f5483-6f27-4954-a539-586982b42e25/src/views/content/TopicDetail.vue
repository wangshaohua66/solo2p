<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWorkflowStore } from '@/stores/workflow'
import { useUserStore } from '@/stores/user'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import type { Topic, TopicLog, Task } from '@/types'
import { formatDate, formatDuration, formatRelativeTime } from '@/utils'
import { getTopicLogs, getTopicTasks, updateTaskStatus, assignTask, reviewTopic } from '@/api/topic'

const route = useRoute()
const router = useRouter()
const workflowStore = useWorkflowStore()
const userStore = useUserStore()

const topicId = computed(() => Number(route.params.id))
const topic = computed(() => workflowStore.currentTopic)
const loading = ref(false)
const logs = ref<TopicLog[]>([])
const tasks = ref<Task[]>([])
const activeTab = ref('info')
const reviewDialogVisible = ref(false)
const reviewFormRef = ref<FormInstance>()

const reviewForm = reactive({
  status: 'approved' as 'approved' | 'rejected',
  remark: ''
})

const reviewRules: FormRules = {
  remark: [
    { required: true, message: '请输入审核意见', trigger: 'blur' },
    { min: 5, max: 500, message: '审核意见长度为 5 到 500 个字符', trigger: 'blur' }
  ]
}

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

const programTypeMap: Record<string, string> = {
  news: '新闻',
  feature: '专题',
  variety: '综艺',
  drama: '电视剧'
}

const channelMap: Record<string, string> = {
  news: '新闻综合频道',
  city: '都市生活频道',
  public: '公共频道'
}

const taskTypeMap: Record<string, string> = {
  collection: '素材采集',
  script: '脚本撰写',
  editing: '后期编辑',
  review: '审核'
}

const taskStatusMap: Record<string, { text: string; class: string }> = {
  pending: { text: '待处理', class: 'tag--info' },
  in_progress: { text: '进行中', class: 'tag--warning' },
  completed: { text: '已完成', class: 'tag--success' },
  rejected: { text: '已拒绝', class: 'tag--danger' }
}

const teamMembers = [
  { id: 1, name: '张三', role: '记者', department: '新闻中心' },
  { id: 2, name: '李四', role: '编辑', department: '总编室' },
  { id: 3, name: '王五', role: '摄像', department: '技术部' },
  { id: 4, name: '赵六', role: '主持人', department: '播音部' },
  { id: 5, name: '钱七', role: '审核员', department: '审核部' }
]

async function loadTopicDetail() {
  loading.value = true
  try {
    await workflowStore.fetchTopicDetail(topicId.value)
    logs.value = await getTopicLogs(topicId.value)
    tasks.value = await getTopicTasks(topicId.value)
  } finally {
    loading.value = false
  }
}

function handleBack() {
  workflowStore.clearCurrentTopic()
  router.back()
}

function handleEdit() {
  ElMessage.info('编辑功能开发中')
}

async function handleSubmit() {
  try {
    await ElMessageBox.confirm('确认提交该选题进行审核吗？', '确认提交', {
      type: 'warning'
    })
    await workflowStore.submitTopicForReview(topicId.value)
    ElMessage.success('提交成功')
    await loadTopicDetail()
  } catch {
    // 用户取消
  }
}

function openReviewDialog() {
  reviewForm.status = 'approved'
  reviewForm.remark = ''
  reviewDialogVisible.value = true
}

async function handleReview() {
  if (!reviewFormRef.value) return
  
  await reviewFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        await reviewTopic(topicId.value, reviewForm)
        ElMessage.success(`审核${reviewForm.status === 'approved' ? '通过' : '退回'}成功`)
        reviewDialogVisible.value = false
        await loadTopicDetail()
      } catch (error) {
        ElMessage.error('操作失败，请重试')
      }
    }
  })
}

async function handleTaskStatusChange(task: Task, status: Task['status']) {
  try {
    await updateTaskStatus(task.id, status)
    ElMessage.success('状态更新成功')
    tasks.value = await getTopicTasks(topicId.value)
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

async function handleAssignTask(task: Task) {
  try {
    const { value: userId } = await ElMessageBox.prompt('请选择任务负责人', '分配任务', {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      inputType: 'select',
      inputPattern: /.+/,
      inputErrorMessage: '请选择负责人',
      inputOptions: teamMembers.map(m => ({ value: m.id, label: `${m.name} (${m.role})` }))
    })
    await assignTask(task.id, Number(userId))
    ElMessage.success('分配成功')
    tasks.value = await getTopicTasks(topicId.value)
  } catch {
    // 用户取消
  }
}

const timelineItems = computed(() => {
  return logs.value.map(log => ({
    timestamp: log.createdAt,
    title: log.action,
    color: log.action.includes('通过') ? '#67c23a' : 
           log.action.includes('退回') || log.action.includes('拒绝') ? '#f56c6c' : 
           log.action.includes('提交') ? '#409eff' : '#909399',
    description: `${log.operatorName} · ${log.remark || '无备注'}`
  })).reverse()
})

onMounted(() => {
  loadTopicDetail()
})
</script>

<template>
  <div class="page-container topic-detail" v-loading="loading">
    <div v-if="topic" class="topic-content">
      <div class="detail-header">
        <div class="header-left">
          <el-button @click="handleBack">
            <el-icon><ArrowLeft /></el-icon>返回
          </el-button>
          <h1 class="topic-title">{{ topic.title }}</h1>
          <span class="tag" :class="statusMap[topic.status].class">
            {{ statusMap[topic.status].text }}
          </span>
        </div>
        <div class="header-right">
          <el-button v-if="topic.status === 'draft'" @click="handleEdit">
            <el-icon><Edit /></el-icon>编辑
          </el-button>
          <el-button v-if="topic.status === 'draft'" type="primary" @click="handleSubmit">
            <el-icon><Check /></el-icon>提交审核
          </el-button>
          <el-button 
            v-if="topic.status === 'submitted' || topic.status === 'reviewing'"
            type="primary" 
            @click="openReviewDialog"
          >
            <el-icon><CircleCheck /></el-icon>审核
          </el-button>
        </div>
      </div>
      
      <el-tabs v-model="activeTab" class="detail-tabs">
        <el-tab-pane label="基本信息" name="info">
          <el-row :gutter="24">
            <el-col :lg="16" :md="24">
              <div class="card">
                <div class="section-title">内容简介</div>
                <p class="description">{{ topic.description }}</p>
                
                <el-divider />
                
                <div class="info-grid">
                  <div class="info-item">
                    <span class="label">节目类型</span>
                    <span class="value">
                      <span class="tag" :class="topic.programType === 'news' ? 'tag--primary' : topic.programType === 'feature' ? 'tag--success' : topic.programType === 'variety' ? 'tag--warning' : 'tag--danger'">
                        {{ programTypeMap[topic.programType] }}
                      </span>
                    </span>
                  </div>
                  <div class="info-item">
                    <span class="label">播出频道</span>
                    <span class="value">{{ channelMap[topic.channel] }}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">计划时长</span>
                    <span class="value">{{ formatDuration(topic.duration * 60) }}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">预计播出</span>
                    <span class="value">{{ formatDate(topic.expectedAirDate, 'YYYY-MM-DD') }}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">采访对象</span>
                    <span class="value">{{ topic.interviewee || '未指定' }}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">采访地点</span>
                    <span class="value">{{ topic.location }}</span>
                  </div>
                </div>
              </div>
              
              <div class="card">
                <div class="section-title">任务节点</div>
                <div v-if="tasks.length > 0" class="task-list">
                  <div
                    v-for="task in tasks"
                    :key="task.id"
                    class="task-item"
                  >
                    <div class="task-header">
                      <div class="task-info">
                        <span class="task-type">{{ taskTypeMap[task.type] }}</span>
                        <span class="task-name">{{ task.name }}</span>
                      </div>
                      <span class="tag" :class="taskStatusMap[task.status].class">
                        {{ taskStatusMap[task.status].text }}
                      </span>
                    </div>
                    <div class="task-meta">
                      <span>负责人：{{ task.assigneeName || '未分配' }}</span>
                      <span>截止日期：{{ formatDate(task.dueDate, 'YYYY-MM-DD') }}</span>
                    </div>
                    <div class="task-actions">
                      <el-button
                        v-if="!task.assigneeId"
                        size="small"
                        type="primary"
                        @click="handleAssignTask(task)"
                      >
                        <el-icon><User /></el-icon>分配
                      </el-button>
                      <el-dropdown
                        v-if="task.assigneeId && task.status !== 'completed'"
                        @command="(status) => handleTaskStatusChange(task, status as Task['status'])"
                      >
                        <el-button size="small">
                          更新状态<el-icon class="el-icon--right"><ArrowDown /></el-icon>
                        </el-button>
                        <template #dropdown>
                          <el-dropdown-menu>
                            <el-dropdown-item command="in_progress">标记进行中</el-dropdown-item>
                            <el-dropdown-item command="completed">标记完成</el-dropdown-item>
                            <el-dropdown-item command="rejected">标记拒绝</el-dropdown-item>
                          </el-dropdown-menu>
                        </template>
                      </el-dropdown>
                    </div>
                  </div>
                </div>
                <el-empty v-else description="暂无任务节点" />
              </div>
            </el-col>
            
            <el-col :lg="8" :md="24">
              <div class="card">
                <div class="section-title">操作日志</div>
                <el-timeline>
                  <el-timeline-item
                    v-for="(item, index) in timelineItems"
                    :key="index"
                    :timestamp="formatDate(item.timestamp)"
                    :color="item.color"
                  >
                    <div class="timeline-title">{{ item.title }}</div>
                    <div class="timeline-desc">{{ item.description }}</div>
                    <div class="timeline-time">{{ formatRelativeTime(item.timestamp) }}</div>
                  </el-timeline-item>
                </el-timeline>
              </div>
              
              <div class="card">
                <div class="section-title">基础信息</div>
                <div class="meta-list">
                  <div class="meta-item">
                    <span class="label">创建人</span>
                    <span class="value">{{ topic.creatorName }}</span>
                  </div>
                  <div class="meta-item">
                    <span class="label">创建时间</span>
                    <span class="value">{{ formatDate(topic.createdAt) }}</span>
                  </div>
                  <div class="meta-item">
                    <span class="label">更新时间</span>
                    <span class="value">{{ formatDate(topic.updatedAt) }}</span>
                  </div>
                </div>
              </div>
            </el-col>
          </el-row>
        </el-tab-pane>
        
        <el-tab-pane label="关联素材" name="materials">
          <div class="card">
            <el-empty description="暂无关联素材，可在素材库中关联素材到此选题" />
          </div>
        </el-tab-pane>
        
        <el-tab-pane label="审核记录" name="reviews">
          <div class="card">
            <el-empty description="暂无审核记录" />
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
    
    <el-dialog
      v-model="reviewDialogVisible"
      title="审核选题"
      width="500px"
    >
      <el-form
        ref="reviewFormRef"
        :model="reviewForm"
        :rules="reviewRules"
        label-width="80px"
      >
        <el-form-item label="审核结果" prop="status">
          <el-radio-group v-model="reviewForm.status">
            <el-radio-button value="approved">
              <el-icon><CircleCheck /></el-icon>通过
            </el-radio-button>
            <el-radio-button value="rejected">
              <el-icon><Close /></el-icon>退回
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
        
        <el-form-item label="审核意见" prop="remark">
          <el-input
            v-model="reviewForm.remark"
            type="textarea"
            :rows="4"
            placeholder="请输入详细的审核意见"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="reviewDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleReview">
          {{ reviewForm.status === 'approved' ? '确认通过' : '确认退回' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.topic-detail {
  padding-bottom: 40px;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  padding: 16px 20px;
  background-color: var(--bg-color-card);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-md);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.topic-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-color-primary);
  margin: 0;
}

.header-right {
  display: flex;
  gap: 12px;
}

.detail-tabs {
  :deep(.el-tabs__header) {
    background-color: var(--bg-color-card);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-md) var(--border-radius-md) 0 0;
    padding: 0 20px;
    margin: 0;
  }
  
  :deep(.el-tabs__item) {
    height: 48px;
    line-height: 48px;
    font-size: 14px;
  }
  
  :deep(.el-tabs__nav-wrap::after) {
    display: none;
  }
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color-primary);
  margin-bottom: 16px;
}

.description {
  font-size: 14px;
  line-height: 1.8;
  color: var(--text-color-secondary);
  white-space: pre-wrap;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-top: 8px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  
  .label {
    font-size: 12px;
    color: var(--text-color-tertiary);
  }
  
  .value {
    font-size: 14px;
    color: var(--text-color-primary);
  }
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-item {
  padding: 16px;
  background-color: var(--bg-color-secondary);
  border: 1px solid var(--border-color-light);
  border-radius: var(--border-radius-sm);
  transition: all var(--transition-fast);
  
  &:hover {
    border-color: var(--primary-color);
  }
}

.task-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.task-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.task-type {
  font-size: 12px;
  padding: 2px 8px;
  background-color: rgba(64, 158, 255, 0.1);
  color: var(--primary-color);
  border-radius: 4px;
}

.task-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color-primary);
}

.task-meta {
  display: flex;
  gap: 24px;
  font-size: 12px;
  color: var(--text-color-tertiary);
  margin-bottom: 12px;
}

.task-actions {
  display: flex;
  gap: 8px;
}

.timeline-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color-primary);
}

.timeline-desc {
  font-size: 12px;
  color: var(--text-color-secondary);
  margin-top: 4px;
}

.timeline-time {
  font-size: 11px;
  color: var(--text-color-tertiary);
  margin-top: 4px;
}

.meta-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.meta-item {
  display: flex;
  justify-content: space-between;
  
  .label {
    font-size: 13px;
    color: var(--text-color-tertiary);
  }
  
  .value {
    font-size: 13px;
    color: var(--text-color-primary);
  }
}

@media (max-width: 768px) {
  .detail-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .header-left {
    flex-wrap: wrap;
  }
  
  .topic-title {
    font-size: 18px;
  }
  
  .info-grid {
    grid-template-columns: 1fr;
  }
  
  .task-meta {
    flex-direction: column;
    gap: 4px;
  }
}
</style>
