import { get, post, put, del } from '@/utils/request'
import type { ApiResponse, UserInfo, Hospital, Notification, PaginatedResponse } from '@/types'

export const authApi = {
  login: (username: string, password: string) =>
    post<ApiResponse<{ access_token: string; refresh_token: string; user: UserInfo }>>(
      '/api/auth/login', { username, password }
    ),
  logout: () => post<ApiResponse<void>>('/api/auth/logout'),
  refresh: () => post<ApiResponse<{ access_token: string }>>('/api/auth/refresh'),
  me: () => get<ApiResponse<UserInfo>>('/api/auth/me'),
  changePassword: (old_pwd: string, new_pwd: string) =>
    post<ApiResponse<void>>('/api/auth/change-password', { old_password: old_pwd, new_password: new_pwd }),
  getHospitals: () => get<ApiResponse<Hospital[]>>('/api/auth/hospitals')
}

export const notificationApi = {
  getList: (params: { page?: number; per_page?: number; is_read?: boolean; type?: string }) =>
    get<ApiResponse<{ total: number; unread_count: number; items: Notification[] }>>('/api/auth/notifications', params),
  markRead: (id: number) => post<ApiResponse<void>>(`/api/auth/notifications/${id}/read`),
  markAllRead: () => post<ApiResponse<void>>('/api/auth/notifications/read-all')
}
