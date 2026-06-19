export interface Point {
  x: number
  y: number
}

export interface Wall {
  id: string
  type: 'straight' | 'arc'
  start: Point
  end: Point
  thickness: number
  color: string
  arcCenter?: Point
  arcRadius?: number
  startAngle?: number
  endAngle?: number
  hasDoor?: boolean
  doorPosition?: number
  doorWidth?: number
  hasWindow?: boolean
  windowPosition?: number
  windowWidth?: number
}

export interface Room {
  id: string
  name: string
  walls: string[]
  area: number
  color: string
}

export interface Furniture {
  id: string
  type: string
  name: string
  category: string
  position: Point
  rotation: number
  scale: Point
  width: number
  height: number
  color: string
  icon: string
  isColliding?: boolean
}

export interface Dimension {
  id: string
  type: 'wall-length' | 'room-area'
  position: Point
  value: number
  unit: string
  wallId?: string
  roomId?: string
}

export interface Floor {
  id: string
  name: string
  order: number
  visible: boolean
  walls: Wall[]
  rooms: Room[]
  furniture: Furniture[]
  dimensions: Dimension[]
}

export interface ProjectState {
  name: string
  currentFloorId: string
  floors: Floor[]
  gridSize: number
  snapEnabled: boolean
  snapPrecision: number
  showGrid: boolean
  showDimensions: boolean
  zoom: number
  pan: Point
  selectedTool: string
  selectedIds: string[]
  mousePos: Point
  canvasSize: Point
}

export interface HistoryState {
  past: ProjectState[]
  future: ProjectState[]
  maxHistory: number
}

export type ToolType = 'select' | 'wall-straight' | 'wall-arc' | 'door' | 'window' | 'zoom-in' | 'zoom-out' | 'pan'

export interface FurnitureCatalogItem {
  id: string
  name: string
  category: string
  subcategory: string
  width: number
  height: number
  color: string
  icon: string
}
