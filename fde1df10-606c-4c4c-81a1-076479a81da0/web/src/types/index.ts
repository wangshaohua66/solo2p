export type UserRole = 'venue_manager' | 'producer' | 'tech_director' | 'finance' | 'troupe_admin'

export interface User {
  ID: number
  Username: string
  RealName: string
  Role: UserRole
  Email: string
  Phone: string
}

export interface LoginResponse {
  token: string
  user: User
}

export type VenueType = 'theater' | 'concert_hall' | 'experimental_theater' | 'rehearsal_room'
export type VenueStatus = 'active' | 'maintenance'

export interface Venue {
  ID: number
  Name: string
  Type: VenueType
  Capacity: number
  Location: string
  Status: VenueStatus
  Description: string
}

export type BookingStatus = 'pending' | 'confirmed' | 'conflict' | 'maintenance' | 'cancelled'
export type BookingType = 'performance' | 'rehearsal' | 'maintenance'

export interface Booking {
  ID: number
  VenueID: number
  UserID: number
  Title: string
  Description: string
  StartTime: string
  EndTime: string
  Status: BookingStatus
  Type: BookingType
  Remarks: string
  Venue?: Venue
  User?: User
  CreatedAt: string
}

export interface ConflictInfo {
  conflicts: Booking[]
  recommendedSlots: Booking[]
}

export type EquipmentCategory = 'lighting' | 'sound' | 'stage'
export type EquipmentStatus = 'available' | 'in_use' | 'maintenance'

export interface Equipment {
  ID: number
  Name: string
  Category: EquipmentCategory
  ModelName: string
  Status: EquipmentStatus
  Location: string
  Description: string
  SerialNumber: string
}

export type ContractStatus = 'pending_tech' | 'pending_finance' | 'pending_venue' | 'approved' | 'rejected' | 'returned'
export type ApprovalAction = 'approve' | 'reject' | 'return'

export interface ContractApproval {
  ID: number
  ContractID: number
  ApproverID: number
  Step: number
  Action: ApprovalAction
  Comment: string
  CreatedAt: string
}

export interface Contract {
  ID: number
  BookingID: number
  SubmitterID: number
  Title: string
  Content: string
  Status: ContractStatus
  CurrentStep: number
  Approvals?: ContractApproval[]
}

export type BudgetCategory = 'stage' | 'staff' | 'marketing' | 'venue'
export type BudgetStatus = 'normal' | 'warning' | 'frozen'

export interface Budget {
  ID: number
  BookingID: number
  StageBudget: number
  StaffBudget: number
  MarketingBudget: number
  VenueBudget: number
  TotalBudget: number
  TotalSpent: number
  Status: BudgetStatus
}

export interface Expense {
  ID: number
  BudgetID: number
  Category: BudgetCategory
  Amount: number
  Description: string
  SubmittedBy: number
  CreatedAt: string
}

export interface Settlement {
  budget: Budget
  expenses: Expense[]
  categoryDetails: {
    category: BudgetCategory
    budget: number
    spent: number
    deviation: number
  }[]
  totalDeviation: number
}

export type RecurrenceRule = 'none' | 'weekly'

export interface RehearsalBooking {
  ID: number
  VenueID: number
  UserID: number
  TroupeName: string
  StartTime: string
  EndTime: string
  RecurrenceRule: RecurrenceRule
  RecurrenceDays: string
  RecurrenceWeeks: number
  Status: string
}

export interface Notification {
  ID: number
  UserID: number
  Type: string
  Title: string
  Content: string
  IsRead: boolean
  CreatedAt: string
}

export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

export interface StatsData {
  venueUtilization: { venueName: string; rate: number }[]
  equipmentIdleRate: number
  monthlyBookings: number
}
