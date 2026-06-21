<template>
  <div class="media-picker">
    <div class="picker-header">
      <h3>素材库</h3>
      <el-button size="small" type="primary" @click="triggerFileInput">
        <el-icon><Upload /></el-icon>
        上传素材
      </el-button>
      <input
        ref="fileInput"
        type="file"
        multiple
        accept="image/*,video/*"
        style="display: none"
        @change="handleFileSelect"
      />
    </div>

    <div class="filter-bar">
      <el-select
        v-model="filterType"
        placeholder="筛选类型"
        style="width: 100px"
        size="small"
      >
        <el-option label="全部" value="" />
        <el-option label="图片" value="image" />
        <el-option label="视频" value="video" />
      </el-select>
      <el-input
        v-model="searchKeyword"
        placeholder="搜索素材名称"
        clearable
        size="small"
      />
    </div>

    <div class="media-grid" ref="gridRef" @scroll="handleGridScroll">
      <div class="virtual-scroll-spacer" :style="{ height: totalHeight + 'px' }">
        <div class="virtual-scroll-content" :style="{ transform: `translateY(${startOffset}px)` }">
          <div
            v-for="media in visibleMedia"
            :key="media.id"
            class="media-item"
            :class="{ 'is-selected': selectedMediaIds.includes(media.id) }"
            draggable="true"
            @dragstart="handleDragStart($event, media)"
            @click="handleMediaClick(media)"
            @dblclick="handleMediaDoubleClick(media)"
          >
            <div class="media-thumbnail">
              <img
                v-if="media.type === 'image'"
                :src="media.thumbnail || media.url"
                :alt="media.name"
                loading="lazy"
              />
              <video
                v-else
                :src="media.url"
                :poster="media.thumbnail"
                muted
                preload="metadata"
              />
              <div class="media-type-badge">
                <el-icon v-if="media.type === 'image'"><Picture /></el-icon>
                <el-icon v-else><VideoCamera /></el-icon>
              </div>
              <div class="media-overlay">
                <el-button
                  size="small"
                  circle
                  @click.stop="openPreview(media)"
                >
                  <el-icon><View /></el-icon>
                </el-button>
                <el-button
                  size="small"
                  circle
                  type="danger"
                  @click.stop="deleteMedia(media.id)"
                >
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>
            </div>
            <div class="media-info">
              <p class="media-name" :title="media.name">{{ media.name }}</p>
              <p class="media-meta">
                {{ formatFileSize(media.size) }}
                {{ formatDate(media.uploadedAt) }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div v-if="filteredMedia.length === 0" class="empty-state">
        <el-empty description="暂无素材，点击上方按钮上传" />
      </div>
    </div>

    <el-dialog
      v-model="previewVisible"
      :title="previewMedia?.name"
      width="800px"
      destroy-on-close
    >
      <div class="preview-content">
        <img
          v-if="previewMedia?.type === 'image'"
          :src="previewMedia.url"
          :alt="previewMedia.name"
        />
        <video
          v-else
          :src="previewMedia?.url"
          controls
          :start-time="previewMedia?.videoStart || 0"
          style="width: 100%"
        />
      </div>
      <template #footer>
        <el-button @click="previewVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="annotationDialogVisible"
      title="编辑图片标注"
      width="700px"
      destroy-on-close
    >
      <div class="annotation-editor">
      <div class="annotation-preview">
        <div class="image-container" ref="imageContainerRef">
          <img
            :src="annotatingMedia?.url"
            @click="handleImageClick"
            @load="handleImageLoad"
            ref="imageRef"
          />
          <div
            v-for="annotation in annotations"
            :key="annotation.id"
            class="annotation-marker"
            :style="{
              left: annotation.x + '%',
              top: annotation.y + '%'
            }"
            :class="{ 'is-selected': selectedAnnotationId === annotation.id }"
            @click.stop="selectAnnotation(annotation.id)"
          >
            <div class="marker-dot"></div>
            <div
              class="annotation-tooltip"
              :class="'arrow-' + annotation.arrowDirection"
            >
              {{ annotation.text }}
            </div>
          </div>
        </div>
      </div>
      <div class="annotation-form">
        <h4>标注列表</h4>
        <div v-for="(annotation, index) in annotations" class="annotation-item">
          <el-input
            v-model="annotation.text"
            size="small"
            placeholder="标注文字"
            @input="updateAnnotation(annotation)"
          />
          <el-select
            v-model="annotation.arrowDirection"
            size="small"
            style="width: 100px"
            @change="updateAnnotation(annotation)"
          >
            <el-option label="上" value="top" />
            <el-option label="下" value="bottom" />
            <el-option label="左" value="left" />
            <el-option label="右" value="right" />
          </el-select>
          <el-button
            size="small"
            type="danger"
            icon="Delete"
            @click="removeAnnotation(index)"
          />
        </div>
        <el-alert
          v-if="annotations.length === 0"
          title="点击图片添加标注"
          type="info"
          show-icon
          :closable="false"
        />
      </div>
    </div>
    <template #footer>
      <el-button @click="annotationDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="saveAnnotations">保存标注</el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="videoTrimDialogVisible"
    title="截取视频片段"
    width="600px"
    destroy-on-close
  >
    <div class="video-trim-editor">
      <video
        ref="videoRef"
        :src="trimmingMedia?.url"
        controls
        style="width: 100%"
        @timeupdate="handleTimeUpdate"
        @loadedmetadata="handleVideoLoaded"
      />
      <div class="trim-controls">
        <div class="time-inputs">
          <el-form-item label="开始时间">
            <el-input-number
              v-model="videoStartTime"
              :min="0"
              :max="videoDuration"
              :step="0.1"
              size="small"
            />
            <span class="unit">秒</span>
          </el-form-item>
          <el-form-item label="结束时间">
            <el-input-number
              v-model="videoEndTime"
              :min="0"
              :max="videoDuration"
              :step="0.1"
              size="small"
            />
            <span class="unit">秒</span>
          </el-form-item>
        </div>
        <div class="time-range">
          <el-slider
            v-model="videoRange"
            :min="0"
            :max="videoDuration"
            :step="0.1"
            range
            @input="handleRangeChange"
          />
          <div class="time-display">
            选中: {{ formatTime(videoStartTime) }} - {{ formatTime(videoEndTime) }} / 总时长: {{ formatTime(videoDuration) }}
          </div>
        </div>
      </div>
    </div>
    <template #footer>
      <el-button @click="videoTrimDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="saveVideoTrim">保存截取</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Upload, Picture, VideoCamera, View, Delete } from '@element-plus/icons-vue'
import { v4 as uuidv4 } from 'uuid'
import type { MediaItem, MediaAnnotation } from '@/types'
import { validateMediaFile } from '@/utils/validator'

const props = defineProps<{
  mediaList: MediaItem[]
  selectedMediaIds?: string[]
  projectId: string
}>()

const emit = defineEmits<{
  (e: 'addMedia', media: MediaItem): void
  (e: 'removeMedia', mediaId: string): void
  (e: 'updateMedia', media: MediaItem): void
  (e: 'selectMedia', mediaId: string): void
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const gridRef = ref<HTMLElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const imageContainerRef = ref<HTMLElement | null>(null)
const videoRef = ref<HTMLVideoElement | null>(null)

const filterType = ref('')
const searchKeyword = ref('')

const previewVisible = ref(false)
const previewMedia = ref<MediaItem | null>(null)

const annotationDialogVisible = ref(false)
const annotatingMedia = ref<MediaItem | null>(null)
const annotations = ref<MediaAnnotation[]>([])
const selectedAnnotationId = ref<string | null>(null)

const videoTrimDialogVisible = ref(false)
const trimmingMedia = ref<MediaItem | null>(null)
const videoDuration = ref(0)
const videoStartTime = ref(0)
const videoEndTime = ref(0)
const videoRange = ref([0, 0])

const filteredMedia = computed(() => {
  return props.mediaList.filter(media => {
    if (filterType.value && media.type !== filterType.value) {
      return false
    }
    if (searchKeyword.value) {
      return media.name.toLowerCase().includes(searchKeyword.value.toLowerCase())
    }
    return true
  })
})

const ITEM_HEIGHT = 160
const ITEM_WIDTH = 120
const GAP = 12
const BUFFER_ROWS = 3

const scrollTop = ref(0)
const containerWidth = ref(240)
const columns = ref(2)

const rowCount = computed(() => Math.ceil(filteredMedia.value.length / columns.value))
const totalHeight = computed(() => rowCount.value * (ITEM_HEIGHT + GAP) + GAP)
const startRow = computed(() => Math.max(0, Math.floor(scrollTop.value / (ITEM_HEIGHT + GAP)) - BUFFER_ROWS))
const endRow = computed(() => Math.min(rowCount.value, Math.ceil((scrollTop.value + 400) / (ITEM_HEIGHT + GAP)) + BUFFER_ROWS))
const startOffset = computed(() => startRow.value * (ITEM_HEIGHT + GAP))

const visibleMedia = computed(() => {
  const start = startRow.value * columns.value
  const end = endRow.value * columns.value
  return filteredMedia.value.slice(start, end)
})

const calculateColumns = () => {
  if (!gridRef.value) return
  const width = gridRef.value.clientWidth - 24
  const cols = Math.max(1, Math.floor((width + GAP) / (ITEM_WIDTH + GAP)))
  columns.value = cols
  containerWidth.value = width
}

const handleGridScroll = (e: Event) => {
  scrollTop.value = (e.target as HTMLElement).scrollTop
}

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileSelect = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])

  for (const file of files) {
    const validation = validateMediaFile(file)
    if (!validation.valid) {
      ElMessage.error(`${file.name}: ${validation.errors.join(', ')}`)
      continue
    }

    const url = URL.createObjectURL(file)
    const mediaType = file.type.startsWith('image/') ? 'image' : 'video'

    let thumbnail: string | undefined
    if (mediaType === 'video') {
      thumbnail = await generateVideoThumbnail(file)
    } else {
      thumbnail = url
    }

    const media: MediaItem = {
      id: uuidv4(),
      type: mediaType,
      url,
      name: file.name,
      size: file.size,
      thumbnail,
      uploadedAt: Date.now(),
      annotations: []
    }

    emit('addMedia', media)
    ElMessage.success(`已添加 ${file.name}`)
  }

  input.value = ''
}

const generateVideoThumbnail = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.src = URL.createObjectURL(file)
    video.addEventListener('loadeddata', () => {
      video.currentTime = Math.min(1, video.duration / 2)
    })
    video.addEventListener('seeked', () => {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth / 4
      canvas.height = video.videoHeight / 4
      const ctx = canvas.getContext('2d')
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.7))
    })
  })
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString('zh-CN')
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const handleDragStart = (event: DragEvent, media: MediaItem) => {
  event.dataTransfer?.setData('mediaId', media.id)
}

const handleMediaClick = (media: MediaItem) => {
  emit('selectMedia', media.id)
}

const handleMediaDoubleClick = (media: MediaItem) => {
  if (media.type === 'image') {
    openAnnotationDialog(media)
  } else {
    openVideoTrimDialog(media)
  }
}

const openPreview = (media: MediaItem) => {
  previewMedia.value = media
  previewVisible.value = true
}

const deleteMedia = (mediaId: string) => {
  ElMessageBox.confirm('确定要删除这个素材吗？', '确认删除', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    emit('removeMedia', mediaId)
    ElMessage.success('删除成功')
  }).catch(() => {})
}

const openAnnotationDialog = (media: MediaItem) => {
  annotatingMedia.value = media
  annotations.value = JSON.parse(JSON.stringify(media.annotations || []))
  selectedAnnotationId.value = null
  annotationDialogVisible.value = true
}

const openVideoTrimDialog = (media: MediaItem) => {
  trimmingMedia.value = media
  videoStartTime.value = media.videoStart || 0
  videoEndTime.value = media.videoEnd || 0
  videoRange.value = [videoStartTime.value, videoEndTime.value]
  videoTrimDialogVisible.value = true
}

const handleImageLoad = () => {
  nextTick(() => {})
}

const handleImageClick = (event: MouseEvent) => {
  if (!imageContainerRef.value) return
  const rect = imageContainerRef.value.getBoundingClientRect()
  const x = ((event.clientX - rect.left) / rect.width) * 100
  const y = ((event.clientY - rect.top) / rect.height) * 100

  const annotation: MediaAnnotation = {
    id: uuidv4(),
    x,
    y,
    text: '新标注',
    arrowDirection: 'right'
  }

  annotations.value.push(annotation)
  selectedAnnotationId.value = annotation.id
}

const selectAnnotation = (id: string) => {
  selectedAnnotationId.value = id
}

const updateAnnotation = (_annotation: MediaAnnotation) => {
}

const removeAnnotation = (index: number) => {
  annotations.value.splice(index, 1)
}

const saveAnnotations = () => {
  if (annotatingMedia.value) {
    const updatedMedia = {
      ...annotatingMedia.value,
      annotations: JSON.parse(JSON.stringify(annotations.value))
    }
    emit('updateMedia', updatedMedia)
    annotationDialogVisible.value = false
    ElMessage.success('标注已保存')
  }
}

const handleVideoLoaded = () => {
  if (videoRef.value) {
    videoDuration.value = videoRef.value.duration
    if (videoEndTime.value === 0) {
      videoEndTime.value = videoDuration.value
    }
  }
}

const handleTimeUpdate = () => {
}

const handleRangeChange = (val: number[]) => {
  videoStartTime.value = val[0]
  videoEndTime.value = val[1]
}

const saveVideoTrim = () => {
  if (trimmingMedia.value) {
    const updatedMedia = {
      ...trimmingMedia.value,
      videoStart: videoStartTime.value,
      videoEnd: videoEndTime.value
    }
    emit('updateMedia', updatedMedia)
    videoTrimDialogVisible.value = false
    ElMessage.success('视频截取已保存')
  }
}

const handleResize = () => {
  nextTick(() => {
    calculateColumns()
  })
}

onMounted(() => {
  nextTick(() => {
    calculateColumns()
  })
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style lang="scss" scoped>
.media-picker {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
}

.picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e4e7ed;

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #303133;
  }
}

.filter-bar {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.media-grid {
  flex: 1;
  overflow-y: auto;
  position: relative;
  padding: 0;
}

.virtual-scroll-spacer {
  position: relative;
  width: 100%;
}

.virtual-scroll-content {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px;
  align-content: flex-start;
}

.media-item {
  width: calc(50% - 6px);
  min-width: 100px;
  max-width: 140px;
  border: 2px solid transparent;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
  background: #f5f7fa;

  &.is-selected {
    border-color: #409EFF;
    background: #ECF5FF;
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

    .media-overlay {
      opacity: 1;
    }
  }
}

.media-thumbnail {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: #000;

  img, video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.media-type-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 14px;
}

.media-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.media-info {
  padding: 8px;

  .media-name {
    margin: 0 0 4px 0;
    font-size: 12px;
    color: #303133;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .media-meta {
    margin: 0;
    font-size: 11px;
    color: #909399;
  }
}

.empty-state {
  grid-column: 1 / -1;
  padding: 40px 0;
}

.preview-content {
  display: flex;
  justify-content: center;
  align-items: center;

  img {
    max-width: 100%;
    max-height: 60vh;
  }

  video {
    max-height: 60vh;
  }
}

.annotation-editor {
  display: flex;
  gap: 16px;

  .annotation-preview {
    flex: 1;

    .image-container {
      position: relative;
      width: 100%;
      max-height: 400px;
      overflow: auto;
      background: #f5f7fa;

      img {
        max-width: 100%;
        cursor: crosshair;
      }
    }
  }

  .annotation-form {
    width: 280px;
    flex-shrink: 0;

    h4 {
      margin: 0 0 12px 0;
      font-size: 14px;
    }

    .annotation-item {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
    }
  }
}

.annotation-marker {
  position: absolute;
  transform: translate(-50%, -50%);
  cursor: pointer;

  .marker-dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #F56C6C;
    border: 2px solid #fff;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  &.is-selected .marker-dot {
    background: #409EFF;
    transform: scale(1.2);
  }

  .annotation-tooltip {
    position: absolute;
    background: rgba(0, 0, 0, 0.8);
    color: #fff;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    white-space: nowrap;
    pointer-events: none;

    &.arrow-top {
      bottom: calc(100% + 20px);
      left: 50%;
      transform: translateX(-50%);

      &::before {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        width: 2px;
        height: 20px;
        background: #F56C6C;
        transform: translateX(-50%);
      }

      &::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 8px solid #F56C6C;
        transform: translateX(-50%);
      }
    }

    &.arrow-bottom {
      top: calc(100% + 20px);
      left: 50%;
      transform: translateX(-50%);

      &::before {
        content: '';
        position: absolute;
        bottom: 100%;
        left: 50%;
        width: 2px;
        height: 20px;
        background: #F56C6C;
        transform: translateX(-50%);
      }

      &::after {
        content: '';
        position: absolute;
        bottom: 100%;
        left: 50%;
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-bottom: 8px solid #F56C6C;
        transform: translateX(-50%);
      }
    }

    &.arrow-left {
      right: calc(100% + 20px);
      top: 50%;
      transform: translateY(-50%);

      &::before {
        content: '';
        position: absolute;
        left: 100%;
        top: 50%;
        width: 20px;
        height: 2px;
        background: #F56C6C;
        transform: translateY(-50%);
      }

      &::after {
        content: '';
        position: absolute;
        left: 100%;
        top: 50%;
        width: 0;
        height: 0;
        border-top: 6px solid transparent;
        border-bottom: 6px solid transparent;
        border-left: 8px solid #F56C6C;
        transform: translateY(-50%);
      }
    }

    &.arrow-right {
      left: calc(100% + 20px);
      top: 50%;
      transform: translateY(-50%);

      &::before {
        content: '';
        position: absolute;
        right: 100%;
        top: 50%;
        width: 20px;
        height: 2px;
        background: #F56C6C;
        transform: translateY(-50%);
      }

      &::after {
        content: '';
        position: absolute;
        right: 100%;
        top: 50%;
        width: 0;
        height: 0;
        border-top: 6px solid transparent;
        border-bottom: 6px solid transparent;
        border-right: 8px solid #F56C6C;
        transform: translateY(-50%);
      }
    }
  }
}

.video-trim-editor {
  .trim-controls {
    margin-top: 16px;

    .time-inputs {
      display: flex;
      gap: 24px;
      margin-bottom: 16px;
    }

    .time-display {
      margin-top: 8px;
      text-align: center;
      font-size: 14px;
      color: #606266;
    }

    .unit {
      margin-left: 4px;
      font-size: 12px;
      color: #909399;
    }
  }
}
</style>
