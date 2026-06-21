export type DeclarationStatus =
  | 'draft'
  | 'submitted'
  | 'reviewing'
  | 'approved'
  | 'rejected'
  | 'customs_processing'
  | 'customs_passed'
  | 'customs_exception'
  | 'tax_processing'
  | 'tax_completed'
  | 'withdrawn'

export interface DeclarationItem {
  id: string
  productName: string
  hsCode: string
  specification: string
  quantity: number
  unit: string
  unitPrice: number
  currency: string
  totalAmount: number
  country: string
  declareElements: Record<string, string>
}

export interface DeclarationAttachment {
  id: string
  name: string
  url: string
  size: number
  uploadedAt: string
}

export interface Declaration {
  id: string
  declareNo: string
  title: string
  enterpriseName: string
  platform: string
  status: DeclarationStatus
  declareType: 'normal' | 'express' | 'bonded'
  items: DeclarationItem[]
  attachments: DeclarationAttachment[]
  totalAmount: number
  taxRefundAmount: number
  statusHistory: { status: DeclarationStatus; time: string; operator: string; remark?: string }[]
  remark: string
  submitter: string
  reviewer?: string
  createdAt: string
  updatedAt: string
  submittedAt?: string
  reviewedAt?: string
  customsPassedAt?: string
  taxCompletedAt?: string
}

export interface DeclarationFilter {
  keyword: string
  status: DeclarationStatus | ''
  platform: string
  declareType: string
  dateRange: [string, string] | null
  enterpriseName: string
}

export interface Pagination {
  page: number
  pageSize: number
  total: number
}

export interface HSCode {
  code: string
  name: string
  chapter: string
  section: string
  description: string
  taxRate: number
  refundRate: number
  supervisionConditions: string[]
  declareElements: { key: string; label: string; required: boolean; description?: string }[]
  unit: string[]
  notes?: string
}

export interface HSChapter {
  code: string
  name: string
  children?: HSChapter[]
}

export interface TaxCalcItem {
  productName: string
  hsCode: string
  quantity: number
  unitPrice: number
  currency: string
  exchangeRate?: number
}

export interface TaxCalcResult {
  hsCode: string
  productName: string
  refundRate: number
  taxBasis: number
  refundAmount: number
  policyNo: string
  effectiveDate: string
}

export interface Policy {
  id: string
  title: string
  category: 'tax' | 'customs' | 'foreign_exchange'
  source: string
  issuedDate: string
  effectiveDate: string
  content: string
  summary: string
  tags: string[]
  isFavorite: boolean
  notes?: PolicyNote[]
  isSubscribed?: boolean
}

export interface PolicyNote {
  id: string
  policyId: string
  content: string
  createdAt: string
  updatedAt: string
}

export type NotificationType = 'exception' | 'policy' | 'review' | 'system'

export interface NotificationMessage {
  id: string
  type: NotificationType
  title: string
  content: string
  read: boolean
  time: string
  link: string
}

export interface CustomsException {
  id: string
  declareNo: string
  type: string
  description: string
  status: 'pending' | 'processing' | 'resolved'
  suggestion: string
  reportedAt: string
  resolvedAt?: string
  handler: string
}

export interface DashboardStats {
  totalDeclarations: number
  customsPassRate: number
  totalTaxRefund: number
  exceptionCount: number
  declarationTrend: { date: string; count: number }[]
  categoryDistribution: { name: string; value: number }[]
  countryDistribution: { name: string; value: number }[]
  platformDistribution: { name: string; value: number }[]
}

export type UserRole = 'declarant' | 'reviewer' | 'admin'

export interface User {
  id: string
  username: string
  name: string
  email: string
  role: UserRole
  enterpriseName?: string
  avatar?: string
  permissions: string[]
}
