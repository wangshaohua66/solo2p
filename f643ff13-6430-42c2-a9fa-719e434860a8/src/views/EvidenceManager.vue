<template>
  <div class="evidence-manager" :class="{ compact }">
    <div v-if="!compact" class="evidence-header">
      <h2 class="section-title">证据管理</h2>
      <div class="header-actions">
        <input
          type="file"
          ref="fileInput"
          class="file-input"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.gif,.mp4,.avi,.mov,.mp3,.wav,.doc,.docx,.txt"
          @change="handleFileUpload"
          hidden
        />
        <button class="btn-upload" @click="triggerUpload">
          📤 上传证据
        </button>
        <input
          v-model="searchQuery"
          type="text"
          class="search-input"
          placeholder="搜索证据..."
        />
      </div>
    </div>

    <div class="evidence-content">
      <div v-if="!compact" class="evidence-sidebar">
        <div class="type-filters">
          <button
            v-for="filter in typeFilters"
            :key="filter.value"
            class="filter-btn"
            :class="{ active: activeFilter === filter.value }"
            @click="activeFilter = filter.value"
          >
            <span class="filter-icon">{{ filter.icon }}</span>
            {{ filter.label }}
            <span class="filter-count">{{ getFilterCount(filter.value) }}</span>
          </button>
        </div>

        <div class="evidence-list">
          <div
            v-for="evidence in filteredEvidence"
            :key="evidence.id"
            class="evidence-item"
            :class="{ selected: evidenceStore.selectedEvidenceId === evidence.id }"
            @click="selectEvidence(evidence.id)"
          >
            <div class="evidence-icon">{{ getTypeIcon(evidence.type) }}</div>
            <div class="evidence-info">
              <div class="evidence-name" :title="evidence.name">{{ evidence.name }}</div>
              <div class="evidence-meta">
                <span>{{ formatFileSize(evidence.fileSize) }}</span>
                <span v-if="evidence.duration">{{ formatDuration(evidence.duration) }}</span>
              </div>
            </div>
            <button
              class="delete-btn"
              @click.stop="deleteEvidence(evidence.id)"
              title="删除"
            >
              ✕
            </button>
          </div>
          <div v-if="filteredEvidence.length === 0" class="empty-list">
            暂无证据
          </div>
        </div>
      </div>

      <div class="evidence-preview" v-if="evidenceStore.selectedEvidence">
        <div class="preview-header" v-if="!compact">
          <h3 class="preview-title">{{ evidenceStore.selectedEvidence.name }}</h3>
          <div class="preview-actions">
            <button
              class="action-btn"
              @click="rotateLeft"
              title="向左旋转"
              :disabled="!canRotate"
            >
              ↺
            </button>
            <button
              class="action-btn"
              @click="rotateRight"
              title="向右旋转"
              :disabled="!canRotate"
            >
              ↻
            </button>
            <button
              class="action-btn"
              @click="zoomOut"
              title="缩小"
              :disabled="!canZoom"
            >
              −
            </button>
            <span class="zoom-level">{{ Math.round(evidenceStore.selectedEvidence.scale * 100) }}%</span>
            <button
              class="action-btn"
              @click="zoomIn"
              title="放大"
              :disabled="!canZoom"
            >
              +
            </button>
            <button
              class="action-btn"
              @click="resetView"
              title="重置视图"
            >
              ⟲
            </button>
            <button
              class="action-btn fullscreen"
              @click="toggleFullscreen"
              title="全屏"
            >
              ⛶
            </button>
          </div>
        </div>

        <div class="preview-content" ref="previewRef">
          <div v-if="evidenceStore.selectedEvidence.type === 'pdf'" class="pdf-preview">
            <canvas ref="pdfCanvas" class="pdf-canvas"></canvas>
            <div class="pdf-controls">
              <button @click="prevPage" :disabled="currentPage <= 1">上一页</button>
              <span>第 {{ currentPage }} / {{ totalPages }} 页</span>
              <button @click="nextPage" :disabled="currentPage >= totalPages">下一页</button>
            </div>
          </div>

          <div
            v-else-if="evidenceStore.selectedEvidence.type === 'image'"
            class="image-preview"
          >
            <img
              :src="evidenceStore.selectedEvidence.blobUrl || evidenceStore.selectedEvidence.dataUrl"
              :alt="evidenceStore.selectedEvidence.name"
              :style="imageStyle"
            />
          </div>

          <div
            v-else-if="evidenceStore.selectedEvidence.type === 'video'"
            class="video-preview"
          >
            <video
              ref="videoRef"
              :src="evidenceStore.selectedEvidence.blobUrl || evidenceStore.selectedEvidence.dataUrl"
              controls
              @timeupdate="handleVideoTimeUpdate"
              @loadedmetadata="handleMediaLoaded"
              @play="handlePlay"
              @pause="handlePause"
            ></video>
            <div v-if="!compact" class="media-info">
              <span>时长：{{ formatDuration(videoDuration || evidenceStore.selectedEvidence.duration || 0) }}</span>
              <span>当前：{{ formatDuration(currentMediaTime) }}</span>
            </div>
          </div>

          <div
            v-else-if="evidenceStore.selectedEvidence.type === 'audio'"
            class="audio-preview"
          >
            <div class="waveform" ref="waveformRef"></div>
            <audio
              ref="audioRef"
              :src="evidenceStore.selectedEvidence.blobUrl || evidenceStore.selectedEvidence.dataUrl"
              controls
              @timeupdate="handleAudioTimeUpdate"
              @loadedmetadata="handleMediaLoaded"
            ></audio>
            <div v-if="!compact" class="media-info">
              <span>时长：{{ formatDuration(audioDuration || evidenceStore.selectedEvidence.duration || 0) }}</span>
              <span>当前：{{ formatDuration(currentMediaTime) }}</span>
            </div>
          </div>

          <div v-else class="document-preview">
            <div class="doc-icon">📄</div>
            <p>{{ evidenceStore.selectedEvidence.name }}</p>
            <p class="doc-type">{{ evidenceStore.selectedEvidence.mimeType }}</p>
            <button class="btn-download" @click="downloadEvidence">
              下载查看
            </button>
          </div>
        </div>

        <div v-if="!compact && evidenceStore.selectedEvidence.annotations.length > 0" class="evidence-annotations">
          <h4>证据标注</h4>
          <div
            v-for="ann in evidenceStore.selectedEvidence.annotations"
            :key="ann.id"
            class="annotation-item"
          >
            <span class="annotation-type">{{ getAnnotationTypeLabel(ann.type) }}</span>
            <span class="annotation-content">{{ ann.content }}</span>
            <span class="annotation-creator">{{ getRoleName(ann.createdBy) }}</span>
          </div>
        </div>
      </div>

      <div v-else class="empty-preview">
        <div class="empty-icon">📁</div>
        <p>{{ compact ? '选择证据以预览' : '请选择或上传证据' }}</p>
      </div>
    </div>

    <div v-if="evidenceStore.isLoading" class="loading-overlay">
      <div class="loading-content">
        <div class="spinner"></div>
        <p>上传中... {{ evidenceStore.uploadProgress }}%</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick, onUnmounted } from 'vue'
import { useEvidenceStore } from '@/stores/evidenceStore'
import { useTranscriptStore } from '@/stores/transcriptStore'
import { formatDuration, getRoleName, downloadFile, dataUrlToBlob } from '@/utils/storage'
import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`

interface Props {
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  compact: false
})

const evidenceStore = useEvidenceStore()
const transcriptStore = useTranscriptStore()

const fileInput = ref<HTMLInputElement | null>(null)
const previewRef = ref<HTMLElement | null>(null)
const pdfCanvas = ref<HTMLCanvasElement | null>(null)
const videoRef = ref<HTMLVideoElement | null>(null)
const audioRef = ref<HTMLAudioElement | null>(null)
const waveformRef = ref<HTMLElement | null>(null)

const searchQuery = ref('')
const activeFilter = ref('all')
const currentPage = ref(1)
const totalPages = ref(0)
const pdfDoc = ref<PDFDocumentProxy | null>(null)
const videoDuration = ref(0)
const audioDuration = ref(0)
const currentMediaTime = ref(0)
const isPlaying = ref(false)

const typeFilters = [
  { value: 'all', label: '全部', icon: '📁' },
  { value: 'pdf', label: 'PDF', icon: '📄' },
  { value: 'image', label: '图片', icon: '🖼️' },
  { value: 'video', label: '视频', icon: '🎬' },
  { value: 'audio', label: '音频', icon: '🎵' },
  { value: 'document', label: '文档', icon: '📑' }
]

const filteredEvidence = computed(() => {
  let evidence = evidenceStore.searchEvidence(searchQuery.value)
  if (activeFilter.value !== 'all') {
    evidence = evidence.filter(e => e.type === activeFilter.value)
  }
  return evidence
})

const canRotate = computed(() => {
  return evidenceStore.selectedEvidence?.type === 'image'
})

const canZoom = computed(() => {
  return ['image', 'pdf'].includes(evidenceStore.selectedEvidence?.type || '')
})

const imageStyle = computed(() => {
  const evidence = evidenceStore.selectedEvidence
  if (!evidence) return {}
  return {
    transform: `rotate(${evidence.rotation}deg) scale(${evidence.scale})`,
    transition: 'transform 0.2s ease'
  }
})

watch(
  () => evidenceStore.selectedEvidenceId,
  async (newId) => {
    if (newId) {
      currentPage.value = 1
      totalPages.value = 0
      pdfDoc.value = null
      currentMediaTime.value = 0

      const evidence = evidenceStore.getEvidenceById(newId)
      if (evidence?.type === 'pdf' && evidence.dataUrl) {
        await loadPdf(evidence.dataUrl)
      }

      if (evidence?.type === 'video' && evidence.currentTime !== undefined) {
        nextTick(() => {
          if (videoRef.value) {
            videoRef.value.currentTime = evidence.currentTime / 1000
          }
        })
      }
    }
  }
)

watch(
  () => transcriptStore.currentTime,
  (newTime) => {
    if (isPlaying.value) return

    const evidence = evidenceStore.selectedEvidence
    if (evidence?.type === 'video' && videoRef.value) {
      const timeDiff = Math.abs((videoRef.value.currentTime * 1000) - newTime)
      if (timeDiff > 2000) {
        videoRef.value.currentTime = newTime / 1000
      }
    } else if (evidence?.type === 'audio' && audioRef.value) {
      const timeDiff = Math.abs((audioRef.value.currentTime * 1000) - newTime)
      if (timeDiff > 2000) {
        audioRef.value.currentTime = newTime / 1000
      }
    }
  }
)

onMounted(() => {
  if (evidenceStore.evidenceList.length === 0 && !props.compact) {
    addDemoEvidence()
  }
})

onUnmounted(() => {
  if (pdfDoc.value) {
    pdfDoc.value.destroy()
  }
})

const addDemoEvidence = async () => {
  const demoFiles = [
    { name: '起诉书.pdf', type: 'pdf' as const, mimeType: 'application/pdf' },
    { name: '现场照片.jpg', type: 'image' as const, mimeType: 'image/jpeg' },
    { name: '被告人供述.mp3', type: 'audio' as const, mimeType: 'audio/mpeg' }
  ]

  for (const file of demoFiles) {
    const evidence = {
      id: `demo-${file.type}-${Date.now()}`,
      name: file.name,
      type: file.type,
      fileSize: Math.floor(Math.random() * 1000000) + 100000,
      mimeType: file.mimeType,
      rotation: 0,
      scale: 1,
      annotations: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    if (file.type === 'image') {
      const canvas = document.createElement('canvas')
      canvas.width = 800
      canvas.height = 600
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#f0f0f0'
        ctx.fillRect(0, 0, 800, 600)
        ctx.fillStyle = '#333'
        ctx.font = '24px Arial'
        ctx.fillText('证据照片 - 现场勘查', 250, 300)
        ctx.font = '16px Arial'
        ctx.fillText('拍摄时间：2024-01-15 14:30', 280, 340)
        evidence.dataUrl = canvas.toDataURL('image/jpeg')
        evidence.blobUrl = evidence.dataUrl
      }
    }

    evidenceStore.evidenceList.unshift(evidence)
  }

  evidenceStore.saveToStorage()
}

const triggerUpload = () => {
  fileInput.value?.click()
}

const handleFileUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (files && files.length > 0) {
    await evidenceStore.uploadMultipleEvidence(Array.from(files))
  }
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

const selectEvidence = (id: string) => {
  evidenceStore.selectEvidence(id)

  const evidence = evidenceStore.getEvidenceById(id)
  if (evidence) {
    const time = evidence.createdAt - transcriptStore.startTime
    if (time > 0) {
      transcriptStore.setCurrentTime(time)
    }
  }
}

const deleteEvidence = (id: string) => {
  if (confirm('确定要删除这份证据吗？')) {
    evidenceStore.deleteEvidence(id)
  }
}

const getFilterCount = (type: string) => {
  if (type === 'all') return evidenceStore.evidenceList.length
  return evidenceStore.evidenceList.filter(e => e.type === type).length
}

const getTypeIcon = (type: string) => {
  const icons: Record<string, string> = {
    pdf: '📄',
    image: '🖼️',
    video: '🎬',
    audio: '🎵',
    document: '📑'
  }
  return icons[type] || '📁'
}

const getAnnotationTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    highlight: '高亮',
    comment: '批注',
    signature: '签名'
  }
  return labels[type] || type
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const rotateLeft = () => {
  if (evidenceStore.selectedEvidenceId) {
    evidenceStore.rotateEvidence(evidenceStore.selectedEvidenceId, -90)
  }
}

const rotateRight = () => {
  if (evidenceStore.selectedEvidenceId) {
    evidenceStore.rotateEvidence(evidenceStore.selectedEvidenceId, 90)
  }
}

const zoomIn = () => {
  if (evidenceStore.selectedEvidence) {
    evidenceStore.scaleEvidence(evidenceStore.selectedEvidenceId, evidenceStore.selectedEvidence.scale + 0.25)
  }
}

const zoomOut = () => {
  if (evidenceStore.selectedEvidence) {
    evidenceStore.scaleEvidence(evidenceStore.selectedEvidenceId, evidenceStore.selectedEvidence.scale - 0.25)
  }
}

const resetView = () => {
  if (evidenceStore.selectedEvidenceId) {
    evidenceStore.updateEvidence(evidenceStore.selectedEvidenceId, {
      rotation: 0,
      scale: 1
    })
    currentPage.value = 1
    renderPdfPage(currentPage.value)
  }
}

const toggleFullscreen = () => {
  if (!previewRef.value) return

  if (!document.fullscreenElement) {
    previewRef.value.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

const loadPdf = async (dataUrl: string) => {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: dataUrl.split(',')[1] })
    pdfDoc.value = await loadingTask.promise
    totalPages.value = pdfDoc.value.numPages
    renderPdfPage(currentPage.value)
  } catch (error) {
    console.error('Failed to load PDF:', error)
  }
}

const renderPdfPage = async (pageNum: number) => {
  if (!pdfDoc.value || !pdfCanvas.value) return

  try {
    const page = await pdfDoc.value.getPage(pageNum)
    const viewport = page.getViewport({ scale: 1.5 * (evidenceStore.selectedEvidence?.scale || 1) })
    const canvas = pdfCanvas.value
    const context = canvas.getContext('2d')

    if (context) {
      canvas.height = viewport.height
      canvas.width = viewport.width

      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise
    }
  } catch (error) {
    console.error('Failed to render PDF page:', error)
  }
}

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
    renderPdfPage(currentPage.value)
  }
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    renderPdfPage(currentPage.value)
  }
}

const handleVideoTimeUpdate = () => {
  if (videoRef.value) {
    currentMediaTime.value = videoRef.value.currentTime * 1000
    if (evidenceStore.selectedEvidenceId && isPlaying.value) {
      evidenceStore.setEvidenceTime(evidenceStore.selectedEvidenceId, currentMediaTime.value)
      transcriptStore.setCurrentTime(currentMediaTime.value)
    }
  }
}

const handleAudioTimeUpdate = () => {
  if (audioRef.value) {
    currentMediaTime.value = audioRef.value.currentTime * 1000
    if (evidenceStore.selectedEvidenceId && isPlaying.value) {
      evidenceStore.setEvidenceTime(evidenceStore.selectedEvidenceId, currentMediaTime.value)
      transcriptStore.setCurrentTime(currentMediaTime.value)
    }
  }
}

const handleMediaLoaded = () => {
  if (videoRef.value) {
    videoDuration.value = videoRef.value.duration * 1000
  }
  if (audioRef.value) {
    audioDuration.value = audioRef.value.duration * 1000
  }
}

const handlePlay = () => {
  isPlaying.value = true
}

const handlePause = () => {
  isPlaying.value = false
}

const downloadEvidence = () => {
  const evidence = evidenceStore.selectedEvidence
  if (evidence?.dataUrl) {
    const blob = dataUrlToBlob(evidence.dataUrl)
    downloadFile(blob, evidence.name)
  }
}
</script>

<style lang="scss" scoped>
.evidence-manager {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--bg-color);
}

.evidence-manager.compact {
  .evidence-preview {
    padding: 12px;
  }

  .preview-content {
    max-height: calc(100vh - 300px);
  }
}

.evidence-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.section-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.btn-upload {
  padding: 8px 16px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;

  &:hover {
    background: var(--primary-hover);
  }
}

.search-input {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 14px;
  min-width: 200px;

  &:focus {
    outline: none;
    border-color: var(--primary-color);
  }
}

.evidence-content {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.evidence-sidebar {
  width: 280px;
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.type-filters {
  padding: 12px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filter-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13px;
  text-align: left;
  transition: all 0.2s;

  &:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }

  &.active {
    background: var(--primary-color) + '20';
    color: var(--primary-color);
  }

  .filter-count {
    margin-left: auto;
    background: var(--input-bg);
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
  }
}

.evidence-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.evidence-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 4px;
  position: relative;

  &:hover {
    background: var(--hover-bg);

    .delete-btn {
      opacity: 1;
    }
  }

  &.selected {
    background: var(--primary-color) + '20';
    border-left: 3px solid var(--primary-color);
  }

  .evidence-icon {
    font-size: 24px;
    flex-shrink: 0;
  }

  .evidence-info {
    flex: 1;
    min-width: 0;
  }

  .evidence-name {
    font-size: 13px;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .evidence-meta {
    font-size: 11px;
    color: var(--text-secondary);
    display: flex;
    gap: 8px;
    margin-top: 2px;
  }

  .delete-btn {
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    opacity: 0;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;

    &:hover {
      background: rgba(231, 76, 60, 0.2);
      color: var(--danger-color);
    }
  }
}

.empty-list {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-secondary);
  font-size: 13px;
}

.evidence-preview {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 20px;
  min-width: 0;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.preview-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 50%;
}

.preview-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.action-btn {
  width: 32px;
  height: 32px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--input-bg);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: var(--hover-bg);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &.fullscreen {
    margin-left: 8px;
  }
}

.zoom-level {
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 40px;
  text-align: center;
}

.preview-content {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--card-bg);
  border-radius: 8px;
  padding: 20px;
  min-height: 0;
}

.pdf-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;
}

.pdf-canvas {
  max-width: 100%;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.pdf-controls {
  display: flex;
  align-items: center;
  gap: 16px;

  button {
    padding: 6px 14px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--input-bg);
    color: var(--text-primary);
    cursor: pointer;
    font-size: 13px;

    &:hover:not(:disabled) {
      background: var(--hover-bg);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  span {
    font-size: 13px;
    color: var(--text-secondary);
  }
}

.image-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  overflow: auto;

  img {
    max-width: 100%;
    max-height: 60vh;
    object-fit: contain;
  }
}

.video-preview, .audio-preview {
  width: 100%;
  max-width: 800px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

video {
  width: 100%;
  max-height: 60vh;
  background: #000;
  border-radius: 8px;
}

.waveform {
  height: 80px;
  background: var(--input-bg);
  border-radius: 8px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 12px;
}

audio {
  width: 100%;
}

.media-info {
  display: flex;
  justify-content: center;
  gap: 24px;
  font-size: 13px;
  color: var(--text-secondary);
}

.document-preview {
  text-align: center;
  color: var(--text-secondary);

  .doc-icon {
    font-size: 64px;
    margin-bottom: 16px;
  }

  p {
    margin: 8px 0;

    &.doc-type {
      font-size: 13px;
      opacity: 0.7;
    }
  }
}

.btn-download {
  margin-top: 16px;
  padding: 10px 24px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;

  &:hover {
    background: var(--primary-hover);
  }
}

.evidence-annotations {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);

  h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    color: var(--text-primary);
  }
}

.annotation-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--input-bg);
  border-radius: 6px;
  margin-bottom: 8px;
  font-size: 13px;

  .annotation-type {
    padding: 2px 8px;
    background: var(--primary-color) + '20';
    color: var(--primary-color);
    border-radius: 4px;
    font-size: 11px;
  }

  .annotation-content {
    flex: 1;
    color: var(--text-primary);
  }

  .annotation-creator {
    color: var(--text-secondary);
    font-size: 12px;
  }
}

.empty-preview {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
  }

  p {
    margin: 0;
    font-size: 14px;
  }
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.loading-content {
  text-align: center;
  color: white;

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 16px;
  }

  p {
    margin: 0;
    font-size: 14px;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 900px) {
  .evidence-content {
    flex-direction: column;
  }

  .evidence-sidebar {
    width: 100%;
    height: 200px;
    border-right: none;
    border-bottom: 1px solid var(--border-color);
  }
}
</style>
