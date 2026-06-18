export interface MaintenanceRecord {
  id: string
  vehicleId: string
  type: string
  startDate: string
  endDate: string | undefined
  nextDate: string | undefined
  cost: number
  description: string | undefined
  status: string
}
