import { request } from './apiClient'
import type { User, TrainingPlan, PageResult, TrainingRecord } from '@/types'

export const adminApi = {
  getDashboardStats: () => {
    return request<Record<string, unknown>>({
      url: '/admin/dashboard',
      method: 'GET',
    })
  },

  getMonthlyReport: (yearMonth: string) => {
    return request<Record<string, unknown>>({
      url: `/admin/reports/monthly/${yearMonth}`,
      method: 'GET',
    })
  },

  getAllUsers: (params: { page?: number; size?: number }) => {
    return request<PageResult<User>>({
      url: '/admin/users',
      method: 'GET',
      params,
    })
  },

  getUserById: (id: string) => {
    return request<User>({
      url: `/admin/users/${id}`,
      method: 'GET',
    })
  },

  updateUser: (id: string, data: Partial<User>) => {
    return request<User>({
      url: `/admin/users/${id}`,
      method: 'PUT',
      data,
    })
  },
}

export const trainingApi = {
  getAllPlans: (params: { page?: number; size?: number }) => {
    return request<PageResult<TrainingPlan>>({
      url: '/training/plans',
      method: 'GET',
      params,
    })
  },

  getPlansByInheritor: (inheritorId: string, params: { page?: number; size?: number }) => {
    return request<PageResult<TrainingPlan>>({
      url: `/training/plans/inheritor/${inheritorId}`,
      method: 'GET',
      params,
    })
  },

  getPlansByYear: (year: string) => {
    return request<TrainingPlan[]>({
      url: `/training/plans/year/${year}`,
      method: 'GET',
    })
  },

  getPlanById: (id: string) => {
    return request<TrainingPlan>({
      url: `/training/plans/${id}`,
      method: 'GET',
    })
  },

  generateReport: (id: string) => {
    return request<string>({
      url: `/training/plans/${id}/report`,
      method: 'GET',
    })
  },

  createPlan: (data: Partial<TrainingPlan>) => {
    return request<TrainingPlan>({
      url: '/training/plans',
      method: 'POST',
      data,
    })
  },

  updatePlan: (id: string, data: Partial<TrainingPlan>) => {
    return request<TrainingPlan>({
      url: `/training/plans/${id}`,
      method: 'PUT',
      data,
    })
  },

  deletePlan: (id: string) => {
    return request<void>({
      url: `/training/plans/${id}`,
      method: 'DELETE',
    })
  },

  addTrainingRecord: (planId: string, data: TrainingRecord) => {
    return request<TrainingPlan>({
      url: `/training/plans/${planId}/records`,
      method: 'POST',
      data,
    })
  },
}
