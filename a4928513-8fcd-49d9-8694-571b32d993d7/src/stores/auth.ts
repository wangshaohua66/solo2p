import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserInfo } from '@/types/common'
import { setToken, setUser, clearAuth, getToken, getUser } from '@/utils/storage'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(getToken())
  const userInfo = ref<UserInfo | null>(getUser<UserInfo>())

  const isLoggedIn = computed(() => !!token.value)
  const isAdmin = computed(() => userInfo.value?.role === 'admin')

  function login(username: string, password: string, _role?: string) {
    return new Promise<UserInfo>((resolve) => {
      setTimeout(() => {
        const users: Record<string, UserInfo> = {
          admin: {
            id: 'U001',
            username: 'admin',
            name: '系统管理员',
            role: 'admin',
            phone: '13900000000',
            department: '信息科',
            token: 'mock-token-admin-' + Date.now()
          },
          staff: {
            id: 'U002',
            username: 'staff',
            name: '殡仪员张三',
            role: 'funeral_attendant',
            phone: '13900000001',
            department: '第一殡仪馆殡仪组',
            token: 'mock-token-staff-' + Date.now()
          }
        }
        const user = users[username] || users.staff
        token.value = user.token
        userInfo.value = user
        setToken(user.token)
        setUser(user)
        resolve(user)
      }, 500)
    })
  }

  function logout() {
    token.value = ''
    userInfo.value = null
    clearAuth()
  }

  return {
    token,
    userInfo,
    isLoggedIn,
    isAdmin,
    login,
    logout
  }
})
