import type { Point, Wall, Furniture } from '@/types'

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
}

export function distance(p1: Point, p2: Point): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
}

export function snapToGrid(point: Point, gridSize: number): Point {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize
  }
}

export function lineLength(wall: Wall): number {
  if (wall.type === 'arc' && wall.arcRadius && wall.startAngle !== undefined && wall.endAngle !== undefined) {
    const angleDiff = Math.abs(wall.endAngle - wall.startAngle)
    return wall.arcRadius * angleDiff
  }
  return distance(wall.start, wall.end)
}

export function midpoint(p1: Point, p2: Point): Point {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2
  }
}

export function calculatePolygonArea(points: Point[]): number {
  let area = 0
  const n = points.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += points[i].x * points[j].y
    area -= points[j].x * points[i].y
  }
  return Math.abs(area) / 2
}

export function rotatePoint(point: Point, center: Point, angle: number): Point {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const dx = point.x - center.x
  const dy = point.y - center.y
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos
  }
}

export function getFurnitureBounds(furniture: Furniture): { minX: number; maxX: number; minY: number; maxY: number } {
  const halfW = (furniture.width * furniture.scale.x) / 2
  const halfH = (furniture.height * furniture.scale.y) / 2
  
  const corners: Point[] = [
    { x: -halfW, y: -halfH },
    { x: halfW, y: -halfH },
    { x: halfW, y: halfH },
    { x: -halfW, y: halfH }
  ]
  
  const rotatedCorners = corners.map(c => 
    rotatePoint(
      { x: c.x + furniture.position.x, y: c.y + furniture.position.y },
      furniture.position,
      furniture.rotation
    )
  )
  
  const xs = rotatedCorners.map(c => c.x)
  const ys = rotatedCorners.map(c => c.y)
  
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys)
  }
}

export function checkCollision(f1: Furniture, f2: Furniture): boolean {
  if (f1.id === f2.id) return false
  
  const b1 = getFurnitureBounds(f1)
  const b2 = getFurnitureBounds(f2)
  
  return !(
    b1.maxX < b2.minX ||
    b1.minX > b2.maxX ||
    b1.maxY < b2.minY ||
    b1.minY > b2.maxY
  )
}

export function pointInRect(point: Point, rect: { x: number; y: number; width: number; height: number }): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width &&
         point.y >= rect.y && point.y <= rect.y + rect.height
}

export function pointNearLine(point: Point, lineStart: Point, lineEnd: Point, threshold: number): boolean {
  const lineLen = distance(lineStart, lineEnd)
  if (lineLen === 0) return distance(point, lineStart) < threshold
  
  const t = Math.max(0, Math.min(1, 
    ((point.x - lineStart.x) * (lineEnd.x - lineStart.x) + 
     (point.y - lineStart.y) * (lineEnd.y - lineStart.y)) / (lineLen * lineLen)
  ))
  
  const projection = {
    x: lineStart.x + t * (lineEnd.x - lineStart.x),
    y: lineStart.y + t * (lineEnd.y - lineStart.y)
  }
  
  return distance(point, projection) < threshold
}

export function projectPointToLine(point: Point, lineStart: Point, lineEnd: Point): { projection: Point; t: number; dist: number } {
  const lineLen = distance(lineStart, lineEnd)
  if (lineLen === 0) return { projection: { ...lineStart }, t: 0, dist: distance(point, lineStart) }
  
  const t = Math.max(0, Math.min(1, 
    ((point.x - lineStart.x) * (lineEnd.x - lineStart.x) + 
     (point.y - lineStart.y) * (lineEnd.y - lineStart.y)) / (lineLen * lineLen)
  ))
  
  const projection = {
    x: lineStart.x + t * (lineEnd.x - lineStart.x),
    y: lineStart.y + t * (lineEnd.y - lineStart.y)
  }
  
  return {
    projection,
    t,
    dist: distance(point, projection)
  }
}

export function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= 2 * Math.PI
  while (angle < -Math.PI) angle += 2 * Math.PI
  return angle
}

export function getWallDirection(wall: Wall): { dx: number; dy: number; normal: { x: number; y: number } } {
  const dx = wall.end.x - wall.start.x
  const dy = wall.end.y - wall.start.y
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  return {
    dx: dx / len,
    dy: dy / len,
    normal: { x: -dy / len, y: dx / len }
  }
}

export interface WallSnapResult {
  position: Point;
  wallId: string;
  distance: number;
  offset: number;
  snappedToWall: boolean;
}

export function snapToNearestWall(
  furniture: Furniture,
  walls: Wall[],
  snapDistance: number = 150
): WallSnapResult | null {
  let bestResult: WallSnapResult | null = null
  const bounds = getFurnitureBounds(furniture)
  
  const testPoints: Point[] = [
    { x: bounds.minX, y: (bounds.minY + bounds.maxY) / 2 },
    { x: bounds.maxX, y: (bounds.minY + bounds.maxY) / 2 },
    { x: (bounds.minX + bounds.maxX) / 2, y: bounds.minY },
    { x: (bounds.minX + bounds.maxX) / 2, y: bounds.maxY },
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.minX, y: bounds.maxY },
    { x: bounds.maxX, y: bounds.maxY }
  ]
  
  for (const wall of walls) {
    if (wall.type === 'arc') continue
    
    for (const testPoint of testPoints) {
      const { projection, t, dist } = projectPointToLine(testPoint, wall.start, wall.end)
      
      if (dist < snapDistance && (bestResult === null || dist < bestResult.distance)) {
        const direction = getWallDirection(wall)
        
        const offsetX = testPoint.x - furniture.position.x
        const offsetY = testPoint.y - furniture.position.y
        
        const newPos = {
          x: projection.x - offsetX,
          y: projection.y - offsetY
        }
        
        bestResult = {
          position: newPos,
          wallId: wall.id,
          distance: dist,
          offset: t,
          snappedToWall: true
        }
      }
    }
  }
  
  return bestResult
}

export function findNearestWall(point: Point, walls: Wall[], threshold: number = 30): { wall: Wall; projection: Point; t: number; dist: number } | null {
  let best: { wall: Wall; projection: Point; t: number; dist: number } | null = null
  
  for (const wall of walls) {
    if (wall.type === 'arc') continue
    const { projection, t, dist } = projectPointToLine(point, wall.start, wall.end)
    if (dist < threshold && (best === null || dist < best.dist)) {
      best = { wall, projection, t, dist }
    }
  }
  
  return best
}

export function splitWallAtPoint(wall: Wall, t: number, holeWidth: number): Wall[] {
  const totalLen = lineLength(wall)
  const centerDist = totalLen * t
  const halfHole = holeWidth / 2
  
  if (centerDist - halfHole < 0 || centerDist + halfHole > totalLen) {
    return [wall]
  }
  
  const dir = getWallDirection(wall)
  const holeStartT = (centerDist - halfHole) / totalLen
  const holeEndT = (centerDist + halfHole) / totalLen
  
  const holeStartPoint = {
    x: wall.start.x + dir.dx * (centerDist - halfHole),
    y: wall.start.y + dir.dy * (centerDist - halfHole)
  }
  
  const holeEndPoint = {
    x: wall.start.x + dir.dx * (centerDist + halfHole),
    y: wall.start.y + dir.dy * (centerDist + halfHole)
  }
  
  const wall1: Wall = {
    ...wall,
    id: generateId(),
    start: { ...wall.start },
    end: holeStartPoint
  }
  
  const wall2: Wall = {
    ...wall,
    id: generateId(),
    start: holeEndPoint,
    end: { ...wall.end }
  }
  
  return [wall1, wall2]
}
