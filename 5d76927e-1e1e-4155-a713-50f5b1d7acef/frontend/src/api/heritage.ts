import { request } from './apiClient'
import type {
  Heritage,
  HeritageCategory,
  HeritageLevel,
  PageResult,
  MediaFile,
} from '@/types'

export const heritageApi = {
  getPublicList: (params: {
    keyword?: string
    category?: HeritageCategory
    level?: HeritageLevel
    region?: string
    page?: number
    size?: number
  }) => {
    return request<PageResult<Heritage>>({
      url: '/heritages/public/list',
      method: 'GET',
      params,
    })
  },

  getPublicDetail: (id: string) => {
    return request<Heritage>({
      url: `/heritages/public/${id}`,
      method: 'GET',
    })
  },

  getHotHeritages: (limit: number = 10) => {
    return request<Heritage[]>({
      url: '/heritages/public/hot',
      method: 'GET',
      params: { limit },
    })
  },

  getList: (params: {
    keyword?: string
    category?: HeritageCategory
    level?: HeritageLevel
    region?: string
    page?: number
    size?: number
  }) => {
    return request<PageResult<Heritage>>({
      url: '/heritages',
      method: 'GET',
      params,
    })
  },

  getById: (id: string) => {
    return request<Heritage>({
      url: `/heritages/${id}`,
      method: 'GET',
    })
  },

  create: (data: Partial<Heritage>) => {
    return request<Heritage>({
      url: '/heritages',
      method: 'POST',
      data,
    })
  },

  update: (id: string, data: Partial<Heritage>) => {
    return request<Heritage>({
      url: `/heritages/${id}`,
      method: 'PUT',
      data,
    })
  },

  delete: (id: string) => {
    return request<void>({
      url: `/heritages/${id}`,
      method: 'DELETE',
    })
  },

  addMedia: (id: string, data: MediaFile) => {
    return request<Heritage>({
      url: `/heritages/${id}/media`,
      method: 'POST',
      data,
    })
  },
}
