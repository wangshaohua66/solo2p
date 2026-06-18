import { get, post } from './request'
import type {
  HospitalAckRequest,
  HospitalAckResponse,
  HospitalNotificationItem
} from '@/types/hospital'

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

export async function acknowledgeHospitalNotification(
  request: HospitalAckRequest
): Promise<ApiResponse<HospitalAckResponse>> {
  return post('/notifications/hospital/ack', request)
}

export async function getHospitalNotifications(
  hospitalId: number,
  status: 'PENDING' | 'ACKNOWLEDGED' | 'ALL' = 'ALL'
): Promise<ApiResponse<HospitalNotificationItem[]>> {
  return get(`/notifications/hospital/${hospitalId}/list?status=${status}`)
}

export async function getMyNotifications(): Promise<ApiResponse<any[]>> {
  return get('/notifications/my')
}

export async function getUnreadNotificationCount(): Promise<ApiResponse<number>> {
  return get('/notifications/unread-count')
}

export async function markNotificationAsRead(id: number): Promise<ApiResponse<boolean>> {
  return post(`/notifications/${id}/read`)
}
