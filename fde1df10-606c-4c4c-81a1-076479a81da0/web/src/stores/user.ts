import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, UserRole } from '@/types'
import { login as apiLogin, getCurrentUser } from '@/api/auth'

export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null)
  const token = ref<string>(localStorage.getItem('token') || '')

  const isLoggedIn = computed(() => !!token.value)
  const userRole = computed(() => user.value?.Role)
  const userName = computed(() => user.value?.RealName || user.value?.Username)

  const hasRole = (roles: UserRole | UserRole[]) => {
    if (!user.value) return false
    const roleList = Array.isArray(roles) ? roles : [roles]
    return roleList.includes(user.value.Role)
  }

  const login = async (username: string, password: string) => {
    const res = await apiLogin({ Username: username, Password: password })
    token.value = res.token
    user.value = res.user
    localStorage.setItem('token', res.token)
    localStorage.setItem('user', JSON.stringify(res.user))
    return res
  }

  const fetchUser = async () => {
    try {
      const res = await getCurrentUser()
      user.value = res
      localStorage.setItem('user', JSON.stringify(res))
    } catch {
      logout()
    }
  }

  const logout = () => {
    token.value = ''
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  return {
    user,
    token,
    isLoggedIn,
    userRole,
    userName,
    hasRole,
    login,
    fetchUser,
    logout
  }
})
