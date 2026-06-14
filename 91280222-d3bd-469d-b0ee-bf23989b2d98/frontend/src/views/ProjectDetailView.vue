<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useProjectStore } from '@/stores/projectStore'
import { useAuthStore } from '@/stores/authStore'
import { documentApi } from '@/api/document'
import type { Document } from '@/types/document'
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const authStore = useAuthStore()

const loading = ref(false)
const documents = ref<Document[]>([])
const uploadProgress = ref(0)
const isUploading = ref(false)
const showUploadDialog = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)

const uploadForm = ref({
  name: '',
  category: '',
  discipline: ''
})

const projectId = computed(() => route.params.id as string)
const project = computed(() => projectStore.currentProject)

const categories = ['建筑', '结构', '机电', '给排水', '暖通', '电气']
const disciplines = ['方案', '初设', '施工图', '深化设计']

async function loadProject() {
  loading.value = true
  try {
    await projectStore.fetchProject(projectId.value)
    await loadDocuments()
  } finally {
    loading.value = false
  }
}

async function loadDocuments() {
  try {
    const result = await documentApi.list(projectId.value)
    documents.value = (result as any).data || result
  } catch (e) {
    ElMessage.error('加载图纸列表失败')
  }
}

function openReview(docId: string) {
  router.push(`/review/${docId}`)
}

function triggerFileSelect() {
  fileInputRef.value?.click()
}

function handleFileSelected(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    selectedFile.value = file
    if (!uploadForm.value.name) {
      uploadForm.value.name = file.name.replace(/\.[^.]+$/, '')
    }
  }
}

function openUploadDialog() {
  uploadForm.value = { name: '', category: '', discipline: '' }
  selectedFile.value = null
  showUploadDialog.value = true
}

async function submitUpload() {
  if (!uploadForm.value.name.trim()) {
    ElMessage.warning('请输入图纸名称')
    return
  }
  if (!selectedFile.value) {
    ElMessage.warning('请选择要上传的文件')
    return
  }

  isUploading.value = true
  uploadProgress.value = 0
  try {
    await documentApi.upload({
      projectId: projectId.value,
      name: uploadForm.value.name.trim(),
      category: uploadForm.value.category,
      discipline: uploadForm.value.discipline,
      file: selectedFile.value,
      onProgress: (p) => (uploadProgress.value = p)
    })
    ElMessage.success('图纸上传成功')
    showUploadDialog.value = false
    await loadDocuments()
    await projectStore.fetchProject(projectId.value)
  } catch {
    ElMessage.error('上传失败')
  } finally {
    isUploading.value = false
    uploadProgress.value = 0
    if (fileInputRef.value) fileInputRef.value.value = ''
  }
}

function getStatusConfig(status: string) {
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

watch(projectId, () => {
  if (projectId.value) loadProject()
})

onMounted(() => {
  if (projectId.value) loadProject()
})
</script>

<template>
  <div class="project-detail-view" v-loading="loading">
    <div v-if="project" class="detail-container">
      <div class="project-header">
        <div class="header-info">
          <el-button text @click="router.back()">
            <el-icon><ArrowLeft /></el-icon>
            返回
          </el-button>
          <h1 class="project-title">{{ project.name }}</h1>
          <el-tag :type="{ planning: 'info', in_progress: 'primary', reviewing: 'warning', completed: 'success', archived: '' }[project.status] as any" size="large">
            {{ { planning: '规划中', in_progress: '进行中', reviewing: '审阅中', completed: '已完成', archived: '已归档' }[project.status] }}
          </el-tag>
        </div>
        <div class="header-actions">
          <el-button
            v-if="authStore.isDesigner || authStore.isProjectManager"
            type="primary"
            :icon="Upload"
            :loading="isUploading"
            @click="openUploadDialog"
          >
            上传图纸
          </el-button>
        </div>
      </div>

      <div v-if="project.description" class="project-desc">
        {{ project.description }}
      </div>

      <div class="stats-row">
        <div class="stat-item">
          <div class="stat-icon" style="background:rgba(59,130,246,0.1);color:#3b82f6">
            <el-icon :size="20"><Document /></el-icon>
          </div>
          <div>
            <div class="stat-value">{{ project.stats?.totalDocuments || 0 }}</div>
            <div class="stat-label">图纸数量</div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon" style="background:rgba(239,68,68,0.1);color:#ef4444">
            <el-icon :size="20"><ChatDotRound /></el-icon>
          </div>
          <div>
            <div class="stat-value">{{ project.stats?.totalAnnotations || 0 }}</div>
            <div class="stat-label">批注总数</div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon" style="background:rgba(16,185,129,0.1);color:#10b981">
            <el-icon :size="20"><CircleCheckFilled /></el-icon>
          </div>
          <div>
            <div class="stat-value">{{ project.stats?.resolvedAnnotations || 0 }}</div>
            <div class="stat-label">已解决批注</div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon" style="background:rgba(245,158,11,0.1);color:#f59e0b">
            <el-icon :size="20"><User /></el-icon>
          </div>
          <div>
            <div class="stat-value">{{ project.members.length }}</div>
            <div class="stat-label">团队成员</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-header">
          <h3>图纸列表</h3>
          <el-tag type="info">{{ documents.length }} 份图纸</el-tag>
        </div>

        <el-table :data="documents" stripe v-if="documents.length > 0">
          <el-table-column label="图纸名称" min-width="240">
            <template #default="{ row }">
              <div class="doc-name-cell" @click="openReview(row.id)">
                <el-icon color="#3b82f6"><Document /></el-icon>
                <span class="text-ellipsis">{{ row.name }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="category" label="分类" width="100" />
          <el-table-column prop="discipline" label="阶段" width="100" />
          <el-table-column label="版本" width="120">
            <template #default="{ row }">
              v{{ row.versions?.[row.versions.length - 1]?.major || 1 }}.{{ row.versions?.[row.versions.length - 1]?.minor || 0 }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag size="small" :type="getStatusConfig(row.status).type as any">
                {{ getStatusConfig(row.status).text }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="页数" width="80" align="center">
            <template #default="{ row }">
              {{ row.versions?.[row.versions.length - 1]?.pageCount || 0 }}
            </template>
          </el-table-column>
          <el-table-column label="上传时间" width="160">
            <template #default="{ row }">
              {{ dayjs(row.updatedAt).format('YYYY-MM-DD HH:mm') }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="openReview(row.id)">
                审阅
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-empty v-else description="暂无图纸，点击右上角上传" />
      </div>

      <div class="section">
        <div class="section-header">
          <h3>团队成员</h3>
          <el-tag type="info">{{ project.members.length }} 人</el-tag>
        </div>
        <div class="members-grid">
          <div v-for="m in project.members" :key="m.userId" class="member-card">
            <el-avatar :size="40">{{ m.userName?.[0] }}</el-avatar>
            <div class="member-info">
              <div class="member-name">{{ m.userName }}</div>
              <el-tag size="small" :type="{ project_manager: 'danger', designer: 'primary', reviewer: 'success' }[m.role] as any">
                {{ { project_manager: '项目经理', designer: '设计师', reviewer: '审阅者' }[m.role] }}
              </el-tag>
            </div>
          </div>
        </div>
      </div>
    </div>

    <el-dialog v-model="showUploadDialog" title="上传图纸" width="480px" :close-on-click-modal="false">
      <el-form :model="uploadForm" label-width="100px">
        <el-form-item label="图纸名称" required>
          <el-input v-model="uploadForm.name" placeholder="请输入图纸名称" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="uploadForm.category" placeholder="请选择" style="width: 100%">
            <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>
        <el-form-item label="阶段">
          <el-select v-model="uploadForm.discipline" placeholder="请选择" style="width: 100%">
            <el-option v-for="d in disciplines" :key="d" :label="d" :value="d" />
          </el-select>
        </el-form-item>
        <el-form-item label="文件" required>
          <div
            class="file-upload-area"
            :class="{ 'has-file': selectedFile }"
            @click="triggerFileSelect"
          >
            <template v-if="selectedFile">
              <el-icon :size="32" color="#10b981"><CircleCheckFilled /></el-icon>
              <div class="file-name">{{ selectedFile.name }}</div>
              <div class="file-size">{{ (selectedFile.size / 1024).toFixed(1) }} KB</div>
            </template>
            <template v-else>
              <el-icon :size="40" color="#9ca3af"><UploadFilled /></el-icon>
              <div class="upload-tip">点击选择文件或拖拽至此</div>
              <div class="upload-formats">支持 PDF / DWG / PNG / JPG 格式</div>
            </template>
          </div>
          <input
            ref="fileInputRef"
            type="file"
            accept=".pdf,.dwg,.png,.jpg,.jpeg"
            style="display:none"
            @change="handleFileSelected"
          />
        </el-form-item>
        <el-form-item v-if="isUploading">
          <el-progress :percentage="uploadProgress" :stroke-width="8" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showUploadDialog = false" :disabled="isUploading">取消</el-button>
        <el-button type="primary" :loading="isUploading" @click="submitUpload">上传</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.project-detail-view {
  height: 100%;
  overflow-y: auto;
  padding: 20px;
}

.detail-container {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.project-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;

  .header-info {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;

    .project-title {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
    }
  }
}

.project-desc {
  padding: 14px 18px;
  background: $bg-light;
  border-radius: $radius-md;
  color: $text-secondary;
  font-size: 14px;
  line-height: 1.6;

  .dark & {
    background: $dark-bg-base;
  }
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: $bg-base;
  border-radius: $radius-md;
  border: 1px solid $border-color;

  .dark & {
    background: $dark-bg-light;
    border-color: $dark-border-color;
  }

  .stat-icon {
    width: 44px;
    height: 44px;
    border-radius: $radius-md;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .stat-value {
    font-size: 22px;
    font-weight: 700;
    line-height: 1.2;
  }

  .stat-label {
    font-size: 12px;
    color: $text-secondary;
  }
}

.section {
  background: $bg-base;
  border-radius: $radius-lg;
  padding: 20px;
  border: 1px solid $border-color;

  .dark & {
    background: $dark-bg-light;
    border-color: $dark-border-color;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;

    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }
  }
}

.doc-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: $primary-color;
  font-weight: 500;

  &:hover {
    text-decoration: underline;
  }
}

.members-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.member-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: $bg-light;
  border-radius: $radius-md;

  .dark & {
    background: $dark-bg-base;
  }

  .member-info {
    display: flex;
    flex-direction: column;
    gap: 4px;

    .member-name {
      font-weight: 500;
      font-size: 14px;
    }
  }
}

.file-upload-area {
  width: 100%;
  padding: 32px;
  border: 2px dashed $border-color;
  border-radius: $radius-md;
  text-align: center;
  cursor: pointer;
  transition: all $transition-fast;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;

  &:hover {
    border-color: $primary-color;
    background: rgba(29, 78, 216, 0.02);
  }

  &.has-file {
    border-style: solid;
    border-color: #10b981;
    background: rgba(16, 185, 129, 0.05);
  }

  .file-name {
    font-weight: 500;
    color: $text-primary;
  }

  .file-size {
    font-size: 12px;
    color: $text-placeholder;
  }

  .upload-tip {
    font-size: 14px;
    color: $text-secondary;
  }

  .upload-formats {
    font-size: 12px;
    color: $text-placeholder;
  }
}
</style>
