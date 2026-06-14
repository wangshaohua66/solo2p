import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Notification } from '@/types'
import { getNotifications, markNotificationRead } from '@/api/finance'

export const useNotificationStore = defineStore('notification', () => {
  const notifications = ref<Notification[]>([])

  const unreadCount = computed(() =>
    notifications.value.filter(n => !n.IsRead).length
  )

  const fetchNotifications = async () => {
    notifications.value = await getNotifications()
  }

  const markRead = async (id: number) => {
    await markNotificationRead(id)
    const item = notifications.value.find(n => n.ID === id)
    if (item) item.IsRead = true
  }

  const markAllRead = async () => {
    for (const n of notifications.value.filter(x => !x.IsRead)) {
      await markRead(n.ID)
    }
  }

  return {
    notifications,
    unreadCount,
    fetchNotifications,
    markRead,
    markAllRead
  }
})
