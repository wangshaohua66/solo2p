import { request } from './axios'
import { ChangeRequest, PageResult } from '@/types'

export const changeApi = {
  getChangeList: (params: any) => {
    return request<PageResult<ChangeRequest>>({
      url: '/changes',
      method: 'get',
      params,
    })
  },

  getChange: (id: number) => {
    return request<ChangeRequest>({
      url: `/changes/${id}`,
      method: 'get',
    })
  },

  createChange: (data: Partial<ChangeRequest>) => {
    return request<ChangeRequest>({
      url: '/changes',
      method: 'post',
      data,
    })
  },

  updateChange: (id: number, data: Partial<ChangeRequest>) => {
    return request<ChangeRequest>({
      url: `/changes/${id}`,
      method: 'put',
      data,
    })
  },

  submitChange: (id: number) => {
    return request<ChangeRequest>({
      url: `/changes/${id}/submit`,
      method: 'post',
    })
  },

  approveChange: (id: number, data: { approved: boolean; comment?: string }) => {
    return request<ChangeRequest>({
      url: `/changes/${id}/approve`,
      method: 'post',
      data,
    })
  },

  deleteChange: (id: number) => {
    return request<void>({
      url: `/changes/${id}`,
      method: 'delete',
    })
  },
}
