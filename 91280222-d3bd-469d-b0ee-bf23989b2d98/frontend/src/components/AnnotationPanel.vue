<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import { useReviewStore } from '@/stores/reviewStore'
import { useAuthStore } from '@/stores/authStore'
import type { Annotation, AnnotationReply, AnnotationStatus, AnnotationSeverity } from '@/types/annotation'
import { annotationApi } from '@/api/annotation'

const reviewStore = useReviewStore()
const authStore = useAuthStore()

const filterStatus = ref<AnnotationStatus | ''>('')
const filterSeverity = ref<AnnotationSeverity | ''>('')
const searchKeyword = ref('')
const replyingToId = ref<string | null>(null)
const replyContent = ref('')

const filteredAnnotations = computed(() => {
  return reviewStore.sortedAnnotations.filter((a) => {
    if (filterStatus.value && a.status !== filterStatus.value) return false
    if (filterSeverity.value && a.severity !== filterSeverity.value) return false
    if (searchKeyword.value && !a.content.toLowerCase().includes(searchKeyword.value.toLowerCase())) return false
    return true
  })
})

const groupedByPage = computed(() => {
  const map = new Map<number, Annotation[]>()
  filteredAnnotations.value.forEach((a) => {
    if (!map.has(a.pageNumber)) map.set(a.pageNumber, [])
    map.get(a.pageNumber)!.push(a)
  })
  return Array.from(map.entries()).sort(([a], [b]) => a - b)
})

function getSeverityConfig(severity: AnnotationSeverity) {
  const map: Record<AnnotationSeverity, { text: string; color: string; bg: string }> = {
    low: { text: '低', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    medium: { text: '中', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
    high: { text: '高', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    critical: { text: '严重', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' }
  }
  return map[severity]
}

function getStatusConfig(status: AnnotationStatus) {
  const map: Record<AnnotationStatus, { text: string; type: string }> = {
    open: { text: '待处理', type: 'danger' },
    in_progress: { text: '处理中', type: 'warning' },
    resolved: { text: '已解决', type: 'success' },
    rejected: { text: '已驳回', type: 'info' }
  }
  return map[status]
}

function jumpToAnnotation(annotation: Annotation) {
  reviewStore.selectAnnotation(annotation.id)
}

async function changeStatus(annotation: Annotation, status: AnnotationStatus) {
  try {
    await reviewStore.updateAnnotation(annotation.id, { status })
    ElMessage.success('状态更新成功')
  } catch {
    ElMessage.error('状态更新失败')
  }
}

async function deleteAnnotation(annotation: Annotation) {
  try {
    await ElMessageBox.confirm('确定要删除此批注吗？', '删除确认', {
      type: 'warning'
    })
    await reviewStore.deleteAnnotation(annotation.id)
    ElMessage.success('删除成功')
  } catch {
    /* cancelled */
  }
}

function startReply(annotationId: string) {
  replyingToId.value = annotationId
  replyContent.value = ''
}

async function submitReply(annotationId: string) {
  if (!replyContent.value.trim()) return
  try {
    await reviewStore.addReply(annotationId, replyContent.value.trim())
    replyContent.value = ''
    replyingToId.value = null
    ElMessage.success('回复成功')
  } catch {
    ElMessage.error('回复失败')
  }
}

function formatTime(time: string) {
  return dayjs(time).format('MM-DD HH:mm')
}

async function migrateUnresolved() {
  if (!reviewStore.currentVersion) return
  const unresolved = reviewStore.openAnnotations.map((a) => a.id)
  if (unresolved.length === 0) {
    ElMessage.info('没有需要迁移的批注')
    return
  }
  try {
    await ElMessageBox.confirm(
      `将 ${unresolved.length} 条未解决批注迁移到新版本？`,
      '迁移批注',
      { type: 'info' }
    )
    // 这里需要目标版本ID，实际使用时应该有版本选择器
    ElMessage.info('请先选择目标版本')
  } catch {
    /* cancelled */
  }
}
</script>

<template>
  <div class="annotation-panel">
    <div class="panel-header">
      <div class="header-title">
        <el-icon><ChatDotRound /></el-icon>
        <span>批注列表</span>
        <el-tag size="small" type="info">{{ reviewStore.annotations.length }}</el-tag>
      </div>
      <div class="header-actions">
        <el-button size="small" :icon="Sort" @click="migrateUnresolved">
          迁移未解决
        </el-button>
      </div>
    </div>

    <div class="filter-bar">
      <el-input
        v-model="searchKeyword"
        size="small"
        placeholder="搜索批注内容..."
        clearable
        :prefix-icon="Search"
      />
      <div class="filter-selects">
        <el-select v-model="filterStatus" size="small" placeholder="状态" clearable style="width: 90px">
          <el-option label="待处理" value="open" />
          <el-option label="处理中" value="in_progress" />
          <el-option label="已解决" value="resolved" />
          <el-option label="已驳回" value="rejected" />
        </el-select>
        <el-select v-model="filterSeverity" size="small" placeholder="严重" clearable style="width: 80px">
          <el-option label="低" value="low" />
          <el-option label="中" value="medium" />
          <el-option label="高" value="high" />
          <el-option label="严重" value="critical" />
        </el-select>
      </div>
    </div>

    <div class="stats-bar">
      <div class="stat-item">
        <span class="label">总计</span>
        <span class="value">{{ reviewStore.annotationStats.total }}</span>
      </div>
      <div class="stat-item">
        <span class="dot" style="background:#ef4444"></span>
        <span class="value">{{ reviewStore.annotationStats.open }}</span>
      </div>
      <div class="stat-item">
        <span class="dot" style="background:#f59e0b"></span>
        <span class="value">{{ reviewStore.annotationStats.inProgress }}</span>
      </div>
      <div class="stat-item">
        <span class="dot" style="background:#10b981"></span>
        <span class="value">{{ reviewStore.annotationStats.resolved }}</span>
      </div>
    </div>

    <div class="annotation-list">
      <div v-if="filteredAnnotations.length === 0" class="empty-state">
        <el-empty description="暂无批注" :image-size="60" />
      </div>

      <div v-for="[pageNumber, pageAnnotations] in groupedByPage" :key="pageNumber" class="page-group">
        <div class="page-header">
          <el-icon><Document /></el-icon>
          <span>第 {{ pageNumber }} 页</span>
          <el-tag size="small" type="info">{{ pageAnnotations.length }}</el-tag>
        </div>

        <div
          v-for="annotation in pageAnnotations"
          :key="annotation.id"
          class="annotation-item"
          :class="{
            selected: reviewStore.selectedAnnotationId === annotation.id,
            resolved: annotation.status === 'resolved'
          }"
          @click="jumpToAnnotation(annotation)"
        >
          <div class="annotation-header">
            <div class="author-info">
              <el-avatar :size="24">{{ annotation.authorName?.[0] }}</el-avatar>
              <span class="author-name">{{ annotation.authorName }}</span>
              <span class="time">{{ formatTime(annotation.createdAt) }}</span>
            </div>
            <div class="annotation-badges">
              <el-tag
                size="small"
                :color="getSeverityConfig(annotation.severity).bg"
                :style="{ color: getSeverityConfig(annotation.severity).color, border: 'none' }"
              >
                {{ getSeverityConfig(annotation.severity).text }}
              </el-tag>
              <el-tag
                size="small"
                :type="getStatusConfig(annotation.status).type as any"
                effect="light"
              >
                {{ getStatusConfig(annotation.status).text }}
              </el-tag>
            </div>
          </div>

          <div class="annotation-content">{{ annotation.content }}</div>

          <div v-if="annotation.isMigrated" class="migrated-tag">
            <el-icon><RefreshRight /></el-icon>
            <span>从历史版本迁移</span>
          </div>

          <div v-if="annotation.replies.length > 0" class="replies-section">
            <div class="replies-header">
              <el-icon><ChatLineRound /></el-icon>
              <span>{{ annotation.replies.length }} 条回复</span>
            </div>
            <div class="replies-list">
              <div v-for="reply in annotation.replies" :key="reply.id" class="reply-item">
                <el-avatar :size="20">{{ reply.authorName?.[0] }}</el-avatar>
                <div class="reply-body">
                  <div class="reply-meta">
                    <span class="reply-author">{{ reply.authorName }}</span>
                    <span class="reply-time">{{ formatTime(reply.createdAt) }}</span>
                  </div>
                  <div class="reply-content">{{ reply.content }}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="annotation-actions" @click.stop>
            <el-dropdown trigger="click" @command="(cmd) => changeStatus(annotation, cmd as AnnotationStatus)">
              <el-button size="small" link type="primary">
                更新状态
                <el-icon><CaretBottom /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="open">待处理</el-dropdown-item>
                  <el-dropdown-item command="in_progress">处理中</el-dropdown-item>
                  <el-dropdown-item command="resolved">已解决</el-dropdown-item>
                  <el-dropdown-item command="rejected">已驳回</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-button size="small" link type="primary" @click="startReply(annotation.id)">
              <el-icon><ChatLineRound /></el-icon>
              回复
            </el-button>
            <el-button
              v-if="authStore.isProjectManager || annotation.authorId === authStore.user?.id"
              size="small"
              link
              type="danger"
              @click="deleteAnnotation(annotation)"
            >
              <el-icon><Delete /></el-icon>
              删除
            </el-button>
          </div>

          <div v-if="replyingToId === annotation.id" class="reply-input" @click.stop>
            <el-input
              v-model="replyContent"
              type="textarea"
              :rows="2"
              placeholder="输入回复内容..."
              size="small"
            />
            <div class="reply-actions">
              <el-button size="small" @click="replyingToId = null">取消</el-button>
              <el-button size="small" type="primary" @click="submitReply(annotation.id)">发送</el-button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.annotation-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: $bg-base;
  border-left: 1px solid $border-color;

  .dark & {
    background: $dark-bg-light;
    border-left-color: $dark-border-color;
  }
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid $border-color;

  .dark & {
    border-bottom-color: $dark-border-color;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 15px;
  }
}

.filter-bar {
  padding: 12px;
  border-bottom: 1px solid $border-color;
  display: flex;
  flex-direction: column;
  gap: 8px;

  .dark & {
    border-bottom-color: $dark-border-color;
  }

  .filter-selects {
    display: flex;
    gap: 8px;
  }
}

.stats-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  border-bottom: 1px solid $border-color;
  font-size: 13px;

  .dark & {
    border-bottom-color: $dark-border-color;
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 4px;

    .label {
      color: $text-secondary;
    }

    .value {
      font-weight: 500;
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
  }
}

.annotation-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.empty-state {
  padding: 40px 0;
}

.page-group {
  margin-bottom: 12px;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  font-size: 13px;
  font-weight: 500;
  color: $text-secondary;
}

.annotation-item {
  padding: 12px;
  margin-bottom: 8px;
  background: $bg-light;
  border-radius: $radius-md;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all $transition-fast;

  .dark & {
    background: $dark-bg-base;
  }

  &:hover {
    border-color: $primary-color;
  }

  &.selected {
    border-color: $primary-color;
    background: rgba(29, 78, 216, 0.05);

    .dark & {
      background: rgba(59, 130, 246, 0.1);
    }
  }

  &.resolved {
    opacity: 0.6;
  }
}

.annotation-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 8px;

  .author-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;

    .author-name {
      font-weight: 500;
    }

    .time {
      color: $text-placeholder;
      font-size: 12px;
    }
  }

  .annotation-badges {
    display: flex;
    gap: 4px;
  }
}

.annotation-content {
  font-size: 14px;
  line-height: 1.5;
  margin-bottom: 8px;
}

.migrated-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: rgba(6, 182, 212, 0.1);
  color: #0891b2;
  border-radius: $radius-sm;
  font-size: 12px;
  margin-bottom: 8px;
}

.replies-section {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid $border-color;

  .dark & {
    border-top-color: $dark-border-color;
  }

  .replies-header {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: $text-secondary;
    margin-bottom: 8px;
  }
}

.replies-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reply-item {
  display: flex;
  gap: 8px;
  font-size: 13px;

  .reply-body {
    flex: 1;
    background: $bg-base;
    padding: 8px 10px;
    border-radius: $radius-sm;

    .dark & {
      background: $dark-bg-light;
    }
  }

  .reply-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;

    .reply-author {
      font-weight: 500;
      font-size: 12px;
    }

    .reply-time {
      font-size: 11px;
      color: $text-placeholder;
    }
  }

  .reply-content {
    font-size: 13px;
    line-height: 1.4;
  }
}

.annotation-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid $border-color;

  .dark & {
    border-top-color: $dark-border-color;
  }
}

.reply-input {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  .reply-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}
</style>
