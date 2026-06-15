export enum EventStatus {
  PENDING = 'PENDING',
  DISPATCHED = 'DISPATCHED',
  EN_ROUTE = 'EN_ROUTE',
  ON_SCENE = 'ON_SCENE',
  TRANSPORTING = 'TRANSPORTING',
  ARRIVED_HOSPITAL = 'ARRIVED_HOSPITAL',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum Severity {
  MINOR = 'MINOR',
  MODERATE = 'MODERATE',
  SEVERE = 'SEVERE',
  CRITICAL = 'CRITICAL'
}

export interface EmergencyCallRequest {
  callerName: string
  callerPhone: string
  incidentAddress: string
  longitude: number
  latitude: number
  chiefComplaint: string
  severity: Severity
  patientCount: number
}

export interface DispatchCommandRequest {
  eventId: number
  ambulanceId: number
  hospitalId?: number
  priority?: string
}

export interface EventStatusUpdateRequest {
  status: EventStatus
  longitude?: number
  latitude?: number
  remark?: string
}

export interface VehicleRecommendation {
  ambulanceId: number
  plateNumber: string
  status: string
  distanceMeters: number
  estimatedArrivalMinutes: number
  averageSpeedKmh: number
  equipmentLevel: string
}

export interface DispatchEventSummary {
  id: number
  eventNo: string
  status: EventStatus
  severity: Severity
  incidentAddress: string
  callerName: string
  callerPhone: string
  chiefComplaint: string
  ambulancePlateNumber?: string
  receivedAt: string
  dispatchedAt?: string
}

export interface DispatchEventDetail {
  id: number
  eventNo: string
  status: EventStatus
  severity: Severity
  callerName: string
  callerPhone: string
  incidentAddress: string
  longitude?: number
  latitude?: number
  chiefComplaint: string
  patientCount: number
  receivedAt: string
  dispatchedAt?: string
  departedAt?: string
  arrivedAtScene?: string
  departedScene?: string
  arrivedAtHospital?: string
  completedAt?: string
  priority: string
  remark?: string
  ambulance?: {
    id: number
    plateNumber: string
    status: string
    equipmentLevel: string
    driverName?: string
    driverPhone?: string
  }
  hospital?: {
    id: number
    name: string
    level: string
    address: string
    phone: string
  }
  dispatcher?: {
    id: number
    realName: string
    department: string
  }
  doctor?: {
    id: number
    realName: string
    phone?: string
  }
  driver?: {
    id: number
    realName: string
    phone?: string
  }
  timeline?: Array<{
    status: string
    statusText: string
    time?: string
    longitude?: number
    latitude?: number
    remark?: string
  }>
}

export interface VehicleStatusUpdate {
  ambulanceId: number
  plateNumber: string
  status: string
  longitude: number
  latitude: number
  speedKmh: number
  heading?: number
  altitude?: number
  accuracy?: number
  timestamp: string
}

export interface LocationDto {
  id?: number
  ambulanceId: number
  longitude: number
  latitude: number
  speedKmh?: number
  heading?: number
  altitude?: number
  accuracy?: number
  timestamp: string
}

export interface NearbyVehicleRequest {
  longitude: number
  latitude: number
  radiusKm: number
  statuses: string[]
}

export interface PageResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}
