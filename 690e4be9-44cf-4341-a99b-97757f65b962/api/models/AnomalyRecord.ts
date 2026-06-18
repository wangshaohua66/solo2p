export interface AnomalyRecord {
  id: string
  type: string
  lineId: string
  tripId: string | undefined
  vehicleId: string | undefined
  driverId: string | undefined
  description: string | undefined
  severity: string
  timestamp: number
  resolved: boolean
  recommendation: string | undefined
}
