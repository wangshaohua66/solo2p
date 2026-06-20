export interface User {
  id: number
  username: string
  name: string
  role: string
  department: string
  avatar?: string
  phone?: string
  email?: string
}

export interface Topic {
  id: number
  title: string
  description: string
  duration: number
  expectedAirDate: string
  programType: 'news' | 'feature' | 'variety' | 'drama'
  channel: 'news' | 'city' | 'public'
  interviewee: string
  location: string
  status: TopicStatus
  creatorId: number
  creatorName: string
  createdAt: string
  updatedAt: string
  tasks?: Task[]
  logs?: TopicLog[]
}

export type TopicStatus = 
  | 'draft' 
  | 'submitted' 
  | 'reviewing' 
  | 'approved' 
  | 'rejected' 
  | 'in_production' 
  | 'completed' 
  | 'archived'

export interface Task {
  id: number
  topicId: number
  name: string
  type: 'collection' | 'script' | 'editing' | 'review'
  assigneeId: number
  assigneeName: string
  status: 'pending' | 'in_progress' | 'completed' | 'rejected'
  dueDate: string
  createdAt: string
}

export interface TopicLog {
  id: number
  topicId: number
  action: string
  operatorId: number
  operatorName: string
  remark: string
  createdAt: string
}

export interface Material {
  id: number
  name: string
  type: 'video' | 'audio' | 'image' | 'document'
  fileSize: number
  duration?: number
  resolution?: string
  codec?: string
  format: string
  path: string
  thumbnail?: string
  tags: string[]
  description: string
  uploaderId: number
  uploaderName: string
  uploadedAt: string
  copyrightId?: number
  metadata?: Record<string, any>
}

export interface ReviewItem {
  id: number
  topicId: number
  title: string
  type: 'topic' | 'material' | 'program'
  currentLevel: 1 | 2 | 3
  status: ReviewStatus
  submitterId: number
  submitterName: string
  submittedAt: string
  reviews: ReviewRecord[]
}

export type ReviewStatus = 
  | 'pending' 
  | 'reviewing' 
  | 'approved' 
  | 'rejected' 
  | 'completed'

export interface ReviewRecord {
  id: number
  itemId: number
  level: 1 | 2 | 3
  reviewerId: number
  reviewerName: string
  status: 'approved' | 'rejected' | 'pending'
  comment: string
  reviewedAt: string
  version?: string
}

export interface ScheduleItem {
  id: number
  channelId: 'news' | 'city' | 'public'
  programName: string
  programType: string
  startTime: string
  endTime: string
  duration: number
  topicId?: number
  status: 'scheduled' | 'broadcasting' | 'completed' | 'cancelled'
  createdBy: string
  createdAt: string
}

export interface Channel {
  id: 'news' | 'city' | 'public'
  name: string
  description: string
}

export interface Copyright {
  id: number
  name: string
  type: string
  owner: string
  authorizationScope: string
  startDate: string
  endDate: string
  cost: number
  materialIds: number[]
  status: 'active' | 'expiring' | 'expired'
  createdAt: string
  riskLevel?: 'none' | 'low' | 'medium' | 'high' | 'critical'
  riskScore?: number
  riskFactors?: string
  riskNotified?: boolean
  contractUrl?: string
  remarks?: string
}

export interface WorkloadStats {
  department: string
  userId: number
  userName: string
  topicCount: number
  materialCount: number
  programDuration: number
  reviewCount: number
  period: string
}

export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
  total?: number
}

export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}
