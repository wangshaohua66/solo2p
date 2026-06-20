import { get, post, put, del } from '@/utils/request'
import type { Copyright, WorkloadStats, PageResult } from '@/types'

export function getCopyrightList(params: {
  page: number
  pageSize: number
  status?: Copyright['status']
  keyword?: string
}) {
  return get<PageResult<Copyright>>('/copyrights', { params })
}

export function getCopyrightDetail(id: number) {
  return get<Copyright>(`/copyrights/${id}`)
}

export function createCopyright(data: Partial<Copyright>) {
  return post<Copyright>('/copyrights', data)
}

export function updateCopyright(id: number, data: Partial<Copyright>) {
  return put<Copyright>(`/copyrights/${id}`, data)
}

export function deleteCopyright(id: number) {
  return del(`/copyrights/${id}`)
}

export function getExpiringCopyrights(days: number = 7) {
  return get<Copyright[]>(`/copyrights/expiring?days=${days}`)
}

export function getCopyrightStats() {
  return get<{
    total: number
    active: number
    expiring: number
    expired: number
    totalCost: number
  }>('/copyrights/stats')
}

export function getWorkloadStats(params: {
  startDate: string
  endDate: string
  groupBy: 'department' | 'user'
  department?: string
  userId?: number
}) {
  return get<WorkloadStats[]>('/statistics/workload', { params })
}

export function getProductionStats(params: {
  startDate: string
  endDate: string
}) {
  return get<{
    topicCount: number
    materialCount: number
    programCount: number
    totalDuration: number
    byType: Record<string, number>
    byChannel: Record<string, number>
  }>('/statistics/production', { params })
}

export function getEfficiencyStats(params: {
  startDate: string
  endDate: string
}) {
  return get<{
    avgReviewTime: number
    avgProductionCycle: number
    passRate: number
    rejectionRate: number
  }>('/statistics/efficiency', { params })
}
