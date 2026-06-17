export enum UserRole {
  VENUE_ADMIN = 'venue_admin',
  ORGANIZER = 'organizer',
  FINANCE = 'finance',
  AUDIENCE = 'audience'
}

export interface User {
  id: string
  username: string
  email: string
  role: UserRole
  name: string
  phone?: string
}

export interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  loading: boolean
}

export enum VenueType {
  GRAND_THEATER = 'grand_theater',
  CONCERT_HALL = 'concert_hall',
  SMALL_THEATER = 'small_theater'
}

export interface Venue {
  id: string
  name: string
  type: VenueType
  totalSeats: number
  description: string
  seatConfig: SeatSection[]
}

export enum PerformanceType {
  DRAMA = 'drama',
  CONCERT = 'concert',
  DANCE = 'dance',
  OPERA = 'opera',
  CHILDREN = 'children'
}

export enum PerformanceStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  NEGOTIATING = 'negotiating'
}

export interface Performance {
  id: string
  name: string
  type: PerformanceType
  organizerId: string
  organizerName: string
  venueId: string
  venueName: string
  expectedDuration: number
  technicalRequirements: string[]
  expectedDates: string[]
  startTime?: string
  endTime?: string
  status: PerformanceStatus
  rejectReason?: string
  createdAt: string
  approvedAt?: string
  devices?: DeviceRequirement[]
}

export interface DeviceRequirement {
  deviceId: string
  deviceName: string
  quantity: number
}

export interface SeatSection {
  id: string
  name: string
  type: 'pool' | 'balcony' | 'box' | 'side'
  rows: number
  columns: number
  startRow: number
  startColumn: number
  numberingRule: 'continuous' | 'row_based' | 'custom'
  basePrice: number
  disabledForTypes?: PerformanceType[]
}

export enum SeatStatus {
  AVAILABLE = 'available',
  SOLD = 'sold',
  LOCKED = 'locked',
  MAINTENANCE = 'maintenance',
  RESERVED = 'reserved'
}

export interface Seat {
  id: string
  performanceId: string
  sectionId: string
  row: number
  column: number
  seatNumber: string
  status: SeatStatus
  price: number
  ticketType?: TicketType
  lockedAt?: string
  lockedBy?: string
  orderId?: string
}

export enum TicketType {
  EARLY_BIRD = 'early_bird',
  REGULAR = 'regular',
  STUDENT = 'student',
  GROUP = 'group'
}

export interface PriceTier {
  sectionId: string
  type: TicketType
  price: number
  minQuantity?: number
  expireAt?: string
}

export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  USED = 'used'
}

export enum PaymentChannel {
  ALIPAY = 'alipay',
  WECHAT = 'wechat'
}

export enum SalesChannel {
  WEBSITE = 'website',
  WECHAT_MINIAPP = 'wechat_miniapp'
}

export interface Order {
  id: string
  orderNo: string
  performanceId: string
  performanceName: string
  userId: string
  userName: string
  seats: Seat[]
  totalAmount: number
  discountAmount: number
  payAmount: number
  ticketType: TicketType
  status: OrderStatus
  paymentChannel?: PaymentChannel
  salesChannel: SalesChannel
  paidAt?: string
  cancelledAt?: string
  createdAt: string
  qrCode?: string
  refundAmount?: number
  refundFee?: number
  usedAt?: string
  verifiedBy?: string
  verifiedByName?: string
}

export interface TicketAvailability {
  earlyBirdActive: boolean
  earlyBirdDeadline?: string
  regularActive: boolean
  studentActive: boolean
  groupActive: boolean
}

export interface PriceChangeLog {
  id: string
  performanceId: string
  performanceName: string
  sectionId?: string
  sectionName?: string
  ticketType: TicketType
  oldPrice: number
  newPrice: number
  operatorId: string
  operatorName: string
  reason?: string
  createdAt: string
  changeAmount?: number
  changePercent?: number
  ticketTypeLabel?: string
}

export enum DeviceCategory {
  LIGHTING = 'lighting',
  SOUND = 'sound',
  STAGE = 'stage'
}

export enum DeviceStatus {
  AVAILABLE = 'available',
  IN_USE = 'in_use',
  MAINTENANCE = 'maintenance',
  DAMAGED = 'damaged'
}

export interface Device {
  id: string
  name: string
  category: DeviceCategory
  specification: string
  quantity: number
  availableQuantity: number
  status: DeviceStatus
  maintenanceSchedule?: DeviceMaintenance[]
}

export interface DeviceMaintenance {
  id: string
  deviceId: string
  startTime: string
  endTime: string
  type: string
  notes?: string
}

export interface DeviceUsage {
  id: string
  deviceId: string
  performanceId: string
  performanceName: string
  quantity: number
  startTime: string
  endTime: string
  borrower: string
  returned: boolean
  returnedAt?: string
  damageNotes?: string
}

export interface Settlement {
  id: string
  month: string
  performanceId: string
  performanceName: string
  organizerId: string
  organizerName: string
  totalRevenue: number
  websiteRevenue: number
  wechatRevenue: number
  totalRefunds: number
  serviceFee: number
  netAmount: number
  status: 'pending' | 'confirmed_venue' | 'confirmed_organizer' | 'completed'
  orders: SettlementOrder[]
  createdAt: string
  confirmedVenueAt?: string
  confirmedOrganizerAt?: string
}

export interface SettlementOrder {
  orderId: string
  orderNo: string
  salesChannel: SalesChannel
  amount: number
  isMatched: boolean
}

export interface SalesStats {
  performanceId: string
  performanceName: string
  totalTickets: number
  soldTickets: number
  totalRevenue: number
  byChannel: Record<SalesChannel, number>
  byTicketType: Record<TicketType, number>
}

export interface Favorite {
  id: string
  userId: string
  performanceId: string
  performanceName: string
  performanceImage?: string
  createdAt: string
}
