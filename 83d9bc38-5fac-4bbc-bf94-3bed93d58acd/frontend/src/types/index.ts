export type BookingStatus = 'confirmed' | 'cancelled' | 'completed' | 'waitlist';

export type EquipmentStatus = 'available' | 'maintenance' | 'scrapped';

export type MaintenanceStatus = 'scheduled' | 'in_progress' | 'completed';

export type MaintenanceType = 'routine' | 'repair' | 'calibration';

export type BillingStatus = 'paid' | 'refunded' | 'pending';

export type NotificationType = 'booking_confirm' | 'maintenance_complete' | 'waitlist_advance' | 'billing_generated';

export type UserRole = 'super_admin' | 'admin' | 'operator' | 'teacher' | 'student';

export interface Role {
  id: number;
  name: string;
  permissions: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: number;
  username: string;
  name: string;
  email: string;
  roleId: number;
  roleName: string;
  centerId: number;
  centerName: string;
  budget: number;
  advisorId?: number;
  advisorName?: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
  role?: Role;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  permissions: string[];
}

export interface Center {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Equipment {
  id: number;
  name: string;
  model: string;
  category: string;
  centerId: number;
  centerName?: string;
  hourlyRate: number;
  status: EquipmentStatus;
  specs: Record<string, any>;
  currentUser?: string;
  nextFreeTime?: string;
  createdAt: string;
  updatedAt: string;
  center?: Center;
}

export interface EquipmentStats {
  equipmentId: number;
  equipmentName: string;
  centerId: number;
  centerName: string;
  category: string;
  totalHours: number;
  bookedHours: number;
  utilizationRate: number;
  period: string;
}

export interface EquipmentFilter {
  keyword?: string;
  category?: string;
  centerId?: number;
  status?: EquipmentStatus;
  minHourlyRate?: number;
  maxHourlyRate?: number;
}

export interface EquipmentCreateRequest {
  name: string;
  model: string;
  category: string;
  centerId: number;
  hourlyRate: number;
  status?: EquipmentStatus;
  specs?: Record<string, any>;
}

export interface EquipmentUpdateRequest {
  name?: string;
  model?: string;
  category?: string;
  centerId?: number;
  hourlyRate?: number;
  status?: EquipmentStatus;
  specs?: Record<string, any>;
}

export interface Booking {
  id: number;
  equipmentId: number;
  equipmentName?: string;
  userId: number;
  userName?: string;
  startTime: string;
  endTime: string;
  status: BookingStatus | string;
  isSeries: boolean;
  seriesId?: string;
  waitlistPosition?: number;
  createdAt: string;
  updatedAt: string;
  equipment?: Equipment;
  user?: User;
}

export interface BookingCreateRequest {
  equipmentId: number;
  startTime: string;
  endTime: string;
  isSeries?: boolean;
  seriesWeeks?: number;
}

export interface BookingSeriesRequest {
  equipmentId: number;
  startTime: string;
  endTime: string;
  seriesWeeks: number;
  weekdays?: number[];
}

export interface ConflictCheckResponse {
  hasConflict: boolean;
  conflictingBookings: Booking[];
}

export interface WaitlistRequest {
  equipmentId: number;
  startTime: string;
  endTime: string;
}

export interface Billing {
  id: number;
  bookingId?: number;
  userId: number;
  userName: string;
  amount: number;
  status: BillingStatus;
  billingDate: string;
  equipmentName: string;
  createdAt: string;
  user?: User;
  startTime?: string;
  endTime?: string;
}

export interface BillingFilter {
  userId?: number;
  status?: BillingStatus;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface BudgetUpdateRequest {
  userId: number;
  budget: number;
}

export interface Maintenance {
  id: number;
  equipmentId: number;
  equipmentName: string;
  startTime: string;
  endTime: string;
  type: MaintenanceType;
  status: MaintenanceStatus;
  remark: string;
  operatorId?: number;
  operatorName?: string;
  createdAt: string;
  updatedAt: string;
  equipment?: Equipment;
  operator?: User;
}

export interface MaintenanceCreateRequest {
  equipmentId: number;
  startTime: string;
  endTime: string;
  type: MaintenanceType;
  remark?: string;
  operatorId?: number;
}

export interface MaintenanceUpdateRequest {
  startTime?: string;
  endTime?: string;
  type?: MaintenanceType;
  status?: MaintenanceStatus;
  remark?: string;
  operatorId?: number;
}

export interface DashboardStats {
  totalEquipment: number;
  todayBookings: number;
  monthlyUtilization: number;
  pendingCount: number;
}

export interface UtilizationStats {
  equipmentId: number;
  equipmentName: string;
  centerId: number;
  centerName: string;
  category: string;
  totalHours: number;
  bookedHours: number;
  utilizationRate: number;
  period: string;
}

export interface PeakValleyStats {
  hour: number;
  bookingCount: number;
}

export interface TrendStats {
  date: string;
  utilizationRate: number;
  bookedHours: number;
}

export interface RankingItem {
  equipmentId: number;
  equipmentName: string;
  centerName: string;
  category: string;
  bookedHours: number;
  utilizationRate: number;
  rank: number;
}

export interface CenterStats {
  centerId: number;
  centerName: string;
  equipmentCount: number;
  bookedHours: number;
  utilizationRate: number;
}

export interface Notification {
  id: number;
  userId: number;
  type: NotificationType;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export interface UnreadCount {
  userId: number;
  unreadCount: number;
  bookingCount: number;
  maintenanceCount: number;
  billingCount: number;
}

export interface AuditLog {
  id: number;
  userId?: number;
  userName: string;
  action: string;
  tableName: string;
  recordId?: number;
  oldValue: Record<string, any>;
  newValue: Record<string, any>;
  ipAddress: string;
  createdAt: string;
  fieldDiffs?: FieldDiff[];
}

export interface AuditLogFilter {
  userId?: number;
  action?: string;
  tableName?: string;
  startDate?: string;
  endDate?: string;
  ipAddress?: string;
}

export interface FieldDiff {
  field: string;
  oldValue: any;
  newValue: any;
}

export interface ApiResponse<T = void> {
  code: number;
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}
