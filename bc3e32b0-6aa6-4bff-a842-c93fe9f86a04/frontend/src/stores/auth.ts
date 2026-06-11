import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, LoginRequest, LoginResponse } from '@/types'
import { authApi } from '@/api/auth'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>('')
  const refreshToken = ref<string>('')
  const user = ref<User | null>(null)
  const tokenExpireTime = ref<number>(0)

  const isLoggedIn = computed(() => !!token.value && !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const isInstructor = computed(() => user.value?.role === 'instructor' || user.value?.role === 'admin')
  const userRole = computed(() => user.value?.role || 'guest')

  async function login(credentials: LoginRequest) {
    const response = await authApi.login(credentials) as any
    if (response.accessToken || response.data?.accessToken) {
      const data = response.data || response
      token.value = data.accessToken
      refreshToken.value = data.refreshToken
      user.value = data.user
      tokenExpireTime.value = Date.now() + (data.expiresIn || 7200) * 1000
    }
    return response
  }

  async function refreshTokenFn() {
    if (!refreshToken.value) return null
    try {
      const response = await authApi.refreshToken(refreshToken.value) as any
      const data = response.data || response
      token.value = data.accessToken
      refreshToken.value = data.refreshToken
      tokenExpireTime.value = Date.now() + (data.expiresIn || 7200) * 1000
      if (data.user) {
        user.value = data.user
      }
      return data
    } catch (error) {
      logout()
      throw error
    }
  }

  function logout() {
    token.value = ''
    refreshToken.value = ''
    user.value = null
    tokenExpireTime.value = 0
  }

  async function fetchCurrentUser() {
    try {
      const response = await authApi.getCurrentUser() as any
      user.value = response.data || response
      return user.value
    } catch (error) {
      console.error('Failed to fetch current user:', error)
      return null
    }
  }

  function updateUser(userData: Partial<User>) {
    if (user.value) {
      user.value = { ...user.value, ...userData }
    }
  }

  return {
    token,
    refreshToken,
    user,
    tokenExpireTime,
    isLoggedIn,
    isAdmin,
    isInstructor,
    userRole,
    login,
    doRefreshToken: refreshTokenFn,
    logout,
    fetchCurrentUser,
    updateUser
  }
}, {
  persist: {
    key: 'pottery_auth',
    paths: ['token', 'refreshToken', 'user', 'tokenExpireTime']
  }
})
