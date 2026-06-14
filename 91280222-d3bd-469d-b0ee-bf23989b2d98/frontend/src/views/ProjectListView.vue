<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useProjectStore } from '@/stores/projectStore'
import { useAuthStore } from '@/stores/authStore'
import dayjs from 'dayjs'

const router = useRouter()
const projectStore = useProjectStore()
const authStore = useAuthStore()

const loading = ref(false)
const searchKeyword = ref('')
const statusFilter = ref('')
const showCreateDialog = ref(false)

const formData = ref({
  name: '',
  description: '',
  buildingType: '',
  floorCount: undefined as number | undefined,
  area: undefined as number | undefined
})

const filteredProjects = computed(() => {
  return projectStore.sortedProjects.filter((p) => {
    if (statusFilter.value && p.status !== statusFilter.value) return false
    if (searchKeyword.value && !p.name.toLowerCase().includes(searchKeyword.value.toLowerCase())) return false
    return true
  })
})

const buildingTypes = [
  { value: 'residential', label: '住宅' },
  { value: 'commercial', label: '商业' },
  { value: 'industrial', label: '工业' },
  { value: 'public', label: '公共建筑' },
  { value: 'infrastructure', label: '基础设施' }
]

async function loadProjects() {
  loading.value = true
  try {
    await projectStore.fetchProjects()
  } finally {
    loading.value = false
  }
}

function openCreateDialog() {
  formData.value = {
    name: '',
    description: '',
    buildingType: '',
    floorCount: undefined,
    area: undefined
  }
  showCreateDialog.value = true
}

async function submitCreate() {
  if (!formData.value.name.trim()) {
    ElMessage.warning('请输入项目名称')
    return
  }
  try {
    await projectStore.createProject({
      name: formData.value.name.trim(),
      description: formData.value.description,
      buildingType: formData.value.buildingType,
      floorCount: formData.value.floorCount,
      area: formData.value.area,
      memberIds: [authStore.user!.id]
    })
    ElMessage.success('项目创建成功')
    showCreateDialog.value = false
  } catch {
    ElMessage.error('创建失败')
  }
}

async function deleteProject(id: string, name: string) {
  try {
    await ElMessageBox.confirm(
      `确定要删除项目「${name}」吗？此操作不可恢复。`,
      '删除确认',
      { type: 'warning' }
    )
    await projectStore.deleteProject(id)
    ElMessage.success('删除成功')
  } catch {
    /* cancelled */
  }
}

function getStatusConfig(status: string) {
  const map: Record<string, { text: string; type: string; color: string }> = {
    planning: { text: '规划中', type: 'info', color: '#6b7280' },
    in_progress: { text: '进行中', type: 'primary', color: '#3b82f6' },
    reviewing: { text: '审阅中', type: 'warning', color: '#f59e0b' },
    completed: { text: '已完成', type: 'success', color: '#10b981' },
    archived: { text: '已归档', type: '', color: '#9ca3af' }
  }
  return map[status] || { text: status, type: '', color: '#6b7280' }
}

function getBuildingTypeLabel(type?: string) {
  if (!type) return '-'
  return buildingTypes.find((t) => t.value === type)?.label || type
}

onMounted(loadProjects)
</script>

<template>
  <div class="project-list-view">
    <div class="page-header">
      <div class="header-info">
        <h2 class="page-title">项目管理</h2>
        <p class="page-desc">管理所有建筑设计项目，查看审阅进度与状态</p>
      </div>
      <div class="header-actions">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索项目名称..."
          :prefix-icon="Search"
          clearable
          style="width: 240px"
        />
        <el-select v-model="statusFilter" placeholder="状态筛选" clearable style="width: 140px">
          <el-option label="规划中" value="planning" />
          <el-option label="进行中" value="in_progress" />
          <el-option label="审阅中" value="reviewing" />
          <el-option label="已完成" value="completed" />
          <el-option label="已归档" value="archived" />
        </el-select>
        <el-button
          v-if="authStore.isProjectManager"
          type="primary"
          :icon="Plus"
          @click="openCreateDialog"
        >
          新建项目
        </el-button>
      </div>
    </div>

    <div class="project-grid" v-loading="loading">
      <el-empty v-if="filteredProjects.length === 0" description="暂无项目" />

      <div
        v-for="project in filteredProjects"
        :key="project.id"
        class="project-card"
        @click="router.push(`/projects/${project.id}`)"
      >
        <div class="card-header">
          <div class="project-icon" :style="{ background: getStatusConfig(project.status).color + '20', color: getStatusConfig(project.status).color }">
            <el-icon :size="24"><OfficeBuilding /></el-icon>
          </div>
          <el-tag
            size="small"
            :type="getStatusConfig(project.status).type as any"
            effect="light"
          >
            {{ getStatusConfig(project.status).text }}
          </el-tag>
        </div>

        <div class="card-body">
          <h3 class="project-name text-ellipsis" :title="project.name">{{ project.name }}</h3>
          <p class="project-desc text-ellipsis" v-if="project.description">
            {{ project.description }}
          </p>

          <div class="project-meta">
            <div class="meta-item">
              <el-icon><Building /></el-icon>
              <span>{{ getBuildingTypeLabel(project.buildingType) }}</span>
            </div>
            <div class="meta-item" v-if="project.floorCount">
              <el-icon><Layers /></el-icon>
              <span>{{ project.floorCount }} 层</span>
            </div>
            <div class="meta-item" v-if="project.area">
              <el-icon><Grid /></el-icon>
              <span>{{ project.area }} ㎡</span>
            </div>
          </div>

          <div class="progress-section">
            <div class="progress-header">
              <span>审阅进度</span>
              <span class="progress-value">
                {{ project.stats?.completedReviews || 0 }} / {{ (project.stats?.pendingReviews || 0) + (project.stats?.completedReviews || 0) }}
              </span>
            </div>
            <el-progress
              :percentage="project.stats ? Math.round((project.stats.completedReviews / Math.max((project.stats.pendingReviews || 0) + project.stats.completedReviews, 1)) * 100) : 0"
              :stroke-width="6"
            />
          </div>

          <div class="stats-row">
            <div class="stat">
              <el-icon color="#3b82f6"><Document /></el-icon>
              <span>{{ project.stats?.totalDocuments || 0 }} 图纸</span>
            </div>
            <div class="stat">
              <el-icon color="#ef4444"><ChatDotRound /></el-icon>
              <span>{{ project.stats?.totalAnnotations || 0 }} 批注</span>
            </div>
            <div class="stat">
              <el-icon color="#10b981"><User /></el-icon>
              <span>{{ project.members.length }} 成员</span>
            </div>
          </div>
        </div>

        <div class="card-footer">
          <span class="create-time">
            <el-icon><Clock /></el-icon>
            {{ dayjs(project.createdAt).format('YYYY-MM-DD') }}
          </span>
          <div class="card-actions" @click.stop>
            <el-button
              size="small"
              type="primary"
              link
              @click="router.push(`/projects/${project.id}`)"
            >
              查看详情
            </el-button>
            <el-button
              v-if="authStore.isProjectManager"
              size="small"
              type="danger"
              link
              @click="deleteProject(project.id, project.name)"
            >
              删除
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <el-dialog v-model="showCreateDialog" title="新建项目" width="520px">
      <el-form :model="formData" label-width="100px">
        <el-form-item label="项目名称" required>
          <el-input v-model="formData.name" placeholder="请输入项目名称" maxlength="50" show-word-limit />
        </el-form-item>
        <el-form-item label="项目描述">
          <el-input v-model="formData.description" type="textarea" :rows="3" placeholder="项目简要描述..." maxlength="200" show-word-limit />
        </el-form-item>
        <el-form-item label="建筑类型">
          <el-select v-model="formData.buildingType" placeholder="请选择" style="width: 100%">
            <el-option v-for="t in buildingTypes" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="楼层数">
          <el-input-number v-model="formData.floorCount" :min="1" :max="500" style="width: 100%" />
        </el-form-item>
        <el-form-item label="建筑面积">
          <el-input-number v-model="formData.area" :min="0" style="width: 100%" />
          <template #append>㎡</template>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="submitCreate">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.project-list-view {
  padding: 20px;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;

  .page-title {
    margin: 0 0 4px;
    font-size: 22px;
    font-weight: 600;
  }

  .page-desc {
    margin: 0;
    font-size: 13px;
    color: $text-secondary;
  }

  .header-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
}

.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.project-card {
  background: $bg-base;
  border-radius: $radius-lg;
  border: 1px solid $border-color;
  cursor: pointer;
  transition: all $transition-normal;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .dark & {
    background: $dark-bg-light;
    border-color: $dark-border-color;
  }

  &:hover {
    box-shadow: $shadow-lg;
    transform: translateY(-2px);
    border-color: $primary-color;
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 0;

  .project-icon {
    width: 44px;
    height: 44px;
    border-radius: $radius-md;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.card-body {
  padding: 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;

  .project-name {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
  }

  .project-desc {
    font-size: 13px;
    color: $text-secondary;
    margin: 0;
    min-height: 36px;
  }
}

.project-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: $text-secondary;

  .meta-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }
}

.progress-section {
  .progress-header {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: $text-secondary;
    margin-bottom: 6px;

    .progress-value {
      font-weight: 500;
    }
  }
}

.stats-row {
  display: flex;
  gap: 16px;
  padding-top: 10px;
  border-top: 1px solid $border-color;
  font-size: 12px;
  color: $text-secondary;

  .dark & {
    border-top-color: $dark-border-color;
  }

  .stat {
    display: flex;
    align-items: center;
    gap: 4px;
  }
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-top: 1px solid $border-color;
  background: $bg-light;

  .dark & {
    background: $dark-bg-base;
    border-top-color: $dark-border-color;
  }

  .create-time {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: $text-placeholder;
  }

  .card-actions {
    display: flex;
    gap: 8px;
  }
}
</style>
