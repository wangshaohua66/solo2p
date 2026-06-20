import request from '@/utils/request'
import type { Community, GroupLeader, ResidentUser } from '@/types'

export const communityApi = {
  getPage: (params: any) => request.get('/community/page', { params }),
  getList: () => request.get('/community/list'),
  getDetail: (id: number) => request.get(`/community/${id}`),
  add: (data: Community) => request.post('/community', data),
  update: (data: Community) => request.put('/community', data),
  delete: (id: number) => request.delete(`/community/${id}`)
}

export const leaderApi = {
  getPage: (params: any) => request.get('/leader/page', { params }),
  getList: () => request.get('/leader/list'),
  getDetail: (id: number) => request.get(`/leader/${id}`),
  getByCommunity: (communityId: number) => request.get(`/leader/community/${communityId}`),
  add: (data: GroupLeader) => request.post('/leader', data),
  update: (data: GroupLeader) => request.put('/leader', data),
  delete: (id: number) => request.delete(`/leader/${id}`)
}

export const userApi = {
  getPage: (params: any) => request.get('/user/page', { params }),
  getDetail: (id: number) => request.get(`/user/${id}`),
  add: (data: ResidentUser) => request.post('/user', data),
  update: (data: ResidentUser) => request.put('/user', data),
  delete: (id: number) => request.delete(`/user/${id}`)
}

export const dashboardApi = {
  getOverview: () => request.get('/dashboard/overview'),
  getSalesTrend: (params: { dimension: string; startDate?: string; endDate?: string }) => request.get('/dashboard/sales-trend', { params }),
  getTopProducts: (limit = 50) => request.get('/dashboard/top-products', { params: { limit } }),
  getCommunityComparison: () => request.get('/dashboard/community-comparison'),
  getInventoryWarning: () => request.get('/dashboard/inventory-warning'),
  getCategoryDistribution: () => request.get('/dashboard/category-distribution')
}
