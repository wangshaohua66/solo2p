import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '@/types/user'
import { UserRole } from '@/types/user'
import { authApi, type LoginRequest } from '@/api/auth'
import { wsService } from '@/utils/websocket'
import { jwtDecode } from 'jwt-decode'

export const useAuthStore = defineStore(
  'auth',
  () => {
    const token = ref<string>('')
    const user = ref<User | null>(null)
    const isLoading = ref(false)

    const isAuthenticated = computed(() => !!token.value && !!user.value)
    const isProjectManager = computed(() => user.value?.role === UserRole.PROJECT_MANAGER)
    const isDesigner = computed(() => user.value?.role === UserRole.DESIGNER)
    const isReviewer = computed(() => user.value?.role === UserRole.REVIEWER)

    async function login(credentials: LoginRequest) {
      isLoading.value = true
      try {
        const response = await authApi.login(credentials)
        token.value = (response as any).token || response.data?.token || ''
        user.value = (response as any).user || response.data?.user || null
        if (token.value) {
          wsService.connect(token.value)
        }
        return true
      } finally {
        isLoading.value = false
      }
    }

    async function fetchCurrentUser() {
      if (!token.value) return
      try {
        const result = await authApi.getCurrentUser()
        user.value = (result as any).data || result
      } catch {
        logout()
      }
    }

    function setToken(newToken: string) {
      token.value = newToken
      if (newToken) {
        try {
          const decoded = jwtDecode<any>(newToken)
          if (decoded.userId) {
            wsService.connect(newToken)
          }
        } catch {}
      }
    }

    function logout() {
      token.value = ''
      user.value = null
      wsService.disconnect()
    }

    function hasPermission(action: string, resource?: string): boolean {
      if (!user.value) return false
      if (isProjectManager.value) return true

      const rolePermissions: Record<UserRole, string[]> = {
        [UserRole.PROJECT_MANAGER]: [
          'project:create',
          'project:update',
          'project:delete',
          'project:assign',
          'document:upload',
          'document:delete',
          'document:download',
          'document:manage_versions',
          'annotation:create',
          'annotation:update',
          'annotation:delete',
          'review:approve',
          'review:finalize'
        ],
        [UserRole.DESIGNER]: [
          'document:upload',
          'document:manage_versions',
          'document:download',
          'annotation:view',
          'annotation:reply'
        ],
        [UserRole.REVIEWER]: [
          'document:view',
          'document:download',
          'annotation:create',
          'annotation:update',
          'annotation:reply',
          'review:approve'
        ]
      }

      return rolePermissions[user.value.role]?.includes(action) ?? false
    }

    return {
      token,
      user,
      isLoading,
      isAuthenticated,
      isProjectManager,
      isDesigner,
      isReviewer,
      login,
      fetchCurrentUser,
      setToken,
      logout,
      hasPermission
    }
  },
  {
    persist: {
      key: 'blueprint_auth',
      paths: ['token', 'user']
    }
  }
)
