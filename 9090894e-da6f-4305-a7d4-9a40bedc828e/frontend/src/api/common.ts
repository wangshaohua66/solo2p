import request from '@/utils/request'
import type { DashboardStats, CustomsException, Policy, User } from '@/types'

export function getDashboardStats(params?: { startDate?: string; endDate?: string }) {
  return request.get<DashboardStats>('/dashboard/stats', { params })
}

export function exportDashboardData(params: { format: string; startDate?: string; endDate?: string }) {
  return request.get('/dashboard/export', { params, responseType: 'blob' })
}

export function getCustomsExceptions(params?: { status?: string; page?: number; pageSize?: number }) {
  return request.get<{ list: CustomsException[]; total: number }>('/customs/exceptions', { params })
}

export function getExceptionDetail(id: string) {
  return request.get<CustomsException>(`/customs/exceptions/${id}`)
}

export function handleException(id: string, data: { suggestion: string; actions: string[] }) {
  return request.post(`/customs/exceptions/${id}/handle`, data)
}

export function searchExceptionKnowledge(keyword: string) {
  return request.get<{ id: string; title: string; content: string; solution: string }[]>(
    '/customs/knowledge/search',
    { params: { keyword } }
  )
}

export function getPolicies(params?: {
  category?: string
  keyword?: string
  page?: number
  pageSize?: number
}) {
  return request.get<{ list: Policy[]; total: number }>('/policies', { params })
}

export function getPolicyDetail(id: string) {
  return request.get<Policy>(`/policies/${id}`)
}

export function searchPolicies(keyword: string) {
  return request.get<Policy[]>('/policies/search', { params: { keyword } })
}

export function getCurrentUser() {
  return request.get<User>('/auth/me')
}

export function login(data: { username: string; password: string }) {
  return request.post<{ token: string; user: User }>('/auth/login', data)
}
