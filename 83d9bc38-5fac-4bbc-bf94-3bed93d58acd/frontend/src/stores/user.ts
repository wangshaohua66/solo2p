import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import request, { auth, extractData } from '@/api'
import type { ApiResponse } from '@/types'

export interface Role {
  id: number
  name: string
  permissions: string[]
  createdAt: string
  updatedAt: string
}

export interface Center {
  id: number
  name: string
  address: string
  description: string
  createdAt: string
  updatedAt: string
}

export interface UserInfo {
  id: number
  username: string
  name: string
  email: string
  roleId: number
  roleName: string
  centerId: number
  centerName: string
  budget: number
  advisorId?: number
  advisorName?: string
  avatar?: string
  createdAt: string
  updatedAt: string
  role?: Role
  center?: Center
  advisor?: UserInfo
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  user: UserInfo
  permissions: string[]
}

export const useUserStore = defineStore(
  'user',
  () => {
    const token = ref<string>('')
    const userInfo = ref<UserInfo | null>(null)
    const permissions = ref<string[]>([])
    const isLoggedIn = ref<boolean>(false)
    const loading = ref<boolean>(false)

    const hasPermission = computed(() => (permission: string) => {
      return permissions.value.includes(permission)
    })

    const hasAnyRole = computed(() => (roles: string[]) => {
      if (!userInfo.value?.role) return false
      return roles.includes(userInfo.value.role.name)
    })

    const isAdmin = computed(() => {
      return hasAnyRole.value(['admin', 'super_admin'])
    })

    const login = async (credentials: LoginRequest) => {
      loading.value = true
      try {
        const result = await auth.login(credentials)
        token.value = result.token
        userInfo.value = result.user as UserInfo
        permissions.value = result.permissions
        isLoggedIn.value = true
        return result
      } finally {
        loading.value = false
      }
    }

    const logout = async () => {
      loading.value = true
      try {
        await auth.logout()
      } finally {
        clearAuth()
        loading.value = false
      }
    }

    const fetchCurrentUser = async () => {
      loading.value = true
      try {
        const result = await auth.getCurrentUser()
        userInfo.value = result as UserInfo
        isLoggedIn.value = true
        return result
      } finally {
        loading.value = false
      }
    }

    const clearAuth = () => {
      token.value = ''
      userInfo.value = null
      permissions.value = []
      isLoggedIn.value = false
    }

    const updateUserInfo = async (data: Partial<UserInfo>) => {
      loading.value = true
      try {
        const response = await request.put<ApiResponse<UserInfo>>('/users/me', data)
        const result = extractData(response)
        userInfo.value = result
        return result
      } finally {
        loading.value = false
      }
    }

    return {
      token,
      userInfo,
      permissions,
      isLoggedIn,
      loading,
      hasPermission,
      hasAnyRole,
      isAdmin,
      login,
      logout,
      fetchCurrentUser,
      clearAuth,
      updateUserInfo
    }
  },
  {
    persist: {
      paths: ['token', 'userInfo']
    }
  }
)
