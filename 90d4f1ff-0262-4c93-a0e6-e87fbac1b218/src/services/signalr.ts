import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr'
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useParkingStore } from '@/stores/parking'
import { useChargingStore } from '@/stores/charging'
import type { ParkingSpot, ChargingStation } from '@/types'

let connection: HubConnection | null = null
const isConnected = ref(false)
const reconnectAttempts = ref(0)
const maxReconnectAttempts = 5

export function useSignalRService() {
  const parkingStore = useParkingStore()
  const chargingStore = useChargingStore()
  const authStore = useAuthStore()

  const createConnection = () => {
    if (connection) return

    connection = new HubConnectionBuilder()
      .withUrl('/hub/notification', {
        accessTokenFactory: () => authStore.token || '',
        transport: undefined
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Information)
      .build()

    setupClientMethods()
    setupConnectionEvents()
  }

  const setupClientMethods = () => {
    if (!connection) return

    connection.on('ParkingSpotUpdated', (spot: ParkingSpot) => {
      parkingStore.updateSpot(spot)
    })

    connection.on('ParkingSpotsBatchUpdated', (spots: ParkingSpot[]) => {
      parkingStore.updateSpots(spots)
    })

    connection.on('ChargingStationUpdated', (station: ChargingStation) => {
      chargingStore.updateStation(station)
    })

    connection.on('ChargingStationsBatchUpdated', (stations: ChargingStation[]) => {
      chargingStore.updateStations(stations)
    })

    connection.on('ReservationExpired', (reservationId: string) => {
      ElMessage.warning('您的预约已超时自动取消')
      chargingStore.removeExpiredReservation(reservationId)
    })

    connection.on('PaymentCompleted', (orderId: string) => {
      ElMessage.success('支付成功')
    })

    connection.on('WorkOrderAssigned', (workOrderId: string) => {
      ElMessage.info('您有新的工单待处理')
    })

    connection.on('Notification', (message: string, type: 'info' | 'success' | 'warning' | 'error') => {
      const msgTypes = {
        info: ElMessage.info,
        success: ElMessage.success,
        warning: ElMessage.warning,
        error: ElMessage.error
      }
      msgTypes[type](message)
    })
  }

  const setupConnectionEvents = () => {
    if (!connection) return

    connection.onclose((error) => {
      isConnected.value = false
      if (error) {
        console.error('SignalR连接关闭:', error)
      }
    })

    connection.onreconnecting((error) => {
      isConnected.value = false
      reconnectAttempts.value++
      console.warn('SignalR正在重连...', error)
    })

    connection.onreconnected((connectionId) => {
      isConnected.value = true
      reconnectAttempts.value = 0
      console.log('SignalR重连成功, 连接ID:', connectionId)
      parkingStore.fetchParkingLots()
      chargingStore.fetchStations()
    })
  }

  const startConnection = async () => {
    if (!authStore.isAuthenticated) return
    if (connection?.state === HubConnectionState.Connected) return

    try {
      createConnection()
      await connection?.start()
      isConnected.value = true
      reconnectAttempts.value = 0
      console.log('SignalR连接成功')
    } catch (error) {
      isConnected.value = false
      console.error('SignalR连接失败:', error)
      if (reconnectAttempts.value < maxReconnectAttempts) {
        reconnectAttempts.value++
        setTimeout(startConnection, 2000 * reconnectAttempts.value)
      }
    }
  }

  const stopConnection = async () => {
    try {
      await connection?.stop()
      connection = null
      isConnected.value = false
      reconnectAttempts.value = 0
      console.log('SignalR连接已断开')
    } catch (error) {
      console.error('SignalR断开连接失败:', error)
    }
  }

  const invoke = async (method: string, ...args: any[]) => {
    if (connection?.state !== HubConnectionState.Connected) {
      throw new Error('SignalR未连接')
    }
    return await connection.invoke(method, ...args)
  }

  return {
    isConnected,
    startConnection,
    stopConnection,
    invoke
  }
}
