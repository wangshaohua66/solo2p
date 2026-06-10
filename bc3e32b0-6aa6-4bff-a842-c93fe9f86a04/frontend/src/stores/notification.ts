import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Notification } from '@/types'
import { notificationApi } from '@/api'

export const useNotificationStore = defineStore('notification', () => {
  const notifications = ref<Notification[]>([])
  const unreadCount = ref(0)
  const isLoading = ref(false)

  const unreadNotifications = computed(() => 
    notifications.value.filter(n => !n.isRead)
  )

  async function fetchUnreadCount() {
    try {
      const response: any = await notificationApi.getUnreadCount()
      unreadCount.value = response.data?.count ?? response.count ?? 0
    } catch (error) {
      console.error('Failed to fetch unread count:', error)
    }
  }

  async function fetchNotifications(params = {}) {
    isLoading.value = true
    try {
      const response: any = await notificationApi.getNotifications(params)
      const data = response.data?.items || response.items || []
      notifications.value = data
      return response.data || response
    } finally {
      isLoading.value = false
    }
  }

  async function markAsRead(id: string) {
    try {
      await notificationApi.markAsRead(id)
      const notification = notifications.value.find(n => n.id === id)
      if (notification) {
        notification.isRead = true
        unreadCount.value = Math.max(0, unreadCount.value - 1)
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  async function markAllAsRead() {
    try {
      await notificationApi.markAllAsRead()
      notifications.value.forEach(n => n.isRead = true)
      unreadCount.value = 0
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    }
  }

  function addNotification(notification: Notification) {
    notifications.value.unshift(notification)
    if (!notification.isRead) {
      unreadCount.value++
    }
  }

  function removeNotification(id: string) {
    const index = notifications.value.findIndex(n => n.id === id)
    if (index !== -1) {
      if (!notifications.value[index].isRead) {
        unreadCount.value = Math.max(0, unreadCount.value - 1)
      }
      notifications.value.splice(index, 1)
    }
  }

  return {
    notifications,
    unreadCount,
    isLoading,
    unreadNotifications,
    fetchUnreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    addNotification,
    removeNotification
  }
})
