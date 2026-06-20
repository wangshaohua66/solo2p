import { createPinia, defineStore } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import type { User } from '@/types'

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

export const useUserStore = defineStore('user', {
  state: () => ({
    userInfo: null as User | null,
    token: '' as string
  }),
  getters: {
    isLoggedIn: (state) => !!state.token,
    userRole: (state) => state.userInfo?.role || '',
    userDepartment: (state) => state.userInfo?.department || ''
  },
  actions: {
    login(userInfo: User, token: string) {
      this.userInfo = userInfo
      this.token = token
      localStorage.setItem('token', token)
      localStorage.setItem('userInfo', JSON.stringify(userInfo))
    },
    logout() {
      this.userInfo = null
      this.token = ''
      localStorage.removeItem('token')
      localStorage.removeItem('userInfo')
    },
    updateUserInfo(userInfo: Partial<User>) {
      if (this.userInfo) {
        this.userInfo = { ...this.userInfo, ...userInfo }
        localStorage.setItem('userInfo', JSON.stringify(this.userInfo))
      }
    }
  },
  persist: {
    key: 'user-store',
    storage: localStorage
  }
})

export default pinia
