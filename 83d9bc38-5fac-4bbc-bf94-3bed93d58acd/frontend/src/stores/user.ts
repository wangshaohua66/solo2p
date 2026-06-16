import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

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
  centerId: number
  budget: number
  advisorId?: number
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
      return hasAnyRole.value(['admin', 'superadmin'])
    })

    const login = async (credentials: LoginRequest) => {
      loading.value = true
      try {
        const response = await axios.post<LoginResponse>('/api/auth/login', credentials)
        token.value = response.data.token
        userInfo.value = response.data.user
        permissions.value = response.data.permissions
        isLoggedIn.value = true
        axios.defaults.headers.common['Authorization'] = `Bearer ${token.value}`
        return response.data
      } finally {
        loading.value = false
      }
    }

    const logout = async () => {
      loading.value = true
      try {
        await axios.post('/api/auth/logout')
      } finally {
        clearAuth()
        loading.value = false
      }
    }

    const fetchCurrentUser = async () => {
      loading.value = true
      try {
        const response = await axios.get<UserInfo>('/api/auth/me')
        userInfo.value = response.data
        isLoggedIn.value = true
        return response.data
      } finally {
        loading.value = false
      }
    }

    const clearAuth = () => {
      token.value = ''
      userInfo.value = null
      permissions.value = []
      isLoggedIn.value = false
      delete axios.defaults.headers.common['Authorization']
    }

    const updateUserInfo = async (data: Partial<UserInfo>) => {
      loading.value = true
      try {
        const response = await axios.put<UserInfo>('/api/users/me', data)
        userInfo.value = response.data
        return response.data
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
