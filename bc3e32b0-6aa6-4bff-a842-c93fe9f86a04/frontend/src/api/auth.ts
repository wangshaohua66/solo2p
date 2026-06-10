import http from './http'
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  User,
  MemberTierBenefit,
  PagedResult,
  PagedQuery
} from '@/types'

export const authApi = {
  login(data: LoginRequest): Promise<LoginResponse> {
    return http.post('/auth/login', data)
  },

  register(data: RegisterRequest): Promise<User> {
    return http.post('/auth/register', data)
  },

  refreshToken(refreshToken: string): Promise<LoginResponse> {
    return http.post('/auth/refresh', { refreshToken })
  },

  logout(): Promise<void> {
    return http.post('/auth/logout')
  },

  getCurrentUser(): Promise<User> {
    return http.get('/auth/me')
  },

  updateProfile(data: Partial<User>): Promise<User> {
    return http.put('/auth/profile', data)
  },

  changePassword(oldPassword: string, newPassword: string): Promise<void> {
    return http.put('/auth/password', { oldPassword, newPassword })
  }
}

export const memberApi = {
  getMembers(params?: PagedQuery): Promise<PagedResult<User>> {
    return http.get('/members', { params })
  },

  getMember(id: string): Promise<User> {
    return http.get(`/members/${id}`)
  },

  createMember(data: Partial<User> & { password: string }): Promise<User> {
    return http.post('/members', data)
  },

  updateMember(id: string, data: Partial<User>): Promise<User> {
    return http.put(`/members/${id}`, data)
  },

  deleteMember(id: string): Promise<void> {
    return http.delete(`/members/${id}`)
  },

  getTierBenefits(): Promise<MemberTierBenefit[]> {
    return http.get('/members/tiers')
  },

  upgradeTier(memberId: string, tier: string, duration: number): Promise<User> {
    return http.post(`/members/${memberId}/upgrade`, { tier, duration })
  },

  getMemberPieces(memberId: string, params?: PagedQuery): Promise<PagedResult<any>> {
    return http.get(`/members/${memberId}/pieces`, { params })
  },

  getMemberCourses(memberId: string, params?: PagedQuery): Promise<PagedResult<any>> {
    return http.get(`/members/${memberId}/courses`, { params })
  },

  getMemberPoints(memberId: string): Promise<{ points: number; totalHours: number }> {
    return http.get(`/members/${memberId}/points`)
  }
}
