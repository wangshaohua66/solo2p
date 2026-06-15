import { defineStore } from 'pinia'
import * as signalR from '@microsoft/signalr'
const { HubConnectionBuilder, HttpTransportType, HubConnectionState } = signalR
import type {
  Pipe, MonitorNode, LeakEvent, RepairWorkOrder, RepairTeam,
  Valve, OutageZone, UserAccount, ToastNotification, UserRole,
  WorkOrderStatus
} from '~/types'
import {
  generateMockData, generateMockLeakEvents, generateMockWorkOrders,
  generateMockOutageZones, fetchAPI
} from '~/utils/api'

interface DispatchState {
  connected: boolean
  connecting: boolean
  connectionError: string | null
  hubConnection: HubConnection | null
  pipes: Pipe[]
  monitorNodes: MonitorNode[]
  leakEvents: LeakEvent[]
  workOrders: RepairWorkOrder[]
  repairTeams: RepairTeam[]
  valves: Valve[]
  outageZones: OutageZone[]
  currentUser: UserAccount | null
  toasts: ToastNotification[]
  selectedLeakId: string | null
  selectedWorkOrderId: string | null
  selectedTeamId: string | null
  mapStyle: 'vector' | 'satellite'
  useMockFallback: boolean
}

export const useDispatchStore = defineStore('dispatch', {
  state: (): DispatchState => ({
    connected: false,
    connecting: false,
    connectionError: null,
    hubConnection: null,
    pipes: [],
    monitorNodes: [],
    leakEvents: [],
    workOrders: [],
    repairTeams: [],
    valves: [],
    outageZones: [],
    currentUser: {
      id: 'user-1',
      username: 'director01',
      displayName: '王调度',
      role: 'DispatchDirector',
      phone: '138****1234',
      district: null,
      isOnline: true,
      lastLoginTime: new Date().toISOString(),
      createdAt: '2024-01-01T00:00:00Z'
    },
    toasts: [],
    selectedLeakId: null,
    selectedWorkOrderId: null,
    selectedTeamId: null,
    mapStyle: 'vector',
    useMockFallback: true
  }),

  getters: {
    activeLeakEvents(state): LeakEvent[] {
      return state.leakEvents
        .filter(e => e.status !== 'Resolved' && e.status !== 'FalseAlarm')
        .sort((a, b) => {
          const sevOrder: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 }
          return (sevOrder[a.severity] ?? 99) - (sevOrder[b.severity] ?? 99)
        })
    },

    activeAlarmCount(state): number {
      return state.monitorNodes.filter(n => n.hasAlarm).length
        + state.leakEvents.filter(e => e.status === 'Detected' || e.status === 'Confirmed').length
        + state.workOrders.filter(w => w.isTimeoutEscalated).length
    },

    teamStatusCounts(state): Record<string, number> {
      const counts: Record<string, number> = { Idle: 0, OnDuty: 0, OnSite: 0, Repairing: 0, Resting: 0 }
      for (const team of state.repairTeams) counts[team.status]++
      return counts
    },

    workOrdersByStatus(state): Record<string, RepairWorkOrder[]> {
      const result: Record<string, RepairWorkOrder[]> = {
        Created: [], Dispatched: [], Accepted: [], OnSite: [],
        Repairing: [], Completed: [], AcceptedClosed: [], Cancelled: []
      }
      for (const w of state.workOrders) {
        if (result[w.status]) result[w.status].push(w)
      }
      return result
    },

    getNodeById: (state) => (id: string): MonitorNode | undefined => {
      return state.monitorNodes.find(n => n.id === id)
    },

    getTeamById: (state) => (id: string): RepairTeam | undefined => {
      return state.repairTeams.find(t => t.id === id)
    },

    getLeakById: (state) => (id: string): LeakEvent | undefined => {
      return state.leakEvents.find(l => l.id === id)
    },

    getWorkOrderById: (state) => (id: string): RepairWorkOrder | undefined => {
      return state.workOrders.find(w => w.id === id)
    },

    connectionState(state): string {
      if (!state.hubConnection) return '未连接'
      switch (state.hubConnection.state) {
        case HubConnectionState.Connected: return '已连接'
        case HubConnectionState.Connecting: return '连接中...'
        case HubConnectionState.Reconnecting: return '重连中...'
        case HubConnectionState.Disconnected: return '已断开'
        default: return '未知'
      }
    }
  },

  actions: {
    initMockFallbackData() {
      if (!this.useMockFallback) return
      const mock = generateMockData()
      this.pipes = mock.pipes
      this.monitorNodes = mock.nodes
      this.repairTeams = mock.teams
      this.valves = mock.valves
      this.leakEvents = generateMockLeakEvents()
      this.workOrders = generateMockWorkOrders()
      this.outageZones = generateMockOutageZones()
    },

    async fetchInitialData(): Promise<boolean> {
      try {
        const results = await Promise.allSettled([
          fetchAPI<Pipe[]>('/leak/pipes').catch(() => [] as Pipe[]),
          fetchAPI<MonitorNode[]>('/leak/monitor-nodes').catch(() => [] as MonitorNode[]),
          fetchAPI<{ data: LeakEvent[] }>('/leak/events?pageSize=100')
            .then(r => r.data)
            .catch(() => [] as LeakEvent[]),
          fetchAPI<{ data: RepairWorkOrder[] }>('/repair/work-orders?pageSize=100')
            .then(r => r.data)
            .catch(() => [] as RepairWorkOrder[]),
          fetchAPI<RepairTeam[]>('/repair/teams').catch(() => [] as RepairTeam[]),
          fetchAPI<Valve[]>('/repair/valves').catch(() => [] as Valve[])
        ])

        const pipes = results[0].status === 'fulfilled' ? results[0].value : []
        const nodes = results[1].status === 'fulfilled' ? results[1].value : []
        const leaks = results[2].status === 'fulfilled' ? results[2].value : []
        const orders = results[3].status === 'fulfilled' ? results[3].value : []
        const teams = results[4].status === 'fulfilled' ? results[4].value : []
        const valves = results[5].status === 'fulfilled' ? results[5].value : []

        const hasRealData = pipes.length > 0 || nodes.length > 0 || leaks.length > 0

        if (hasRealData) {
          this.useMockFallback = false
          if (pipes.length > 0) this.pipes = pipes
          if (nodes.length > 0) this.monitorNodes = nodes
          if (leaks.length > 0) this.leakEvents = leaks
          if (orders.length > 0) this.workOrders = orders
          if (teams.length > 0) this.repairTeams = teams
          if (valves.length > 0) this.valves = valves
          return true
        }
        return false
      } catch (error) {
        console.warn('Failed to fetch initial data from API, using mock fallback:', error)
        return false
      }
    },

    async connectSignalR() {
      if (this.connecting || (this.connected && this.hubConnection?.state === HubConnectionState.Connected)) {
        return
      }

      this.connecting = true
      this.connectionError = null

      const hasRealData = await this.fetchInitialData()

      if (!hasRealData) {
        this.initMockFallbackData()
      }

      if (import.meta.server) {
        this.connecting = false
        this.connected = true
        return
      }

      const config = useRuntimeConfig()
      const hubUrl = (config.public.signalRHub as string) || 'http://localhost:5000/hubs/dispatch'

      try {
        const userId = this.currentUser?.id || 'anonymous'
        const connection = new HubConnectionBuilder()
          .withUrl(`${hubUrl}?userId=${userId}`, {
            transport: HttpTransportType.WebSockets | HttpTransportType.LongPolling,
            skipNegotiation: false,
            withCredentials: true
          })
          .withAutomaticReconnect([0, 2000, 5000, 10000, 20000, 30000])
          .configureLogging(signalR.LogLevel.Information)
          .build()

        connection.onclose((error) => {
          this.connected = false
          this.connectionError = error?.message || '连接已关闭'
          this.addToast({
            type: 'error',
            title: '实时连接已断开',
            message: error?.message || '正在尝试重新连接...',
            duration: 5000
          })
        })

        connection.onreconnecting((error) => {
          this.connecting = true
          this.connectionError = error?.message || '正在重新连接...'
        })

        connection.onreconnected((connectionId) => {
          this.connecting = false
          this.connected = true
          this.connectionError = null
          this.addToast({
            type: 'success',
            title: '实时连接已恢复',
            message: `Connection ID: ${connectionId?.substring(0, 8)}...`,
            duration: 3000
          })
        })

        this.registerHubHandlers(connection)

        await connection.start()

        this.hubConnection = connection
        this.connected = true
        this.connecting = false
        this.connectionError = null

        this.addToast({
          type: 'success',
          title: '实时连接已建立',
          message: '正在接收 SCADA 数据与调度指令',
          duration: 3000
        })

        await this.subscribeToHubEvents()

      } catch (error: any) {
        console.error('SignalR connection failed:', error)
        this.connectionError = error?.message || '连接失败'
        this.connecting = false
        this.connected = true

        this.addToast({
          type: 'warning',
          title: '实时连接建立失败',
          message: this.useMockFallback
            ? '已使用本地模拟数据，部分实时功能将不可用'
            : error?.message || '请检查后端服务状态',
          duration: 6000
        })
      }
    },

    registerHubHandlers(connection: HubConnection) {
      connection.on('PressureUpdated', (data: {
        nodeId: string
        code: string
        name: string
        pressure: number
        flow?: number
        readingTime: string
        isAnomaly?: boolean
      }) => {
        this.handlePressureUpdated(data)
      })

      connection.on('PressureAlarm', (data: {
        nodeId: string
        code: string
        name: string
        pressure: number
        longitude: number
        latitude: number
        thresholdMin: number
        thresholdMax: number
        readingTime: string
      }) => {
        this.handlePressureAlarm(data)
      })

      connection.on('NewLeakEvent', (leak: LeakEvent) => {
        this.handleNewLeakEvent(leak)
      })

      connection.on('LeakEventUpdated', (leak: LeakEvent) => {
        this.handleLeakEventUpdated(leak)
      })

      connection.on('WorkOrderCreated', (order: RepairWorkOrder) => {
        this.handleWorkOrderCreated(order)
      })

      connection.on('WorkOrderUpdated', (order: RepairWorkOrder) => {
        this.handleWorkOrderUpdated(order)
      })

      connection.on('TeamPositionUpdated', (team: RepairTeam) => {
        this.handleTeamPositionUpdated(team)
      })

      connection.on('OutageZoneCreated', (data: { workOrderId: string; zone: OutageZone }) => {
        this.handleOutageZoneCreated(data)
      })

      connection.on('TimeoutEscalated', (data: {
        workOrderId: string
        orderNo: string
        oldPriority: number
        newPriority: number
      }) => {
        this.handleTimeoutEscalated(data)
      })

      connection.on('Broadcast', (data: { type: string; message: string; payload?: any }) => {
        this.addToast({
          type: 'info',
          title: data.type,
          message: data.message,
          duration: 4000
        })
      })
    },

    async subscribeToHubEvents() {
      if (!this.hubConnection || this.hubConnection.state !== HubConnectionState.Connected) return
      try {
        await this.hubConnection.invoke('SubscribeToEvents', ['all'])
        await this.hubConnection.invoke('CheckAndEscalateTimeoutOrders')
      } catch (error) {
        console.warn('Failed to subscribe to hub events:', error)
      }
    },

    async disconnectSignalR() {
      if (this.hubConnection) {
        try {
          await this.hubConnection.stop()
        } catch (error) {
          console.error('Error stopping SignalR connection:', error)
        }
        this.hubConnection = null
      }
      this.connected = false
      this.connecting = false
      this.connectionError = null
    },

    handlePressureUpdated(data: {
      nodeId: string
      pressure: number
      flow?: number
      readingTime?: string
    }) {
      const node = this.monitorNodes.find(n => n.id === data.nodeId)
      if (!node) return
      node.currentPressure = data.pressure
      node.currentFlow = data.flow ?? null
      node.lastReadingTime = data.readingTime || new Date().toISOString()
      node.isOnline = true
    },

    handlePressureAlarm(data: {
      nodeId: string
      code: string
      name: string
      pressure: number
      longitude: number
      latitude: number
      thresholdMin: number
      thresholdMax: number
    }) {
      const node = this.monitorNodes.find(n => n.id === data.nodeId)
      if (node) {
        node.hasAlarm = true
        node.currentPressure = data.pressure
      }
      this.addToast({
        id: `toast-alarm-${data.nodeId}-${Date.now()}`,
        type: 'warning',
        title: `压力异常告警`,
        message: `${data.name} (${data.code}) 当前压力 ${data.pressure.toFixed(3)} MPa (阈值 ${data.thresholdMin.toFixed(2)}-${data.thresholdMax.toFixed(2)})`,
        duration: 8000
      })
    },

    handleNewLeakEvent(leak: LeakEvent) {
      const idx = this.leakEvents.findIndex(l => l.id === leak.id)
      if (idx >= 0) {
        this.leakEvents[idx] = leak
      } else {
        this.leakEvents.unshift(leak)
      }
      this.addToast({
        id: `toast-leak-${leak.id}`,
        type: leak.severity === 'Critical' ? 'error' : 'warning',
        title: `疑似漏损事件 (${leak.eventNo})`,
        message: `${leak.description ?? ''} 置信度 ${(leak.confidence * 100).toFixed(0)}%`,
        duration: 10000
      })
    },

    handleLeakEventUpdated(leak: LeakEvent) {
      const idx = this.leakEvents.findIndex(l => l.id === leak.id)
      if (idx >= 0) {
        this.leakEvents[idx] = leak
      }
    },

    handleWorkOrderCreated(order: RepairWorkOrder) {
      const idx = this.workOrders.findIndex(w => w.id === order.id)
      if (idx < 0) {
        this.workOrders.unshift(order)
      }
      this.addToast({
        type: 'info',
        title: '新工单创建',
        message: `${order.orderNo} - ${order.title}`,
        duration: 5000
      })
    },

    handleWorkOrderUpdated(order: RepairWorkOrder) {
      const idx = this.workOrders.findIndex(w => w.id === order.id)
      if (idx >= 0) {
        this.workOrders[idx] = order
      }
    },

    handleTeamPositionUpdated(team: RepairTeam) {
      const idx = this.repairTeams.findIndex(t => t.id === team.id)
      if (idx >= 0) {
        this.repairTeams[idx] = {
          ...this.repairTeams[idx],
          currentLongitude: team.currentLongitude,
          currentLatitude: team.currentLatitude,
          lastPositionUpdate: team.lastPositionUpdate,
          status: team.status,
          currentWorkOrderId: team.currentWorkOrderId
        }
      }
    },

    handleOutageZoneCreated(data: { workOrderId: string; zone: OutageZone }) {
      const idx = this.outageZones.findIndex(z => z.workOrderId === data.workOrderId)
      if (idx >= 0) {
        this.outageZones[idx] = data.zone
      } else {
        this.outageZones.push(data.zone)
      }
      this.addToast({
        type: 'warning',
        title: '停水区域已生成',
        message: `${data.zone.zoneName} 预计影响 ${data.zone.estimatedUserCount} 户用户`,
        duration: 8000
      })
    },

    handleTimeoutEscalated(data: {
      workOrderId: string
      orderNo: string
      oldPriority: number
      newPriority: number
    }) {
      const order = this.workOrders.find(w => w.id === data.workOrderId)
      if (order) {
        order.isTimeoutEscalated = true
        order.priority = data.newPriority
      }
      this.addToast({
        type: 'error',
        title: '工单超时告警',
        message: `工单 ${data.orderNo} 已超时，优先级从 ${'★'.repeat(data.oldPriority)} 升级为 ${'★'.repeat(data.newPriority)}`,
        duration: 8000
      })
    },

    async createWorkOrderFromLeak(leakId: string, title: string, description?: string) {
      try {
        const leak = this.leakEvents.find(l => l.id === leakId)
        if (!leak) return null

        const response = await fetchAPI<RepairWorkOrder>('/repair/work-orders', {
          method: 'POST',
          body: JSON.stringify({
            title,
            description: description || leak.description,
            leakEventId: leakId,
            priority: leak.severity === 'Critical' ? 4 : leak.severity === 'High' ? 3 : leak.severity === 'Medium' ? 2 : 1,
            longitude: leak.longitude,
            latitude: leak.latitude
          })
        })

        if (response) {
          const idx = this.workOrders.findIndex(w => w.id === response.id)
          if (idx < 0) this.workOrders.unshift(response)

          if (this.hubConnection?.state !== HubConnectionState.Connected) {
            leak.status = 'Confirmed'
            leak.confirmedAt = new Date().toISOString()
            leak.relatedWorkOrderId = response.id
            leak.updatedAt = new Date().toISOString()
            this.handleLeakEventUpdated(leak)
          }

          return response
        }
        return null
      } catch (error: any) {
        this.addToast({
          type: 'error',
          title: '创建工单失败',
          message: error?.message || '请稍后重试',
          duration: 4000
        })
        return null
      }
    },

    async dispatchWorkOrder(orderId: string, teamId: string) {
      try {
        const response = await fetchAPI<RepairWorkOrder>(`/repair/work-orders/${orderId}/dispatch`, {
          method: 'POST',
          body: JSON.stringify({ teamId })
        })

        if (response) {
          const idx = this.workOrders.findIndex(w => w.id === orderId)
          if (idx >= 0) this.workOrders[idx] = response

          const teamIdx = this.repairTeams.findIndex(t => t.id === teamId)
          if (teamIdx >= 0) {
            this.repairTeams[teamIdx].status = 'OnDuty'
            this.repairTeams[teamIdx].currentWorkOrderId = orderId
          }

          this.addToast({
            type: 'success',
            title: '工单已派发',
            message: `工单 ${response.orderNo} 已派发给 ${response.assignedTeam?.teamName || '抢修队'}`,
            duration: 3000
          })
          return true
        }
        return false
      } catch (error: any) {
        this.addToast({
          type: 'error',
          title: '派发工单失败',
          message: error?.message || '请稍后重试',
          duration: 4000
        })
        return false
      }
    },

    async updateWorkOrderStatus(orderId: string, newStatus: WorkOrderStatus, remark?: string) {
      try {
        const response = await fetchAPI<RepairWorkOrder>(`/repair/work-orders/${orderId}/status`, {
          method: 'POST',
          body: JSON.stringify({
            newStatus,
            operatorId: this.currentUser?.id,
            remark
          })
        })

        if (response) {
          const idx = this.workOrders.findIndex(w => w.id === orderId)
          if (idx >= 0) {
            const oldStatus = this.workOrders[idx].status
            this.workOrders[idx] = response

            if (newStatus === 'Completed' || newStatus === 'AcceptedClosed') {
              if (response.assignedTeamId) {
                const teamIdx = this.repairTeams.findIndex(t => t.id === response.assignedTeamId)
                if (teamIdx >= 0) {
                  this.repairTeams[teamIdx].status = 'Idle'
                  this.repairTeams[teamIdx].currentWorkOrderId = null
                }
              }
              if (response.leakEventId) {
                const leakIdx = this.leakEvents.findIndex(l => l.id === response.leakEventId)
                if (leakIdx >= 0) {
                  this.leakEvents[leakIdx].status = 'Resolved'
                  this.leakEvents[leakIdx].resolvedAt = new Date().toISOString()
                }
              }
            }
          }
          return true
        }
        return false
      } catch (error: any) {
        this.addToast({
          type: 'error',
          title: '状态更新失败',
          message: error?.message || '请稍后重试',
          duration: 4000
        })
        return false
      }
    },

    async predictOutageZone(valveIds: string[], plannedStartTime?: string, plannedEndTime?: string) {
      try {
        const response = await fetchAPI<OutageZone>('/repair/outage/predict', {
          method: 'POST',
          body: JSON.stringify({ valveIds, plannedStartTime, plannedEndTime })
        })
        return response
      } catch (error: any) {
        this.addToast({
          type: 'error',
          title: '停水推演失败',
          message: error?.message || '请稍后重试',
          duration: 4000
        })
        return null
      }
    },

    async saveOutageZone(workOrderId: string, zone: OutageZone) {
      try {
        const response = await fetchAPI<OutageZone>(`/repair/work-orders/${workOrderId}/outage`, {
          method: 'POST',
          body: JSON.stringify(zone)
        })
        return response
      } catch (error: any) {
        this.addToast({
          type: 'error',
          title: '保存停水区域失败',
          message: error?.message || '请稍后重试',
          duration: 4000
        })
        return null
      }
    },

    async updateTeamPosition(teamId: string, longitude: number, latitude: number) {
      try {
        if (this.hubConnection?.state === HubConnectionState.Connected) {
          await this.hubConnection.invoke('UpdateTeamPosition', teamId, longitude, latitude)
          return true
        }
        const response = await fetchAPI<RepairTeam>(`/repair/teams/${teamId}/position`, {
          method: 'POST',
          body: JSON.stringify({ longitude, latitude })
        })
        return !!response
      } catch (error) {
        console.warn('Update team position failed:', error)
        return false
      }
    },

    async submitPressureReading(nodeId: string, pressure: number, flow?: number) {
      try {
        const response = await fetchAPI<{ success: boolean; isAnomaly: boolean }>('/leak/monitor-nodes/reading', {
          method: 'POST',
          body: JSON.stringify({ nodeId, pressure, flow })
        })
        return response
      } catch (error) {
        console.warn('Submit pressure reading failed:', error)
        return null
      }
    },

    async locateLeak(abnormalNodeIds: string[]) {
      try {
        const response = await fetchAPI<LeakEvent>('/leak/detect/create-event', {
          method: 'POST',
          body: JSON.stringify({ abnormalNodeIds })
        })
        return response
      } catch (error: any) {
        this.addToast({
          type: 'error',
          title: '漏损定位失败',
          message: error?.message || '请稍后重试',
          duration: 4000
        })
        return null
      }
    },

    selectLeak(id: string | null) {
      this.selectedLeakId = id
      this.selectedWorkOrderId = null
    },

    selectWorkOrder(id: string | null) {
      this.selectedWorkOrderId = id
      this.selectedLeakId = null
    },

    selectTeam(id: string | null) {
      this.selectedTeamId = id
    },

    toggleMapStyle() {
      this.mapStyle = this.mapStyle === 'vector' ? 'satellite' : 'vector'
    },

    addToast(toast: Omit<ToastNotification, 'id'> & { id?: string }) {
      const id = toast.id || `toast-${Date.now()}-${Math.random()}`
      this.toasts.push({ ...toast, id })
      const duration = toast.duration ?? 4000
      if (duration > 0) {
        setTimeout(() => this.removeToast(id), duration)
      }
    },

    removeToast(id: string) {
      const idx = this.toasts.findIndex(t => t.id === id)
      if (idx >= 0) this.toasts.splice(idx, 1)
    },

    disconnect() {
      this.disconnectSignalR()
    }
  }
})
