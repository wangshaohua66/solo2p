import { request } from './axios'
import { ReviewRecord, ReviewComment, PageResult } from '@/types'

export const reviewApi = {
  getReviewList: (params: any) => {
    return request<PageResult<ReviewRecord>>({
      url: '/reviews',
      method: 'get',
      params,
    })
  },

  getTaskReviews: (taskId: number) => {
    return request<ReviewRecord[]>({
      url: `/reviews/task/${taskId}`,
      method: 'get',
    })
  },

  getReview: (id: number) => {
    return request<ReviewRecord>({
      url: `/reviews/${id}`,
      method: 'get',
    })
  },

  createReview: (data: any) => {
    return request<ReviewRecord>({
      url: '/reviews',
      method: 'post',
      data,
    })
  },

  addComment: (reviewId: number, data: Partial<ReviewComment>) => {
    return request<ReviewComment>({
      url: `/reviews/${reviewId}/comments`,
      method: 'post',
      data,
    })
  },

  replyComment: (reviewId: number, commentId: number, reply: string) => {
    return request<ReviewComment>({
      url: `/reviews/${reviewId}/comments/${commentId}/reply`,
      method: 'put',
      data: { reply },
    })
  },

  resolveComment: (reviewId: number, commentId: number) => {
    return request<ReviewComment>({
      url: `/reviews/${reviewId}/comments/${commentId}/resolve`,
      method: 'put',
    })
  },

  completeReview: (id: number, passed: boolean) => {
    return request<ReviewRecord>({
      url: `/reviews/${id}/complete`,
      method: 'put',
      data: { passed },
    })
  },
}
