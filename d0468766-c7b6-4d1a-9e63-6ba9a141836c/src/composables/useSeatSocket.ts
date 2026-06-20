/**
 * WebSocket 座位实时锁定机制 composable
 * 防止多用户同时下单导致的重复购票
 *
 * 工作流程：
 * 1. 用户进入选座页面 → 连接 WebSocket，订阅 scheduleId
 * 2. 用户选中座位 → 发送 lock 请求，服务端 TTL 30秒锁定
 * 3. 其他用户收到 seat.locked 事件 → 座位更新为锁定中
 * 4. 锁定用户完成支付 → 发送 confirm 请求，座位永久售出
 * 5. 超时未确认 → 服务端自动释放，广播 seat.unlocked
 * 6. 用户离开页面 → 自动清理连接
 */

import { ref, onUnmounted, computed } from 'vue'

export interface LockedSeat {
  scheduleId: string
  row: number
  col: number
  seatId: string
  userId: string
  userName: string
  lockedAt: number
  expiresAt: number
  status: 'locked' | 'sold' | 'released'
}

export interface SeatSocketState {
  connected: boolean
  connecting: boolean
  error: string | null
  lockedSeats: Record<string, LockedSeat>
  lastEvent: { type: string; payload: any; at: number } | null
}

export interface SeatSocketHandlers {
  onSeatLocked?: (seat: LockedSeat) => void
  onSeatUnlocked?: (seat: LockedSeat) => void
  onSeatSold?: (seat: LockedSeat) => void
  onError?: (msg: string) => void
}

const DEFAULT_URL = import.meta.env.VITE_SEAT_WS_URL || 'ws://localhost:8080/ws/seats'
const LOCK_TTL_MS = 30 * 1000

export function useSeatSocket(scheduleId: string, handlers: SeatSocketHandlers = {}) {
  const state = ref<SeatSocketState>({
    connected: false,
    connecting: false,
    error: null,
    lockedSeats: {},
    lastEvent: null
  })

  let ws: WebSocket | null = null
  let reconnectTimer: number | null = null
  let heartbeatTimer: number | null = null
  let reconnectAttempts = 0

  const myUserId = computed(() => localStorage.getItem('seat_user_id') || `u_${Math.random().toString(36).slice(2, 10)}`)

  function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return
    if (!scheduleId) return

    state.value.connecting = true
    state.value.error = null

    try {
      const url = `${DEFAULT_URL}?scheduleId=${scheduleId}&uid=${myUserId.value}`
      ws = new WebSocket(url)

      ws.onopen = () => {
        state.value.connected = true
        state.value.connecting = false
        reconnectAttempts = 0
        subscribe()
        startHeartbeat()
      }

      ws.onclose = () => {
        state.value.connected = false
        stopHeartbeat()
        if (reconnectAttempts < 5) {
          const delay = Math.min(1000 * 2 ** reconnectAttempts, 10000)
          reconnectTimer = window.setTimeout(() => {
            reconnectAttempts++
            connect()
          }, delay)
        }
      }

      ws.onerror = () => {
        state.value.error = 'WebSocket 连接失败'
        handlers.onError?.('连接异常，请刷新页面重试')
      }

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data)
          handleMessage(msg)
        } catch {
          // 忽略非 JSON 消息
        }
      }
    } catch (e) {
      state.value.error = (e as Error).message
      state.value.connecting = false
    }
  }

  function disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    stopHeartbeat()
    if (ws) {
      ws.close()
      ws = null
    }
    state.value.connected = false
  }

  function send(type: string, payload: Record<string, any>) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket 未连接')
    }
    ws.send(JSON.stringify({ type, payload, ts: Date.now() }))
  }

  function subscribe() {
    send('subscribe', { scheduleId })
  }

  function startHeartbeat() {
    heartbeatTimer = window.setInterval(() => {
      try {
        send('ping', { t: Date.now() })
      } catch {
        // 忽略
      }
    }, 25000)
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  function handleMessage(msg: { type: string; payload: any }) {
    state.value.lastEvent = { type: msg.type, payload: msg.payload, at: Date.now() }
    switch (msg.type) {
      case 'seat.locked': {
        const seat = msg.payload as LockedSeat
        state.value.lockedSeats[seat.seatId] = seat
        handlers.onSeatLocked?.(seat)
        break
      }
      case 'seat.unlocked': {
        const seat = msg.payload as LockedSeat
        delete state.value.lockedSeats[seat.seatId]
        handlers.onSeatUnlocked?.(seat)
        break
      }
      case 'seat.sold': {
        const seat = msg.payload as LockedSeat
        state.value.lockedSeats[seat.seatId] = { ...seat, status: 'sold' }
        handlers.onSeatSold?.(seat)
        break
      }
      case 'lock.result': {
        if (msg.payload.success === false) {
          handlers.onError?.(msg.payload.reason || '座位已被占用')
        }
        break
      }
      case 'pong':
      case 'welcome':
        break
    }
  }

  function lockSeat(row: number, col: number, seatId: string, userName = '我') {
    if (!scheduleId) return
    send('seat.lock', {
      scheduleId,
      row,
      col,
      seatId,
      userId: myUserId.value,
      userName,
      ttl: LOCK_TTL_MS
    })
  }

  function unlockSeat(seatId: string) {
    if (!scheduleId) return
    send('seat.unlock', { scheduleId, seatId, userId: myUserId.value })
  }

  function confirmSeat(seatId: string, orderId: string) {
    if (!scheduleId) return
    send('seat.confirm', { scheduleId, seatId, userId: myUserId.value, orderId })
  }

  function isSeatLocked(seatId: string, excludeSelf = true): boolean {
    const s = state.value.lockedSeats[seatId]
    if (!s) return false
    if (excludeSelf && s.userId === myUserId.value) return false
    return s.status === 'locked' && s.expiresAt > Date.now()
  }

  function isSeatSold(seatId: string): boolean {
    return state.value.lockedSeats[seatId]?.status === 'sold'
  }

  onUnmounted(() => {
    disconnect()
  })

  return {
    state,
    myUserId,
    connect,
    disconnect,
    lockSeat,
    unlockSeat,
    confirmSeat,
    isSeatLocked,
    isSeatSold,
    LOCK_TTL_MS
  }
}

export default useSeatSocket
