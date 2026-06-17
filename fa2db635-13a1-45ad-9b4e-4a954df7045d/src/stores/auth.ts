import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api'
import type { User } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(localStorage.getItem('ws_token') || '')
  const user = ref<User | null>(JSON.parse(localStorage.getItem('ws_user') || 'null'))
  const isSupplier = ref<boolean>(localStorage.getItem('ws_supplier') === '1')

  const isLoggedIn = computed(() => !!token.value)
  const roleLabel = computed(() => {
    if (!user.value) return ''
    const map: Record<string, string> = {
      ADMIN: '集团管理员',
      OPERATOR: '门店运营',
      PLANNER: '策划师',
      FINANCE: '财务人员',
      SUPPLIER: '供应商',
    }
    return map[user.value.role] || ''
  })

  async function login(username: string, password: string, role: string) {
    const res = await authApi.login({ username, password, role })
    token.value = res.token
    user.value = res.user
    isSupplier.value = false
    localStorage.setItem('ws_token', res.token)
    localStorage.setItem('ws_user', JSON.stringify(res.user))
    localStorage.removeItem('ws_supplier')
    return res.user
  }

  async function supplierLogin(phone: string, code: string) {
    const res = await authApi.supplierLogin({ phone, code })
    token.value = res.token
    isSupplier.value = true
    user.value = { id: res.supplier.id, name: res.supplier.name, role: 'SUPPLIER', storeId: res.supplier.storeId }
    localStorage.setItem('ws_token', res.token)
    localStorage.setItem('ws_supplier', '1')
    localStorage.setItem('ws_user', JSON.stringify(user.value))
    return res.supplier
  }

  function logout() {
    token.value = ''
    user.value = null
    isSupplier.value = false
    localStorage.removeItem('ws_token')
    localStorage.removeItem('ws_user')
    localStorage.removeItem('ws_supplier')
  }

  return { token, user, isSupplier, isLoggedIn, roleLabel, login, supplierLogin, logout }
})
