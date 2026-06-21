import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, UserRole } from '@/types'

const roleNameMap: Record<UserRole, string> = {
  declarant: '企业申报员',
  reviewer: '运营中心审核员',
  admin: '中心管理员'
}

export const useUserStore = defineStore('user', () => {
  const currentUser = ref<User | null>(null)
  const token = ref<string>(localStorage.getItem('token') || '')
  const permissions = ref<string[]>([])

  const isLoggedIn = computed(() => !!token.value && !!currentUser.value)
  const role = computed(() => currentUser.value?.role || null)
  const roleName = computed(() => (currentUser.value ? roleNameMap[currentUser.value.role] : ''))

  function setUser(user: User) {
    currentUser.value = user
    permissions.value = user.permissions || []
  }

  function setToken(t: string) {
    token.value = t
    localStorage.setItem('token', t)
  }

  function logout() {
    currentUser.value = null
    token.value = ''
    permissions.value = []
    localStorage.removeItem('token')
  }

  function hasPermission(permission: string) {
    if (currentUser.value?.role === 'admin') return true
    return permissions.value.includes(permission)
  }

  function hasRole(roleCheck: UserRole | UserRole[]) {
    if (!currentUser.value) return false
    if (Array.isArray(roleCheck)) {
      return roleCheck.includes(currentUser.value.role)
    }
    return currentUser.value.role === roleCheck
  }

  function mockLogin(role: UserRole = 'declarant') {
    const mockUsers: Record<UserRole, User> = {
      declarant: {
        id: '1',
        username: 'declarant001',
        name: '张申报员',
        email: 'zhang@company.com',
        role: 'declarant',
        enterpriseName: '杭州跨境贸易有限公司',
        permissions: ['declaration:read', 'declaration:write', 'hs:search', 'tax:calculate', 'policy:read']
      },
      reviewer: {
        id: '2',
        username: 'reviewer001',
        name: '李审核员',
        email: 'li@service.gov.cn',
        role: 'reviewer',
        permissions: ['declaration:read', 'declaration:review', 'hs:search', 'tax:calculate', 'exception:handle', 'policy:read']
      },
      admin: {
        id: '3',
        username: 'admin001',
        name: '王管理员',
        email: 'wang@service.gov.cn',
        role: 'admin',
        permissions: ['*']
      }
    }
    setUser(mockUsers[role])
    setToken('mock_token_' + role)
  }

  return {
    currentUser,
    token,
    permissions,
    isLoggedIn,
    role,
    roleName,
    setUser,
    setToken,
    logout,
    hasPermission,
    hasRole,
    mockLogin
  }
})
