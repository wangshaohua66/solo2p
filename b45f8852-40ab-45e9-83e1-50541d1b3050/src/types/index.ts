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
  path: string[];
  description: string;
  estimatedCapacity: number;
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
