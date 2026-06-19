import request from '@/utils/request'
import { UserInfo, UserRole, PageResult } from '@/types'

interface LoginParams {
  username: string
  password: string
  role: UserRole
}

interface LoginResponse {
  token: string
  userInfo: UserInfo
}

export const login = (params: LoginParams) => {
  return request.post<LoginResponse>('/auth/login', params)
}

export const getUserInfo = () => {
  return request.get<UserInfo>('/auth/userinfo')
}

export const logout = () => {
  return request.post<void>('/auth/logout')
}

export const updatePassword = (params: { oldPassword: string; newPassword: string }) => {
  return request.put<void>('/auth/password', params)
}
