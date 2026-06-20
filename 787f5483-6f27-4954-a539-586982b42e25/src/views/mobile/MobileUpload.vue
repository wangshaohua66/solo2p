<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { formatFileSize, getMaterialType } from '@/utils'

const uploading = ref(false)
const uploadProgress = ref(0)
const selectedFile = ref<File | null>(null)
const uploadForm = ref({
  tags: [] as string[],
  description: ''
})

const popularTags = ['新闻', '专题', '采访', '现场', '航拍', '人物', '风景', '城市']

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
  
  uploading.value = true
  uploadProgress.value = 0
  
  let progress = 0
  const interval = setInterval(() => {
    progress += Math.random() * 15
    if (progress >= 100) {
      progress = 100
      clearInterval(interval)
      
      setTimeout(() => {
        uploading.value = false
        ElMessage.success('上传成功！已自动保存到素材库')
        selectedFile.value = null
        uploadForm.value.tags = []
        uploadForm.value.description = ''
        uploadProgress.value = 0
      }, 500)
    } else {
      uploadProgress.value = Math.floor(progress)
    }
  }, 200)
}

function clearSelection() {
  selectedFile.value = null
}

const fileTypeIcon: Record<string, string> = {
  video: 'VideoPlay',
  audio: 'Headset',
  image: 'Picture',
  document: 'Document'
}
</script>

<template>
  <div class="mobile-upload">
    <div class="upload-options" v-if="!selectedFile">
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
        <el-button type="danger" link size="small" @click="clearSelection">
          <el-icon><Close /></el-icon>移除
        </el-button>
      </div>
    </div>
    
    <div v-if="selectedFile" class="upload-form">
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
      
      <div v-if="uploading" class="progress-section">
        <div class="progress-header">
          <span>上传进度</span>
          <span>{{ uploadProgress }}%</span>
        </div>
        <el-progress :percentage="uploadProgress" :stroke-width="6" />
        <p class="upload-tip" v-if="uploadProgress < 100">
          <el-icon><InfoFilled /></el-icon>
          支持断点续传，请勿关闭页面
        </p>
        <p class="upload-tip success" v-else>
          <el-icon><CircleCheckFilled /></el-icon>
          上传完成，正在处理...
        </p>
      </div>
      
      <el-button
        type="primary"
        size="large"
        style="width: 100%; margin-top: 16px"
        :loading="uploading"
        @click="handleUpload"
      >
        <el-icon><Upload /></el-icon>
        {{ uploading ? '上传中...' : '开始上传' }}
      </el-button>
    </div>
    
    <div class="offline-hint">
      <el-icon><CloudOffline /></el-icon>
      <div class="hint-text">
        <span class="hint-title">支持离线缓存</span>
        <span class="hint-desc">无网络时可先拍摄，联网后自动上传</span>
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
