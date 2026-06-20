import { request } from './axios'
import { User, PageResult } from '@/types'

export const userApi = {
  login: (username: string, password: string) => {
    return request<{ token: string; user: User }>({
      url: '/auth/login',
      method: 'post',
      data: { username, password },
    })
  },

  logout: () => {
    return request<void>({
      url: '/auth/logout',
      method: 'post',
    })
  },

  getCurrentUser: () => {
    return request<User>({
      url: '/users/me',
      method: 'get',
    })
  },

  getUserList: (params?: any) => {
    return request<PageResult<User>>({
      url: '/users',
      method: 'get',
      params,
    })
  },

  getUsersByRole: (role: string) => {
    return request<User[]>({
      url: '/users/role',
      method: 'get',
      params: { role },
    })
  },

  getUsersByProfession: (profession: string) => {
    return request<User[]>({
      url: '/users/profession',
      method: 'get',
      params: { profession },
    })
  },

  getUser: (id: number) => {
    return request<User>({
      url: `/users/${id}`,
      method: 'get',
    })
  },

  createUser: (data: Partial<User>) => {
    return request<User>({
      url: '/users',
      method: 'post',
      data,
    })
  },

  updateUser: (id: number, data: Partial<User>) => {
    return request<User>({
      url: `/users/${id}`,
      method: 'put',
      data,
    })
  },

  deleteUser: (id: number) => {
    return request<void>({
      url: `/users/${id}`,
      method: 'delete',
    })
  },
}
