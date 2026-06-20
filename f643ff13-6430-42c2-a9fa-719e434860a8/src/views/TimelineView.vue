<template>
  <div class="timeline-container">
    <div class="timeline-controls">
      <div class="time-display">
        <span class="current-time">{{ formatTime(currentTime) }}</span>
        <span class="separator">/</span>
        <span class="total-time">{{ formatTime(totalDuration) }}</span>
      </div>

      <div class="playback-controls">
        <button class="control-btn" @click="jumpToStart" title="跳转到开始">
          ⏮️
        </button>
        <button class="control-btn play-btn" @click="togglePlayback" :title="isPlaybackMode ? '暂停' : '播放'">
          {{ isPlaybackMode ? '⏸️' : '▶️' }}
        </button>
        <button class="control-btn" @click="jumpToEnd" title="跳转到结束">
          ⏭️
        </button>
        <select v-model="playbackSpeed" class="speed-select" @change="onSpeedChange">
          <option :value="0.5">0.5x</option>
          <option :value="1">1x</option>
          <option :value="1.5">1.5x</option>
          <option :value="2">2x</option>
        </select>
      </div>

      <div class="filter-controls">
        <label class="filter-label">
          <input type="checkbox" v-model="showTranscripts" checked>
          <span class="filter-indicator transcript"></span>
          笔录
        </label>
        <label class="filter-label">
          <input type="checkbox" v-model="showEvidence" checked>
          <span class="filter-indicator evidence"></span>
          证据
        </label>
        <label class="filter-label">
          <input type="checkbox" v-model="showAnnotations" checked>
          <span class="filter-indicator annotation"></span>
          标注
        </label>
      </div>

      <div class="zoom-controls">
        <button class="control-btn" @click="zoomOut" title="缩小">
          ➖
        </button>
        <span class="zoom-level">{{ Math.round(zoomLevel * 100) }}%</span>
        <button class="control-btn" @click="zoomIn" title="放大">
          ➕
        </button>
        <button class="control-btn" @click="resetZoom" title="重置">
          🔄
        </button>
      </div>
    </div>

    <div class="timeline-track"
         ref="timelineRef"
         @mousedown="startDragging"
         @mousemove="onMouseMove"
         @mouseup="stopDragging"
         @mouseleave="stopDragging">
      <div class="timeline-ruler">
        <div class="ruler-marker"
             v-for="marker in rulerMarkers"
             :key="marker.position"
             :style="{ left: marker.position + '%' }">
          <div class="marker-line"></div>
          <div class="marker-label">{{ marker.label }}</div>
        </div>
      </div>

      <div class="timeline-events">
        <div class="event-group" v-for="group in eventGroups" :key="group.type">
          <div class="event-item"
               v-for="event in group.events"
               :key="event.id"
               :class="{ active: activeEventId === event.id }"
               :style="{
                 left: getEventPosition(event.timestamp) + '%',
                 backgroundColor: event.color
               }"
               @click.stop="onEventClick(event)"
               :title="event.label">
            <div class="event-tooltip">
              <div class="tooltip-type">{{ getEventTypeLabel(event.type) }}</div>
              <div class="tooltip-time">{{ formatTime(event.timestamp) }}</div>
              <div class="tooltip-label">{{ event.label }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="timeline-playhead"
           :style="{ left: playheadPosition + '%' }"
           :class="{ dragging: isDragging }">
        <div class="playhead-line"></div>
        <div class="playhead-handle"></div>
      </div>

      <div class="timeline-selection"
           v-if="selectionStart !== null && selectionEnd !== null"
           :style="{
             left: Math.min(selectionStart, selectionEnd) + '%',
             width: Math.abs(selectionEnd - selectionStart) + '%'
           }">
        <div class="selection-info">
          {{ formatTime(Math.abs(selectionTimeEnd - selectionTimeStart)) }}
        </div>
      </div>
    </div>

    <div class="chapters-bar">
      <div class="chapter-item"
           v-for="(chapter, index) in chapters"
           :key="index"
           :class="{ active: isChapterActive(chapter) }"
           :style="{
             left: getEventPosition(chapter.startTime) + '%',
             width: getChapterWidth(chapter) + '%'
           }"
           @click="jumpToChapter(chapter)">
        <span class="chapter-title">{{ chapter.title }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useTranscriptStore } from '@/stores/transcriptStore'
import { useEvidenceStore } from '@/stores/evidenceStore'
import { useTimeSync } from '@/composables/useTimeSync'
import { formatTime } from '@/utils/storage'
import type { TimelineEvent } from '@/types'

const emit = defineEmits<{
  (e: 'timeChange', time: number): void
  (e: 'eventClick', event: TimelineEvent): void
  (e: 'selectionChange', start: number, end: number): void
}>()

const transcriptStore = useTranscriptStore()
const evidenceStore = useEvidenceStore()
const { timelineEvents, jumpToTime, getCurrentChapter } = useTimeSync()

const timelineRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)
const isSelecting = ref(false)
const activeEventId = ref<string | null>(null)

const showTranscripts = ref(true)
const showEvidence = ref(true)
const showAnnotations = ref(true)

const zoomLevel = ref(1)
const playbackSpeed = computed({
  get: () => transcriptStore.playbackSpeed,
  set: (val) => transcriptStore.setPlaybackSpeed(val)
})

const selectionStart = ref<number | null>(null)
const selectionEnd = ref<number | null>(null)

const currentTime = computed(() => transcriptStore.currentTime)
const totalDuration = computed(() => transcriptStore.totalDuration || 3600000)
const isPlaybackMode = computed(() => transcriptStore.isPlaybackMode)

const playheadPosition = computed(() => {
  if (totalDuration.value === 0) return 0
  return (currentTime.value / totalDuration.value) * 100 * zoomLevel.value
})

const filteredEvents = computed(() => {
  return timelineEvents.value.filter(event => {
    if (event.type === 'transcript' && !showTranscripts.value) return false
    if (event.type === 'evidence' && !showEvidence.value) return false
    if (event.type === 'annotation' && !showAnnotations.value) return false
    return true
  })
})

const eventGroups = computed(() => {
  const groups: Record<string, TimelineEvent[]> = {
    transcript: [],
    evidence: [],
    annotation: []
  }

  filteredEvents.value.forEach(event => {
    groups[event.type].push(event)
  })

  return Object.entries(groups).map(([type, events]) => ({
    type,
    events
  }))
})

const rulerMarkers = computed(() => {
  const markers: { position: number; label: string }[] = []
  const duration = totalDuration.value
  const interval = Math.ceil(duration / (6 * 60000)) * 60000

  for (let time = 0; time <= duration; time += interval) {
    const position = (time / duration) * 100 * zoomLevel.value
    if (position <= 100) {
      markers.push({
        position,
        label: formatTime(time)
      })
    }
  }

  return markers
})

const chapters = computed(() => {
  const chapterTitles = [
    '开庭准备',
    '法庭调查',
    '举证质证',
    '法庭辩论',
    '最后陈述',
    '宣判'
  ]

  const duration = totalDuration.value
  const chapterDuration = duration / chapterTitles.length

  return chapterTitles.map((title, index) => ({
    title,
    startTime: index * chapterDuration,
    endTime: (index + 1) * chapterDuration
  }))
})

const selectionTimeStart = computed(() => {
  if (selectionStart.value === null) return 0
  return (selectionStart.value / 100) * totalDuration.value / zoomLevel.value
})

const selectionTimeEnd = computed(() => {
  if (selectionEnd.value === null) return 0
  return (selectionEnd.value / 100) * totalDuration.value / zoomLevel.value
})

const getEventPosition = (timestamp: number) => {
  if (totalDuration.value === 0) return 0
  return (timestamp / totalDuration.value) * 100 * zoomLevel.value
}

const getChapterWidth = (chapter: { startTime: number; endTime: number }) => {
  if (totalDuration.value === 0) return 0
  return ((chapter.endTime - chapter.startTime) / totalDuration.value) * 100 * zoomLevel.value
}

const getEventTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    transcript: '笔录',
    evidence: '证据',
    annotation: '标注'
  }
  return labels[type] || type
}

const isChapterActive = (chapter: { startTime: number; endTime: number }) => {
  return currentTime.value >= chapter.startTime && currentTime.value < chapter.endTime
}

const startDragging = (e: MouseEvent) => {
  if (e.button === 0) {
    isDragging.value = true
    isSelecting.value = e.shiftKey

    if (isSelecting.value) {
      selectionStart.value = getPositionFromEvent(e)
      selectionEnd.value = selectionStart.value
    } else {
      updateTimeFromEvent(e)
    }
  }
}

const onMouseMove = (e: MouseEvent) => {
  if (isDragging.value) {
    if (isSelecting.value) {
      selectionEnd.value = getPositionFromEvent(e)
    } else {
      updateTimeFromEvent(e)
    }
  }
}

const stopDragging = () => {
  if (isDragging.value && isSelecting.value && selectionStart.value !== null && selectionEnd.value !== null) {
    emit('selectionChange', selectionTimeStart.value, selectionTimeEnd.value)
  }
  isDragging.value = false
  isSelecting.value = false
}

const getPositionFromEvent = (e: MouseEvent) => {
  if (!timelineRef.value) return 0
  const rect = timelineRef.value.getBoundingClientRect()
  const position = ((e.clientX - rect.left) / rect.width) * 100
  return Math.max(0, Math.min(100, position))
}

const updateTimeFromEvent = (e: MouseEvent) => {
  const position = getPositionFromEvent(e)
  const time = (position / 100) * totalDuration.value / zoomLevel.value
  jumpToTime(time)
  emit('timeChange', time)
}

const onEventClick = (event: TimelineEvent) => {
  activeEventId.value = event.id
  jumpToTime(event.timestamp)
  emit('eventClick', event)

  if (event.type === 'transcript') {
    transcriptStore.jumpToTranscript(event.refId)
  } else if (event.type === 'evidence') {
    evidenceStore.selectEvidence(event.refId)
  }
}

const togglePlayback = () => {
  if (isPlaybackMode.value) {
    transcriptStore.stopPlayback()
  } else {
    transcriptStore.startPlayback()
  }
}

const jumpToStart = () => {
  jumpToTime(0)
  emit('timeChange', 0)
}

const jumpToEnd = () => {
  jumpToTime(totalDuration.value)
  emit('timeChange', totalDuration.value)
}

const jumpToChapter = (chapter: { startTime: number; endTime: number }) => {
  jumpToTime(chapter.startTime)
  emit('timeChange', chapter.startTime)
}

const onSpeedChange = () => {
  transcriptStore.setPlaybackSpeed(playbackSpeed.value)
}

const zoomIn = () => {
  zoomLevel.value = Math.min(zoomLevel.value * 1.5, 5)
}

const zoomOut = () => {
  zoomLevel.value = Math.max(zoomLevel.value / 1.5, 0.2)
}

const resetZoom = () => {
  zoomLevel.value = 1
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.code === 'Space') {
    e.preventDefault()
    togglePlayback()
  } else if (e.code === 'ArrowLeft') {
    e.preventDefault()
    jumpToTime(Math.max(0, currentTime.value - 5000))
  } else if (e.code === 'ArrowRight') {
    e.preventDefault()
    jumpToTime(Math.min(totalDuration.value, currentTime.value + 5000))
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

watch(currentTime, (time) => {
  emit('timeChange', time)
})
</script>

<style scoped lang="scss">
.timeline-container {
  height: 80px;
  background: var(--bg-primary);
  border-top: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  position: relative;
  user-select: none;
}

.timeline-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 16px;
  height: 32px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  gap: 16px;

  .time-display {
    display: flex;
    align-items: center;
    gap: 4px;
    font-family: 'SF Mono', Monaco, monospace;
    font-size: 12px;
    color: var(--text-primary);

    .current-time {
      color: var(--accent-primary);
      font-weight: 600;
    }

    .separator {
      color: var(--text-secondary);
    }

    .total-time {
      color: var(--text-secondary);
    }
  }

  .playback-controls {
    display: flex;
    align-items: center;
    gap: 4px;

    .control-btn {
      width: 24px;
      height: 24px;
      border: none;
      background: transparent;
      cursor: pointer;
      border-radius: 4px;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;

      &:hover {
        background: var(--bg-hover);
      }

      &.play-btn {
        width: 28px;
        height: 28px;
        background: var(--accent-primary);
        color: white;

        &:hover {
          background: var(--accent-hover);
        }
      }
    }

    .speed-select {
      padding: 2px 6px;
      font-size: 11px;
      border-radius: 4px;
      border: 1px solid var(--border-color);
      background: var(--bg-primary);
      color: var(--text-primary);
      cursor: pointer;
      margin-left: 4px;
    }
  }

  .filter-controls {
    display: flex;
    align-items: center;
    gap: 12px;

    .filter-label {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      color: var(--text-secondary);
      cursor: pointer;

      input {
        margin: 0;
        cursor: pointer;
      }

      .filter-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;

        &.transcript {
          background: #3b82f6;
        }

        &.evidence {
          background: #8b5cf6;
        }

        &.annotation {
          background: #f97316;
        }
      }
    }
  }

  .zoom-controls {
    display: flex;
    align-items: center;
    gap: 4px;

    .control-btn {
      width: 22px;
      height: 22px;
      border: none;
      background: transparent;
      cursor: pointer;
      border-radius: 4px;
      font-size: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;

      &:hover {
        background: var(--bg-hover);
      }
    }

    .zoom-level {
      font-size: 10px;
      color: var(--text-secondary);
      min-width: 36px;
      text-align: center;
    }
  }
}

.timeline-track {
  flex: 1;
  position: relative;
  cursor: crosshair;
  overflow: hidden;
  background: var(--bg-primary);

  &:hover {
    background: var(--bg-secondary);
  }

  .timeline-ruler {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 100%;
    pointer-events: none;

    .ruler-marker {
      position: absolute;
      top: 0;
      height: 100%;
      transform: translateX(-50%);

      .marker-line {
        position: absolute;
        top: 0;
        left: 50%;
        width: 1px;
        height: 8px;
        background: var(--border-color);
      }

      .marker-label {
        position: absolute;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 9px;
        color: var(--text-secondary);
        white-space: nowrap;
        font-family: 'SF Mono', Monaco, monospace;
      }
    }
  }

  .timeline-events {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 100%;
    pointer-events: none;

    .event-group {
      position: absolute;
      left: 0;
      right: 0;
      height: 100%;
    }

    .event-item {
      position: absolute;
      top: 50%;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      cursor: pointer;
      pointer-events: auto;
      transition: all 0.2s;
      z-index: 1;

      &:hover {
        transform: translate(-50%, -50%) scale(1.5);
        z-index: 10;
      }

      &.active {
        transform: translate(-50%, -50%) scale(1.3);
        box-shadow: 0 0 0 3px var(--bg-primary), 0 0 0 5px currentColor;
      }

      .event-tooltip {
        position: absolute;
        bottom: calc(100% + 8px);
        left: 50%;
        transform: translateX(-50%);
        background: var(--bg-tertiary);
        color: var(--text-primary);
        padding: 6px 10px;
        border-radius: 6px;
        font-size: 11px;
        white-space: nowrap;
        opacity: 0;
        visibility: hidden;
        transition: all 0.2s;
        z-index: 100;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

        .tooltip-type {
          font-weight: 600;
          margin-bottom: 2px;
        }

        .tooltip-time {
          color: var(--accent-primary);
          font-family: 'SF Mono', Monaco, monospace;
          font-size: 10px;
          margin-bottom: 2px;
        }

        .tooltip-label {
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }

      &:hover .event-tooltip {
        opacity: 1;
        visibility: visible;
      }
    }
  }

  .timeline-playhead {
    position: absolute;
    top: 0;
    width: 2px;
    height: 100%;
    pointer-events: none;
    z-index: 5;
    transition: left 0.05s linear;

    &.dragging {
      transition: none;
    }

    .playhead-line {
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 2px;
      height: 100%;
      background: var(--accent-primary);
    }

    .playhead-handle {
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 12px;
      height: 12px;
      background: var(--accent-primary);
      border-radius: 50%;
      border: 2px solid var(--bg-primary);
    }
  }

  .timeline-selection {
    position: absolute;
    top: 0;
    height: 100%;
    background: rgba(59, 130, 246, 0.2);
    border-left: 1px solid var(--accent-primary);
    border-right: 1px solid var(--accent-primary);
    pointer-events: none;

    .selection-info {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 10px;
      color: var(--accent-primary);
      font-family: 'SF Mono', Monaco, monospace;
      background: var(--bg-primary);
      padding: 2px 6px;
      border-radius: 4px;
    }
  }
}

.chapters-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 20px;
  display: flex;
  align-items: flex-end;
  pointer-events: none;

  .chapter-item {
    position: absolute;
    bottom: 0;
    height: 16px;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border-color);
    cursor: pointer;
    pointer-events: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    transition: all 0.2s;

    &:hover {
      background: var(--bg-hover);
    }

    &.active {
      background: var(--accent-bg);

      .chapter-title {
        color: var(--accent-primary);
        font-weight: 600;
      }
    }

    .chapter-title {
      font-size: 9px;
      color: var(--text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      padding: 0 4px;
    }
  }
}
</style>
