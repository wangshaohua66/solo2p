import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login, getCurrentUser } from '@/api/auth'
import type { UserInfo, LoginRequest, LoginResponse } from '@/types/auth'

export const useUserStore = defineStore('user', () => {
  const token = ref<string | null>(localStorage.getItem('token'))
  const user = ref<UserInfo | null>(null)

  const isLoggedIn = computed(() => !!token.value)

  async function doLogin(request: LoginRequest): Promise<LoginResponse> {
    const response = await login(request)
    token.value = response.accessToken
    localStorage.setItem('token', response.accessToken)
    user.value = {
      username: response.username,
      realName: response.realName,
      role: response.role
    }
    return response
  }

  async function fetchCurrentUser() {
    if (!token.value) return
    try {
      user.value = await getCurrentUser()
    } catch {
      logout()
    }
  }

  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem('token')
  }

  return {
    token,
    user,
    isLoggedIn,
    doLogin,
    fetchCurrentUser,
    logout
  }
})
