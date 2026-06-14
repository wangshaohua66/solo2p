import { http } from './http'
import type { Document, DocumentVersion, VersionDiffSummary } from '@/types/document'

export interface UploadDocumentRequest {
  projectId: string
  name: string
  category?: string
  discipline?: string
  file: File
  onProgress?: (progress: number) => void
}

export interface UploadVersionRequest {
  documentId: string
  description?: string
  file: File
  onProgress?: (progress: number) => void
}

export const documentApi = {
  list(projectId: string, params?: { category?: string; discipline?: string }) {
    return http.get<Document[]>(`/projects/${projectId}/documents`, { params })
  },

  get(id: string) {
    return http.get<Document>(`/documents/${id}`)
  },

  uploadVersion(data: UploadVersionRequest) {
    const formData = new FormData()
    formData.append('file', data.file)
    if (data.description) formData.append('description', data.description)
    return http.post<DocumentVersion>(`/documents/${data.documentId}/versions`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (data.onProgress && progressEvent.total) {
          data.onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total))
        }
      }
    })
  },

  upload(data: UploadDocumentRequest) {
    const formData = new FormData()
    formData.append('projectId', data.projectId)
    formData.append('name', data.name)
    if (data.category) formData.append('category', data.category)
    if (data.discipline) formData.append('discipline', data.discipline)
    formData.append('file', data.file)
    return http.post<Document>('/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (data.onProgress && progressEvent.total) {
          data.onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total))
        }
      }
    })
  },

  delete(id: string) {
    return http.delete<void>(`/documents/${id}`)
  },

  getVersion(documentId: string, versionId: string) {
    return http.get<DocumentVersion>(`/documents/${documentId}/versions/${versionId}`)
  },

  compareVersions(documentId: string, versionAId: string, versionBId: string) {
    return http.get<VersionDiffSummary>(`/documents/${documentId}/versions/compare`, {
      params: { versionAId, versionBId }
    })
  },

  download(documentId: string, withWatermark = true) {
    return http.get<Blob>(`/documents/${documentId}/download`, {
      params: { withWatermark },
      responseType: 'blob'
    })
  },

  setPermissions(documentId: string, permissions: any) {
    return http.put<void>(`/documents/${documentId}/permissions`, permissions)
  }
}
