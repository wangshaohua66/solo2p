export type VenueType = 'stadium' | 'arena' | 'aquatic_center';
export type EventType = 'football' | 'basketball' | 'swimming' | 'concert' | 'business' | 'exhibition';
export type EventStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'scheduled' | 'completed' | 'cancelled';
export type ResourceType = 'main_field' | 'training_field' | 'vip_box' | 'media_center' | 'locker_room' | 'parking' | 'catering' | 'lighting' | 'audio' | 'screen' | 'scoreboard' | 'first_aid' | 'security_room';
export type ResourceStatus = 'available' | 'occupied' | 'maintenance' | 'transitioning';
export type ApprovalRole = 'dispatcher' | 'manager' | 'finance';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'escalated';
export type EmergencyType = 'weather' | 'equipment' | 'security';
export type EmergencyStatus = 'idle' | 'triggered' | 'in_progress' | 'resolved';
export type EquipmentMode = 'sports' | 'concert';
export type VipBoxLevel = 'standard' | 'premium' | 'presidential';
export type BookingPriority = 'low' | 'medium' | 'high' | 'critical';
export type BookingStatus = 'pending' | 'locked' | 'confirmed' | 'cancelled' | 'negotiating';

export interface Venue {
  id: string;
  name: string;
  type: VenueType;
  capacity: number;
  description: string;
  location: string;
  image: string;
}

export interface Resource {
  id: string;
  venueId: string;
  name: string;
  type: ResourceType;
  status: ResourceStatus;
  capacity: number;
  conversionTime: number;
  currentEventId?: string;
  position: { x: number; y: number; z?: number };
  category: string;
}

export interface EventItem {
  id: string;
  venueId: string;
  name: string;
  type: EventType;
  startDate: Date;
  endDate: Date;
  status: EventStatus;
  organizer: string;
  expectedRevenue: number;
  actualRevenue?: number;
  requiredResources: string[];
  approvalSteps: ApprovalStep[];
  description: string;
  audienceCount?: number;
  equipmentMode: EquipmentMode;
}

export interface ScheduleSlot {
  id: string;
  eventId: string;
  resourceId: string;
  startTime: Date;
  endTime: Date;
  status: 'pending' | 'confirmed' | 'locked';
  lockExpiresAt?: Date;
}

export interface ApprovalStep {
  id: string;
  eventId: string;
  role: ApprovalRole;
  status: ApprovalStatus;
  approver?: string;
  comment?: string;
  createdAt: Date;
  updatedAt?: Date;
  deadline?: Date;
}

export interface ConflictDetail {
  type: 'schedule' | 'resource' | 'equipment';
  description: string;
  conflictingEventId: string;
  conflictingEventName: string;
  conflictingTime?: { start: Date; end: Date };
  severity: 'low' | 'medium' | 'high';
}

export interface ScheduleSuggestion {
  alternativeDate: Date;
  alternativeResources: string[];
  reason: string;
  impactLevel: 'low' | 'medium' | 'high';
}

export interface ConflictResult {
  hasConflict: boolean;
  conflicts: ConflictDetail[];
  suggestions: ScheduleSuggestion[];
  detectionTime: number;
}

export interface TicketType {
  id: string;
  eventId: string;
  name: string;
  price: number;
  totalCount: number;
  soldCount: number;
  category: string;
}

export interface RevenueData {
  date: string;
  revenue: number;
  ticketsSold: number;
  venueId: string;
  eventType: EventType;
}

export interface SalesAlert {
  id: string;
  eventId: string;
  eventName: string;
  type: 'spike' | 'drop' | 'anomaly';
  severity: 'low' | 'medium' | 'high';
  description: string;
  detectedAt: Date;
  resolved: boolean;
}

export interface EmergencyPlan {
  id: string;
  type: EmergencyType;
  name: string;
  description: string;
  icon: string;
  color: string;
  steps: EmergencyStep[];
  notificationList: string[];
  estimatedDuration: number;
}

export interface EmergencyStep {
  id: string;
  order: number;
  description: string;
  responsibleRole: string;
  expectedDuration: number;
  status?: 'pending' | 'in_progress' | 'completed' | 'skipped';
  completedAt?: Date;
  completedBy?: string;
}

export interface EmergencyLog {
  id: string;
  planId: string;
  planName: string;
  type: EmergencyType;
  status: EmergencyStatus;
  triggeredAt: Date;
  triggeredBy: string;
  resolvedAt?: Date;
  steps: EmergencyStep[];
  notifications: NotificationRecord[];
  notes?: string;
}

export interface NotificationRecord {
  id: string;
  recipient: string;
  role: string;
  channel: 'app' | 'sms' | 'email' | 'phone';
  status: 'sent' | 'delivered' | 'read' | 'failed';
  sentAt: Date;
  deliveredAt?: Date;
  readAt?: Date;
  content: string;
}

export interface Equipment {
  id: string;
  venueId: string;
  name: string;
  category: string;
  status: 'normal' | 'warning' | 'fault' | 'maintenance';
  sportsMode: boolean;
  concertMode: boolean;
  lastCheckDate: Date;
  location: string;
  specification: string;
}

export interface VipBox {
  id: string;
  venueId: string;
  name: string;
  level: VipBoxLevel;
  capacity: number;
  status: 'available' | 'occupied' | 'maintenance';
  position: { row: number; col: number };
  amenities: string[];
  price: number;
}

export interface VipBooking {
  id: string;
  boxId: string;
  eventId: string;
  eventName: string;
  customerName: string;
  priority: BookingPriority;
  status: BookingStatus;
  lockExpiresAt?: Date;
  createdAt: Date;
  confirmedAt?: Date;
  notes?: string;
  amount: number;
}

export interface DashboardStats {
  totalRevenue: number;
  revenueChange: number;
  totalEvents: number;
  eventsChange: number;
  totalTickets: number;
  ticketsChange: number;
  venueUtilization: number;
  utilizationChange: number;
  pendingApprovals: number;
  activeAlerts: number;
}

export interface VenueStats {
  venueId: string;
  venueName: string;
  eventsCount: number;
  revenue: number;
  utilization: number;
  capacity: number;
}
