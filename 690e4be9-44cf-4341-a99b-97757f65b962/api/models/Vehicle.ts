export interface Vehicle {
  id: string
  plateNumber: string
  model: string
  capacity: number
  status: string
  lineId: string | undefined
  totalMileage: number
}
