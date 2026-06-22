import { request } from './apiClient'
import type {
  Inheritor,
  ApprenticeRecord,
  TrainingSchedule,
  PageResult,
} from '@/types'

export const inheritorApi = {
  getPublicList: (params: {
    keyword?: string
    region?: string
    page?: number
    size?: number
  }) => {
    return request<PageResult<Inheritor>>({
      url: '/inheritors/public/list',
      method: 'GET',
      params,
    })
  },

  getPublicDetail: (id: string) => {
    return request<Inheritor>({
      url: `/inheritors/public/${id}`,
      method: 'GET',
    })
  },

  getByHeritage: (heritageId: string) => {
    return request<Inheritor[]>({
      url: `/inheritors/public/heritage/${heritageId}`,
      method: 'GET',
    })
  },

  getInheritanceTree: (inheritorId: string) => {
    return request<Inheritor[]>({
      url: `/inheritors/public/tree/${inheritorId}`,
      method: 'GET',
    })
  },

  getList: (params: {
    keyword?: string
    region?: string
    page?: number
    size?: number
  }) => {
    return request<PageResult<Inheritor>>({
      url: '/inheritors',
      method: 'GET',
      params,
    })
  },

  getById: (id: string) => {
    return request<Inheritor>({
      url: `/inheritors/${id}`,
      method: 'GET',
    })
  },

  create: (data: Partial<Inheritor>) => {
    return request<Inheritor>({
      url: '/inheritors',
      method: 'POST',
      data,
    })
  },

  update: (id: string, data: Partial<Inheritor>) => {
    return request<Inheritor>({
      url: `/inheritors/${id}`,
      method: 'PUT',
      data,
    })
  },

  delete: (id: string) => {
    return request<void>({
      url: `/inheritors/${id}`,
      method: 'DELETE',
    })
  },

  addApprenticeRecord: (id: string, data: ApprenticeRecord) => {
    return request<Inheritor>({
      url: `/inheritors/${id}/apprentice`,
      method: 'POST',
      data,
    })
  },

  addSchedule: (id: string, data: TrainingSchedule) => {
    return request<Inheritor>({
      url: `/inheritors/${id}/schedule`,
      method: 'POST',
      data,
    })
  },

  getSchedules: (id: string) => {
    return request<TrainingSchedule[]>({
      url: `/inheritors/${id}/schedules`,
      method: 'GET',
    })
  },
}
