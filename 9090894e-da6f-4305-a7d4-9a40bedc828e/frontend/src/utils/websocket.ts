import { useNotificationStore } from '@/stores/notificationStore'
import { useUserStore } from '@/stores/userStore'
import { ElNotification } from 'element-plus'

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null

const RECONNECT_DELAY = 5000
const HEARTBEAT_INTERVAL = 30000

export function useWebSocket() {
  const notificationStore = useNotificationStore()
  const userStore = useUserStore()

  function connect() {
    if (ws && ws.readyState === WebSocket.OPEN) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname === 'localhost' ? 'localhost:8000' : window.location.host
    const userId = userStore.currentUser?.id || 'guest'
    const wsUrl = `${protocol}//${host}/ws/notifications?user_id=${userId}`

    try {
      ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log('[WebSocket] 连接成功')
        startHeartbeat()
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          handleMessage(data)
        } catch (e) {
          console.error('[WebSocket] 消息解析失败', e)
        }
      }

      ws.onclose = () => {
        console.log('[WebSocket] 连接断开')
        stopHeartbeat()
        scheduleReconnect()
      }

      ws.onerror = (error) => {
        console.error('[WebSocket] 连接错误', error)
      }
    } catch (e) {
      console.error('[WebSocket] 创建连接失败', e)
      scheduleReconnect()
    }
  }

  function disconnect() {
    stopHeartbeat()
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (ws) {
      ws.close()
      ws = null
    }
  }

  function handleMessage(msg: any) {
    const type = msg.type

    switch (type) {
      case 'exception_alert':
        notificationStore.addMessage({
          type: 'exception',
          title: '通关异常预警',
          content: `申报单 ${msg.data?.declare_no || ''} 出现${msg.data?.exception_type || '通关异常'}，请及时处理`,
          link: '/exceptions'
        })
        ElNotification({
          title: '通关异常预警',
          message: `${msg.data?.declare_no} - ${msg.data?.exception_type}`,
          type: 'error',
          duration: 0,
          showClose: true
        })
        break

      case 'policy_update':
        notificationStore.addMessage({
          type: 'policy',
          title: '政策更新提醒',
          content: msg.data?.title || '有新的政策更新',
          link: '/policies'
        })
        break

      case 'review_result':
        notificationStore.addMessage({
          type: 'review',
          title: '审核结果通知',
          content: msg.data?.message || '申报单审核结果已出',
          link: '/declarations'
        })
        break

      case 'customs_status':
        notificationStore.addMessage({
          type: 'system',
          title: '通关状态更新',
          content: msg.data?.message || '申报单通关状态已更新',
          link: '/declarations'
        })
        break

      default:
        break
    }
  }

  function startHeartbeat() {
    stopHeartbeat()
    heartbeatTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, HEARTBEAT_INTERVAL)
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  function scheduleReconnect() {
    if (reconnectTimer) return
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, RECONNECT_DELAY)
  }

  function send(data: any) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data))
      return true
    }
    return false
  }

  return {
    connect,
    disconnect,
    send
  }
}
