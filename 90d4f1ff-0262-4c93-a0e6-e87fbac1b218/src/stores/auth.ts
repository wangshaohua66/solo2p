import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { post, get } from '@/utils/http'
import type { User, LoginRequest, LoginResponse, UserRole } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>('')
  const refreshToken = ref<string>('')
  const user = ref<User | null>(null)
  const expiresAt = ref<number>(0)

  const isAuthenticated = computed(() => {
    return !!token.value && !!user.value && Date.now() < expiresAt.value
  })

  const userRole = computed<UserRole | null>(() => user.value?.role || null)

  const hasRole = (roles: UserRole | UserRole[]): boolean => {
    if (!userRole.value) return false
    const roleList = Array.isArray(roles) ? roles : [roles]
    return roleList.includes(userRole.value)
  }

  const hasAnyRole = (roles: UserRole[]): boolean => {
    return roles.some(role => hasRole(role))
  }

  const login = async (payload: LoginRequest) => {
    const res = await post<LoginResponse>('/auth/login', payload)
    token.value = res.data.token
    refreshToken.value = res.data.refreshToken
    user.value = res.data.user
    expiresAt.value = Date.now() + res.data.expiresIn * 1000
    return res.data
  }

  const logout = () => {
    token.value = ''
    refreshToken.value = ''
    user.value = null
    expiresAt.value = 0
  }

  const refreshTokenFn = async () => {
    try {
      const res = await post<LoginResponse>('/auth/refresh', {
        refreshToken: refreshToken.value
      })
      token.value = res.data.token
      refreshToken.value = res.data.refreshToken
      user.value = res.data.user
      expiresAt.value = Date.now() + res.data.expiresIn * 1000
      return true
    } catch {
      logout()
      return false
    }
  }

  const fetchUserInfo = async () => {
    const res = await get<User>('/auth/profile')
    user.value = res.data
    return res.data
  }

  return {
    token,
    refreshToken,
    user,
    expiresAt,
    isAuthenticated,
    userRole,
    hasRole,
    hasAnyRole,
    login,
    logout,
    refreshTokenFn,
    fetchUserInfo
  }
}, {
  persist: {
    key: 'smart-parking-auth',
    paths: ['token', 'refreshToken', 'user', 'expiresAt']
  }
})
