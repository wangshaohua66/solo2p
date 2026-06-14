import { http } from './http'
import type { User } from '@/types/user'

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  token: string
  user: User
}

export const authApi = {
  login(data: LoginRequest) {
    return http.post<LoginResponse>('/auth/login', data)
  },

  logout() {
    return http.post<void>('/auth/logout')
  },

  getCurrentUser() {
    return http.get<User>('/auth/me')
  },

  refreshToken() {
    return http.post<{ token: string }>('/auth/refresh')
  }
}
