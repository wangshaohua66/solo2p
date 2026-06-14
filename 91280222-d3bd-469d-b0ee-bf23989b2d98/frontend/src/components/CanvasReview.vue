<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useReviewStore } from '@/stores/reviewStore'
import { useThemeStore } from '@/stores/themeStore'
import type { Annotation, AnnotationType, AnnotationGeometry, AnnotationPoint } from '@/types/annotation'

const reviewStore = useReviewStore()
const themeStore = useThemeStore()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const compareCanvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const overlayRef = ref<HTMLCanvasElement | null>(null)

const backgroundImage = ref<HTMLImageElement | null>(null)
const compareBackgroundImage = ref<HTMLImageElement | null>(null)
const isDrawing = ref(false)
const drawingPoints = ref<AnnotationPoint[]>([])
const hoveredAnnotationId = ref<string | null>(null)

const toolColors: Record<AnnotationType, string> = {
  rectangle: '#ef4444',
  circle: '#f59e0b',
  arrow: '#3b82f6',
  freeform: '#10b981'
}

const currentPage = computed(() => reviewStore.canvas.currentPage)
const zoom = computed(() => reviewStore.canvas.zoom)
const panX = computed(() => reviewStore.canvas.panX)
const panY = computed(() => reviewStore.canvas.panY)
const activeTool = computed(() => reviewStore.canvas.activeTool)
const isCompareMode = computed(() => reviewStore.isCompareMode)
const currentVersion = computed(() => reviewStore.currentVersion)
const compareVersion = computed(() => reviewStore.compareVersion)
const pageAnnotations = computed(() => reviewStore.currentPageAnnotations)
const pageDiffs = computed(() => reviewStore.currentPageDiffs)
const highlightIds = computed(() => reviewStore.highlightAnnotationIds)

const currentPageData = computed(() => {
  if (!currentVersion.value) return null
  return currentVersion.value.pages.find((p) => p.pageNumber === currentPage.value) || null
})

const comparePageData = computed(() => {
  if (!compareVersion.value) return null
  return compareVersion.value.pages.find((p) => p.pageNumber === currentPage.value) || null
})

function getCanvasContext(): CanvasRenderingContext2D | null {
  return canvasRef.value?.getContext('2d') || null
}

function getOverlayContext(): CanvasRenderingContext2D | null {
  return overlayRef.value?.getContext('2d') || null
}

function screenToCanvas(screenX: number, screenY: number): AnnotationPoint {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return { x: 0, y: 0 }
  return {
    x: (screenX - rect.left - panX.value) / zoom.value,
    y: (screenY - rect.top - panY.value) / zoom.value
  }
}

function loadBackgroundImage() {
  if (!currentPageData.value) return
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    backgroundImage.value = img
    resizeCanvas()
    render()
  }
  img.onerror = () => {
    backgroundImage.value = null
    resizeCanvas()
    render()
  }
  img.src = currentPageData.value.imageUrl
}

function loadCompareImage() {
  if (!comparePageData.value) {
    compareBackgroundImage.value = null
    return
  }
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    compareBackgroundImage.value = img
    resizeCanvas()
    render()
  }
  img.onerror = () => {
    compareBackgroundImage.value = null
  }
  img.src = comparePageData.value.imageUrl
}

function resizeCanvas() {
  const container = containerRef.value
  const canvas = canvasRef.value
  const overlay = overlayRef.value
  const compareCanvas = compareCanvasRef.value
  if (!container || !canvas || !overlay) return

  const dpr = window.devicePixelRatio || 1
  const width = isCompareMode.value ? container.clientWidth / 2 : container.clientWidth
  const height = container.clientHeight

  ;[canvas, overlay].forEach((c) => {
    c.width = width * dpr
    c.height = height * dpr
    c.style.width = `${width}px`
    c.style.height = `${height}px`
    const ctx = c.getContext('2d')
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  })

  if (compareCanvas) {
    compareCanvas.width = width * dpr
    compareCanvas.height = height * dpr
    compareCanvas.style.width = `${width}px`
    compareCanvas.style.height = `${height}px`
    const ctx = compareCanvas.getContext('2d')
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
}

function render() {
  renderMainCanvas()
  renderOverlay()
  if (isCompareMode.value) {
    renderCompareCanvas()
  }
}

function renderMainCanvas() {
  const ctx = getCanvasContext()
  const canvas = canvasRef.value
  if (!ctx || !canvas) return

  const bg = themeStore.mode === 'dark' ? '#111827' : '#f9fafb'
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight)

  ctx.save()
  ctx.translate(panX.value, panY.value)
  ctx.scale(zoom.value, zoom.value)

  if (backgroundImage.value && currentPageData.value) {
    ctx.drawImage(backgroundImage.value, 0, 0, currentPageData.value.width, currentPageData.value.height)
  } else if (currentPageData.value) {
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = '#e5e7eb'
    ctx.fillRect(0, 0, currentPageData.value.width, currentPageData.value.height)
    ctx.strokeRect(0, 0, currentPageData.value.width, currentPageData.value.height)
    ctx.fillStyle = '#6b7280'
    ctx.font = '16px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('图纸加载中...', currentPageData.value.width / 2, currentPageData.value.height / 2)
  }

  if (reviewStore.canvas.showGrid && currentPageData.value) {
    drawGrid(ctx, currentPageData.value.width, currentPageData.value.height)
  }

  pageAnnotations.value.forEach((annotation) => {
    drawAnnotation(ctx, annotation, highlightIds.value.has(annotation.id))
  })

  if (isCompareMode.value) {
    pageDiffs.value.forEach((diff) => {
      ctx.save()
      ctx.globalAlpha = 0.3
      if (diff.type === 'added') ctx.fillStyle = '#10b981'
      else if (diff.type === 'removed') ctx.fillStyle = '#ef4444'
      else ctx.fillStyle = '#f59e0b'
      ctx.fillRect(diff.bounds.x, diff.bounds.y, diff.bounds.width, diff.bounds.height)
      ctx.strokeStyle = diff.type === 'added' ? '#10b981' : diff.type === 'removed' ? '#ef4444' : '#f59e0b'
      ctx.lineWidth = 2 / zoom.value
      ctx.setLineDash([4 / zoom.value, 4 / zoom.value])
      ctx.strokeRect(diff.bounds.x, diff.bounds.y, diff.bounds.width, diff.bounds.height)
      ctx.restore()
    })
  }

  ctx.restore()
}

function renderCompareCanvas() {
  const canvas = compareCanvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const bg = themeStore.mode === 'dark' ? '#111827' : '#f9fafb'
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight)

  ctx.save()
  ctx.translate(panX.value, panY.value)
  ctx.scale(zoom.value, zoom.value)

  if (compareBackgroundImage.value && comparePageData.value) {
    ctx.drawImage(compareBackgroundImage.value, 0, 0, comparePageData.value.width, comparePageData.value.height)
  } else if (comparePageData.value) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, comparePageData.value.width, comparePageData.value.height)
  }

  ctx.restore()
}

function renderOverlay() {
  const ctx = getOverlayContext()
  const overlay = overlayRef.value
  if (!ctx || !overlay) return

  ctx.clearRect(0, 0, overlay.clientWidth, overlay.clientHeight)

  if (isDrawing.value && drawingPoints.value.length > 0 && activeTool.value && activeTool.value !== 'select') {
    ctx.save()
    ctx.translate(panX.value, panY.value)
    ctx.scale(zoom.value, zoom.value)

    const color = toolColors[activeTool.value as AnnotationType]
    ctx.strokeStyle = color
    ctx.fillStyle = color + '20'
    ctx.lineWidth = 2 / zoom.value
    ctx.setLineDash([6 / zoom.value, 4 / zoom.value])

    const points = drawingPoints.value
    switch (activeTool.value) {
      case 'rectangle':
        if (points.length >= 2) {
          const w = points[1].x - points[0].x
          const h = points[1].y - points[0].y
          ctx.fillRect(points[0].x, points[0].y, w, h)
          ctx.strokeRect(points[0].x, points[0].y, w, h)
        }
        break
      case 'circle':
        if (points.length >= 2) {
          const cx = (points[0].x + points[1].x) / 2
          const cy = (points[0].y + points[1].y) / 2
          const rx = Math.abs(points[1].x - points[0].x) / 2
          const ry = Math.abs(points[1].y - points[0].y) / 2
          ctx.beginPath()
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
        }
        break
      case 'arrow':
        if (points.length >= 2) {
          drawArrow(ctx, points[0], points[1])
        }
        break
      case 'freeform':
        if (points.length > 1) {
          ctx.beginPath()
          ctx.setLineDash([])
          ctx.moveTo(points[0].x, points[0].y)
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y)
          }
          ctx.stroke()
        }
        break
    }
    ctx.restore()
  }
}

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const gridSize = 50
  ctx.strokeStyle = themeStore.mode === 'dark' ? '#374151' : '#e5e7eb'
  ctx.lineWidth = 0.5 / zoom.value
  ctx.beginPath()
  for (let x = 0; x <= width; x += gridSize) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
  }
  for (let y = 0; y <= height; y += gridSize) {
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
  }
  ctx.stroke()
}

function drawAnnotation(ctx: CanvasRenderingContext2D, annotation: Annotation, highlighted: boolean) {
  const g = annotation.geometry
  const isHovered = hoveredAnnotationId.value === annotation.id
  ctx.save()

  const baseColor = toolColors[g.type]
  const fillColor = highlighted || isHovered ? baseColor + '40' : baseColor + '20'
  const strokeColor = highlighted || isHovered ? baseColor : baseColor + 'cc'
  const lineWidth = (highlighted || isHovered ? 3 : 2) / zoom.value

  ctx.strokeStyle = strokeColor
  ctx.fillStyle = fillColor
  ctx.lineWidth = lineWidth
  ctx.setLineDash([])

  const points = g.points
  switch (g.type) {
    case 'rectangle':
      if (points.length >= 2) {
        const w = (g.width ?? points[1].x - points[0].x)
        const h = (g.height ?? points[1].y - points[0].y)
        ctx.fillRect(points[0].x, points[0].y, w, h)
        ctx.strokeRect(points[0].x, points[0].y, w, h)
      }
      break
    case 'circle':
      if (points.length >= 1) {
        ctx.beginPath()
        const r = g.radius ?? 50
        ctx.arc(points[0].x, points[0].y, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
      break
    case 'arrow':
      if (points.length >= 2) {
        drawArrow(ctx, points[0], points[1])
      }
      break
    case 'freeform':
      if (points.length > 1) {
        ctx.beginPath()
        ctx.moveTo(points[0].x, points[0].y)
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y)
        }
        ctx.stroke()
      }
      break
  }

  if (annotation.status !== 'resolved') {
    const badgePos = getAnnotationBadgePosition(annotation)
    ctx.beginPath()
    ctx.arc(badgePos.x, badgePos.y, 8 / zoom.value, 0, Math.PI * 2)
    ctx.fillStyle = annotation.severity === 'critical' ? '#ef4444' : annotation.severity === 'high' ? '#f59e0b' : annotation.severity === 'medium' ? '#3b82f6' : '#10b981'
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.5 / zoom.value
    ctx.stroke()
  }

  ctx.restore()
}

function getAnnotationBadgePosition(annotation: Annotation): AnnotationPoint {
  const g = annotation.geometry
  if (g.points.length === 0) return { x: 0, y: 0 }
  if (g.type === 'rectangle' && g.points.length >= 2) {
    return {
      x: Math.max(g.points[0].x, g.points[1].x),
      y: Math.min(g.points[0].y, g.points[1].y)
    }
  }
  if (g.type === 'circle') {
    return { x: g.points[0].x + (g.radius || 50), y: g.points[0].y - (g.radius || 50) }
  }
  return { x: g.points[0].x, y: g.points[0].y - 10 }
}

function drawArrow(ctx: CanvasRenderingContext2D, from: AnnotationPoint, to: AnnotationPoint) {
  const headLength = 15 / zoom.value
  const angle = Math.atan2(to.y - from.y, to.x - from.x)

  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x, to.y)
  ctx.stroke()

  ctx.fillStyle = ctx.strokeStyle as string
  ctx.beginPath()
  ctx.moveTo(to.x, to.y)
  ctx.lineTo(
    to.x - headLength * Math.cos(angle - Math.PI / 6),
    to.y - headLength * Math.sin(angle - Math.PI / 6)
  )
  ctx.lineTo(
    to.x - headLength * Math.cos(angle + Math.PI / 6),
    to.y - headLength * Math.sin(angle + Math.PI / 6)
  )
  ctx.closePath()
  ctx.fill()
}

function findAnnotationAtPoint(pt: AnnotationPoint): Annotation | null {
  for (let i = pageAnnotations.value.length - 1; i >= 0; i--) {
    const a = pageAnnotations.value[i]
    if (isPointInAnnotation(pt, a)) {
      return a
    }
  }
  return null
}

function isPointInAnnotation(pt: AnnotationPoint, annotation: Annotation): boolean {
  const g = annotation.geometry
  const tolerance = 10 / zoom.value

  switch (g.type) {
    case 'rectangle':
      if (g.points.length < 2) return false
      const minX = Math.min(g.points[0].x, g.points[1].x) - tolerance
      const maxX = Math.max(g.points[0].x, g.points[1].x) + tolerance
      const minY = Math.min(g.points[0].y, g.points[1].y) - tolerance
      const maxY = Math.max(g.points[0].y, g.points[1].y) + tolerance
      return pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY
    case 'circle':
      if (g.points.length < 1) return false
      const r = (g.radius || 50) + tolerance
      const dx = pt.x - g.points[0].x
      const dy = pt.y - g.points[0].y
      return dx * dx + dy * dy <= r * r
    case 'freeform':
      for (const p of g.points) {
        const ddx = pt.x - p.x
        const ddy = pt.y - p.y
        if (ddx * ddx + ddy * ddy <= tolerance * tolerance) return true
      }
      return false
    case 'arrow':
      if (g.points.length < 2) return false
      return distToSegment(pt, g.points[0], g.points[1]) <= tolerance
    default:
      return false
  }
}

function distToSegment(p: AnnotationPoint, a: AnnotationPoint, b: AnnotationPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

function handleMouseDown(e: MouseEvent) {
  if (e.button !== 0) return
  const pt = screenToCanvas(e.clientX, e.clientY)

  if (activeTool.value === 'select' || !activeTool.value) {
    const hit = findAnnotationAtPoint(pt)
    if (hit) {
      reviewStore.selectAnnotation(hit.id)
    } else {
      reviewStore.selectAnnotation(null)
    }
    return
  }

  if (activeTool.value && activeTool.value !== 'select') {
    isDrawing.value = true
    drawingPoints.value = [pt]
  }
}

function handleMouseMove(e: MouseEvent) {
  const pt = screenToCanvas(e.clientX, e.clientY)
  const hit = findAnnotationAtPoint(pt)
  hoveredAnnotationId.value = hit?.id || null
  reviewStore.highlightAnnotations(hit ? [hit.id] : [])

  if (isDrawing.value) {
    if (activeTool.value === 'freeform') {
      drawingPoints.value.push(pt)
    } else if (drawingPoints.value.length >= 1) {
      drawingPoints.value = [drawingPoints.value[0], pt]
    }
    renderOverlay()
  }
}

function handleMouseUp(_e: MouseEvent) {
  if (!isDrawing.value) return
  isDrawing.value = false

  if (drawingPoints.value.length < 2 && activeTool.value !== 'freeform') {
    drawingPoints.value = []
    renderOverlay()
    return
  }

  if (activeTool.value && activeTool.value !== 'select' && drawingPoints.value.length > 0) {
    const type = activeTool.value as AnnotationType
    const geometry: AnnotationGeometry = {
      type,
      points: drawingPoints.value,
      color: toolColors[type],
      strokeWidth: 2
    }
    if (type === 'rectangle' && drawingPoints.value.length >= 2) {
      geometry.width = drawingPoints.value[1].x - drawingPoints.value[0].x
      geometry.height = drawingPoints.value[1].y - drawingPoints.value[0].y
    }
    if (type === 'circle' && drawingPoints.value.length >= 2) {
      const cx = (drawingPoints.value[0].x + drawingPoints.value[1].x) / 2
      const cy = (drawingPoints.value[0].y + drawingPoints.value[1].y) / 2
      geometry.points = [{ x: cx, y: cy }]
      geometry.radius = Math.max(
        Math.abs(drawingPoints.value[1].x - drawingPoints.value[0].x) / 2,
        Math.abs(drawingPoints.value[1].y - drawingPoints.value[0].y) / 2
      )
    }
    reviewStore.setDraftGeometry(geometry)
  }

  drawingPoints.value = []
  renderOverlay()
  render()
}

function handleWheel(e: WheelEvent) {
  e.preventDefault()
  const delta = e.deltaY > 0 ? 0.9 : 1.1
  reviewStore.setZoom(reviewStore.canvas.zoom * delta)
  render()
}

let isDragging = false
let lastX = 0
let lastY = 0

function handleMiddleMouseDown(e: MouseEvent) {
  if (e.button === 1) {
    isDragging = true
    lastX = e.clientX
    lastY = e.clientY
    reviewStore.canvas.isPanning = true
  }
}

function handleMouseMoveDrag(e: MouseEvent) {
  if (isDragging) {
    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    reviewStore.setPan(reviewStore.canvas.panX + dx, reviewStore.canvas.panY + dy)
    lastX = e.clientX
    lastY = e.clientY
    render()
  }
}

function handleMouseUpDrag(_e: MouseEvent) {
  isDragging = false
  reviewStore.canvas.isPanning = false
}

function handleResize() {
  resizeCanvas()
  render()
}

watch(currentPage, () => {
  loadBackgroundImage()
  if (isCompareMode.value) loadCompareImage()
})

watch(isCompareMode, () => {
  resizeCanvas()
  if (isCompareMode.value) loadCompareImage()
  render()
})

watch([zoom, panX, panY, () => pageAnnotations.value, () => highlightIds.value], () => {
  nextTick(render)
}, { deep: true })

watch(currentVersion, () => {
  loadBackgroundImage()
})

onMounted(() => {
  resizeCanvas()
  loadBackgroundImage()
  if (isCompareMode.value) loadCompareImage()

  window.addEventListener('resize', handleResize)

  const el = containerRef.value
  if (el) {
    el.addEventListener('mousedown', handleMiddleMouseDown)
    el.addEventListener('mousemove', handleMouseMoveDrag)
    el.addEventListener('mouseup', handleMouseUpDrag)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  const el = containerRef.value
  if (el) {
    el.removeEventListener('mousedown', handleMiddleMouseDown)
    el.removeEventListener('mousemove', handleMouseMoveDrag)
    el.removeEventListener('mouseup', handleMouseUpDrag)
  }
})

defineExpose({
  render,
  resizeCanvas
})
</script>

<template>
  <div
    ref="containerRef"
    class="canvas-container"
    :class="{ 'is-dragging': isDragging, 'compare-mode': isCompareMode }"
  >
    <div class="canvas-wrapper" :class="{ 'with-compare': isCompareMode }">
      <canvas
        ref="canvasRef"
        class="main-canvas"
        @mousedown="handleMouseDown"
        @mousemove="handleMouseMove"
        @mouseup="handleMouseUp"
        @mouseleave="handleMouseUp"
        @wheel.passive="handleWheel"
      />
      <canvas
        ref="overlayRef"
        class="overlay-canvas"
        @mousedown="handleMouseDown"
        @mousemove="handleMouseMove"
        @mouseup="handleMouseUp"
        @mouseleave="handleMouseUp"
        @wheel.passive="handleWheel"
      />
    </div>
    <div v-if="isCompareMode" class="compare-wrapper">
      <div class="compare-label">{{ compareVersion?.version || '对比版本' }}</div>
      <canvas ref="compareCanvasRef" class="compare-canvas" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.canvas-container {
  position: relative;
  width: 100%;
  height: 100%;
  background: $bg-light;
  overflow: hidden;
  display: flex;

  &.dark {
    background: $dark-bg-base;
  }

  &.is-dragging {
    cursor: grabbing;
  }
}

.canvas-wrapper,
.compare-wrapper {
  position: relative;
  flex: 1;
  height: 100%;
  overflow: hidden;
}

.canvas-wrapper {
  cursor: crosshair;
}

.compare-wrapper {
  border-left: 2px solid $border-color;

  .dark & {
    border-left-color: $dark-border-color;
  }
}

.compare-label {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 12px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  border-radius: $radius-md;
  font-size: 12px;
  z-index: 10;
  pointer-events: none;
}

.main-canvas,
.compare-canvas,
.overlay-canvas {
  display: block;
}

.overlay-canvas {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}
</style>
