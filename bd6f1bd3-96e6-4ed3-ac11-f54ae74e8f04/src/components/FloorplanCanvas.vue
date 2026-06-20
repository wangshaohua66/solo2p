<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useProjectStore } from '@/stores/ProjectStore'
import type { Point, Wall, Furniture, Room, Floor } from '@/types'
import { pointNearLine, distance, snapToGrid, findNearestWall, getWallDirection, snapToNearestWall, projectPointToLine } from '@/utils/geometry'
import { isometricIcons } from '@/utils/isometricIcons'

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
let hoveredWall = ref<{ wall: Wall; projection: Point; t: number } | null>(null)

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

const renderFloorReference = (floor: Floor, alpha: number = 0.15) => {
  if (!ctx) return
  
  ctx.save()
  ctx.globalAlpha = alpha
  
  floor.walls.forEach(wall => {
    const start = worldToScreen(wall.start)
    const end = worldToScreen(wall.end)
    const thickness = wall.thickness * store.state.zoom
    
    ctx.strokeStyle = floor.order < (store.currentFloorIndex ?? 0) ? '#2196F3' : '#FF5722'
    ctx.lineWidth = thickness
    ctx.lineCap = 'round'
    ctx.setLineDash([8, 8])
    
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
    ctx.stroke()
    ctx.setLineDash([])
  })
  
  floor.rooms.forEach(room => {
    const walls = room.walls
      .map(id => floor.walls.find(w => w.id === id))
      .filter(Boolean) as Wall[]
    
    if (walls.length < 3) return
    
    ctx.fillStyle = floor.order < (store.currentFloorIndex ?? 0) ? 'rgba(33, 150, 243, 0.1)' : 'rgba(255, 87, 34, 0.1)'
    ctx.beginPath()
    
    const firstPoint = worldToScreen(walls[0].start)
    ctx.moveTo(firstPoint.x, firstPoint.y)
    
    for (let i = 1; i < walls.length; i++) {
      const point = worldToScreen(walls[i].start)
      ctx.lineTo(point.x, point.y)
    }
    
    ctx.closePath()
    ctx.fill()
  })
  
  ctx.restore()
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

const renderWall = (wall: Wall, isSelected: boolean, isHovered: boolean = false) => {
  if (!ctx) return
  
  const start = worldToScreen(wall.start)
  const end = worldToScreen(wall.end)
  const thickness = wall.thickness * store.state.zoom
  
  ctx.strokeStyle = isSelected ? '#4A90D9' : (isHovered ? '#FF9800' : wall.color)
  ctx.lineWidth = thickness + (isHovered ? 4 : 0)
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
  
  if (wall.hasDoor && wall.doorWidth && wall.doorPosition !== undefined) {
    renderDoorOpening(wall)
  }
  
  if (wall.hasWindow && wall.windowWidth && wall.windowPosition !== undefined) {
    renderWindowOpening(wall)
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

const renderDoorOpening = (wall: Wall) => {
  if (!ctx || wall.type !== 'straight') return
  
  const totalLen = distance(wall.start, wall.end)
  const centerDist = totalLen * (wall.doorPosition ?? 0.5)
  const halfWidth = (wall.doorWidth ?? 900) / 2
  const dir = getWallDirection(wall)
  
  const doorStart = {
    x: wall.start.x + dir.dx * (centerDist - halfWidth),
    y: wall.start.y + dir.dy * (centerDist - halfWidth)
  }
  const doorCenter = {
    x: wall.start.x + dir.dx * centerDist,
    y: wall.start.y + dir.dy * centerDist
  }
  
  const sDoorStart = worldToScreen(doorStart)
  const sDoorCenter = worldToScreen(doorCenter)
  
  const thickness = wall.thickness * store.state.zoom * 1.2
  
  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = thickness
  ctx.lineCap = 'butt'
  ctx.beginPath()
  ctx.moveTo(sDoorStart.x, sDoorStart.y)
  const sDoorEnd = worldToScreen({
    x: wall.start.x + dir.dx * (centerDist + halfWidth),
    y: wall.start.y + dir.dy * (centerDist + halfWidth)
  })
  ctx.lineTo(sDoorEnd.x, sDoorEnd.y)
  ctx.stroke()
  
  const normalX = -dir.dy
  const normalY = dir.dx
  const arcEnd = {
    x: doorCenter.x + normalX * (wall.doorWidth ?? 900),
    y: doorCenter.y + normalY * (wall.doorWidth ?? 900)
  }
  const sArcStart = sDoorStart
  const sArcEnd = worldToScreen(arcEnd)
  const radius = (wall.doorWidth ?? 900) * store.state.zoom
  
  ctx.strokeStyle = '#4CAF50'
  ctx.lineWidth = 2
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.arc(sDoorCenter.x, sDoorCenter.y, radius, Math.atan2(-dir.dy, -dir.dx), Math.atan2(normalY, normalX))
  ctx.stroke()
  
  ctx.beginPath()
  ctx.moveTo(sDoorCenter.x, sDoorCenter.y)
  ctx.lineTo(sArcEnd.x, sArcEnd.y)
  ctx.stroke()
}

const renderWindowOpening = (wall: Wall) => {
  if (!ctx || wall.type !== 'straight') return
  
  const totalLen = distance(wall.start, wall.end)
  const centerDist = totalLen * (wall.windowPosition ?? 0.5)
  const halfWidth = (wall.windowWidth ?? 1200) / 2
  const dir = getWallDirection(wall)
  
  const windowStart = {
    x: wall.start.x + dir.dx * (centerDist - halfWidth),
    y: wall.start.y + dir.dy * (centerDist - halfWidth)
  }
  const windowEnd = {
    x: wall.start.x + dir.dx * (centerDist + halfWidth),
    y: wall.start.y + dir.dy * (centerDist + halfWidth)
  }
  
  const sStart = worldToScreen(windowStart)
  const sEnd = worldToScreen(windowEnd)
  
  const thickness = wall.thickness * store.state.zoom * 1.2
  
  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = thickness
  ctx.lineCap = 'butt'
  ctx.beginPath()
  ctx.moveTo(sStart.x, sStart.y)
  ctx.lineTo(sEnd.x, sEnd.y)
  ctx.stroke()
  
  ctx.strokeStyle = '#2196F3'
  ctx.lineWidth = 3
  ctx.setLineDash([8, 4])
  ctx.beginPath()
  ctx.moveTo(sStart.x, sStart.y)
  ctx.lineTo(sEnd.x, sEnd.y)
  ctx.stroke()
  ctx.setLineDash([])
  
  const normalX = -dir.dy
  const normalY = dir.dx
  const offset = wall.thickness * 1.5
  const innerStart = {
    x: windowStart.x + normalX * offset,
    y: windowStart.y + normalY * offset
  }
  const innerEnd = {
    x: windowEnd.x + normalX * offset,
    y: windowEnd.y + normalY * offset
  }
  const outerStart = {
    x: windowStart.x - normalX * offset,
    y: windowStart.y - normalY * offset
  }
  const outerEnd = {
    x: windowEnd.x - normalX * offset,
    y: windowEnd.y - normalY * offset
  }
  
  ctx.strokeStyle = '#2196F3'
  ctx.lineWidth = 1
  const siStart = worldToScreen(innerStart)
  const siEnd = worldToScreen(innerEnd)
  const soStart = worldToScreen(outerStart)
  const soEnd = worldToScreen(outerEnd)
  
  ctx.beginPath()
  ctx.moveTo(siStart.x, siStart.y)
  ctx.lineTo(siEnd.x, siEnd.y)
  ctx.moveTo(soStart.x, soStart.y)
  ctx.lineTo(soEnd.x, soEnd.y)
  ctx.stroke()
}

const renderIsometricIcon = (icon: string, cx: number, cy: number, size: number, color: string) => {
  if (!ctx) return
  
  let paths: string[] = []
  try {
    if (icon.startsWith('[') && icon.endsWith(']')) {
      const parsed = JSON.parse(icon)
      if (Array.isArray(parsed) && parsed.length > 0) {
        paths = parsed
      }
    }
  } catch {}
  
  if (paths.length === 0) {
    const mapped = (isometricIcons as Record<string, string[]>)?.[icon]
    if (mapped && mapped.length > 0) {
      paths = mapped
    }
  }
  
  if (paths.length === 0) {
    ctx.fillStyle = '#666'
    ctx.font = `${size * 0.8}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('■', cx, cy)
    return
  }
  
  ctx.save()
  ctx.translate(cx, cy)
  const scale = size / 100
  ctx.scale(scale, scale)
  
  const colors = shadeColor(color)
  
  paths.forEach((path, index) => {
    if (!path) return
    ctx.fillStyle = colors[index % colors.length]
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    const commands = path.match(/[MLQCZ][^MLQCZ]*/gi) || []
    commands.forEach(cmd => {
      const type = cmd[0].toUpperCase()
      const nums = cmd.slice(1).trim().split(/[\s,]+/).map(Number)
      switch (type) {
        case 'M': ctx.moveTo(nums[0] - 50, nums[1] - 50); break
        case 'L': ctx.lineTo(nums[0] - 50, nums[1] - 50); break
        case 'Q': ctx.quadraticCurveTo(nums[0] - 50, nums[1] - 50, nums[2] - 50, nums[3] - 50); break
        case 'C': ctx.bezierCurveTo(nums[0] - 50, nums[1] - 50, nums[2] - 50, nums[3] - 50, nums[4] - 50, nums[5] - 50); break
        case 'Z': ctx.closePath(); break
      }
    })
    ctx.fill()
    ctx.stroke()
  })
  
  ctx.restore()
}

function shadeColor(hex: string): string[] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  
  const adjust = (c: number, amt: number) => Math.max(0, Math.min(255, Math.round(c + amt)))
  
  return [
    `rgb(${adjust(r, 20)}, ${adjust(g, 20)}, ${adjust(b, 20)})`,
    `rgb(${r}, ${g}, ${b})`,
    `rgb(${adjust(r, -25)}, ${adjust(g, -25)}, ${adjust(b, -25)})`
  ]
}

const renderFurniture = (furniture: Furniture, isSelected: boolean) => {
  if (!ctx) return
  
  const center = worldToScreen(furniture.position)
  const width = furniture.width * furniture.scale.x * store.state.zoom
  const height = furniture.height * furniture.scale.y * store.state.zoom
  
  ctx.save()
  ctx.translate(center.x, center.y)
  ctx.rotate(furniture.rotation)
  
  ctx.fillStyle = furniture.color + '30'
  ctx.strokeStyle = isSelected ? '#4A90D9' : (furniture.isColliding ? '#E57373' : '#999999')
  ctx.lineWidth = isSelected ? 3 : 1.5
  
  ctx.beginPath()
  ctx.roundRect(-width / 2, -height / 2, width, height, 4 * store.state.zoom)
  ctx.fill()
  ctx.stroke()
  
  if (furniture.isColliding) {
    ctx.strokeStyle = '#E57373'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.strokeRect(-width / 2 - 5, -height / 2 - 5, width + 10, height + 10)
    ctx.setLineDash([])
  }
  
  const iconSize = Math.min(width, height) * 0.75
  renderIsometricIcon(furniture.icon, 0, 0, iconSize, furniture.color)
  
  if (isSelected) {
    ctx.strokeStyle = '#4A90D9'
    ctx.lineWidth = 2
    const handleSize = 10
    const handles = [
      { x: -width / 2, y: -height / 2 },
      { x: width / 2, y: -height / 2 },
      { x: width / 2, y: height / 2 },
      { x: -width / 2, y: height / 2 },
      { x: 0, y: -height / 2 - 30 * store.state.zoom }
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

const renderDoorWindowPreview = () => {
  if (!ctx || !hoveredWall.value) return
  if (store.state.selectedTool !== 'door' && store.state.selectedTool !== 'window') return
  
  const proj = worldToScreen(hoveredWall.value.projection)
  const isDoor = store.state.selectedTool === 'door'
  const width = (isDoor ? 900 : 1200) * store.state.zoom
  
  ctx.strokeStyle = isDoor ? '#4CAF50' : '#2196F3'
  ctx.lineWidth = 2
  ctx.fillStyle = isDoor ? 'rgba(76, 175, 80, 0.2)' : 'rgba(33, 150, 243, 0.2)'
  
  ctx.beginPath()
  ctx.arc(proj.x, proj.y, width / 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  
  ctx.fillStyle = isDoor ? '#4CAF50' : '#2196F3'
  ctx.font = 'bold 12px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(isDoor ? '🚪 门' : '🪟 窗', proj.x, proj.y - width / 2 - 15)
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
    
    ctx.strokeStyle = dim.type === 'room-area' ? 'rgba(156, 39, 176, 0.3)' : 'rgba(76, 175, 80, 0.3)'
    ctx.lineWidth = 1
    ctx.strokeRect(pos.x - textWidth / 2, pos.y - textHeight / 2, textWidth, textHeight)
    
    ctx.fillStyle = dim.type === 'room-area' ? '#9C27B0' : '#4CAF50'
    ctx.fillText(text, pos.x, pos.y)
  })
}

const render = (timestamp: number) => {
  if (!ctx || !canvasRef.value) return
  
  frameCount++
  if (timestamp - lastFrameTime >= 1000) {
    frameCount = 0
    lastFrameTime = timestamp
  }
  
  ctx.clearRect(0, 0, store.state.canvasSize.x, store.state.canvasSize.y)
  
  ctx.fillStyle = '#FAFAFA'
  ctx.fillRect(0, 0, store.state.canvasSize.x, store.state.canvasSize.y)
  
  renderGrid()
  
  store.adjacentFloors.forEach(floor => {
    if (floor.visible) renderFloorReference(floor, 0.2)
  })
  
  store.allRooms.forEach(room => renderRoom(room))
  
  store.allWalls.forEach(wall => {
    const isSelected = store.state.selectedIds.includes(wall.id)
    const isHovered = hoveredWall.value?.wall.id === wall.id
    renderWall(wall, isSelected, isHovered)
  })
  
  renderTempWall()
  renderDoorWindowPreview()
  
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
  
  if (store.state.selectedTool === 'door' || store.state.selectedTool === 'window') {
    store.placeDoorOrWindow(worldPos, store.state.selectedTool)
    hoveredWall.value = null
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
  
  if (store.state.selectedTool === 'door' || store.state.selectedTool === 'window') {
    const threshold = 50 / store.state.zoom
    hoveredWall.value = findNearestWall(worldPos, store.allWalls, threshold)
    if (canvasRef.value) {
      canvasRef.value.style.cursor = hoveredWall.value ? 'crosshair' : 'not-allowed'
    }
  } else if (hoveredWall.value) {
    hoveredWall.value = null
  }
  
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
    const newPos = {
      x: worldPos.x - dragStartPos.value.x,
      y: worldPos.y - dragStartPos.value.y
    }
    
    store.updateFurnitureWithWallSnap(draggedFurnitureId.value, newPos)
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
    hoveredWall.value = null
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
