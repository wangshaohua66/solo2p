import { request } from './axios'
import { DesignVersion, PageResult } from '@/types'

export const versionApi = {
  getVersionList: (params: any) => {
    return request<PageResult<DesignVersion>>({
      url: '/versions',
      method: 'get',
      params,
    })
  },

  getTaskVersions: (taskId: number) => {
    return request<DesignVersion[]>({
      url: `/versions/task/${taskId}`,
      method: 'get',
    })
  },

  getProjectVersions: (projectId: number) => {
    return request<DesignVersion[]>({
      url: `/versions/project/${projectId}`,
      method: 'get',
    })
  },

  getVersion: (id: number) => {
    return request<DesignVersion>({
      url: `/versions/${id}`,
      method: 'get',
    })
  },

  uploadVersion: (formData: FormData, onProgress?: (percent: number) => void) => {
    return request<DesignVersion>({
      url: '/versions/upload',
      method: 'post',
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent: any) => {
        if (onProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(percent)
        }
      },
    })
  },

  downloadVersion: (id: number) => {
    return request<Blob>({
      url: `/versions/${id}/download`,
      method: 'get',
      responseType: 'blob',
    })
  },

  releaseVersion: (id: number) => {
    return request<DesignVersion>({
      url: `/versions/${id}/release`,
      method: 'post',
    })
  },

  compareVersions: (id1: number, id2: number) => {
    return request<any>({
      url: `/versions/compare`,
      method: 'get',
      params: { id1, id2 },
    })
  },
}
