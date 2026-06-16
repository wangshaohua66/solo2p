import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

export interface Notification {
  id: number
  userId: number
  type: string
  title: string
  content: string
  isRead: boolean
  createdAt: string
}

export interface UnreadCount {
  unreadCount: number
  bookingCount: number
  maintenanceCount: number
  billingCount: number
}

export const useNotificationStore = defineStore('notification', () => {
  const notifications = ref<Notification[]>([])
  const unreadCount = ref<UnreadCount>({
    unreadCount: 0,
    bookingCount: 0,
    maintenanceCount: 0,
    billingCount: 0
  })
  const loading = ref<boolean>(false)

  const unreadNotifications = computed(() => {
    return notifications.value.filter(n => !n.isRead)
  })

  const sortedNotifications = computed(() => {
    return [...notifications.value].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  })

  const fetchNotifications = async (params?: { page?: number; pageSize?: number; isRead?: boolean }) => {
    loading.value = true
    try {
      const response = await axios.get<Notification[]>('/api/notifications', { params })
      notifications.value = response.data
      return response.data
    } finally {
      loading.value = false
    }
  }

  const fetchUnreadCount = async () => {
    loading.value = true
    try {
      const response = await axios.get<UnreadCount>('/api/notifications/unread-count')
      unreadCount.value = response.data
      return response.data
    } finally {
      loading.value = false
    }
  }

  const markAsRead = async (id: number) => {
    loading.value = true
    try {
      await axios.patch(`/api/notifications/${id}/read`)
      const notification = notifications.value.find(n => n.id === id)
      if (notification) {
        notification.isRead = true
      }
      if (unreadCount.value.unreadCount > 0) {
        unreadCount.value.unreadCount--
      }
    } finally {
      loading.value = false
    }
  }

  const markAllAsRead = async () => {
    loading.value = true
    try {
      await axios.patch('/api/notifications/read-all')
      notifications.value.forEach(n => {
        n.isRead = true
      })
      unreadCount.value = {
        unreadCount: 0,
        bookingCount: 0,
        maintenanceCount: 0,
        billingCount: 0
      }
    } finally {
      loading.value = false
    }
  }

  return {
    notifications,
    unreadCount,
    loading,
    unreadNotifications,
    sortedNotifications,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead
  }
})
