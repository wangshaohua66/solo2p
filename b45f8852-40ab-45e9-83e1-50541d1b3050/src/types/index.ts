export type VoltageLevel = '500kV' | '220kV' | '110kV';

export type MaintenanceCategory =
  | 'primary_outage'
  | 'secondary_calibration'
  | 'corridor_clearing'
  | 'technical_reform';

export type ApprovalStatus =
  | 'draft'
  | 'submitted'
  | 'reviewing'
  | 'approved'
  | 'rejected'
  | 'completed';

export type OutageLevel = 'level1' | 'level2' | 'level3';

export type EquipmentType =
  | 'transformer'
  | 'breaker'
  | 'disconnector'
  | 'busbar'
  | 'line';

export type ConflictType =
  | 'duplicate_equipment'
  | 'area_overlap'
  | 'protection_window'
  | 'peak_load';

export type ConflictSeverity = 'critical' | 'warning' | 'info';

export type UserLevel = 'A' | 'B' | 'C';

export type ApprovalAction =
  | 'submit'
  | 'review_pass'
  | 'review_reject'
  | 'approve'
  | 'approve_reject'
  | 'withdraw';

export type ApprovalRole = 'reviewer' | 'approver';

export interface Substation {
  id: string;
  name: string;
  voltageLevel: VoltageLevel;
  capacity: number;
  region: string;
  x: number;
  y: number;
}

export interface Equipment {
  id: string;
  name: string;
  type: EquipmentType;
  substationId: string;
  parentId?: string;
  children?: string[];
  ratedCapacity?: number;
}

export interface TransmissionLine {
  id: string;
  name: string;
  fromStationId: string;
  toStationId: string;
  lengthKm: number;
  voltageLevel: VoltageLevel;
}

export interface ApprovalEntry {
  id: string;
  taskId: string;
  operatorId: string;
  operatorName: string;
  action: ApprovalAction;
  role?: ApprovalRole;
  comment?: string;
  operatedAt: number;
}

export interface MaintenanceTask {
  id: string;
  title: string;
  category: MaintenanceCategory;
  equipmentId?: string;
  lineId?: string;
  startTime: number;
  endTime: number;
  outageDurationH: number;
  outageLevel: OutageLevel;
  applicant: string;
  applicantId: string;
  department: string;
  workContent: string;
  approvalStatus: ApprovalStatus;
  approvalLog: ApprovalEntry[];
  affectedStationIds: string[];
  lostCapacity: number;
  affectedUserLevel: UserLevel;
  loadTransferPlan?: string;
  createdAt: number;
  updatedAt: number;
}

export type PartialTask = Partial<
  Omit<MaintenanceTask, 'id' | 'createdAt' | 'updatedAt' | 'approvalLog'>
>;

export interface ConflictInfo {
  id: string;
  type: ConflictType;
  severity: ConflictSeverity;
  taskAId: string;
  taskBId?: string;
  overlapStart?: number;
  overlapEnd?: number;
  description: string;
  resolved: boolean;
  detectedAt: number;
}

export interface PlanFilters {
  timeRange?: [number, number];
  voltageLevels?: VoltageLevel[];
  categories?: MaintenanceCategory[];
  statuses?: ApprovalStatus[];
  keyword?: string;
  department?: string;
  equipmentTypes?: EquipmentType[];
}

export type PowerSupplyPath = string[];

export interface OutageScope {
  outageNodes: Set<string>;
  level1Nodes: Set<string>;
  level2Nodes: Set<string>;
  affectedStations: string[];
  lostCapacity: number;
  outageLevel: OutageLevel;
}

export type AdjacencyMap = Map<string, string[]>;

export type SidebarMode = 'full' | 'icon' | 'top';
export type GanttZoom = 'day' | 'week' | 'month';

export interface TransferSuggestion {
  id: string;
  priority: 'high' | 'medium' | 'low';
  description: string;
  switchOperations: string[];
  estimatedCapacity: number;
  sourceStationId: string;
  targetStationId: string;
  viaLineId?: string;
}

export interface ProtectionWindow {
  name: string;
  start: number;
  end: number;
}

export interface TimeAxisItem {
  ts: number;
  label: string;
  dayOfWeek: number;
}

export type ReportType = 'maintenance_report' | 'acceptance_record' | 'site_photo' | 'test_report';
export type AcceptanceConclusion = 'pass' | 'fail' | 'conditional_pass';

export interface ReportFile {
  id: string;
  taskId: string;
  name: string;
  type: ReportType;
  size: number;
  uploader: string;
  uploaderId: string;
  uploadedAt: number;
  conclusion?: AcceptanceConclusion;
  remark?: string;
  fileUrl?: string;
}

export interface OnlineUser {
  id: string;
  name: string;
  avatar?: string;
  role: string;
  color: string;
  cursorTaskId?: string;
  lastActiveAt: number;
}

export interface CollabMessage<T = any> {
  type: string;
  senderId: string;
  data: T;
  timestamp: number;
  version?: number;
}

export interface CollaborationState {
  connected: boolean;
  users: OnlineUser[];
  lastSyncAt: number;
  currentUserId: string;
}
