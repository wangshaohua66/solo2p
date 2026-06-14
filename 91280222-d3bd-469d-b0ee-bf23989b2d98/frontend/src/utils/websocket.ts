import { ElNotification } from 'element-plus'
import type { Annotation, AnnotationConflict } from '@/types/annotation'

export type WsMessageType =
  | 'annotation.created'
  | 'annotation.updated'
  | 'annotation.deleted'
  | 'annotation.reply'
  | 'annotation.conflict'
  | 'review.status_changed'
  | 'workflow.updated'
  | 'notification'
  | 'user.join'
  | 'user.leave'
  | 'heartbeat'

export interface WsMessage {
  type: WsMessageType
  data: any
  timestamp: string
  documentId?: string
  userId: string
  userName: string
}

type MessageHandler = (message: WsMessage) => void

class WebSocketService {
  private socket: WebSocket | null = null
  private reconnectTimer: number | null = null
  private heartbeatTimer: number | null = null
  private handlers: Map<WsMessageType, Set<MessageHandler>> = new Map()
  private url: string = ''
  private token: string = ''
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 10
  private isManualClose: boolean = false

  connect(token: string, documentId?: string) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return
    }

    this.token = token
    this.isManualClose = false
    const baseUrl = import.meta.env.VITE_WS_BASE || 'ws://localhost:5000'
    this.url = documentId
      ? `${baseUrl}/ws/review?token=${token}&documentId=${documentId}`
      : `${baseUrl}/ws/review?token=${token}`

    this.createConnection()
  }

  private createConnection() {
    try {
      this.socket = new WebSocket(this.url)

      this.socket.onopen = () => {
        this.reconnectAttempts = 0
        this.startHeartbeat()
        console.log('[WebSocket] Connected')
      }

      this.socket.onmessage = (event) => {
        try {
          const message: WsMessage = JSON.parse(event.data)
          this.dispatchMessage(message)
        } catch (e) {
          console.error('[WebSocket] Parse error:', e)
        }
      }

      this.socket.onerror = (error) => {
        console.error('[WebSocket] Error:', error)
      }

      this.socket.onclose = (event) => {
        this.stopHeartbeat()
        if (!this.isManualClose && event.code !== 1000) {
          this.scheduleReconnect()
        }
        console.log('[WebSocket] Closed')
      }
    } catch (e) {
      console.error('[WebSocket] Connection failed:', e)
      this.scheduleReconnect()
    }
  }

  private startHeartbeat() {
    this.heartbeatTimer = window.setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }))
      }
    }, 30000)
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      ElNotification.error({
        title: '连接断开',
        message: '实时连接已断开，请刷新页面重试'
      })
      return
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
    this.reconnectAttempts++

    this.reconnectTimer = window.setTimeout(() => {
      console.log(`[WebSocket] Reconnecting (attempt ${this.reconnectAttempts})...`)
      this.createConnection()
    }, delay)
  }

  disconnect() {
    this.isManualClose = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.stopHeartbeat()
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
  }

  send(type: WsMessageType, data: any, documentId?: string) {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocket] Not connected, message queued')
      return
    }

    const message: WsMessage = {
      type,
      data,
      timestamp: new Date().toISOString(),
      documentId,
      userId: '',
      userName: ''
    }
    this.socket.send(JSON.stringify(message))
  }

  on(type: WsMessageType, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    this.handlers.get(type)!.add(handler)

    return () => this.off(type, handler)
  }

  off(type: WsMessageType, handler: MessageHandler) {
    this.handlers.get(type)?.delete(handler)
  }

  private dispatchMessage(message: WsMessage) {
    const handlers = this.handlers.get(message.type)
    if (handlers) {
      handlers.forEach((h) => {
        try {
          h(message)
        } catch (e) {
          console.error('[WebSocket] Handler error:', e)
        }
      })
    }

    const allHandlers = this.handlers.get('notification' as WsMessageType)
    if (allHandlers && message.type !== 'heartbeat') {
      allHandlers.forEach((h) => {
        try {
          h(message)
        } catch (e) {}
      })
    }
  }
}

export const wsService = new WebSocketService()
