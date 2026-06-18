export interface GPSRecord {
  id: string
  vehicleId: string
  lineId: string
  tripId: string | undefined
  latitude: number
  longitude: number
  speed: number
  heading: number
  timestamp: number
}
