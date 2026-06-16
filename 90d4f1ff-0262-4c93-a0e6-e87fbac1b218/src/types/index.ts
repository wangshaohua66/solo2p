export enum UserRole {
  SuperAdmin = 'SuperAdmin',
  ParkOperator = 'ParkOperator',
  ParkingAdmin = 'ParkingAdmin',
  ChargingOps = 'ChargingOps',
  CarOwner = 'CarOwner'
}

export enum ParkingSpotStatus {
  Available = 'Available',
  Occupied = 'Occupied',
  Reserved = 'Reserved',
  Offline = 'Offline'
}

export enum ChargingStationStatus {
  Idle = 'Idle',
  Charging = 'Charging',
  Reserved = 'Reserved',
  Faulty = 'Faulty',
  Offline = 'Offline'
}

export enum OrderStatus {
  Pending = 'Pending',
  Paid = 'Paid',
  Refunding = 'Refunding',
  Refunded = 'Refunded',
  Cancelled = 'Cancelled'
}

export enum WorkOrderStatus {
  Pending = 'Pending',
  Assigned = 'Assigned',
  Processing = 'Processing',
  Closed = 'Closed'
}

export enum PaymentMethod {
  WeChat = 'WeChat',
  Alipay = 'Alipay',
  Balance = 'Balance'
}

export interface User {
  id: string
  username: string
  nickname: string
  phone: string
  email: string
  role: UserRole
  avatar?: string
  memberLevel?: number
  balance: number
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  refreshToken: string
  user: User
  expiresIn: number
}

export interface ParkingLot {
  id: string
  name: string
  area: string
  totalSpots: number
  availableSpots: number
  latitude: number
  longitude: number
  floors: ParkingFloor[]
}

export interface ParkingFloor {
  id: string
  name: string
  level: number
  totalSpots: number
  availableSpots: number
  spots: ParkingSpot[]
}

export interface ParkingSpot {
  id: string
  code: string
  floorId: string
  status: ParkingSpotStatus
  x: number
  y: number
  width: number
  height: number
  plateNumber?: string
  entryTime?: string
  reservationId?: string
}

export interface ParkingRecord {
  id: string
  spotId: string
  spotCode: string
  plateNumber: string
  entryTime: string
  exitTime?: string
  duration?: number
  parkingFee?: number
  status: 'InProgress' | 'Completed'
}

export interface ChargingStation {
  id: string
  code: string
  name: string
  type: 'AC' | 'DC'
  power: number
  status: ChargingStationStatus
  currentPower?: number
  chargedKwh?: number
  location: string
  parkingLotId: string
  pricePerKwh: number
}

export interface ChargingReservation {
  id: string
  stationId: string
  stationCode: string
  userId: string
  startTime: string
  endTime: string
  status: 'Active' | 'Completed' | 'Cancelled' | 'Expired'
  createdAt: string
}

export interface ChargingSession {
  id: string
  stationId: string
  userId: string
  startTime: string
  endTime?: string
  startKwh: number
  endKwh?: number
  totalKwh?: number
  cost?: number
  status: 'Charging' | 'Completed'
}

export interface BillingRule {
  id: string
  name: string
  type: 'Parking' | 'Charging'
  priority: number
  isEnabled: boolean
  timeSlots: TimeSlotRate[]
  memberDiscounts: MemberDiscount[]
  chargingTiers: ChargingTier[]
  dailyCap?: number
}

export interface TimeSlotRate {
  startTime: string
  endTime: string
  ratePerHour: number
}

export interface MemberDiscount {
  level: number
  discountRate: number
}

export interface ChargingTier {
  minKwh: number
  maxKwh?: number
  ratePerKwh: number
}

export interface BillingCalculation {
  baseAmount: number
  parkingAmount: number
  chargingAmount: number
  memberDiscount: number
  totalAmount: number
  dailyCapApplied: boolean
  details: BillingDetail[]
}

export interface BillingDetail {
  description: string
  amount: number
  type: string
}

export interface PaymentOrder {
  id: string
  orderNo: string
  userId: string
  type: 'Parking' | 'Charging' | 'Reservation'
  relatedId: string
  amount: number
  status: OrderStatus
  paymentMethod?: PaymentMethod
  paidAt?: string
  createdAt: string
}

export interface WorkOrder {
  id: string
  orderNo: string
  type: 'IllegalParking' | 'Fault' | 'Other'
  title: string
  description: string
  photos: string[]
  status: WorkOrderStatus
  reporterId: string
  assigneeId?: string
  createdAt: string
  updatedAt: string
  location?: string
  plateNumber?: string
}

export interface DashboardStats {
  todayRevenue: number
  yesterdayRevenue: number
  weekRevenue: number
  monthRevenue: number
  totalParkings: number
  totalChargings: number
  avgParkingDuration: number
  occupancyRate: number
  chargingUtilization: number
  peakHours: PeakHour[]
  revenueTrend: TrendData[]
  parkingTrend: TrendData[]
  chargingTrend: TrendData[]
  topParkingLots: RankingData[]
  topStations: RankingData[]
}

export interface PeakHour {
  hour: number
  count: number
}

export interface TrendData {
  date: string
  value: number
  compareValue?: number
}

export interface RankingData {
  id: string
  name: string
  value: number
}

export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
  timestamp: number
}

export interface PagedResult<T> {
  items: T[]
  totalCount: number
  pageIndex: number
  pageSize: number
  totalPages: number
}

export interface PagedQuery {
  pageIndex: number
  pageSize: number
  keyword?: string
  sortBy?: string
  sortDirection?: 'Ascending' | 'Descending'
}
