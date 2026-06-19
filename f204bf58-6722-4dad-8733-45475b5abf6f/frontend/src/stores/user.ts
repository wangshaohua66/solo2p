import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '@/types'
import { authApi, userApi } from '@/api/modules'
import { setToken, removeToken } from '@/api'
import router from '@/router'

export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null)
  const token = ref<string>('')
  const loading = ref(false)

  const isLoggedIn = computed(() => !!token && !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const isPartner = computed(() => ['admin', 'partner'].includes(user.value?.role || ''))
  const isLawyer = computed(() => ['admin', 'partner', 'lawyer'].includes(user.value?.role || ''))
  const fullName = computed(() => user.value?.full_name || user.value?.username || '')

  async function login(username: string, password: string) {
    const res = await authApi.login(username, password)
    setToken(res.data.access, res.data.refresh)
    token.value = res.data.access
    user.value = res.data.user
    return res.data
  }

  async function fetchUserInfo() {
    const res = await userApi.me()
    user.value = res.data
    return res.data
  }

  function logout() {
    removeToken()
    user.value = null
    token.value = ''
    router.push('/login')
  }

  async function changePassword(data: { old_password: string; new_password: string; confirm_password: string }) {
    if (!user.value) {
      await userApi.changePassword(user.value.id, data)
    }
  }

  function updateUser(data: Partial<User>) {
    if (user.value) {
      user.value = { ...user.value, ...data }
    }
  }

  return {
    user, token, loading,
    isLoggedIn, isAdmin, isPartner, isLawyer, fullName,
    login, fetchUserInfo, logout, changePassword, updateUser
  }
})
