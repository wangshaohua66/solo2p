<template>
  <div class="public-showcase" ref="showcaseRef" @wheel="handleWheel" @touchstart="handleTouchStart" @touchend="handleTouchEnd">
    <div class="showcase-header" v-if="!isFullscreen">
      <el-button @click="goBack" :icon="ArrowLeft" circle>
        返回
      </el-button>
      <div class="header-info">
        <h1>{{ project?.name }}</h1>
        <p>{{ project?.region }} · {{ HERITAGE_CATEGORY_LABELS[project?.category || 'traditional_skill'] }} · 第{{ project?.batch }}批</p>
      </div>
      <el-button @click="toggleFullscreen" :icon="isFullscreen ? 'Aim' : 'FullScreen'" circle>
        {{ isFullscreen ? '退出全屏' : '全屏' }}
      </el-button>
    </div>

    <div class="progress-bar" v-if="orderedSteps.length > 0">
      <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      <div class="progress-steps">
        <div
          v-for="(_, index) in orderedSteps"
          :key="index"
          class="progress-dot"
          :class="{ 'is-active': index <= currentStepIndex, 'is-current': index === currentStepIndex }"
          @click="goToStep(index)"
        >
          <span class="dot-number">{{ index + 1 }}</span>
        </div>
      </div>
    </div>

    <div class="steps-container">
      <div
        v-for="(step, index) in orderedSteps"
        :key="step.id"
        class="step-section"
        :class="getStepClass(index)"
      >
        <div class="step-content">
          <div class="step-header">
            <div class="step-badge">
              <span class="step-number">{{ index + 1 }}</span>
              <span class="step-total">/ {{ orderedSteps.length }}</span>
            </div>
            <h2 class="step-title">{{ step.name }}</h2>
            <div v-if="step.duration" class="step-duration">
              <el-icon><Timer /></el-icon>
              <span>{{ formatDuration(step.duration) }}</span>
            </div>
          </div>

          <div class="step-body">
            <div class="step-description">
              <p>{{ step.description }}</p>
            </div>

            <div v-if="step.keyTechniques.length > 0" class="step-techniques">
              <h4>关键手法</h4>
              <div class="techniques-tags">
                <el-tag
                  v-for="(technique, i) in step.keyTechniques"
                  :key="i"
                  type="warning"
                  effect="dark"
                  size="large"
                  class="technique-tag"
                  :class="{ 'is-visible': showTechniques[index] }"
                >
                  {{ technique }}
                </el-tag>
              </div>
            </div>

            <div v-if="getStepMedia(step).length > 0" class="step-media">
              <div class="media-carousel">
                <div class="media-track" :style="{ transform: `translateX(-${currentMediaIndex[index] * 100}%)` }">
                  <div
                    v-for="media in getStepMedia(step)"
                    :key="media.id"
                    class="media-item"
                  >
                    <div class="media-wrapper">
                      <img
                        v-if="media.type === 'image'"
                        :src="media.url"
                        :alt="media.name"
                        @load="onImageLoad"
                      />
                      <video
                        v-else
                        :src="media.url"
                        controls
                        muted
                        playsinline
                        @loadedmetadata="onVideoLoaded(media, index, $event)"
                        @timeupdate="onVideoTimeUpdate(media, index, $event)"
                      />
                      <div v-if="media.type === 'image' && media.annotations" class="annotations-layer">
                        <div
                          v-for="annotation in media.annotations"
                          :key="annotation.id"
                          class="annotation-point"
                          :style="{
                            left: annotation.x + '%',
                            top: annotation.y + '%'
                          }"
                        >
                          <div class="pulse-dot"></div>
                          <div
                            class="annotation-tooltip"
                            :class="'arrow-' + annotation.arrowDirection"
                          >
                            {{ annotation.text }}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="media-caption">{{ media.name }}</div>
                  </div>
                </div>
                <el-button
                  v-if="getStepMedia(step).length > 1"
                  class="carousel-btn prev"
                  circle
                  :icon="ArrowLeft"
                  @click.stop="prevMedia(index)"
                />
                <el-button
                  v-if="getStepMedia(step).length > 1"
                  class="carousel-btn next"
                  circle
                  :icon="ArrowRight"
                  @click.stop="nextMedia(index)"
                />
                <div v-if="getStepMedia(step).length > 1" class="carousel-indicators">
                  <span
                    v-for="(_, i) in getStepMedia(step)"
                    :key="i"
                    class="indicator-dot"
                    :class="{ 'is-active': currentMediaIndex[index] === i }"
                    @click.stop="goToMedia(index, i)"
                  />
                </div>
              </div>
            </div>

            <div v-if="step.notes" class="step-notes">
              <el-icon><Document /></el-icon>
              <span>{{ step.notes }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="navigation-hints" v-if="orderedSteps.length > 0">
      <el-button
        v-if="currentStepIndex > 0"
        class="nav-btn prev-btn"
        circle
        size="large"
        :icon="ArrowUp"
        @click="prevStep"
      >
        上一步
      </el-button>
      <el-button
        v-if="currentStepIndex < orderedSteps.length - 1"
        class="nav-btn next-btn"
        circle
        size="large"
        :icon="ArrowDown"
        @click="nextStep"
      >
        下一步
      </el-button>
    </div>

    <div class="inheritors-info" v-if="!isFullscreen && project?.inheritors">
      <h4>传承人</h4>
      <div class="inheritors-list">
        <div
          v-for="inheritor in project.inheritors"
          :key="inheritor.id"
          class="inheritor-card"
        >
          <el-avatar :size="48" :style="{ background: getAvatarColor(inheritor.name) }">
            {{ inheritor.name.slice(0, 1) }}
          </el-avatar>
          <div class="inheritor-info">
            <span class="inheritor-name">{{ inheritor.name }}</span>
            <span class="inheritor-title">{{ inheritor.title }} · {{ inheritor.age }}岁</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!project" class="loading-state">
      <el-empty description="项目不存在或已被删除" />
      <el-button @click="goBack">返回列表</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Timer, Document, FullScreen, Aim } from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/project'
import { HERITAGE_CATEGORY_LABELS } from '@/types'
import type { StepNode, MediaItem } from '@/types'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()

const projectId = computed(() => route.params.projectId as string)
const project = computed(() => projectStore.getProjectById(projectId.value))

const currentStepIndex = ref(0)
const prevStepIndex = ref(0)
const animationDirection = ref<'up' | 'down'>('down')
const isFullscreen = ref(false)
const isAnimating = ref(false)
const showTechniques = ref<Record<number, boolean>>({})
const currentMediaIndex = ref<Record<number, number>>({})

const showcaseRef = ref<HTMLElement | null>(null)
const touchStartY = ref(0)
const touchStartX = ref(0)

const orderedSteps = computed<StepNode[]>(() => {
  if (!project.value || !project.value.stepFlow.nodes.length) return []

  const nodes = [...project.value.stepFlow.nodes]
  const edges = project.value.stepFlow.edges
  const startNode = nodes.find(n => n.type === 'start')

  if (!startNode) {
    return nodes
  }

  const ordered: StepNode[] = []
  const visited = new Set<string>()
  const queue: StepNode[] = [startNode]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current.id)) continue
    visited.add(current.id)
    ordered.push(current)

    const outgoing = edges.filter(e => e.source === current.id)
    outgoing.sort((a, b) => {
      if (a.type === 'branch' && b.type !== 'branch') return 1
      if (a.type !== 'branch' && b.type === 'branch') return -1
      return 0
    })

    outgoing.forEach(edge => {
      const target = nodes.find(n => n.id === edge.target)
      if (target && !visited.has(target.id)) {
        queue.push(target)
      }
    })
  }

  const unvisited = nodes.filter(n => !visited.has(n.id))
  return [...ordered, ...unvisited]
})

const progressPercent = computed(() => {
  if (orderedSteps.value.length === 0) return 0
  return ((currentStepIndex.value + 1) / orderedSteps.value.length) * 100
})

const getStepClass = (index: number) => {
  const classes: string[] = []
  if (index === currentStepIndex.value) {
    classes.push('is-active')
    classes.push(`enter-${animationDirection.value}`)
  } else if (index === prevStepIndex.value && isAnimating.value) {
    classes.push(`leave-${animationDirection.value}`)
  } else if (index < currentStepIndex.value) {
    classes.push('is-before')
  } else {
    classes.push('is-after')
  }
  return classes
}

const getStepMedia = (step: StepNode): MediaItem[] => {
  if (!project.value) return []
  return project.value.mediaLib.filter(m => step.mediaIds.includes(m.id))
}

const getAvatarColor = (name: string) => {
  const colors = ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#722ED1', '#13C2C2']
  const index = name.charCodeAt(0) % colors.length
  return colors[index]
}

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`
  return `${Math.floor(seconds / 3600)}时${Math.floor((seconds % 3600) / 60)}分`
}

const goBack = () => {
  router.push('/projects')
}

const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().then(() => {
      isFullscreen.value = true
    })
  } else {
    document.exitFullscreen().then(() => {
      isFullscreen.value = false
    })
  }
}

const goToStep = (index: number) => {
  if (index < 0 || index >= orderedSteps.value.length || isAnimating.value) return
  if (index === currentStepIndex.value) return

  isAnimating.value = true
  const direction = index > currentStepIndex.value ? 'down' : 'up'
  animationDirection.value = direction
  prevStepIndex.value = currentStepIndex.value
  currentStepIndex.value = index

  if (!showTechniques.value[index]) {
    setTimeout(() => {
      showTechniques.value[index] = true
    }, 300)
  }

  if (!currentMediaIndex.value[index]) {
    currentMediaIndex.value[index] = 0
  }

  const stepMedia = getStepMedia(orderedSteps.value[index])
  if (stepMedia.length > 0) {
    const video = stepMedia.find(m => m.type === 'video')
    if (video) {
      nextTick(() => {
        const videoEl = document.querySelector(`.step-section.is-active video`) as HTMLVideoElement
        if (videoEl) {
          videoEl.currentTime = video.videoStart || 0
          videoEl.play().catch(() => {})
        }
      })
    }
  }

  setTimeout(() => {
    isAnimating.value = false
  }, 700)
}

const nextStep = () => {
  if (currentStepIndex.value < orderedSteps.value.length - 1) {
    goToStep(currentStepIndex.value + 1)
  }
}

const prevStep = () => {
  if (currentStepIndex.value > 0) {
    goToStep(currentStepIndex.value - 1)
  }
}

const handleWheel = (event: WheelEvent) => {
  if (isAnimating.value) return
  event.preventDefault()
  if (event.deltaY > 50) {
    nextStep()
  } else if (event.deltaY < -50) {
    prevStep()
  }
}

const handleTouchStart = (event: TouchEvent) => {
  touchStartY.value = event.touches[0].clientY
  touchStartX.value = event.touches[0].clientX
}

const handleTouchMove = (event: TouchEvent) => {
  event.preventDefault()
}

const handleTouchEnd = (event: TouchEvent) => {
  if (isAnimating.value) return
  const deltaY = touchStartY.value - event.changedTouches[0].clientY
  const deltaX = touchStartX.value - event.changedTouches[0].clientX

  if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 50) {
    if (deltaY > 0) {
      nextStep()
    } else {
      prevStep()
    }
  }
}

const prevMedia = (stepIndex: number) => {
  const mediaCount = getStepMedia(orderedSteps.value[stepIndex]).length
  if (mediaCount > 1) {
    const current = currentMediaIndex.value[stepIndex] || 0
    currentMediaIndex.value[stepIndex] = current > 0 ? current - 1 : mediaCount - 1
  }
}

const nextMedia = (stepIndex: number) => {
  const mediaCount = getStepMedia(orderedSteps.value[stepIndex]).length
  if (mediaCount > 1) {
    const current = currentMediaIndex.value[stepIndex] || 0
    currentMediaIndex.value[stepIndex] = current < mediaCount - 1 ? current + 1 : 0
  }
}

const goToMedia = (stepIndex: number, mediaIndex: number) => {
  currentMediaIndex.value[stepIndex] = mediaIndex
}

const onImageLoad = () => {
}

const onVideoLoaded = (media: MediaItem, stepIndex: number, event: Event) => {
  const videoEl = event.target as HTMLVideoElement
  if (stepIndex === currentStepIndex.value && media.videoStart !== undefined) {
    videoEl.currentTime = media.videoStart
    if (stepIndex === currentStepIndex.value) {
      videoEl.play().catch(() => {})
    }
  }
}

const onVideoTimeUpdate = (media: MediaItem, stepIndex: number, event: Event) => {
  const videoEl = event.target as HTMLVideoElement
  if (media.videoEnd !== undefined && videoEl.currentTime >= media.videoEnd) {
    if (media.videoStart !== undefined) {
      videoEl.currentTime = media.videoStart
    } else {
      videoEl.pause()
    }
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
    event.preventDefault()
    nextStep()
  } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
    event.preventDefault()
    prevStep()
  } else if (event.key === 'Escape') {
    if (isFullscreen.value) {
      toggleFullscreen()
    }
  }
}

const handleFullscreenChange = () => {
  isFullscreen.value = !!document.fullscreenElement
}

onMounted(() => {
  if (!project.value) {
    ElMessage.error('项目不存在')
    return
  }

  if (orderedSteps.value.length > 0) {
    showTechniques.value[0] = true
    currentMediaIndex.value[0] = 0
  }

  window.addEventListener('keydown', handleKeydown)
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  
  if (showcaseRef.value) {
    showcaseRef.value.addEventListener('touchmove', handleTouchMove, { passive: false })
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  
  if (showcaseRef.value) {
    showcaseRef.value.removeEventListener('touchmove', handleTouchMove)
  }
})

watch(() => project.value, (newProject) => {
  if (newProject && orderedSteps.value.length > 0) {
    nextTick(() => {
      showTechniques.value[0] = true
      currentMediaIndex.value[0] = 0
    })
  }
})
</script>

<style lang="scss" scoped>
.public-showcase {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  color: #fff;
}

.showcase-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);

  .header-info {
    text-align: center;

    h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 600;
      letter-spacing: 2px;
    }

    p {
      margin: 4px 0 0 0;
      font-size: 13px;
      color: rgba(255, 255, 255, 0.7);
    }
  }
}

.progress-bar {
  position: fixed;
  top: 80px;
  left: 0;
  right: 0;
  z-index: 90;
  padding: 0 40px;

  .progress-fill {
    position: absolute;
    top: 50%;
    left: 40px;
    right: 40px;
    height: 2px;
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-50%);
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      width: 100%;
      background: linear-gradient(90deg, #409EFF, #67C23A);
      transform-origin: left;
    }
  }

  .progress-steps {
    display: flex;
    justify-content: space-between;
    position: relative;
    z-index: 1;

    .progress-dot {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.3s ease;

      &.is-active {
        background: #409EFF;
      }

      &.is-current {
        transform: scale(1.2);
        background: #67C23A;
        box-shadow: 0 0 20px rgba(103, 194, 58, 0.5);
      }

      .dot-number {
        font-size: 12px;
        font-weight: 600;
      }
    }
  }
}

.steps-container {
  position: relative;
  height: 100%;
  overflow: hidden;
}

.step-section {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 120px 60px 80px;
  box-sizing: border-box;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.7s cubic-bezier(0.4, 0, 0.2, 1), transform 0.7s cubic-bezier(0.4, 0, 0.2, 1);

  &.is-active {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
    z-index: 2;
  }

  &.is-before {
    transform: translateY(-80px);
    z-index: 1;
  }

  &.is-after {
    transform: translateY(80px);
    z-index: 1;
  }

  &.leave-up {
    opacity: 0;
    transform: translateY(-80px);
    z-index: 2;
  }

  &.leave-down {
    opacity: 0;
    transform: translateY(80px);
    z-index: 2;
  }

  .step-content {
    max-width: 1200px;
    width: 100%;
  }

  .step-header {
    text-align: center;
    margin-bottom: 40px;

    .step-badge {
      display: inline-flex;
      align-items: baseline;
      gap: 4px;
      padding: 6px 16px;
      background: rgba(64, 158, 255, 0.2);
      border-radius: 20px;
      margin-bottom: 16px;

      .step-number {
        font-size: 24px;
        font-weight: 700;
        color: #409EFF;
      }

      .step-total {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.6);
      }
    }

    .step-title {
      margin: 0 0 12px 0;
      font-size: 36px;
      font-weight: 700;
      letter-spacing: 4px;
      background: linear-gradient(135deg, #fff 0%, #409EFF 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .step-duration {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      color: rgba(255, 255, 255, 0.7);
    }
  }

  .step-body {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 60px;
    align-items: center;
  }

  .step-description {
    p {
      margin: 0;
      font-size: 16px;
      line-height: 2;
      color: rgba(255, 255, 255, 0.85);
      text-indent: 2em;
    }
  }

  .step-techniques {
    margin-top: 32px;

    h4 {
      margin: 0 0 16px 0;
      font-size: 14px;
      color: rgba(255, 255, 255, 0.6);
      letter-spacing: 2px;
    }

    .techniques-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;

      .technique-tag {
        opacity: 0;
        transform: translateY(20px);
        animation: fadeInUp 0.5s ease forwards;

        &.is-visible {
          opacity: 1;
          transform: translateY(0);
        }

        &:nth-child(1) { animation-delay: 0.1s; }
        &:nth-child(2) { animation-delay: 0.2s; }
        &:nth-child(3) { animation-delay: 0.3s; }
        &:nth-child(4) { animation-delay: 0.4s; }
        &:nth-child(5) { animation-delay: 0.5s; }
      }
    }
  }

  .step-media {
    .media-carousel {
      position: relative;
      overflow: hidden;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);

      .media-track {
        display: flex;
        transition: transform 0.5s ease;
      }

      .media-item {
        flex-shrink: 0;
        width: 100%;

        .media-wrapper {
          position: relative;
          aspect-ratio: 16 / 9;
          background: #000;

          img, video {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
        }

        .media-caption {
          padding: 12px 16px;
          background: rgba(0, 0, 0, 0.5);
          text-align: center;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.8);
        }
      }

      .carousel-btn {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        background: rgba(0, 0, 0, 0.5);
        border: none;
        color: #fff;

        &.prev {
          left: 16px;
        }

        &.next {
          right: 16px;
        }

        &:hover {
          background: rgba(0, 0, 0, 0.7);
        }
      }

      .carousel-indicators {
        position: absolute;
        bottom: 60px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 8px;

        .indicator-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.4);
          cursor: pointer;
          transition: all 0.3s ease;

          &.is-active {
            width: 24px;
            border-radius: 4px;
            background: #409EFF;
          }
        }
      }
    }
  }

  .annotations-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;

    .annotation-point {
      position: absolute;
      transform: translate(-50%, -50%);

      .pulse-dot {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #F56C6C;
        box-shadow: 0 0 0 0 rgba(245, 108, 108, 0.7);
        animation: pulse 2s infinite;
        cursor: pointer;
        pointer-events: auto;
      }

      .annotation-tooltip {
        position: absolute;
        background: rgba(0, 0, 0, 0.85);
        color: #fff;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 13px;
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease;

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

      &:hover .annotation-tooltip {
        opacity: 1;
      }
    }
  }

  .step-notes {
    margin-top: 24px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.05);
    border-left: 3px solid #E6A23C;
    border-radius: 4px;
    display: flex;
    gap: 8px;
    align-items: flex-start;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.7);
    line-height: 1.6;
  }
}

.navigation-hints {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  z-index: 80;

  .nav-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #fff;
    backdrop-filter: blur(10px);
    transition: all 0.3s ease;

    &:hover {
      background: rgba(64, 158, 255, 0.3);
      border-color: #409EFF;
    }

    &.prev-btn {
      position: fixed;
      top: 120px;
    }

    &.next-btn {
      position: fixed;
      bottom: 100px;
    }
  }
}

.inheritors-info {
  position: fixed;
  bottom: 24px;
  left: 24px;
  right: 24px;
  z-index: 90;
  padding: 16px 24px;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  border-radius: 12px;

  h4 {
    margin: 0 0 12px 0;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.6);
    letter-spacing: 1px;
  }

  .inheritors-list {
    display: flex;
    gap: 24px;
    flex-wrap: wrap;

    .inheritor-card {
      display: flex;
      align-items: center;
      gap: 12px;

      .inheritor-info {
        display: flex;
        flex-direction: column;

        .inheritor-name {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
        }

        .inheritor-title {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
        }
      }
    }
  }
}

.loading-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;

  :deep(.el-empty__description) {
    color: rgba(255, 255, 255, 0.6);
  }
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(245, 108, 108, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(245, 108, 108, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(245, 108, 108, 0);
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 768px) {
  .step-section {
    padding: 100px 20px 100px;

    .step-header {
      margin-bottom: 24px;

      .step-title {
        font-size: 24px;
      }
    }

    .step-body {
      grid-template-columns: 1fr;
      gap: 24px;
    }
  }

  .showcase-header {
    padding: 12px 16px;

    .header-info h1 {
      font-size: 16px;
    }
  }

  .inheritors-info {
    display: none;
  }

  .navigation-hints .nav-btn {
    &.prev-btn {
      top: 100px;
    }

    &.next-btn {
      bottom: 20px;
    }
  }
}
</style>
