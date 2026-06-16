export type CargoType = 'container' | 'bulk' | 'liquid' | 'general' | 'ro-ro'
export type UserRole = 'director' | 'dispatcher' | 'pilot' | 'agent'
export type VesselStatus = 'anchorage' | 'entering' | 'berthed' | 'loading' | 'unloading' | 'leaving' | 'departed'
export type ScheduleStatus = 'pending' | 'approved' | 'in_progress' | 'completed' | 'conflict' | 'rejected'
export type OperationType = 'load' | 'unload' | 'both'
export type BerthStatus = 'available' | 'occupied' | 'maintenance'
export type TideWindowType = 'high' | 'low'

export interface Port {
  id: string
  name: string
  berthCount: number
}

export interface Berth {
  id: string
  name: string
  portId: string
  length: number
  depth: number
  cargoTypes: CargoType[]
  status: BerthStatus
  x: number
  y: number
}

export interface Vessel {
  id: string
  name: string
  imo: string
  length: number
  draft: number
  cargoType: CargoType
  cargoWeight: number
  status: VesselStatus
  eta: Date
  etd?: Date
  position?: { x: number; y: number }
  route?: Waypoint[]
  progress?: number
}

export interface BerthSchedule {
  id: string
  vesselId: string
  berthId: string
  arrivalTime: Date
  departureTime: Date
  operationType: OperationType
  status: ScheduleStatus
  progress: number
  conflicts?: string[]
  cargoWeight: number
  cargoType: CargoType
  applicant?: string
}

export interface TideData {
  timestamp: Date
  height: number
  stationId: string
}

export interface TideWindow {
  startTime: Date
  endTime: Date
  minHeight: number
  type: TideWindowType
}

export interface Waypoint {
  x: number
  y: number
  timestamp: Date
  type: 'waypoint' | 'berth' | 'anchorage'
}

export interface TideStation {
  id: string
  name: string
  harmonicConstants: number[]
  baseHeight: number
}

export interface PendingApplication {
  id: string
  vesselName: string
  imo: string
  length: number
  draft: number
  cargoType: CargoType
  cargoWeight: number
  eta: Date
  operationType: OperationType
  applicant: string
  recommendedBerthId?: string
  recommendedTime?: { start: Date; end: Date }
  submittedAt: Date
}

export interface User {
  id: string
  name: string
  role: UserRole
  avatar?: string
}

export interface ThroughputStats {
  date: string
  portId: string
  cargoType: CargoType
  weight: number
}

export interface UtilizationData {
  berthId: string
  date: string
  hour: number
  occupied: boolean
}

export const CARGO_TYPE_LABELS: Record<CargoType, string> = {
  container: '集装箱',
  bulk: '散货',
  liquid: '液体散货',
  general: '件杂货',
  'ro-ro': '滚装'
}

export const VESSEL_STATUS_LABELS: Record<VesselStatus, string> = {
  anchorage: '锚地待泊',
  entering: '进港中',
  berthed: '已靠泊',
  loading: '装货中',
  unloading: '卸货中',
  leaving: '离港中',
  departed: '已离港'
}

export const SCHEDULE_STATUS_LABELS: Record<ScheduleStatus, string> = {
  pending: '待审批',
  approved: '已批准',
  in_progress: '作业中',
  completed: '已完成',
  conflict: '存在冲突',
  rejected: '已驳回'
}

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  director: '调度主任',
  dispatcher: '泊位调度员',
  pilot: '引航站',
  agent: '货代专员'
}
