<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useWorkflowStore } from '@/stores/workflow'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { UploadProps } from 'element-plus'
import type { Material } from '@/types'
import { formatDate, formatDuration, formatFileSize, getMaterialType, generateId, debounce } from '@/utils'
import { checkDuplicate, deleteMaterial, updateMaterial, getMaterialPreviewUrl } from '@/api/material'
import CryptoJS from 'crypto-js'

const workflowStore = useWorkflowStore()

const loading = ref(false)
const uploadProgress = ref(0)
const uploading = ref(false)
const page = ref(1)
const pageSize = ref(50)
const viewMode = ref<'grid' | 'list'>('grid')
const previewDialogVisible = ref(false)
const currentPreviewMaterial = ref<Material | null>(null)

const filters = reactive({
  type: undefined as Material['type'] | undefined,
  keyword: '',
  tags: [] as string[],
  startDate: '',
  endDate: ''
})

const typeOptions = [
  { value: 'video', label: '视频', icon: 'VideoPlay' },
  { value: 'audio', label: '音频', icon: 'Headset' },
  { value: 'image', label: '图片', icon: 'Picture' },
  { value: 'document', label: '文档', icon: 'Document' }
]

const typeMap: Record<string, { text: string; class: string; icon: string }> = {
  video: { text: '视频', class: 'tag--primary', icon: 'VideoPlay' },
  audio: { text: '音频', class: 'tag--success', icon: 'Headset' },
  image: { text: '图片', class: 'tag--warning', icon: 'Picture' },
  document: { text: '文档', class: 'tag--info', icon: 'Document' }
}

const materials = computed(() => workflowStore.materials)
const total = computed(() => workflowStore.materialsTotal)

async function fetchData() {
  loading.value = true
  try {
    await workflowStore.fetchMaterials({
      page: page.value,
      pageSize: pageSize.value,
      ...filters
    })
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  page.value = 1
  fetchData()
}

const handleSearchDebounced = debounce(handleSearch, 300)

function handleReset() {
  filters.type = undefined
  filters.keyword = ''
  filters.tags = []
  filters.startDate = ''
  filters.endDate = ''
  page.value = 1
  fetchData()
}

function handleTypeFilter(type: Material['type'] | undefined) {
  filters.type = filters.type === type ? undefined : type
  handleSearch()
}

const uploadFileRef = ref<HTMLInputElement>()

function triggerUpload() {
  uploadFileRef.value?.click()
}

async function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (!files || files.length === 0) return
  
  const file = files[0]
  const maxSize = 2 * 1024 * 1024 * 1024
  
  if (file.size > maxSize) {
    ElMessage.error('文件大小不能超过 2GB')
    return
  }
  
  uploading.value = true
  uploadProgress.value = 0
  
  try {
    const fileHash = await calculateFileHash(file)
    const dupResult = await checkDuplicate(fileHash)
    
    if (dupResult.duplicate && dupResult.material) {
      await ElMessageBox.confirm(
        `检测到重复素材："${dupResult.material.name}"，是否继续上传？`,
        '重复检测',
        {
          confirmButtonText: '继续上传',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
    }
    
    simulateUpload(file)
    
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '上传失败')
    }
    uploading.value = false
  } finally {
    input.value = ''
  }
}

function calculateFileHash(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const hash = CryptoJS.MD5(CryptoJS.lib.WordArray.create(e.target?.result as ArrayBuffer)).toString()
      resolve(hash)
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file.slice(0, 10 * 1024 * 1024))
  })
}

function simulateUpload(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  const type = getMaterialType(ext)
  
  let progress = 0
  const interval = setInterval(() => {
    progress += Math.random() * 15
    if (progress >= 100) {
      progress = 100
      clearInterval(interval)
      
      const newMaterial: Material = {
        id: Date.now(),
        name: file.name.replace(`.${ext}`, ''),
        type,
        fileSize: file.size,
        duration: type === 'video' || type === 'audio' ? Math.floor(Math.random() * 3600) : undefined,
        resolution: type === 'video' ? '1920x1080' : undefined,
        codec: type === 'video' ? 'H.264' : type === 'audio' ? 'AAC' : undefined,
        format: ext,
        path: `/uploads/${Date.now()}/${file.name}`,
        thumbnail: type === 'video' || type === 'image' 
          ? `https://picsum.photos/seed/${Date.now()}/320/180` 
          : undefined,
        tags: [],
        description: '',
        uploaderId: 1,
        uploaderName: '当前用户',
        uploadedAt: new Date().toISOString()
      }
      
      workflowStore.materials.unshift(newMaterial)
      workflowStore.materialsTotal++
      
      uploading.value = false
      uploadProgress.value = 0
      ElMessage.success('上传成功')
    } else {
      uploadProgress.value = Math.floor(progress)
    }
  }, 200)
}

async function handleDelete(material: Material) {
  try {
    await ElMessageBox.confirm(`确认删除素材"${material.name}"吗？`, '确认删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
    workflowStore.materials = workflowStore.materials.filter(m => m.id !== material.id)
    workflowStore.materialsTotal--
    ElMessage.success('删除成功')
  } catch {
    // 用户取消
  }
}

function handlePreview(material: Material) {
  currentPreviewMaterial.value = material
  previewDialogVisible.value = true
}

function handleDownload(material: Material) {
  ElMessage.info(`正在下载: ${material.name}`)
}

function handleClip(material: Material) {
  if (material.type !== 'video' && material.type !== 'audio') {
    ElMessage.warning('仅视频和音频素材支持片段截取')
    return
  }
  ElMessage.info('片段截取功能开发中')
}

function getPreviewUrl(material: Material): string {
  if (material.thumbnail) return material.thumbnail
  if (material.type === 'video') return `https://picsum.photos/seed/${material.id}/320/180`
  if (material.type === 'image') return getMaterialPreviewUrl(material.id)
  if (material.type === 'audio') return 'https://picsum.photos/seed/audio/320/180'
  return 'https://picsum.photos/seed/doc/320/180'
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

function loadMore() {
  if (page.value * pageSize.value < total.value) {
    page.value++
    fetchData()
  }
}

watch(() => filters.keyword, handleSearchDebounced)

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="page-container material-library">
    <input
      ref="uploadFileRef"
      type="file"
      style="display: none"
      @change="handleFileSelect"
      accept="video/*,audio/*,image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
    />
    
    <div class="page-header">
      <div class="page-header__title">素材资源库</div>
      <div class="page-header__actions">
        <el-button 
          type="primary" 
          :loading="uploading"
          @click="triggerUpload"
        >
          <el-icon><Upload /></el-icon>
          {{ uploading ? `上传中 ${uploadProgress}%` : '上传素材' }}
        </el-button>
        <div class="view-toggle">
          <el-button-group>
            <el-button :type="viewMode === 'grid' ? 'primary' : ''" @click="viewMode = 'grid'">
              <el-icon><Grid /></el-icon>
            </el-button>
            <el-button :type="viewMode === 'list' ? 'primary' : ''" @click="viewMode = 'list'">
              <el-icon><List /></el-icon>
            </el-button>
          </el-button-group>
        </div>
      </div>
    </div>
    
    <div v-if="uploading" class="upload-progress">
      <span>上传进度: {{ uploadProgress }}%</span>
      <el-progress :percentage="uploadProgress" :stroke-width="4" />
    </div>
    
    <div class="filter-section">
      <div class="type-filter">
        <div
          v-for="type in typeOptions"
          :key="type.value"
          class="type-item"
          :class="{ active: filters.type === type.value }"
          @click="handleTypeFilter(type.value as Material['type'])"
        >
          <el-icon :size="20">
            <component :is="type.icon" />
          </el-icon>
          <span>{{ type.label }}</span>
        </div>
      </div>
      
      <div class="search-bar">
        <el-input
          v-model="filters.keyword"
          placeholder="搜索素材名称、标签、描述..."
          clearable
          style="width: 300px"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        
        <el-button @click="handleReset">重置</el-button>
      </div>
    </div>
    
    <div v-loading="loading" class="materials-content">
      <div v-if="viewMode === 'grid'" class="materials-grid">
        <div
          v-for="material in materials"
          :key="material.id"
          class="material-card"
          @dblclick="handlePreview(material)"
        >
          <div class="material-thumbnail">
            <img :src="getPreviewUrl(material)" :alt="material.name" />
            <div class="material-overlay">
              <span class="material-duration" v-if="material.duration">
                {{ formatDuration(material.duration) }}
              </span>
              <span class="material-type tag" :class="typeMap[material.type].class">
                {{ typeMap[material.type].text }}
              </span>
            </div>
            <div class="material-actions">
              <el-button type="primary" circle size="small" @click.stop="handlePreview(material)">
                <el-icon><View /></el-icon>
              </el-button>
              <el-button circle size="small" @click.stop="handleDownload(material)">
                <el-icon><Download /></el-icon>
              </el-button>
              <el-button circle size="small" @click.stop="handleClip(material)">
                <el-icon><Crop /></el-icon>
              </el-button>
            </div>
          </div>
          <div class="material-info">
            <div class="material-name" :title="material.name">{{ material.name }}</div>
            <div class="material-meta">
              <span>{{ formatFileSize(material.fileSize) }}</span>
              <span>{{ material.resolution || '' }}</span>
            </div>
            <div class="material-footer">
              <span class="material-date">{{ formatDate(material.uploadedAt, 'MM-DD') }}</span>
              <el-button 
                type="danger" 
                text 
                size="small"
                @click.stop="handleDelete(material)"
              >
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </div>
        </div>
      </div>
      
      <div v-else class="materials-list">
        <el-table
          :data="materials"
          stripe
          style="width: 100%"
          @row-dblclick="handlePreview"
        >
          <el-table-column prop="name" label="素材名称" min-width="200">
            <template #default="{ row }">
              <div class="list-item">
                <img :src="getPreviewUrl(row)" class="list-thumbnail" />
                <span>{{ row.name }}</span>
              </div>
            </template>
          </el-table-column>
          
          <el-table-column prop="type" label="类型" width="80">
            <template #default="{ row }">
              <span class="tag" :class="typeMap[row.type].class">
                {{ typeMap[row.type].text }}
              </span>
            </template>
          </el-table-column>
          
          <el-table-column prop="fileSize" label="大小" width="100">
            <template #default="{ row }">
              {{ formatFileSize(row.fileSize) }}
            </template>
          </el-table-column>
          
          <el-table-column prop="duration" label="时长" width="100">
            <template #default="{ row }">
              {{ row.duration ? formatDuration(row.duration) : '-' }}
            </template>
          </el-table-column>
          
          <el-table-column prop="resolution" label="分辨率" width="120">
            <template #default="{ row }">
              {{ row.resolution || '-' }}
            </template>
          </el-table-column>
          
          <el-table-column prop="format" label="格式" width="80" />
          
          <el-table-column prop="uploaderName" label="上传人" width="100" />
          
          <el-table-column prop="uploadedAt" label="上传时间" width="160">
            <template #default="{ row }">
              {{ formatDate(row.uploadedAt) }}
            </template>
          </el-table-column>
          
          <el-table-column label="操作" width="180" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="handlePreview(row)">预览</el-button>
              <el-button link size="small" @click="handleDownload(row)">下载</el-button>
              <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
      
      <div v-if="materials.length > 0 && page * pageSize < total" class="load-more">
        <el-button @click="loadMore" :loading="loading">
          加载更多
        </el-button>
      </div>
      
      <el-empty v-if="!loading && materials.length === 0" description="暂无素材" />
    </div>
    
    <el-dialog
      v-model="previewDialogVisible"
      :title="currentPreviewMaterial?.name"
      width="900px"
      destroy-on-close
    >
      <div v-if="currentPreviewMaterial" class="preview-content">
        <video-preview
          v-if="currentPreviewMaterial.type === 'video'"
          :src="getMaterialPreviewUrl(currentPreviewMaterial.id)"
          :poster="currentPreviewMaterial.thumbnail"
        />
        <audio
          v-else-if="currentPreviewMaterial.type === 'audio'"
          :src="getMaterialPreviewUrl(currentPreviewMaterial.id)"
          controls
          style="width: 100%"
        />
        <img
          v-else-if="currentPreviewMaterial.type === 'image'"
          :src="getMaterialPreviewUrl(currentPreviewMaterial.id)"
          style="max-width: 100%; max-height: 500px; margin: 0 auto; display: block"
        />
        <el-empty v-else description="该类型素材不支持在线预览" />
        
        <el-descriptions :column="2" border style="margin-top: 20px">
          <el-descriptions-item label="素材类型">
            <span class="tag" :class="typeMap[currentPreviewMaterial.type].class">
              {{ typeMap[currentPreviewMaterial.type].text }}
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="文件格式">{{ currentPreviewMaterial.format }}</el-descriptions-item>
          <el-descriptions-item label="文件大小">{{ formatFileSize(currentPreviewMaterial.fileSize) }}</el-descriptions-item>
          <el-descriptions-item label="时长">
            {{ currentPreviewMaterial.duration ? formatDuration(currentPreviewMaterial.duration) : '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="分辨率">{{ currentPreviewMaterial.resolution || '-' }}</el-descriptions-item>
          <el-descriptions-item label="编码格式">{{ currentPreviewMaterial.codec || '-' }}</el-descriptions-item>
          <el-descriptions-item label="上传人">{{ currentPreviewMaterial.uploaderName }}</el-descriptions-item>
          <el-descriptions-item label="上传时间">{{ formatDate(currentPreviewMaterial.uploadedAt) }}</el-descriptions-item>
          <el-descriptions-item label="描述" :span="2">
            {{ currentPreviewMaterial.description || '暂无描述' }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
      
      <template #footer>
        <el-button @click="handleDownload(currentPreviewMaterial!)">
          <el-icon><Download /></el-icon>下载
        </el-button>
        <el-button 
          v-if="currentPreviewMaterial?.type === 'video' || currentPreviewMaterial?.type === 'audio'"
          @click="handleClip(currentPreviewMaterial!)"
        >
          <el-icon><Crop /></el-icon>片段截取
        </el-button>
        <el-button type="primary" @click="previewDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.material-library {
  .upload-progress {
    margin-bottom: 16px;
    padding: 12px 16px;
    background-color: var(--bg-color-card);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    
    span {
      display: block;
      margin-bottom: 8px;
      font-size: 13px;
      color: var(--text-color-secondary);
    }
  }
  
  .filter-section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    padding: 16px;
    background-color: var(--bg-color-card);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-md);
  }
  
  .type-filter {
    display: flex;
    gap: 8px;
  }
  
  .type-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-radius: var(--border-radius-sm);
    background-color: var(--bg-color-secondary);
    color: var(--text-color-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
    
    &:hover {
      color: var(--text-color-primary);
      background-color: var(--bg-color-tertiary);
    }
    
    &.active {
      background-color: rgba(64, 158, 255, 0.1);
      color: var(--primary-color);
      border: 1px solid rgba(64, 158, 255, 0.3);
    }
  }
  
  .search-bar {
    display: flex;
    gap: 12px;
  }
  
  .materials-content {
    min-height: 400px;
  }
  
  .materials-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 16px;
  }
  
  .material-card {
    background-color: var(--bg-color-card);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-md);
    overflow: hidden;
    cursor: pointer;
    transition: all var(--transition-fast);
    
    &:hover {
      transform: translateY(-4px);
      border-color: var(--primary-color);
      box-shadow: var(--shadow-lg);
      
      .material-actions {
        opacity: 1;
      }
    }
  }
  
  .material-thumbnail {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    background-color: var(--bg-color-secondary);
    overflow: hidden;
    
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }
  
  .material-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: space-between;
    padding: 8px;
    background: linear-gradient(to bottom, rgba(0,0,0,0.7), transparent);
  }
  
  .material-duration {
    font-size: 12px;
    color: #fff;
    background-color: rgba(0,0,0,0.6);
    padding: 2px 6px;
    border-radius: 4px;
  }
  
  .material-actions {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    gap: 12px;
    padding: 12px;
    background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
    opacity: 0;
    transition: opacity var(--transition-fast);
  }
  
  .material-info {
    padding: 12px;
  }
  
  .material-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-color-primary);
    margin-bottom: 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .material-meta {
    display: flex;
    gap: 12px;
    font-size: 12px;
    color: var(--text-color-tertiary);
    margin-bottom: 8px;
  }
  
  .material-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
    color: var(--text-color-tertiary);
  }
  
  .materials-list {
    .list-item {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .list-thumbnail {
      width: 60px;
      height: 40px;
      object-fit: cover;
      border-radius: 4px;
    }
  }
  
  .load-more {
    display: flex;
    justify-content: center;
    padding: 24px 0;
  }
  
  .preview-content {
    :deep(.el-descriptions__label) {
      width: 120px;
      color: var(--text-color-tertiary);
    }
    
    :deep(.el-descriptions__content) {
      color: var(--text-color-primary);
    }
  }
  
  .view-toggle {
    margin-left: 12px;
  }
}

@media (max-width: 768px) {
  .material-library {
    .filter-section {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }
    
    .type-filter {
      overflow-x: auto;
      padding-bottom: 4px;
    }
    
    .search-bar {
      .el-input {
        width: 100% !important;
      }
    }
    
    .materials-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }
    
    .material-actions {
      opacity: 1;
    }
  }
}
</style>
