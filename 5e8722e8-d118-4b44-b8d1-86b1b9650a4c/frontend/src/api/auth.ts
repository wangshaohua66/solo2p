import request from '@/utils/request'

export function login(data: { username: string; password: string }) {
  return request({
    url: '/auth/login',
    method: 'post',
    data,
  })
}

export function register(data: any) {
  return request({
    url: '/auth/register',
    method: 'post',
    data,
  })
}

export function getCurrentUser() {
  return request({
    url: '/auth/me',
    method: 'get',
  })
}

export function logout() {
  return request({
    url: '/auth/logout',
    method: 'post',
  })
}

export function refreshToken() {
  return request({
    url: '/auth/refresh',
    method: 'post',
  })
}
