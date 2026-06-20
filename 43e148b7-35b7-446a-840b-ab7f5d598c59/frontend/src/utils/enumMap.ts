import { ProjectType, ProjectStage, ProjectStatus, TaskStatus, ProfessionType, ReviewLevel, ReviewStatus, ChangeStatus } from '@/types'

export const projectTypeMap: Record<ProjectType, string> = {
  GOVERNMENT: '政府投资',
  COMMERCIAL: '商业地产',
  INDUSTRIAL: '工业厂房',
}

export const projectStageMap: Record<ProjectStage, string> = {
  SCHEME: '方案设计',
  PRELIMINARY: '初步设计',
  CONSTRUCTION: '施工图设计',
}

export const projectStatusMap: Record<ProjectStatus, string> = {
  PENDING: '待启动',
  IN_PROGRESS: '进行中',
  REVIEWING: '校审中',
  COMPLETED: '已完成',
  SUSPENDED: '已暂停',
}

export const projectStatusColorMap: Record<ProjectStatus, string> = {
  PENDING: 'default',
  IN_PROGRESS: 'processing',
  REVIEWING: 'warning',
  COMPLETED: 'success',
  SUSPENDED: 'error',
}

export const taskStatusMap: Record<TaskStatus, string> = {
  PENDING: '待领取',
  IN_PROGRESS: '进行中',
  REVIEWING: '待校审',
  COMPLETED: '已完成',
}

export const taskStatusColorMap: Record<TaskStatus, string> = {
  PENDING: 'default',
  IN_PROGRESS: 'processing',
  REVIEWING: 'warning',
  COMPLETED: 'success',
}

export const professionMap: Record<ProfessionType, string> = {
  ARCHITECTURE: '建筑',
  STRUCTURE: '结构',
  PLUMBING: '给排水',
  HVAC: '暖通',
  ELECTRICAL: '电气',
}

export const professionColorMap: Record<ProfessionType, string> = {
  ARCHITECTURE: '#1677ff',
  STRUCTURE: '#52c41a',
  PLUMBING: '#13c2c2',
  HVAC: '#fa8c16',
  ELECTRICAL: '#722ed1',
}

export const reviewLevelMap: Record<ReviewLevel, string> = {
  CHECK: '校对',
  AUDIT: '审核',
  APPROVE: '审定',
}

export const reviewStatusMap: Record<ReviewStatus, string> = {
  PENDING: '待处理',
  IN_PROGRESS: '处理中',
  PASSED: '通过',
  REJECTED: '驳回',
}

export const reviewStatusColorMap: Record<ReviewStatus, string> = {
  PENDING: 'default',
  IN_PROGRESS: 'processing',
  PASSED: 'success',
  REJECTED: 'error',
}

export const changeStatusMap: Record<ChangeStatus, string> = {
  DRAFT: '草稿',
  SUBMITTED: '已提交',
  PM_APPROVED: '项目经理审批通过',
  LEAD_APPROVED: '专业负责人审批通过',
  CLIENT_APPROVED: '客户审批通过',
  REJECTED: '已驳回',
  IMPLEMENTED: '已实施',
}

export const changeStatusColorMap: Record<ChangeStatus, string> = {
  DRAFT: 'default',
  SUBMITTED: 'processing',
  PM_APPROVED: 'processing',
  LEAD_APPROVED: 'processing',
  CLIENT_APPROVED: 'success',
  REJECTED: 'error',
  IMPLEMENTED: 'success',
}
