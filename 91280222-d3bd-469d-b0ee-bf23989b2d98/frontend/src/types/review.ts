export enum ReviewStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  NEEDS_REVISION = 'needs_revision',
  ESCALATED = 'escalated'
}

export enum ApprovalMode {
  AND = 'and',
  OR = 'or'
}

export enum ReviewerAction {
  APPROVE = 'approve',
  REJECT = 'reject',
  REQUEST_REVISION = 'request_revision',
  ESCALATE = 'escalate'
}

export interface ReviewStageConfig {
  id: string
  name: string
  order: number
  mode: ApprovalMode
  requiredApprovalCount?: number
  reviewers: string[]
  reviewerNames: string[]
  deadlineHours?: number
  requireComment: boolean
}

export interface ReviewerRecord {
  userId: string
  userName: string
  action?: ReviewerAction
  comment?: string
  status: ReviewStatus
  completedAt?: string
  assignedAt: string
}

export interface ReviewStage {
  id: string
  config: ReviewStageConfig
  reviewers: ReviewerRecord[]
  status: ReviewStatus
  startedAt?: string
  completedAt?: string
  isCurrent: boolean
  isCompleted: boolean
}

export interface ReviewWorkflowTemplate {
  id: string
  name: string
  description?: string
  stages: ReviewStageConfig[]
  createdAt: string
  createdBy: string
  isDefault: boolean
}

export interface ReviewWorkflow {
  id: string
  documentId: string
  documentName: string
  templateId: string
  templateName: string
  stages: ReviewStage[]
  currentStageIndex: number
  status: ReviewStatus
  initiatorId: string
  initiatorName: string
  startedAt: string
  completedAt?: string
  escalationHistory: EscalationRecord[]
}

export interface EscalationRecord {
  fromUserId: string
  fromUserName: string
  toUserId: string
  toUserName: string
  reason: string
  timestamp: string
}
