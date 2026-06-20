export interface Location {
  lat: number
  lng: number
  address: string
}

export type VehicleType = 'hearse' | 'family_car'
export type VehicleStatus = 'idle' | 'on_mission' | 'maintenance'

export interface Vehicle {
  id: string
  plateNumber: string
  type: VehicleType
  model: string
  status: VehicleStatus
  currentLocation: Location
  lastUpdateTime: string
  driverId: string
  driverName: string
  driverPhone: string
  capacity: number
  purchaseDate?: string
  mileage?: number
  maintenanceCycle?: string
}

export type MissionStatus = 'pending' | 'assigned' | 'picking' | 'arrived' | 'completed' | 'cancelled' | 'urgent'

export interface PickupMission {
  id: string
  code: string
  remainsId: string
  remainsName: string
  pickupLocation: Location
  destination: Location
  appointmentTime: string
  vehicleId?: string
  vehiclePlate?: string
  driverId?: string
  driverName?: string
  driverPhone?: string
  status: MissionStatus
  distanceKm?: number
  estimatedDuration?: number
  actualDepartTime?: string
  actualArriveTime?: string
  actualCompleteTime?: string
  routePoints?: Location[]
  createTime: string
  createOperator?: string
  remark?: string
  isUrgent: boolean
}

export interface VehicleTracePoint {
  missionId: string
  time: string
  location: Location
  speed?: number
  heading?: number
}

export interface DispatchRecord {
  id: string
  missionId: string
  vehicleId: string
  operatorId: string
  operatorName: string
  action: 'assign' | 'reassign' | 'recall' | 'urgent'
  oldVehicleId?: string
  time: string
  reason?: string
}
