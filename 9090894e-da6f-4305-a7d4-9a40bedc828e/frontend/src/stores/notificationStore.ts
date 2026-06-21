import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { NotificationMessage } from '@/types'

export const useNotificationStore = defineStore('notification', () => {
  const messages = ref<NotificationMessage[]>([
    {
      id: 'n1',
      type: 'exception',
      title: '通关异常预警',
      content: '申报单 CB2024001 出现HS编码归类异常，请及时处理',
      read: false,
      time: '2024-01-15 10:30:00',
      link: '/exceptions'
    },
    {
      id: 'n2',
      type: 'policy',
      title: '政策更新提醒',
      content: '您订阅的「出口退税」分类有新政策发布',
      read: false,
      time: '2024-01-15 09:15:00',
      link: '/policies'
    },
    {
      id: 'n3',
      type: 'review',
      title: '审核结果通知',
      content: '您提交的申报单 CB2024003 已审核通过',
      read: true,
      time: '2024-01-14 16:20:00',
      link: '/declarations'
    },
    {
      id: 'n4',
      type: 'system',
      title: '系统维护通知',
      content: '系统将于本周六凌晨2点-4点进行例行维护',
      read: true,
      time: '2024-01-13 08:00:00',
      link: ''
    }
  ])

  const messageCenterVisible = ref(false)

  const unreadCount = computed(() => messages.value.filter(m => !m.read).length)

  function addMessage(msg: Omit<NotificationMessage, 'id' | 'time' | 'read'>) {
    const newMsg: NotificationMessage = {
      id: `n${Date.now()}`,
      read: false,
      time: new Date().toLocaleString('zh-CN'),
      ...msg
    }
    messages.value.unshift(newMsg)
  }

  function markAsRead(id: string) {
    const msg = messages.value.find(m => m.id === id)
    if (msg) msg.read = true
  }

  function markAllAsRead() {
    messages.value.forEach(m => { m.read = true })
  }

  function clearMessages() {
    messages.value = []
  }

  function removeMessage(id: string) {
    const idx = messages.value.findIndex(m => m.id === id)
    if (idx > -1) messages.value.splice(idx, 1)
  }

  function toggleMessageCenter() {
    messageCenterVisible.value = !messageCenterVisible.value
  }

  return {
    messages,
    messageCenterVisible,
    unreadCount,
    addMessage,
    markAsRead,
    markAllAsRead,
    clearMessages,
    removeMessage,
    toggleMessageCenter
  }
})
