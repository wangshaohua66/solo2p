import { http } from './http'
import type { Project } from '@/types/project'

export interface CreateProjectRequest {
  name: string
  description?: string
  buildingType?: string
  floorCount?: number
  area?: number
  memberIds: string[]
}

export interface UpdateProjectRequest {
  name?: string
  description?: string
  buildingType?: string
  floorCount?: number
  area?: number
  status?: string
}

export const projectApi = {
  list(params?: { status?: string; keyword?: string }) {
    return http.get<Project[]>('/projects', { params })
  },

  get(id: string) {
    return http.get<Project>(`/projects/${id}`)
  },

  create(data: CreateProjectRequest) {
    return http.post<Project>('/projects', data)
  },

  update(id: string, data: UpdateProjectRequest) {
    return http.put<Project>(`/projects/${id}`, data)
  },

  delete(id: string) {
    return http.delete<void>(`/projects/${id}`)
  },

  addMember(projectId: string, userId: string, role: string) {
    return http.post<void>(`/projects/${projectId}/members`, { userId, role })
  },

  removeMember(projectId: string, userId: string) {
    return http.delete<void>(`/projects/${projectId}/members/${userId}`)
  },

  getStats(projectId: string) {
    return http.get<any>(`/projects/${projectId}/stats`)
  },

  exportReport(projectId: string, params?: any) {
    return http.get<Blob>(`/projects/${projectId}/report`, {
      params,
      responseType: 'blob'
    })
  }
}
