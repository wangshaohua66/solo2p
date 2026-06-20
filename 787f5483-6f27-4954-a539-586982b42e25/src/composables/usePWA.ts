import { ref, onMounted, onUnmounted } from 'vue'
import {
  getOfflineStorageInfo,
  getAllPendingOperations,
  deletePendingOperation,
  type PendingOperation
} from '@/utils/offline-db'

export function usePWA() {
  const isOnline = ref(navigator.onLine)
  const swRegistration = ref<ServiceWorkerRegistration | null>(null)
  const hasUpdate = ref(false)
  const waitingWorker = ref<ServiceWorker | null>(null)
  const offlineInfo = ref({
    pendingUploads: 0,
    pendingOperations: 0,
    cachedMaterials: 0,
    cachedReviews: 0,
    cachedSchedules: 0
  })

  let updateInterval: ReturnType<typeof setInterval> | null = null

  async function registerSW() {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker not supported')
      return
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      })
      swRegistration.value = registration

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (!newWorker) return

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            hasUpdate.value = true
            waitingWorker.value = newWorker
          }
        })
      })

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload()
      })

      console.log('Service Worker registered successfully')
    } catch (error) {
      console.error('Service Worker registration failed:', error)
    }
  }

  function applyUpdate() {
    if (!waitingWorker.value) return
    waitingWorker.value.postMessage({ type: 'SKIP_WAITING' })
  }

  function handleOnline() {
    isOnline.value = true
    syncPendingOperations()
  }

  function handleOffline() {
    isOnline.value = false
  }

  async function refreshOfflineInfo() {
    try {
      offlineInfo.value = await getOfflineStorageInfo()
    } catch (error) {
      console.error('Failed to get offline info:', error)
    }
  }

  async function syncPendingOperations() {
    try {
      const pending = await getAllPendingOperations()
      const pendingOps = pending.filter((op) => op.status === 'pending')

      for (const op of pendingOps) {
        try {
          await executePendingOperation(op)
          await deletePendingOperation(op.id)
          console.log(`Synced operation: ${op.id}`)
        } catch (error) {
          console.error(`Failed to sync operation ${op.id}:`, error)
          op.retryCount++
          op.status = 'failed'
          const { savePendingOperation } = await import('@/utils/offline-db')
          await savePendingOperation(op)
        }
      }

      refreshOfflineInfo()
    } catch (error) {
      console.error('Sync pending operations failed:', error)
    }
  }

  async function executePendingOperation(op: PendingOperation): Promise<void> {
    const { post, put, del } = await import('@/utils/request')
    const url = `/${op.entity}${op.entityId ? `/${op.entityId}` : ''}`

    switch (op.type) {
      case 'create':
        await post(url, op.data)
        break
      case 'update':
        await put(url, op.data)
        break
      case 'delete':
        await del(url)
        break
    }
  }

  function handleSWMessage(event: MessageEvent) {
    if (event.data?.type === 'SYNC_UPLOAD') {
      console.log('Received sync upload request from Service Worker')
    }
  }

  onMounted(() => {
    registerSW()
    refreshOfflineInfo()

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    navigator.serviceWorker?.addEventListener('message', handleSWMessage)

    updateInterval = setInterval(refreshOfflineInfo, 30000)
  })

  onUnmounted(() => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
    navigator.serviceWorker?.removeEventListener('message', handleSWMessage)
    if (updateInterval) clearInterval(updateInterval)
  })

  return {
    isOnline,
    hasUpdate,
    offlineInfo,
    applyUpdate,
    refreshOfflineInfo,
    syncPendingOperations
  }
}
