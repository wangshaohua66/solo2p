import { request } from './axios'
import { Project, ProjectProfessional, PageResult } from '@/types'

export const projectApi = {
  getProjectList: (params: any) => {
    return request<PageResult<Project>>({
      url: '/projects',
      method: 'get',
      params,
    })
  },

  getProject: (id: number) => {
    return request<Project>({
      url: `/projects/${id}`,
      method: 'get',
    })
  },

  createProject: (data: Partial<Project>) => {
    return request<Project>({
      url: '/projects',
      method: 'post',
      data,
    })
  },

  updateProject: (id: number, data: Partial<Project>) => {
    return request<Project>({
      url: `/projects/${id}`,
      method: 'put',
      data,
    })
  },

  deleteProject: (id: number) => {
    return request<void>({
      url: `/projects/${id}`,
      method: 'delete',
    })
  },

  getProjectProfessionals: (projectId: number) => {
    return request<ProjectProfessional[]>({
      url: `/projects/${projectId}/professionals`,
      method: 'get',
    })
  },

  assignProfessional: (projectId: number, data: any) => {
    return request<void>({
      url: `/projects/${projectId}/professionals`,
      method: 'post',
      data,
    })
  },
}
