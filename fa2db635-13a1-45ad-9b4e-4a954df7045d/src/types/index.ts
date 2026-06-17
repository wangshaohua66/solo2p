export type ResourceType = 'STAFF' | 'VENUE' | 'PROP'
export type WeddingStage =
  | 'CONSULT'
  | 'DESIGN'
  | 'CONTRACT'
  | 'PREPARE'
  | 'ONSITE'
  | 'DELIVERY'
export type ContractStatus = 'DRAFT' | 'PENDING' | 'SIGNED' | 'VOID'
export type TaskStatus = 'TODO' | 'DOING' | 'DONE'
export type StaffRole =
  | 'PLANNER'
  | 'HOST'
  | 'MAKEUP'
  | 'PHOTO'
  | 'FLORIST'

export interface Store {
  id: number
  name: string
  discountCoefficient: number
}

export interface Staff {
  id: number
  storeId: number
  name: string
  role: StaffRole
  phone: string
  avatar?: string
}

export interface Venue {
  id: number
  storeId: number
  name: string
  capacity: number
}

export interface Prop {
  id: number
  storeId: number
  name: string
  stock: number
}

export interface Resource {
  id: number
  type: ResourceType
  name: string
  storeId: number
  meta?: string
}

export interface ScheduleTask {
  id: number
  resourceType: ResourceType
  resourceId: number
  resourceName: string
  weddingId?: number
  coupleName?: string
  startTime: string
  endTime: string
  status: 'BOOKED' | 'PENDING' | 'CONFLICT'
}

export interface Wedding {
  id: number
  coupleName: string
  groomName?: string
  brideName?: string
  phone: string
  weddingDate: string
  guests: number
  stage: WeddingStage
  storeId: number
  storeName?: string
  plannerId: number
  plannerName?: string
  packageId: number
  packageName?: string
  quoteTotal?: number
  createdAt: string
  progress?: number
}

export interface PackageItem {
  id: number
  name: string
  type: 'SERVICE' | 'COST'
  cost: number
  price: number
  included: boolean
}

export interface Package {
  id: number
  name: string
  basePrice: number
  description: string
  items: PackageItem[]
}

export interface Addon {
  id: number
  name: string
  cost: number
  price: number
  unit: string
}

export interface QuoteItem {
  name: string
  cost: number
  price: number
  qty: number
}

export interface Quote {
  items: QuoteItem[]
  cost: number
  price: number
  discount: number
  total: number
  profit: number
  margin: number
}

export interface ContractClause {
  id: string
  title: string
  body: string
  isAddon?: boolean
}

export interface Contract {
  id: number
  weddingId: number
  coupleName: string
  packageName: string
  amount: number
  status: ContractStatus
  clauses: ContractClause[]
  signature?: string
  signedAt?: string
  createdAt: string
}

export interface FollowTask {
  id: number
  weddingId: number
  title: string
  daysBefore: number
  status: TaskStatus
  owner: string
  dueDate: string
}

export interface TimelineEvent {
  id: number
  weddingId: number
  time: string
  title: string
  desc: string
  actor: string
}

export interface FinanceDetail {
  weddingId: number
  coupleName: string
  income: number
  received: number
  cost: number
  paid: number
  profit: number
  suppliers: { name: string; amount: number; settled: boolean }[]
}

export interface MonthlyStat {
  month: string
  revenue: number
  cost: number
  profit: number
  weddings: number
}

export interface OverdueItem {
  id: number
  type: 'RECEIVABLE' | 'PAYABLE'
  party: string
  amount: number
  days: number
  weddingId?: number
}

export interface RevenuePoint {
  date: string
  amount: number
}

export interface FunnelData {
  stage: string
  count: number
}

export interface ScoreData {
  dimension: string
  score: number
}

export interface SupplierOrder {
  id: number
  coupleName: string
  weddingDate: string
  role: StaffRole
  service: string
  amount: number
  status: 'PENDING' | 'CONFIRMED' | 'DONE'
  voucherUrl?: string
}

export interface User {
  id: number
  name: string
  role: 'ADMIN' | 'OPERATOR' | 'PLANNER' | 'FINANCE' | 'SUPPLIER'
  storeId?: number
  avatar?: string
}

export interface ConflictResult {
  conflict: boolean
  conflicts: ScheduleTask[]
  alternatives: Resource[]
}

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}
