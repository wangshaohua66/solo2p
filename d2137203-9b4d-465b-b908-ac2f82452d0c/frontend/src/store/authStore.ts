import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import axios from 'axios'
import type { User } from '@/types'

interface AuthState {
  token: string | null
  user: User | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  checkAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      login: async (username: string, password: string) => {
        const response = await axios.post('/api/auth/login', {
          username,
          password,
        })
        if (response.data.code === 0) {
          set({
            token: response.data.data.token,
            user: response.data.data.user,
          })
          axios.defaults.headers.common[
            'Authorization'
          ] = `Bearer ${response.data.data.token}`
        } else {
          throw new Error(response.data.message)
        }
      },
      logout: () => {
        set({ token: null, user: null })
        delete axios.defaults.headers.common['Authorization']
      },
      checkAuth: () => {
        const token = useAuthStore.getState().token
        if (token) {
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
        }
      },
    }),
    {
      name: 'auth-storage',
    }
  )
)
