export interface User {
  id: string
  username: string
  email: string
  phone?: string
  avatar?: string
  role: UserRole
  memberTier?: MemberTier
  memberExpireDate?: string
  totalSpent?: number
  points?: number
  createdAt?: string
}

export type UserRole = 'admin' | 'instructor' | 'member' | 'guest'

export type MemberTier = 'experience' | 'monthly' | 'quarterly' | 'yearly'

export interface MemberTierBenefit {
  name: string
  displayName: string
  kilnPriority: number
  glazeRecipesUnlocked: number
  courseDiscount: number
  freeHoursPerMonth: number
  price: number
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: User
  expiresIn: number
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
  phone?: string
  tier?: MemberTier
}

export interface PagedResult<T> {
  items: T[]
  totalCount: number
  pageIndex: number
  pageSize: number
  totalPages: number
}

export interface PagedQuery {
  pageIndex?: number
  pageSize?: number
  keyword?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface Kiln {
  id: string
  name: string
  type: KilnType
  capacity: number
  status: KilnStatus
  maxTemperature: number
  description?: string
}

export type KilnType = 'electric' | 'gas' | 'wood'
export type KilnStatus = 'available' | 'running' | 'maintenance'

export interface KilnSchedule {
  id: string
  kilnId: string
  kilnName?: string
  title: string
  firingType: FiringType
  startTime: string
  endTime: string
  temperatureCurve?: TemperaturePoint[]
  createdBy: string
  createdByName?: string
  status: ScheduleStatus
  notes?: string
  pieceIds?: string[]
  isConflict?: boolean
}

export type FiringType = 'bisque' | 'glaze' | 'reduction'
export type ScheduleStatus = 'pending' | 'running' | 'completed' | 'cancelled'

export interface TemperaturePoint {
  time: number
  temperature: number
}

export interface ConflictResult {
  hasConflict: boolean
  conflictingSchedules: KilnSchedule[]
}

export interface GlazeRecipe {
  id: string
  name: string
  code: string
  parentId?: string
  version: number
  isArchived: boolean
  ingredients: GlazeIngredient[]
  firingType: FiringType
  temperatureMin: number
  temperatureMax: number
  atmosphere: string
  description?: string
  effectImage?: string
  createdBy: string
  createdByName?: string
  createdAt: string
  updatedAt: string
  children?: GlazeRecipe[]
}

export interface GlazeIngredient {
  name: string
  percentage: number
  note?: string
}

export interface PieceArchive {
  id: string
  title: string
  description?: string
  memberId: string
  memberName?: string
  glazeRecipeId?: string
  glazeRecipeName?: string
  kilnScheduleId?: string
  kilnScheduleName?: string
  status: PieceStatus
  weight?: number
  height?: number
  width?: number
  createdAt: string
  completedAt?: string
  photos: PiecePhoto[]
  tags?: string[]
  isForSale?: boolean
  price?: number
}

export type PieceStatus = 'draft' | 'bisqued' | 'glazed' | 'fired' | 'completed' | 'sold'

export interface PiecePhoto {
  id: string
  stage: PhotoStage
  url: string
  thumbnailUrl: string
  uploadedAt: string
  description?: string
}

export type PhotoStage = 'clay' | 'bisque' | 'glaze' | 'finished'

export interface Course {
  id: string
  title: string
  description?: string
  type: CourseType
  instructorId: string
  instructorName?: string
  coverImage?: string
  price: number
  duration: number
  maxStudents: number
  currentStudents: number
  level: CourseLevel
  startDate: string
  endDate: string
  schedule: CourseSession[]
  status: CourseStatus
  createdAt: string
}

export type CourseType = 'wheel' | 'handbuilding' | 'decoration' | 'glaze'
export type CourseLevel = 'beginner' | 'intermediate' | 'advanced'
export type CourseStatus = 'draft' | 'published' | 'in_progress' | 'completed' | 'cancelled'

export interface CourseSession {
  id: string
  date: string
  startTime: string
  endTime: string
  topic?: string
}

export interface CourseRegistration {
  id: string
  courseId: string
  memberId: string
  memberName?: string
  status: RegistrationStatus
  createdAt: string
  paidAmount: number
  attendanceRecords: AttendanceRecord[]
  isWaitlist?: boolean
  waitlistPosition?: number
}

export type RegistrationStatus = 'registered' | 'waitlisted' | 'cancelled' | 'completed'

export interface AttendanceRecord {
  sessionId: string
  checkInTime?: string
  status: 'pending' | 'present' | 'absent' | 'late'
  qrCode?: string
}

export interface StudioBooking {
  id: string
  memberId: string
  memberName?: string
  stationId: string
  stationName?: string
  date: string
  startTime: string
  endTime: string
  status: BookingStatus
  checkInTime?: string
  checkOutTime?: string
  actualHours?: number
  pointsEarned?: number
  createdAt: string
}

export type BookingStatus = 'booked' | 'checked_in' | 'completed' | 'cancelled' | 'no_show'

export interface Station {
  id: string
  name: string
  type: StationType
  status: StationStatus
  position: number
}

export type StationType = 'wheel' | 'table' | 'glaze'
export type StationStatus = 'available' | 'occupied' | 'maintenance'

export interface SalesItem {
  id: string
  pieceId: string
  pieceTitle?: string
  pieceImage?: string
  price: number
  status: SalesStatus
  listedAt: string
  soldAt?: string
  buyerName?: string
  buyerContact?: string
  authorShare?: number
  studioShare?: number
}

export type SalesStatus = 'draft' | 'listed' | 'reserved' | 'sold' | 'returned'

export interface CustomOrder {
  id: string
  title: string
  description: string
  referenceImages?: string[]
  clientName: string
  clientContact: string
  budget?: number
  assignedTo?: string
  assignedToName?: string
  status: OrderStatus
  quoteAmount?: number
  createdAt: string
  deadline?: string
}

export type OrderStatus = 'pending' | 'quoted' | 'accepted' | 'in_progress' | 'completed' | 'cancelled'

export interface Material {
  id: string
  name: string
  category: MaterialCategory
  unit: string
  totalQuantity: number
  reservedQuantity: number
  availableQuantity: number
  minThreshold: number
  unitPrice: number
  lastRestocked?: string
  lastUsed?: string
}

export type MaterialCategory = 'clay' | 'glaze' | 'colorant' | 'tool' | 'other'

export interface MaterialTransaction {
  id: string
  materialId: string
  materialName?: string
  type: TransactionType
  quantity: number
  unitPrice: number
  totalAmount: number
  referenceType?: string
  referenceId?: string
  notes?: string
  createdAt: string
  createdBy: string
}

export type TransactionType = 'purchase' | 'usage' | 'adjustment' | 'return'

export interface MaterialAlert {
  id: string
  materialId: string
  materialName: string
  currentQuantity: number
  threshold: number
  createdAt: string
  isRead: boolean
  suggestedPurchaseAmount?: number
}

export interface UploadResult {
  id: string
  url: string
  thumbnailUrl: string
  fileName: string
  size: number
  mimeType: string
}

export interface Notification {
  id: string
  title: string
  content: string
  type: NotificationType
  isRead: boolean
  createdAt: string
  link?: string
}

export type NotificationType = 'system' | 'membership' | 'course' | 'kiln' | 'inventory'
