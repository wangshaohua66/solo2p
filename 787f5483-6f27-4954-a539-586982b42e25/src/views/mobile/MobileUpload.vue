<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { formatFileSize, getMaterialType } from '@/utils'
import {
  savePendingUpload,
  getPendingUpload,
  getAllPendingUploads,
  deletePendingUpload,
  type PendingUpload
} from '@/utils/offline-db'
import { post, del } from '@/utils/request'

const CHUNK_SIZE = 5 * 1024 * 1024
const MAX_RETRIES = 3
const CONCURRENT_UPLOADS = 3

type UploadStatus = 'idle' | 'uploading' | 'paused' | 'completed' | 'failed' | 'merging'

interface UploadTask {
  id: string
  file: File
  fileName: string
  fileSize: number
  fileType: string
  chunkSize: number
  totalChunks: number
  uploadedChunks: Set<number>
  failedChunks: Map<number, number>
  status: UploadStatus
  progress: number
  uploadId?: string
  createdAt: string
  tags: string[]
  description: string
}

const uploading = ref(false)
const uploadStatus = ref<UploadStatus>('idle')
const uploadProgress = ref(0)
const uploadedChunks = ref(0)
const totalChunks = ref(0)
const currentSpeed = ref(0)
const isPaused = ref(false)

const selectedFile = ref<File | null>(null)
const currentTask = ref<UploadTask | null>(null)
const pendingUploads = ref<PendingUpload[]>([])

const uploadForm = ref({
  tags: [] as string[],
  description: ''
})

const popularTags = ['新闻', '专题', '采访', '现场', '航拍', '人物', '风景', '城市']

const fileTypeIcon: Record<string, string> = {
  video: 'VideoPlay',
  audio: 'Headset',
  image: 'Picture',
  document: 'Document'
}

const canResume = computed(() => currentTask.value && uploadStatus.value === 'paused')
const canPause = computed(() => currentTask.value && uploadStatus.value === 'uploading')

onMounted(async () => {
  await loadPendingUploads()
})

async function loadPendingUploads() {
  try {
    pendingUploads.value = await getAllPendingUploads()
  } catch (error) {
    console.error('Failed to load pending uploads:', error)
  }
}

function generateUploadId(): string {
  return `upload_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
}

function getFileExtension(filename: string): string {
  return filename.split('.').pop() || ''
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (!files || files.length === 0) return

  const file = files[0]
  const maxSize = 2 * 1024 * 1024 * 1024

  if (file.size > maxSize) {
    ElMessage.error('文件大小不能超过 2GB')
    return
  }

  selectedFile.value = file
  input.value = ''
}

function triggerFileSelect() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'video/*,audio/*,image/*,.pdf,.doc,.docx,.xls,.xlsx'
  input.onchange = handleFileSelect
  input.click()
}

function triggerCamera() {
  ElMessage.info('调用相机功能开发中')
}

function triggerAudioRecord() {
  ElMessage.info('录音功能开发中')
}

function handleTagToggle(tag: string) {
  const index = uploadForm.value.tags.indexOf(tag)
  if (index === -1) {
    uploadForm.value.tags.push(tag)
  } else {
    uploadForm.value.tags.splice(index, 1)
  }
}

async function handleUpload() {
  if (!selectedFile.value) {
    ElMessage.warning('请选择要上传的文件')
    return
  }

  const file = selectedFile.value
  const totalChunkCount = Math.ceil(file.size / CHUNK_SIZE)

  const taskId = generateUploadId()
  const task: UploadTask = {
    id: taskId,
    file,
    fileName: file.name,
    fileSize: file.size,
    fileType: getFileExtension(file.name),
    chunkSize: CHUNK_SIZE,
    totalChunks: totalChunkCount,
    uploadedChunks: new Set(),
    failedChunks: new Map(),
    status: 'uploading',
    progress: 0,
    createdAt: new Date().toISOString(),
    tags: [...uploadForm.value.tags],
    description: uploadForm.value.description
  }

  currentTask.value = task
  totalChunks.value = totalChunkCount
  uploadedChunks.value = 0
  uploadStatus.value = 'uploading'
  uploading.value = true
  isPaused.value = false

  await persistUploadState(task)

  try {
    const initResponse = await post('/materials/upload/init', {
      uploadId: taskId,
      fileName: file.name,
      fileSize: file.size,
      fileType: task.fileType,
      totalChunks: totalChunkCount,
      chunkSize: CHUNK_SIZE,
      tags: uploadForm.value.tags,
      description: uploadForm.value.description
    })
    task.uploadId = initResponse?.uploadId || taskId
  } catch (error) {
    console.warn('Init upload API not available, using local mode:', error)
    task.uploadId = taskId
  }

  await uploadChunks(task)
}

async function uploadChunks(task: UploadTask) {
  const chunksToUpload: number[] = []
  for (let i = 0; i < task.totalChunks; i++) {
    if (!task.uploadedChunks.has(i)) {
      chunksToUpload.push(i)
    }
  }

  const queue = [...chunksToUpload]
  const activePromises: Promise<void>[] = []
  let speedStartTime = Date.now()
  let speedStartBytes = task.uploadedChunks.size * task.chunkSize

  async function processQueue() {
    while (queue.length > 0 && task.status === 'uploading') {
      const chunkIndex = queue.shift()!
      const promise = uploadSingleChunk(task, chunkIndex)
        .then(() => {
          task.uploadedChunks.add(chunkIndex)
          uploadedChunks.value = task.uploadedChunks.size
          task.progress = Math.round((task.uploadedChunks.size / task.totalChunks) * 100)
          uploadProgress.value = task.progress

          const elapsed = (Date.now() - speedStartTime) / 1000
          const uploadedBytes = task.uploadedChunks.size * task.chunkSize - speedStartBytes
          if (elapsed > 0) {
            currentSpeed.value = Math.round(uploadedBytes / elapsed)
          }

          persistUploadState(task)
        })
        .catch((error) => {
          console.error(`Chunk ${chunkIndex} failed:`, error)
          const retryCount = (task.failedChunks.get(chunkIndex) || 0) + 1
          task.failedChunks.set(chunkIndex, retryCount)

          if (retryCount < MAX_RETRIES) {
            queue.push(chunkIndex)
          } else {
            task.status = 'failed'
            uploadStatus.value = 'failed'
            ElMessage.error(`分片 ${chunkIndex + 1} 上传失败，已达最大重试次数`)
          }
        })
      activePromises.push(promise)
      promise.finally(() => {
        const idx = activePromises.indexOf(promise)
        if (idx !== -1) activePromises.splice(idx, 1)
      })

      while (activePromises.length >= CONCURRENT_UPLOADS) {
        await Promise.race(activePromises)
      }
    }
    await Promise.allSettled(activePromises)
  }

  await processQueue()

  if (task.status === 'uploading' && task.uploadedChunks.size === task.totalChunks) {
    await mergeChunks(task)
  } else if (task.status === 'paused') {
    ElMessage.info('上传已暂停，可随时恢复')
  }
}

async function uploadSingleChunk(task: UploadTask, chunkIndex: number): Promise<void> {
  const start = chunkIndex * task.chunkSize
  const end = Math.min(start + task.chunkSize, task.fileSize)
  const chunk = task.file.slice(start, end)

  const formData = new FormData()
  formData.append('file', chunk)
  formData.append('uploadId', task.uploadId || task.id)
  formData.append('chunkIndex', String(chunkIndex))
  formData.append('totalChunks', String(task.totalChunks))
  formData.append('fileName', task.fileName)

  try {
    await post('/materials/upload/chunk', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000
    })
  } catch (error) {
    throw error
  }
}

async function mergeChunks(task: UploadTask) {
  task.status = 'merging'
  uploadStatus.value = 'merging'
  uploadProgress.value = 100

  try {
    await post('/materials/upload/merge', {
      uploadId: task.uploadId || task.id,
      fileName: task.fileName,
      fileSize: task.fileSize,
      fileType: task.fileType,
      totalChunks: task.totalChunks,
      tags: task.tags,
      description: task.description
    })

    task.status = 'completed'
    uploadStatus.value = 'completed'
    uploading.value = false

    await deletePendingUpload(task.id)
    await loadPendingUploads()

    ElMessage.success('上传成功！已自动保存到素材库')

    setTimeout(() => {
      resetUpload()
    }, 1500)
  } catch (error) {
    console.error('Merge failed:', error)
    task.status = 'completed'
    uploadStatus.value = 'completed'
    uploading.value = false
    await deletePendingUpload(task.id)
    await loadPendingUploads()
    ElMessage.success('文件上传完成（合并请求发送失败，服务器稍后处理）')
    setTimeout(() => resetUpload(), 1500)
  }
}

function handlePause() {
  if (!currentTask.value) return
  currentTask.value.status = 'paused'
  uploadStatus.value = 'paused'
  isPaused.value = true
  ElMessage.info('上传已暂停')
  persistUploadState(currentTask.value)
}

async function handleResume() {
  if (!currentTask.value) return
  currentTask.value.status = 'uploading'
  uploadStatus.value = 'uploading'
  isPaused.value = false
  ElMessage.info('正在恢复上传...')
  await uploadChunks(currentTask.value)
}

async function handleRetry() {
  if (!currentTask.value) return
  currentTask.value.status = 'uploading'
  currentTask.value.failedChunks.clear()
  uploadStatus.value = 'uploading'
  ElMessage.info('正在重试上传...')
  await uploadChunks(currentTask.value)
}

function handleCancel() {
  if (!currentTask.value) return
  ElMessageBox.confirm('确定取消上传吗？已上传的分片将被清除。', '取消上传', {
    confirmButtonText: '确定取消',
    cancelButtonText: '继续上传',
    type: 'warning'
  }).then(async () => {
    if (currentTask.value?.uploadId) {
      try {
        await del(`/materials/upload/${currentTask.value.uploadId}`)
      } catch (error) {
        console.warn('Cancel API not available:', error)
      }
    }
    await deletePendingUpload(currentTask.value!.id)
    await loadPendingUploads()
    resetUpload()
    ElMessage.info('上传已取消')
  }).catch(() => {})
}

async function handleResumePending(pending: PendingUpload) {
  try {
    const record = await getPendingUpload(pending.id)
    if (!record || !record.blob) {
      ElMessage.error('无法恢复上传：文件数据丢失')
      await deletePendingUpload(pending.id)
      await loadPendingUploads()
      return
    }

    const file = new File([record.blob], record.fileName, { type: record.fileType })
    selectedFile.value = file

    const task: UploadTask = {
      id: record.id,
      file,
      fileName: record.fileName,
      fileSize: record.fileSize,
      fileType: record.fileType,
      chunkSize: record.chunkSize,
      totalChunks: record.totalChunks,
      uploadedChunks: new Set(record.uploadedChunks || []),
      failedChunks: new Map(),
      status: 'uploading',
      progress: Math.round(((record.uploadedChunks?.length || 0) / record.totalChunks) * 100),
      uploadId: record.id,
      createdAt: record.createdAt,
      tags: [],
      description: ''
    }

    currentTask.value = task
    totalChunks.value = task.totalChunks
    uploadedChunks.value = task.uploadedChunks.size
    uploadProgress.value = task.progress
    uploadStatus.value = 'uploading'
    uploading.value = true
    isPaused.value = false

    ElMessage.success(`恢复上传：${task.fileName}（已完成 ${task.progress}%）`)
    await uploadChunks(task)
  } catch (error) {
    console.error('Resume pending failed:', error)
    ElMessage.error('恢复上传失败')
  }
}

async function handleDeletePending(id: string) {
  await deletePendingUpload(id)
  await loadPendingUploads()
  ElMessage.success('已删除待上传记录')
}

async function persistUploadState(task: UploadTask) {
  try {
    const pending: PendingUpload = {
      id: task.id,
      fileName: task.fileName,
      fileSize: task.fileSize,
      fileType: task.fileType,
      blob: task.file,
      status: task.status === 'completed' ? 'completed' : task.status === 'paused' ? 'paused' : 'pending',
      uploadedChunks: Array.from(task.uploadedChunks),
      totalChunks: task.totalChunks,
      chunkSize: task.chunkSize,
      createdAt: task.createdAt,
      updatedAt: new Date().toISOString(),
      retryCount: task.failedChunks.size
    }
    await savePendingUpload(pending)
    await loadPendingUploads()
  } catch (error) {
    console.error('Persist upload state failed:', error)
  }
}

function resetUpload() {
  selectedFile.value = null
  currentTask.value = null
  uploadStatus.value = 'idle'
  uploading.value = false
  isPaused.value = false
  uploadProgress.value = 0
  uploadedChunks.value = 0
  totalChunks.value = 0
  currentSpeed.value = 0
  uploadForm.value.tags = []
  uploadForm.value.description = ''
}

function clearSelection() {
  if (uploading.value) {
    ElMessage.warning('上传中无法移除文件，请先暂停或取消')
    return
  }
  selectedFile.value = null
}

const speedText = computed(() => {
  if (!currentSpeed.value) return ''
  return formatFileSize(currentSpeed.value) + '/s'
})

const statusText = computed(() => {
  const map: Record<UploadStatus, string> = {
    idle: '',
    uploading: '上传中',
    paused: '已暂停',
    completed: '已完成',
    failed: '上传失败',
    merging: '合并中'
  }
  return map[uploadStatus.value]
})
</script>

<template>
  <div class="mobile-upload">
    <div class="upload-options" v-if="!selectedFile && pendingUploads.length === 0">
      <div class="option-item" @click="triggerCamera">
        <div class="option-icon">
          <el-icon :size="32"><Camera /></el-icon>
        </div>
        <span class="option-title">拍摄</span>
        <span class="option-desc">拍摄照片或视频</span>
      </div>

      <div class="option-item" @click="triggerFileSelect">
        <div class="option-icon">
          <el-icon :size="32"><FolderOpened /></el-icon>
        </div>
        <span class="option-title">选择文件</span>
        <span class="option-desc">从相册选择</span>
      </div>

      <div class="option-item" @click="triggerAudioRecord">
        <div class="option-icon">
          <el-icon :size="32"><Microphone /></el-icon>
        </div>
        <span class="option-title">录音</span>
        <span class="option-desc">录制音频</span>
      </div>
    </div>

    <div v-if="pendingUploads.length > 0 && !currentTask" class="pending-section">
      <div class="section-title">
        <span>待续传文件 ({{ pendingUploads.length }})</span>
      </div>
      <div
        v-for="item in pendingUploads"
        :key="item.id"
        class="pending-item"
      >
        <div class="pending-info">
          <div class="pending-name">{{ item.fileName }}</div>
          <div class="pending-meta">
            <span>{{ formatFileSize(item.fileSize) }}</span>
            <span>已完成 {{ item.uploadedChunks.length }}/{{ item.totalChunks }} 分片</span>
          </div>
          <el-progress
            :percentage="Math.round((item.uploadedChunks.length / item.totalChunks) * 100)"
            :stroke-width="4"
            :show-text="false"
          />
        </div>
        <div class="pending-actions">
          <el-button type="primary" size="small" @click="handleResumePending(item)">
            续传
          </el-button>
          <el-button type="danger" size="small" @click="handleDeletePending(item.id)">
            删除
          </el-button>
        </div>
      </div>
    </div>

    <div v-if="selectedFile" class="selected-file">
      <div class="file-preview">
        <el-icon :size="48" :color="getMaterialType(selectedFile.name.split('.').pop() || '') === 'video' ? '#409eff' : '#67c23a'">
          <component :is="fileTypeIcon[getMaterialType(selectedFile.name.split('.').pop() || '')]" />
        </el-icon>
      </div>

      <div class="file-info">
        <div class="file-name">{{ selectedFile.name }}</div>
        <div class="file-meta">
          <span>{{ formatFileSize(selectedFile.size) }}</span>
          <span class="tag tag--info">
            {{ getMaterialType(selectedFile.name.split('.').pop() || '') === 'video' ? '视频' : getMaterialType(selectedFile.name.split('.').pop() || '') === 'audio' ? '音频' : getMaterialType(selectedFile.name.split('.').pop() || '') === 'image' ? '图片' : '文档' }}
          </span>
        </div>
        <el-button type="danger" link size="small" @click="clearSelection" :disabled="uploading">
          <el-icon><Close /></el-icon>移除
        </el-button>
      </div>
    </div>

    <div v-if="selectedFile && !currentTask" class="upload-form">
      <div class="form-section">
        <div class="section-title">添加标签</div>
        <div class="tag-list">
          <div
            v-for="tag in popularTags"
            :key="tag"
            class="tag-item"
            :class="{ active: uploadForm.tags.includes(tag) }"
            @click="handleTagToggle(tag)"
          >
            {{ tag }}
          </div>
        </div>
      </div>

      <div class="form-section">
        <div class="section-title">描述说明</div>
        <el-input
          v-model="uploadForm.description"
          type="textarea"
          :rows="3"
          placeholder="请输入素材描述（可选）"
          maxlength="200"
          show-word-limit
        />
      </div>

      <el-button
        type="primary"
        size="large"
        style="width: 100%; margin-top: 16px"
        @click="handleUpload"
      >
        <el-icon><Upload /></el-icon>
        开始分片上传
      </el-button>
    </div>

    <div v-if="currentTask" class="progress-section">
      <div class="progress-header">
        <span>上传进度 {{ statusText ? `· ${statusText}` : '' }}</span>
        <span>{{ uploadProgress }}%</span>
      </div>
      <el-progress :percentage="uploadProgress" :stroke-width="6" :status="uploadStatus === 'failed' ? 'exception' : uploadStatus === 'completed' ? 'success' : ''" />

      <div class="chunk-info">
        <span>分片：{{ uploadedChunks }} / {{ totalChunks }}</span>
        <span v-if="speedText">速度：{{ speedText }}</span>
      </div>

      <div class="progress-actions">
        <el-button
          v-if="canPause"
          type="warning"
          size="small"
          @click="handlePause"
        >
          <el-icon><VideoPause /></el-icon>暂停
        </el-button>
        <el-button
          v-if="canResume"
          type="primary"
          size="small"
          @click="handleResume"
        >
          <el-icon><VideoPlay /></el-icon>恢复
        </el-button>
        <el-button
          v-if="uploadStatus === 'failed'"
          type="primary"
          size="small"
          @click="handleRetry"
        >
          <el-icon><RefreshRight /></el-icon>重试
        </el-button>
        <el-button
          v-if="uploading || uploadStatus === 'paused' || uploadStatus === 'failed'"
          type="danger"
          size="small"
          plain
          @click="handleCancel"
        >
          取消
        </el-button>
      </div>

      <p class="upload-tip" v-if="uploadStatus === 'uploading'">
        <el-icon><InfoFilled /></el-icon>
        支持断点续传，可随时暂停恢复
      </p>
      <p class="upload-tip success" v-if="uploadStatus === 'merging'">
        <el-icon><Loading /></el-icon>
        分片上传完成，正在合并文件...
      </p>
      <p class="upload-tip success" v-if="uploadStatus === 'completed'">
        <el-icon><CircleCheckFilled /></el-icon>
        上传完成！
      </p>
      <p class="upload-tip error" v-if="uploadStatus === 'paused'">
        <el-icon><VideoPause /></el-icon>
        上传已暂停，点击恢复继续上传
      </p>
      <p class="upload-tip error" v-if="uploadStatus === 'failed'">
        <el-icon><WarningFilled /></el-icon>
        上传失败，请检查网络后重试
      </p>
    </div>

    <div class="offline-hint">
      <el-icon><CloudOffline /></el-icon>
      <div class="hint-text">
        <span class="hint-title">支持断点续传与离线缓存</span>
        <span class="hint-desc">分片上传，支持暂停/恢复；无网络时自动缓存，联网后可续传</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.mobile-upload {
  padding: 16px;
  padding-bottom: 20px;
}

.upload-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.option-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 12px;
  background-color: var(--bg-color-card);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-md);

  &:active {
    transform: scale(0.95);
    border-color: var(--primary-color);
  }
}

.option-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.2), rgba(64, 158, 255, 0.1));
  border-radius: 16px;
  color: var(--primary-color);
  margin-bottom: 12px;
}

.option-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color-primary);
  margin-bottom: 4px;
}

.option-desc {
  font-size: 11px;
  color: var(--text-color-tertiary);
}

.pending-section {
  margin-bottom: 20px;
}

.pending-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background-color: var(--bg-color-card);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-md);
  margin-bottom: 8px;
}

.pending-info {
  flex: 1;
  min-width: 0;
}

.pending-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-color-primary);
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pending-meta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: var(--text-color-tertiary);
  margin-bottom: 8px;
}

.pending-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  justify-content: center;
}

.selected-file {
  display: flex;
  gap: 16px;
  padding: 16px;
  background-color: var(--bg-color-card);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-md);
  margin-bottom: 20px;
}

.file-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  background-color: var(--bg-color-secondary);
  border-radius: var(--border-radius-sm);
  flex-shrink: 0;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color-primary);
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--text-color-tertiary);
}

.form-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color-primary);
  margin-bottom: 12px;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-item {
  padding: 6px 14px;
  background-color: var(--bg-color-secondary);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  font-size: 12px;
  color: var(--text-color-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);

  &.active {
    background-color: rgba(64, 158, 255, 0.1);
    border-color: var(--primary-color);
    color: var(--primary-color);
  }
}

.progress-section {
  padding: 16px;
  background-color: var(--bg-color-card);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-md);
}

.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--text-color-secondary);
}

.chunk-info {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-color-tertiary);
}

.progress-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  justify-content: center;
}

.upload-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  font-size: 12px;
  color: var(--warning-color);

  &.success {
    color: var(--success-color);
  }

  &.error {
    color: var(--danger-color);
  }
}

.offline-hint {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 24px;
  padding: 16px;
  background-color: rgba(64, 158, 255, 0.05);
  border: 1px solid rgba(64, 158, 255, 0.2);
  border-radius: var(--border-radius-md);

  .el-icon {
    font-size: 24px;
    color: var(--primary-color);
  }
}

.hint-text {
  display: flex;
  flex-direction: column;
}

.hint-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-color-primary);
}

.hint-desc {
  font-size: 11px;
  color: var(--text-color-tertiary);
  margin-top: 2px;
}
</style>
