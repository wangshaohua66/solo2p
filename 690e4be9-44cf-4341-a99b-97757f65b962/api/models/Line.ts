export interface Line {
  id: string
  lineNo: number
  name: string
  startStop: string
  endStop: string
  firstBusTime: string
  lastBusTime: string
  mileage: number
  peakInterval: number
  offPeakInterval: number
  vehicleCount: number
}
