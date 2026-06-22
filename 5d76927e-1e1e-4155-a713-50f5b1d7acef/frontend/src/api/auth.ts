import { request, setToken, removeToken } from './apiClient'
import type { User, Notification, PageResult } from '@/types'

export const authApi = {
  login: async (username: string, password: string) => {
    const res = await request<{ token: string; user: User }>({
      url: '/auth/login',
      method: 'POST',
      data: { username, password },
    })
    if (res.data?.token) {
      setToken(res.data.token)
    }
    return res
  },

  register: (data: { username: string; password: string; email: string; realName?: string }) => {
    return request<User>({
      url: '/auth/register',
      method: 'POST',
      data,
    })
  },

  logout: () => {
    removeToken()
  },

  getCurrentUser: () => {
    return request<User>({
      url: '/auth/me',
      method: 'GET',
    })
  },

  updateCurrentUser: (data: Partial<User>) => {
    return request<User>({
      url: '/auth/me',
      method: 'PUT',
      data,
    })
  },

  getNotifications: (params: { page?: number; size?: number }) => {
    return request<PageResult<Notification>>({
      url: '/auth/notifications',
      method: 'GET',
      params,
    })
  },

  getUnreadCount: () => {
    return request<number>({
      url: '/auth/notifications/unread-count',
      method: 'GET',
    })
  },

  markNotificationRead: (id: string) => {
    return request<void>({
      url: `/auth/notifications/${id}/read`,
      method: 'PUT',
    })
  },

  markAllRead: () => {
    return request<void>({
      url: '/auth/notifications/read-all',
      method: 'PUT',
    })
  },
}
