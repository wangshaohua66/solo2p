export interface Trip {
  id: string
  lineId: string
  routeId: string
  vehicleId: string
  driverId: string
  departureTime: string
  arrivalTime: string | undefined
  direction: number
  status: string
  delayMinutes: number
}
