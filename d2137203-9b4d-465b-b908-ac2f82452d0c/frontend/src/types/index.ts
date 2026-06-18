export interface User {
  id: string
  username: string
  realName: string
  email?: string
  phone?: string
  role: string
  unitId?: string
  area?: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface Device {
  id: string
  registrationCode: string
  deviceType: string
  deviceName: string
  model?: string
  manufacturer?: string
  manufactureDate?: string
  installationDate?: string
  acceptanceDate?: string
  unitId: string
  location?: string
  area?: string
  safetyLevel?: string
  status: string
  lastInspectionDate?: string
  nextInspectionDate?: string
  inspectionCycleMonths?: number
  customCycleMonths?: number
  createdAt: string
  updatedAt: string
}

export interface Inspection {
  id: string
  deviceId: string
  inspectionType: string
  inspectorId?: string
  planDate?: string
  actualDate?: string
  status: string
  conclusion?: string
  safetyLevel?: string
  reportNumber?: string
  reportUrl?: string
  findings?: string
  nextInspectionDate?: string
  createdAt: string
  updatedAt: string
}

export interface Hazard {
  id: string
  deviceId: string
  inspectionId?: string
  hazardType: string
  description: string
  severity: string
  status: string
  inspectorId?: string
  unitContactId?: string
  deadline?: string
  rectificationDescription?: string
  rectificationFiles?: any
  reviewDate?: string
  reviewResult?: string
  reviewerId?: string
  supervisionLevel: string
  createdAt: string
  updatedAt: string
}

export interface TimelineEvent {
  id: string
  eventType: string
  eventDate: string
  title: string
  description: string
  operator?: string
  createdAt: string
}

export interface ApiResponse<T> {
  code: number
  message: string
  data?: T
}

export interface ListResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface DeviceStats {
  total: number
  byType: TypeCount[]
  expired: number
  warning: number
  normal: number
}

export interface TypeCount {
  deviceType: string
  count: number
}

export interface InspectionStats {
  total: number
  completed: number
  pending: number
  inProgress: number
  completionRate: number
}

export interface HazardStats {
  total: number
  bySeverity: SeverityCount[]
  byStatus: StatusCount[]
  pending: number
  rectifying: number
  closed: number
}

export interface SeverityCount {
  severity: string
  count: number
}

export interface StatusCount {
  status: string
  count: number
}

export interface AreaStats {
  area: string
  deviceCount: number
  expiredCount: number
}

export const DeviceTypeMap: Record<string, string> = {
  elevator: '电梯',
  boiler: '锅炉',
  pressure_vessel: '压力容器',
  crane: '起重机械',
}

export const InspectionStatusMap: Record<string, string> = {
  pending: '待检验',
  in_progress: '检验中',
  completed: '已完成',
  cancelled: '已取消',
}

export const HazardStatusMap: Record<string, string> = {
  pending: '待整改',
  rectifying: '整改中',
  reviewing: '待复查',
  closed: '已关闭',
  supervised: '督办中',
}

export const HazardSeverityMap: Record<string, string> = {
  minor: '一般',
  major: '严重',
  critical: '重大',
}

export const UserRoleMap: Record<string, string> = {
  admin: '系统管理员',
  inspector: '监察员',
  inspector_user: '检验师',
  unit_contact: '使用单位联络人',
}
