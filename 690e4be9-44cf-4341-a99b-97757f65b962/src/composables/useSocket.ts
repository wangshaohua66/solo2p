import { ref, onUnmounted } from 'vue'
import { io, Socket } from 'socket.io-client'
import { useDispatchStore } from '@/stores/dispatch'

export function useSocket(url = 'http://localhost:3001') {
  const socket = ref<Socket | null>(null)
  const connected = ref(false)
  const reconnectCount = ref(0)

  function connect() {
    socket.value = io(url, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 3000,
    })

    socket.value.on('connect', () => {
      connected.value = true
      reconnectCount.value = 0
    })

    socket.value.on('disconnect', () => {
      connected.value = false
    })

    socket.value.on('reconnect_attempt', () => {
      reconnectCount.value++
    })

    socket.value.on('vehicle:update', (data) => {
      const store = useDispatchStore()
      store.updateVehiclePosition(data.id, data)
    })

    socket.value.on('alert:new', (data) => {
      const store = useDispatchStore()
      store.addAlert(data)
    })
  }

  function disconnect() {
    if (socket.value) {
      socket.value.disconnect()
      socket.value = null
    }
  }

  function emit(event: string, data?: unknown) {
    if (socket.value?.connected) {
      socket.value.emit(event, data)
    }
  }

  onUnmounted(() => {
    disconnect()
  })

  return { socket, connected, reconnectCount, connect, disconnect, emit }
}
