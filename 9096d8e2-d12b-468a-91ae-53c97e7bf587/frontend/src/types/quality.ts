export enum ReviewStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  NEEDS_REVISION = 'NEEDS_REVISION',
  APPROVED = 'APPROVED'
}

export enum DefectSeverity {
  MINOR = 'MINOR',
  MAJOR = 'MAJOR',
  CRITICAL = 'CRITICAL'
}

export enum TimeMetricType {
  RESPONSE_TIME = 'RESPONSE_TIME',
  ON_SCENE_DURATION = 'ON_SCENE_DURATION',
  TRANSIT_DURATION = 'TRANSIT_DURATION',
  TOTAL_CYCLE_TIME = 'TOTAL_CYCLE_TIME',
  DISPATCH_TO_ARRIVAL = 'DISPATCH_TO_ARRIVAL'
}

export interface QualityControlReview {
  id: number
  recordId: number
  recordNo: string
  patientName: string
  preliminaryDiagnosis: string
  reviewerId?: number
  reviewerName?: string
  reviewStatus: ReviewStatus
  score?: number
  maxScore: number
  reviewNotes?: string
  reviewedAt?: string
  dueDate: string
  isOverdue: boolean
  defects: QualityDefect[]
  createdAt: string
  updatedAt: string
}

export interface QualityDefect {
  id?: number
  fieldName: string
  defectDescription: string
  severity: DefectSeverity
  suggestion?: string
}

export interface ReviewCreateRequest {
  recordId: number
  dueDate: string
  maxScore?: number
}

export interface ReviewUpdateRequest {
  reviewStatus?: ReviewStatus
  score?: number
  reviewNotes?: string
  defects?: QualityDefect[]
}

export interface QualityMetrics {
  totalReviews: number
  pendingReviews: number
  completedReviews: number
  averageScore: number
  passRate: number
  overdueCount: number
}

export interface TimeMetrics {
  metricType: TimeMetricType
  metricName: string
  averageMinutes: number
  medianMinutes: number
  p95Minutes: number
  minMinutes: number
  maxMinutes: number
  totalCases: number
  compliantCases: number
  complianceRate: number
  thresholdMinutes: number
}

export interface QualityTrendData {
  date: string
  averageScore: number
  passRate: number
  reviewCount: number
}

export interface DiseaseDistribution {
  diagnosis: string
  count: number
  percentage: number
}

export interface ResponseTimeAnalysis {
  region: string
  averageResponseMinutes: number
  callCount: number
  passRate: number
}

export interface QualityDashboardData {
  keyMetrics: QualityMetrics
  timeMetrics: TimeMetrics[]
  trendData: QualityTrendData[]
  diseaseDistribution: DiseaseDistribution[]
  responseTimeByRegion: ResponseTimeAnalysis[]
  recentReviews: QualityControlReview[]
}

export interface SamplingRequest {
  startDate: string
  endDate: string
  sampleSize: number
  severityFilters?: string[]
  regionFilters?: string[]
}

export interface TimeMetricFilter {
  metricType: TimeMetricType
  startDate?: string
  endDate?: string
  region?: string
  severity?: string
  diagnosis?: string
}
