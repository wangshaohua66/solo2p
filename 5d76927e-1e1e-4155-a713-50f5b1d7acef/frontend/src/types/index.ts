export interface ApiResponse<T> {
  code: number
  message: string
  data: T
  timestamp: number
}

export type HeritageCategory = 'TRADITIONAL_CRAFT' | 'TRADITIONAL_MUSIC' | 'TRADITIONAL_DANCE' | 'TRADITIONAL_OPERA' | 'FOLK_CUSTOM'

export const HeritageCategoryMap: Record<HeritageCategory, string> = {
  TRADITIONAL_CRAFT: '传统技艺',
  TRADITIONAL_MUSIC: '传统音乐',
  TRADITIONAL_DANCE: '传统舞蹈',
  TRADITIONAL_OPERA: '传统戏剧',
  FOLK_CUSTOM: '民俗',
}

export type HeritageLevel = 'NATIONAL' | 'PROVINCIAL' | 'MUNICIPAL'

export const HeritageLevelMap: Record<HeritageLevel, string> = {
  NATIONAL: '国家级',
  PROVINCIAL: '省级',
  MUNICIPAL: '市级',
}

export type MediaType = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT'

export interface MediaFile {
  id: string
  fileName: string
  type: MediaType
  fileUrl: string
  fileSize: number
  mimeType: string
  description?: string
  metadata?: Record<string, unknown>
  uploadedAt: string
  uploadedBy: string
}

export interface VersionHistory {
  version: string
  changeLog: string
  modifiedBy: string
  modifiedAt: string
}

export interface Heritage {
  id: string
  name: string
  category: HeritageCategory
  level: HeritageLevel
  region: string
  summary: string
  description: string
  history?: string
  characteristics?: string
  coverImage?: string
  inheritorIds: string[]
  mediaFiles: MediaFile[]
  versionHistory: VersionHistory[]
  viewCount: number
  hotScore: number
  published: boolean
  createdBy?: string
  updatedBy?: string
  createdAt: string
  updatedAt: string
}

export interface ApprenticeRecord {
  apprenticeName: string
  startDate: string
  endDate?: string
  status: string
  assessmentResult?: string
}

export interface TrainingSchedule {
  startTime: string
  endTime: string
  location: string
  available: boolean
}

export interface Inheritor {
  id: string
  name: string
  gender: string
  birthDate?: string
  age?: number
  ethnicity?: string
  region: string
  avatar?: string
  bio?: string
  skillCharacteristics?: string
  representativeWorks?: string
  masterId?: string
  studentIds: string[]
  heritageIds: string[]
  apprenticeRecords: ApprenticeRecord[]
  availableSchedules: TrainingSchedule[]
  totalTeachingHours: number
  apprenticeCount: number
  phone?: string
  email?: string
  userId?: string
  createdAt: string
  updatedAt: string
}

export type BookingStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED'

export const BookingStatusMap: Record<BookingStatus, string> = {
  PENDING: '待审批',
  APPROVED: '已批准',
  REJECTED: '已拒绝',
  CANCELLED: '已取消',
  COMPLETED: '已完成',
}

export interface Booking {
  id: string
  heritageId: string
  inheritorId: string
  institutionId: string
  institutionName: string
  contactPerson: string
  contactPhone: string
  contactEmail?: string
  participantCount: number
  startTime: string
  endTime: string
  location: string
  content: string
  specialRequirements?: string
  status: BookingStatus
  approvalRemark?: string
  approvedBy?: string
  approvedAt?: string
  createdAt: string
  updatedAt: string
}

export type UserRole = 'ADMIN' | 'STAFF' | 'INHERITOR' | 'INSTITUTION' | 'PUBLIC'

export const UserRoleMap: Record<UserRole, string> = {
  ADMIN: '管理员',
  STAFF: '工作人员',
  INHERITOR: '传承人',
  INSTITUTION: '研学机构',
  PUBLIC: '社会公众',
}

export interface User {
  id: string
  username: string
  email: string
  phone?: string
  realName?: string
  avatar?: string
  roles: UserRole[]
  organization?: string
  inheritorId?: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface TrainingRecord {
  trainingDate: string
  durationHours: number
  content: string
  apprenticeName: string
  assessmentScore?: string
  assessmentRemark?: string
}

export interface TrainingPlan {
  id: string
  year: string
  inheritorId: string
  heritageId: string
  planName: string
  objectives: string
  targetApprenticeCount: number
  targetTeachingHours: number
  trainingRecords: TrainingRecord[]
  completedHours: number
  completedAssessments: number
  progressStatus: string
  startDate: string
  endDate: string
  reportUrl?: string
  createdAt: string
  updatedAt: string
}

export interface Notification {
  id: string
  userId: string
  title: string
  content: string
  type: string
  relatedId?: string
  read: boolean
  emailSent: boolean
  createdAt: string
}

export interface PageParams {
  page?: number
  size?: number
}

export interface PageResult<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}
