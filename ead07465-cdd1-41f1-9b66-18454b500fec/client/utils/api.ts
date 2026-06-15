import type {
  Pipe, MonitorNode, LeakEvent, RepairWorkOrder, RepairTeam,
  Valve, OutageZone, UserRole
} from '~/types'

export const API_BASE = 'http://localhost:5000/api'

export async function fetchAPI<T>(path: string, options: RequestInit = {}): Promise<T> {
  const config = useRuntimeConfig()
  const baseURL = config.public.apiBase as string
  const url = path.startsWith('http') ? path : `${baseURL}${path}`

  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  })

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'Critical': return '#dc2626'
    case 'High': return '#ea580c'
    case 'Medium': return '#d97706'
    case 'Low': return '#16a34a'
    default: return '#6b7280'
  }
}

export function getSeverityLabel(severity: string): string {
  switch (severity) {
    case 'Critical': return '危急'
    case 'High': return '高'
    case 'Medium': return '中'
    case 'Low': return '低'
    default: return '未知'
  }
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    Detected: '#ef4444',
    Confirmed: '#f97316',
    Repairing: '#3b82f6',
    Resolved: '#22c55e',
    FalseAlarm: '#6b7280',
    Created: '#6366f1',
    Dispatched: '#8b5cf6',
    Accepted: '#0ea5e9',
    OnSite: '#f59e0b',
    Completed: '#22c55e',
    AcceptedClosed: '#10b981',
    Cancelled: '#6b7280',
    Idle: '#22c55e',
    OnDuty: '#3b82f6',
    OnSite: '#f59e0b',
    Repairing: '#ef4444',
    Resting: '#6b7280'
  }
  return map[status] || '#6b7280'
}

export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    Detected: '已检测',
    Confirmed: '已确认',
    Repairing: '修复中',
    Resolved: '已解决',
    FalseAlarm: '误报',
    Created: '待派发',
    Dispatched: '已派发',
    Accepted: '已接单',
    OnSite: '已到场',
    Completed: '待验收',
    AcceptedClosed: '已关闭',
    Cancelled: '已取消',
    Idle: '空闲',
    OnDuty: '出勤中',
    OnSite: '到场作业',
    Repairing: '抢修中',
    Resting: '休整'
  }
  return map[status] || status
}

export function getRoleLabel(role: UserRole): string {
  switch (role) {
    case 'DispatchDirector': return '调度主任'
    case 'Dispatcher': return '值班调度员'
    case 'RepairLeader': return '抢修班长'
    case 'Inspector': return '巡检员'
    default: return role
  }
}

export function getPressureColor(pressure: number, min: number, max: number): string {
  if (pressure < min || pressure > max) return '#ef4444'
  const ratio = (pressure - min) / (max - min)
  if (ratio < 0.3) return '#3b82f6'
  if (ratio < 0.7) return '#22c55e'
  return '#eab308'
}

export function formatTime(isoString: string | null): string {
  if (!isoString) return '-'
  const d = new Date(isoString)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function formatDateTime(isoString: string | null): string {
  if (!isoString) return '-'
  const d = new Date(isoString)
  return d.toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  })
}

export function relativeTime(isoString: string | null): string {
  if (!isoString) return '-'
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  return `${Math.floor(hours / 24)} 天前`
}

export function generateMockData(): {
  pipes: Pipe[]
  nodes: MonitorNode[]
  teams: RepairTeam[]
  valves: Valve[]
} {
  const centerLng = 116.404
  const centerLat = 39.915
  const pipes: Pipe[] = []
  const nodes: MonitorNode[] = []
  const teams: RepairTeam[] = []
  const valves: Valve[] = []

  const materials = ['球墨铸铁', '铸铁', '钢管', 'PE', 'PVC']
  for (let i = 0; i < 40; i++) {
    const startLng = centerLng + (Math.random() - 0.5) * 0.15
    const startLat = centerLat + (Math.random() - 0.5) * 0.12
    const endLng = startLng + (Math.random() - 0.5) * 0.03
    const endLat = startLat + (Math.random() - 0.5) * 0.03
    const installYear = 1985 + Math.floor(Math.random() * 38)
    const repairCount = Math.floor(Math.random() * 5)
    const age = 2025 - installYear
    const health = Math.max(30, 95 - age * 1.5 - repairCount * 10)

    pipes.push({
      id: `pipe-${i}`,
      code: `P${String(i + 1).padStart(5, '0')}`,
      name: `供水管${i + 1}号线`,
      diameter: [100, 200, 300, 400, 600][Math.floor(Math.random() * 5)],
      material: materials[Math.floor(Math.random() * materials.length)],
      installYear,
      buriedDepth: 0.8 + Math.random() * 1.5,
      length: 200 + Math.random() * 800,
      geometry: [
        { longitude: startLng, latitude: startLat },
        { longitude: (startLng + endLng) / 2, latitude: (startLat + endLat) / 2 },
        { longitude: endLng, latitude: endLat }
      ],
      startNodeId: `node-${i * 2}`,
      endNodeId: `node-${i * 2 + 1}`,
      repairCount,
      healthScore: health,
      riskLevel: health >= 80 ? 1 : health >= 60 ? 2 : health >= 40 ? 3 : 4,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    })
  }

  for (let i = 0; i < 80; i++) {
    const lng = centerLng + (Math.random() - 0.5) * 0.18
    const lat = centerLat + (Math.random() - 0.5) * 0.14
    const pMin = 0.15
    const pMax = 0.45
    const basePressure = pMin + Math.random() * (pMax - pMin)
    const hasAlarm = Math.random() < 0.08

    nodes.push({
      id: `node-${i}`,
      code: `M${String(i + 1).padStart(5, '0')}`,
      name: `监测点 ${i + 1}`,
      longitude: lng,
      latitude: lat,
      normalPressureMin: pMin,
      normalPressureMax: pMax,
      currentPressure: hasAlarm ? pMin * 0.7 + Math.random() * 0.05 : basePressure,
      currentFlow: 10 + Math.random() * 100,
      lastReadingTime: new Date(Date.now() - Math.random() * 60000).toISOString(),
      isOnline: Math.random() > 0.05,
      hasAlarm,
      scadaStation: `SCADA-${String.fromCharCode(65 + Math.floor(Math.random() * 5))}`,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    })
  }

  const districts = ['东城区', '西城区', '朝阳区', '海淀区', '丰台区']
  const teamStatuses: Array<'Idle' | 'OnDuty' | 'OnSite' | 'Repairing' | 'Resting'> = ['Idle', 'OnDuty', 'OnSite', 'Repairing', 'Resting']
  for (let i = 0; i < 12; i++) {
    teams.push({
      id: `team-${i}`,
      teamCode: `RX${String(i + 1).padStart(3, '0')}`,
      teamName: `抢修${i + 1}队`,
      status: teamStatuses[Math.floor(Math.random() * teamStatuses.length)],
      leaderName: ['张', '李', '王', '赵', '刘', '陈'][Math.floor(Math.random() * 6)] + '班长',
      leaderPhone: `138****${String(1000 + Math.floor(Math.random() * 8999))}`,
      memberCount: 3 + Math.floor(Math.random() * 4),
      vehicles: [`抢修车-${i + 1}`],
      equipment: ['测漏仪', '抢修工具包'],
      currentLongitude: centerLng + (Math.random() - 0.5) * 0.15,
      currentLatitude: centerLat + (Math.random() - 0.5) * 0.12,
      lastPositionUpdate: new Date(Date.now() - Math.random() * 15000).toISOString(),
      district: districts[Math.floor(Math.random() * districts.length)],
      currentWorkOrderId: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    })
  }

  for (let i = 0; i < 60; i++) {
    valves.push({
      id: `valve-${i}`,
      code: `V${String(i + 1).padStart(5, '0')}`,
      name: `阀门 ${i + 1}`,
      longitude: centerLng + (Math.random() - 0.5) * 0.18,
      latitude: centerLat + (Math.random() - 0.5) * 0.14,
      diameter: [100, 150, 200, 300, 400][Math.floor(Math.random() * 5)],
      valveType: ['闸阀', '蝶阀', '球阀'][Math.floor(Math.random() * 3)],
      isOpen: Math.random() > 0.1,
      downstreamPipeId: pipes[Math.floor(Math.random() * pipes.length)].id,
      affectedPipeIds: pipes.slice(0, 3 + Math.floor(Math.random() * 5)).map(p => p.id),
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    })
  }

  return { pipes, nodes, teams, valves }
}

export function generateMockLeakEvents(): LeakEvent[] {
  const centerLng = 116.404
  const centerLat = 39.915
  const events: LeakEvent[] = []
  const severities: Array<'Critical' | 'High' | 'Medium' | 'Low'> = ['Critical', 'High', 'Medium', 'Low']
  const statuses: Array<'Detected' | 'Confirmed' | 'Repairing' | 'Resolved'> = ['Detected', 'Confirmed', 'Repairing', 'Resolved']

  for (let i = 0; i < 8; i++) {
    const lng = centerLng + (Math.random() - 0.5) * 0.1
    const lat = centerLat + (Math.random() - 0.5) * 0.08
    const confidence = 0.55 + Math.random() * 0.4
    const candidates = []
    for (let j = 0; j < 50; j++) {
      candidates.push({
        longitude: lng + (Math.random() - 0.5) * 0.006,
        latitude: lat + (Math.random() - 0.5) * 0.006,
        probability: 0.2 + Math.random() * 0.8
      })
    }

    events.push({
      id: `leak-${i}`,
      eventNo: `LK202506${String(1500 + i).padStart(4, '0')}`,
      status: statuses[i < 5 ? Math.floor(Math.random() * 3) : 3],
      severity: severities[Math.floor(Math.random() * severities.length)],
      longitude: lng,
      latitude: lat,
      confidence,
      estimatedRadius: 80 + Math.random() * 150,
      description: ['疑似管段腐蚀泄漏', '压力异常下降', '居民报修疑似爆管', '夜间流量异常'][i % 4],
      source: i % 3 === 0 ? '居民报修' : 'AutoDetect',
      abnormalNodeIds: ['node-1', 'node-2', 'node-3'].slice(0, 1 + Math.floor(Math.random() * 3)),
      candidatePoints: candidates,
      nearestNodeId: 'node-1',
      distanceToNearestNode: 30 + Math.random() * 180,
      relatedWorkOrderId: i > 2 ? `wo-${i}` : null,
      detectedAt: new Date(Date.now() - i * 3600000 * 2 - Math.random() * 3600000).toISOString(),
      confirmedAt: i > 0 ? new Date(Date.now() - i * 3600000).toISOString() : null,
      resolvedAt: i >= 5 ? new Date(Date.now() - (i - 4) * 7200000).toISOString() : null,
      confirmedBy: null,
      createdAt: new Date(Date.now() - i * 3600000 * 2).toISOString(),
      updatedAt: new Date().toISOString()
    })
  }
  return events
}

export function generateMockWorkOrders(): RepairWorkOrder[] {
  const centerLng = 116.404
  const centerLat = 39.915
  const orders: RepairWorkOrder[] = []
  const statuses: Array<'Created' | 'Dispatched' | 'Accepted' | 'OnSite' | 'Repairing' | 'Completed' | 'AcceptedClosed'>
    = ['Created', 'Dispatched', 'Accepted', 'OnSite', 'Repairing', 'Completed', 'AcceptedClosed']

  for (let i = 0; i < 10; i++) {
    const status = statuses[i % statuses.length]
    orders.push({
      id: `wo-${i}`,
      orderNo: `WO202506${String(1500 + i).padStart(4, '0')}`,
      title: ['供水管DN300泄漏抢修', '阀门更换维修', '压力异常排查', '爆管紧急抢修'][i % 4],
      description: '现场需关阀停水作业，请配合调度',
      status,
      priority: 1 + Math.floor(Math.random() * 4),
      longitude: centerLng + (Math.random() - 0.5) * 0.12,
      latitude: centerLat + (Math.random() - 0.5) * 0.1,
      address: ['东城区建国门内大街', '西城区西直门外大街', '朝阳区建国路', '海淀区中关村大街'][i % 4],
      leakEventId: i < 5 ? `leak-${i}` : null,
      assignedTeamId: i > 0 ? `team-${i % 12}` : null,
      assignedTeam: null,
      deadline: new Date(Date.now() + (30 - i * 5) * 60000).toISOString(),
      isTimeoutEscalated: i < 2,
      createdBy: null,
      acceptedBy: null,
      statusLogs: [],
      valveOperations: [],
      outageZone: null,
      createdAt: new Date(Date.now() - i * 1800000).toISOString(),
      updatedAt: new Date(Date.now() - i * 900000).toISOString(),
      acceptedAt: status !== 'Created' ? new Date(Date.now() - i * 1500000).toISOString() : null,
      onSiteAt: ['OnSite', 'Repairing', 'Completed', 'AcceptedClosed'].includes(status)
        ? new Date(Date.now() - i * 1200000).toISOString() : null,
      completedAt: ['Completed', 'AcceptedClosed'].includes(status)
        ? new Date(Date.now() - i * 600000).toISOString() : null
    })
  }
  return orders
}

export function generateMockOutageZones(): OutageZone[] {
  const centerLng = 116.404
  const centerLat = 39.915
  return [{
    id: 'zone-1',
    workOrderId: 'wo-0',
    zoneName: '东城区建国门周边区域',
    polygon: [
      { longitude: centerLng - 0.01, latitude: centerLat - 0.008 },
      { longitude: centerLng + 0.012, latitude: centerLat - 0.006 },
      { longitude: centerLng + 0.015, latitude: centerLat + 0.008 },
      { longitude: centerLng - 0.008, latitude: centerLat + 0.01 }
    ],
    affectedPipeIds: ['pipe-1', 'pipe-2', 'pipe-5'],
    affectedValveIds: ['valve-3', 'valve-7'],
    estimatedUserCount: 1280,
    notificationText: '【停水通知】因管网维修，预计今日14:00-18:00东城区建国门周边区域停水...',
    isApproved: false,
    approvedBy: null,
    approvedAt: null,
    plannedStartTime: new Date(Date.now() + 3600000).toISOString(),
    plannedEndTime: new Date(Date.now() + 3600000 * 5).toISOString(),
    createdAt: new Date().toISOString()
  }]
}
