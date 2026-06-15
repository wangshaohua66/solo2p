import { post, get } from './request'
import type { LoginRequest, LoginResponse, UserInfo } from '@/types/auth'

export function login(request: LoginRequest): Promise<LoginResponse> {
  return post<LoginResponse>('/auth/login', request)
}

export function getCurrentUser(): Promise<UserInfo> {
  return get<UserInfo>('/auth/me')
}
