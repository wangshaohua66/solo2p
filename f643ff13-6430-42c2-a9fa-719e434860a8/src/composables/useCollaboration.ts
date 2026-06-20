import { ref, getCurrentInstance, onUnmounted } from 'vue'
import type { 
  CollaborationAction, 
  CollaborationUser, 
  WebSocketMessage,
  WebSocketMessageType,
  Role
} from '@/types'
import { generateId } from '@/utils/storage'

const DEFAULT_WS_URL = import.meta.env.VITE_COLLABORATION_WS_URL || 'ws://localhost:8080/collaboration'
const RECONNECT_INTERVAL = 3000
const MAX_RECONNECT_ATTEMPTS = 5
const PING_INTERVAL = 30000

const userId = ref(generateId())
const userName = ref('')
const userRole = ref<Role>('clerk')
const currentCaseId = ref('')
const isConnected = ref(false)
const isConnecting = ref(false)
const connectionError = ref<string | null>(null)
const connectedUsers = ref<CollaborationUser[]>([])
const reconnectAttempts = ref(0)

let ws: WebSocket | null = null
let reconnectTimer: number | null = null
let pingTimer: number | null = null
let messageHandlers: Map<WebSocketMessageType, Set<(message: WebSocketMessage) => void>> = new Map()
let actionHandlers: Set<(action: CollaborationAction) => void> = new Set()
let instanceCount = 0

const createMessage = (
  type: WebSocketMessageType,
  payload?: any,
  caseId?: string
): WebSocketMessage => ({
  type,
  payload,
  userId: userId.value,
  timestamp: Date.now(),
  caseId: caseId || currentCaseId.value
})

const sendMessage = (message: WebSocketMessage): boolean => {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn('[Collaboration] Cannot send message: WebSocket not connected')
    return false
  }
  try {
    ws.send(JSON.stringify(message))
    return true
  } catch (error) {
    console.error('[Collaboration] Failed to send message:', error)
    return false
  }
}

const startPing = () => {
  stopPing()
  pingTimer = window.setInterval(() => {
    if (isConnected.value) {
      sendMessage(createMessage('ping'))
    }
  }, PING_INTERVAL)
}

const stopPing = () => {
  if (pingTimer) {
    clearInterval(pingTimer)
    pingTimer = null
  }
}

const handleMessage = (event: MessageEvent) => {
  try {
    const message = JSON.parse(event.data) as WebSocketMessage
    
    const handlers = messageHandlers.get(message.type)
    if (handlers) {
      handlers.forEach(handler => handler(message))
    }

    switch (message.type) {
      case 'user-joined':
        if (message.payload?.user) {
          const existing = connectedUsers.value.find(u => u.id === message.payload.user.id)
          if (!existing) {
            connectedUsers.value.push(message.payload.user)
          }
        }
        break
      case 'user-left':
        if (message.payload?.userId) {
          connectedUsers.value = connectedUsers.value.filter(u => u.id !== message.payload.userId)
        }
        break
      case 'users-list':
        if (message.payload?.users) {
          connectedUsers.value = message.payload.users
        }
        break
      case 'action':
        if (message.payload?.action && message.payload.action.userId !== userId.value) {
          actionHandlers.forEach(handler => handler(message.payload.action))
        }
        break
      case 'sync-response':
        if (message.payload?.users) {
          connectedUsers.value = message.payload.users
        }
        break
      case 'pong':
        break
      case 'leave':
        if (message.payload?.error) {
          connectionError.value = message.payload.error
          disconnect()
        }
        break
    }
  } catch (error) {
    console.error('[Collaboration] Error parsing message:', error)
  }
}

const handleOpen = () => {
  console.log('[Collaboration] WebSocket connected')
  isConnected.value = true
  isConnecting.value = false
  connectionError.value = null
  reconnectAttempts.value = 0

  const user: CollaborationUser = {
    id: userId.value,
    name: userName.value || `用户${userId.value.slice(0, 6)}`,
    role: userRole.value,
    caseId: currentCaseId.value,
    joinedAt: Date.now()
  }

  sendMessage(createMessage('join', { user }))
  startPing()
}

const handleClose = (event: CloseEvent) => {
  console.log(`[Collaboration] WebSocket closed: ${event.code} - ${event.reason}`)
  isConnected.value = false
  stopPing()

  if (!isConnecting.value && reconnectAttempts.value < MAX_RECONNECT_ATTEMPTS) {
    scheduleReconnect()
  }
}

const handleError = (error: Event) => {
  console.error('[Collaboration] WebSocket error:', error)
  connectionError.value = '连接失败，请检查网络'
}

const scheduleReconnect = () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
  }
  reconnectAttempts.value++
  console.log(`[Collaboration] Scheduling reconnect attempt ${reconnectAttempts.value}/${MAX_RECONNECT_ATTEMPTS}`)
  reconnectTimer = window.setTimeout(() => {
    connect(currentCaseId.value, userRole.value, userName.value)
  }, RECONNECT_INTERVAL)
}

const connect = (
  caseId: string,
  role?: Role,
  name?: string,
  wsUrl: string = DEFAULT_WS_URL
): Promise<boolean> => {
  return new Promise((resolve) => {
    if (isConnected.value || isConnecting.value) {
      resolve(isConnected.value)
      return
    }

    currentCaseId.value = caseId
    if (role) userRole.value = role
    if (name) userName.value = name

    isConnecting.value = true
    connectionError.value = null

    try {
      ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        handleOpen()
        resolve(true)
      }

      ws.onmessage = handleMessage
      ws.onclose = handleClose
      ws.onerror = (error) => {
        handleError(error)
        isConnecting.value = false
        resolve(false)
      }
    } catch (error) {
      console.error('[Collaboration] Failed to create WebSocket:', error)
      connectionError.value = '无法创建连接'
      isConnecting.value = false
      resolve(false)
    }
  })
}

const disconnect = () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
    sendMessage(createMessage('leave'))
  }

  stopPing()

  if (ws) {
    ws.close(1000, 'User disconnected')
    ws = null
  }

  isConnected.value = false
  isConnecting.value = false
  reconnectAttempts.value = 0
  connectedUsers.value = []
  connectionError.value = null
}

const sendAction = (action: Omit<CollaborationAction, 'userId' | 'timestamp' | 'caseId'> & { caseId?: string }): boolean => {
  if (!isConnected.value) {
    console.warn('[Collaboration] Cannot send action: not connected')
    return false
  }

  const fullAction: CollaborationAction = {
    ...action,
    userId: userId.value,
    timestamp: Date.now(),
    caseId: action.caseId || currentCaseId.value
  }

  return sendMessage(createMessage('action', { action: fullAction }, fullAction.caseId))
}

const onAction = (callback: (action: CollaborationAction) => void): (() => void) => {
  actionHandlers.add(callback)
  return () => {
    actionHandlers.delete(callback)
  }
}

const onMessage = (type: WebSocketMessageType, callback: (message: WebSocketMessage) => void): (() => void) => {
  if (!messageHandlers.has(type)) {
    messageHandlers.set(type, new Set())
  }
  messageHandlers.get(type)!.add(callback)
  return () => {
    const handlers = messageHandlers.get(type)
    if (handlers) {
      handlers.delete(callback)
    }
  }
}

const requestSync = (): boolean => {
  return sendMessage(createMessage('sync-request'))
}

const updateUserInfo = (role?: Role, name?: string) => {
  if (role) userRole.value = role
  if (name) userName.value = name
  
  if (isConnected.value) {
    const user: CollaborationUser = {
      id: userId.value,
      name: userName.value,
      role: userRole.value,
      caseId: currentCaseId.value,
      joinedAt: Date.now()
    }
    sendMessage(createMessage('join', { user }))
  }
}

export function useCollaboration() {
  const instance = getCurrentInstance()
  
  if (instance) {
    instanceCount++
    onUnmounted(() => {
      instanceCount--
      if (instanceCount <= 0) {
      }
    })
  }

  return {
    userId,
    userName,
    userRole,
    currentCaseId,
    isConnected,
    isConnecting,
    connectionError,
    connectedUsers,
    reconnectAttempts,
    connect,
    disconnect,
    sendAction,
    onAction,
    onMessage,
    requestSync,
    updateUserInfo,
    MAX_RECONNECT_ATTEMPTS
  }
}
