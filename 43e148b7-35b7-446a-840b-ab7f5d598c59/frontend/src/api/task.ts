import { request } from './axios'
import { DesignTask, PageResult } from '@/types'

export const taskApi = {
  getTaskList: (params: any) => {
    return request<PageResult<DesignTask>>({
      url: '/tasks',
      method: 'get',
      params,
    })
  },

  getProjectTasks: (projectId: number) => {
    return request<DesignTask[]>({
      url: `/tasks/project/${projectId}`,
      method: 'get',
    })
  },

  getTask: (id: number) => {
    return request<DesignTask>({
      url: `/tasks/${id}`,
      method: 'get',
    })
  },

  createTask: (data: Partial<DesignTask>) => {
    return request<DesignTask>({
      url: '/tasks',
      method: 'post',
      data,
    })
  },

  updateTask: (id: number, data: Partial<DesignTask>) => {
    return request<DesignTask>({
      url: `/tasks/${id}`,
      method: 'put',
      data,
    })
  },

  updateTaskStatus: (id: number, status: string) => {
    return request<DesignTask>({
      url: `/tasks/${id}/status`,
      method: 'put',
      data: { status },
    })
  },

  updateTaskProgress: (id: number, progress: number) => {
    return request<DesignTask>({
      url: `/tasks/${id}/progress`,
      method: 'put',
      data: { progress },
    })
  },

  deleteTask: (id: number) => {
    return request<void>({
      url: `/tasks/${id}`,
      method: 'delete',
    })
  },

  claimTask: (id: number) => {
    return request<DesignTask>({
      url: `/tasks/${id}/claim`,
      method: 'post',
    })
  },

  submitForReview: (id: number) => {
    return request<DesignTask>({
      url: `/tasks/${id}/submit-review`,
      method: 'post',
    })
  },
}
