import { defineStore } from 'pinia'
import type { SyncRole, SyncChannelInfo } from '@/types'
import { createId, generateChannelId } from '@/utils'

interface SyncState {
  channel: SyncChannelInfo | null
  clientId: string
  lastSyncAt: number | null
  pendingMessages: number
  viewerMode: boolean
  notification: { type: 'info' | 'success' | 'error'; message: string } | null
}

export const useSyncStore = defineStore('sync', {
  state: (): SyncState => ({
    channel: null,
    clientId: createId('client'),
    lastSyncAt: null,
    pendingMessages: 0,
    viewerMode: false,
    notification: null
  }),

  getters: {
    isConnected: (state) => state.channel?.isConnected ?? false,
    channelId: (state) => state.channel?.channelId ?? '',
    role: (state): SyncRole => state.channel?.role ?? 'editor',
    clientCount: (state) => state.channel?.clients.length ?? 0,
    isEditor: (state) => {
      if (state.viewerMode) return false
      return state.channel?.role === 'editor' || state.channel === null
    },
    isViewer: (state) => state.channel?.role === 'viewer' || state.viewerMode
  },

  actions: {
    createChannel(desiredId?: string): string {
      const channelId = desiredId || generateChannelId()
      this.channel = {
        channelId,
        role: 'editor',
        isConnected: true,
        clients: [{
          id: this.clientId,
          role: 'editor',
          connectedAt: Date.now()
        }]
      }
      this.lastSyncAt = Date.now()
      this.viewerMode = false
      this.setNotification('success', `频道已创建: ${channelId}`)
      return channelId
    },

    joinChannel(channelId: string, role: SyncRole = 'viewer'): boolean {
      if (!channelId || channelId.length < 4) {
        this.setNotification('error', '频道ID格式无效')
        return false
      }
      this.channel = {
        channelId: channelId.toUpperCase(),
        role,
        isConnected: true,
        clients: [{
          id: this.clientId,
          role,
          connectedAt: Date.now()
        }]
      }
      this.lastSyncAt = Date.now()
      this.viewerMode = role === 'viewer'
      this.setNotification('success', `已加入频道: ${channelId.toUpperCase()}`)
      return true
    },

    leaveChannel() {
      if (this.channel) {
        this.setNotification('info', `已离开频道: ${this.channel.channelId}`)
      }
      this.channel = null
      this.lastSyncAt = null
      this.viewerMode = false
    },

    addClient(clientId: string, role: SyncRole) {
      if (!this.channel) return
      if (!this.channel.clients.find(c => c.id === clientId)) {
        this.channel.clients.push({
          id: clientId,
          role,
          connectedAt: Date.now()
        })
      }
    },

    removeClient(clientId: string) {
      if (!this.channel) return
      const idx = this.channel.clients.findIndex(c => c.id === clientId)
      if (idx >= 0) {
        this.channel.clients.splice(idx, 1)
      }
    },

    updateSyncTime() {
      this.lastSyncAt = Date.now()
    },

    incrementPending() {
      this.pendingMessages++
    },

    decrementPending() {
      this.pendingMessages = Math.max(0, this.pendingMessages - 1)
    },

    toggleViewerMode() {
      this.viewerMode = !this.viewerMode
    },

    setRole(role: SyncRole) {
      if (this.channel) {
        this.channel.role = role
        const self = this.channel.clients.find(c => c.id === this.clientId)
        if (self) self.role = role
      }
    },

    setNotification(type: 'info' | 'success' | 'error', message: string) {
      this.notification = { type, message }
      setTimeout(() => {
        if (this.notification?.message === message) {
          this.notification = null
        }
      }, 3000)
    },

    clearNotification() {
      this.notification = null
    }
  }
})
