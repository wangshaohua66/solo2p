export enum DisorderType {
  Pothole = 'pothole',
  Crack = 'crack',
  Rutting = 'rutting',
  BridgeJump = 'bridge_jump',
  Other = 'other'
}

export enum Severity {
  Mild = 'mild',
  Moderate = 'moderate',
  Severe = 'severe',
  Critical = 'critical'
}

export enum DisorderStatus {
  Reported = 'reported',
  Graded = 'graded',
  Assigned = 'assigned',
  Repairing = 'repairing',
  Accepting = 'accepting',
  Closed = 'closed'
}

export enum WorkOrderStatus {
  Pending = 'pending',
  Assigned = 'assigned',
  Repairing = 'repairing',
  Accepting = 'accepting',
  Closed = 'closed',
  Rejected = 'rejected'
}

export enum UserRole {
  Inspector = 'inspector',
  Manager = 'manager',
  Foreman = 'foreman',
  Acceptor = 'acceptor',
  Admin = 'admin'
}

export interface User {
  id: string;
  username: string;
  realName: string;
  role: UserRole;
  phone?: string;
  teamId?: string;
  department?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoadSection {
  id: string;
  name: string;
  roadCode: string;
  roadLevel: 'national' | 'provincial' | 'county' | 'township';
  startPoint: { lat: number; lng: number };
  endPoint: { lat: number; lng: number };
  lengthKm: number;
  responsibleTeam?: string;
  description?: string;
}

export interface ConstructionTeam {
  id: string;
  name: string;
  specialties: DisorderType[];
  maxConcurrent: number;
  baseLng: number;
  baseLat: number;
  phone?: string;
  leaderName?: string;
}

export interface Disorder {
  id: string;
  type: DisorderType;
  severity: Severity;
  priorityScore: number;
  location: {
    lat: number;
    lng: number;
    address?: string;
    mileage?: string;
    roadSectionId: string;
  };
  stakeNumber?: string;
  roadSectionId: string;
  roadSection?: RoadSection;
  description?: string;
  photos: string[];
  reporterId: string;
  reporterName?: string;
  status: DisorderStatus;
  workOrderId?: string;
  graderId?: string;
  gradedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkOrder {
  id: string;
  disorderId: string;
  disorder?: Disorder;
  teamId: string;
  team?: ConstructionTeam;
  assignerId: string;
  assignerName?: string;
  status: WorkOrderStatus;
  progress: number;
  deadline: string;
  acceptedAt?: string;
  completedAt?: string;
  closedAt?: string;
  repairPhotos?: string[];
  acceptanceResult?: {
    passed: boolean;
    comment: string;
    photos: string[];
    inspectorId: string;
    timestamp: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface TrackPoint {
  id?: string;
  patrolId?: string;
  inspectorId?: string;
  userId?: string;
  lat: number;
  lng: number;
  speed?: number;
  timestamp: string;
}

export interface TeamRecommendation {
  teamId: string;
  teamName: string;
  distance: number;
  loadScore: number;
  specialtyScore: number;
  totalScore: number;
  score: number;
  currentLoad: number;
  workload: number;
  matchSpecialties: DisorderType[];
}

export interface CoverageStats {
  roadSectionId: string;
  roadSectionName: string;
  totalLength: number;
  coveredLength: number;
  coverageRate: number;
  lastPatrolTime?: string;
  date?: string;
  plannedLength?: number;
  actualLength?: number;
}

export interface AcceptanceRecord {
  id: string;
  workOrderId: string;
  workOrder?: WorkOrder;
  inspectorId: string;
  inspector?: User;
  score?: number;
  passed: boolean;
  comment?: string;
  photos: string[];
  timestamp: string;
  createdAt: string;
}

export interface NotificationMessage {
  id: string;
  type: 'disorder' | 'work_order' | 'alert' | 'system';
  channel?: string;
  title: string;
  content: string;
  relatedId?: string;
  read: boolean;
  createdAt: string;
  data?: any;
}

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
  timestamp?: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse<T> {
  list: T[];
  items?: T[];
  total: number;
  page: number;
  pageSize: number;
}
