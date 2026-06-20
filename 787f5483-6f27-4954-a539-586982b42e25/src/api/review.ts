import { get, post, put } from '@/utils/request'
import type { ReviewItem, ReviewRecord, PageResult } from '@/types'

export function getReviewList(params: {
  page: number
  pageSize: number
  status?: ReviewItem['status']
  type?: ReviewItem['type']
  currentLevel?: number
}) {
  return get<PageResult<ReviewItem>>('/reviews', { params })
}

export function getReviewDetail(id: number) {
  return get<ReviewItem>(`/reviews/${id}`)
}

export function submitReview(itemId: number, data: { level: number; status: 'approved' | 'rejected'; comment: string; version?: string }) {
  return post<ReviewRecord>(`/reviews/${itemId}`, data)
}

export function getReviewHistory(itemId: number) {
  return get<ReviewRecord[]>(`/reviews/${itemId}/history`)
}

export function compareVersions(itemId: number, version1: string, version2: string) {
  return get(`/reviews/${itemId}/compare`, {
    params: { version1, version2 }
  })
}

export function getMyPendingReviews() {
  return get<ReviewItem[]>('/reviews/my-pending')
}

export function remindReviewer(itemId: number, reviewerId: number) {
  return post(`/reviews/${itemId}/remind`, { reviewerId })
}
