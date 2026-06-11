import http from './http'
import type {
  User,
  PagedResult,
  PagedQuery
} from '@/types'

export const memberApi = {
  getMembers(params?: {
    tier?: string
    keyword?: string
  } & PagedQuery): Promise<PagedResult<User>> {
    return http.get('/members', { params })
  },

  getMember(id: string): Promise<User> {
    return http.get(`/members/${id}`)
  },

  createMember(data: Partial<User>): Promise<User> {
    return http.post('/members', data)
  },

  updateMember(id: string, data: Partial<User>): Promise<User> {
    return http.put(`/members/${id}`, data)
  },

  deleteMember(id: string): Promise<void> {
    return http.delete(`/members/${id}`)
  },

  updateTier(id: string, tier: string, durationMonths?: number): Promise<User> {
    return http.post(`/members/${id}/upgrade`, { tier, durationMonths })
  },

  addConsumption(id: string, amount: number, description?: string): Promise<User> {
    return http.post(`/members/${id}/consumption`, { amount, description })
  },

  addPoints(id: string, points: number, reason?: string): Promise<User> {
    return http.post(`/members/${id}/points`, { points, reason })
  },

  getTierThresholds(): Promise<{ tier: string; name: string; minTotalSpent: number }[]> {
    return http.get('/members/benefits')
  },

  getMyProfile(): Promise<User> {
    return http.get('/members/me')
  },

  getMemberPieces(memberId: string, params?: PagedQuery): Promise<PagedResult<any>> {
    return http.get(`/members/${memberId}/pieces`, { params })
  },

  getMemberCourses(memberId: string): Promise<any[]> {
    return http.get(`/members/${memberId}/courses`)
  },

  getMemberOrders(memberId: string, params?: PagedQuery): Promise<PagedResult<any>> {
    return http.get(`/members/${memberId}/orders`, { params })
  },

  getMemberPointsHistory(memberId: string, params?: PagedQuery): Promise<PagedResult<any>> {
    return http.get(`/members/${memberId}/points-history`, { params })
  },

  getMemberGrowth(): Promise<{ months: string[]; members: number[]; newMembers: number[] }> {
    return http.get('/members/growth')
  }
}
