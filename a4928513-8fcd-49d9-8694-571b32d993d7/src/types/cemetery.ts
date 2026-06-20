export type PlotType = 'standard' | 'double' | 'premium' | 'family' | 'ashes_wall'
export type PlotStatus = 'for_sale' | 'sold' | 'reserved' | 'occupied' | 'maintenance'

export interface CemeteryArea {
  id: string
  name: string
  code: string
  type: 'earth' | 'ashes_wall' | 'lawn' | 'tree'
  rows: number
  cols: number
  orientation: string
  description?: string
}

export interface CemeteryPlot {
  id: string
  areaId: string
  areaName: string
  row: number
  col: number
  plotNo: string
  type: PlotType
  price: number
  originalPrice?: number
  discountInfo?: string
  status: PlotStatus
  remainsId?: string
  remainsName?: string
  burialDate?: string
  contractNo?: string
  ownerName?: string
  ownerPhone?: string
  maintainExpireDate?: string
  x: number
  y: number
  width: number
  height: number
  hasMonument?: boolean
  hasVase?: boolean
  remark?: string
}

export interface PlotSelection {
  plotId: string
  areaId: string
  customerName: string
  customerPhone: string
  relation: string
  remainsId?: string
  remainsName?: string
  expiresAt: string
}

export type MemorialSlotStatus = 'available' | 'limited' | 'full' | 'closed'

export interface MemorialTimeSlot {
  slotId: string
  date: string
  timeRange: string
  startTime: string
  endTime: string
  totalQuota: number
  bookedCount: number
  vehicleQuota: number
  vehicleBooked: number
  status: MemorialSlotStatus
  isPeak: boolean
  extraFee?: number
}

export interface ParkingLot {
  id: string
  name: string
  area: string
  totalSpots: number
  availableSpots: number
  type: 'staff' | 'visitor' | 'accessible' | 'vip'
  openTime: string
  closeTime: string
}

export type MemorialBookingStatus = 'booked' | 'checked_in' | 'completed' | 'cancelled' | 'expired'

export interface MemorialBooking {
  id: string
  passCode: string
  qrCode: string
  familyName: string
  phone: string
  date: string
  slotId: string
  timeRange: string
  peopleCount: number
  hasVehicle: boolean
  plateNumber?: string
  vehicleType?: string
  parkingLotId?: string
  parkingLotName?: string
  parkingSpot?: string
  deceaseName?: string
  plotNo?: string
  offerings: string[]
  status: MemorialBookingStatus
  checkInTime?: string
  checkOutTime?: string
  createTime: string
  updateTime: string
  isCarpool: boolean
  remark?: string
}
