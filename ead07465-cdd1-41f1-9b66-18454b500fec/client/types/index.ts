export interface GeoPoint {
  longitude: number
  latitude: number
}

export interface Pipe {
  id: string
  code: string
  name: string
  diameter: number
  material: string
  installYear: number
  buriedDepth: number
  length: number
  geometry: GeoPoint[]
  startNodeId: string
  endNodeId: string
  repairCount: number
  healthScore: number
  riskLevel: number
  createdAt: string
  updatedAt: string
}

export interface MonitorNode {
  id: string
  code: string
  name: string
  longitude: number
  latitude: number
  normalPressureMin: number
  normalPressureMax: number
  currentPressure: number | null
  currentFlow: number | null
  lastReadingTime: string | null
  isOnline: boolean
  hasAlarm: boolean
  scadaStation: string | null
  createdAt: string
  updatedAt: string
}

export interface PressureReading {
  id: number
  nodeId: string
  pressure: number
  flow: number | null
  readingTime: string
  isAnomaly: boolean
  anomalyType: string | null
}

export type LeakEventStatus = 'Detected' | 'Confirmed' | 'Repairing' | 'Resolved' | 'FalseAlarm'
export type LeakSeverity = 'Low' | 'Medium' | 'High' | 'Critical'

export interface LeakCandidatePoint {
  longitude: number
  latitude: number
  probability: number
}

export interface LeakEvent {
  id: string
  eventNo: string
  status: LeakEventStatus
  severity: LeakSeverity
  longitude: number
  latitude: number
  confidence: number
  estimatedRadius: number | null
  description: string | null
  source: string | null
  abnormalNodeIds: string[]
  candidatePoints: LeakCandidatePoint[]
  nearestNodeId: string | null
  distanceToNearestNode: number | null
  relatedWorkOrderId: string | null
  detectedAt: string
  confirmedAt: string | null
  resolvedAt: string | null
  confirmedBy: string | null
  createdAt: string
  updatedAt: string
}

export type WorkOrderStatus = 'Created' | 'Dispatched' | 'Accepted' | 'OnSite' | 'Repairing' | 'Completed' | 'AcceptedClosed' | 'Cancelled'

export interface WorkOrderStatusLog {
  id: string
  workOrderId: string
  fromStatus: WorkOrderStatus
  toStatus: WorkOrderStatus
  remark: string | null
  operatorId: string | null
  createdAt: string
}

export interface RepairWorkOrder {
  id: string
  orderNo: string
  title: string
  description: string | null
  status: WorkOrderStatus
  priority: number
  longitude: number
  latitude: number
  address: string | null
  leakEventId: string | null
  assignedTeamId: string | null
  assignedTeam: RepairTeam | null
  deadline: string | null
  isTimeoutEscalated: boolean
  createdBy: string | null
  acceptedBy: string | null
  statusLogs: WorkOrderStatusLog[]
  valveOperations: ValveOperation[]
  outageZone: OutageZone | null
  createdAt: string
  updatedAt: string
  acceptedAt: string | null
  onSiteAt: string | null
  completedAt: string | null
}

export type TeamStatus = 'Idle' | 'OnDuty' | 'OnSite' | 'Repairing' | 'Resting'

export interface RepairTeam {
  id: string
  teamCode: string
  teamName: string
  status: TeamStatus
  leaderName: string | null
  leaderPhone: string | null
  memberCount: number
  vehicles: string[]
  equipment: string[]
  currentLongitude: number | null
  currentLatitude: number | null
  lastPositionUpdate: string | null
  district: string
  currentWorkOrderId: string | null
  createdAt: string
  updatedAt: string
}

export interface Valve {
  id: string
  code: string
  name: string
  longitude: number
  latitude: number
  diameter: number
  valveType: string | null
  isOpen: boolean
  downstreamPipeId: string | null
  affectedPipeIds: string[]
  createdAt: string
  updatedAt: string
}

export interface ValveOperation {
  id: string
  workOrderId: string
  valveId: string
  targetState: boolean
  isCompleted: boolean
  completedAt: string | null
  operatorId: string | null
  createdAt: string
}

export interface OutageZone {
  id: string
  workOrderId: string
  zoneName: string
  polygon: GeoPoint[]
  affectedPipeIds: string[]
  affectedValveIds: string[]
  estimatedUserCount: number
  notificationText: string | null
  isApproved: boolean
  approvedBy: string | null
  approvedAt: string | null
  plannedStartTime: string | null
  plannedEndTime: string | null
  createdAt: string
}

export type UserRole = 'DispatchDirector' | 'Dispatcher' | 'RepairLeader' | 'Inspector'

export interface UserAccount {
  id: string
  username: string
  displayName: string
  role: UserRole
  phone: string | null
  district: string | null
  isOnline: boolean
  lastLoginTime: string | null
  createdAt: string
}

export type InspectionStatus = 'Pending' | 'InProgress' | 'Completed' | 'ExceptionReported'

export interface InspectionReport {
  id: string
  taskId: string
  longitude: number
  latitude: number
  description: string | null
  isAbnormal: boolean
  photoUrls: string[]
  reporterId: string | null
  reportTime: string
}

export interface InspectionTask {
  id: string
  taskNo: string
  title: string
  status: InspectionStatus
  inspectorId: string | null
  inspectorName: string | null
  targetPipeIds: string[]
  routePoints: GeoPoint[]
  planStartTime: string | null
  planEndTime: string | null
  actualStartTime: string | null
  actualEndTime: string | null
  remark: string | null
  reports: InspectionReport[]
  relatedLeakEventId: string | null
  createdAt: string
  updatedAt: string
}

export interface ToastNotification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message?: string
  duration?: number
}
