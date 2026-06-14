import request from '@/utils/request'
import type { User, LoginResponse } from '@/types'

export const login = (data: { Username: string; Password: string }) => {
  return request.post<any, LoginResponse>('/auth/login', data)
}

export const register = (data: any) => {
  return request.post<any, any>('/auth/register', data)
}

export const getCurrentUser = () => {
  return request.get<any, User>('/auth/me')
}
