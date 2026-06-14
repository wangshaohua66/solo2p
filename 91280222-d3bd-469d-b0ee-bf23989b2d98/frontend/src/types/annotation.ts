export enum AnnotationStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  REJECTED = 'rejected'
}

export enum AnnotationSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum AnnotationType {
  RECTANGLE = 'rectangle',
  CIRCLE = 'circle',
  ARROW = 'arrow',
  FREEFORM = 'freeform'
}

export interface AnnotationPoint {
  x: number
  y: number
}

export interface AnnotationGeometry {
  type: AnnotationType
  points: AnnotationPoint[]
  width?: number
  height?: number
  radius?: number
  color: string
  strokeWidth: number
}

export interface AnnotationReply {
  id: string
  content: string
  authorId: string
  authorName: string
  authorAvatar?: string
  mentions: string[]
  createdAt: string
}

export interface Annotation {
  id: string
  documentId: string
  versionId: string
  pageNumber: number
  geometry: AnnotationGeometry
  content: string
  status: AnnotationStatus
  severity: AnnotationSeverity
  authorId: string
  authorName: string
  authorAvatar?: string
  assigneeId?: string
  assigneeName?: string
  replies: AnnotationReply[]
  mentions: string[]
  createdAt: string
  updatedAt: string
  migratedFrom?: string
  isMigrated?: boolean
}

export interface AnnotationConflict {
  annotationId: string
  conflictingAnnotation: Annotation
  overlapArea: number
  user: {
    id: string
    name: string
  }
  timestamp: string
}
