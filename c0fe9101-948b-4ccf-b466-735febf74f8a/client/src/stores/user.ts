import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserInfo, UserRole, Hospital, Notification } from '@/types'
import { authApi, notificationApi } from '@/api'

export const useUserStore = defineStore('user', () => {
  const accessToken = ref<string>('')
  const refreshToken = ref<string>('')
  const userInfo = ref<UserInfo | null>(null)
  const currentHospital = ref<Hospital | null>(null)
  const hospitals = ref<Hospital[]>([])
  const sidebarCollapsed = ref<boolean>(false)
  const notifications = ref<Notification[]>([])
  const unreadCount = ref(0)
  const isMobile = ref(window.innerWidth < 768)

  const isLoggedIn = computed(() => !!accessToken.value && !!userInfo.value)
  const hasRole = (roles: UserRole | UserRole[]) => {
    if (!userInfo.value) return false
    const arr = Array.isArray(roles) ? roles : [roles]
    return arr.includes(userInfo.value.role)
  }
  const isDirector = computed(() => hasRole('director'))
  const isManager = computed(() => hasRole(['director', 'manager']))
  const isDoctor = computed(() => hasRole('doctor'))
  const isLabTech = computed(() => hasRole('lab_tech'))
  const isPharmacist = computed(() => hasRole('pharmacist'))
  const isNurse = computed(() => hasRole('nurse'))

  async function login(username: string, password: string) {
    const res = await authApi.login(username, password)
    if (res.code === 200 && res.data) {
      accessToken.value = res.data.access_token
      refreshToken.value = res.data.refresh_token
      userInfo.value = res.data.user
      await loadHospitals()
      if (userInfo.value?.hospital_id) {
        currentHospital.value = hospitals.value.find(h => h.id === userInfo.value?.hospital_id) || null
      }
      await loadNotifications()
      return true
    }
    return false
  }

  async function logout() {
    try { await authApi.logout() } catch {}
    accessToken.value = ''
    refreshToken.value = ''
    userInfo.value = null
    currentHospital.value = null
    notifications.value = []
    unreadCount.value = 0
  }

  async function refresh() {
    try {
      const res = await authApi.refresh()
      if (res.code === 200 && res.data) {
        accessToken.value = res.data.access_token
        return true
      }
    } catch {}
    return false
  }

  async function loadUserInfo() {
    const res = await authApi.me()
    if (res.code === 200 && res.data) {
      userInfo.value = res.data
    }
  }

  async function loadHospitals() {
    const res = await authApi.getHospitals()
    if (res.code === 200 && res.data) {
      hospitals.value = res.data
    }
  }

  async function loadNotifications(page = 1, perPage = 20) {
    const res = await notificationApi.getList({ page, per_page: perPage, is_read: false })
    if (res.code === 200 && res.data) {
      notifications.value = res.data.items
      unreadCount.value = res.data.unread_count || 0
    }
  }

  async function markNotificationRead(id: number) {
    const res = await notificationApi.markRead(id)
    if (res.code === 200) {
      const item = notifications.value.find(n => n.id === id)
      if (item) item.is_read = true
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    }
  }

  async function markAllRead() {
    const res = await notificationApi.markAllRead()
    if (res.code === 200) {
      notifications.value.forEach(n => n.is_read = true)
      unreadCount.value = 0
    }
  }

  function setCurrentHospital(hospital: Hospital | null) {
    currentHospital.value = hospital
  }

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function updateIsMobile(val: boolean) {
    isMobile.value = val
  }

  return {
    accessToken, refreshToken, userInfo, currentHospital, hospitals,
    sidebarCollapsed, notifications, unreadCount, isMobile,
    isLoggedIn, hasRole, isDirector, isManager, isDoctor, isLabTech, isPharmacist, isNurse,
    login, logout, refresh, loadUserInfo, loadHospitals,
    loadNotifications, markNotificationRead, markAllRead,
    setCurrentHospital, toggleSidebar, updateIsMobile
  }
}, {
  persist: {
    key: 'pet-med-user',
    paths: ['accessToken', 'refreshToken', 'userInfo', 'currentHospital']
  }
})
