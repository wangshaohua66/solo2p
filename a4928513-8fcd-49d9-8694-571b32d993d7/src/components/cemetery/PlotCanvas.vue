<template>
  <div class="plot-canvas-wrapper" ref="wrapperRef">
    <div class="canvas-controls">
      <div class="control-group">
        <button class="control-btn" @click="zoomIn" title="放大">
          <el-icon><ZoomIn /></el-icon>
        </button>
        <div class="zoom-level">{{ Math.round(scale * 100) }}%</div>
        <button class="control-btn" @click="zoomOut" title="缩小">
          <el-icon><ZoomOut /></el-icon>
        </button>
        <button class="control-btn" @click="resetView" title="重置视图">
          <el-icon><Aim /></el-icon>
        </button>
      </div>
      <div class="stats-panel">
        <div class="stat-item">
          <span class="stat-label">总数</span>
          <span class="stat-value total">{{ areaStats.total }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-dot for-sale"></span>
          <span class="stat-label">在售</span>
          <span class="stat-value">{{ areaStats.forSale }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-dot sold"></span>
          <span class="stat-label">已售</span>
          <span class="stat-value">{{ areaStats.sold }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-dot occupied"></span>
          <span class="stat-label">已安葬</span>
          <span class="stat-value">{{ areaStats.occupied }}</span>
        </div>
      </div>
    </div>

    <canvas
      ref="canvasRef"
      class="plot-canvas"
      @wheel="onWheel"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseLeave"
      @click="onClick"
    />

    <Teleport to="body">
      <transition name="fade">
        <div
          v-if="hoverPlot && tooltipVisible"
          class="plot-tooltip"
          :style="tooltipStyle"
        >
          <div class="tooltip-header">
            <span class="plot-no">{{ hoverPlot.plotNo }}</span>
            <StatusTag :status="hoverPlot.status" type="plot" />
          </div>
          <div class="tooltip-row">
            <span class="label">类型：</span>
            <span class="value">{{ plotTypeMap[hoverPlot.type] }}</span>
          </div>
          <div class="tooltip-row">
            <span class="label">位置：</span>
            <span class="value">{{ hoverPlot.areaName }} {{ hoverPlot.row }}排{{ hoverPlot.col }}列</span>
          </div>
          <div class="tooltip-row price-row">
            <span class="label">价格：</span>
            <span class="value price">¥{{ hoverPlot.price.toLocaleString() }}</span>
          </div>
          <div v-if="hoverPlot.remainsName" class="tooltip-row">
            <span class="label">逝者：</span>
            <span class="value">{{ hoverPlot.remainsName }}</span>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { ZoomIn, ZoomOut, Aim } from '@element-plus/icons-vue'
import StatusTag from '@/components/common/StatusTag.vue'
import { plotTypeMap } from '@/utils/status'
import type { CemeteryPlot } from '@/types/cemetery'

const props = defineProps<{
  plots: CemeteryPlot[]
  selectedAreaId: string
  selectedPlotId?: string | null
}>()

const emit = defineEmits<{
  (e: 'select-plot', plot: CemeteryPlot | null): void
  (e: 'hover-plot', plot: CemeteryPlot | null): void
}>()

const wrapperRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null

const scale = ref(1)
const offsetX = ref(0)
const offsetY = ref(0)
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const dragOffset = ref({ x: 0, y: 0 })
const hoverPlot = ref<CemeteryPlot | null>(null)
const tooltipVisible = ref(false)
const tooltipPosition = ref({ x: 0, y: 0 })

const minScale = 0.3
const maxScale = 3
const plotTypeSize: Record<string, { w: number; h: number; borderWidth: number }> = {
  standard: { w: 50, h: 70, borderWidth: 1.5 },
  double: { w: 72, h: 70, borderWidth: 2 },
  premium: { w: 86, h: 90, borderWidth: 2.5 },
  family: { w: 110, h: 120, borderWidth: 3 },
  ashes_wall: { w: 28, h: 24, borderWidth: 1 }
}

const statusColors: Record<string, { fill: string; stroke: string }> = {
  for_sale: { fill: 'rgba(82, 196, 26, 0.25)', stroke: '#52C41A' },
  sold: { fill: 'rgba(24, 144, 255, 0.25)', stroke: '#1890FF' },
  reserved: { fill: 'rgba(250, 140, 22, 0.25)', stroke: '#FA8C16' },
  occupied: { fill: 'rgba(140, 140, 140, 0.25)', stroke: '#8C8C8C' },
  maintenance: { fill: 'rgba(255, 77, 79, 0.25)', stroke: '#FF4D4F' }
}

const areaPlots = computed(() => props.plots.filter((p) => p.areaId === props.selectedAreaId))

const areaStats = computed(() => {
  const list = areaPlots.value
  return {
    total: list.length,
    forSale: list.filter((p) => p.status === 'for_sale').length,
    sold: list.filter((p) => p.status === 'sold').length,
    reserved: list.filter((p) => p.status === 'reserved').length,
    occupied: list.filter((p) => p.status === 'occupied').length,
    maintenance: list.filter((p) => p.status === 'maintenance').length
  }
})

const tooltipStyle = computed(() => ({
  left: `${tooltipPosition.value.x + 16}px`,
  top: `${tooltipPosition.value.y + 16}px`
}))

function resizeCanvas() {
  const canvas = canvasRef.value
  const wrapper = wrapperRef.value
  if (!canvas || !wrapper) return
  const dpr = window.devicePixelRatio || 1
  const rect = wrapper.getBoundingClientRect()
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  canvas.style.width = `${rect.width}px`
  canvas.style.height = `${rect.height}px`
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  render()
}

function render() {
  const canvas = canvasRef.value
  if (!canvas || !ctx) return
  const rect = canvas.getBoundingClientRect()
  ctx.clearRect(0, 0, rect.width, rect.height)

  ctx.save()
  ctx.translate(offsetX.value + dragOffset.value.x, offsetY.value + dragOffset.value.y)
  ctx.scale(scale.value, scale.value)

  drawGrid()
  drawAreaLabel()
  drawPlots()

  ctx.restore()
}

function drawGrid() {
  if (!ctx) return
  const cellSize = 80
  const gridSize = 1600
  ctx.strokeStyle = 'rgba(201, 168, 108, 0.06)'
  ctx.lineWidth = 1 / scale.value

  for (let x = 0; x <= gridSize; x += cellSize) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, gridSize)
    ctx.stroke()
  }
  for (let y = 0; y <= gridSize; y += cellSize) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(gridSize, y)
    ctx.stroke()
  }

  ctx.strokeStyle = 'rgba(201, 168, 108, 0.15)'
  ctx.lineWidth = 2 / scale.value
  for (let x = 0; x <= gridSize; x += cellSize * 5) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, gridSize)
    ctx.stroke()
  }
  for (let y = 0; y <= gridSize; y += cellSize * 5) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(gridSize, y)
    ctx.stroke()
  }
}

function drawAreaLabel() {
  if (!ctx) return
  ctx.save()
  ctx.font = 'bold 28px "PingFang SC", sans-serif'
  ctx.fillStyle = 'rgba(201, 168, 108, 0.08)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const area = areaPlots.value[0]
  if (area) {
    ctx.fillText(area.areaName, 400, 30)
  }
  ctx.restore()
}

function drawPlots() {
  if (!ctx) return
  for (const plot of areaPlots.value) {
    drawPlot(plot)
  }
}

function drawPlot(plot: CemeteryPlot) {
  if (!ctx) return
  const size = plotTypeSize[plot.type] || plotTypeSize.standard
  const colors = statusColors[plot.status] || statusColors.for_sale
  const x = plot.x
  const y = plot.y
  const w = size.w
  const h = size.h

  ctx.save()

  ctx.fillStyle = colors.fill
  ctx.strokeStyle = colors.stroke
  ctx.lineWidth = size.borderWidth / scale.value

  roundRect(ctx, x, y, w, h, 4)
  ctx.fill()
  ctx.stroke()

  if (props.selectedPlotId === plot.id) {
    ctx.strokeStyle = '#C9A86C'
    ctx.lineWidth = 3 / scale.value
    ctx.shadowColor = 'rgba(201, 168, 108, 0.6)'
    ctx.shadowBlur = 15 / scale.value
    roundRect(ctx, x - 3, y - 3, w + 6, h + 6, 6)
    ctx.stroke()
  }

  if (hoverPlot.value?.id === plot.id && props.selectedPlotId !== plot.id) {
    ctx.strokeStyle = '#D4B87C'
    ctx.lineWidth = 2.5 / scale.value
    ctx.shadowColor = 'rgba(212, 184, 124, 0.4)'
    ctx.shadowBlur = 10 / scale.value
    roundRect(ctx, x - 2, y - 2, w + 4, h + 4, 5)
    ctx.stroke()
  }

  ctx.restore()

  if (scale.value > 0.6 && plot.type !== 'ashes_wall') {
    ctx.save()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
    ctx.font = `${Math.max(10, 11 / scale.value)}px "PingFang SC", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(plot.plotNo.slice(-6), x + w / 2, y + h / 2 - 6)

    if (scale.value > 0.9 && plot.remainsName) {
      ctx.fillStyle = 'rgba(201, 168, 108, 0.9)'
      ctx.font = `${Math.max(9, 10 / scale.value)}px "PingFang SC", sans-serif`
      ctx.fillText(plot.remainsName, x + w / 2, y + h / 2 + 10)
    }
    ctx.restore()
  }

  if (plot.type === 'ashes_wall' && scale.value > 1.2) {
    ctx.save()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
    ctx.font = `${8 / scale.value}px "PingFang SC", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(plot.col), x + w / 2, y + h / 2)
    ctx.restore()
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

function screenToWorld(sx: number, sy: number) {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return { x: 0, y: 0 }
  const x = (sx - rect.left - offsetX.value - dragOffset.value.x) / scale.value
  const y = (sy - rect.top - offsetY.value - dragOffset.value.y) / scale.value
  return { x, y }
}

function hitTest(wx: number, wy: number): CemeteryPlot | null {
  for (let i = areaPlots.value.length - 1; i >= 0; i--) {
    const plot = areaPlots.value[i]
    const size = plotTypeSize[plot.type] || plotTypeSize.standard
    if (
      wx >= plot.x &&
      wx <= plot.x + size.w &&
      wy >= plot.y &&
      wy <= plot.y + size.h
    ) {
      return plot
    }
  }
  return null
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return

  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top

  const delta = e.deltaY > 0 ? 0.9 : 1.1
  const newScale = Math.min(maxScale, Math.max(minScale, scale.value * delta))
  const scaleRatio = newScale / scale.value

  offsetX.value = mouseX - (mouseX - offsetX.value) * scaleRatio
  offsetY.value = mouseY - (mouseY - offsetY.value) * scaleRatio
  scale.value = newScale

  render()
}

function onMouseDown(e: MouseEvent) {
  isDragging.value = true
  dragStart.value = { x: e.clientX, y: e.clientY }
  dragOffset.value = { x: 0, y: 0 }
}

function onMouseMove(e: MouseEvent) {
  if (isDragging.value) {
    dragOffset.value = {
      x: e.clientX - dragStart.value.x,
      y: e.clientY - dragStart.value.y
    }
    tooltipVisible.value = false
    render()
    return
  }

  const world = screenToWorld(e.clientX, e.clientY)
  const plot = hitTest(world.x, world.y)

  if (plot) {
    hoverPlot.value = plot
    tooltipPosition.value = { x: e.clientX, y: e.clientY }
    tooltipVisible.value = true
    canvasRef.value!.style.cursor = 'pointer'
    emit('hover-plot', plot)
  } else {
    hoverPlot.value = null
    tooltipVisible.value = false
    canvasRef.value!.style.cursor = 'grab'
    emit('hover-plot', null)
  }
}

function onMouseUp(e: MouseEvent) {
  if (isDragging.value) {
    const moved = Math.abs(e.clientX - dragStart.value.x) + Math.abs(e.clientY - dragStart.value.y)
    if (moved > 5) {
      offsetX.value += dragOffset.value.x
      offsetY.value += dragOffset.value.y
    } else {
      onClick(e)
    }
  }
  isDragging.value = false
  dragOffset.value = { x: 0, y: 0 }
  render()
}

function onMouseLeave() {
  isDragging.value = false
  dragOffset.value = { x: 0, y: 0 }
  hoverPlot.value = null
  tooltipVisible.value = false
  render()
}

function onClick(e: MouseEvent) {
  if (Math.abs(dragOffset.value.x) > 5 || Math.abs(dragOffset.value.y) > 5) return
  const world = screenToWorld(e.clientX, e.clientY)
  const plot = hitTest(world.x, world.y)
  emit('select-plot', plot)
  render()
}

function zoomIn() {
  scale.value = Math.min(maxScale, scale.value * 1.2)
  render()
}

function zoomOut() {
  scale.value = Math.max(minScale, scale.value / 1.2)
  render()
}

function resetView() {
  scale.value = 1
  offsetX.value = 50
  offsetY.value = 50
  dragOffset.value = { x: 0, y: 0 }
  render()
}

watch(() => props.selectedAreaId, () => {
  nextTick(() => {
    resetView()
  })
})

watch(() => props.selectedPlotId, () => {
  render()
})

watch(() => props.plots, () => {
  render()
}, { deep: true })

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return
  ctx = canvas.getContext('2d')
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
})

onUnmounted(() => {
  window.removeEventListener('resize', resizeCanvas)
})
</script>

<style lang="scss" scoped>
.plot-canvas-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 500px;
  background: linear-gradient(135deg, #1A1A1F 0%, #24242B 100%);
  border: 2px solid #3A3A44;
  border-radius: 12px;
  overflow: hidden;
  box-shadow:
    inset 0 0 40px rgba(201, 168, 108, 0.08),
    0 0 0 1px rgba(201, 168, 108, 0.15),
    0 0 30px rgba(201, 168, 108, 0.1);
}

.canvas-controls {
  position: absolute;
  top: 16px;
  left: 16px;
  right: 16px;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  pointer-events: none;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: rgba(30, 30, 38, 0.9);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(201, 168, 108, 0.25);
  border-radius: 10px;
  pointer-events: auto;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.control-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(201, 168, 108, 0.08);
  border: 1px solid rgba(201, 168, 108, 0.2);
  border-radius: 8px;
  color: #C9A86C;
  cursor: pointer;
  transition: all 0.25s ease;

  :deep(.el-icon) {
    width: 18px;
    height: 18px;
  }

  &:hover {
    background: rgba(201, 168, 108, 0.2);
    border-color: #C9A86C;
    box-shadow: 0 0 12px rgba(201, 168, 108, 0.3);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
}

.zoom-level {
  min-width: 50px;
  padding: 0 8px;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: #C9A86C;
  font-family: 'SF Mono', Monaco, monospace;
}

.stats-panel {
  display: flex;
  gap: 16px;
  padding: 10px 16px;
  background: rgba(30, 30, 38, 0.9);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(201, 168, 108, 0.25);
  border-radius: 10px;
  pointer-events: auto;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.stat-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;

  &.for-sale {
    background: #52C41A;
    box-shadow: 0 0 8px rgba(82, 196, 26, 0.5);
  }
  &.sold {
    background: #1890FF;
    box-shadow: 0 0 8px rgba(24, 144, 255, 0.5);
  }
  &.occupied {
    background: #8C8C8C;
    box-shadow: 0 0 8px rgba(140, 140, 140, 0.5);
  }
}

.stat-label {
  font-size: 12px;
  color: #B0B0B8;
}

.stat-value {
  font-size: 14px;
  font-weight: 700;
  color: #FFFFFF;
  font-family: 'SF Mono', Monaco, monospace;

  &.total {
    color: #C9A86C;
  }
}

.plot-canvas {
  width: 100%;
  height: 100%;
  cursor: grab;

  &:active {
    cursor: grabbing;
  }
}

.plot-tooltip {
  position: fixed;
  z-index: 9999;
  min-width: 220px;
  max-width: 280px;
  padding: 14px 16px;
  background: rgba(30, 30, 38, 0.98);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(201, 168, 108, 0.4);
  border-radius: 10px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.5),
    0 0 20px rgba(201, 168, 108, 0.15);
  pointer-events: none;
}

.tooltip-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(201, 168, 108, 0.15);
}

.plot-no {
  font-size: 16px;
  font-weight: 700;
  background: linear-gradient(135deg, #D4B87C 0%, #C9A86C 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.tooltip-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 3px 0;
  font-size: 12px;

  .label {
    color: #6B6B74;
    flex-shrink: 0;
  }

  .value {
    color: #FFFFFF;
    text-align: right;
    font-weight: 500;
    word-break: break-all;
    margin-left: 12px;
  }

  &.price-row .price {
    color: #FA8C16;
    font-weight: 700;
    font-family: 'SF Mono', Monaco, monospace;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
