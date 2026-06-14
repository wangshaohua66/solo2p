export interface DocumentPage {
  pageNumber: number
  width: number
  height: number
  thumbnailUrl?: string
  imageUrl: string
}

export interface DocumentVersion {
  id: string
  version: string
  major: number
  minor: number
  uploaderId: string
  uploaderName: string
  description?: string
  fileUrl: string
  pages: DocumentPage[]
  pageCount: number
  createdAt: string
  previousVersionId?: string
  diffSummary?: VersionDiffSummary
}

export interface VersionDiffRegion {
  pageNumber: number
  type: 'added' | 'removed' | 'modified'
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  confidence: number
}

export interface VersionDiffSummary {
  totalChanges: number
  addedRegions: number
  removedRegions: number
  modifiedRegions: number
  regions: VersionDiffRegion[]
}

export enum DocumentStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  NEEDS_REVISION = 'needs_revision',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export interface PermissionMatrix {
  canView: boolean
  canAnnotate: boolean
  canDownload: boolean
  canDelete: boolean
  canManageVersions: boolean
}

export interface Document {
  id: string
  projectId: string
  name: string
  category?: string
  discipline?: string
  status: DocumentStatus
  currentVersionId: string
  versions: DocumentVersion[]
  permissions: PermissionMatrix
  createdAt: string
  updatedAt: string
  createdBy: string
}
