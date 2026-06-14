import { http } from './http'
import type { ReviewWorkflow, ReviewWorkflowTemplate, ReviewerAction } from '@/types/review'

export interface CreateWorkflowRequest {
  documentId: string
  templateId: string
}

export interface ReviewerActionRequest {
  action: ReviewerAction
  comment: string
}

export const reviewApi = {
  listTemplates() {
    return http.get<ReviewWorkflowTemplate[]>('/review-templates')
  },

  createTemplate(data: Partial<ReviewWorkflowTemplate>) {
    return http.post<ReviewWorkflowTemplate>('/review-templates', data)
  },

  deleteTemplate(id: string) {
    return http.delete<void>(`/review-templates/${id}`)
  },

  listByDocument(documentId: string) {
    return http.get<ReviewWorkflow[]>(`/documents/${documentId}/workflows`)
  },

  get(id: string) {
    return http.get<ReviewWorkflow>(`/workflows/${id}`)
  },

  start(data: CreateWorkflowRequest) {
    return http.post<ReviewWorkflow>('/workflows', data)
  },

  takeAction(workflowId: string, data: ReviewerActionRequest) {
    return http.post<ReviewWorkflow>(`/workflows/${workflowId}/action`, data)
  },

  escalate(workflowId: string, toUserId: string, reason: string) {
    return http.post<ReviewWorkflow>(`/workflows/${workflowId}/escalate`, { toUserId, reason })
  },

  cancel(id: string) {
    return http.post<void>(`/workflows/${id}/cancel`)
  }
}
