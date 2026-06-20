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
            <template v-if="canDraw">
              <div class="draw-toolbar">
                <button
                  class="action-btn"
                  :class="{ active: drawTool === 'select' }"
                  @click="setDrawTool('select')"
                  title="选择"
                >
                  ↖
                </button>
                <button
                  class="action-btn"
                  :class="{ active: drawTool === 'rect' }"
                  @click="setDrawTool('rect')"
                  title="矩形框"
                >
                  ☐
                </button>
                <button
                  class="action-btn"
                  :class="{ active: drawTool === 'arrow' }"
                  @click="setDrawTool('arrow')"
                  title="箭头"
                >
                  ↗
                </button>
                <button
                  class="action-btn"
                  :class="{ active: drawTool === 'text' }"
                  @click="setDrawTool('text')"
                  title="文字"
                >
                  T
                </button>
                <input
                  v-if="drawTool !== 'select'"
                  type="color"
                  v-model="drawColor"
                  class="color-picker"
                  title="颜色"
                />
                <button
                  v-if="drawTool !== 'select'"
                  class="action-btn"
                  @click="clearCurrentDraw"
                  title="清除当前绘制"
                >
                  🗑️
                </button>
              </div>
              <span class="divider">|</span>
            </template>

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
            <span class="zoom-level">{{ Math.round((evidenceStore.selectedEvidence.scale || 1) * 100) }}%</span>
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
              class="action-btn"
              @click="exportEvidenceScreenshot"
              title="导出截图"
            >
              📷
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
            <div class="pdf-container" ref="pdfContainerRef">
              <canvas ref="pdfCanvas" class="pdf-canvas"></canvas>
              <canvas
                ref="pdfDrawCanvas"
                class="draw-canvas"
                v-if="drawTool !== 'select'"
                @mousedown="startDraw"
                @mousemove="onDraw"
                @mouseup="endDraw"
                @mouseleave="endDraw"
              ></canvas>
              <canvas
                ref="pdfAnnotationCanvas"
                class="annotation-canvas"
              ></canvas>
            </div>
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
            <div class="image-container" ref="imageContainerRef">
              <img
                :src="evidenceStore.selectedEvidence.blobUrl || evidenceStore.selectedEvidence.dataUrl"
                :alt="evidenceStore.selectedEvidence.name"
                :style="imageStyle"
                ref="imageRef"
                @load="onImageLoad"
              />
              <canvas
                ref="imageDrawCanvas"
                class="draw-canvas"
                v-if="drawTool !== 'select'"
                @mousedown="startDraw"
                @mousemove="onDraw"
                @mouseup="endDraw"
                @mouseleave="endDraw"
              ></canvas>
              <canvas
                ref="imageAnnotationCanvas"
                class="annotation-canvas"
              ></canvas>
            </div>
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
            <div class="waveform-container">
              <div class="waveform" ref="waveformRef"></div>
              <div class="waveform-controls" v-if="wavesurfer">
                <button class="ws-btn" @click="toggleWaveSurferPlay" title="播放/暂停">
                  {{ isWavePlaying ? '⏸️' : '▶️' }}
                </button>
                <span class="ws-time">{{ formatDuration(wsCurrentTime) }}</span>
                <span class="ws-sep">/</span>
                <span class="ws-time">{{ formatDuration(wsDuration) }}</span>
              </div>
            </div>
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
            <span class="annotation-type" :style="ann.color ? { background: ann.color + '30', color: ann.color } : {}">
              {{ getAnnotationTypeLabel(ann.type) }}
            </span>
            <span class="annotation-content">{{ ann.content }}</span>
            <span class="annotation-creator">{{ getRoleName(ann.createdBy) }}</span>
            <button class="delete-ann-btn" @click="deleteEvidenceAnnotation(ann.id)">✕</button>
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

    <div v-if="drawTool === 'text' && showTextInput" class="text-input-overlay">
      <div class="text-input-modal">
        <input
          ref="textInputRef"
          type="text"
          v-model="textInputValue"
          @keyup.enter="confirmTextAnnotation"
          @keyup.esc="cancelTextAnnotation"
          placeholder="请输入文字内容..."
          class="text-input"
          maxlength="100"
        />
        <div class="text-input-actions">
          <button @click="cancelTextAnnotation" class="cancel-btn">取消</button>
          <button @click="confirmTextAnnotation" class="confirm-btn" :disabled="!textInputValue.trim()">
            确认
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick, onUnmounted, shallowRef } from 'vue'
import { useEvidenceStore } from '@/stores/evidenceStore'
import { useTranscriptStore } from '@/stores/transcriptStore'
import { formatDuration, getRoleName, downloadFile, dataUrlToBlob, generateId } from '@/utils/storage'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry'
import WaveSurfer from 'wavesurfer.js'
import html2canvas from 'html2canvas'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { EvidenceAnnotation, DrawAnnotation, Role } from '@/types'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

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
const pdfContainerRef = ref<HTMLElement | null>(null)
const pdfCanvas = ref<HTMLCanvasElement | null>(null)
const pdfDrawCanvas = ref<HTMLCanvasElement | null>(null)
const pdfAnnotationCanvas = ref<HTMLCanvasElement | null>(null)
const imageContainerRef = ref<HTMLElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const imageDrawCanvas = ref<HTMLCanvasElement | null>(null)
const imageAnnotationCanvas = ref<HTMLCanvasElement | null>(null)
const videoRef = ref<HTMLVideoElement | null>(null)
const audioRef = ref<HTMLAudioElement | null>(null)
const waveformRef = ref<HTMLElement | null>(null)
const textInputRef = ref<HTMLInputElement | null>(null)

const searchQuery = ref('')
const activeFilter = ref('all')
const currentPage = ref(1)
const totalPages = ref(0)
const pdfDoc = ref<PDFDocumentProxy | null>(null)
const videoDuration = ref(0)
const audioDuration = ref(0)
const currentMediaTime = ref(0)
const isPlaying = ref(false)
const wavesurfer = shallowRef<WaveSurfer | null>(null)
const isWavePlaying = ref(false)
const wsCurrentTime = ref(0)
const wsDuration = ref(0)

const drawTool = ref<'select' | 'rect' | 'arrow' | 'text'>('select')
const drawColor = ref('#ef4444')
const isDrawing = ref(false)
const drawStartX = ref(0)
const drawStartY = ref(0)
const showTextInput = ref(false)
const textInputValue = ref('')
const pendingTextPos = ref({ x: 0, y: 0 })

const typeFilters = [
  { value: 'all', label: '全部', icon: '📁' },
  { value: 'pdf', label: 'PDF', icon: '📄' },
  { value: 'image', label: '图片', icon: '🖼️' },
  { value: 'video', label: '视频', icon: '🎬' },
  { value: 'audio', label: '音频', icon: '🎵' },
  { value: 'document', label: '文档', icon: '📑' }
]

const filteredEvidence = computed(() => {
  const list = evidenceStore.evidenceList || []
  let evidence = list
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    evidence = evidence.filter(e => e.name.toLowerCase().includes(q))
  }
  if (activeFilter.value !== 'all') {
    evidence = evidence.filter(e => e.type === activeFilter.value)
  }
  return evidence
})

const canRotate = computed(() => evidenceStore.selectedEvidence?.type === 'image')
const canZoom = computed(() => ['image', 'pdf'].includes(evidenceStore.selectedEvidence?.type || ''))
const canDraw = computed(() => ['image', 'pdf'].includes(evidenceStore.selectedEvidence?.type || ''))

const imageStyle = computed(() => {
  const evidence = evidenceStore.selectedEvidence
  if (!evidence) return {}
  return {
    transform: `rotate(${evidence.rotation || 0}deg) scale(${evidence.scale || 1})`,
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
      drawTool.value = 'select'

      const evidence = evidenceStore.getEvidenceById(newId)
      if (evidence?.type === 'pdf' && evidence.dataUrl) {
        await nextTick()
        await loadPdf(evidence.dataUrl)
      }

      if (evidence?.type === 'audio') {
        await nextTick()
        initWaveSurfer()
      }

      if (evidence?.type === 'video' && evidence.currentTime !== undefined && videoRef.value) {
        nextTick(() => {
          if (videoRef.value) {
            videoRef.value.currentTime = evidence.currentTime! / 1000
          }
        })
      }

      nextTick(() => {
        renderAnnotations()
      })
    } else {
      destroyWaveSurfer()
    }
  }
)

watch(
  () => transcriptStore.currentTime,
  (newTime) => {
    if (isPlaying.value) return

    const evidence = evidenceStore.selectedEvidence
    if (evidence?.type === 'video' && videoRef.value) {
      const timeDiff = Math.abs(videoRef.value.currentTime * 1000 - newTime)
      if (timeDiff > 2000) {
        videoRef.value.currentTime = newTime / 1000
      }
    } else if (evidence?.type === 'audio') {
      if (audioRef.value) {
        const timeDiff = Math.abs(audioRef.value.currentTime * 1000 - newTime)
        if (timeDiff > 2000) {
          audioRef.value.currentTime = newTime / 1000
        }
      }
      if (wavesurfer.value) {
        const dur = wavesurfer.value.getDuration() * 1000
        if (dur > 0) {
          wavesurfer.value.setTime(Math.min(newTime / 1000, dur / 1000 - 0.1))
        }
      }
    }
  }
)

watch(
  () => transcriptStore.isPlaybackMode,
  (isPlayback) => {
    if (isPlayback) {
      transcriptStore.onPlaybackEvidenceSelect((evidenceId: string) => {
        if (evidenceId && evidenceId !== evidenceStore.selectedEvidenceId) {
          evidenceStore.selectEvidence(evidenceId)
        }
      })
    }
  }
)

onMounted(() => {
  if ((evidenceStore.evidenceList?.length === 0 || !evidenceStore.evidenceList) && !props.compact) {
    addDemoEvidence()
  }
})

onUnmounted(() => {
  destroyWaveSurfer()
  if (pdfDoc.value) {
    pdfDoc.value.destroy()
  }
})

const initWaveSurfer = () => {
  destroyWaveSurfer()
  if (!waveformRef.value) return

  const evidence = evidenceStore.selectedEvidence
  if (!evidence || !evidence.blobUrl) return

  try {
    wavesurfer.value = WaveSurfer.create({
      container: waveformRef.value,
      waveColor: 'rgba(59, 130, 246, 0.5)',
      progressColor: 'var(--accent-primary, #3b82f6)',
      cursorColor: 'var(--accent-hover, #2563eb)',
      height: 80,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
      responsive: true
    })

    wavesurfer.value.on('ready', () => {
      wsDuration.value = (wavesurfer.value?.getDuration() || 0) * 1000
      if (evidence.currentTime) {
        wavesurfer.value?.setTime(Math.min(evidence.currentTime / 1000, (wavesurfer.value?.getDuration() || 1) - 0.1))
      }
    })

    wavesurfer.value.on('audioprocess', () => {
      wsCurrentTime.value = (wavesurfer.value?.getCurrentTime() || 0) * 1000
    })

    wavesurfer.value.on('seek', () => {
      wsCurrentTime.value = (wavesurfer.value?.getCurrentTime() || 0) * 1000
      currentMediaTime.value = wsCurrentTime.value
      if (audioRef.value) {
        audioRef.value.currentTime = wsCurrentTime.value / 1000
      }
    })

    wavesurfer.value.on('play', () => {
      isWavePlaying.value = true
      if (audioRef.value && audioRef.value.paused) {
        audioRef.value.play()
      }
    })

    wavesurfer.value.on('pause', () => {
      isWavePlaying.value = false
      if (audioRef.value && !audioRef.value.paused) {
        audioRef.value.pause()
      }
    })

    wavesurfer.value.load(evidence.blobUrl)
  } catch (error) {
    console.error('Failed to init WaveSurfer:', error)
  }
}

const destroyWaveSurfer = () => {
  if (wavesurfer.value) {
    try {
      wavesurfer.value.destroy()
    } catch (e) {
      console.warn('Error destroying wavesurfer:', e)
    }
    wavesurfer.value = null
  }
  isWavePlaying.value = false
  wsCurrentTime.value = 0
  wsDuration.value = 0
}

const toggleWaveSurferPlay = () => {
  if (wavesurfer.value) {
    wavesurfer.value.playPause()
  }
}

const setDrawTool = (tool: 'select' | 'rect' | 'arrow' | 'text') => {
  drawTool.value = tool
  if (tool !== 'select') {
    nextTick(() => {
      resizeDrawCanvases()
    })
  }
}

const resizeDrawCanvases = () => {
  const ev = evidenceStore.selectedEvidence
  if (!ev) return

  if (ev.type === 'image' && imageContainerRef.value && imageDrawCanvas.value && imageAnnotationCanvas.value) {
    const rect = imageContainerRef.value.getBoundingClientRect()
    ;[imageDrawCanvas.value, imageAnnotationCanvas.value].forEach(canvas => {
      canvas.width = rect.width
      canvas.height = rect.height
    })
    renderAnnotations()
  }

  if (ev.type === 'pdf' && pdfContainerRef.value && pdfDrawCanvas.value && pdfAnnotationCanvas.value) {
    const rect = pdfContainerRef.value.getBoundingClientRect()
    ;[pdfDrawCanvas.value, pdfAnnotationCanvas.value].forEach(canvas => {
      canvas.width = rect.width
      canvas.height = rect.height
    })
    renderAnnotations()
  }
}

const getActiveDrawCanvas = () => {
  const ev = evidenceStore.selectedEvidence
  if (!ev) return null
  return ev.type === 'image' ? imageDrawCanvas.value : pdfDrawCanvas.value
}

const getActiveAnnotationCanvas = () => {
  const ev = evidenceStore.selectedEvidence
  if (!ev) return null
  return ev.type === 'image' ? imageAnnotationCanvas.value : pdfAnnotationCanvas.value
}

const getActiveContainerRect = () => {
  const ev = evidenceStore.selectedEvidence
  if (!ev) return null
  const el = ev.type === 'image' ? imageContainerRef.value : pdfContainerRef.value
  return el?.getBoundingClientRect() || null
}

const startDraw = (e: MouseEvent) => {
  if (drawTool.value === 'select') return

  const canvas = getActiveDrawCanvas()
  if (!canvas) return

  const rect = getActiveContainerRect()
  if (!rect) return

  isDrawing.value = true
  drawStartX.value = e.clientX - rect.left
  drawStartY.value = e.clientY - rect.top

  if (drawTool.value === 'text') {
    pendingTextPos.value = { x: drawStartX.value, y: drawStartY.value }
    showTextInput.value = true
    isDrawing.value = false
    nextTick(() => {
      textInputRef.value?.focus()
    })
    return
  }

  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.strokeStyle = drawColor.value
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
  }
}

const onDraw = (e: MouseEvent) => {
  if (!isDrawing.value || drawTool.value === 'select') return

  const canvas = getActiveDrawCanvas()
  const ctx = canvas?.getContext('2d')
  const rect = getActiveContainerRect()
  if (!canvas || !ctx || !rect) return

  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  if (drawTool.value === 'rect') {
    ctx.strokeStyle = drawColor.value
    ctx.lineWidth = 2
    ctx.strokeRect(
      drawStartX.value,
      drawStartY.value,
      x - drawStartX.value,
      y - drawStartY.value
    )
  } else if (drawTool.value === 'arrow') {
    drawArrow(ctx, drawStartX.value, drawStartY.value, x, y, drawColor.value)
  }
}

const drawArrow = (ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number, color: string) => {
  const headLen = 12
  const angle = Math.atan2(toY - fromY, toX - fromX)

  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(fromX, fromY)
  ctx.lineTo(toX, toY)
  ctx.stroke()

  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(toX, toY)
  ctx.lineTo(
    toX - headLen * Math.cos(angle - Math.PI / 6),
    toY - headLen * Math.sin(angle - Math.PI / 6)
  )
  ctx.lineTo(
    toX - headLen * Math.cos(angle + Math.PI / 6),
    toY - headLen * Math.sin(angle + Math.PI / 6)
  )
  ctx.closePath()
  ctx.fill()
}

const endDraw = (e: MouseEvent) => {
  if (!isDrawing.value || drawTool.value === 'select') {
    isDrawing.value = false
    return
  }

  isDrawing.value = false
  const rect = getActiveContainerRect()
  if (!rect) return

  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const minSize = 5

  if (drawTool.value === 'rect') {
    const w = Math.abs(x - drawStartX.value)
    const h = Math.abs(y - drawStartY.value)
    if (w < minSize || h < minSize) {
      clearCurrentDraw()
      return
    }

    const draw: DrawAnnotation = {
      id: generateId(),
      type: 'rect',
      x: Math.min(drawStartX.value, x),
      y: Math.min(drawStartY.value, y),
      width: w,
      height: h,
      color: drawColor.value,
      strokeWidth: 2
    }
    addDrawAnnotation(draw, `矩形标注`)
  } else if (drawTool.value === 'arrow') {
    const dist = Math.sqrt(Math.pow(x - drawStartX.value, 2) + Math.pow(y - drawStartY.value, 2))
    if (dist < minSize) {
      clearCurrentDraw()
      return
    }

    const draw: DrawAnnotation = {
      id: generateId(),
      type: 'arrow',
      x: drawStartX.value,
      y: drawStartY.value,
      endX: x,
      endY: y,
      color: drawColor.value,
      strokeWidth: 2
    }
    addDrawAnnotation(draw, `箭头标注`)
  }

  clearCurrentDraw()
}

const confirmTextAnnotation = () => {
  if (!textInputValue.value.trim()) return

  const draw: DrawAnnotation = {
    id: generateId(),
    type: 'text',
    x: pendingTextPos.value.x,
    y: pendingTextPos.value.y,
    color: drawColor.value,
    strokeWidth: 2,
    content: textInputValue.value.trim(),
    fontSize: 16
  }
  addDrawAnnotation(draw, textInputValue.value.trim())

  cancelTextAnnotation()
}

const cancelTextAnnotation = () => {
  showTextInput.value = false
  textInputValue.value = ''
}

const addDrawAnnotation = (draw: DrawAnnotation, content: string) => {
  if (!evidenceStore.selectedEvidenceId) return

  evidenceStore.addEvidenceAnnotation(evidenceStore.selectedEvidenceId, {
    type: draw.type === 'text' ? 'text' : (draw.type === 'rect' ? 'rect' : 'arrow') as any,
    x: draw.x,
    y: draw.y,
    width: draw.width || 0,
    height: draw.height || 0,
    content,
    createdBy: transcriptStore.settings.currentRole as Role,
    color: draw.color,
    draw
  })

  nextTick(() => renderAnnotations())
}

const clearCurrentDraw = () => {
  const canvas = getActiveDrawCanvas()
  const ctx = canvas?.getContext('2d')
  if (canvas && ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }
}

const renderAnnotations = () => {
  const canvas = getActiveAnnotationCanvas()
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx || !evidenceStore.selectedEvidence) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  evidenceStore.selectedEvidence.annotations.forEach(ann => {
    if (ann.draw) {
      const d = ann.draw
      ctx.strokeStyle = d.color
      ctx.lineWidth = d.strokeWidth
      ctx.fillStyle = d.color

      if (d.type === 'rect' && d.width && d.height) {
        ctx.strokeRect(d.x, d.y, d.width, d.height)
      } else if (d.type === 'arrow' && d.endX !== undefined && d.endY !== undefined) {
        drawArrow(ctx, d.x, d.y, d.endX, d.endY, d.color)
      } else if (d.type === 'text' && d.content) {
        ctx.font = `${d.fontSize || 16}px -apple-system, BlinkMacSystemFont, sans-serif`
        ctx.fillText(d.content, d.x, d.y)
      }
    }
  })
}

const deleteEvidenceAnnotation = (annId: string) => {
  if (!evidenceStore.selectedEvidenceId) return
  evidenceStore.deleteEvidenceAnnotation(evidenceStore.selectedEvidenceId, annId)
  nextTick(() => renderAnnotations())
}

const addDemoEvidence = async () => {
  const demoFiles = [
    { name: '起诉书.pdf', type: 'pdf' as const, mimeType: 'application/pdf' },
    { name: '现场照片.jpg', type: 'image' as const, mimeType: 'image/jpeg' },
    { name: '被告人供述.mp3', type: 'audio' as const, mimeType: 'audio/mpeg' }
  ]

  for (const file of demoFiles) {
    const evidence: any = {
      id: `demo-${file.type}-${Date.now()}-${Math.random()}`,
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

  try {
    await evidenceStore.saveToStorage()
  } catch (e) {}
}

const triggerUpload = () => fileInput.value?.click()

const handleFileUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (files && files.length > 0) {
    await evidenceStore.uploadMultipleEvidence(Array.from(files))
  }
  if (fileInput.value) fileInput.value.value = ''
}

const selectEvidence = (id: string) => {
  evidenceStore.selectEvidence(id)
  const evidence = evidenceStore.getEvidenceById(id)
  if (evidence) {
    const time = evidence.createdAt - transcriptStore.startTime
    if (time > 0) transcriptStore.setCurrentTime(time)
  }
}

const deleteEvidence = (id: string) => {
  if (confirm('确定要删除这份证据吗？')) {
    evidenceStore.deleteEvidence(id)
  }
}

const getFilterCount = (type: string) => {
  const list = evidenceStore.evidenceList || []
  if (type === 'all') return list.length
  return list.filter(e => e.type === type).length
}

const getTypeIcon = (type: string) => {
  const icons: Record<string, string> = {
    pdf: '📄', image: '🖼️', video: '🎬', audio: '🎵', document: '📑'
  }
  return icons[type] || '📁'
}

const getAnnotationTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    highlight: '高亮', comment: '批注', signature: '签名',
    rect: '矩形', arrow: '箭头', text: '文字'
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
    evidenceStore.scaleEvidence(evidenceStore.selectedEvidenceId, (evidenceStore.selectedEvidence.scale || 1) + 0.25)
    nextTick(() => {
      resizeDrawCanvases()
      if (pdfDoc.value) renderPdfPage(currentPage.value)
    })
  }
}

const zoomOut = () => {
  if (evidenceStore.selectedEvidence) {
    evidenceStore.scaleEvidence(evidenceStore.selectedEvidenceId, (evidenceStore.selectedEvidence.scale || 1) - 0.25)
    nextTick(() => {
      resizeDrawCanvases()
      if (pdfDoc.value) renderPdfPage(currentPage.value)
    })
  }
}

const resetView = () => {
  if (evidenceStore.selectedEvidenceId) {
    evidenceStore.updateEvidence(evidenceStore.selectedEvidenceId, { rotation: 0, scale: 1 })
    currentPage.value = 1
    if (pdfDoc.value) renderPdfPage(currentPage.value)
    nextTick(() => resizeDrawCanvases())
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

const onImageLoad = () => {
  nextTick(() => resizeDrawCanvases())
}

const loadPdf = async (dataUrl: string) => {
  try {
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
    const loadingTask = pdfjsLib.getDocument({ data: base64 })
    pdfDoc.value = await loadingTask.promise
    totalPages.value = pdfDoc.value.numPages
    await renderPdfPage(currentPage.value)
    nextTick(() => resizeDrawCanvases())
  } catch (error) {
    console.error('Failed to load PDF:', error)
  }
}

const renderPdfPage = async (pageNum: number) => {
  if (!pdfDoc.value || !pdfCanvas.value) return

  try {
    const page = await pdfDoc.value.getPage(pageNum)
    const scale = 1.5 * (evidenceStore.selectedEvidence?.scale || 1)
    const viewport = page.getViewport({ scale })
    const canvas = pdfCanvas.value
    const context = canvas.getContext('2d')

    if (context) {
      canvas.height = viewport.height
      canvas.width = viewport.width

      await page.render({
        canvasContext: context,
        viewport
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
    nextTick(() => resizeDrawCanvases())
  }
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    renderPdfPage(currentPage.value)
    nextTick(() => resizeDrawCanvases())
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
  if (videoRef.value) videoDuration.value = videoRef.value.duration * 1000
  if (audioRef.value) audioDuration.value = audioRef.value.duration * 1000
}

const handlePlay = () => { isPlaying.value = true }
const handlePause = () => { isPlaying.value = false }

const downloadEvidence = () => {
  const evidence = evidenceStore.selectedEvidence
  if (evidence?.dataUrl) {
    const blob = dataUrlToBlob(evidence.dataUrl)
    downloadFile(blob, evidence.name)
  }
}

const exportEvidenceScreenshot = async () => {
  if (!previewRef.value) return
  try {
    const canvas = await html2canvas(previewRef.value, {
      backgroundColor: '#ffffff',
      scale: 2
    })
    canvas.toBlob((blob) => {
      if (blob) {
        const name = evidenceStore.selectedEvidence?.name || 'screenshot'
        downloadFile(blob, `${name.split('.')[0]}_截图.png`)
      }
    }, 'image/png')
  } catch (error) {
    console.error('Screenshot failed:', error)
  }
}

defineExpose({
  previewRef,
  exportEvidenceScreenshot
})
</script>

<style lang="scss" scoped>
.evidence-manager {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--bg-secondary);
}

.evidence-manager.compact {
  .evidence-preview { padding: 12px; }
  .preview-content { max-height: calc(100vh - 300px); }
}

.evidence-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-primary);
}

.section-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.header-actions {
  display: flex; gap: 12px; align-items: center;
}

.btn-upload {
  padding: 8px 16px;
  background: var(--accent-primary);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
  &:hover { background: var(--accent-hover); }
}

.search-input {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 14px;
  min-width: 200px;
  &:focus { outline: none; border-color: var(--accent-primary); }
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
  background: var(--bg-primary);
}

.type-filters {
  padding: 12px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filter-btn {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; border: none; border-radius: 6px;
  background: transparent; color: var(--text-secondary);
  cursor: pointer; font-size: 13px; text-align: left;
  transition: all 0.2s;
  &:hover { background: var(--bg-hover); color: var(--text-primary); }
  &.active {
    background: var(--accent-bg);
    color: var(--accent-primary);
  }
  .filter-count {
    margin-left: auto;
    background: var(--bg-secondary);
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
  }
}

.evidence-list { flex: 1; overflow-y: auto; padding: 8px; }

.evidence-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 6px;
  cursor: pointer; transition: all 0.2s;
  margin-bottom: 4px; position: relative;
  &:hover {
    background: var(--bg-hover);
    .delete-btn { opacity: 1; }
  }
  &.selected {
    background: var(--accent-bg);
    border-left: 3px solid var(--accent-primary);
  }
  .evidence-icon { font-size: 24px; flex-shrink: 0; }
  .evidence-info { flex: 1; min-width: 0; }
  .evidence-name {
    font-size: 13px; color: var(--text-primary);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .evidence-meta {
    font-size: 11px; color: var(--text-secondary);
    display: flex; gap: 8px; margin-top: 2px;
  }
  .delete-btn {
    width: 24px; height: 24px; border: none; border-radius: 4px;
    background: transparent; color: var(--text-secondary);
    cursor: pointer; opacity: 0; transition: all 0.2s;
    display: flex; align-items: center; justify-content: center; font-size: 14px;
    &:hover { background: rgba(231, 76, 60, 0.2); color: var(--error); }
  }
}

.empty-list {
  text-align: center; padding: 40px 20px;
  color: var(--text-secondary); font-size: 13px;
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
  flex-wrap: wrap;
  gap: 12px;
}

.preview-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 40%;
}

.preview-actions {
  display: flex; align-items: center; gap: 4px; flex-wrap: wrap;
}

.draw-toolbar {
  display: flex; align-items: center; gap: 2px;
  padding: 2px 6px;
  background: var(--bg-secondary);
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.divider {
  color: var(--border-color);
  margin: 0 4px;
}

.color-picker {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0;
}

.action-btn {
  width: 32px; height: 32px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 14px;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s;
  &:hover:not(:disabled) { background: var(--bg-hover); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
  &.active {
    background: var(--accent-primary);
    color: white;
    border-color: var(--accent-primary);
  }
  &.fullscreen { margin-left: 8px; }
}

.zoom-level {
  font-size: 12px; color: var(--text-secondary);
  min-width: 40px; text-align: center;
}

.preview-content {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  border-radius: 8px;
  padding: 20px;
  min-height: 0;
  position: relative;
}

.pdf-preview, .image-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;
  height: 100%;
}

.pdf-container, .image-container {
  position: relative;
  display: inline-block;
  max-width: 100%;
  max-height: 70vh;
  overflow: auto;
}

.pdf-canvas {
  max-width: 100%;
  display: block;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
}

img {
  max-width: 100%;
  max-height: 60vh;
  object-fit: contain;
  display: block;
}

.draw-canvas, .annotation-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.draw-canvas {
  pointer-events: auto;
  cursor: crosshair;
  z-index: 2;
}

.annotation-canvas {
  z-index: 1;
  pointer-events: none;
}

.pdf-controls {
  display: flex; align-items: center; gap: 16px;
  button {
    padding: 6px 14px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-primary);
    color: var(--text-primary);
    cursor: pointer;
    font-size: 13px;
    &:hover:not(:disabled) { background: var(--bg-hover); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }
  span { font-size: 13px; color: var(--text-secondary); }
}

.video-preview, .audio-preview {
  width: 100%;
  max-width: 800px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

video {
  width: 100%; max-height: 60vh;
  background: #000; border-radius: 8px;
}

.waveform-container {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 12px;
}

.waveform {
  width: 100%;
  height: 80px;
  background: var(--bg-primary);
  border-radius: 6px;
  overflow: hidden;
}

.waveform-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 0 4px;
}

.ws-btn {
  width: 32px; height: 32px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  cursor: pointer;
  font-size: 14px;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s;
  &:hover { background: var(--accent-primary); color: white; }
}

.ws-time {
  font-size: 12px;
  color: var(--text-secondary);
  font-family: var(--font-mono, monospace);
}

.ws-sep {
  color: var(--text-secondary);
  margin: 0 2px;
}

audio { width: 100%; }

.media-info {
  display: flex; justify-content: center;
  gap: 24px; font-size: 13px; color: var(--text-secondary);
}

.document-preview {
  text-align: center; color: var(--text-secondary);
  .doc-icon { font-size: 64px; margin-bottom: 16px; }
  p {
    margin: 8px 0;
    &.doc-type { font-size: 13px; opacity: 0.7; }
  }
}

.btn-download {
  margin-top: 16px;
  padding: 10px 24px;
  background: var(--accent-primary);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  &:hover { background: var(--accent-hover); }
}

.evidence-annotations {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
  h4 { margin: 0 0 12px 0; font-size: 14px; color: var(--text-primary); }
}

.annotation-item {
  display: flex; align-items: center; gap: 12px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-radius: 6px;
  margin-bottom: 8px;
  font-size: 13px;
  .annotation-type {
    padding: 2px 8px;
    background: var(--accent-bg);
    color: var(--accent-primary);
    border-radius: 4px;
    font-size: 11px;
    white-space: nowrap;
  }
  .annotation-content {
    flex: 1; color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .annotation-creator {
    color: var(--text-secondary); font-size: 12px; white-space: nowrap;
  }
  .delete-ann-btn {
    width: 20px; height: 20px;
    border: none; border-radius: 4px;
    background: transparent; color: var(--text-secondary);
    cursor: pointer; font-size: 12px;
    display: flex; align-items: center; justify-content: center;
    &:hover { background: rgba(231, 76, 60, 0.2); color: var(--error); }
  }
}

.empty-preview {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  .empty-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.5; }
  p { margin: 0; font-size: 14px; }
}

.loading-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}

.loading-content {
  text-align: center; color: white;
  .spinner {
    width: 40px; height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 16px;
  }
  p { margin: 0; font-size: 14px; }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.text-input-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}

.text-input-modal {
  background: var(--bg-primary);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  min-width: 360px;
}

.text-input {
  width: 100%;
  padding: 12px 16px;
  font-size: 14px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  margin-bottom: 16px;
  &:focus { outline: none; border-color: var(--accent-primary); }
}

.text-input-actions {
  display: flex; justify-content: flex-end; gap: 12px;
  button {
    padding: 8px 20px;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
  }
  .cancel-btn {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    &:hover { background: var(--bg-hover); }
  }
  .confirm-btn {
    background: var(--accent-primary);
    color: white;
    &:hover:not(:disabled) { background: var(--accent-hover); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }
}

@media (max-width: 900px) {
  .evidence-content { flex-direction: column; }
  .evidence-sidebar {
    width: 100%; height: 200px;
    border-right: none;
    border-bottom: 1px solid var(--border-color);
  }
}
</style>
