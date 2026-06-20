import { create } from 'zustand'
import { User, Project } from '@/types'

interface AppState {
  user: User | null
  currentProject: Project | null
  token: string | null
  collapsed: boolean
  setUser: (user: User | null) => void
  setCurrentProject: (project: Project | null) => void
  setToken: (token: string | null) => void
  setCollapsed: (collapsed: boolean) => void
  toggleCollapsed: () => void
  logout: () => void
  initFromStorage: () => void
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  currentProject: null,
  token: null,
  collapsed: false,

  setUser: (user) => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user))
    } else {
      localStorage.removeItem('user')
    }
    set({ user })
  },

  setCurrentProject: (project) => {
    if (project) {
      localStorage.setItem('currentProject', JSON.stringify(project))
    } else {
      localStorage.removeItem('currentProject')
    }
    set({ currentProject: project })
  },

  setToken: (token) => {
    if (token) {
      localStorage.setItem('token', token)
    } else {
      localStorage.removeItem('token')
    }
    set({ token })
  },

  setCollapsed: (collapsed) => set({ collapsed }),

  toggleCollapsed: () => set((state) => ({ collapsed: !state.collapsed })),

  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('currentProject')
    set({ user: null, token: null, currentProject: null })
  },

  initFromStorage: () => {
    const token = localStorage.getItem('token')
    const userStr = localStorage.getItem('user')
    const projectStr = localStorage.getItem('currentProject')
    const user = userStr ? JSON.parse(userStr) : null
    const currentProject = projectStr ? JSON.parse(projectStr) : null
    set({ token, user, currentProject })
  },
}))
