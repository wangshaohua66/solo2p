import { ref, onUnmounted } from 'vue'
import type { CollaborationAction } from '@/types'
import { generateId } from '@/utils/storage'

const CHANNEL_NAME = 'court-trial-collaboration'

export function useCollaboration() {
  const userId = ref(generateId())
  const isConnected = ref(false)
  const connectedUsers = ref<Set<string>>(new Set([userId.value]))

  let channel: BroadcastChannel | null = null

  const initChannel = () => {
    if (typeof BroadcastChannel === 'undefined') {
      console.warn('BroadcastChannel not supported, collaboration disabled')
      return false
    }

    try {
      channel = new BroadcastChannel(CHANNEL_NAME)
      isConnected.value = true

      channel.onmessage = (event: MessageEvent<CollaborationAction | { type: string; userId: string }>) => {
        const data = event.data
        if (data.type === 'ping') {
          connectedUsers.value.add((data as any).userId)
          broadcast({ type: 'pong', userId: userId.value })
        } else if (data.type === 'pong') {
          connectedUsers.value.add((data as any).userId)
        } else if (data.type === 'leave') {
          connectedUsers.value.delete((data as any).userId)
        }
      }

      broadcast({ type: 'ping', userId: userId.value })

      window.addEventListener('beforeunload', handleLeave)
      return true
    } catch (error) {
      console.error('Failed to init collaboration channel:', error)
      return false
    }
  }

  const handleLeave = () => {
    broadcast({ type: 'leave', userId: userId.value })
    channel?.close()
    channel = null
    isConnected.value = false
  }

  const broadcast = (message: any) => {
    if (!channel) return false
    try {
      channel.postMessage(message)
      return true
    } catch (error) {
      console.error('Failed to broadcast message:', error)
      return false
    }
  }

  const sendAction = (action: Omit<CollaborationAction, 'userId' | 'timestamp'>) => {
    const fullAction: CollaborationAction = {
      ...action,
      userId: userId.value,
      timestamp: Date.now()
    }
    return broadcast(fullAction)
  }

  const onAction = (callback: (action: CollaborationAction) => void) => {
    if (!channel) return () => {}

    const handler = (event: MessageEvent) => {
      const data = event.data
      if (
        data.userId !== userId.value &&
        data.type &&
        data.type !== 'ping' &&
        data.type !== 'pong' &&
        data.type !== 'leave'
      ) {
        callback(data as CollaborationAction)
      }
    }

    channel.addEventListener('message', handler)
    return () => channel?.removeEventListener('message', handler)
  }

  const disconnect = () => {
    handleLeave()
    window.removeEventListener('beforeunload', handleLeave)
  }

  onUnmounted(() => {
    disconnect()
  })

  return {
    userId,
    isConnected,
    connectedUsers,
    initChannel,
    sendAction,
    onAction,
    disconnect
  }
}
