export type UserRole = 'ADMIN' | 'PROJECT_MANAGER' | 'PROFESSIONAL_LEAD' | 'DESIGNER' | 'CLIENT'

export type ProjectType = 'GOVERNMENT' | 'COMMERCIAL' | 'INDUSTRIAL'
export type ProjectStage = 'SCHEME' | 'PRELIMINARY' | 'CONSTRUCTION'
export type ProjectStatus = 'PENDING' | 'IN_PROGRESS' | 'REVIEWING' | 'COMPLETED' | 'SUSPENDED'

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'REVIEWING' | 'COMPLETED'
export type ProfessionType = 'ARCHITECTURE' | 'STRUCTURE' | 'PLUMBING' | 'HVAC' | 'ELECTRICAL'

export type ReviewLevel = 'CHECK' | 'AUDIT' | 'APPROVE'
export type ReviewStatus = 'PENDING' | 'IN_PROGRESS' | 'PASSED' | 'REJECTED'

export type ChangeStatus = 'DRAFT' | 'SUBMITTED' | 'PM_APPROVED' | 'LEAD_APPROVED' | 'CLIENT_APPROVED' | 'REJECTED' | 'IMPLEMENTED'

export interface User {
  id: number
  username: string
  name: string
  role: UserRole
  email?: string
  phone?: string
  profession?: ProfessionType
  token?: string
}

export interface Project {
  id: number
  projectNo: string
  name: string
  type: ProjectType
  stage: ProjectStage
  status: ProjectStatus
  contractAmount: number
  startDate: string
  endDate: string
  clientName: string
  clientContact: string
  clientPhone: string
  projectManagerId?: number
  projectManagerName?: string
  description?: string
  progress: number
  createdAt: string
  updatedAt: string
}

export interface ProjectProfessional {
  id: number
  projectId: number
  profession: ProfessionType
  professionalLeadId: number
  professionalLeadName: string
  progress: number
}

export interface DesignTask {
  id: number
  projectId: number
  projectName: string
  stage: ProjectStage
  profession: ProfessionType
  name: string
  description?: string
  parentId?: number
  assigneeId?: number
  assigneeName?: string
  status: TaskStatus
  progress: number
  plannedStartDate: string
  plannedEndDate: string
  actualStartDate?: string
  actualEndDate?: string
  deliverables?: string
  createdAt: string
  updatedAt: string
}

export interface ReviewRecord {
  id: number
  taskId: number
  projectId: number
  versionId: number
  level: ReviewLevel
  reviewerId: number
  reviewerName: string
  status: ReviewStatus
  comments: ReviewComment[]
  submittedAt: string
  completedAt?: string
}

export interface ReviewComment {
  id: number
  reviewRecordId: number
  content: string
  reply?: string
  location?: string
  resolved: boolean
  createdBy: number
  createdByName: string
  createdAt: string
  repliedAt?: string
}

export interface ChangeRequest {
  id: number
  projectId: number
  projectName: string
  changeNo: string
  title: string
  reason: string
  content: string
  impactScope: string
  workload: number
  additionalFee: number
  status: ChangeStatus
  applicantId: number
  applicantName: string
  applicantType: 'INTERNAL' | 'CLIENT'
  currentApproverId?: number
  createdAt: string
  approvalRecords: ChangeApproval[]
}

export interface ChangeApproval {
  id: number
  changeRequestId: number
  approverId: number
  approverName: string
  approverRole: string
  comment?: string
  approved: boolean
  approvedAt?: string
}

export interface DesignVersion {
  id: number
  projectId: number
  projectName: string
  taskId: number
  versionNo: string
  fileName: string
  fileSize: number
  filePath: string
  uploadedBy: number
  uploadedByName: string
  description: string
  isReleased: boolean
  createdAt: string
}

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}
