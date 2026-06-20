export type UserRole = 
  | 'admin' 
  | 'operator' 
  | 'organizer' 
  | 'exhibitor' 
  | 'builder' 
  | 'provider' 
  | 'visitor';

export interface User {
  id: string;
  username: string;
  realName: string;
  role: UserRole;
  email: string;
  phone: string;
  company: string;
  permissions: Record<string, boolean>;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: User;
}

export type ScheduleStatus = 
  | 'pending' 
  | 'approved' 
  | 'rejected' 
  | 'locked' 
  | 'cancelled' 
  | 'ongoing' 
  | 'completed';

export type VenueType = 'exhibition_hall' | 'meeting_room' | 'multi_function';

export interface Venue {
  id: string;
  name: string;
  type: VenueType;
  area: number;
  capacity: number;
  floor: number;
  facilities: Record<string, boolean>;
  description: string;
  createdAt: string;
}

export interface Schedule {
  id: string;
  exhibitionName: string;
  organizerId: string;
  organizerName?: string;
  venueIds: string[];
  venues?: Venue[];
  startDate: string;
  endDate: string;
  setupStartDate: string;
  teardownEndDate: string;
  status: ScheduleStatus;
  exhibitionType: string;
  expectedVisitors: number;
  actualVisitors?: number;
  description: string;
  hasConflict?: boolean;
  conflictIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleConflict {
  hasConflict: boolean;
  conflicts: Schedule[];
}

export type ContractStatus = 
  | 'draft' 
  | 'reviewing' 
  | 'approved' 
  | 'signed' 
  | 'archived' 
  | 'rejected';

export interface ApprovalStep {
  id: string;
  name: string;
  approverId: string;
  approverName?: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedAt?: string;
  comment: string;
  order: number;
}

export interface Contract {
  id: string;
  scheduleId: string;
  scheduleName?: string;
  partyA: string;
  partyB: string;
  partyBContact: string;
  templateId: string;
  templateName?: string;
  amount: number;
  depositRate: number;
  depositAmount: number;
  status: ContractStatus;
  currentStep: number;
  approvalFlow: ApprovalStep[];
  content: string;
  signedUrl?: string;
  archiveNo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContractTemplate {
  id: string;
  name: string;
  type: string;
  content: string;
  defaultDepositRate: number;
  isDefault: boolean;
  createdAt: string;
}

export type FinanceType = 'income' | 'expense' | 'deposit' | 'refund';
export type FinanceStatus = 'pending' | 'confirmed' | 'cancelled';
export type PaymentMethod = 'bank_transfer' | 'alipay' | 'wechat' | 'cash' | 'check';

export interface FinanceRecord {
  id: string;
  contractId: string;
  contractName?: string;
  scheduleId: string;
  scheduleName?: string;
  type: FinanceType;
  amount: number;
  paymentMethod: PaymentMethod;
  invoiceNo?: string;
  invoiceDate?: string;
  status: FinanceStatus;
  remark: string;
  recordedAt: string;
  confirmedAt?: string;
  operatorId: string;
  operatorName?: string;
  createdAt: string;
}

export interface DepositRecord {
  id: string;
  contractId: string;
  scheduleId: string;
  amount: number;
  receivedAmount: number;
  refundableAmount: number;
  refundedAmount: number;
  status: 'pending' | 'partial' | 'full' | 'refunded';
  dueDate: string;
  refundDate?: string;
  createdAt: string;
}

export interface MergeSettleRequest {
  scheduleIds: string[];
  includeDeposit: boolean;
}

export interface MergeSettleResult {
  totalAmount: number;
  incomeAmount: number;
  expenseAmount: number;
  depositAmount: number;
  records: FinanceRecord[];
}

export type BoothStatus = 'available' | 'reserved' | 'sold' | 'occupied' | 'maintenance';
export type BoothZone = 'A' | 'B' | 'C' | 'D' | 'E';

export interface Booth {
  id: string;
  venueId: string;
  boothNo: string;
  area: number;
  basePrice: number;
  zone: BoothZone;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  status: BoothStatus;
  exhibitorId?: string;
  exhibitorName?: string;
  scheduleId?: string;
  customPrice?: number;
  facilities: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BoothAllocation {
  id: string;
  scheduleId: string;
  boothId: string;
  exhibitorId: string;
  exhibitorName: string;
  price: number;
  status: 'reserved' | 'confirmed' | 'cancelled';
  createdAt: string;
}

export interface HeatmapData {
  boothId: string;
  visitorCount: number;
  avgStayTime: number;
  peakHour: string;
}

export type ProviderStatus = 'pending' | 'approved' | 'rejected' | 'suspended' | 'expired';
export type ServiceType = 'construction' | 'logistics' | 'catering' | 'cleaning' | 'security' | 'equipment' | 'other';

export interface ServiceProvider {
  id: string;
  companyName: string;
  contactPerson: string;
  contactPhone: string;
  email: string;
  serviceType: ServiceType;
  qualificationCert: string;
  qualificationExpiry: string;
  businessLicense: string;
  status: ProviderStatus;
  rating: number;
  reviewCount: number;
  quoteRange: { min: number; max: number };
  description: string;
  createdAt: string;
}

export type ServiceOrderStatus = 'pending' | 'assigned' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';

export interface ServiceOrder {
  id: string;
  scheduleId: string;
  scheduleName: string;
  providerId: string;
  providerName: string;
  serviceType: ServiceType;
  description: string;
  location: string;
  contactPerson: string;
  contactPhone: string;
  scheduledTime: string;
  estimatedDuration: number;
  quotedAmount: number;
  actualAmount?: number;
  status: ServiceOrderStatus;
  rating?: number;
  review?: string;
  createdAt: string;
  acceptedAt?: string;
  completedAt?: string;
}

export interface VisitorRecord {
  id: string;
  visitorId: string;
  scheduleId: string;
  checkinTime: string;
  checkoutTime?: string;
  boothVisits: {
    boothId: string;
    enterTime: string;
    leaveTime?: string;
  }[];
  totalStayTime: number;
  qrCode: string;
}

export interface Appointment {
  id: string;
  visitorId: string;
  visitorName: string;
  exhibitorId: string;
  exhibitorName: string;
  scheduleId: string;
  boothId: string;
  boothNo: string;
  scheduledTime: string;
  topic: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  createdAt: string;
}

export interface AnalyticsData {
  totalVisitors: number;
  totalRevenue: number;
  scheduleUtilization: number;
  boothUtilization: number;
  visitorTrend: { date: string; count: number }[];
  revenueTrend: { month: string; amount: number }[];
  exhibitorDistribution: { type: string; count: number }[];
  visitorSource: { source: string; count: number }[];
  topExhibitors: { name: string; visitors: number }[];
  scheduleUtilizationByMonth: { month: string; rate: number }[];
}

export interface TodoItem {
  id: string;
  type: 'schedule_approval' | 'contract_sign' | 'service_order' | 'payment_due' | 'qualification_expiry';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  relatedId: string;
  relatedType: string;
  deadline: string;
  createdAt: string;
}

export interface SystemAlert {
  id: string;
  type: 'schedule_conflict' | 'qualification_expiry' | 'contract_overdue' | 'payment_overdue' | 'system_error';
  level: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  relatedId?: string;
  read: boolean;
  createdAt: string;
}

export interface OperationLog {
  id: string;
  userId: string;
  userName: string;
  operation: string;
  module: string;
  details: Record<string, unknown>;
  ip: string;
  userAgent: string;
  createdAt: string;
}

export interface Role {
  id: string;
  name: string;
  code: string;
  description: string;
  permissions: string[];
  createdAt: string;
}

export interface PageResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}
