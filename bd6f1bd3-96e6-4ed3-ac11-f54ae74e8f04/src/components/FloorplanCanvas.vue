<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useProjectStore } from '@/stores/ProjectStore'
import type { Point, Wall, Furniture, Room } from '@/types'
import { pointNearLine, distance, snapToGrid } from '@/utils/geometry'

const store = useProjectStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let animationId: number = 0
let isDraggingFurniture = ref(false)
let draggedFurnitureId = ref<string | null>(null)
let dragStartPos = ref<Point | null>(null)
let isPanning = ref(false)
let panStartPos = ref<Point | null>(null)
let spacePressed = ref(false)
let lastFrameTime = 0
let frameCount = 0
let fps = 0

const worldToScreen = (point: Point): Point => {
  return {
    x: (point.x + store.state.pan.x) * store.state.zoom + store.state.canvasSize.x / 2,
    y: (point.y + store.state.pan.y) * store.state.zoom + store.state.canvasSize.y / 2
  }
}

const screenToWorld = (point: Point): Point => {
  return {
    x: (point.x - store.state.canvasSize.x / 2) / store.state.zoom - store.state.pan.x,
    y: (point.y - store.state.canvasSize.y / 2) / store.state.zoom - store.state.pan.y
  }
}

const renderGrid = () => {
  if (!ctx || !store.state.showGrid) return
  
  const { canvasSize, gridSize, zoom, pan } = store.state
  const screenGridSize = gridSize * zoom
  
  ctx.strokeStyle = '#E0E0E0'
  ctx.lineWidth = 0.5
  
  const startX = Math.floor((-pan.x * zoom - canvasSize.x / 2) / screenGridSize) * screenGridSize
  const startY = Math.floor((-pan.y * zoom - canvasSize.y / 2) / screenGridSize) * screenGridSize
  
  for (let x = startX; x < canvasSize.x + screenGridSize; x += screenGridSize) {
    const screenX = x + canvasSize.x / 2 + pan.x * zoom
    ctx.beginPath()
    ctx.moveTo(screenX, 0)
    ctx.lineTo(screenX, canvasSize.y)
    ctx.stroke()
  }
  
  for (let y = startY; y < canvasSize.y + screenGridSize; y += screenGridSize) {
    const screenY = y + canvasSize.y / 2 + pan.y * zoom
    ctx.beginPath()
    ctx.moveTo(0, screenY)
    ctx.lineTo(canvasSize.x, screenY)
    ctx.stroke()
  }
  
  ctx.strokeStyle = '#BDBDBD'
  ctx.lineWidth = 1
  const origin = worldToScreen({ x: 0, y: 0 })
  ctx.beginPath()
  ctx.moveTo(0, origin.y)
  ctx.lineTo(canvasSize.x, origin.y)
  ctx.moveTo(origin.x, 0)
  ctx.lineTo(origin.x, canvasSize.y)
  ctx.stroke()
}

const renderRoom = (room: Room) => {
  if (!ctx) return
  
  const walls = room.walls
    .map(id => store.currentFloor?.walls.find(w => w.id === id))
    .filter(Boolean) as Wall[]
  
  if (walls.length < 3) return
  
  ctx.fillStyle = room.color
  ctx.beginPath()
  
  const firstPoint = worldToScreen(walls[0].start)
  ctx.moveTo(firstPoint.x, firstPoint.y)
  
  for (let i = 1; i < walls.length; i++) {
    const point = worldToScreen(walls[i].start)
    ctx.lineTo(point.x, point.y)
  }
  
  ctx.closePath()
  ctx.fill()
}

const renderWall = (wall: Wall, isSelected: boolean) => {
  if (!ctx) return
  
  const start = worldToScreen(wall.start)
  const end = worldToScreen(wall.end)
  const thickness = wall.thickness * store.state.zoom
  
  ctx.strokeStyle = isSelected ? '#4A90D9' : wall.color
  ctx.lineWidth = thickness
  ctx.lineCap = 'round'
  
  if (wall.type === 'arc' && wall.arcCenter && wall.arcRadius !== undefined && wall.startAngle !== undefined && wall.endAngle !== undefined) {
    const center = worldToScreen(wall.arcCenter)
    const radius = wall.arcRadius * store.state.zoom
    
    ctx.beginPath()
    ctx.arc(center.x, center.y, radius, wall.startAngle, wall.endAngle)
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
    ctx.stroke()
  }
  
  if (isSelected) {
    ctx.fillStyle = '#4A90D9'
    const handleSize = 8
    ctx.beginPath()
    ctx.arc(start.x, start.y, handleSize, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(end.x, end.y, handleSize, 0, Math.PI * 2)
    ctx.fill()
  }
}

const renderFurniture = (furniture: Furniture, isSelected: boolean) => {
  if (!ctx) return
  
  const center = worldToScreen(furniture.position)
  const width = furniture.width * furniture.scale.x * store.state.zoom
  const height = furniture.height * furniture.scale.y * store.state.zoom
  
  ctx.save()
  ctx.translate(center.x, center.y)
  ctx.rotate(furniture.rotation)
  
  ctx.fillStyle = furniture.color
  ctx.strokeStyle = isSelected ? '#4A90D9' : (furniture.isColliding ? '#E57373' : '#666666')
  ctx.lineWidth = isSelected ? 3 : 1
  
  ctx.beginPath()
  ctx.roundRect(-width / 2, -height / 2, width, height, 4)
  ctx.fill()
  ctx.stroke()
  
  if (furniture.isColliding) {
    ctx.strokeStyle = '#E57373'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.strokeRect(-width / 2 - 5, -height / 2 - 5, width + 10, height + 10)
    ctx.setLineDash([])
  }
  
  ctx.fillStyle = '#333333'
  ctx.font = `${Math.min(width, height) * 0.6}px Arial`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(furniture.icon, 0, 0)
  
  if (isSelected) {
    ctx.strokeStyle = '#4A90D9'
    ctx.lineWidth = 2
    const handleSize = 10
    const handles = [
      { x: -width / 2, y: -height / 2 },
      { x: width / 2, y: -height / 2 },
      { x: width / 2, y: height / 2 },
      { x: -width / 2, y: height / 2 },
      { x: 0, y: -height / 2 - 30 }
    ]
    
    handles.forEach((handle, i) => {
      ctx.fillStyle = i === 4 ? '#FFD54F' : '#FFFFFF'
      ctx.beginPath()
      ctx.arc(handle.x, handle.y, handleSize / 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    })
  }
  
  ctx.restore()
}

const renderTempWall = () => {
  if (!ctx || !store.tempWall) return
  
  const start = worldToScreen(store.tempWall.start)
  const end = worldToScreen(store.tempWall.end)
  const thickness = store.tempWall.thickness * store.state.zoom
  
  ctx.strokeStyle = '#4CAF50'
  ctx.lineWidth = thickness
  ctx.lineCap = 'round'
  ctx.setLineDash([10, 5])
  
  if (store.tempWall.type === 'arc' && store.tempWall.arcCenter && store.tempWall.arcRadius !== undefined && store.tempWall.startAngle !== undefined && store.tempWall.endAngle !== undefined) {
    const center = worldToScreen(store.tempWall.arcCenter)
    const radius = store.tempWall.arcRadius * store.state.zoom
    
    ctx.beginPath()
    ctx.arc(center.x, center.y, radius, store.tempWall.startAngle, store.tempWall.endAngle)
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
    ctx.stroke()
  }
  
  ctx.setLineDash([])
  
  ctx.fillStyle = '#4CAF50'
  const handleSize = 8
  ctx.beginPath()
  ctx.arc(start.x, start.y, handleSize, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(end.x, end.y, handleSize, 0, Math.PI * 2)
  ctx.fill()
  
  const midX = (start.x + end.x) / 2
  const midY = (start.y + end.y) / 2
  const len = Math.round(distance(store.tempWall.start, store.tempWall.end))
  ctx.fillStyle = '#4CAF50'
  ctx.font = '14px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText(`${len} mm`, midX, midY - 10)
}

const renderDimensions = () => {
  if (!ctx || !store.state.showDimensions) return
  
  store.allDimensions.forEach(dim => {
    const pos = worldToScreen(dim.position)
    
    ctx.fillStyle = dim.type === 'room-area' ? '#9C27B0' : '#4CAF50'
    ctx.font = '12px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    
    const text = `${dim.value}${dim.unit}`
    const padding = 4
    const metrics = ctx.measureText(text)
    const textWidth = metrics.width + padding * 2
    const textHeight = 16 + padding * 2
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.fillRect(pos.x - textWidth / 2, pos.y - textHeight / 2, textWidth, textHeight)
    
    ctx.fillStyle = dim.type === 'room-area' ? '#9C27B0' : '#4CAF50'
    ctx.fillText(text, pos.x, pos.y)
  })
}

const render = (timestamp: number) => {
  if (!ctx || !canvasRef.value) return
  
  frameCount++
  if (timestamp - lastFrameTime >= 1000) {
    fps = Math.round(frameCount * 1000 / (timestamp - lastFrameTime))
    frameCount = 0
    lastFrameTime = timestamp
  }
  
  ctx.clearRect(0, 0, store.state.canvasSize.x, store.state.canvasSize.y)
  
  ctx.fillStyle = '#FAFAFA'
  ctx.fillRect(0, 0, store.state.canvasSize.x, store.state.canvasSize.y)
  
  renderGrid()
  
  store.allRooms.forEach(room => renderRoom(room))
  
  store.allWalls.forEach(wall => {
    const isSelected = store.state.selectedIds.includes(wall.id)
    renderWall(wall, isSelected)
  })
  
  renderTempWall()
  
  store.allFurniture.forEach(furniture => {
    const isSelected = store.state.selectedIds.includes(furniture.id)
    renderFurniture(furniture, isSelected)
  })
  
  renderDimensions()
  
  animationId = requestAnimationFrame(render)
}

const getMousePos = (e: MouseEvent): Point => {
  if (!canvasRef.value) return { x: 0, y: 0 }
  const rect = canvasRef.value.getBoundingClientRect()
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  }
}

const hitTestWall = (worldPos: Point): Wall | null => {
  const threshold = 20 / store.state.zoom
  
  for (const wall of store.allWalls) {
    if (wall.type === 'arc' && wall.arcCenter && wall.arcRadius !== undefined) {
      const distToCenter = distance(worldPos, wall.arcCenter)
      if (Math.abs(distToCenter - wall.arcRadius) < threshold) {
        return wall
      }
    } else {
      if (pointNearLine(worldPos, wall.start, wall.end, threshold)) {
        return wall
      }
    }
  }
  return null
}

const hitTestFurniture = (worldPos: Point): Furniture | null => {
  for (const furniture of store.allFurniture) {
    const dx = worldPos.x - furniture.position.x
    const dy = worldPos.y - furniture.position.y
    const cos = Math.cos(-furniture.rotation)
    const sin = Math.sin(-furniture.rotation)
    const localX = dx * cos - dy * sin
    const localY = dx * sin + dy * cos
    
    const halfW = (furniture.width * furniture.scale.x) / 2
    const halfH = (furniture.height * furniture.scale.y) / 2
    
    if (Math.abs(localX) <= halfW && Math.abs(localY) <= halfH) {
      return furniture
    }
  }
  return null
}

const onMouseDown = (e: MouseEvent) => {
  const screenPos = getMousePos(e)
  const worldPos = screenToWorld(screenPos)
  
  store.setMousePos(worldPos)
  
  if (e.button === 1 || (e.button === 0 && spacePressed.value)) {
    isPanning.value = true
    panStartPos.value = screenPos
    if (canvasRef.value) canvasRef.value.style.cursor = 'grabbing'
    return
  }
  
  if (store.state.selectedTool === 'select') {
    const furniture = hitTestFurniture(worldPos)
    if (furniture) {
      store.selectElement(furniture.id, e.shiftKey)
      isDraggingFurniture.value = true
      draggedFurnitureId.value = furniture.id
      dragStartPos.value = {
        x: worldPos.x - furniture.position.x,
        y: worldPos.y - furniture.position.y
      }
      return
    }
    
    const wall = hitTestWall(worldPos)
    if (wall) {
      store.selectElement(wall.id, e.shiftKey)
      return
    }
    
    store.clearSelection()
    return
  }
  
  if (store.state.selectedTool === 'wall-straight' || store.state.selectedTool === 'wall-arc') {
    if (!store.isDrawing) {
      store.startWallDrawing(worldPos)
    } else {
      store.finishWallDrawing(worldPos)
    }
    return
  }
}

const onMouseMove = (e: MouseEvent) => {
  const screenPos = getMousePos(e)
  const worldPos = screenToWorld(screenPos)
  
  store.setMousePos(worldPos)
  
  if (isPanning.value && panStartPos.value) {
    const dx = (screenPos.x - panStartPos.value.x) / store.state.zoom
    const dy = (screenPos.y - panStartPos.value.y) / store.state.zoom
    store.setPan({
      x: store.state.pan.x + dx,
      y: store.state.pan.y + dy
    })
    panStartPos.value = screenPos
    return
  }
  
  if (isDraggingFurniture.value && draggedFurnitureId.value && dragStartPos.value) {
    let newPos = {
      x: worldPos.x - dragStartPos.value.x,
      y: worldPos.y - dragStartPos.value.y
    }
    
    if (store.state.snapEnabled) {
      newPos = snapToGrid(newPos, store.state.snapPrecision)
    }
    
    store.updateFurniture(draggedFurnitureId.value, { position: newPos })
    return
  }
  
  if (store.isDrawing) {
    store.updateWallDrawing(worldPos)
  }
}

const onMouseUp = () => {
  if (isPanning.value) {
    isPanning.value = false
    panStartPos.value = null
    if (canvasRef.value) canvasRef.value.style.cursor = spacePressed.value ? 'grab' : 'default'
    return
  }
  
  if (isDraggingFurniture.value) {
    isDraggingFurniture.value = false
    draggedFurnitureId.value = null
    dragStartPos.value = null
  }
}

const onWheel = (e: WheelEvent) => {
  e.preventDefault()
  
  const screenPos = getMousePos(e)
  const worldPosBefore = screenToWorld(screenPos)
  
  const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
  const newZoom = Math.max(0.1, Math.min(5, store.state.zoom * zoomFactor))
  store.setZoom(newZoom)
  
  const worldPosAfter = screenToWorld(screenPos)
  store.setPan({
    x: store.state.pan.x + (worldPosAfter.x - worldPosBefore.x),
    y: store.state.pan.y + (worldPosAfter.y - worldPosBefore.y)
  })
}

const onKeyDown = (e: KeyboardEvent) => {
  if (e.code === 'Space') {
    spacePressed.value = true
    if (canvasRef.value && !isPanning.value) {
      canvasRef.value.style.cursor = 'grab'
    }
  }
  
  if (e.code === 'Delete' || e.code === 'Backspace') {
    store.deleteSelected()
  }
  
  if (e.ctrlKey || e.metaKey) {
    if (e.code === 'KeyZ') {
      e.preventDefault()
      if (e.shiftKey) {
        store.redo()
      } else {
        store.undo()
      }
    }
    if (e.code === 'KeyY') {
      e.preventDefault()
      store.redo()
    }
    if (e.code === 'KeyD') {
      e.preventDefault()
      store.duplicateSelected()
    }
  }
  
  if (e.code === 'Escape') {
    store.cancelWallDrawing()
    store.clearSelection()
  }
}

const onKeyUp = (e: KeyboardEvent) => {
  if (e.code === 'Space') {
    spacePressed.value = false
    if (canvasRef.value && !isPanning.value) {
      canvasRef.value.style.cursor = 'default'
    }
  }
}

const handleResize = () => {
  if (!canvasRef.value) return
  
  const container = canvasRef.value.parentElement
  if (!container) return
  
  const width = container.clientWidth
  const height = container.clientHeight
  
  canvasRef.value.width = width
  canvasRef.value.height = height
  store.setCanvasSize({ x: width, y: height })
}

const handleDrop = (e: DragEvent) => {
  e.preventDefault()
  if (!e.dataTransfer) return
  
  const itemData = e.dataTransfer.getData('furniture')
  if (!itemData) return
  
  try {
    const item = JSON.parse(itemData)
    const screenPos = getMousePos(e as any)
    const worldPos = screenToWorld(screenPos)
    store.addFurniture(item, worldPos)
  } catch (err) {
    console.error('Drop error:', err)
  }
}

const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
}

defineExpose({
  getCanvas: () => canvasRef.value,
  exportPNG: (scale: number = 2) => {
    if (!canvasRef.value) return null
    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = Math.min(4096, store.state.canvasSize.x * scale)
    exportCanvas.height = Math.min(4096, store.state.canvasSize.y * scale)
    const exportCtx = exportCanvas.getContext('2d')
    if (!exportCtx) return null
    
    exportCtx.scale(scale, scale)
    exportCtx.fillStyle = '#FFFFFF'
    exportCtx.fillRect(0, 0, store.state.canvasSize.x, store.state.canvasSize.y)
    
    store.allRooms.forEach(room => {
      const walls = room.walls
        .map(id => store.currentFloor?.walls.find(w => w.id === id))
        .filter(Boolean) as Wall[]
      if (walls.length < 3) return
      
      exportCtx.fillStyle = room.color
      exportCtx.beginPath()
      const firstPoint = worldToScreen(walls[0].start)
      exportCtx.moveTo(firstPoint.x, firstPoint.y)
      for (let i = 1; i < walls.length; i++) {
        const point = worldToScreen(walls[i].start)
        exportCtx.lineTo(point.x, point.y)
      }
      exportCtx.closePath()
      exportCtx.fill()
    })
    
    store.allWalls.forEach(wall => {
      const start = worldToScreen(wall.start)
      const end = worldToScreen(wall.end)
      exportCtx.strokeStyle = wall.color
      exportCtx.lineWidth = wall.thickness
      exportCtx.lineCap = 'round'
      exportCtx.beginPath()
      exportCtx.moveTo(start.x, start.y)
      exportCtx.lineTo(end.x, end.y)
      exportCtx.stroke()
    })
    
    store.allFurniture.forEach(furniture => {
      const center = worldToScreen(furniture.position)
      const width = furniture.width * furniture.scale.x
      const height = furniture.height * furniture.scale.y
      exportCtx.save()
      exportCtx.translate(center.x, center.y)
      exportCtx.rotate(furniture.rotation)
      exportCtx.fillStyle = furniture.color
      exportCtx.fillRect(-width / 2, -height / 2, width, height)
      exportCtx.fillStyle = '#333333'
      exportCtx.font = `${Math.min(width, height) * 0.5}px Arial`
      exportCtx.textAlign = 'center'
      exportCtx.textBaseline = 'middle'
      exportCtx.fillText(furniture.icon, 0, 0)
      exportCtx.restore()
    })
    
    return exportCanvas.toDataURL('image/png')
  }
})

onMounted(() => {
  if (!canvasRef.value) return
  
  ctx = canvasRef.value.getContext('2d')
  handleResize()
  
  window.addEventListener('resize', handleResize)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  
  animationId = requestAnimationFrame(render)
})

onUnmounted(() => {
  cancelAnimationFrame(animationId)
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
})
</script>

<template>
  <canvas
    ref="canvasRef"
    class="floorplan-canvas"
    @mousedown="onMouseDown"
    @mousemove="onMouseMove"
    @mouseup="onMouseUp"
    @mouseleave="onMouseUp"
    @wheel="onWheel"
    @drop="handleDrop"
    @dragover="handleDragOver"
  />
</template>

<style scoped>
.floorplan-canvas {
  width: 100%;
  height: 100%;
  display: block;
  cursor: default;
}
</style>
