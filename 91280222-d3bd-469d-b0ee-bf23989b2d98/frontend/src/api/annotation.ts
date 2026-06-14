import { http } from './http'
import type { Annotation, AnnotationReply, AnnotationConflict } from '@/types/annotation'

export interface CreateAnnotationRequest {
  documentId: string
  versionId: string
  pageNumber: number
  geometry: any
  content: string
  severity: string
  assigneeId?: string
  mentions?: string[]
}

export interface UpdateAnnotationRequest {
  content?: string
  status?: string
  severity?: string
  assigneeId?: string
}

export const annotationApi = {
  list(documentId: string, params?: { versionId?: string; status?: string; pageNumber?: number }) {
    return http.get<Annotation[]>(`/documents/${documentId}/annotations`, { params })
  },

  get(id: string) {
    return http.get<Annotation>(`/annotations/${id}`)
  },

  create(data: CreateAnnotationRequest) {
    return http.post<Annotation>('/annotations', data)
  },

  update(id: string, data: UpdateAnnotationRequest) {
    return http.put<Annotation>(`/annotations/${id}`, data)
  },

  delete(id: string) {
    return http.delete<void>(`/annotations/${id}`)
  },

  addReply(annotationId: string, content: string, mentions: string[] = []) {
    return http.post<AnnotationReply>(`/annotations/${annotationId}/replies`, { content, mentions })
  },

  deleteReply(annotationId: string, replyId: string) {
    return http.delete<void>(`/annotations/${annotationId}/replies/${replyId}`)
  },

  migrate(annotationIds: string[], targetVersionId: string) {
    return http.post<Annotation[]>('/annotations/migrate', { annotationIds, targetVersionId })
  },

  detectConflict(data: { documentId: string; versionId: string; pageNumber: number; geometry: any }) {
    return http.post<AnnotationConflict[]>('/annotations/detect-conflict', data)
  },

  resolveConflict(annotationId: string, action: 'merge' | 'overwrite') {
    return http.post<void>(`/annotations/${annotationId}/resolve-conflict`, { action })
  }
}
