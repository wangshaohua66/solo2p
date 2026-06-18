import { ref, onMounted, onUnmounted } from 'vue'
import { notificationApi } from '@/api'
import type { Notification } from '@/types'

const notifications = ref<Notification[]>([])
const unreadCount = ref(0)
let es: EventSource | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

function connectSSE() {
  if (es) es.close()
  const token = localStorage.getItem('ws_token')
  if (!token) return
  const url = notificationApi.sseUrl()
  es = new EventSource(url)
  es.addEventListener('notification', (e: MessageEvent) => {
    try {
      const n: Notification = JSON.parse(e.data)
      notifications.value.unshift(n)
      unreadCount.value++
    } catch {
      // ignore parse errors
    }
  })
  es.onerror = () => {
    es?.close()
    es = null
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(connectSSE, 5000)
  }
}

async function refresh() {
  try {
    const [list, count] = await Promise.all([
      notificationApi.list(),
      notificationApi.unreadCount(),
    ])
    notifications.value = list
    unreadCount.value = count.count
  } catch {
    // ignore errors
  }
}

async function markRead(id: number) {
  await notificationApi.markRead(id)
  const n = notifications.value.find((x) => x.id === id)
  if (n) n.readFlag = true
  unreadCount.value = Math.max(0, unreadCount.value - 1)
}

async function markAllRead() {
  await notificationApi.markAllRead()
  notifications.value.forEach((n) => (n.readFlag = true))
  unreadCount.value = 0
}

export function useNotifications() {
  onMounted(() => {
    refresh()
    connectSSE()
  })
  onUnmounted(() => {
    if (es) es.close()
    if (reconnectTimer) clearTimeout(reconnectTimer)
  })
  return { notifications, unreadCount, refresh, markRead, markAllRead }
}
