export type Role = 'judge' | 'clerk' | 'prosecutor' | 'defender'

export interface TranscriptEntry {
  id: string
  timestamp: number
  content: string
  role: Role
  speaker: string
  evidenceIds: string[]
  annotationIds: string[]
  isDeleted: boolean
  createdAt: number
  updatedAt: number
}

export type EvidenceType = 'pdf' | 'image' | 'video' | 'audio' | 'document'

export interface EvidenceItem {
  id: string
  name: string
  type: EvidenceType
  fileSize: number
  mimeType: string
  dataUrl?: string
  blobUrl?: string
  duration?: number
  currentTime?: number
  rotation: number
  scale: number
  annotations: EvidenceAnnotation[]
  createdAt: number
  updatedAt: number
}

export interface EvidenceAnnotation {
  id: string
  type: 'highlight' | 'comment' | 'signature'
  x: number
  y: number
  width: number
  height: number
  content: string
  createdBy: Role
  createdAt: number
}

export interface Annotation {
  id: string
  transcriptId: string
  evidenceId?: string
  type: 'dispute' | 'proof' | 'defense' | 'note'
  content: string
  role: Role
  color: string
  timestamp: number
  createdAt: number
  updatedAt: number
}

export interface TimelineEvent {
  id: string
  timestamp: number
  type: 'transcript' | 'evidence' | 'annotation'
  refId: string
  label: string
  color: string
}

export interface CourtCase {
  id: string
  caseNumber: string
  caseName: string
  createdAt: number
  updatedAt: number
}

export interface SearchResult {
  transcriptId: string
  evidenceId?: string
  annotationId?: string
  content: string
  timestamp: number
  role?: Role
  highlight: [number, number][]
}

export interface QuickPhrase {
  id: string
  content: string
  category: string
  usageCount: number
}

export interface AppSettings {
  theme: 'dark' | 'light'
  projectionMode: boolean
  currentRole: Role
  currentCaseId: string
  autoSaveInterval: number
  fontSize: number
  showLineNumbers: boolean
}
