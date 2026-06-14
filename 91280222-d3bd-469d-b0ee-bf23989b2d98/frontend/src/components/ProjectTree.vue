<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useProjectStore } from '@/stores/projectStore'
import { useAuthStore } from '@/stores/authStore'
import type { Document } from '@/types/document'
import { documentApi } from '@/api/document'

const router = useRouter()
const projectStore = useProjectStore()
const authStore = useAuthStore()

const loading = ref(false)
const expandedNodes = ref<Set<string>>(new Set())
const documentsMap = ref<Map<string, Document[]>>(new Map())
const selectedDocumentId = ref<string | null>(null)

const projects = computed(() => projectStore.sortedProjects)

async function loadProjectDocuments(projectId: string) {
  loading.value = true
  try {
    const result = await documentApi.list(projectId)
    documentsMap.value.set(projectId, (result as any).data || result)
  } catch (e) {
    ElMessage.error('加载图纸列表失败')
  } finally {
    loading.value = false
  }
}

function toggleExpand(projectId: string) {
  if (expandedNodes.value.has(projectId)) {
    expandedNodes.value.delete(projectId)
  } else {
    expandedNodes.value.add(projectId)
    if (!documentsMap.value.has(projectId)) {
      loadProjectDocuments(projectId)
    }
  }
}

function openDocument(documentId: string) {
  selectedDocumentId.value = documentId
  router.push(`/review/${documentId}`)
}

function getStatusBadge(status: string) {
  const map: Record<string, { text: string; type: string }> = {
    planning: { text: '规划中', type: 'info' },
    in_progress: { text: '进行中', type: 'primary' },
    reviewing: { text: '审阅中', type: 'warning' },
    completed: { text: '已完成', type: 'success' },
    archived: { text: '已归档', type: '' }
  }
  return map[status] || { text: status, type: '' }
}

function getDocumentStatusBadge(status: string) {
  const map: Record<string, { text: string; type: string }> = {
    draft: { text: '草稿', type: 'info' },
    submitted: { text: '已提交', type: '' },
    under_review: { text: '审阅中', type: 'warning' },
    needs_revision: { text: '需修改', type: 'danger' },
    approved: { text: '已通过', type: 'success' },
    rejected: { text: '已驳回', type: 'danger' }
  }
  return map[status] || { text: status, type: '' }
}

function handleCreateProject() {
  if (!authStore.isProjectManager) {
    ElMessage.warning('只有项目经理可以创建项目')
    return
  }
  ElMessageBox.prompt('请输入项目名称', '新建项目', {
    confirmButtonText: '创建',
    cancelButtonText: '取消',
    inputPattern: /.{2,}/,
    inputErrorMessage: '项目名称至少2个字符'
  })
    .then(async ({ value }) => {
      try {
        await projectStore.createProject({
          name: value,
          memberIds: [authStore.user!.id]
        })
        ElMessage.success('项目创建成功')
      } catch {
        ElMessage.error('创建失败')
      }
    })
    .catch(() => {})
}

onMounted(() => {
  projectStore.fetchProjects()
})
</script>

<template>
  <div class="project-tree">
    <div class="tree-header">
      <span class="title">项目列表</span>
      <el-button
        v-if="authStore.isProjectManager"
        type="primary"
        size="small"
        :icon="Plus"
        @click="handleCreateProject"
      >
        新建
      </el-button>
    </div>

    <div class="tree-content" v-loading="loading">
      <div v-if="projects.length === 0" class="empty-tip">
        <el-empty description="暂无项目" :image-size="80" />
      </div>

      <div v-for="project in projects" :key="project.id" class="project-node">
        <div
          class="project-header"
          @click="toggleExpand(project.id)"
        >
          <el-icon class="expand-icon">
            <CaretBottom v-if="expandedNodes.has(project.id)" />
            <CaretRight v-else />
          </el-icon>
          <el-icon class="folder-icon" color="#f59e0b">
            <Folder />
          </el-icon>
          <span class="project-name text-ellipsis" :title="project.name">{{ project.name }}</span>
          <el-tag size="small" :type="getStatusBadge(project.status).type as any">
            {{ getStatusBadge(project.status).text }}
          </el-tag>
        </div>

        <div v-if="expandedNodes.has(project.id)" class="document-list">
          <div v-if="!documentsMap.has(project.id)" class="loading-tip">
            <el-icon class="is-loading"><Loading /></el-icon>
            加载中...
          </div>
          <div v-else-if="(documentsMap.get(project.id) || []).length === 0" class="empty-docs">
            暂无图纸
          </div>
          <div
            v-for="doc in documentsMap.get(project.id) || []"
            :key="doc.id"
            class="document-item"
            :class="{ active: selectedDocumentId === doc.id }"
            @click.stop="openDocument(doc.id)"
          >
            <el-icon class="doc-icon" color="#3b82f6">
              <Document />
            </el-icon>
            <span class="doc-name text-ellipsis" :title="doc.name">{{ doc.name }}</span>
            <span class="version-tag">v{{ doc.versions?.[doc.versions.length - 1]?.major || 1 }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.project-tree {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: $bg-base;
  border-right: 1px solid $border-color;

  .dark & {
    background: $dark-bg-light;
    border-right-color: $dark-border-color;
  }
}

.tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid $border-color;

  .dark & {
    border-bottom-color: $dark-border-color;
  }

  .title {
    font-weight: 600;
    font-size: 15px;
  }
}

.tree-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.empty-tip {
  padding: 40px 0;
}

.project-node {
  margin-bottom: 4px;
}

.project-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: $radius-sm;
  cursor: pointer;
  transition: background $transition-fast;

  &:hover {
    background: $bg-hover;

    .dark & {
      background: $dark-bg-hover;
    }
  }

  .expand-icon {
    font-size: 12px;
    width: 16px;
  }

  .folder-icon {
    font-size: 18px;
  }

  .project-name {
    flex: 1;
    font-size: 14px;
  }
}

.document-list {
  padding-left: 32px;
}

.loading-tip,
.empty-docs {
  padding: 8px 10px;
  color: $text-placeholder;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.document-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: $radius-sm;
  cursor: pointer;
  transition: all $transition-fast;

  &:hover {
    background: $bg-hover;

    .dark & {
      background: $dark-bg-hover;
    }
  }

  &.active {
    background: rgba(29, 78, 216, 0.1);
    color: $primary-color;

    .dark & {
      background: rgba(59, 130, 246, 0.2);
    }
  }

  .doc-icon {
    font-size: 16px;
  }

  .doc-name {
    flex: 1;
    font-size: 13px;
  }

  .version-tag {
    font-size: 11px;
    color: $text-placeholder;
    background: $bg-light;
    padding: 1px 6px;
    border-radius: 10px;

    .dark & {
      background: $dark-bg-base;
    }
  }
}
</style>
