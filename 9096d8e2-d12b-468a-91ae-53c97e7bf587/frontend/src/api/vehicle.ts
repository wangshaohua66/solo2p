import { get, post, patch, delete: del } from './request'
import type {
  Ambulance,
  AmbulanceCreateRequest,
  AmbulanceUpdateRequest,
  VehicleMaintenance,
  MaintenanceCreateRequest,
  MaintenanceUpdateRequest,
  MedicalSupply,
  SupplyCreateRequest,
  SupplyUpdateRequest,
  SupplyTransactionRequest,
  VehicleStats
} from '@/types/vehicle'
import type { PageResponse } from '@/types/dispatch'

export function getVehicleStats(): Promise<VehicleStats> {
  return get<VehicleStats>('/vehicles/stats')
}

export function getAmbulances(
  page = 0,
  size = 20,
  filters?: {
    status?: string
    plateNumber?: string
    equipmentLevel?: string
  }
): Promise<PageResponse<Ambulance>> {
  return get<PageResponse<Ambulance>>('/vehicles/ambulances', {
    params: { page, size, ...filters }
  })
}

export function getAllAmbulances(): Promise<Ambulance[]> {
  return get<Ambulance[]>('/vehicles/ambulances/all')
}

export function getAmbulance(ambulanceId: number): Promise<Ambulance> {
  return get<Ambulance>(`/vehicles/ambulances/${ambulanceId}`)
}

export function createAmbulance(request: AmbulanceCreateRequest): Promise<Ambulance> {
  return post<Ambulance>('/vehicles/ambulances', request)
}

export function updateAmbulance(
  ambulanceId: number,
  request: AmbulanceUpdateRequest
): Promise<Ambulance> {
  return patch<Ambulance>(`/vehicles/ambulances/${ambulanceId}`, request)
}

export function deleteAmbulance(ambulanceId: number): Promise<void> {
  return del<void>(`/vehicles/ambulances/${ambulanceId}`)
}

export function getMaintenances(
  page = 0,
  size = 20,
  filters?: {
    ambulanceId?: number
    maintenanceStatus?: string
    maintenanceType?: string
    startDate?: string
    endDate?: string
  }
): Promise<PageResponse<VehicleMaintenance>> {
  return get<PageResponse<VehicleMaintenance>>('/vehicles/maintenances', {
    params: { page, size, ...filters }
  })
}

export function getMaintenance(maintenanceId: number): Promise<VehicleMaintenance> {
  return get<VehicleMaintenance>(`/vehicles/maintenances/${maintenanceId}`)
}

export function createMaintenance(request: MaintenanceCreateRequest): Promise<VehicleMaintenance> {
  return post<VehicleMaintenance>('/vehicles/maintenances', request)
}

export function updateMaintenance(
  maintenanceId: number,
  request: MaintenanceUpdateRequest
): Promise<VehicleMaintenance> {
  return patch<VehicleMaintenance>(`/vehicles/maintenances/${maintenanceId}`, request)
}

export function getOverdueMaintenances(): Promise<VehicleMaintenance[]> {
  return get<VehicleMaintenance[]>('/vehicles/maintenances/overdue')
}

export function getSupplies(
  page = 0,
  size = 20,
  filters?: {
    category?: string
    ambulanceId?: number
    lowStockOnly?: boolean
    expiredOnly?: boolean
    name?: string
  }
): Promise<PageResponse<MedicalSupply>> {
  return get<PageResponse<MedicalSupply>>('/vehicles/supplies', {
    params: { page, size, ...filters }
  })
}

export function getSupply(supplyId: number): Promise<MedicalSupply> {
  return get<MedicalSupply>(`/vehicles/supplies/${supplyId}`)
}

export function createSupply(request: SupplyCreateRequest): Promise<MedicalSupply> {
  return post<MedicalSupply>('/vehicles/supplies', request)
}

export function updateSupply(
  supplyId: number,
  request: SupplyUpdateRequest
): Promise<MedicalSupply> {
  return patch<MedicalSupply>(`/vehicles/supplies/${supplyId}`, request)
}

export function deleteSupply(supplyId: number): Promise<void> {
  return del<void>(`/vehicles/supplies/${supplyId}`)
}

export function processSupplyTransaction(request: SupplyTransactionRequest): Promise<MedicalSupply> {
  return post<MedicalSupply>('/vehicles/supplies/transaction', request)
}

export function getLowStockSupplies(): Promise<MedicalSupply[]> {
  return get<MedicalSupply[]>('/vehicles/supplies/low-stock')
}

export function getExpiredSupplies(): Promise<MedicalSupply[]> {
  return get<MedicalSupply[]>('/vehicles/supplies/expired')
}

export function runMaintenanceCheck(): Promise<{
  overdueCount: number
  dueSoonCount: number
  checkedVehicles: number
}> {
  return post<{
    overdueCount: number
    dueSoonCount: number
    checkedVehicles: number
  }>('/vehicles/maintenances/check')
}

export function runInventoryCheck(): Promise<{
  lowStockCount: number
  expiredCount: number
  checkedItems: number
}> {
  return post<{
    lowStockCount: number
    expiredCount: number
    checkedItems: number
  }>('/vehicles/supplies/check')
}
