export interface ProjectMember {
  userId: string
  userName: string
  role: 'project_manager' | 'designer' | 'reviewer'
  joinedAt: string
}

export interface ProjectStats {
  totalDocuments: number
  totalAnnotations: number
  resolvedAnnotations: number
  pendingReviews: number
  completedReviews: number
}

export interface Project {
  id: string
  name: string
  description?: string
  buildingType?: string
  floorCount?: number
  area?: number
  status: 'planning' | 'in_progress' | 'reviewing' | 'completed' | 'archived'
  members: ProjectMember[]
  createdAt: string
  updatedAt: string
  createdBy: string
  stats?: ProjectStats
}
