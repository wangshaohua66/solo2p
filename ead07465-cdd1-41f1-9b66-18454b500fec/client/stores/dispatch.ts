import { defineStore } from 'pinia'
import type {
  Pipe, MonitorNode, LeakEvent, RepairWorkOrder, RepairTeam,
  Valve, OutageZone, UserAccount, ToastNotification, UserRole
} from '~/types'
import {
  generateMockData, generateMockLeakEvents, generateMockWorkOrders,
  generateMockOutageZones
} from '~/utils/api'

interface DispatchState {
  connected: boolean
  connecting: boolean
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
}

export const useDispatchStore = defineStore('dispatch', {
  state: (): DispatchState => ({
    connected: false,
    connecting: false,
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
    mapStyle: 'vector'
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
    }
  },

  actions: {
    async initMockData() {
      const mock = generateMockData()
      this.pipes = mock.pipes
      this.monitorNodes = mock.nodes
      this.repairTeams = mock.teams
      this.valves = mock.valves
      this.leakEvents = generateMockLeakEvents()
      this.workOrders = generateMockWorkOrders()
      this.outageZones = generateMockOutageZones()
    },

    async connectSignalR() {
      if (this.connecting || this.connected) return
      this.connecting = true
      await this.initMockData()
      this.connected = true
      this.connecting = false
      this.addToast({
        id: `toast-${Date.now()}`,
        type: 'success',
        title: '实时连接已建立',
        message: '正在接收 SCADA 数据与调度指令'
      })
      this.startPressureSimulation()
      this.startTeamPositionSimulation()
    },

    startPressureSimulation() {
      if (import.meta.server) return
      setInterval(() => {
        if (!this.connected) return
        for (const node of this.monitorNodes) {
          if (!node.isOnline) continue
          const delta = (Math.random() - 0.5) * 0.01
          const current = node.currentPressure ?? (node.normalPressureMin + node.normalPressureMax) / 2
          let newPressure = Math.max(0.05, Math.min(0.8, current + delta))

          if (Math.random() < 0.005) {
            newPressure = node.normalPressureMin * (0.5 + Math.random() * 0.3)
            node.hasAlarm = true
          }

          node.currentPressure = Math.round(newPressure * 10000) / 10000
          node.lastReadingTime = new Date().toISOString()
        }
      }, 2000)
    },

    startTeamPositionSimulation() {
      if (import.meta.server) return
      setInterval(() => {
        if (!this.connected) return
        for (const team of this.repairTeams) {
          if (team.status === 'Idle' || team.status === 'Resting') continue
          if (team.currentLongitude == null || team.currentLatitude == null) continue
          team.currentLongitude += (Math.random() - 0.5) * 0.0005
          team.currentLatitude += (Math.random() - 0.5) * 0.0005
          team.lastPositionUpdate = new Date().toISOString()
        }
      }, 5000)
    },

    handlePressureUpdated(data: { nodeId: string; pressure: number; flow?: number }) {
      const node = this.monitorNodes.find(n => n.id === data.nodeId)
      if (!node) return
      node.currentPressure = data.pressure
      node.currentFlow = data.flow ?? null
      node.lastReadingTime = new Date().toISOString()
    },

    handlePressureAlarm(data: { nodeId: string; code: string; name: string; pressure: number }) {
      const node = this.monitorNodes.find(n => n.id === data.nodeId)
      if (node) node.hasAlarm = true
      this.addToast({
        id: `toast-${Date.now()}-${Math.random()}`,
        type: 'warning',
        title: `压力异常告警`,
        message: `${data.name} (${data.code}) 当前压力 ${data.pressure.toFixed(3)} MPa`,
        duration: 5000
      })
    },

    handleNewLeakEvent(leak: LeakEvent) {
      const idx = this.leakEvents.findIndex(l => l.id === leak.id)
      if (idx >= 0) this.leakEvents[idx] = leak
      else this.leakEvents.unshift(leak)
      this.addToast({
        id: `toast-${Date.now()}`,
        type: leak.severity === 'Critical' ? 'error' : 'warning',
        title: '疑似漏损事件',
        message: `${leak.description ?? ''} 置信度 ${(leak.confidence * 100).toFixed(0)}%`,
        duration: 8000
      })
    },

    handleLeakEventUpdated(leak: LeakEvent) {
      const idx = this.leakEvents.findIndex(l => l.id === leak.id)
      if (idx >= 0) this.leakEvents[idx] = leak
    },

    handleWorkOrderCreated(order: RepairWorkOrder) {
      this.workOrders.unshift(order)
      this.addToast({
        id: `toast-${Date.now()}`,
        type: 'info',
        title: '新工单创建',
        message: order.title,
        duration: 5000
      })
    },

    handleWorkOrderUpdated(order: RepairWorkOrder) {
      const idx = this.workOrders.findIndex(w => w.id === order.id)
      if (idx >= 0) this.workOrders[idx] = order
    },

    handleTeamPositionUpdated(team: RepairTeam) {
      const idx = this.repairTeams.findIndex(t => t.id === team.id)
      if (idx >= 0) {
        this.repairTeams[idx] = {
          ...this.repairTeams[idx],
          currentLongitude: team.currentLongitude,
          currentLatitude: team.currentLatitude,
          lastPositionUpdate: team.lastPositionUpdate,
          status: team.status
        }
      }
    },

    handleOutageZoneCreated(data: { workOrderId: string; zone: OutageZone }) {
      const idx = this.outageZones.findIndex(z => z.workOrderId === data.workOrderId)
      if (idx >= 0) this.outageZones[idx] = data.zone
      else this.outageZones.push(data.zone)
      this.addToast({
        id: `toast-${Date.now()}`,
        type: 'warning',
        title: '停水区域已生成',
        message: `预计影响 ${data.zone.estimatedUserCount} 户用户`,
        duration: 6000
      })
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

    async createWorkOrderFromLeak(leakId: string, title: string, description?: string) {
      const leak = this.leakEvents.find(l => l.id === leakId)
      if (!leak) return null

      const order: RepairWorkOrder = {
        id: `wo-${Date.now()}`,
        orderNo: `WO${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${String(Math.floor(Math.random() * 9000) + 1000)}`,
        title,
        description: description || leak.description || '',
        status: 'Created',
        priority: leak.severity === 'Critical' ? 4 : leak.severity === 'High' ? 3 : leak.severity === 'Medium' ? 2 : 1,
        longitude: leak.longitude,
        latitude: leak.latitude,
        address: null,
        leakEventId: leak.id,
        assignedTeamId: null,
        assignedTeam: null,
        deadline: new Date(Date.now() + 30 * 60000).toISOString(),
        isTimeoutEscalated: false,
        createdBy: this.currentUser?.id ?? null,
        acceptedBy: null,
        statusLogs: [{
          id: `log-${Date.now()}`,
          workOrderId: '',
          fromStatus: 'Created',
          toStatus: 'Created',
          remark: '工单创建',
          operatorId: this.currentUser?.id ?? null,
          createdAt: new Date().toISOString()
        }],
        valveOperations: [],
        outageZone: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        acceptedAt: null,
        onSiteAt: null,
        completedAt: null
      }

      this.handleWorkOrderCreated(order)

      leak.status = 'Confirmed'
      leak.confirmedAt = new Date().toISOString()
      leak.relatedWorkOrderId = order.id
      leak.updatedAt = new Date().toISOString()
      this.handleLeakEventUpdated(leak)

      return order
    },

    async dispatchWorkOrder(orderId: string, teamId: string) {
      const order = this.workOrders.find(w => w.id === orderId)
      const team = this.repairTeams.find(t => t.id === teamId)
      if (!order || !team) return false

      order.status = 'Dispatched'
      order.assignedTeamId = teamId
      order.assignedTeam = team
      order.updatedAt = new Date().toISOString()
      team.status = 'OnDuty'
      team.currentWorkOrderId = orderId
      team.updatedAt = new Date().toISOString()
      this.handleWorkOrderUpdated(order)

      this.addToast({
        type: 'success',
        title: '工单已派发',
        message: `工单 ${order.orderNo} 已派发给 ${team.teamName}`,
        duration: 3000
      })
      return true
    },

    async updateWorkOrderStatus(orderId: string, newStatus: string) {
      const order = this.workOrders.find(w => w.id === orderId)
      if (!order) return false

      const oldStatus = order.status
      order.status = newStatus as RepairWorkOrder['status']
      order.updatedAt = new Date().toISOString()

      if (newStatus === 'Accepted') order.acceptedAt = new Date().toISOString()
      if (newStatus === 'OnSite') order.onSiteAt = new Date().toISOString()
      if (newStatus === 'Completed' || newStatus === 'AcceptedClosed') {
        order.completedAt = new Date().toISOString()
        order.isTimeoutEscalated = false
        if (order.assignedTeamId) {
          const team = this.repairTeams.find(t => t.id === order.assignedTeamId)
          if (team) {
            team.status = 'Idle'
            team.currentWorkOrderId = null
            team.updatedAt = new Date().toISOString()
          }
        }
        if (order.leakEventId) {
          const leak = this.leakEvents.find(l => l.id === order.leakEventId)
          if (leak) {
            leak.status = 'Resolved'
            leak.resolvedAt = new Date().toISOString()
            leak.updatedAt = new Date().toISOString()
            this.handleLeakEventUpdated(leak)
          }
        }
      }

      order.statusLogs.push({
        id: `log-${Date.now()}`,
        workOrderId: orderId,
        fromStatus: oldStatus,
        toStatus: newStatus as RepairWorkOrder['status'],
        remark: `状态变更: ${oldStatus} → ${newStatus}`,
        operatorId: this.currentUser?.id ?? null,
        createdAt: new Date().toISOString()
      })

      this.handleWorkOrderUpdated(order)
      return true
    },

    disconnect() {
      this.connected = false
    }
  }
})
