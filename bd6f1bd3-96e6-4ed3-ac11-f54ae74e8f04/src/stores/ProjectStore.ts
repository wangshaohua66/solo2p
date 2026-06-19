import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ProjectState, Floor, Wall, Furniture, Dimension, Room, Point } from '@/types'
import { generateId, snapToGrid, lineLength, calculatePolygonArea, checkCollision } from '@/utils/geometry'

const MAX_HISTORY = 50

function createInitialState(): ProjectState {
  const firstFloorId = generateId()
  return {
    name: '未命名项目',
    currentFloorId: firstFloorId,
    floors: [
      {
        id: firstFloorId,
        name: '第一层',
        order: 0,
        visible: true,
        walls: [],
        rooms: [],
        furniture: [],
        dimensions: []
      }
    ],
    gridSize: 100,
    snapEnabled: true,
    snapPrecision: 10,
    showGrid: true,
    showDimensions: true,
    zoom: 1,
    pan: { x: 0, y: 0 },
    selectedTool: 'select',
    selectedIds: [],
    mousePos: { x: 0, y: 0 },
    canvasSize: { x: 1200, y: 800 }
  }
}

export const useProjectStore = defineStore('project', () => {
  const state = ref<ProjectState>(createInitialState())
  const past = ref<ProjectState[]>([])
  const future = ref<ProjectState[]>([])
  const isDrawing = ref(false)
  const tempWall = ref<Wall | null>(null)
  const wallStartPoint = ref<Point | null>(null)

  const currentFloor = computed((): Floor | undefined => {
    return state.value.floors.find(f => f.id === state.value.currentFloorId)
  })

  const allFurniture = computed((): Furniture[] => {
    return currentFloor.value?.furniture || []
  })

  const allWalls = computed((): Wall[] => {
    return currentFloor.value?.walls || []
  })

  const allRooms = computed((): Room[] => {
    return currentFloor.value?.rooms || []
  })

  const allDimensions = computed((): Dimension[] => {
    return currentFloor.value?.dimensions || []
  })

  const selectedElements = computed(() => {
    if (!currentFloor.value) return { walls: [], furniture: [] }
    return {
      walls: currentFloor.value.walls.filter(w => state.value.selectedIds.includes(w.id)),
      furniture: currentFloor.value.furniture.filter(f => state.value.selectedIds.includes(f.id))
    }
  })

  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)

  function saveHistory() {
    const snapshot = JSON.parse(JSON.stringify(state.value))
    past.value.push(snapshot)
    if (past.value.length > MAX_HISTORY) {
      past.value.shift()
    }
    future.value = []
  }

  function undo() {
    if (past.value.length === 0) return
    const current = JSON.parse(JSON.stringify(state.value))
    future.value.unshift(current)
    const previous = past.value.pop()!
    state.value = previous
  }

  function redo() {
    if (future.value.length === 0) return
    const current = JSON.parse(JSON.stringify(state.value))
    past.value.push(current)
    const next = future.value.shift()!
    state.value = next
  }

  function setTool(tool: string) {
    state.value.selectedTool = tool
    state.value.selectedIds = []
    isDrawing.value = false
    tempWall.value = null
    wallStartPoint.value = null
  }

  function setZoom(zoom: number) {
    state.value.zoom = Math.max(0.1, Math.min(5, zoom))
  }

  function zoomIn() {
    setZoom(state.value.zoom * 1.2)
  }

  function zoomOut() {
    setZoom(state.value.zoom / 1.2)
  }

  function setPan(pan: Point) {
    state.value.pan = pan
  }

  function setMousePos(pos: Point) {
    state.value.mousePos = pos
  }

  function setCanvasSize(size: Point) {
    state.value.canvasSize = size
  }

  function toggleGrid() {
    state.value.showGrid = !state.value.showGrid
  }

  function toggleSnap() {
    state.value.snapEnabled = !state.value.snapEnabled
  }

  function toggleDimensions() {
    state.value.showDimensions = !state.value.showDimensions
  }

  function setGridSize(size: number) {
    state.value.gridSize = Math.max(10, Math.min(500, size))
  }

  function selectElement(id: string, multi = false) {
    if (multi) {
      if (state.value.selectedIds.includes(id)) {
        state.value.selectedIds = state.value.selectedIds.filter(i => i !== id)
      } else {
        state.value.selectedIds.push(id)
      }
    } else {
      state.value.selectedIds = [id]
    }
  }

  function clearSelection() {
    state.value.selectedIds = []
  }

  function startWallDrawing(point: Point) {
    const snapped = state.value.snapEnabled 
      ? snapToGrid(point, state.value.snapPrecision) 
      : point
    
    wallStartPoint.value = snapped
    isDrawing.value = true
    
    tempWall.value = {
      id: 'temp',
      type: state.value.selectedTool === 'wall-arc' ? 'arc' : 'straight',
      start: snapped,
      end: snapped,
      thickness: 20,
      color: '#888888'
    }
  }

  function updateWallDrawing(point: Point) {
    if (!tempWall.value || !wallStartPoint.value) return
    
    const snapped = state.value.snapEnabled 
      ? snapToGrid(point, state.value.snapPrecision) 
      : point
    
    tempWall.value.end = snapped
    
    if (tempWall.value.type === 'arc') {
      const mid = {
        x: (wallStartPoint.value.x + snapped.x) / 2,
        y: (wallStartPoint.value.y + snapped.y) / 2
      }
      const dx = snapped.x - wallStartPoint.value.x
      const dy = snapped.y - wallStartPoint.value.y
      tempWall.value.arcCenter = mid
      tempWall.value.arcRadius = Math.sqrt(dx * dx + dy * dy) / 2
      tempWall.value.startAngle = Math.atan2(-dy, -dx)
      tempWall.value.endAngle = Math.atan2(dy, dx)
    }
  }

  function finishWallDrawing(point: Point): Wall | null {
    if (!tempWall.value || !wallStartPoint.value) {
      isDrawing.value = false
      return null
    }
    
    const snapped = state.value.snapEnabled 
      ? snapToGrid(point, state.value.snapPrecision) 
      : point
    
    const len = lineLength({ ...tempWall.value, end: snapped })
    if (len < 20) {
      cancelWallDrawing()
      return null
    }
    
    saveHistory()
    
    const newWall: Wall = {
      id: generateId(),
      type: tempWall.value.type,
      start: { ...wallStartPoint.value },
      end: { ...snapped },
      thickness: 20,
      color: '#888888',
      arcCenter: tempWall.value.arcCenter,
      arcRadius: tempWall.value.arcRadius,
      startAngle: tempWall.value.startAngle,
      endAngle: tempWall.value.endAngle
    }
    
    currentFloor.value?.walls.push(newWall)
    updateDimensions()
    detectRooms()
    
    cancelWallDrawing()
    return newWall
  }

  function cancelWallDrawing() {
    isDrawing.value = false
    tempWall.value = null
    wallStartPoint.value = null
  }

  function addFurniture(catalogItem: any, position: Point) {
    saveHistory()
    
    const snapped = state.value.snapEnabled 
      ? snapToGrid(position, state.value.snapPrecision) 
      : position
    
    const furniture: Furniture = {
      id: generateId(),
      type: catalogItem.id,
      name: catalogItem.name,
      category: catalogItem.category,
      position: snapped,
      rotation: 0,
      scale: { x: 1, y: 1 },
      width: catalogItem.width,
      height: catalogItem.height,
      color: catalogItem.color,
      icon: catalogItem.icon
    }
    
    currentFloor.value?.furniture.push(furniture)
    detectCollisions()
    return furniture
  }

  function updateFurniture(id: string, updates: Partial<Furniture>) {
    const furniture = currentFloor.value?.furniture.find(f => f.id === id)
    if (furniture) {
      Object.assign(furniture, updates)
      detectCollisions()
    }
  }

  function deleteSelected() {
    if (state.value.selectedIds.length === 0) return
    saveHistory()
    
    if (currentFloor.value) {
      currentFloor.value.walls = currentFloor.value.walls.filter(
        w => !state.value.selectedIds.includes(w.id)
      )
      currentFloor.value.furniture = currentFloor.value.furniture.filter(
        f => !state.value.selectedIds.includes(f.id)
      )
    }
    
    state.value.selectedIds = []
    updateDimensions()
    detectRooms()
    detectCollisions()
  }

  function duplicateSelected() {
    if (state.value.selectedIds.length === 0) return
    saveHistory()
    
    const newIds: string[] = []
    
    state.value.selectedIds.forEach(id => {
      const furniture = currentFloor.value?.furniture.find(f => f.id === id)
      if (furniture) {
        const newFurniture: Furniture = {
          ...JSON.parse(JSON.stringify(furniture)),
          id: generateId(),
          position: {
            x: furniture.position.x + 50,
            y: furniture.position.y + 50
          }
        }
        currentFloor.value?.furniture.push(newFurniture)
        newIds.push(newFurniture.id)
      }
    })
    
    state.value.selectedIds = newIds
    detectCollisions()
  }

  function updateDimensions() {
    if (!currentFloor.value) return
    
    const dimensions: Dimension[] = []
    
    currentFloor.value.walls.forEach(wall => {
      const mid = {
        x: (wall.start.x + wall.end.x) / 2,
        y: (wall.start.y + wall.end.y) / 2
      }
      const len = lineLength(wall)
      dimensions.push({
        id: generateId(),
        type: 'wall-length',
        position: mid,
        value: Math.round(len),
        unit: 'mm',
        wallId: wall.id
      })
    })
    
    currentFloor.value.rooms.forEach(room => {
      const roomWalls = room.walls
        .map(wId => currentFloor.value?.walls.find(w => w.id === wId))
        .filter(Boolean) as Wall[]
      
      if (roomWalls.length >= 3) {
        const points = roomWalls.map(w => w.start)
        const area = calculatePolygonArea(points)
        room.area = Math.round(area / 1000000 * 100) / 100
        
        const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length
        const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length
        
        dimensions.push({
          id: generateId(),
          type: 'room-area',
          position: { x: centerX, y: centerY },
          value: room.area,
          unit: '㎡',
          roomId: room.id
        })
      }
    })
    
    currentFloor.value.dimensions = dimensions
  }

  function detectRooms() {
    if (!currentFloor.value || currentFloor.value.walls.length < 3) {
      if (currentFloor.value) currentFloor.value.rooms = []
      return
    }
    
    const rooms: Room[] = []
    const visitedWalls = new Set<string>()
    
    function findCycle(startWall: Wall): string[] | null {
      const cycle: string[] = [startWall.id]
      let current = startWall
      let prevPoint = startWall.start
      
      while (cycle.length < currentFloor.value!.walls.length) {
        const nextPoint = current.start === prevPoint ? current.end : current.start
        const nextWall = currentFloor.value!.walls.find(w => 
          w.id !== current.id && 
          !cycle.includes(w.id) &&
          (Math.abs(w.start.x - nextPoint.x) < 5 && Math.abs(w.start.y - nextPoint.y) < 5 ||
           Math.abs(w.end.x - nextPoint.x) < 5 && Math.abs(w.end.y - nextPoint.y) < 5)
        )
        
        if (!nextWall) break
        
        cycle.push(nextWall.id)
        prevPoint = nextPoint
        current = nextWall
        
        const currentStart = current.start === prevPoint ? current.end : current.start
        if (Math.abs(currentStart.x - startWall.start.x) < 5 && 
            Math.abs(currentStart.y - startWall.start.y) < 5) {
          return cycle
        }
      }
      
      return null
    }
    
    currentFloor.value.walls.forEach(wall => {
      if (visitedWalls.has(wall.id)) return
      
      const cycle = findCycle(wall)
      if (cycle && cycle.length >= 3) {
        cycle.forEach(id => visitedWalls.add(id))
        const points = cycle
          .map(id => currentFloor.value!.walls.find(w => w.id === id)!)
          .map(w => w.start)
        
        const area = calculatePolygonArea(points)
        rooms.push({
          id: generateId(),
          name: `房间${rooms.length + 1}`,
          walls: cycle,
          area: Math.round(area / 1000000 * 100) / 100,
          color: `hsl(${(rooms.length * 60) % 360}, 30%, 90%)`
        })
      }
    })
    
    currentFloor.value.rooms = rooms
  }

  function detectCollisions() {
    if (!currentFloor.value) return
    
    currentFloor.value.furniture.forEach(f => {
      f.isColliding = false
    })
    
    for (let i = 0; i < currentFloor.value.furniture.length; i++) {
      for (let j = i + 1; j < currentFloor.value.furniture.length; j++) {
        if (checkCollision(currentFloor.value.furniture[i], currentFloor.value.furniture[j])) {
          currentFloor.value.furniture[i].isColliding = true
          currentFloor.value.furniture[j].isColliding = true
        }
      }
    }
  }

  function addFloor() {
    saveHistory()
    const newFloor: Floor = {
      id: generateId(),
      name: `第${state.value.floors.length + 1}层`,
      order: state.value.floors.length,
      visible: true,
      walls: [],
      rooms: [],
      furniture: [],
      dimensions: []
    }
    state.value.floors.push(newFloor)
    state.value.currentFloorId = newFloor.id
  }

  function duplicateFloor(floorId: string) {
    saveHistory()
    const floor = state.value.floors.find(f => f.id === floorId)
    if (!floor) return
    
    const newFloor: Floor = JSON.parse(JSON.stringify(floor))
    newFloor.id = generateId()
    newFloor.name = floor.name + ' 副本'
    newFloor.order = state.value.floors.length
    
    state.value.floors.push(newFloor)
    state.value.currentFloorId = newFloor.id
  }

  function deleteFloor(floorId: string) {
    if (state.value.floors.length <= 1) return
    saveHistory()
    
    const index = state.value.floors.findIndex(f => f.id === floorId)
    state.value.floors.splice(index, 1)
    
    if (state.value.currentFloorId === floorId) {
      state.value.currentFloorId = state.value.floors[Math.min(index, state.value.floors.length - 1)].id
    }
  }

  function setCurrentFloor(floorId: string) {
    state.value.currentFloorId = floorId
  }

  function toggleFloorVisibility(floorId: string) {
    const floor = state.value.floors.find(f => f.id === floorId)
    if (floor) {
      floor.visible = !floor.visible
    }
  }

  function exportJSON(): string {
    return JSON.stringify(state.value, null, 2)
  }

  function importJSON(jsonStr: string) {
    try {
      const data = JSON.parse(jsonStr)
      saveHistory()
      state.value = data
    } catch (e) {
      console.error('导入失败:', e)
      throw e
    }
  }

  function resetProject() {
    saveHistory()
    state.value = createInitialState()
  }

  return {
    state,
    past,
    future,
    isDrawing,
    tempWall,
    wallStartPoint,
    currentFloor,
    allFurniture,
    allWalls,
    allRooms,
    allDimensions,
    selectedElements,
    canUndo,
    canRedo,
    setTool,
    setZoom,
    zoomIn,
    zoomOut,
    setPan,
    setMousePos,
    setCanvasSize,
    toggleGrid,
    toggleSnap,
    toggleDimensions,
    setGridSize,
    selectElement,
    clearSelection,
    startWallDrawing,
    updateWallDrawing,
    finishWallDrawing,
    cancelWallDrawing,
    addFurniture,
    updateFurniture,
    deleteSelected,
    duplicateSelected,
    updateDimensions,
    detectRooms,
    detectCollisions,
    addFloor,
    duplicateFloor,
    deleteFloor,
    setCurrentFloor,
    toggleFloorVisibility,
    undo,
    redo,
    exportJSON,
    importJSON,
    resetProject
  }
})
