import { get, post, patch } from './request'
import type {
  QualityControlReview,
  ReviewCreateRequest,
  ReviewUpdateRequest,
  QualityMetrics,
  TimeMetrics,
  QualityTrendData,
  DiseaseDistribution,
  ResponseTimeAnalysis,
  QualityDashboardData,
  SamplingRequest,
  TimeMetricType,
  PageResponse
} from '@/types/quality'

export function getQualityDashboard(): Promise<QualityDashboardData> {
  return get<QualityDashboardData>('/quality/dashboard')
}

export function getQualityMetrics(
  startDate?: string,
  endDate?: string
): Promise<QualityMetrics> {
  return get<QualityMetrics>('/quality/metrics', {
    params: { startDate, endDate }
  })
}

export function getTimeMetrics(
  metricType?: TimeMetricType,
  startDate?: string,
  endDate?: string,
  region?: string,
  severity?: string,
  diagnosis?: string
): Promise<TimeMetrics[]> {
  return get<TimeMetrics[]>('/quality/time-metrics', {
    params: { metricType, startDate, endDate, region, severity, diagnosis }
  })
}

export function getQualityTrend(
  days = 30,
  startDate?: string,
  endDate?: string
): Promise<QualityTrendData[]> {
  return get<QualityTrendData[]>('/quality/trend', {
    params: { days, startDate, endDate }
  })
}

export function getDiseaseDistribution(
  startDate?: string,
  endDate?: string,
  topN = 10
): Promise<DiseaseDistribution[]> {
  return get<DiseaseDistribution[]>('/quality/disease-distribution', {
    params: { startDate, endDate, topN }
  })
}

export function getResponseTimeByRegion(
  startDate?: string,
  endDate?: string
): Promise<ResponseTimeAnalysis[]> {
  return get<ResponseTimeAnalysis[]>('/quality/response-time-by-region', {
    params: { startDate, endDate }
  })
}

export function getReviews(
  page = 0,
  size = 20,
  filters?: {
    reviewStatus?: string
    startDate?: string
    endDate?: string
    reviewerId?: number
    isOverdue?: boolean
  }
): Promise<PageResponse<QualityControlReview>> {
  return get<PageResponse<QualityControlReview>>('/quality/reviews', {
    params: { page, size, ...filters }
  })
}

export function getReview(reviewId: number): Promise<QualityControlReview> {
  return get<QualityControlReview>(`/quality/reviews/${reviewId}`)
}

export function createReview(request: ReviewCreateRequest): Promise<QualityControlReview> {
  return post<QualityControlReview>('/quality/reviews', request)
}

export function updateReview(
  reviewId: number,
  request: ReviewUpdateRequest
): Promise<QualityControlReview> {
  return patch<QualityControlReview>(`/quality/reviews/${reviewId}`, request)
}

export function getReviewsByRecord(recordId: number): Promise<QualityControlReview[]> {
  return get<QualityControlReview[]>(`/quality/reviews/record/${recordId}`)
}

export function getPendingReviews(
  page = 0,
  size = 20
): Promise<PageResponse<QualityControlReview>> {
  return get<PageResponse<QualityControlReview>>('/quality/reviews/pending', {
    params: { page, size }
  })
}

export function getOverdueReviews(
  page = 0,
  size = 20
): Promise<PageResponse<QualityControlReview>> {
  return get<PageResponse<QualityControlReview>>('/quality/reviews/overdue', {
    params: { page, size }
  })
}

export function runSampling(request: SamplingRequest): Promise<{
  sampledCount: number
  totalEligible: number
  sampledIds: number[]
}> {
  return post<{
    sampledCount: number
    totalEligible: number
    sampledIds: number[]
  }>('/quality/sampling', request)
}

export function runAutoSampling(): Promise<{
  sampledCount: number
  totalEligible: number
  sampledIds: number[]
}> {
  return post<{
    sampledCount: number
    totalEligible: number
    sampledIds: number[]
  }>('/quality/sampling/auto')
}

export function exportQualityReport(
  startDate: string,
  endDate: string,
  format = 'excel'
): Promise<Blob> {
  return get<Blob>(`/quality/export`, {
    params: { startDate, endDate, format },
    responseType: 'blob'
  })
}
