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

export function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= 2 * Math.PI
  while (angle < -Math.PI) angle += 2 * Math.PI
  return angle
}
