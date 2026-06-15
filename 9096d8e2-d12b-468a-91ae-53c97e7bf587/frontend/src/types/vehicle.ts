export enum AmbulanceStatus {
  AVAILABLE = 'AVAILABLE',
  ON_CALL = 'ON_CALL',
  ON_SCENE = 'ON_SCENE',
  TRANSPORTING = 'TRANSPORTING',
  MAINTENANCE = 'MAINTENANCE',
  OUT_OF_SERVICE = 'OUT_OF_SERVICE'
}

export enum MaintenanceType {
  ROUTINE = 'ROUTINE',
  REPAIR = 'REPAIR',
  INSPECTION = 'INSPECTION',
  EQUIPMENT_CHECK = 'EQUIPMENT_CHECK'
}

export enum MaintenanceStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  OVERDUE = 'OVERDUE'
}

export enum SupplyCategory {
  MEDICATION = 'MEDICATION',
  EQUIPMENT = 'EQUIPMENT',
  CONSUMABLE = 'CONSUMABLE',
  EMERGENCY = 'EMERGENCY'
}

export interface Ambulance {
  id: number
  plateNumber: string
  vehicleType: string
  equipmentLevel: string
  status: AmbulanceStatus
  currentMileage: number
  lastMaintenanceDate?: string
  nextMaintenanceDate?: string
  maintenanceIntervalKm: number
  driverName?: string
  driverPhone?: string
  currentLongitude?: number
  currentLatitude?: number
  currentSpeed?: number
  lastGpsUpdate?: string
  isOverdueMaintenance: boolean
  createdAt: string
  updatedAt: string
}

export interface AmbulanceCreateRequest {
  plateNumber: string
  vehicleType: string
  equipmentLevel: string
  maintenanceIntervalKm: number
  driverName?: string
  driverPhone?: string
  initialMileage?: number
}

export interface AmbulanceUpdateRequest {
  status?: AmbulanceStatus
  currentMileage?: number
  driverName?: string
  driverPhone?: string
}

export interface VehicleMaintenance {
  id: number
  ambulanceId: number
  ambulancePlateNumber: string
  maintenanceType: MaintenanceType
  maintenanceStatus: MaintenanceStatus
  description: string
  scheduledDate: string
  startDate?: string
  completionDate?: string
  mileageAtMaintenance?: number
  cost?: number
  performedBy?: string
  notes?: string
  nextDueDate?: string
  nextDueMileage?: number
  createdAt: string
}

export interface MaintenanceCreateRequest {
  ambulanceId: number
  maintenanceType: MaintenanceType
  description: string
  scheduledDate: string
  mileageAtMaintenance?: number
  cost?: number
  performedBy?: string
  notes?: string
  nextDueDate?: string
  nextDueMileage?: number
}

export interface MaintenanceUpdateRequest {
  maintenanceStatus?: MaintenanceStatus
  startDate?: string
  completionDate?: string
  description?: string
  cost?: number
  performedBy?: string
  notes?: string
}

export interface MedicalSupply {
  id: number
  name: string
  sku: string
  category: SupplyCategory
  description?: string
  unit: string
  quantity: number
  minStock: number
  reorderLevel: number
  unitPrice?: number
  batchNumber?: string
  expirationDate?: string
  location?: string
  ambulanceId?: number
  ambulancePlateNumber?: string
  isExpired: boolean
  isLowStock: boolean
  createdAt: string
  updatedAt: string
}

export interface SupplyCreateRequest {
  name: string
  sku: string
  category: SupplyCategory
  unit: string
  quantity: number
  minStock: number
  reorderLevel: number
  unitPrice?: number
  description?: string
  batchNumber?: string
  expirationDate?: string
  location?: string
  ambulanceId?: number
}

export interface SupplyUpdateRequest {
  quantity?: number
  minStock?: number
  reorderLevel?: number
  expirationDate?: string
  location?: string
  ambulanceId?: number
}

export interface SupplyTransactionRequest {
  supplyId: number
  quantity: number
  transactionType: 'IN' | 'OUT'
  referenceNo?: string
  notes?: string
}

export interface VehicleStats {
  totalVehicles: number
  availableVehicles: number
  onCallVehicles: number
  maintenanceVehicles: number
  overdueMaintenance: number
  lowStockItems: number
  expiredItems: number
  pendingMaintenance: number
}
