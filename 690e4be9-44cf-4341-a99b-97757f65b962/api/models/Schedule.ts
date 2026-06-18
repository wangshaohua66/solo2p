export interface ScheduleTripItem {
  tripId: string
  vehicleId: string
  driverId: string
  departureTime: string
  direction: number
}

export interface Schedule {
  id: string
  lineId: string
  date: string
  trips: ScheduleTripItem[]
  status: string
  createdAt: number
  updatedAt: number
}
