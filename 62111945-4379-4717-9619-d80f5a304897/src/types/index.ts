export enum UserRole {
  ADMIN = 'admin',
  ENTERPRISE = 'enterprise',
  JOBSEEKER = 'jobseeker'
}

export interface UserInfo {
  id: string
  username: string
  name: string
  role: UserRole
  avatar?: string
  phone?: string
  email?: string
  companyId?: string
  centerId?: string
}

export interface Recruitment {
  id: string
  title: string
  description: string
  startTime: string
  endTime: string
  location: string
  centerId: string
  centerName: string
  status: 'pending' | 'ongoing' | 'ended'
  enterpriseCount: number
  jobCount: number
  attendeeCount: number
  boothCount: number
  signInCount: number
  intentionCount: number
  createdAt: string
}

export interface Booth {
  id: string
  recruitmentId: string
  boothNumber: string
  enterpriseId?: string
  enterpriseName?: string
  status: 'available' | 'assigned' | 'checked_in'
  area: string
}

export interface Enterprise {
  id: string
  name: string
  legalPerson: string
  creditCode: string
  contactName: string
  contactPhone: string
  address: string
  industry: string
  scale: string
  status: 'pending' | 'approved' | 'rejected'
  logo?: string
  description?: string
}

export interface Job {
  id: string
  enterpriseId: string
  enterpriseName: string
  title: string
  salaryMin: number
  salaryMax: number
  location: string
  experience: string
  education: string
  tags: string[]
  description: string
  requirements: string
  status: 'draft' | 'pending' | 'online' | 'offline' | 'rejected'
  applyCount: number
  createdAt: string
}

export interface Resume {
  id: string
  jobseekerId: string
  title: string
  isDefault: boolean
  isPublic: boolean
  name: string
  gender: 'male' | 'female'
  age: number
  phone: string
  email: string
  education: string
  experience: number
  skills: string[]
  expectedPosition: string
  expectedSalaryMin: number
  expectedSalaryMax: number
  workExperience: WorkExperience[]
  educationExperience: EducationExperience[]
  projectExperience: ProjectExperience[]
  createdAt: string
  updatedAt: string
}

export interface WorkExperience {
  id: string
  company: string
  position: string
  startTime: string
  endTime: string
  description: string
}

export interface EducationExperience {
  id: string
  school: string
  major: string
  degree: string
  startTime: string
  endTime: string
}

export interface ProjectExperience {
  id: string
  name: string
  role: string
  startTime: string
  endTime: string
  description: string
}

export interface ApplicationRecord {
  id: string
  jobId: string
  jobTitle: string
  enterpriseId: string
  enterpriseName: string
  resumeId: string
  resumeTitle: string
  status: 'applied' | 'viewed' | 'interview' | 'offer' | 'rejected'
  matchScore?: number
  appliedAt: string
  updatedAt: string
}

export interface Interview {
  id: string
  applicationId: string
  jobId: string
  jobTitle: string
  enterpriseId: string
  enterpriseName: string
  jobseekerId: string
  jobseekerName: string
  type: 'video' | 'onsite'
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  scheduledTime: string
  duration: number
  roomId?: string
  evaluation?: string
  rating?: number
  createdAt: string
}

export interface Message {
  id: string
  userId: string
  type: 'system' | 'application' | 'interview' | 'notification'
  title: string
  content: string
  isRead: boolean
  relatedId?: string
  createdAt: string
}

export interface StatisticsData {
  totalEnterprises: number
  totalJobs: number
  totalJobseekers: number
  totalRecruitments: number
  monthlyData: { month: string; count: number }[]
  industryDistribution: { name: string; value: number }[]
  salaryDistribution: { name: string; value: number }[]
  centerData: { name: string; recruitmentCount: number; jobCount: number; attendeeCount: number }[]
}

export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}
