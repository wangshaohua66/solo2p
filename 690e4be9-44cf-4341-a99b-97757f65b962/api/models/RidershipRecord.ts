export interface RidershipRecord {
  id: string
  tripId: string
  stopId: string
  boarding: number
  alighting: number
  onboardCount: number
  loadFactor: number
  timestamp: number
}
