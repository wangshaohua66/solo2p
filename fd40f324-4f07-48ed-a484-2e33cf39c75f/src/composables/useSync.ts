import { ref, onBeforeUnmount } from 'vue'
import { useSyncStore } from '@/stores/sync'
import type { SyncType } from '@/types'
import { createId } from '@/utils'

type HandlerFn = (payload: any, senderId: string) => void

export function useSync() {
  const syncStore = useSyncStore()
  const channel = ref<BroadcastChannel | null>(null)
  const handlers = new Map<SyncType, Set<HandlerFn>>()
  const lastMessageTime = ref<number | null>(null)
  const messageCount = ref(0)

  function createOrJoinChannel(channelId: string, role: 'editor' | 'viewer' = 'editor') {
    disconnect()
    const bc = new BroadcastChannel(`codestage:${channelId}`)
    channel.value = bc

    bc.onmessage = (ev) => {
      const msg = ev.data
      if (!msg || msg.senderId === syncStore.clientId) return
      if (msg.channelId !== channelId) return

      lastMessageTime.value = Date.now()
      messageCount.value++
      syncStore.updateSyncTime()

      if (msg.type === 'sync:hello') {
        broadcast('sync:bye', { role: syncStore.role })
        syncStore.addClient(msg.senderId, msg.payload?.role || 'viewer')
        if (syncStore.role === 'editor') {
          broadcast('sync:state', getStatePayload())
        }
        return
      }
      if (msg.type === 'sync:bye') {
        syncStore.removeClient(msg.senderId)
        return
      }

      const set = handlers.get(msg.type)
      if (set) {
        set.forEach(cb => {
          try { cb(msg.payload, msg.senderId) } catch (e) { console.warn(e) }
        })
      }
    }

    bc.onmessageerror = (e) => {
      console.warn('Sync channel error:', e)
    }

    if (role === 'editor') {
      syncStore.createChannel(channelId)
    } else {
      syncStore.joinChannel(channelId, role)
    }

    broadcast('sync:hello', { role })
    return true
  }

  function getStatePayload() {
    return {
      timestamp: Date.now(),
      clientId: syncStore.clientId
    }
  }

  function broadcast(type: SyncType, payload: any) {
    if (!channel.value || !syncStore.isConnected) return
    try {
      channel.value.postMessage({
        channelId: syncStore.channelId,
        senderId: syncStore.clientId,
        type,
        payload,
        timestamp: Date.now()
      })
      syncStore.incrementPending()
      queueMicrotask(() => syncStore.decrementPending())
    } catch (e) {
      console.warn('Broadcast failed:', e)
    }
  }

  function on<T = any>(type: SyncType, handler: (payload: T, senderId: string) => void): () => void {
    if (!handlers.has(type)) handlers.set(type, new Set())
    handlers.get(type)!.add(handler as HandlerFn)
    return () => { handlers.get(type)?.delete(handler as HandlerFn) }
  }

  function disconnect() {
    if (channel.value) {
      try {
        broadcast('sync:bye', { role: syncStore.role })
      } catch { /* ignore */ }
      channel.value.close()
      channel.value = null
    }
    syncStore.leaveChannel()
  }

  function generateId(): string {
    return createId('sync')
  }

  onBeforeUnmount(() => {
    disconnect()
    handlers.clear()
  })

  return {
    createOrJoinChannel,
    disconnect,
    broadcast,
    on,
    generateId,
    lastMessageTime,
    messageCount,
    isConnected: syncStore.isConnected,
    channelId: syncStore.channelId,
    clientCount: syncStore.clientCount
  }
}

export type SyncAPI = ReturnType<typeof useSync>
