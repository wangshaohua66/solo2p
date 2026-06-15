export type DisorderType = 'crack' | 'pothole' | 'bridge_jump' | 'rutting' | 'other';

export type Severity = 'mild' | 'moderate' | 'severe' | 'critical';

export type DisorderStatus = 'reported' | 'graded' | 'assigned' | 'repairing' | 'accepting' | 'closed';

export type WorkOrderStatus = 'pending' | 'assigned' | 'repairing' | 'accepting' | 'closed' | 'rejected';

export type UserRole = 'inspector' | 'manager' | 'foreman' | 'acceptor' | 'admin';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  phone: string;
  avatar?: string;
  createdAt: string;
}

export interface RoadSection {
  id: string;
  name: string;
  code: string;
  startPoint: string;
  endPoint: string;
  length: number;
  direction: string;
  region: string;
  level: string;
}

export interface ConstructionTeam {
  id: string;
  name: string;
  leaderName: string;
  leaderPhone: string;
  memberCount: number;
  skills: DisorderType[];
  currentWorkOrderId?: string;
  status: 'idle' | 'working' | 'rest';
}

export interface Disorder {
  id: string;
  type: DisorderType;
  severity: Severity;
  description: string;
  location: {
    lat: number;
    lng: number;
    address?: string;
    roadSectionId?: string;
    mileage?: string;
  };
  images: string[];
  reporterId: string;
  reporterName: string;
  status: DisorderStatus;
  workOrderId?: string;
  gradedBy?: string;
  gradedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkOrder {
  id: string;
  disorderId: string;
  title: string;
  description: string;
  teamId: string;
  teamName: string;
  assigneeId: string;
  assigneeName: string;
  status: WorkOrderStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimatedHours?: number;
  actualHours?: number;
  materials?: {
    name: string;
    quantity: number;
    unit: string;
  }[];
  repairImages?: string[];
  repairDescription?: string;
  acceptanceResult?: 'pass' | 'fail';
  acceptanceRemark?: string;
  acceptedBy?: string;
  acceptedAt?: string;
  createdAt: string;
  updatedAt: string;
  deadline?: string;
}

export interface TrackPoint {
  id: string;
  inspectorId: string;
  inspectorName: string;
  lat: number;
  lng: number;
  timestamp: string;
  speed?: number;
  accuracy?: number;
}

export interface CoverageStats {
  date: string;
  inspectorId: string;
  inspectorName: string;
  roadSectionIds: string[];
  totalMileage: number;
  effectiveMileage: number;
  repeatedMileage: number;
  workHours: number;
  pointCount: number;
}

export interface TeamRecommendation {
  teamId: string;
  teamName: string;
  matchScore: number;
  reason: string;
  estimatedDuration: number;
}

export interface AcceptanceRecord {
  id: string;
  workOrderId: string;
  disorderId: string;
  acceptorId: string;
  acceptorName: string;
  result: 'pass' | 'fail';
  remark: string;
  images: string[];
  createdAt: string;
}

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data?: T;
  timestamp: number;
}
